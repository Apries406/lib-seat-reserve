import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreditScoreDetail } from '../entities/credit-score-detail.entity';

export enum ViolationType {
  NO_SHOW = 'NO_SHOW',
  CHECKIN_NO_PERSON = 'CHECKIN_NO_PERSON',
  LONG_LEAVE = 'LONG_LEAVE',
  REMOTE_CHECKIN = 'REMOTE_CHECKIN',
}

interface DeductCreditScoreOptions {
  reservationId?: string;
}

export interface CreditScoreDetailResponse {
  id: string;
  userId: string;
  changeAmount: number;
  reason: string;
  beforeScore: number;
  afterScore: number;
  reservationId: string | null;
  createdAt: Date;
}

const VIOLATION_SCORES = {
  [ViolationType.NO_SHOW]: -15,
  [ViolationType.CHECKIN_NO_PERSON]: -10,
  [ViolationType.LONG_LEAVE]: -5,
  [ViolationType.REMOTE_CHECKIN]: -3,
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CreditScoreDetail)
    private readonly creditScoreDetailRepo: Repository<CreditScoreDetail>,
  ) {}

  async findByOpenId(openId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { openId } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async createOrUpdate(openId: string, nickname: string, avatar?: string): Promise<User> {
    let user = await this.findByOpenId(openId);
    
    if (user) {
      user.nickname = nickname;
      if (avatar) user.avatar = avatar;
    } else {
      user = this.userRepo.create({
        openId,
        nickname,
        avatar,
        creditScore: 100,
        violationCount: 0,
      });
    }
    
    return this.userRepo.save(user);
  }

  async deductCreditScore(
    userId: string,
    violationType: ViolationType,
    options: DeductCreditScoreOptions = {},
  ): Promise<User> {
    const user = await this.findById(userId);
    const deduction = VIOLATION_SCORES[violationType];
    const beforeScore = user.creditScore;
    const afterScore = Math.max(0, beforeScore + deduction);
    
    user.creditScore = afterScore;
    user.violationCount += 1;
    user.lastViolationAt = new Date();

    const savedUser = await this.userRepo.save(user);

    const detail = this.creditScoreDetailRepo.create({
      userId,
      changeAmount: deduction,
      reason: violationType,
      beforeScore,
      afterScore,
      reservationId: options.reservationId ?? null,
    });
    await this.creditScoreDetailRepo.save(detail);
    
    return savedUser;
  }

  async getCreditScoreDetails(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: CreditScoreDetailResponse[]; total: number }> {
    const [items, total] = await this.creditScoreDetailRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) => this.toCreditScoreDetailResponse(item)),
      total,
    };
  }

  async recoverCreditScore(): Promise<void> {
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        creditScore: () => 'LEAST(creditScore + 5, 100)',
      })
      .where('creditScore < :max', { max: 100 })
      .execute();
  }

  async updateProfile(id: string, nickname?: string, avatar?: string): Promise<User> {
    const user = await this.findById(id);
    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    return this.userRepo.save(user);
  }

  toResponse(user: User) {
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      creditScore: user.creditScore,
      creditLevel: user.creditLevel,
      canReserve: user.canReserve,
    };
  }

  toCreditScoreDetailResponse(detail: CreditScoreDetail) {
    return {
      id: detail.id,
      userId: detail.userId,
      changeAmount: detail.changeAmount,
      reason: detail.reason,
      beforeScore: detail.beforeScore,
      afterScore: detail.afterScore,
      reservationId: detail.reservationId,
      createdAt: detail.createdAt,
    };
  }
}
