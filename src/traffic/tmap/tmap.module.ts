import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TmapService } from './tmap.service';
import { TmapController } from './tmap.controller';

@Module({
  imports: [HttpModule],
  controllers: [TmapController],
  providers: [TmapService],
  exports: [TmapService],
})
export class TmapModule {}
