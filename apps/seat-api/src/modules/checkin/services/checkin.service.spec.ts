import { Test, TestingModule } from '@nestjs/testing';
import { CheckinService } from './checkin.service';
import { ReservationService } from '../../reservation/services/reservation.service';
import { SeatService } from '../../seat/services/seat.service';
import { LocationService } from './location.service';
import { QrCodeService } from '../../seat/services/qr-code.service';
import { UserService } from '../../user/services/user.service';
import { CheckinMethod, CheckinFailReason, CHECKIN_FAIL_TEXT } from '../enums/checkin.enum';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { ReservationStatus } from '../../reservation/entities/reservation.entity';
import { BadRequestException } from '@nestjs/common';

const mockReservation = {
  id: 'reservation-uuid-1',
  userId: 'user-123',
  seatId: 1,
  status: ReservationStatus.PENDING,
  reservedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  checkedInAt: null,
  seat: null,
};

const mockSeat = {
  id: 1,
  area: 'A区',
  seatNumber: 'A-01',
  status: SeatStatus.RESERVED,
  deviceId: null,
  latitude: 30.123,
  longitude: 104.456,
  floor: '1楼',
  building: '图书馆',
  attributes: null,
  currentUserId: 'user-123',
  reservedUntil: new Date(Date.now() + 30 * 60 * 1000),
  statusLogs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CheckinService', () => {
  let service: CheckinService;
  let reservationService: ReservationService;
  let seatService: SeatService;
  let locationService: LocationService;

  const mockReservationService = {
    getCurrent: jest.fn(),
    checkin: jest.fn(),
  };

  const mockSeatService = {
    findById: jest.fn(),
  };

  const mockLocationService = {
    verifyLocation: jest.fn(),
  };

  const mockUserService = {
    deductCreditScore: jest.fn(),
  };

  const mockQrCodeService = {
    verifySeatQrToken: jest.fn().mockImplementation((token: string) => {
      if (token.startsWith('seat:1:')) {
        return { valid: true, seatId: 1 };
      }
      return { valid: false, reason: '二维码无效' };
    }),
    generateSeatQrToken: jest.fn().mockReturnValue('seat:1:mocksignature'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: ReservationService, useValue: mockReservationService },
        { provide: SeatService, useValue: mockSeatService },
        { provide: LocationService, useValue: mockLocationService },
        { provide: UserService, useValue: mockUserService },
        { provide: QrCodeService, useValue: mockQrCodeService },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
    reservationService = module.get<ReservationService>(ReservationService);
    seatService = module.get<SeatService>(SeatService);
    locationService = module.get<LocationService>(LocationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkin', () => {
    it('should checkin successfully with QR code', async () => {
      mockReservationService.getCurrent.mockResolvedValue(mockReservation);
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockReservationService.checkin.mockResolvedValue({ ...mockReservation, status: ReservationStatus.ACTIVE, checkedInAt: new Date() });

      const qrCode = `seat:${mockSeat.id}:mocksignature`;
      const result = await service.checkin('user-123', {
        reservationId: 'reservation-uuid-1',
        method: CheckinMethod.QR_CODE,
        qrCode,
      });

      expect(result.success).toBe(true);
      expect(result.seatId).toBe(1);
      expect(result.seatNumber).toBe('A-01');
    });

    it('should checkin successfully with location', async () => {
      mockReservationService.getCurrent.mockResolvedValue(mockReservation);
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockLocationService.verifyLocation.mockResolvedValue({ isValid: true });
      mockReservationService.checkin.mockResolvedValue({ ...mockReservation, status: ReservationStatus.ACTIVE, checkedInAt: new Date() });

      const result = await service.checkin('user-123', {
        reservationId: 'reservation-uuid-1',
        method: CheckinMethod.LOCATION,
        location: { lat: 30.123, lng: 104.456 },
      });

      expect(result.success).toBe(true);
      expect(mockLocationService.verifyLocation).toHaveBeenCalled();
    });

    it('should throw if no current reservation', async () => {
      mockReservationService.getCurrent.mockResolvedValue(null);

      await expect(
        service.checkin('user-123', { reservationId: 'reservation-uuid-1', method: CheckinMethod.QR_CODE, qrCode: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if reservation ID does not match', async () => {
      mockReservationService.getCurrent.mockResolvedValue(mockReservation);

      await expect(
        service.checkin('user-123', { reservationId: 'wrong-id', method: CheckinMethod.QR_CODE, qrCode: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if QR code is invalid', async () => {
      mockReservationService.getCurrent.mockResolvedValue(mockReservation);
      mockSeatService.findById.mockResolvedValue(mockSeat);

      await expect(
        service.checkin('user-123', {
          reservationId: 'reservation-uuid-1',
          method: CheckinMethod.QR_CODE,
          qrCode: 'INVALID_QR_CODE',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if location is too far', async () => {
      mockReservationService.getCurrent.mockResolvedValue(mockReservation);
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockLocationService.verifyLocation.mockResolvedValue({ isValid: false });

      await expect(
        service.checkin('user-123', {
          reservationId: 'reservation-uuid-1',
          method: CheckinMethod.LOCATION,
          location: { lat: 31.0, lng: 105.0 },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
