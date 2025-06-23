import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TmapModule } from '../tmap/tmap.module';
import { GraphqlProxyController } from './graphql.controller';

@Module({
  imports: [HttpModule, TmapModule],
  controllers: [GraphqlProxyController],
})
export class GraphqlProxyModule {}
