import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Seat } from '../../seat/entities/seat.entity';
import { SeatStatus } from '../../seat/enums/seat-status.enum';
import { SeatService } from '../../seat/services/seat.service';
import { ReservationLockService } from './reservation-lock.service';
import { ReservationService } from './reservation.service';
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

@Injectable()
export class SmartReserveService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(SeatUsageStatistic)
    private readonly usageRepo: Repository<SeatUsageStatistic>,
    private readonly seatService: SeatService,
    private readonly lockService: ReservationLockService,
    private readonly reservationService: ReservationService,
    private readonly userService: UserService,
  ) {}

  async smartReserve(userId: string, preference: ISmartReservePreference) {
    const user = await this.userService.findById(userId);
    if (!user.canReserve) {
      throw new BadRequestException('信誉分过低，暂时无法预约座位');
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

  private async findCandidates(
    userId: string,
    preference: ISmartReservePreference,
  ): Promise<{ seat: Seat | null; adjusted: boolean; message: string }> {
    const levels = this.buildFilterLevels(preference);

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const seats = await this.queryFreeSeats(level);

      if (seats.length === 0) continue;

      const scored = await this.scoreSeats(seats);
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

  private async scoreSeats(seats: Seat[]): Promise<ISeatCandidate[]> {
    const seatIds = seats.map((s) => s.id);
    const today = new Date().toISOString().split('T')[0];

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

      return { seat, score };
    });
  }
}
