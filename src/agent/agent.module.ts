import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RoutesModule } from '../traffic/routes/routes.module';
import { LangGraphService } from './services/lang-graph.service';
import { AgentController } from './controllers/agent.controller';
import { AlarmModule } from '../alarm/alarm.module';
import { RoutePipelineChain } from './pipelines/route-pipeline.chain';
import { AlarmPipelineChain } from './pipelines/alarm-pipeline.chain';
import { CalendarPipelineChain } from './pipelines/calendar-pipeline.chain';
import { FallbackPipelineChain } from './pipelines/fallback-pipeline.chain';
import { SummaryPipelineChain } from './pipelines/summary-pipeline.chain';
import { RealtimeArrivalPipelineChain } from './pipelines/realtime-arrival-pipeline.chain';
import { RealtimeTrafficPipelineChain } from './pipelines/realtime-traffic-pipeline.chain';
import { AgentService } from './services/agent.service';

@Module({
  imports: [HttpModule, ConfigModule, RoutesModule, AlarmModule],
  controllers: [AgentController],
  providers: [
    LangGraphService,
    RoutePipelineChain,
    AlarmPipelineChain,
    CalendarPipelineChain,
    FallbackPipelineChain,
    RealtimeArrivalPipelineChain,
    RealtimeTrafficPipelineChain,
    SummaryPipelineChain,
    AgentService,
  ],
})
export class AgentModule {}
