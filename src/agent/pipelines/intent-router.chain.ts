import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { OpenAI } from '@langchain/openai';

@Injectable()
export class IntentRouterChain {
  private readonly logger = new Logger(IntentRouterChain.name);
  private vectorStore?: MemoryVectorStore;
  private readonly exampleQueries = [
    '서울역에서 강남역으로 2025-06-10 08:00 경로 조회',
    '오전 7시에 알람 설정',
    '내 일정 캘린더에 등록해줘',
  ];
  private readonly exampleLabels = ['route', 'alarm', 'calendar'];

  constructor(private configService: ConfigService) {}

  async routeIntent(input: string): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.logger.log(`API key ${apiKey ? 'present' : 'missing'}`);
    if (!this.vectorStore) {
      const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });
      const metadatas = this.exampleLabels.map((label) => ({ label }));
      this.vectorStore = await MemoryVectorStore.fromTexts(
        this.exampleQueries,
        metadatas,
        embeddings,
      );
    }
    // similarity with score for hybrid fallback
    const resultsWithScore = await this.vectorStore.similaritySearchWithScore(
      input,
      1,
    );
    const [doc, score] = resultsWithScore[0];
    const threshold = 0.88;
    this.logger.log(
      `Input: "${input}" → similarity=${score} (threshold=${threshold})`,
    );
    // if similarity at or below threshold, fallback to LLM classification
    if (score <= threshold) {
      this.logger.log(`Low similarity (${score}), using LLM fallback`);
      // include fallback as a valid category
      const labels = [...this.exampleLabels, 'fallback'];
      const prompt = new PromptTemplate({
        template: `사용자 입력을 다음 중 하나로 분류하세요: ${labels.join(', ')}\n입력: {input}`,
        inputVariables: ['input'],
      });
      const chain = new LLMChain({
        llm: new OpenAI({ openAIApiKey: apiKey, temperature: 0 }),
        prompt,
      });
      const rawLabel = await chain.run({ input });
      this.logger.log(`LLM raw fallback label: "${rawLabel}"`);
      const label = rawLabel.trim().toLowerCase();
      // ensure it's one of the allowed labels
      if (!labels.includes(label)) {
        this.logger.warn(
          `LLM label "${label}" not in allowed labels, defaulting to fallback`,
        );
        return 'fallback';
      }
      return label;
    }
    return (doc.metadata as { label: string }).label || 'fallback';
  }
}
