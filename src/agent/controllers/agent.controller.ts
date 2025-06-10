import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { LangGraphService } from '../services/lang-graph.service';
import { IntentRouterChain } from '../pipelines/intent-router.chain';
import { RoutePipelineChain } from '../pipelines/route-pipeline.chain';
import { AlarmPipelineChain } from '../pipelines/alarm-pipeline.chain';
import { CalendarPipelineChain } from '../pipelines/calendar-pipeline.chain';
import { FallbackPipelineChain } from '../pipelines/fallback-pipeline.chain';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);
  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly intentRouter: IntentRouterChain,
    private readonly routeChain: RoutePipelineChain,
    private readonly alarmChain: AlarmPipelineChain,
    private readonly calendarChain: CalendarPipelineChain,
    private readonly fallbackChain: FallbackPipelineChain,
  ) {}

  @Post('process')
  async process(
    @Body() body: { userId: string; message: string },
  ): Promise<{ result: any }> {
    const { userId, message } = body;
    // 1) 메모리 업데이트
    this.langGraphService.addNode(userId, message);
    // 2) 의도 분류 (Embedding-based intent classification)
    // 분류: 'route', 'alarm', 'calendar', 'fallback'
    const intent = await this.intentRouter.routeIntent(message);
    let result: any;
    if (intent === 'route') {
      // Route flow
      const routeRegex =
        /(.+)에서\s*(.+)로.*?(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/.exec(message);
      const fromAddress = routeRegex ? routeRegex[1].trim() : '';
      const toAddress = routeRegex ? routeRegex[2].trim() : '';
      const date = routeRegex ? routeRegex[3] : '';
      const time = routeRegex ? routeRegex[4] : '';
      const out = await this.routeChain._call({
        fromAddress,
        toAddress,
        date,
        time,
      });
      result = out.routes;
    } else if (intent === 'alarm') {
      // Alarm flow
      const alarmMatch = /(.+)\s+(\d{1,2}:\d{2})/.exec(message);
      const msg = message.replace(alarmMatch?.[0] ?? '', '').trim();
      const alarmTime = alarmMatch ? alarmMatch[0] : '';
      const out = await this.alarmChain._call({
        time: alarmTime,
        message: msg,
      });
      result = out.confirmation;
    } else if (intent === 'calendar') {
      // Calendar flow
      const calMatch = /(.+)\s+(\d{4}-\d{2}-\d{2})/.exec(message);
      const eventDetails = message.replace(calMatch?.[0] ?? '', '').trim();
      const date = calMatch ? calMatch[2] : '';
      const out = await this.calendarChain._call({ date, eventDetails });
      result = out.confirmation;
    } else {
      // Fallback flow
      const out = await this.fallbackChain._call({ input: message });
      result = out.output;
    }
    // 3) 메모리 저장 및 응답
    this.langGraphService.addNode(
      userId,
      typeof result === 'string' ? result : JSON.stringify(result),
    );
    return { result };
  }

  @Get('test')
  async test(): Promise<{ response: string }> {
    return { response: 'pong' };
  }

  // TODO: 후속 질문 처리용 엔드포인트 추가
}
