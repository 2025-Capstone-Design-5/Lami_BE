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

  _call(): Promise<any> {
    // Placeholder logic: not implemented
    return Promise.reject(
      new Error('RealtimeArrivalPipelineChain._call is not implemented'),
    );
  }

  _chainType(): string {
    return 'RealtimeArrivalPipelineChain';
  }
}
