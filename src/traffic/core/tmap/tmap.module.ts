import { Module } from '@nestjs/common';
import { TmapService } from '@/traffic/core/tmap/tmap.service';

@Module({
  providers: [TmapService],
  exports: [TmapService],
})
export class TmapModule {}
