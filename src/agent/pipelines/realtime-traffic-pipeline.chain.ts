import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';

@Injectable()
export class RealtimeTrafficPipelineChain extends BaseChain {
  get inputKeys(): string[] {
    return ['fromAddress', 'toAddress'];
  }

  get outputKeys(): string[] {
    return ['trafficInfo'];
  }

  _call(): Promise<any> {
    // Placeholder logic: not implemented
    return Promise.reject(
      new Error('RealtimeTrafficPipelineChain._call is not implemented'),
    );
  }

  _chainType(): string {
    return 'RealtimeTrafficPipelineChain';
  }
}
