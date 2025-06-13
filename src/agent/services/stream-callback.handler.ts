import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export class StreamCallback extends BaseCallbackHandler {
  name = 'StreamCallback';
  // buffer to accumulate LLM tokens as reasoning chain
  private reasoningBuffer = '';
  // map runId to toolName for cases where tags are missing
  private toolNameMap: Record<string, string> = {};
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
    this.sendEvent('token', token);
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
    // store mapping for later use in handleToolEnd/error
    this.toolNameMap[runId] = toolName;
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
    // status already emitted in handleAgentAction; skipping here
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
    this.sendEvent('action_start', { tool, toolInput, reason });
    // Explicit status event for known tools
    let statusMessage = '';
    switch (tool) {
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
        statusMessage = '';
    }
    if (statusMessage) {
      this.sendEvent('status', statusMessage);
    }
  }

  async handleAgentEnd(
    output: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    // No-op: suppress raw agent observation events
    // The final event will be sent by runStream
  }

  // Emit event when a tool/function finishes execution
  async handleToolEnd(
    output: any,
    runId: string,
    parentRunId?: string,
    tags?: string[],
  ): Promise<void> {
    // derive toolName from tags or fallback to stored mapping
    const toolName =
      Array.isArray(tags) && tags.length > 0
        ? tags[0]
        : (this.toolNameMap[runId] ?? 'unknown');
    // If output is a string, try to parse it as JSON
    let result = output;
    if (typeof output === 'string') {
      try {
        result = JSON.parse(output);
      } catch (e) {
        // If parsing fails, use the original string
        result = output;
      }
    }
    // Only send action_result for non-final events
    if (toolName !== 'final') {
      this.sendEvent('action_result', { tool: toolName, result });
    }
    // clean up mapping
    delete this.toolNameMap[runId];
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
    // derive toolName from tags or fallback to stored mapping
    const toolName =
      Array.isArray(tags) && tags.length > 0
        ? tags[0]
        : (this.toolNameMap[runId] ?? 'unknown');
    this.sendEvent('error', {
      type: 'tool_error',
      tool: toolName,
      message: err.message,
    });
    // clean up mapping
    delete this.toolNameMap[runId];
  }
}
