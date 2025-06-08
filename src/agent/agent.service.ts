import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { RoutesService } from '../traffic/routes/routes.service';
import { LangGraphService } from './lang-graph.service';
import OpenAI from 'openai';
import { firstValueFrom } from 'rxjs';
import { createLangchainAgent } from './langchain-agent';

@Injectable()
export class AgentService {
  // user별 마지막 조회된 경로 저장
  private lastRoutes = new Map<string, any>();
  private openai: OpenAI;
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly routesService: RoutesService,
    private readonly langGraphService: LangGraphService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * LLM 연결 테스트를 위한 메서드
   */
  async testLLM(): Promise<string> {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'openai');
    const testPrompt =
      'LLM 연결 테스트: 이 메시지가 정상적으로 출력되면 성공입니다.';
    let result: string;
    if (provider === 'llama') {
      const llamaUrl = this.configService.get<string>('LLAMA_SERVER_URL');
      const model = this.configService.get<string>('LLAMA_MODEL');
      if (!model) {
        this.logger.error('LLAMA_MODEL 환경 변수가 설정되지 않았습니다.');
        throw new Error('LLAMA_MODEL 환경 변수가 필요합니다.');
      }
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${llamaUrl}/api/generate`, {
            model,
            prompt: testPrompt,
            max_tokens: 32,
          }),
        );
        result =
          response.data.choices?.[0]?.text?.trim() ??
          JSON.stringify(response.data);
      } catch (err: any) {
        this.logger.error('LLama 테스트 요청 실패', err.message);
        result = `LLama 테스트 실패: ${err.message}`;
      }
    } else {
      try {
        const chatRes = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'LLM 연결 테스트' },
            { role: 'user', content: testPrompt },
          ],
          max_tokens: 32,
        });
        const content = chatRes.choices?.[0]?.message?.content;
        result = content ? content.trim() : '응답 없음';
      } catch (err: any) {
        this.logger.error('OpenAI 테스트 요청 실패', err.message);
        result = `OpenAI 테스트 실패: ${err.message}`;
      }
    }
    return result;
  }

  async processMessage(userId: string, message: string): Promise<string> {
    // 로그: processMessage 호출
    this.logger.log(`processMessage called with message: ${message}`);
    // Summary memory: if too many nodes, summarize and reset memory
    const summaryThreshold = 10;
    const nodes = this.langGraphService.getNodes(userId);
    if (nodes.length > summaryThreshold) {
      this.logger.log('메모리 노드 수 초과, 요약 작업 수행');
      const history = nodes.map((n) => n.content).join('\n');
      const summaryPrompt = `다음 대화 내용을 간단히 요약해 주세요:\n${history}`;
      let summary = '';
      const provider = this.configService.get<string>('LLM_PROVIDER', 'openai');
      if (provider === 'llama') {
        const llamaUrl = this.configService.get<string>('LLAMA_SERVER_URL');
        const model = this.configService.get<string>('LLAMA_MODEL');
        try {
          const response = await firstValueFrom(
            this.httpService.post(`${llamaUrl}/api/generate`, {
              model,
              prompt: summaryPrompt,
              max_tokens: 150,
            }),
          );
          summary = response.data.choices?.[0]?.text?.trim() ?? '';
        } catch (err: any) {
          this.logger.error('Llama 요약 실패', err.message);
        }
      } else {
        try {
          const res = await this.openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: '대화 요약기' },
              { role: 'user', content: summaryPrompt },
            ] as any,
            max_tokens: 150,
          });
          summary = res.choices?.[0]?.message?.content?.trim() ?? '';
        } catch (err: any) {
          this.logger.error('OpenAI 요약 실패', err.message);
        }
      }
      if (summary) {
        this.langGraphService.clearMemory(userId);
        this.langGraphService.addNode(userId, `요약: ${summary}`);
      }
    }
    // 1) 단순 인사 메시지 처리
    const greetingRegex = /^(안녕하세요|안녕|hi|hello)/i;
    if (greetingRegex.test(message.trim())) {
      return '안녕하세요! 저는 교통 경로 조회 서비스입니다. 출발지, 도착지, 날짜, 시간을 알려주시면 최적의 경로를 안내해드려요.';
    }
    // 3) 교통 경로 단순 질의 매칭: "<from>에서 <to>로 ... YYYY-MM-DD HH:mm"
    const routeRegex =
      /(.+)에서\s*(.+)로.*?(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/.exec(message);
    if (routeRegex) {
      this.logger.log('Route regex matched, calling routesService directly');
      const fromAddress = routeRegex[1].trim();
      const toAddress = routeRegex[2].trim();
      const date = routeRegex[3];
      const time = routeRegex[4];
      try {
        const rawRoutes = await this.routesService.getAllRoutes(
          fromAddress,
          toAddress,
          { date, time },
        );
        // 마지막 경로 결과 저장
        this.lastRoutes.set(userId, rawRoutes);
        return JSON.stringify(rawRoutes);
      } catch (err: any) {
        this.logger.error('직접 경로 조회 실패', err.message);
        // 계속하여 에이전트 시도
      }
    }
    // 4) LangChain 에이전트 처리 (Fallback 포함)
    this.logger.log('Invoking LangChain agent');
    try {
      // 대화 메모리(이전 메시지 및 응답)를 가져와 입력에 포함
      const memory = this.langGraphService.toPrompt(userId);
      const agentInput = memory
        ? `이전 대화 기록:\n${memory}\n사용자 질문: ${message}`
        : message;
      const agent = await createLangchainAgent();
      const { output } = await agent.invoke({ input: agentInput });
      return output;
    } catch (err: any) {
      this.logger.error('Error invoking LangChain agent', err.message);
      this.logger.error(
        '에이전트 실행 중 오류 발생, fallback 처리',
        err.message,
      );
      // fallback: 간단히 사용자 메시지 반환
      return `요청을 처리하는 중 오류가 발생했습니다: ${err.message}`;
    }
  }

  /**
   * Annotate given routes by asking user to select one to save
   */
  async annotateRoutes(routes: any): Promise<string> {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'openai');
    const prompt = `다음 경로 옵션이 있습니다. 이 중 하나를 선택하여 저장해 달라고 사용자에게 요청해주세요:\n${JSON.stringify(routes, null, 2)}`;
    // Llama(Ollama) provider: call HTTP /api/generate
    if (provider === 'llama') {
      const llamaUrl = this.configService.get<string>('LLAMA_SERVER_URL');
      const model = this.configService.get<string>('LLAMA_MODEL');
      if (!llamaUrl || !model) {
        this.logger.error(
          'LLAMA_SERVER_URL 및 LLAMA_MODEL 환경 변수가 필요합니다.',
        );
        throw new Error('LLAMA 설정이 올바르지 않습니다.');
      }
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${llamaUrl}/api/generate`, {
            model,
            prompt,
            max_tokens: 150,
          }),
        );
        return response.data.choices?.[0]?.text?.trim() ?? '';
      } catch (err: any) {
        this.logger.error('LLama 주석 생성 실패', err.message);
        return '';
      }
    }
    // OpenAI provider
    try {
      const messages = [
        {
          role: 'system',
          content:
            '당신은 친절한 안내 역할을 합니다. 사용자가 경로를 선택할 수 있도록 도와주세요.',
        },
        { role: 'user', content: prompt },
      ];
      const chatRes = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages as any,
        max_tokens: 150,
      });
      const comment = chatRes.choices?.[0]?.message?.content;
      return comment ? comment.trim() : '';
    } catch (err: any) {
      this.logger.error('주석 생성 중 오류 발생', err.message);
      return '';
    }
  }
}
