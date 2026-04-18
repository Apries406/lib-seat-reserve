import { Injectable, BadRequestException } from '@nestjs/common';
import { ReservationService } from '../../reservation/services/reservation.service';
import { SeatService } from '../../seat/services/seat.service';
import { LocationService } from './location.service';
import { CheckinMethod, CheckinFailReason, CHECKIN_FAIL_TEXT } from '../enums/checkin.enum';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';

export interface ICheckinRequest {
  reservationId: string;
  method: CheckinMethod;
  location?: { lat: number; lng: number };
  qrCode?: string;
}

@Injectable()
export class CheckinService {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly seatService: SeatService,
    private readonly locationService: LocationService,
  ) {}

  async checkin(userId: string, request: ICheckinRequest) {
    const { reservationId, method, location, qrCode } = request;

    const reservation = await this.reservationService.getCurrent(userId);
    if (!reservation || reservation.id !== reservationId) {
      throw new BadRequestException(CHECKIN_FAIL_TEXT[CheckinFailReason.RESERVATION_NOT_FOUND]);
    }

    const seat = await this.seatService.findById(reservation.seatId);

    if (method === CheckinMethod.LOCATION && location) {
      const verification = await this.locationService.verifyLocation(
        userId,
        { latitude: seat.latitude, longitude: seat.longitude },
        location,
      );

      if (!verification.isValid) {
        throw new BadRequestException(CHECKIN_FAIL_TEXT[CheckinFailReason.LOCATION_TOO_FAR]);
      }
    }

    if (method === CheckinMethod.QR_CODE && qrCode) {
      const expectedQrCode = `SEAT_${seat.id}_${seat.area}_${seat.seatNumber}`;
      if (qrCode !== expectedQrCode) {
        throw new BadRequestException('二维码无效');
      }
    }

    await this.reservationService.checkin(reservationId, userId);

    return {
      success: true,
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      area: seat.area,
      checkedInAt: new Date(),
    };
  }
}
