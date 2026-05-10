import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StatisticsService } from './statistics.service';

const DAILY_STATISTICS_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DailyStatisticsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyStatisticsScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly statisticsService: StatisticsService) {}

  onModuleInit() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 1, 0, 0);
    const delay = nextMidnight.getTime() - now.getTime();

    setTimeout(() => {
      void this.runDailyStatistics();
      this.timer = setInterval(() => {
        void this.runDailyStatistics();
      }, DAILY_STATISTICS_INTERVAL_MS);
      this.timer.unref?.();
    }, delay);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runDailyStatistics() {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dateStr = yesterday.toISOString().split('T')[0];
      await this.statisticsService.generateDailyStatistics(dateStr);
      this.logger.log(`Daily statistics generated for ${dateStr}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to generate daily statistics: ${message}`);
    }
  }
}
