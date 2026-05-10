import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seat } from './entities/seat.entity';
import { SeatStatusLog } from './entities/seat-status-log.entity';
import { SeatService } from './services/seat.service';
import { QrCodeService } from './services/qr-code.service';
import { SeatController } from './controllers/seat.controller';
import { TempLeaveScheduler } from './services/temp-leave.scheduler';
import { WebsocketModule } from '../websocket/websocket.module';
import { UserModule } from '../user/user.module';
import { Reservation } from '../reservation/entities/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Seat, SeatStatusLog, Reservation]), WebsocketModule, UserModule],
  controllers: [SeatController],
  providers: [SeatService, TempLeaveScheduler, QrCodeService],
  exports: [SeatService, QrCodeService],
})
export class SeatModule {}
