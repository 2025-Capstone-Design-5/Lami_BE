import { Injectable } from '@nestjs/common';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class IntentRouterChain {
  private vectorStore?: MemoryVectorStore;
  private readonly embeddings = new OpenAIEmbeddings();
  private readonly exampleQueries = [
    '서울역에서 강남역으로 2025-06-10 08:00 경로 조회',
    '오전 7시에 알람 설정',
    '내 일정 캘린더에 등록해줘',
  ];
  private readonly exampleLabels = ['route', 'alarm', 'calendar'];

  async routeIntent(input: string): Promise<string> {
    if (!this.vectorStore) {
      // Initialize vector store with example queries and labels
      const metadatas = this.exampleLabels.map((label) => ({ label }));
      this.vectorStore = await MemoryVectorStore.fromTexts(
        this.exampleQueries,
        metadatas,
        this.embeddings,
      );
    }
    // Perform similarity search
    const results = await this.vectorStore.similaritySearch(input, 1);
    const match = results[0];
    return (match.metadata as any).label || 'fallback';
  }
}
