import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';

@Injectable()
export class RealtimeArrivalPipelineChain extends BaseChain {
  get inputKeys(): string[] {
    return ['fromAddress', 'toAddress'];
  }

  get outputKeys(): string[] {
    return ['arrivalInfo'];
  }

  async _call(values: any): Promise<any> {
    const { fromAddress, toAddress } = values;
    // TODO: Implement real-time arrival info logic, e.g., via a service call
    throw new Error('RealtimeArrivalPipelineChain._call is not implemented');
  }

  _chainType(): string {
    return 'RealtimeArrivalPipelineChain';
  }
}
