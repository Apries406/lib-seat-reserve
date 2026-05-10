import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Seat } from '../seat/entities/seat.entity';
import { SeatUsageStatistic } from '../statistics/entities/seat-usage.entity';
import { ReservationService } from './services/reservation.service';
import { ReservationLockService } from './services/reservation-lock.service';
import { ReservationExpirationScheduler } from './services/reservation-expiration.scheduler';
import { SmartReserveService } from './services/smart-reserve.service';
import { JudgeLockService } from './services/judge-lock.service';
import { JudgeScheduler } from './services/judge-scheduler.service';
import { ReservationController } from './controllers/reservation.controller';
import { SmartReserveController } from './controllers/smart-reserve.controller';
import { SeatModule } from '../seat/seat.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Seat, SeatUsageStatistic]), SeatModule, WebsocketModule, UserModule],
  controllers: [ReservationController, SmartReserveController],
  providers: [ReservationService, ReservationLockService, ReservationExpirationScheduler, SmartReserveService, JudgeLockService, JudgeScheduler],
  exports: [ReservationService, ReservationLockService, JudgeLockService],
})
export class ReservationModule {}
