import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('credit_score_details')
export class CreditScoreDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  changeAmount: number;

  @Column({ type: 'varchar', length: 64 })
  reason: string;

  @Column({ type: 'int' })
  beforeScore: number;

  @Column({ type: 'int' })
  afterScore: number;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  reservationId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
