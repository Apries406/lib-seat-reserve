import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReservationService } from './reservation.service';

const EXPIRED_RESERVATION_SWEEP_INTERVAL_MS = 60 * 1000;

@Injectable()
export class ReservationExpirationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationExpirationScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly reservationService: ReservationService) {}

  onModuleInit() {
    void this.runSweep();

    this.timer = setInterval(() => {
      void this.runSweep();
    }, EXPIRED_RESERVATION_SWEEP_INTERVAL_MS);

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
      await this.reservationService.handleExpiredReservations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to handle expired reservations: ${message}`);
    }
  }
}
