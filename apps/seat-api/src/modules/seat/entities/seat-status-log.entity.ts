import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Seat } from './seat.entity';
import { SeatStatus, StatusTrigger } from '../enums/seat-status.enum';

@Entity('seat_status_logs')
export class SeatStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  seatId: number;

  @ManyToOne(() => Seat, (seat) => seat.statusLogs)
  @JoinColumn({ name: 'seatId' })
  seat: Seat;

  @Column({ type: 'enum', enum: SeatStatus })
  previousStatus: SeatStatus;

  @Column({ type: 'enum', enum: SeatStatus })
  currentStatus: SeatStatus;

  @Column({ type: 'enum', enum: StatusTrigger })
  trigger: StatusTrigger;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
