import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('seat_usage_statistics')
@Index(['seatId', 'date'], { unique: true })
export class SeatUsageStatistic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  seatId: number;

  @Column({ type: 'varchar', length: 20 })
  seatNumber: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  area: string;

  @Column({ type: 'date' })
  @Index()
  date: string;

  @Column({ type: 'int', default: 0 })
  totalMinutes: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  usageRate: number;

  @Column({ type: 'simple-json', nullable: true })
  peakHours: number[];

  @Column({ type: 'int', default: 0 })
  reservationCount: number;

  @Column({ type: 'int', default: 0 })
  checkinCount: number;

  @Column({ type: 'int', default: 0 })
  noShowCount: number;

  @Column({ type: 'int', default: 0 })
  avgDuration: number;

  @CreateDateColumn()
  createdAt: Date;
}
