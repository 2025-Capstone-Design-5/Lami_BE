import { CreateDateColumn } from 'typeorm';
import { BaseIdEntity } from './base-id.entity';

export abstract class BaseCreateEntity extends BaseIdEntity {
  @CreateDateColumn()
  createdAt: Date;
}
