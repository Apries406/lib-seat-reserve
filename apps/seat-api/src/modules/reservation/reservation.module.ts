import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationService } from './services/reservation.service';
import { ReservationLockService } from './services/reservation-lock.service';
import { ReservationController } from './controllers/reservation.controller';
import { SeatModule } from '../seat/seat.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation]), SeatModule],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationLockService],
  exports: [ReservationService, ReservationLockService],
})
export class ReservationModule {}
