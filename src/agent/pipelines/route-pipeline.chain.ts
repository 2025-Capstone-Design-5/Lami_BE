import { Injectable } from '@nestjs/common';
import { BaseChain } from 'langchain/chains';
import { RoutesService } from '../../traffic/routes/routes.service';
import { SummaryPipelineChain } from './summary-pipeline.chain';

@Injectable()
export class RoutePipelineChain extends BaseChain {
  constructor(
    private readonly routesService: RoutesService,
    private readonly summaryChain: SummaryPipelineChain,
  ) {
    super({});
  }

  // Define input and output keys for clarity
  get inputKeys(): string[] {
    return ['fromAddress', 'toAddress', 'date', 'time'];
  }

  get outputKeys(): string[] {
    return ['summary'];
  }

  async _call(values: any): Promise<any> {
    const { fromAddress, toAddress, date, time } = values;
    // Fetch raw routes
    const routes = await this.routesService.getAllRoutes(
      fromAddress,
      toAddress,
      { date, time },
    );
    // Generate a summary string
    const summary = await this.summaryChain.call(routes);
    // Return only the summary
    return { summary };
  }

  // Implement abstract chain type identifier
  _chainType(): string {
    return 'RoutePipelineChain';
  }
}
