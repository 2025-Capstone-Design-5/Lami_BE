import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmController } from './alarm.controller';
import { AlarmService } from './alarm.service';
import { Alarm } from './entities/alarm.entity';
import { SavedRoute } from '../traffic/routes/entities/saved-route.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Alarm, SavedRoute]), UsersModule],
  controllers: [AlarmController],
  providers: [AlarmService],
  exports: [AlarmService], // 다른 모듈에서 사용 가능하게 함
})
export class AlarmModule {}
