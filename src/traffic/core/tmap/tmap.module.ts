import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TmapService } from '@/traffic/core/tmap/tmap.service';
import { TmapController } from '@/traffic/core/tmap/tmap.controller';

@Module({
  imports: [HttpModule],
  controllers: [TmapController],
  providers: [TmapService],
  exports: [TmapService],
})
export class TmapModule {}
