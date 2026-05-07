import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationService } from './services/reservation.service';
import { ReservationLockService } from './services/reservation-lock.service';
import { ReservationExpirationScheduler } from './services/reservation-expiration.scheduler';
import { ReservationController } from './controllers/reservation.controller';
import { SeatModule } from '../seat/seat.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation]), SeatModule, WebsocketModule, UserModule],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationLockService, ReservationExpirationScheduler],
  exports: [ReservationService, ReservationLockService],
})
export class ReservationModule {}
