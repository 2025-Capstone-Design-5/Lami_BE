import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TmapModule } from '../tmap/tmap.module';
import { TagoModule } from '../tago/tago.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedRoute } from './entities/saved-route.entity';
import { FavoriteRoute } from './entities/favorite-route.entity';
import { Route } from './entities/route.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { DebugRoutesController } from './routes.debug.controller';
import { FavoriteRoutesController } from './favorite-routes.controller';
import { ItsModule } from '../its/its.module';
import { UsersModule } from '@/users/users.module';
import { AlarmModule } from '@/alarm/alarm.module';

// NODE_ENV에 따라 디버그 컨트롤러 포함 여부 결정
const routeControllers: any[] = [RoutesController];
// if (process.env.NODE_ENV !== 'production') {

// }
routeControllers.push(DebugRoutesController);
routeControllers.push(FavoriteRoutesController);

@Module({
  imports: [
    HttpModule,
    TmapModule,
    TagoModule,
    UsersModule,
    forwardRef(() => ItsModule),
    TypeOrmModule.forFeature([SavedRoute, Route, FavoriteRoute]),
    AlarmModule,
  ],
  controllers: routeControllers,
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
