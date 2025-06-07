import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrafficModule } from './traffic/traffic.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AlertsModule } from './alerts/alerts.module';
import { AgentModule } from './agent/agent.module';
import { CalendarModule } from './calendar/calendar.module';
import { LlmModule } from './llm/llm.module';
import { VoiceModule } from './voice/voice.module';
import { AlarmModule } from './alarm/alarm.module';
import { ChatModule } from './chat/chat.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CategoriesModule } from './favorites/categories.module';
@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 500,
      max: 100,
    }),
    // 환경변수 설정
    ConfigModule.forRoot({ isGlobal: true }),
    // TypeORM 설정 (PostgreSQL)
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_DATABASE!,
      autoLoadEntities: true,
      synchronize: true, // 개발 환경에서만 true로 설정
      dropSchema: true, // 개발 시 변경마다 스키마 초기화
    }),
    // Application Modules
    ChatModule,
    FavoritesModule,
    CategoriesModule,
    AlarmModule,
    VoiceModule,
    LlmModule,
    TrafficModule,
    CalendarModule,
    AgentModule,
    AlertsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
