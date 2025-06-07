import { PrimaryGeneratedColumn } from 'typeorm';

export abstract class BaseIdEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
