import {
  Controller,
  Post,
  Body,
  Get,
  Sse,
  Query,
  MessageEvent,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { LangGraphService } from './lang-graph.service';
import { AgentService } from './agent.service';
import { createLangchainAgent } from './langchain-agent';
// Import CallbackManager from LangChain core callbacks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CallbackManager } = require('@langchain/core/callbacks/manager');
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RouteRequestDto } from '../traffic/routes/dto/route-request.dto';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { RoutesService } from '../traffic/routes/routes.service';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);
  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly agentService: AgentService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly routesService: RoutesService,
  ) {}

  @Post('process')
  async process(
    @Body() body: { userId: string; message: string },
  ): Promise<{ result: any }> {
    const { userId, message } = body;
    // 사용자 메시지를 메모리에 추가
    this.langGraphService.addNode(userId, message);
    // LLM 처리: provider에 따라 HTTP 호출 또는 LangChain 에이전트 실행
    const output = await this.agentService.processMessage(userId, message);
    // 에이전트 응답 저장
    this.langGraphService.addNode(userId, output);
    // JSON 문자열로 반환된 경우 객체로 변환
    let parsed: any;
    try {
      parsed = JSON.parse(output);
    } catch {
      parsed = output;
    }
    // If the agent returned raw route details, proxy to summary endpoint
    if (parsed && typeof parsed === 'object' && parsed.walk && parsed.car) {
      const origin = parsed.walk[0]?.main?.origin;
      const destination = parsed.walk[0]?.main?.destination;
      if (origin && destination) {
        const summaryDto: RouteRequestDto = {
          fromAddress: origin,
          toAddress: destination,
        };
        const baseUrl =
          this.configService.get<string>('SERVER_BASE_URL') ||
          'http://localhost:3000';
        const res = await firstValueFrom(
          this.httpService.post(`${baseUrl}/traffic/routes`, summaryDto),
        );
        // res.data: AllRoutesSummaryResponseDto => { status, message, data }
        return { result: res.data.data };
      }
    }
    // Fallback: return whatever parsed
    return { result: parsed };
  }

  @Get('test')
  async test(): Promise<{ response: string }> {
    const response = await this.agentService.testLLM();
    return { response };
  }

  @Sse('process/stream')
  streamProcess(
    @Query('userId') userId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    // 기록: 사용자 메시지
    this.langGraphService.addNode(userId, message);
    // Define parser to enforce JSON schema for final output
    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      walk: '도보 경로 요약 배열',
      bus: '버스 경로 요약 배열',
      car: '자동차 경로 요약 배열',
      bus_subway: '버스+지하철 경로 요약 배열',
      subway: '지하철 경로 요약 배열',
    });
    const parseFinal = async (text: string) => {
      try {
        const result = await outputParser.parse(text);
        return JSON.stringify(result);
      } catch {
        return text;
      }
    };
    return new Observable<MessageEvent>((observer) => {
      // Helper to send SSE and print via stderr to ensure visibility
      const send = (msg: string) => {
        console.error(`[SSE] ${msg}`);
        observer.next({ data: msg });
      };

      if (
        !CallbackManager ||
        typeof CallbackManager.fromHandlers !== 'function'
      ) {
        this.logger.warn(
          'CallbackManager을 사용할 수 없어 SSE 스트리밍을 지원하지 않습니다.',
        );
        send(
          '현재 스트리밍 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
        );
        observer.complete();
        return;
      }
      const callbackManager = CallbackManager.fromHandlers({
        // traffic_routes 툴이 반환한 요약(summaryData)을 SSE로 전달
        handleToolEnd: async ({ name, output }) => {
          if (name === 'traffic_routes') {
            try {
              // 트래픽 툴에서 반환된 AllRoutesSummaryResponseDto(JSON)
              const resp = JSON.parse(output);
              const data = resp.data;
              // 캐시에 저장 (userId 기반)
              this.agentService.storeLastRoutes(userId, data);
              // 요약 데이터(JSON 구조) 전송
              send(JSON.stringify(data));
            } catch (e) {
              send(JSON.stringify({ error: '요약 파싱 실패' }));
            }
          }
        },
        // 최종 에이전트 응답: StructuredOutputParser로 JSON 검증 후 전송 및 스트림 종료
        handleAgentEnd: async ({ output }) => {
          const parsed = await parseFinal(output);
          send(parsed);
          observer.complete();
        },
        // 에러 시 JSON 형식으로 알림 및 스트림 종료
        handleChainError: async (err) => {
          send(JSON.stringify({ error: err.message ?? String(err) }));
          observer.complete();
        },
      });

      (async () => {
        try {
          // 에이전트 생성 및 호출
          const agent = await createLangchainAgent(callbackManager);
          let agentInput = message.trim();
          const memory = this.langGraphService.toPrompt(userId);
          if (memory.trim()) {
            agentInput = `이전 대화 기록:\n${memory}\n사용자 질문: ${message}`;
          }
          const { output } = await agent.invoke({ input: agentInput });
          // 최종 응답 저장
          this.langGraphService.addNode(userId, output);
        } catch (err) {
          // Log agent error and fallback
          this.logger.error(
            'Error invoking agent',
            err.stack || err.message || err,
          );
          try {
            const fallback = await this.agentService.processMessage(
              userId,
              message,
            );
            send(fallback);
          } catch (fallbackErr) {
            this.logger.error(
              '대체 처리 실패',
              fallbackErr.stack || fallbackErr.message || fallbackErr,
            );
            send(`오류: ${fallbackErr.message ?? fallbackErr}`);
          }
          observer.complete();
        }
      })();
      return () => {};
    });
  }

  @Post('detail')
  async getDetail(
    @Body() body: { userId: string; category: string; index: number },
  ): Promise<any> {
    const { userId, category, index } = body;
    // Retrieve cached raw routes
    const raw = this.agentService.getLastRoutes(userId);
    if (!raw) {
      throw new NotFoundException('저장된 경로 정보가 없습니다.');
    }
    const routes = raw[category];
    if (!Array.isArray(routes)) {
      throw new BadRequestException('유효하지 않은 카테고리입니다.');
    }
    if (index < 0 || index >= routes.length) {
      throw new BadRequestException('유효하지 않은 인덱스입니다.');
    }
    return routes[index];
  }
}
