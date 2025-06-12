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
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class AgentService implements OnModuleInit {
  private bufferMemory: BufferMemory;
  private summaryMemory: ConversationSummaryMemory;
  private llm: ChatOpenAI;
  private agent: AgentExecutor;
  private readonly logger = new Logger(AgentService.name);
  private classificationChain: LLMChain;

  constructor(
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
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    // Main streaming LLM for agent reasoning
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      temperature: 0,
      streaming: true,
    });
    // Dedicated non-streaming LLM for robust classification
    const classificationLLM = new ChatOpenAI({
      openAIApiKey: apiKey,
      temperature: 0,
      streaming: false,
      modelName:
        this.configService.get<string>('OPENAI_CLASSIFICATION_MODEL') ||
        'gpt-3.5-turbo',
    });

    // Enhanced few-shot classification prompt with examples
    const classifyPrompt = new PromptTemplate({
      template: `아래 예시를 참고하여, 주어진 사용자 입력에 대해 호출할 툴을 결정하세요. 가능한 값(하나만): route-summary, route-realtimeArrivalInfo, route-realtime-traffic, alarm, calendar, fallback.
예시:
사용자 입력: '서울역에서 강남역까지 가는 방법을 알려줘' → route-summary
사용자 입력: '알람 8시에 깨워줘' → alarm
사용자 입력: '오늘 일정 추가해 줘' → calendar
사용자 입력: '일반 대화 테스트' → fallback
사용자 입력: '{input}'`,
      inputVariables: ['input'],
    });
    this.classificationChain = new LLMChain({
      llm: classificationLLM,
      prompt: classifyPrompt,
    });

    const tools = [
      // 1) 경로 요약
      tool(
        async ({ fromAddress, toAddress, date, time }) => {
          // Validate required fields and prompt user if missing
          if (!fromAddress) {
            return '출발지를 알려주세요. (예: 서울역)';
          }
          if (!toAddress) {
            return '도착지를 알려주세요. (예: 김포공항)';
          }
          if (!date) {
            return '날짜를 알려주세요. (YYYY-MM-DD)';
          }
          if (!time) {
            return '시간을 알려주세요. (HH:MM)';
          }
          // All inputs present, call the route pipeline to get summary
          const out = await this.routeChain.call({
            fromAddress,
            toAddress,
            date,
            time,
          });
          return out.summary as string;
        },
        {
          name: 'route-summary',
          description: '출발지·도착지·날짜·시간 기준 경로 요약 조회',
          schema: {
            type: 'object',
            properties: {
              fromAddress: { type: 'string' },
              toAddress: { type: 'string' },
              date: { type: 'string' },
              time: { type: 'string' },
            },
            required: ['fromAddress', 'toAddress', 'date', 'time'],
          },
          returnDirect: true,
        },
      ),
      // 2) 실시간 도착 정보
      tool(
        async ({ fromAddress, toAddress }) => {
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
        async ({ fromAddress, toAddress }) => {
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
        async ({ time, message }) => {
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
        async ({ date, eventDetails }) => {
          const output = await this.calendarChain.call({ date, eventDetails });
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
        async ({ input }) => {
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
    ];
    this.agent = await initializeAgentExecutorWithOptions(tools, this.llm, {
      // Use a textual ReAct agent to surface chain-of-thought reasoning
      agentType: 'structured-chat-zero-shot-react-description',
      maxIterations: 8,
      returnIntermediateSteps: true,
      verbose: true,
      handleParsingErrors: (e) =>
        `필수 파라미터가 누락되었습니다: ${e.message}`,
      handleToolRuntimeErrors: (e) => `Tool error: ${e.message}`,
      agentArgs: {
        // Instruct the model to think step by step before calling tools
        prefix: `You are Lami, a versatile AI assistant. Think through your reasoning step by step before deciding to call a tool. You have the following functions: route, alarm, calendar, and fallback. For routing queries, include departure, destination, date, and time. If any of these required details (fromAddress, toAddress, date, or time) are missing from the user's input, ask a clarifying question to collect them before attempting to call the tool.`,
      },
    });
    this.logger.log(
      'Agent initialized with tools: ' + tools.map((t) => t.name).join(', '),
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
    // Intent classification
    const { text: classificationRaw } = await this.classificationChain.call({
      input,
    });
    const classification = classificationRaw.trim().toLowerCase();
    if (classification === 'fallback') {
      // Handle general chit-chat via fallbackChain
      const out = await this.fallbackChain.call({ input });
      return out.output;
    }
    // Reset conversation memory for each request
    this.bufferMemory = new BufferMemory({ memoryKey: 'chat_history' });
    this.summaryMemory = new ConversationSummaryMemory({
      memoryKey: 'chat_history',
      llm: this.llm,
    });
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
      // Clear previous conversation memory for route context
      this.bufferMemory = new BufferMemory({ memoryKey: 'chat_history' });
      this.summaryMemory = new ConversationSummaryMemory({
        memoryKey: 'chat_history',
        llm: this.llm,
      });
      const rawRoutes = result;
      const hash = createHash('md5')
        .update(JSON.stringify(rawRoutes))
        .digest('hex');
      const cacheKey = `agent:routes:${hash}`;
      await this.cacheManager.set(cacheKey, rawRoutes, 60);
      const summary = await this.summaryChain.call(rawRoutes);
      result = { summary, cacheKey };
    }
    // 2) 메모리 관리: 대화 기록 및 요약 저장
    await this.bufferMemory.saveContext({ input }, { output: result });
    await this.summaryMemory.saveContext({ input }, { output: result });
    this.logger.log(`Agent output: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Run the agent with a streaming callback to send intermediate events via SSE
   */
  async runStream(
    input: string,
    sendEvent: (type: string, data: any) => void,
  ): Promise<any> {
    if (!this.agent) await this.initAgent();
    // Intent classification for streaming
    const { text: classificationRawStream } =
      await this.classificationChain.call({ input });
    const classificationStream = classificationRawStream.trim().toLowerCase();
    if (classificationStream === 'fallback') {
      // Direct fallback for chit-chat
      const out = await this.fallbackChain.call({ input });
      return out.output;
    }
    // Reset conversation memory for each streaming request
    this.bufferMemory = new BufferMemory({ memoryKey: 'chat_history' });
    this.summaryMemory = new ConversationSummaryMemory({
      memoryKey: 'chat_history',
      llm: this.llm,
    });
    this.logger.log(`Agent received streaming input: ${input}`);
    const callback = new StreamCallback(sendEvent);
    // Invoke agent and stream callbacks
    const chainOutput = (await this.agent.call(
      { input },
      { callbacks: [callback] },
    )) as any;
    const { intermediateSteps = [] } = chainOutput;
    // Emit intermediate steps (chain-of-thought) safely
    try {
      if (Array.isArray(intermediateSteps)) {
        for (const step of intermediateSteps as any[]) {
          if (!Array.isArray(step) || step.length < 2) continue;
          const [action, observation] = step;
          sendEvent('step', {
            tool: action.tool,
            input: action.toolInput,
            reason: typeof action.log === 'string' ? action.log.trim() : '',
            observation,
          });
        }
      }
    } catch (e: any) {
      this.logger.error(
        `Error streaming intermediateSteps: ${e.message}`,
        e.stack,
      );
    }
    const { output: raw } = chainOutput;
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      result = raw;
    }
    // 캐시 저장 및 요약 체인 적용: 메모리 초기화 후 요약만 반환, 상세는 캐시에 저장
    if (Array.isArray(result)) {
      this.bufferMemory = new BufferMemory({ memoryKey: 'chat_history' });
      this.summaryMemory = new ConversationSummaryMemory({
        memoryKey: 'chat_history',
        llm: this.llm,
      });
      const rawRoutes = result;
      const hash = createHash('md5')
        .update(JSON.stringify(rawRoutes))
        .digest('hex');
      const cacheKey = `agent:routes:${hash}`;
      await this.cacheManager.set(cacheKey, rawRoutes, 60);
      const summary = await this.summaryChain.call(rawRoutes);
      result = { summary, cacheKey };
    }
    // 메모리 저장 (streaming에서 에러시 흐름 중단 방지)
    try {
      await this.bufferMemory.saveContext({ input }, { output: result });
      await this.summaryMemory.saveContext({ input }, { output: result });
    } catch (e) {
      this.logger.error(`Memory save error: ${e.message}`, e.stack);
    }
    return result;
  }
}
