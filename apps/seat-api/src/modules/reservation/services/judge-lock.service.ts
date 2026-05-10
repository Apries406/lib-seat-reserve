import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

const JUDGE_CONFIG = {
  ttlSeconds: 60,
  key: (seatId: number) => `seat:judge:${seatId}`,
};

@Injectable()
export class JudgeLockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async lock(seatId: number, userId: string): Promise<boolean> {
    const key = JUDGE_CONFIG.key(seatId);
    const result = await this.redis.set(key, userId, 'EX', JUDGE_CONFIG.ttlSeconds, 'NX');
    return result === 'OK';
  }

  async unlock(seatId: number): Promise<void> {
    await this.redis.del(JUDGE_CONFIG.key(seatId));
  }

  async getUserId(seatId: number): Promise<string | null> {
    return this.redis.get(JUDGE_CONFIG.key(seatId));
  }

  async getRemainingTTL(seatId: number): Promise<number> {
    return this.redis.ttl(JUDGE_CONFIG.key(seatId));
  }
}
