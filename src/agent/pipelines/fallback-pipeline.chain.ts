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
      template: `당신은 Lami AI 비서입니다. 사용자가 인삿말(안녕, 안녕하세요 등)을 입력하면 친절하게 인사로 응답하세요. 사용자가 '너는 어떤 기능이니' 등 당신의 기능을 물을 때는 Lami가 제공하는 서비스 기능(경로 조회, 알람 설정, 일정 관리 등)을 설명하세요. 그 외의 예외적 상황에서는 입력된 내용에 대해 적절히 답변하세요.\n\n{input}`,
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
