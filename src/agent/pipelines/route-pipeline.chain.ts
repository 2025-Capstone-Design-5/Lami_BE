import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';
import { RoutesService } from '../../traffic/routes/routes.service';

@Injectable()
export class RoutePipelineChain extends BaseChain {
  constructor(private readonly routesService: RoutesService) {
    super({});
  }

  // Define input and output keys for clarity
  get inputKeys(): string[] {
    return ['fromAddress', 'toAddress', 'date', 'time'];
  }

  get outputKeys(): string[] {
    return ['routes'];
  }

  async _call(values: any): Promise<any> {
    const { fromAddress, toAddress, date, time } = values;
    const routes = await this.routesService.getAllRoutes(
      fromAddress,
      toAddress,
      { date, time },
    );
    // Return the raw routes (summary handled by client or downstream chain)
    return { routes };
  }

  // Implement abstract chain type identifier
  _chainType(): string {
    return 'RoutePipelineChain';
  }
}
