import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RoutesModule } from '../traffic/routes/routes.module';
import { LangGraphService } from './services/lang-graph.service';
import { AgentController } from './controllers/agent.controller';
import { AlarmModule } from '../alarm/alarm.module';
import { IntentRouterChain } from './pipelines/intent-router.chain';
import { RoutePipelineChain } from './pipelines/route-pipeline.chain';
import { AlarmPipelineChain } from './pipelines/alarm-pipeline.chain';
import { CalendarPipelineChain } from './pipelines/calendar-pipeline.chain';
import { FallbackPipelineChain } from './pipelines/fallback-pipeline.chain';

@Module({
  imports: [HttpModule, ConfigModule, RoutesModule, AlarmModule],
  controllers: [AgentController],
  providers: [
    LangGraphService,
    IntentRouterChain,
    RoutePipelineChain,
    AlarmPipelineChain,
    CalendarPipelineChain,
    FallbackPipelineChain,
  ],
})
export class AgentModule {}
