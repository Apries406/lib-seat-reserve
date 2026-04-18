import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { readFileSync } from 'fs';
import { join } from 'path';

export enum LuaScriptResult {
  SUCCESS = 1,
  SEAT_LOCKED = -1,
  SEAT_RESERVED = -2,
  USER_HAS_RESERVATION = -3,
}

const RESERVATION_CONFIG = {
  expireTime: 30 * 60,
  lockTTL: 10,
  keys: {
    seatLock: (seatId: number) => `seat:lock:${seatId}`,
    seatReserved: (seatId: number) => `seat:reserved:${seatId}`,
    userSeat: (userId: string) => `user:seat:${userId}`,
  },
};

@Injectable()
export class ReservationLockService {
  private luaScript: string;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.luaScript = readFileSync(
      join(__dirname, '../scripts/seat-reserve.lua'),
      'utf-8',
    );
  }

  async tryReserve(seatId: number, userId: string): Promise<{ success: boolean; result: LuaScriptResult }> {
    const keys = [
      RESERVATION_CONFIG.keys.seatLock(seatId),
      RESERVATION_CONFIG.keys.seatReserved(seatId),
      RESERVATION_CONFIG.keys.userSeat(userId),
    ];

    const args = [
      userId,
      RESERVATION_CONFIG.expireTime.toString(),
      RESERVATION_CONFIG.lockTTL.toString(),
    ];

    const result = await this.redis.eval(
      this.luaScript,
      keys.length,
      ...keys,
      ...args,
    ) as number;

    return {
      success: result === LuaScriptResult.SUCCESS,
      result: result as LuaScriptResult,
    };
  }

  async releaseReservation(seatId: number, userId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(RESERVATION_CONFIG.keys.seatLock(seatId));
    pipeline.del(RESERVATION_CONFIG.keys.seatReserved(seatId));
    pipeline.del(RESERVATION_CONFIG.keys.userSeat(userId));
    await pipeline.exec();
  }

  async isSeatAvailable(seatId: number): Promise<boolean> {
    const reserved = await this.redis.get(RESERVATION_CONFIG.keys.seatReserved(seatId));
    return reserved === null;
  }

  async getRemainingTTL(seatId: number): Promise<number> {
    return this.redis.ttl(RESERVATION_CONFIG.keys.seatReserved(seatId));
  }
}
