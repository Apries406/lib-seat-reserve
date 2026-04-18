import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Seat } from '../../seat/entities/seat.entity';

export enum ReservationStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  seatId: number;

  @ManyToOne(() => Seat)
  @JoinColumn({ name: 'seatId' })
  seat: Seat;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.PENDING })
  @Index()
  status: ReservationStatus;

  @Column({ type: 'timestamp' })
  reservedAt: Date;

  @Column({ type: 'timestamp' })
  @Index()
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkedInAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkedOutAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
