import { Injectable, BadRequestException } from '@nestjs/common';
import { ReservationService } from '../../reservation/services/reservation.service';
import { SeatService } from '../../seat/services/seat.service';
import { LocationService } from './location.service';
import { QrCodeService } from '../../seat/services/qr-code.service';
import { CheckinMethod, CheckinFailReason, CHECKIN_FAIL_TEXT } from '../enums/checkin.enum';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { UserService, ViolationType } from '../../user/services/user.service';

export interface ICheckinRequest {
  reservationId: string;
  method: CheckinMethod;
  location?: { lat: number; lng: number };
  qrCode?: string;
}

export interface IScanResult {
  seat: {
    id: number;
    area: string;
    seatNumber: string;
    status: SeatStatus;
    attributes: any;
  };
  statusText: string;
  canReserve: boolean;
  myReservation: {
    id: string;
    status: string;
    expiresAt: Date;
    checkedInAt?: Date;
  } | null;
  message: string;
}

@Injectable()
export class CheckinService {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly seatService: SeatService,
    private readonly locationService: LocationService,
    private readonly userService: UserService,
    private readonly qrCodeService: QrCodeService,
  ) {}

  async checkin(userId: string, request: ICheckinRequest) {
    const { reservationId, method, location, qrCode } = request;

    const reservation = await this.reservationService.getCurrent(userId);
    if (!reservation || reservation.id !== reservationId) {
      throw new BadRequestException(CHECKIN_FAIL_TEXT[CheckinFailReason.RESERVATION_NOT_FOUND]);
    }

    const seat = await this.seatService.findById(reservation.seatId);

    if (method === CheckinMethod.LOCATION) {
      if (!location || location.lat == null || location.lng == null) {
        throw new BadRequestException('位置信息不完整');
      }
      if (seat.latitude == null || seat.longitude == null) {
        throw new BadRequestException('该座位未设置位置信息');
      }
      const verification = await this.locationService.verifyLocation(
        userId,
        { latitude: seat.latitude, longitude: seat.longitude },
        location,
      );

      if (!verification.isValid) {
        throw new BadRequestException(CHECKIN_FAIL_TEXT[CheckinFailReason.LOCATION_TOO_FAR]);
      }

      if (verification.isRemote) {
        await this.userService.deductCreditScore(userId, ViolationType.REMOTE_CHECKIN, {
          reservationId,
        });
      }
    }

    if (method === CheckinMethod.QR_CODE && qrCode) {
      const verification = this.qrCodeService.verifySeatQrToken(qrCode);
      if (!verification.valid || verification.seatId !== seat.id) {
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

  async scan(userId: string, qrToken: string): Promise<IScanResult> {
    const verification = this.qrCodeService.verifySeatQrToken(qrToken);
    if (!verification.valid) {
      throw new BadRequestException(verification.reason || '二维码无效');
    }

    const seat = await this.seatService.findById(verification.seatId!);

    const myReservation = await this.reservationService.getCurrent(userId);
    const isMySeat = myReservation && myReservation.seatId === seat.id;
    const hasOtherReservation = myReservation && myReservation.seatId !== seat.id;

    let canReserve = false;
    let message = '';

    if (hasOtherReservation) {
      canReserve = false;
      message = '您已有进行中的预约，无法预约其他座位';
    } else {
      switch (seat.status) {
        case SeatStatus.FREE:
          canReserve = !isMySeat;
          message = isMySeat ? '您已预约此座位，请去签到' : '座位空闲，可以预约';
          break;
        case SeatStatus.RESERVED:
          canReserve = false;
          message = isMySeat ? '您已预约此座位，请去签到' : '该座位已被预约';
          break;
      case SeatStatus.IN_USE:
        canReserve = false;
        message = isMySeat ? '您正在使用此座位' : '该座位正在使用中';
        break;
      case SeatStatus.TEMP_LEAVE:
        canReserve = false;
        message = isMySeat ? '您正在使用此座位（暂离中）' : '该座位暂离中';
        break;
      case SeatStatus.MAYBE_LEAVE:
        canReserve = false;
        message = isMySeat ? '您正在使用此座位（可能离座）' : '该座位可能离座';
        break;
      case SeatStatus.IN_JUDGE:
        canReserve = false;
        message = '该座位正在犹豫中';
        break;
      default:
        canReserve = false;
        message = '该座位暂不可用';
      }
    }

    return {
      seat: this.seatService.toResponse(seat),
      statusText: seat.status,
      canReserve,
      myReservation: isMySeat ? myReservation : null,
      message,
    };
  }
}
