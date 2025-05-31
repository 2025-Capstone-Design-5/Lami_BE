import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TmapModule } from '../tmap/tmap.module';
import { RoutesModule } from '../routes/routes.module';
import { ItsService } from './its.service';
import { ItsController } from './its.controller';
import { LinkMappingService } from './link-mapping.service';

@Module({
  imports: [HttpModule, TmapModule, forwardRef(() => RoutesModule)],
  providers: [ItsService, LinkMappingService],
  controllers: [ItsController],
  exports: [ItsService, LinkMappingService],
})
export class ItsModule {} 