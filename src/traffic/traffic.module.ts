import { Module } from '@nestjs/common';
import { TrafficController } from './traffic.controller';
import { TrafficService } from './traffic.service';
import { RoutesModule } from './routes/routes.module';
import { TmapModule } from './tmap/tmap.module';
import { TagoModule } from './tago/tago.module';
import { ItsModule } from './its/its.module';

@Module({
  imports: [RoutesModule, TmapModule, TagoModule, ItsModule],
  controllers: [TrafficController],
  providers: [TrafficService],
})
export class TrafficModule {}
