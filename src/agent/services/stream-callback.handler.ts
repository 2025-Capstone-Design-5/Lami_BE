import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export class StreamCallback extends BaseCallbackHandler {
  name = 'StreamCallback';
  constructor(private readonly sendEvent: (type: string, data: any) => void) {
    super();
  }

  async handleAgentAction(
    action: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    this.sendEvent('action', action);
  }

  async handleAgentEnd(
    output: any,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    this.sendEvent('observation', output);
  }
}
