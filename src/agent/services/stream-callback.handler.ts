import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export class StreamCallback extends BaseCallbackHandler {
  name = 'StreamCallback';
  // buffer to accumulate LLM tokens as reasoning chain
  private reasoningBuffer = '';
  constructor(private readonly sendEvent: (type: string, data: any) => void) {
    super();
  }

  // Stream LLM tokens as they arrive
  async handleLLMNewToken(
    token: string,
    idx: any,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    fields?: any,
  ): Promise<void> {
    // accumulate tokens for reasoning
    this.reasoningBuffer += token;
    this.sendEvent('message', token);
  }

  // Emit event when a tool/function is invoked
  async handleToolStart(
    tool: any,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runName?: string,
  ): Promise<void> {
    // derive toolName from tags (first), else fallback to string or tool.name
    const toolName =
      Array.isArray(tags) && tags.length > 0
        ? tags[0]
        : typeof tool === 'string'
          ? tool
          : (tool?.name ?? '').toString();
    // send friendly status message for tool invocation
    let statusMessage = '';
    switch (toolName) {
      case 'route-summary':
        statusMessage = '🗺️ 경로 탐색 중입니다...';
        break;
      case 'route-realtimeArrivalInfo':
        statusMessage = '🕒 실시간 도착 정보 조회 중입니다...';
        break;
      case 'route-realtime-traffic':
        statusMessage = '🚦 실시간 교통 상황 조회 중입니다...';
        break;
      default:
        statusMessage = `🔧 ${toolName} 호출 중입니다...`;
    }
    this.sendEvent('status', statusMessage);
  }

  async handleAgentAction(
    action: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    const { tool, toolInput, log } = action;
    // Use the model's own log (chain-of-thought) as reason
    const reason = (typeof log === 'string' ? log : '').trim();
    // Clear any buffered tokens
    this.reasoningBuffer = '';
    this.sendEvent('tool_call', { tool, toolInput, reason });
  }

  async handleAgentEnd(
    output: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    // No-op: suppress raw agent observation events
  }

  // Emit event when a tool/function finishes execution
  async handleToolEnd(
    output: any,
    runId: string,
    parentRunId?: string,
    tags?: string[],
  ): Promise<void> {
    const toolName =
      Array.isArray(tags) && tags.length > 0 ? tags[0] : 'unknown';
    this.sendEvent('tool_result', { tool: toolName, result: output });
  }

  // Emit errors from the LLM/chat model
  async handleLLMError(
    err: Error,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    this.sendEvent('error', { type: 'llm_error', message: err.message });
  }

  // Emit errors from tools/functions
  async handleToolError(
    err: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[],
  ): Promise<void> {
    const toolName =
      Array.isArray(tags) && tags.length > 0 ? tags[0] : 'unknown';
    this.sendEvent('error', {
      type: 'tool_error',
      tool: toolName,
      message: err.message,
    });
  }
}
