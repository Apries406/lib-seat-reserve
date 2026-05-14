import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UserService } from './user.service';

const RECOVERY_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CreditRecoveryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreditRecoveryScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private initTimer: NodeJS.Timeout | null = null;

  constructor(private readonly userService: UserService) {}

  onModuleInit() {
    const now = new Date();

    // Demo/测试：启动后 10 秒先执行一次，方便立即验证每日恢复功能
    this.initTimer = setTimeout(() => {
      this.initTimer = null;
      this.logger.log('Running initial credit recovery for demo');
      void this.runRecovery();
    }, 10_000);

    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const delay = nextMidnight.getTime() - now.getTime();

    this.logger.log(`Daily credit recovery scheduled in ${Math.round(delay / 1000 / 60)} minutes`);

    this.timer = setTimeout(() => {
      void this.runRecovery();
      this.timer = setInterval(() => {
        void this.runRecovery();
      }, RECOVERY_INTERVAL_MS);
    }, delay);
  }

  onModuleDestroy() {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
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
