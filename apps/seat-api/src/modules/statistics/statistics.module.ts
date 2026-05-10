import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatUsageStatistic } from './entities/seat-usage.entity';
import { SeatStatusLog } from '../seat/entities/seat-status-log.entity';
import { StatisticsService } from './services/statistics.service';
import { DailyStatisticsScheduler } from './services/daily-statistics.scheduler';
import { StatisticsController } from './controllers/statistics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeatUsageStatistic, SeatStatusLog])],
  controllers: [StatisticsController],
  providers: [StatisticsService, DailyStatisticsScheduler],
  exports: [StatisticsService],
})
export class StatisticsModule {}
