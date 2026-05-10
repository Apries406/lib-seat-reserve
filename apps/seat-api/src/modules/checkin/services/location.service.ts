import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

const LOCATION_CONFIG = {
  maxDistance: 50,
  remoteCheckinLimit: 3,
  remoteCheckinWindow: 24 * 60 * 60 * 1000,
};

export interface ILocationVerification {
  isValid: boolean;
  distance: number;
  isRemote: boolean;
  remainingRemoteCheckins: number;
}

@Injectable()
export class LocationService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async verifyLocation(
    userId: string,
    seatLocation: { latitude: number; longitude: number },
    userLocation: { lat: number; lng: number },
  ): Promise<ILocationVerification> {
    const distance = this.calculateDistance(
      userLocation.lat,
      userLocation.lng,
      seatLocation.latitude,
      seatLocation.longitude,
    );

    if (distance <= LOCATION_CONFIG.maxDistance) {
      return {
        isValid: true,
        distance,
        isRemote: false,
        remainingRemoteCheckins: await this.getRemainingRemoteCheckins(userId),
      };
    }

    const remaining = await this.getRemainingRemoteCheckins(userId);

    if (remaining <= 0) {
      return {
        isValid: false,
        distance,
        isRemote: true,
        remainingRemoteCheckins: 0,
      };
    }

    await this.recordRemoteCheckin(userId);

    return {
      isValid: true,
      distance,
      isRemote: true,
      remainingRemoteCheckins: remaining - 1,
    };
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private async getRemainingRemoteCheckins(userId: string): Promise<number> {
    const key = `checkin:remote:${userId}`;
    const count = await this.redis.get(key);
    const parsed = parseInt(count || '0', 10);
    const validCount = Number.isNaN(parsed) ? 0 : parsed;
    return Math.max(0, LOCATION_CONFIG.remoteCheckinLimit - validCount);
  }

  private async recordRemoteCheckin(userId: string): Promise<void> {
    const key = `checkin:remote:${userId}`;
    const ttl = LOCATION_CONFIG.remoteCheckinWindow / 1000;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttl);
    }
  }
}
