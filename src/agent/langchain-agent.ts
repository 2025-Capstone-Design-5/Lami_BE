import { initChatModel } from 'langchain/chat_models/universal';
import { ZeroShotAgent, AgentExecutor } from 'langchain/agents';
import { StructuredOutputParser } from 'langchain/output_parsers';
// Import CallbackManager from LangChain core callbacks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CallbackManager } = require('@langchain/core/callbacks/manager');
import { TrafficTool } from './tools/traffic.tool';
import { SavedRouteTool } from './tools/saved-route.tool';
import { CalendarTool } from './tools/calendar.tool';
import { AlertsTool } from './tools/alerts.tool';
import { DynamicTool } from 'langchain/tools';

// 새로운 경로 선택 툴: 주어진 routes와 category에서 첫 번째 경로를 선택합니다
export const SelectRouteTool = new DynamicTool({
  name: 'route_selector',
  description:
    '주어진 routes JSON과 category를 입력받아 해당 카테고리의 첫 번째 경로를 선택해 반환합니다. 입력은 JSON 문자열로 routes 데이터와 category 필드를 포함해야 합니다.',
  func: async (input: string) => {
    // JSON 래핑 처리
    let raw = input;
    try {
      const maybe = JSON.parse(input);
      if (maybe && typeof maybe === 'object' && 'input' in maybe) {
        raw = (maybe as any).input;
      }
    } catch {}
    const { routes, category } = JSON.parse(raw) as {
      routes: Record<string, any[]>;
      category: string;
    };
    const selected = routes[category]?.[0];
    return JSON.stringify(selected);
  },
});

// 필요한 설정은 createLangchainAgent 내에서 처리됩니다

/**
 * LLM과 도구를 결합해 에이전트를 생성하는 팩토리 함수
 */
export async function createLangchainAgent(callbackManager?: any) {
  // Initialize LLM based on provider (OpenAI or Llama)
  let llm;
  const provider = process.env.LLM_PROVIDER || 'openai';
  if (provider === 'llama') {
    const llamaUrl = process.env.LLAMA_SERVER_URL;
    const llamaModel = process.env.LLAMA_MODEL;
    if (!llamaUrl || !llamaModel) {
      throw new Error(
        'LLAMA_SERVER_URL and LLAMA_MODEL must be set for llama provider',
      );
    }
    llm = await initChatModel(`ollama:${llamaModel}`, {
      baseUrl: llamaUrl,
      temperature: 0,
    });
  } else {
    llm = await initChatModel(process.env.OPENAI_MODEL || 'gpt-3.5-turbo', {
      temperature: 0,
    });
  }
  const tools = [
    TrafficTool,
    SavedRouteTool,
    CalendarTool,
    AlertsTool,
    SelectRouteTool,
  ];
  let prefix = `당신은 종합 AI 에이전트입니다.

다음 형식을 엄격히 준수하여 응답하세요:
Question: [원본 질문]
Thought: [내부 생각]
Action: [도구 이름]
Action Input: [JSON 입력]
Observation: [도구 실행 결과]
... (필요 시 반복) ...
Thought: I now know the final answer
Final Answer: [최종 답변]

특별 지침:
- 응답은 반드시 Action 호출 구조로 시작해야 하며, freeform 답변은 금지됩니다.
- 요청이 인사말(예: 안녕하세요, 안녕 등)일 경우, 도구 호출 없이 짧게 인사로만 응답하세요.
- 'time'은 출발 시간을 의미합니다.
- 절대로 추가 질문을 하지 마세요.
- 사용자가 '(도보|버스|지하철|자동차) 경로로 갈래'라고 요청하면, route_selector 도구만 호출하고, category 필드에 영어 키 ('walk','bus','subway','car')를 사용하세요.
`;
  // JSON만 출력하도록 강제하는 StructuredOutputParser 설정
  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    walk: '도보 경로 요약 배열',
    bus: '버스 경로 요약 배열',
    car: '자동차 경로 요약 배열',
    bus_subway: '버스+지하철 경로 요약 배열',
    subway: '지하철 경로 요약 배열',
  });
  const formatInstructions = parser.getFormatInstructions();
  prefix += `\n${formatInstructions}`;
  const suffix = `\nQuestion: {input}\n{agent_scratchpad}`;

  // ZeroShotAgent 묶기 및 Executor 생성
  const zeroAgent = ZeroShotAgent.fromLLMAndTools(llm, tools, {
    prefix,
    suffix,
    inputVariables: ['input', 'agent_scratchpad'],
  });

  // Create AgentExecutor with optional callbackManager for streaming
  const executorConfig: any = {
    agent: zeroAgent,
    tools,
    outputParser: parser, // JSON 출력만 허용
    verbose: true,
    maxIterations: 5, // 최대 5회 도구 호출 허용
    returnIntermediateSteps: false,
    earlyStoppingMethod: 'force',
  };
  if (callbackManager) {
    executorConfig.callbackManager = callbackManager;
  }
  const agentExecutor = AgentExecutor.fromAgentAndTools(executorConfig);
  return agentExecutor;
}
