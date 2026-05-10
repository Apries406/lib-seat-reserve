import { Module } from '@nestjs/common';
import { CheckinService } from './services/checkin.service';
import { LocationService } from './services/location.service';
import { QrCodeService } from '../seat/services/qr-code.service';
import { CheckinController } from './controllers/checkin.controller';
import { ReservationModule } from '../reservation/reservation.module';
import { SeatModule } from '../seat/seat.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [ReservationModule, SeatModule, UserModule],
  controllers: [CheckinController],
  providers: [CheckinService, LocationService],
  exports: [CheckinService, LocationService],
})
export class CheckinModule {}
