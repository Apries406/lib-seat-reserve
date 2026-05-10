import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UserService } from './user.service';

const RECOVERY_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CreditRecoveryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreditRecoveryScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly userService: UserService) {}

  onModuleInit() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const delay = nextMidnight.getTime() - now.getTime();

    setTimeout(() => {
      void this.runRecovery();
      this.timer = setInterval(() => {
        void this.runRecovery();
      }, RECOVERY_INTERVAL_MS);
      this.timer.unref?.();
    }, delay);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runRecovery() {
    try {
      await this.userService.recoverCreditScore();
      this.logger.log('Credit score recovery completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to recover credit scores: ${message}`);
    }
  }
}
