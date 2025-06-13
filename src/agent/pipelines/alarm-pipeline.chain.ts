import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';

@Injectable()
export class AlarmPipelineChain extends BaseChain {
  constructor() {
    super({});
  }

  get inputKeys(): string[] {
    return ['time', 'message'];
  }

  get outputKeys(): string[] {
    return ['confirmation'];
  }

  _call(values: any): Promise<any> {
    const { time, message } = values;
    const confirmation = `알람이 ${time}에 '${message}' 메시지로 설정되었습니다.`;
    return Promise.resolve({ confirmation });
  }

  _chainType(): string {
    return 'AlarmPipelineChain';
  }
}
