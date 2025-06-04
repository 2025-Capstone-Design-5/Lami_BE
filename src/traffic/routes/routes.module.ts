import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TmapModule } from '../tmap/tmap.module';
import { TagoModule } from '../tago/tago.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedRoute } from './entities/saved-route.entity';
import { Route } from './entities/route.entity';
import { RouteRealtimeParam } from './entities/route-realtime-param.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { DebugRoutesController } from './routes.debug.controller';
import { ItsModule } from '../its/its.module';

// NODE_ENV에 따라 디버그 컨트롤러 포함 여부 결정
const routeControllers: any[] = [RoutesController];
// if (process.env.NODE_ENV !== 'production') {

// }
routeControllers.push(DebugRoutesController);

@Module({
  imports: [
    HttpModule,
    TmapModule,
    TagoModule,
    forwardRef(() => ItsModule),
    TypeOrmModule.forFeature([SavedRoute, Route, RouteRealtimeParam]),
  ],
  controllers: routeControllers,
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
