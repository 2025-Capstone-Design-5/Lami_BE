import { Controller, Post, Body, Get } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly langGraphService: LangGraphService,
    private readonly agentService: AgentService,
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
    return { result: parsed };
  }

  @Get('test')
  async test(): Promise<{ response: string }> {
    const response = await this.agentService.testLLM();
    return { response };
  }
}
