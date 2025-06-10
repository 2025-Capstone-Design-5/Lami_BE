import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';
// TODO: import AgentExecutor or initializeAgentExecutorWithOptions from 'langchain/agents'

@Injectable()
export class FallbackPipelineChain extends BaseChain {
  constructor() {
    super({});
  }

  get inputKeys(): string[] {
    return ['input'];
  }

  get outputKeys(): string[] {
    return ['output'];
  }

  async _call(values: any): Promise<any> {
    const { input } = values;
    // TODO: implement using AgentExecutor.fromAgentAndTools
    throw new Error('FallbackPipelineChain._call not implemented');
  }

  _chainType(): string {
    return 'FallbackPipelineChain';
  }
}
