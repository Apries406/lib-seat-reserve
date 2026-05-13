import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { ISensorDataMessage } from '../enums/device.enum';
import { SeatService } from '../../seat/services/seat.service';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { Reservation, ReservationStatus } from '../../reservation/entities/reservation.entity';
import { UserService, ViolationType } from '../../user/services/user.service';

const JUDGE_CONFIG = {
  leave: {
    duration: 5 * 60 * 1000,
    interval: 30 * 1000,
    threshold: 0.8,
  },
  return: {
    duration: 3 * 60 * 1000,
    interval: 30 * 1000,
    threshold: 0.7,
  },
};

@Injectable()
export class SensorProcessorService {
  private readonly logger = new Logger(SensorProcessorService.name);

  constructor(
    @Inject(forwardRef(() => SeatService))
    private readonly seatService: SeatService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly userService: UserService,
  ) {}

  async process(deviceId: string, message: ISensorDataMessage): Promise<void> {
    const { sensor, timestamp } = message;

    const seat = await this.seatService.findByDeviceId(deviceId);
    if (!seat) {
      this.logger.warn(`Device ${deviceId} not associated with any seat`);
      return;
    }

    this.logger.debug(`Sensor ${deviceId}: ${sensor.value ? '有人' : '无人'}`);

    await this.recordObservation(seat.id, sensor.value);

    if (sensor.value) {
      // 有人
      if (seat.status === SeatStatus.RESERVED) {
        await this.tryAutoCheckin(seat.id);
        return;
      }

      if (seat.status === SeatStatus.MAYBE_LEAVE || seat.status === SeatStatus.TEMP_LEAVE) {
        const shouldReturn = await this.judgeReturn(seat.id);
        if (shouldReturn) {
          await this.seatService.updateStatus(seat.id, SeatStatus.IN_USE, StatusTrigger.SENSOR_RETURN, seat.currentUserId);
        }
      }
    } else {
      // 无人
      if (seat.status === SeatStatus.IN_USE) {
        const shouldLeave = await this.judgeLeave(seat.id);
        if (shouldLeave) {
          await this.seatService.updateStatus(seat.id, SeatStatus.MAYBE_LEAVE, StatusTrigger.SENSOR_LEAVE, seat.currentUserId);
          await this.handleCheckinNoPerson(seat.id);
        }
      }

      if (seat.status === SeatStatus.MAYBE_LEAVE) {
        const shouldLeave = await this.judgeLeave(seat.id);
        if (shouldLeave) {
          await this.seatService.updateStatus(seat.id, SeatStatus.TEMP_LEAVE, StatusTrigger.JUDGE_LEAVE, seat.currentUserId);
        }
      }
    }
  }

  private async tryAutoCheckin(seatId: number): Promise<void> {
    const reservation = await this.reservationRepo.findOne({
      where: {
        seatId,
        status: ReservationStatus.PENDING,
      },
      order: { reservedAt: 'DESC' },
    });

    if (!reservation) {
      this.logger.debug(`Seat ${seatId} is RESERVED but no pending reservation found`);
      return;
    }

    if (new Date() > reservation.expiresAt) {
      this.logger.debug(`Reservation ${reservation.id} expired, skipping auto-checkin`);
      return;
    }

    reservation.status = ReservationStatus.ACTIVE;
    reservation.checkedInAt = new Date();
    await this.reservationRepo.save(reservation);
    await this.seatService.updateStatus(seatId, SeatStatus.IN_USE, StatusTrigger.CHECKIN, reservation.userId);

    await this.redis.del(`seat:lock:${seatId}`, `seat:reserved:${seatId}`, `user:seat:${reservation.userId}`);

    this.logger.log(`Auto-checked-in reservation ${reservation.id} for seat ${seatId}`);
  }

  private async handleCheckinNoPerson(seatId: number): Promise<void> {
    const reservation = await this.reservationRepo.findOne({
      where: {
        seatId,
        status: ReservationStatus.ACTIVE,
      },
      order: { checkedInAt: 'DESC' },
    });

    if (!reservation || !reservation.checkedInAt) {
      return;
    }

    const minutesSinceCheckin = (Date.now() - new Date(reservation.checkedInAt).getTime()) / (1000 * 60);
    if (minutesSinceCheckin > 30) {
      return;
    }

    await this.userService.deductCreditScore(reservation.userId, ViolationType.CHECKIN_NO_PERSON, {
      reservationId: reservation.id,
    });

    await this.seatService.releaseSeat(seatId, StatusTrigger.SENSOR_LEAVE);

    reservation.status = ReservationStatus.COMPLETED;
    reservation.checkedOutAt = new Date();
    await this.reservationRepo.save(reservation);

    this.logger.log(`Detected checkin-no-person for reservation ${reservation.id}, seat ${seatId}`);
  }

  async recordObservation(seatId: number, isOccupied: boolean): Promise<void> {
    const key = `seat:observations:${seatId}`;
    const ts = Date.now();

    await this.redis.lpush(key, JSON.stringify({ timestamp: ts, isOccupied }));

    await this.redis.ltrim(key, 0, 200);
    await this.redis.expire(key, 600);
  }

  async judgeLeave(seatId: number): Promise<boolean> {
    const observations = await this.getRecentObservations(seatId, JUDGE_CONFIG.leave.duration);
    if (observations.length === 0) return false;

    const emptyCount = observations.filter((obs) => !obs.isOccupied).length;
    const emptyRatio = emptyCount / observations.length;

    return emptyRatio >= JUDGE_CONFIG.leave.threshold;
  }

  async judgeReturn(seatId: number): Promise<boolean> {
    const observations = await this.getRecentObservations(seatId, JUDGE_CONFIG.return.duration);
    if (observations.length === 0) return false;

    const occupiedCount = observations.filter((obs) => obs.isOccupied).length;
    const occupiedRatio = occupiedCount / observations.length;

    return occupiedRatio >= JUDGE_CONFIG.return.threshold;
  }

  private async getRecentObservations(
    seatId: number,
    duration: number,
  ): Promise<Array<{ timestamp: number; isOccupied: boolean }>> {
    const key = `seat:observations:${seatId}`;
    const cutoff = Date.now() - duration;
    const allData = await this.redis.lrange(key, 0, -1);

    return allData.map((item) => JSON.parse(item)).filter((item) => item.timestamp >= cutoff);
  }
}
