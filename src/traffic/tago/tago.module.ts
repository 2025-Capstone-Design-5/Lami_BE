import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TagoService } from '@/traffic/tago/tago.service';
import { TagoController } from '@/traffic/tago/tago.controller';

@Module({
  imports: [HttpModule],
  providers: [TagoService],
  controllers: [TagoController],
  exports: [TagoService],
})
export class TagoModule {}
