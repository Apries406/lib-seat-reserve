import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { SeatStatus } from '../enums/seat-status.enum';
import { SeatStatusLog } from './seat-status-log.entity';

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  area: string;

  @Column({ type: 'varchar', length: 20 })
  seatNumber: string;

  @Column({ type: 'enum', enum: SeatStatus, default: SeatStatus.FREE })
  @Index()
  status: SeatStatus;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  deviceId: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  floor: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  building: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  attributes: {
    hasOutlet: boolean;
    isQuiet: boolean;
    nearWindow: boolean;
  } | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  currentUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reservedUntil: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  tempLeaveAt: Date | null;

  @OneToMany(() => SeatStatusLog, (log) => log.seat)
  statusLogs: SeatStatusLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
