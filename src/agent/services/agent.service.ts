import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initializeAgentExecutorWithOptions,
  AgentExecutor,
} from 'langchain/agents';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { RoutePipelineChain } from '../pipelines/route-pipeline.chain';
import { AlarmPipelineChain } from '../pipelines/alarm-pipeline.chain';
import { CalendarPipelineChain } from '../pipelines/calendar-pipeline.chain';
import { FallbackPipelineChain } from '../pipelines/fallback-pipeline.chain';

@Injectable()
export class AgentService implements OnModuleInit {
  private agent: AgentExecutor;
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly routeChain: RoutePipelineChain,
    private readonly alarmChain: AlarmPipelineChain,
    private readonly calendarChain: CalendarPipelineChain,
    private readonly fallbackChain: FallbackPipelineChain,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initAgent();
  }

  private async initAgent() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const llm = new ChatOpenAI({ openAIApiKey: apiKey, temperature: 0 });

    const tools = [
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
          name: 'route',
          description: '출발지·도착지·날짜·시간으로 경로 조회',
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
          description: '기타 예외적 상황에 대한 대체 처리',
          schema: {
            type: 'object',
            properties: { input: { type: 'string' } },
            required: ['input'],
          },
          returnDirect: true,
        },
      ),
    ];

    this.agent = await initializeAgentExecutorWithOptions(tools, llm, {
      agentType: 'openai-functions',
      maxIterations: 5,
      returnIntermediateSteps: true,
      verbose: true,
      handleParsingErrors: true,
      handleToolRuntimeErrors: (e) => `Tool error: ${e.message}`,
      agentArgs: {
        prefix: `You are a helpful AI assistant. When a user asks for routing, ensure the input includes departure, destination, date (YYYY-MM-DD), and time (HH:MM). If any are missing, ask explicitly in format: '출발지에서 도착지로 YYYY-MM-DD HH:MM 도착 기준으로 알려줘'.`,
      },
    });
    this.logger.log(
      'Agent initialized with tools: ' + tools.map((t) => t.name).join(', '),
    );
  }

  async run(input: string) {
    if (!this.agent) {
      await this.initAgent();
    }
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
    this.logger.log(`Agent output: ${JSON.stringify(result)}`);
    return result;
  }
}
