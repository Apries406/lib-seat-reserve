import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatService } from './seat.service';
import { SeatStatus, StatusTrigger } from '../enums/seat-status.enum';
import { Reservation, ReservationStatus } from '../../reservation/entities/reservation.entity';
import { UserService, ViolationType } from '../../user/services/user.service';

const TEMP_LEAVE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class TempLeaveScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TempLeaveScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly seatService: SeatService,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly userService: UserService,
  ) {}

  onModuleInit() {
    void this.runSweep();
    this.timer = setInterval(() => {
      void this.runSweep();
    }, TEMP_LEAVE_SWEEP_INTERVAL_MS);
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
      const seats = await this.seatService.findTempLeaveSeats();
      for (const seat of seats) {
        await this.handleTempLeaveTimeout(seat.id, seat.currentUserId);
      }
      if (seats.length > 0) {
        this.logger.log(`Released ${seats.length} seats due to temp-leave timeout`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to handle temp-leave timeout: ${message}`);
    }
  }

  private async handleTempLeaveTimeout(seatId: number, userId: string | null) {
    await this.seatService.updateStatus(seatId, SeatStatus.FREE, StatusTrigger.TIMEOUT);

    if (userId) {
      const reservation = await this.reservationRepo.findOne({
        where: {
          userId,
          seatId,
          status: ReservationStatus.ACTIVE,
        },
        order: { checkedInAt: 'DESC' },
      });

      if (reservation) {
        reservation.status = ReservationStatus.COMPLETED;
        reservation.checkedOutAt = new Date();
        await this.reservationRepo.save(reservation);
      }

      await this.userService.deductCreditScore(userId, ViolationType.LONG_LEAVE, {
        reservationId: reservation?.id,
      });
    }
  }
}
