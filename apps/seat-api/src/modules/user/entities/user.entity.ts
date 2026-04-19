import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CreditScoreLevel {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  openId: string;

  @Column({ type: 'varchar', length: 100 })
  nickname: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string;

  @Column({ type: 'int', default: 100 })
  creditScore: number;

  @Column({ type: 'int', default: 0 })
  violationCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastViolationAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceFingerprint: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get creditLevel(): CreditScoreLevel {
    if (this.creditScore >= 90) return CreditScoreLevel.EXCELLENT;
    if (this.creditScore >= 75) return CreditScoreLevel.GOOD;
    if (this.creditScore >= 65) return CreditScoreLevel.FAIR;
    return CreditScoreLevel.POOR;
  }

  get canReserve(): boolean {
    return this.creditScore >= 65;
  }
}
