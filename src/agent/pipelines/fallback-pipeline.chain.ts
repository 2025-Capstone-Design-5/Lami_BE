import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';
import { ConfigService } from '@nestjs/config';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
// TODO: import AgentExecutor or initializeAgentExecutorWithOptions from 'langchain/agents'

@Injectable()
export class FallbackPipelineChain extends BaseChain {
  private chain: LLMChain;
  constructor(private configService: ConfigService) {
    super({});
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const fallbackModel =
      this.configService.get<string>('OPENAI_FALLBACK_MODEL') ||
      'gpt-3.5-turbo';
    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: fallbackModel,
      maxTokens: 256,
      temperature: 0.3,
    });
    const prompt = new PromptTemplate({
      template: `당신은 Lami AI 비서입니다.
1) 사용자가 인삿말을 입력하면 친절히 인사로 응답하세요.
2) 사용자가 '너는 어떤 기능이니' 같은 질문으로 기능을 묻는다면, Lami의 서비스(경로 조회, 알람 설정, 일정 관리 등)를 설명하세요.
3) 사용자가 경로 조회를 요청하지만 출발지, 도착지, 날짜, 시간 정보가 누락된 경우에는 아래 예시처럼 입력 형식을 안내하세요:
   예시: '서울역에서 강남역까지 가는 경로를 알려줘, 2025-06-15, 14:30'
4) 위 상황 외에는 입력된 내용에 대해 적절히 답변하세요.

{input}`,
      inputVariables: ['input'],
    });
    this.chain = new LLMChain({ llm, prompt });
  }

  get inputKeys(): string[] {
    return ['input'];
  }

  get outputKeys(): string[] {
    return ['output'];
  }

  async _call(values: any): Promise<any> {
    const { input } = values;
    // Use LLMChain to generate a fallback response
    const response = await this.chain.run({ input });
    return { output: response };
  }

  _chainType(): string {
    return 'FallbackPipelineChain';
  }
}
