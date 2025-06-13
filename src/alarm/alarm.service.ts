import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alarm } from './entities/alarm.entity';

@Injectable()
export class AlarmService {
  private readonly logger = new Logger(AlarmService.name);
  constructor(
    @InjectRepository(Alarm)
    private readonly alarmRepo: Repository<Alarm>,
  ) {}

  async registerAlarm(
    userId: string,
    arrivalTimeISO: string,
    preparationTime: number,
  ): Promise<Alarm> {
    // 서버에서 웨이크업 시간 계산
    const arrivalDate = new Date(arrivalTimeISO);
    const wakeUpDate = new Date(
      arrivalDate.getTime() - preparationTime * 60 * 1000,
    );
    this.logger.log(
      `알람 생성: userId=${userId}, wakeUpTime=${wakeUpDate.toISOString()}`,
    );
    const alarm = this.alarmRepo.create({
      userId,
      arrivalTime: arrivalDate,
      preparationTime,
      wakeUpTime: wakeUpDate,
    });
    return this.alarmRepo.save(alarm);
  }

  // Get all alarms for a user
  async getAlarms(userId: string): Promise<Alarm[]> {
    return this.alarmRepo.find({ where: { userId } });
  }

  // Delete an alarm by ID
  async deleteAlarm(id: string): Promise<boolean> {
    const result = await this.alarmRepo.delete(id);
    // DeleteResult.affected can be null, treat null as 0
    return (result.affected ?? 0) > 0;
  }
}
