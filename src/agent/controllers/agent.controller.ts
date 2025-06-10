import { Controller, Post, Body, Get, Logger, Sse, Res } from '@nestjs/common';
import { LangGraphService } from '../services/lang-graph.service';
import { AgentService } from '../services/agent.service';
import { Response } from 'express';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);
  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly agentService: AgentService,
  ) {}

  @Post('process')
  async process(
    @Body() body: { userId: string; message: string },
  ): Promise<{ result: any }> {
    const { userId, message } = body;
    // 1) 메모리 업데이트
    this.langGraphService.addNode(userId, message);
    // 2) ReAct AgentExecutor 호출
    const result = await this.agentService.run(message);
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

  @Post('chat')
  @Sse('stream')
  async chat(
    @Body('input') input: string,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    const sendEvent = (type: string, data: any) =>
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const result = await this.agentService.runStream(input, sendEvent);
      sendEvent('final', result);
    } catch (error) {
      sendEvent('error', { message: error.message });
    } finally {
      res.end();
    }
  }

  // TODO: 후속 질문 처리용 엔드포인트 추가
}
