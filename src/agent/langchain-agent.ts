import { initChatModel } from 'langchain/chat_models/universal';
import { ZeroShotAgent, AgentExecutor } from 'langchain/agents';
import { TrafficTool } from './tools/traffic.tool';
import { SavedRouteTool } from './tools/saved-route.tool';
import { CalendarTool } from './tools/calendar.tool';
import { AlertsTool } from './tools/alerts.tool';

// 필요한 설정은 createLangchainAgent 내에서 처리됩니다

/**
 * LLM과 도구를 결합해 에이전트를 생성하는 팩토리 함수
 */
export async function createLangchainAgent() {
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
  const tools = [TrafficTool, SavedRouteTool, CalendarTool, AlertsTool];
  const prefix = `당신은 종합 AI 에이전트입니다.
tools:
- traffic_routes: 교통 경로를 조회합니다. 입력은 fromAddress, toAddress, date, time 프로퍼티를 가진 JSON 문자열입니다.
- saved_route_info: 저장된 경로 ID로 실시간 상세 정보를 조회합니다. 입력은 routeId 프로퍼티를 가진 JSON 문자열입니다.
- calendar_events: 사용자의 캘린더 이벤트를 조회합니다. 입력은 userId 프로퍼티를 가진 JSON 문자열입니다.
- alerts: 사용자의 알림을 조회합니다. 입력은 userId 프로퍼티를 가진 JSON 문자열입니다.

instructions:
1) 요청이 인사말(예: 안녕하세요, 안녕 등)일 경우, 도구 호출 없이 인사로만 응답하세요.
2) 그 외 모든 요청에 대해 반드시 적절한 도구를 호출하세요.
3) 'time'은 출발 시간을 의미합니다. '도착 기준' 요청도 출발 시간 기준으로 처리하세요.
4) 절대로 추가 질문을 하지 마세요. 불명확해도 가정하여 계속 진행하세요.
5) 아래 형식을 엄격히 준수하세요:
   Question: [원본 질문]
   Thought: [내부 생각]
   Action: [도구 이름]
   Action Input: [JSON 입력]
   Observation: [도구 실행 결과]
   ... (필요 시 반복) ...
   Thought: I now know the final answer
   Final Answer: [최종 답변]
`;
  const suffix = `\nQuestion: {input}\n{agent_scratchpad}`;
  // ZeroShotAgent 묶기 및 Executor 생성
  const zeroAgent = ZeroShotAgent.fromLLMAndTools(llm, tools, {
    prefix,
    suffix,
    inputVariables: ['input', 'agent_scratchpad'],
  });
  const agent = AgentExecutor.fromAgentAndTools({
    agent: zeroAgent,
    tools,
    verbose: true,
    maxIterations: 5, // 최대 5회 도구 호출 허용
    returnIntermediateSteps: false,
    earlyStoppingMethod: 'force',
  });
  return agent;
}
