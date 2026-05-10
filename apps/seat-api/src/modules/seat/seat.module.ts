import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seat } from './entities/seat.entity';
import { SeatStatusLog } from './entities/seat-status-log.entity';
import { SeatService } from './services/seat.service';
import { SeatController } from './controllers/seat.controller';
import { TempLeaveScheduler } from './services/temp-leave.scheduler';
import { WebsocketModule } from '../websocket/websocket.module';
import { UserModule } from '../user/user.module';
import { Reservation } from '../reservation/entities/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Seat, SeatStatusLog, Reservation]), WebsocketModule, UserModule],
  controllers: [SeatController],
  providers: [SeatService, TempLeaveScheduler],
  exports: [SeatService],
})
export class SeatModule {}
