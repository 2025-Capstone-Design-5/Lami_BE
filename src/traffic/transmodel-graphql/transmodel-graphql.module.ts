import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TransmodelGraphqlController } from './transmodel-graphql.controller';
import { TmapModule } from '../tmap/tmap.module';

@Module({
  imports: [HttpModule, TmapModule],
  controllers: [TransmodelGraphqlController],
})
export class TransmodelGraphqlModule {}
