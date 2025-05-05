import { Test, TestingModule } from '@nestjs/testing';
import { TrafficController } from './traffic.controller';

describe('TrafficController', () => {
  let controller: TrafficController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrafficController],
    }).compile();

    controller = module.get<TrafficController>(TrafficController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
