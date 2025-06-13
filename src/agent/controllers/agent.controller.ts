import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  Res,
  Inject,
  BadRequestException,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { LangGraphService } from '../services/lang-graph.service';
import { AgentService } from '../services/agent.service';
import { Response } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);
  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly agentService: AgentService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
  test(): { response: string } {
    return { response: 'pong' };
  }

  @Post('chat/stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Content-Type', 'text/event-stream')
  @Header('Connection', 'keep-alive')
  async chat(
    @Body('input') input: string,
    @Res() res: Response,
  ): Promise<void> {
    // flush headers and send initial ping
    res.flushHeaders();
    res.write(':ping\n\n');
    // SSE: send JSON with embedded type and payload in default message event
    const sendEvent = (type: string, data: any) =>
      res.write(`data: ${JSON.stringify({ type, payload: data })}\n\n`);
    try {
      this.logger.log(`Agent chat stream start for input: ${input}`);
      const result = await this.agentService.runStream(
        input,
        (token) => sendEvent('token', token),
        (error) => sendEvent('error', { message: error.message }),
      );
      sendEvent('final', result);
    } catch (error) {
      sendEvent('error', { message: error.message });
    } finally {
      res.end();
    }
  }

  /**
   * 상세 경로 조회 (캐시된 rawRoutes에서 summaryKey, category, index로 조회)
   */
  @Post('detail')
  async getRouteDetail(
    @Body('summaryKey') summaryKey: string,
    @Body('category') category: string,
    @Body('index') index: number,
  ) {
    this.logger.log(
      `Agent detail request: summaryKey=${summaryKey}, category=${category}, index=${index}`,
    );
    const allRoutes =
      await this.cacheManager.get<Record<string, any[]>>(summaryKey);
    if (!allRoutes) {
      throw new BadRequestException(
        '캐시된 경로 정보가 없습니다. 먼저 경로 요약을 요청하세요.',
      );
    }
    const list = allRoutes[category];
    if (!list) {
      throw new BadRequestException(`Unknown category: ${category}`);
    }
    if (index < 0 || index >= list.length) {
      throw new BadRequestException(
        `Invalid index ${index} for category ${category}`,
      );
    }
    const selected = list[index];
    return {
      status: HttpStatus.OK,
      message: '상세 경로 조회 성공',
      data: selected,
    };
  }

  // TODO: 후속 질문 처리용 엔드포인트 추가
}
