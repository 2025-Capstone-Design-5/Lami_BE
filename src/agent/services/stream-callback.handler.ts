import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export class StreamCallback extends BaseCallbackHandler {
  name = 'StreamCallback';
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
    // tool.name may be undefined, default to toString
    const toolName = (tool?.name ?? '').toString();
    this.sendEvent('tool_call', { tool: toolName, toolInput: input });
  }

  async handleAgentAction(
    action: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    // Emit a concise tool call event with name, input, and log reason
    const { tool, toolInput, log } = action;
    this.sendEvent('tool_call', { tool, toolInput, reason: log });
  }

  async handleAgentEnd(
    output: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    this.sendEvent('observation', output);
  }
}
