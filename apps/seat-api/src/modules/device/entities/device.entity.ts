import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Seat } from '../../seat/entities/seat.entity';
import { DeviceStatus } from '../enums/device.enum';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  deviceId: string;

  @Column()
  seatId: number;

  @OneToOne(() => Seat)
  @JoinColumn({ name: 'seatId' })
  seat: Seat;

  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.OFFLINE })
  status: DeviceStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  firmwareVersion: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'json', nullable: true })
  config: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
