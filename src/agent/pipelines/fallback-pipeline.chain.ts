import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';
import { ConfigService } from '@nestjs/config';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { OpenAI } from '@langchain/openai';
// TODO: import AgentExecutor or initializeAgentExecutorWithOptions from 'langchain/agents'

@Injectable()
export class FallbackPipelineChain extends BaseChain {
  private chain: LLMChain;
  constructor(private configService: ConfigService) {
    super({});
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const llm = new OpenAI({ openAIApiKey: apiKey });
    const prompt = new PromptTemplate({
      template: `{input}`,
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
