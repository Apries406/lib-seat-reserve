import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, MoreThan } from 'typeorm';
import { Seat } from '../../seat/entities/seat.entity';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { SeatService } from '../../seat/services/seat.service';
import { ReservationLockService } from './reservation-lock.service';
import { JudgeLockService } from './judge-lock.service';
import { ReservationService } from './reservation.service';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { UserService } from '../../user/services/user.service';
import { SeatUsageStatistic } from '../../statistics/entities/seat-usage.entity';

export interface ISmartReservePreference {
  nearWindow?: boolean;
  hasOutlet?: boolean;
  isQuiet?: boolean;
  floor?: 'high' | 'low' | 'any';
  area?: string;
  acceptAdjustment: boolean;
}

interface ISeatCandidate {
  seat: Seat;
  score: number;
}

interface IUserPreference {
  preferredArea?: string;
  nearWindowWeight: number;
  hasOutletWeight: number;
  isQuietWeight: number;
}

@Injectable()
export class SmartReserveService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(SeatUsageStatistic)
    private readonly usageRepo: Repository<SeatUsageStatistic>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly seatService: SeatService,
    private readonly lockService: ReservationLockService,
    private readonly judgeLockService: JudgeLockService,
    private readonly reservationService: ReservationService,
    private readonly userService: UserService,
  ) {}

  async smartReserve(userId: string, preference: ISmartReservePreference, deviceFingerprint?: string) {
    const user = await this.userService.findById(userId);
    if (!user.canReserve) {
      throw new BadRequestException('信誉分过低，暂时无法预约座位');
    }

    const fingerprintValid = await this.userService.verifyDeviceFingerprint(userId, deviceFingerprint);
    if (!fingerprintValid) {
      throw new BadRequestException('检测到账号在非常用设备登录，请使用常用设备预约');
    }

    const current = await this.reservationService.getCurrent(userId);
    if (current) {
      throw new BadRequestException('您已有进行中的预约');
    }

    const candidates = await this.findCandidates(userId, preference);

    if (!candidates.seat) {
      throw new BadRequestException(candidates.message);
    }

    const reservation = await this.reservationService.create(userId, candidates.seat.id);

    return {
      reservation: this.reservationService.toResponse(reservation),
      seat: this.seatService.toResponse(candidates.seat),
      adjusted: candidates.adjusted,
      message: candidates.message,
    };
  }

  async preview(userId: string, preference: ISmartReservePreference, deviceFingerprint?: string) {
    const user = await this.userService.findById(userId);
    if (!user.canReserve) {
      throw new BadRequestException('信誉分过低，暂时无法预约座位');
    }

    const fingerprintValid = await this.userService.verifyDeviceFingerprint(userId, deviceFingerprint);
    if (!fingerprintValid) {
      throw new BadRequestException('检测到账号在非常用设备登录，请使用常用设备预约');
    }

    const current = await this.reservationService.getCurrent(userId);
    if (current) {
      throw new BadRequestException('您已有进行中的预约');
    }

    const candidates = await this.findCandidates(userId, preference);

    if (!candidates.seat) {
      throw new BadRequestException(candidates.message);
    }

    const locked = await this.judgeLockService.lock(candidates.seat.id, userId);
    if (!locked) {
      throw new BadRequestException('座位已被锁定，请重试');
    }

    await this.seatService.updateStatus(candidates.seat.id, SeatStatus.IN_JUDGE, StatusTrigger.RESERVE, userId);
    const lockedSeat = await this.seatService.findById(candidates.seat.id);

    return {
      seat: this.seatService.toResponse(lockedSeat),
      adjusted: candidates.adjusted,
      message: candidates.message,
      expiresIn: 60,
    };
  }

  async confirm(userId: string, seatId: number) {
    const ownerId = await this.judgeLockService.getUserId(seatId);
    if (ownerId !== userId) {
      throw new BadRequestException('无权确认此座位');
    }

    const seat = await this.seatService.findById(seatId);
    if (seat.status !== SeatStatus.IN_JUDGE) {
      throw new BadRequestException('座位状态不允许确认');
    }

    await this.judgeLockService.unlock(seatId);
    await this.seatService.updateStatus(seatId, SeatStatus.FREE, StatusTrigger.RELEASE);
    await this.lockService.releaseReservation(seatId, userId);

    const reservation = await this.reservationService.create(userId, seatId);
    const reservedSeat = await this.seatService.findById(seatId);

    return {
      reservation: this.reservationService.toResponse(reservation),
      seat: this.seatService.toResponse(reservedSeat),
      message: '预约成功',
    };
  }

  async cancelPreview(userId: string, seatId: number) {
    const ownerId = await this.judgeLockService.getUserId(seatId);
    if (ownerId !== userId) {
      throw new BadRequestException('无权取消此座位');
    }

    const seat = await this.seatService.findById(seatId);
    if (seat.status !== SeatStatus.IN_JUDGE) {
      throw new BadRequestException('座位状态不允许取消');
    }

    await this.judgeLockService.unlock(seatId);
    await this.seatService.releaseSeat(seatId, StatusTrigger.RELEASE);

    return { message: '已取消' };
  }

  private async findCandidates(
    userId: string,
    preference: ISmartReservePreference,
  ): Promise<{ seat: Seat | null; adjusted: boolean; message: string }> {
    const levels = this.buildFilterLevels(preference);

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const seats = await this.queryFreeSeats(level);

      if (seats.length === 0) continue;

      const scored = await this.scoreSeats(seats, userId);
      const sorted = scored.sort((a, b) => b.score - a.score);

      for (const candidate of sorted) {
        const { success } = await this.lockService.tryReserve(candidate.seat.id, userId);
        if (success) {
          return {
            seat: candidate.seat,
            adjusted: i > 0,
            message: i > 0 ? `已为您调剂至 ${candidate.seat.area}区 ${candidate.seat.seatNumber}` : '预约成功',
          };
        }
      }
    }

    if (preference.acceptAdjustment) {
      return { seat: null, adjusted: false, message: '暂无空闲座位，请稍后再试' };
    }

    return { seat: null, adjusted: false, message: '暂无符合偏好的座位，您可以开启「接受调剂」重试' };
  }

  private buildFilterLevels(pref: ISmartReservePreference): Array<Partial<ISmartReservePreference>> {
    const base: Partial<ISmartReservePreference> = {
      nearWindow: pref.nearWindow,
      hasOutlet: pref.hasOutlet,
      isQuiet: pref.isQuiet,
      floor: pref.floor,
      area: pref.area,
    };

    const levels: Array<Partial<ISmartReservePreference>> = [base];

    if (!pref.acceptAdjustment) {
      return levels;
    }

    const relaxed1 = { ...base };
    if (pref.isQuiet !== undefined) {
      delete relaxed1.isQuiet;
      levels.push(relaxed1);
    }

    const relaxed2 = { ...relaxed1 };
    if (pref.nearWindow !== undefined) {
      delete relaxed2.nearWindow;
      levels.push(relaxed2);
    }

    const relaxed3 = { ...relaxed2 };
    if (pref.hasOutlet !== undefined) {
      delete relaxed3.hasOutlet;
      levels.push(relaxed3);
    }

    const relaxed4 = { ...relaxed3 };
    if (pref.floor !== undefined && pref.floor !== 'any') {
      relaxed4.floor = 'any';
      levels.push(relaxed4);
    }

    const relaxed5 = { ...relaxed4 };
    if (pref.area) {
      delete relaxed5.area;
      levels.push(relaxed5);
    }

    return levels;
  }

  private async queryFreeSeats(filter: Partial<ISmartReservePreference>): Promise<Seat[]> {
    const qb = this.seatRepo.createQueryBuilder('seat')
      .where('seat.status = :status', { status: SeatStatus.FREE });

    if (filter.area) {
      qb.andWhere('seat.area = :area', { area: filter.area });
    }

    if (filter.nearWindow !== undefined) {
      qb.andWhere("JSON_EXTRACT(seat.attributes, '$.nearWindow') = :nearWindow", { nearWindow: filter.nearWindow });
    }
    if (filter.hasOutlet !== undefined) {
      qb.andWhere("JSON_EXTRACT(seat.attributes, '$.hasOutlet') = :hasOutlet", { hasOutlet: filter.hasOutlet });
    }
    if (filter.isQuiet !== undefined) {
      qb.andWhere("JSON_EXTRACT(seat.attributes, '$.isQuiet') = :isQuiet", { isQuiet: filter.isQuiet });
    }

    if (filter.floor && filter.floor !== 'any') {
      if (filter.floor === 'high') {
        qb.andWhere('seat.floor IN (:...floors)', { floors: ['3'] });
      } else if (filter.floor === 'low') {
        qb.andWhere('seat.floor IN (:...floors)', { floors: ['1'] });
      }
    }

    return qb.getMany();
  }

  private async scoreSeats(seats: Seat[], userId: string): Promise<ISeatCandidate[]> {
    const seatIds = seats.map((s) => s.id);
    const today = new Date().toISOString().split('T')[0];
    const userPref = await this.calculateUserPreference(userId);

    const usages = await this.usageRepo.find({
      where: {
        seatId: Not(IsNull()) as any,
        date: today,
      },
    });

    const usageMap = new Map(usages.map((u) => [u.seatId, u]));

    return seats.map((seat) => {
      let score = 0;

      const lastFreed = seat.lastFreedAt ? new Date(seat.lastFreedAt).getTime() : seat.createdAt.getTime();
      const idleHours = (Date.now() - lastFreed) / (1000 * 60 * 60);
      score += Math.min(idleHours * 10, 100);

      const usage = usageMap.get(seat.id);
      if (usage) {
        score -= (usage.usageRate || 0) * 50;
        score -= (usage.checkinCount || 0) * 2;
      } else {
        score += 20;
      }

      if (userPref.preferredArea && seat.area === userPref.preferredArea) {
        score += 30;
      }
      if (seat.attributes) {
        if (seat.attributes.nearWindow && userPref.nearWindowWeight > 0) score += 15 * userPref.nearWindowWeight;
        if (seat.attributes.hasOutlet && userPref.hasOutletWeight > 0) score += 15 * userPref.hasOutletWeight;
        if (seat.attributes.isQuiet && userPref.isQuietWeight > 0) score += 15 * userPref.isQuietWeight;
      }

      return { seat, score };
    });
  }

  private async calculateUserPreference(userId: string): Promise<IUserPreference> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const history = await this.reservationRepo.find({
      where: {
        userId,
        status: ReservationStatus.COMPLETED,
        checkedInAt: Not(IsNull()) as any,
        createdAt: MoreThan(thirtyDaysAgo),
      },
      relations: ['seat'],
    });

    if (history.length === 0) {
      return { preferredArea: undefined, nearWindowWeight: 0, hasOutletWeight: 0, isQuietWeight: 0 };
    }

    const areaCount = new Map<string, number>();
    let nearWindowCount = 0;
    let hasOutletCount = 0;
    let isQuietCount = 0;

    for (const r of history) {
      if (r.seat) {
        areaCount.set(r.seat.area, (areaCount.get(r.seat.area) || 0) + 1);
        if (r.seat.attributes?.nearWindow) nearWindowCount++;
        if (r.seat.attributes?.hasOutlet) hasOutletCount++;
        if (r.seat.attributes?.isQuiet) isQuietCount++;
      }
    }

    const preferredArea = Array.from(areaCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const total = history.length;

    return {
      preferredArea,
      nearWindowWeight: nearWindowCount / total,
      hasOutletWeight: hasOutletCount / total,
      isQuietWeight: isQuietCount / total,
    };
  }
}
