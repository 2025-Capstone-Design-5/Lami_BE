import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RoutesModule } from '../traffic/routes/routes.module';
import { AgentService } from './agent.service';
import { LangGraphService } from './lang-graph.service';
import { AgentController } from './agent.controller';

@Module({
  imports: [HttpModule, ConfigModule, RoutesModule],
  controllers: [AgentController],
  providers: [AgentService, LangGraphService],
})
export class AgentModule {}
