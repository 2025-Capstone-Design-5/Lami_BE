import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class SummaryPipelineChain {
  private summaryChain: LLMChain;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const llm = new ChatOpenAI({ openAIApiKey: apiKey, temperature: 0 });
    const template = `아래 JSON 응답을 각 구간 '출발→도착(분)'로 요약하세요:\n{route_data}`;
    const prompt = PromptTemplate.fromTemplate(template);
    this.summaryChain = new LLMChain({ llm, prompt });
  }

  async call(routeData: any): Promise<string> {
    const dataStr =
      typeof routeData === 'string' ? routeData : JSON.stringify(routeData);
    return this.summaryChain.predict({ route_data: dataStr });
  }
}
