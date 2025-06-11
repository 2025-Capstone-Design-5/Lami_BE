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
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      temperature: 0,
    });

    // Intent classification prompt: route, alarm, calendar, fallback
    const classifyPrompt = new PromptTemplate({
      template: `다음 사용자 입력에 대해 호출할 툴을 결정하세요. 가능한 값은 오직 하나의 소문자 키워드로 응답합니다: route-summary, route-realtimeArrivalInfo, route-realtime-traffic, alarm, calendar, fallback.\n\n사용자 입력: {input}`,
      inputVariables: ['input'],
    });
    this.classificationChain = new LLMChain({
      llm: this.llm,
      prompt: classifyPrompt,
    });

    const tools = [
      // 1) 경로 요약
      tool(
        async ({ fromAddress, toAddress, date, time }) => {
          const out = await this.routeChain.call({
            fromAddress,
            toAddress,
            date,
            time,
          });
          return JSON.stringify(out.routes);
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
      agentType: 'openai-functions',
      maxIterations: 5,
      returnIntermediateSteps: true,
      verbose: true,
      handleParsingErrors: (e) =>
        `필수 파라미터가 누락되었습니다: ${e.message}`,
      handleToolRuntimeErrors: (e) => `Tool error: ${e.message}`,
      agentArgs: {
        prefix: `You are Lami, a versatile AI assistant with the following functions: route (for routing), alarm (for setting alarms), calendar (for scheduling), and fallback (for general conversation). For any user input not related to routing, alarms, or calendar, you must call the fallback function with the full user input. The fallback function will handle greetings, capability inquiries (e.g., '너는 어떤 기능이니'), and general chit-chat. When a user asks for routing, ensure the input includes departure, destination, date (YYYY-MM-DD), and time (HH:MM). If any information is missing, ask explicitly: '출발지에서 도착지로 YYYY-MM-DD HH:MM 도착 기준으로 알려줘'.`,
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
    // 메모리 저장
    await this.bufferMemory.saveContext({ input }, { output: result });
    await this.summaryMemory.saveContext({ input }, { output: result });
    return result;
  }
}
