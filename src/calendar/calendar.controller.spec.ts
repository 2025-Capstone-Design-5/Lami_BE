import { Test, TestingModule } from '@nestjs/testing';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service'; // 서비스 import

describe('CalendarController', () => {
  let controller: CalendarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
