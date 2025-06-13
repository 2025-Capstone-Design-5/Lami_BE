import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseIdEntity } from './base-id.entity';

export abstract class BaseTimestampEntity extends BaseIdEntity {
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
