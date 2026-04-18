import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, CreditScoreLevel } from '../entities/user.entity';

export enum ViolationType {
  NO_SHOW = 'NO_SHOW',
  CHECKIN_NO_PERSON = 'CHECKIN_NO_PERSON',
  LONG_LEAVE = 'LONG_LEAVE',
  REMOTE_CHECKIN = 'REMOTE_CHECKIN',
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

  async deductCreditScore(userId: string, violationType: ViolationType): Promise<User> {
    const user = await this.findById(userId);
    const deduction = VIOLATION_SCORES[violationType];
    
    user.creditScore = Math.max(0, user.creditScore + deduction);
    user.violationCount += 1;
    user.lastViolationAt = new Date();
    
    return this.userRepo.save(user);
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
}
