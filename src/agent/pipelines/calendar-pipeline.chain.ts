import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';

@Injectable()
export class CalendarPipelineChain extends BaseChain {
  constructor() {
    super({});
  }

  get inputKeys(): string[] {
    return ['date', 'eventDetails'];
  }

  get outputKeys(): string[] {
    return ['confirmation'];
  }

  async _call(values: any): Promise<any> {
    const { date, eventDetails } = values;
    // TODO: call NestJS CalendarService API via HTTP or injected service
    // Example placeholder logic
    const confirmation = `일정이 ${date}에 '${eventDetails}'로 등록되었습니다.`;
    return { confirmation };
  }

  _chainType(): string {
    return 'CalendarPipelineChain';
  }
}
