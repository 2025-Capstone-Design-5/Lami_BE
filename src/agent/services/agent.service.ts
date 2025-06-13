import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initializeAgentExecutorWithOptions,
  AgentExecutor,
} from 'langchain/agents';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory';
import { RoutePipelineChain } from '../pipelines/route-pipeline.chain';
import { RealtimeArrivalPipelineChain } from '../pipelines/realtime-arrival-pipeline.chain';
import { RealtimeTrafficPipelineChain } from '../pipelines/realtime-traffic-pipeline.chain';
import { AlarmPipelineChain } from '../pipelines/alarm-pipeline.chain';
import { CalendarPipelineChain } from '../pipelines/calendar-pipeline.chain';
import { FallbackPipelineChain } from '../pipelines/fallback-pipeline.chain';
import { StreamCallback } from './stream-callback.handler';
import { SummaryPipelineChain } from '../pipelines/summary-pipeline.chain';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { RoutesService } from '../../traffic/routes/routes.service';
import { ChainValues } from '@langchain/core/utils/types';
import { CallbackManager } from '@langchain/core/callbacks/manager';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgentService implements OnModuleInit {
  private bufferMemory: BufferMemory;
  private summaryMemory: ConversationSummaryMemory;
  private llm: ChatOpenAI;
  private agent: AgentExecutor;
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly routesService: RoutesService,
    private readonly routeChain: RoutePipelineChain,
    private readonly alarmChain: AlarmPipelineChain,
    private readonly calendarChain: CalendarPipelineChain,
    private readonly fallbackChain: FallbackPipelineChain,
    private readonly realtimeArrivalChain: RealtimeArrivalPipelineChain,
    private readonly realtimeTrafficChain: RealtimeTrafficPipelineChain,
    private readonly summaryChain: SummaryPipelineChain,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit() {
    await this.initAgent();
  }

  private async initAgent() {
    const modelName = 'o4-mini-2025-04-16';
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.logger.log(`Using LLM model: ${modelName}`);
    // Main streaming LLM for agent reasoning
    const llmInstance = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName,
      temperature: 1,
      streaming: true,
    });
    // Monkey-patch invocationParams to strip 'stop'
    const llmAny = llmInstance as any;
    const originalInvocation = llmAny.invocationParams.bind(llmAny);
    llmAny.invocationParams = (options?: any, extra?: any) => {
      const params = originalInvocation(options, extra);
      delete params.stop;
      return params;
    };
    this.llm = llmInstance;

    this.agent = await initializeAgentExecutorWithOptions(
      [
        tool(
          async ({ fromAddress, toAddress, date, time }) => {
            if (!fromAddress) return '출발지를 알려주세요.';
            if (!toAddress) return '도착지를 알려주세요.';
            if (!date) return '날짜를 알려주세요. (YYYY-MM-DD)';
            if (!time) return '시간을 알려주세요. (HH:MM)';
            try {
              // Fetch raw routes
              const rawRoutes = await this.routesService.getAllRoutes(
                fromAddress,
                toAddress,
                { date, time },
              );

              // Get text summary for display
              const summary = await this.summaryChain.call(rawRoutes);

              // Build summaryRoutes array for UI display
              const summaryRoutes: Array<{
                category: string;
                duration: number;
                walkDurations: number[];
                transitDurations: number[];
                modes: string[];
                routeShortNames: string[];
                transferCount: number;
                transfers: any[];
                realtimeArrivalTimes: any[];
                trafficItems: any[];
                forecast: any[];
                stops: any[];
                startvehicletime?: any;
                routetp?: any;
                cityCode?: string;
                nodeId?: string;
                routeId?: string;
              }> = [];
              Object.entries(rawRoutes).forEach(([category, routeList]) => {
                (routeList as any[]).forEach((route) => {
                  const main = route.main;
                  summaryRoutes.push({
                    category,
                    duration: main.duration,
                    walkDurations: main.walkDurations,
                    transitDurations: main.transitDurations,
                    modes: main.modes,
                    routeShortNames: main.routeShortNames,
                    transferCount: main.transferCount,
                    transfers: main.transfers,
                    realtimeArrivalTimes: main.realtimeArrivalTimes,
                    trafficItems: main.trafficItems,
                    forecast: main.forecast,
                    stops: main.stops,
                    startvehicletime: main.startvehicletime,
                    routetp: main.routetp,
                    cityCode: main.cityCode,
                    nodeId: main.nodeId,
                    routeId: main.routeId,
                  });
                });
              });

              // Generate cache key for details lookup
              const hash = createHash('md5')
                .update(JSON.stringify(rawRoutes))
                .digest('hex');
              const uniqueSuffix = uuidv4();
              const cacheKey = `agent:routes:${hash}:${uniqueSuffix}`;

              // Store raw routes in cache
              await this.cacheManager.set(cacheKey, rawRoutes, 500 * 1000);

              // Return formatted data as JSON string
              return JSON.stringify({
                summary,
                cacheKey,
                routes: summaryRoutes,
              });
            } catch (error) {
              this.logger.error(
                `Route summary error: ${error.message}`,
                error.stack,
              );
              return `경로 조회 중 오류가 발생했습니다: ${error.message}`;
            }
          },
          {
            name: 'route-summary',
            description:
              '경로 요약을 생성합니다. 출발지, 도착지, 날짜, 시간이 필요합니다.',
            schema: {
              type: 'object',
              properties: {
                fromAddress: {
                  type: 'string',
                  description: '출발지 주소',
                },
                toAddress: {
                  type: 'string',
                  description: '도착지 주소',
                },
                date: {
                  type: 'string',
                  description: '날짜 (YYYY-MM-DD)',
                },
                time: {
                  type: 'string',
                  description: '시간 (HH:MM)',
                },
              },
              required: ['fromAddress', 'toAddress', 'date', 'time'],
            },
            returnDirect: true,
          },
        ),
        // 2) 실시간 도착 정보
        tool(
          async (args: { fromAddress: string; toAddress: string }) => {
            const { fromAddress, toAddress } = args;
            const info = await this.realtimeArrivalChain.call({
              fromAddress,
              toAddress,
            });
            return JSON.stringify(info.arrivalInfo);
          },
          {
            name: 'route-realtimeArrivalInfo',
            description: '출발지·도착지에 대한 실시간 도착 정보 조회',
            schema: {
              type: 'object',
              properties: {
                fromAddress: { type: 'string' },
                toAddress: { type: 'string' },
              },
              required: ['fromAddress', 'toAddress'],
            },
            returnDirect: true,
          },
        ),
        // 3) 실시간 교통 상황
        tool(
          async (args: { fromAddress: string; toAddress: string }) => {
            const { fromAddress, toAddress } = args;
            const traffic = await this.realtimeTrafficChain.call({
              fromAddress,
              toAddress,
            });
            return JSON.stringify(traffic);
          },
          {
            name: 'route-realtime-traffic',
            description: '출발지·도착지 간 실시간 교통 상황 조회',
            schema: {
              type: 'object',
              properties: {
                fromAddress: { type: 'string' },
                toAddress: { type: 'string' },
              },
              required: ['fromAddress', 'toAddress'],
            },
            returnDirect: true,
          },
        ),
        tool(
          async (args: { time: string; message: string }) => {
            const { time, message } = args;
            const output = await this.alarmChain.call({ time, message });
            return output.confirmation;
          },
          {
            name: 'alarm',
            description:
              '알람 설정을 위한 시간과 메시지를 받아 알람을 설정합니다',
            schema: {
              type: 'object',
              properties: {
                time: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['time', 'message'],
            },
            returnDirect: true,
          },
        ),
        tool(
          async (args: { date: string; eventDetails: string }) => {
            const { date, eventDetails } = args;
            const output = await this.calendarChain.call({
              date,
              eventDetails,
            });
            return output.confirmation;
          },
          {
            name: 'calendar',
            description: '날짜와 이벤트 세부 정보를 받아 일정을 등록합니다',
            schema: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                eventDetails: { type: 'string' },
              },
              required: ['date', 'eventDetails'],
            },
            returnDirect: true,
          },
        ),
        tool(
          async (args: { input: string }) => {
            const { input } = args;
            const out = await this.fallbackChain.call({ input });
            return out.output;
          },
          {
            name: 'fallback',
            description:
              '일반 대화, 인삿말, 기능 문의 등을 처리하는 함수입니다. 경로, 알람, 일정 기능 외 모든 입력에 대해 이 함수를 호출해야 합니다.',
            schema: {
              type: 'object',
              properties: { input: { type: 'string' } },
              required: ['input'],
            },
            returnDirect: true,
          },
        ),
      ],
      this.llm,
      {
        // Use a textual ReAct agent to surface chain-of-thought reasoning
        agentType: 'structured-chat-zero-shot-react-description',
        maxIterations: 8,
        returnIntermediateSteps: true,
        verbose: true,
        handleParsingErrors: (e) => {
          const msg = e.message || '';
          if (msg.includes('fromAddress')) {
            return '🚗 출발지가 누락되었습니다. 예시: "서울역에서 강남역까지 가는 경로를 알려줘, 2025-06-15, 14:30"';
          }
          if (msg.includes('toAddress')) {
            return '🏁 도착지가 누락되었습니다. 예시: "서울역에서 강남역까지 가는 경로를 알려줘, 2025-06-15, 14:30"';
          }
          if (msg.includes('date')) {
            return '📅 날짜가 누락되었습니다. 예시: "서울역에서 강남역까지 가는 경로를 알려줘, 2025-06-15, 14:30"';
          }
          if (msg.includes('time')) {
            return '⏰ 시간이 누락되었습니다. 예시: "서울역에서 강남역까지 가는 경로를 알려줘, 2025-06-15, 14:30"';
          }
          return '입력 형식을 확인해주세요. 예시: "서울역에서 강남역까지 가는 경로를 알려줘, YYYY-MM-DD, HH:MM"';
        },
        handleToolRuntimeErrors: (e) => `Tool error: ${e.message}`,
        agentArgs: {
          prefix: `당신은 Lami라는 다용도 AI 비서입니다. 도구를 호출하기 전에 단계별로 사고 과정을 모두 한국어로 작성하세요.

만약 이전 대화 메모리에 routes(경로 데이터)가 저장되어 있고, 현재 입력이 '<fromAddress>에서 <toAddress>까지' 형식의 새로운 경로 요청을 포함하지 않는 후속 질문(예: '가장 빠른 경로는?')이라면, 도구를 호출하지 말고 기존 routes 데이터를 분석해서 답변하세요.
메모리에 저장된 routes 데이터는 경로 정보를 담은 배열 형태로 저장되어 있으며, 각 경로는 duration(소요 시간), modes(이동 수단), routeShortNames(노선명) 등의 정보를 포함합니다.

사용자 입력이 출발지와 도착지를 의미하는 구문(예: "...에서 ...까지", "...에서 ...까지 가는 경로 요청")과 날짜(YYYY-MM-DD 또는 YYYY년 MM월 DD일 등) 및 시간(HH:MM 또는 HH시 MM분 등)을 포함하면 경로 요약 요청으로 간주하고, 추가 질문 없이 즉시 'route-summary' 도구를 호출하세요.
파라미터가 누락된 경우, 누락된 항목(출발지, 도착지, 날짜, 시간)에 대해 구체적으로 한국어로 질문하세요.
실시간 도착 정보 요청에는 'route-realtimeArrivalInfo'를 호출하세요.
실시간 교통 상황 요청에는 'route-realtime-traffic'를 호출하세요.
알람 설정 요청에는 'alarm'을 호출하세요.
일정 등록 요청에는 'calendar'를 호출하세요.
일반 대화 요청에는 'fallback'을 호출하세요. fallback 도구를 호출할 때는 반드시 {{"input": "사용자 입력"}} 형태로 호출해야 합니다.`,
          suffix: `사용자 입력: {input}`,
        },
      },
    );
    this.logger.log(
      'Agent initialized with tools: ' +
        this.agent.tools.map((t) => t.name).join(', '),
    );

    // Initialize conversation memory
    this.bufferMemory = new BufferMemory({ memoryKey: 'chat_history' });
    this.summaryMemory = new ConversationSummaryMemory({
      memoryKey: 'chat_history',
      llm: this.llm,
    });
  }

  async run(input: string) {
    if (!this.agent) await this.initAgent();
    // Get previous memory context
    const memoryVariables = await this.bufferMemory.loadMemoryVariables({});
    this.logger.debug('Memory context:', memoryVariables);

    this.logger.log(`Agent received input: ${input}`);
    // Invoke agent and capture intermediate steps
    const chainOutput = (await this.agent.call({ input })) as any;
    const { output: raw, intermediateSteps } = chainOutput;
    this.logger.debug('Intermediate Steps:', intermediateSteps);
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      result = raw;
    }
    // 1) 캐시 저장 및 요약 체인: 경로 응답일 경우 메모리 초기화 후 요약만 반환, 상세는 캐시에 저장
    if (Array.isArray(result)) {
      // Handle route response without clearing previous memory, so follow-ups have context
      const rawRoutes = result;
      const hash = createHash('md5')
        .update(JSON.stringify(rawRoutes))
        .digest('hex');
      const uniqueSuffix = uuidv4();
      const cacheKey = `agent:routes:${hash}:${uniqueSuffix}`;
      await this.cacheManager.set(cacheKey, rawRoutes, 500 * 1000);
      const summary = await this.summaryChain.call(rawRoutes);
      result = { summary, cacheKey };
    }
    // 2) 메모리 관리: 대화 기록 및 요약 저장 (routes가 있으면 함께 저장)
    let memoryPayload: any = { output: result };
    if (
      typeof result === 'object' &&
      result !== null &&
      (result.routes || result.summaryRoutes)
    ) {
      // Store routes in a more structured format
      memoryPayload.routes = {
        data: result.routes || result.summaryRoutes,
        timestamp: new Date().toISOString(),
        type: 'route_data',
      };
    }
    await this.bufferMemory.saveContext({ input }, memoryPayload);
    await this.summaryMemory.saveContext({ input }, memoryPayload);
    this.logger.log(`Agent output: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Run the agent with a streaming callback to send intermediate events via SSE
   */
  async runStream(
    input: string,
    onToken: (token: string) => void,
    onError: (error: any) => void,
  ): Promise<void> {
    if (!this.agent) await this.initAgent();
    // Get previous memory context
    const memoryVariables = await this.bufferMemory.loadMemoryVariables({});
    this.logger.debug('Memory context:', memoryVariables);

    this.logger.log(`Agent received streaming input: ${input}`);
    // Load existing memory context from full chat history
    const memVars = await this.bufferMemory.loadMemoryVariables({});
    const historyContext = memVars.chat_history || '';
    // Prepend chat history so agent has full context including routes data
    const agentInput = historyContext ? `${historyContext}\n${input}` : input;

    // create a callback manager for streaming
    const manager = CallbackManager.fromHandlers({
      handleLLMNewToken: (token) => onToken(token),
      handleLLMError: (err) => onError(err),
      handleAgentAction: (action) => {
        const { tool, toolInput, log } = action;
        onToken(
          JSON.stringify({
            type: 'action_start',
            payload: { tool, toolInput, reason: (log ?? '').trim() },
          }),
        );
      },
      handleToolEnd: (output, runId, parentRunId, tags) => {
        const toolName =
          Array.isArray(tags) && tags.length > 0 ? tags[0] : runId;
        let result = output;
        if (typeof output === 'string') {
          try {
            result = JSON.parse(output);
          } catch {}
        }
        onToken(
          JSON.stringify({
            type: 'action_result',
            payload: { tool: toolName, result },
          }),
        );
      },
    });
    // Invoke agent with callbacks, passing chat-history-augmented input
    const chainOutput = (await this.agent.call(
      { input: agentInput },
      { callbacks: manager },
    )) as ChainValues;
    this.logger.log('Agent chain output:', chainOutput);
    const result = chainOutput.output;
    this.logger.log('Agent result:', result);

    // send intermediate steps and final
    onToken(
      JSON.stringify({
        type: 'final',
        payload: result,
        intermediateSteps: chainOutput.intermediateSteps,
      }),
    );

    // Save conversation memory after streaming
    try {
      let memoryPayload: any = { output: result };
      if (
        typeof result === 'object' &&
        result !== null &&
        (result.routes || result.summaryRoutes)
      ) {
        memoryPayload.routes = {
          data: result.routes || result.summaryRoutes,
          timestamp: new Date().toISOString(),
          type: 'route_data',
        };
      }
      await this.bufferMemory.saveContext({ input }, memoryPayload);
      await this.summaryMemory.saveContext({ input }, memoryPayload);
    } catch (error) {
      this.logger.error('Stream memory save error:', error);
    }
  }
}
