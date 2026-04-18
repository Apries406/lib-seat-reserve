import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SeatUsageStatistic } from '../entities/seat-usage.entity';
import { SeatStatusLog } from '../../seat/entities/seat-status-log.entity';
import { SeatStatus } from '../../seat/enums/seat-status.enum';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(SeatUsageStatistic)
    private readonly usageRepo: Repository<SeatUsageStatistic>,
    @InjectRepository(SeatStatusLog)
    private readonly statusLogRepo: Repository<SeatStatusLog>,
  ) {}

  async getSeatStatistics(query: { startDate: string; endDate: string; area?: string; seatId?: number }) {
    const qb = this.usageRepo.createQueryBuilder('s')
      .where('s.date BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });

    if (query.area) {
      qb.andWhere('s.area = :area', { area: query.area });
    }
    if (query.seatId) {
      qb.andWhere('s.seatId = :seatId', { seatId: query.seatId });
    }

    return qb.orderBy('s.date', 'DESC').getMany();
  }

  async getAreaHeatmap(date: string, area?: string) {
    const qb = this.usageRepo.createQueryBuilder('s')
      .select(['s.area', 's.usageRate', 's.peakHours'])
      .where('s.date = :date', { date });

    if (area) {
      qb.andWhere('s.area = :area', { area });
    }

    return qb.getMany();
  }

  async generateDailyStatistics(date: string): Promise<void> {
    const logs = await this.statusLogRepo.find({
      where: {
        createdAt: Between(
          new Date(`${date}T00:00:00`),
          new Date(`${date}T23:59:59`),
        ),
      },
      relations: ['seat'],
    });

    const seatStats = this.calculateSeatStats(logs, date);

    for (const stat of seatStats) {
      await this.usageRepo.upsert(stat, ['seatId', 'date']);
    }
  }

  private calculateSeatStats(logs: SeatStatusLog[], date: string): Partial<SeatUsageStatistic>[] {
    const seatMap = new Map<number, Partial<SeatUsageStatistic>>();

    for (const log of logs) {
      if (!log.seat) continue;

      let stat = seatMap.get(log.seatId);
      if (!stat) {
        stat = {
          seatId: log.seatId,
          seatNumber: log.seat.seatNumber,
          area: log.seat.area,
          date,
          totalMinutes: 0,
          usageRate: 0,
          reservationCount: 0,
          checkinCount: 0,
          noShowCount: 0,
          avgDuration: 0,
        };
        seatMap.set(log.seatId, stat);
      }

      if (log.currentStatus === SeatStatus.IN_USE) {
        stat.checkinCount = (stat.checkinCount || 0) + 1;
      }
    }

    return Array.from(seatMap.values());
  }
}
