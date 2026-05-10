import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Seat } from '../../seat/entities/seat.entity';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { SeatService } from '../../seat/services/seat.service';
import { JudgeLockService } from './judge-lock.service';

const JUDGE_SWEEP_INTERVAL_MS = 10 * 1000;

@Injectable()
export class JudgeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JudgeScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    private readonly seatService: SeatService,
    private readonly judgeLockService: JudgeLockService,
  ) {}

  onModuleInit() {
    void this.runSweep();

    this.timer = setInterval(() => {
      void this.runSweep();
    }, JUDGE_SWEEP_INTERVAL_MS);

    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runSweep() {
    try {
      const expiredSeats = await this.seatRepo.find({
        where: {
          status: SeatStatus.IN_JUDGE,
          judgeExpiresAt: LessThan(new Date()),
        },
      });

      for (const seat of expiredSeats) {
        await this.judgeLockService.unlock(seat.id);
        await this.seatService.releaseSeat(seat.id, StatusTrigger.TIMEOUT);
        this.logger.log(`Released expired IN_JUDGE seat ${seat.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to sweep judge locks: ${message}`);
    }
  }
}
