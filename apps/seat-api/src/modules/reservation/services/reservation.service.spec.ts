import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationService } from './reservation.service';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { ReservationLockService, LuaScriptResult } from './reservation-lock.service';
import { SeatService } from '../../seat/services/seat.service';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SeatGateway } from '../../websocket/seat.gateway';
import { UserService, ViolationType } from '../../user/services/user.service';

const mockReservation: Reservation = {
  id: 'reservation-uuid-1',
  userId: 'user-123',
  seatId: 1,
  user: null,
  seat: { id: 1, area: 'A区', seatNumber: 'A-01', status: SeatStatus.RESERVED, deviceId: null, latitude: null, longitude: null, floor: '1楼', building: '图书馆', attributes: null, currentUserId: 'user-123', reservedUntil: new Date(Date.now() + 30 * 60 * 1000), statusLogs: [], createdAt: new Date(), updatedAt: new Date() },
  status: ReservationStatus.PENDING,
  reservedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  checkedInAt: null,
  checkedOutAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSeat = {
  id: 1,
  area: 'A区',
  seatNumber: 'A-01',
  status: SeatStatus.FREE,
  deviceId: null,
  latitude: null,
  longitude: null,
  floor: '1楼',
  building: '图书馆',
  attributes: null,
  currentUserId: null,
  reservedUntil: null,
  statusLogs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ReservationService', () => {
  let service: ReservationService;
  let reservationRepo: Repository<Reservation>;
  let lockService: ReservationLockService;
  let seatService: SeatService;

  const mockReservationRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockLockService = {
    tryReserve: jest.fn(),
    releaseReservation: jest.fn(),
    isSeatAvailable: jest.fn(),
    getRemainingTTL: jest.fn(),
  };

  const mockSeatService = {
    findById: jest.fn(),
    reserveSeat: jest.fn(),
    releaseSeat: jest.fn(),
    updateStatus: jest.fn(),
    toResponse: jest.fn(),
  };

  const mockSeatGateway = {
    emitReservationExpired: jest.fn(),
  };

  const mockUserService = {
    deductCreditScore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: getRepositoryToken(Reservation), useValue: mockReservationRepo },
        { provide: ReservationLockService, useValue: mockLockService },
        { provide: SeatService, useValue: mockSeatService },
        { provide: SeatGateway, useValue: mockSeatGateway },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    reservationRepo = module.get<Repository<Reservation>>(getRepositoryToken(Reservation));
    lockService = module.get<ReservationLockService>(ReservationLockService);
    seatService = module.get<SeatService>(SeatService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a reservation successfully', async () => {
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockReservationRepo.findOne.mockResolvedValue(null);
      mockLockService.tryReserve.mockResolvedValue({ success: true, result: LuaScriptResult.SUCCESS });
      mockReservationRepo.create.mockReturnValue(mockReservation);
      mockReservationRepo.save.mockResolvedValue(mockReservation);
      mockSeatService.reserveSeat.mockResolvedValue(mockSeat);

      const result = await service.create('user-123', 1);
      expect(result).toEqual(mockReservation);
      expect(mockSeatService.reserveSeat).toHaveBeenCalled();
    });

    it('should throw if seat is not free', async () => {
      const busySeat = { ...mockSeat, status: SeatStatus.RESERVED };
      mockSeatService.findById.mockResolvedValue(busySeat);

      await expect(service.create('user-123', 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if user already has pending reservation', async () => {
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockReservationRepo.findOne.mockResolvedValue(mockReservation);

      await expect(service.create('user-123', 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if lock fails with SEAT_RESERVED', async () => {
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockReservationRepo.findOne.mockResolvedValue(null);
      mockLockService.tryReserve.mockResolvedValue({ success: false, result: LuaScriptResult.SEAT_RESERVED });

      await expect(service.create('user-123', 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if lock fails with USER_HAS_RESERVATION', async () => {
      mockSeatService.findById.mockResolvedValue(mockSeat);
      mockReservationRepo.findOne.mockResolvedValue(null);
      mockLockService.tryReserve.mockResolvedValue({ success: false, result: LuaScriptResult.USER_HAS_RESERVATION });

      await expect(service.create('user-123', 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel reservation successfully', async () => {
      mockReservationRepo.findOne.mockResolvedValue({ ...mockReservation });
      mockReservationRepo.save.mockImplementation(async (r) => r);
      mockLockService.releaseReservation.mockResolvedValue(undefined);
      mockSeatService.releaseSeat.mockResolvedValue(mockSeat);

      await service.cancel('reservation-uuid-1', 'user-123');
      expect(mockLockService.releaseReservation).toHaveBeenCalled();
      expect(mockSeatService.releaseSeat).toHaveBeenCalled();
    });

    it('should throw if reservation not found', async () => {
      mockReservationRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not owner', async () => {
      mockReservationRepo.findOne.mockResolvedValue(mockReservation);
      await expect(service.cancel('reservation-uuid-1', 'other-user')).rejects.toThrow(BadRequestException);
    });

    it('should throw if reservation is not PENDING', async () => {
      const activeReservation = { ...mockReservation, status: ReservationStatus.ACTIVE };
      mockReservationRepo.findOne.mockResolvedValue(activeReservation);
      await expect(service.cancel('reservation-uuid-1', 'user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkin', () => {
    it('should checkin successfully', async () => {
      mockReservationRepo.findOne.mockResolvedValue({ ...mockReservation });
      mockReservationRepo.save.mockImplementation(async (r) => r);
      mockSeatService.updateStatus.mockResolvedValue(mockSeat);

      const result = await service.checkin('reservation-uuid-1', 'user-123');
      expect(result.status).toBe(ReservationStatus.ACTIVE);
      expect(result.checkedInAt).toBeDefined();
      expect(mockSeatService.updateStatus).toHaveBeenCalled();
    });

    it('should throw if reservation not found', async () => {
      mockReservationRepo.findOne.mockResolvedValue(null);
      await expect(service.checkin('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not owner', async () => {
      mockReservationRepo.findOne.mockResolvedValue(mockReservation);
      await expect(service.checkin('reservation-uuid-1', 'other-user')).rejects.toThrow(BadRequestException);
    });

    it('should throw if reservation is not PENDING', async () => {
      const completedReservation = { ...mockReservation, status: ReservationStatus.COMPLETED };
      mockReservationRepo.findOne.mockResolvedValue(completedReservation);
      await expect(service.checkin('reservation-uuid-1', 'user-123')).rejects.toThrow(BadRequestException);
    });

    it('should expire reservation if past expiry time', async () => {
      const expiredReservation = { ...mockReservation, expiresAt: new Date(Date.now() - 1000) };
      mockReservationRepo.findOne.mockResolvedValue(expiredReservation);
      mockReservationRepo.update.mockResolvedValue({ affected: 1 });
      mockLockService.releaseReservation.mockResolvedValue(undefined);
      mockSeatService.releaseSeat.mockResolvedValue(mockSeat);
      mockUserService.deductCreditScore.mockResolvedValue({ creditScore: 85 });

      await expect(service.checkin('reservation-uuid-1', 'user-123')).rejects.toThrow(BadRequestException);
      expect(mockLockService.releaseReservation).toHaveBeenCalled();
      expect(mockUserService.deductCreditScore).toHaveBeenCalledWith('user-123', ViolationType.NO_SHOW, {
        reservationId: 'reservation-uuid-1',
      });
      expect(mockSeatGateway.emitReservationExpired).toHaveBeenCalledWith('user-123', 'reservation-uuid-1', 1);
    });
  });

  describe('getCurrent', () => {
    it('should return current reservation', async () => {
      mockReservationRepo.findOne.mockResolvedValue(mockReservation);
      const result = await service.getCurrent('user-123');
      expect(result).toEqual(service.toResponse(mockReservation));
    });

    it('should return null if no current reservation', async () => {
      mockReservationRepo.findOne.mockResolvedValue(null);
      const result = await service.getCurrent('user-123');
      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return paginated history', async () => {
      mockReservationRepo.findAndCount.mockResolvedValue([[mockReservation], 1]);
      const result = await service.getHistory('user-123', 1, 10);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should handle pagination parameters', async () => {
      mockReservationRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.getHistory('user-123', 2, 5);
      expect(mockReservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('handleExpiredReservations', () => {
    it('should expire reservation, release seat and deduct credit score once', async () => {
      mockReservationRepo.find.mockResolvedValue([mockReservation]);
      mockReservationRepo.update.mockResolvedValue({ affected: 1 });
      mockLockService.releaseReservation.mockResolvedValue(undefined);
      mockSeatService.releaseSeat.mockResolvedValue(mockSeat);
      mockUserService.deductCreditScore.mockResolvedValue({ ...mockReservation.user, creditScore: 85 });

      await service.handleExpiredReservations();

      expect(mockReservationRepo.update).toHaveBeenCalledWith(
        {
          id: mockReservation.id,
          status: ReservationStatus.PENDING,
        },
        {
          status: ReservationStatus.EXPIRED,
        },
      );
      expect(mockLockService.releaseReservation).toHaveBeenCalled();
      expect(mockSeatService.releaseSeat).toHaveBeenCalled();
      expect(mockUserService.deductCreditScore).toHaveBeenCalledWith('user-123', ViolationType.NO_SHOW, {
        reservationId: 'reservation-uuid-1',
      });
      expect(mockSeatGateway.emitReservationExpired).toHaveBeenCalledWith('user-123', 'reservation-uuid-1', 1);
    });

    it('should skip timeout side effects when reservation already processed', async () => {
      mockReservationRepo.find.mockResolvedValue([mockReservation]);
      mockReservationRepo.update.mockResolvedValue({ affected: 0 });

      await service.handleExpiredReservations();

      expect(mockLockService.releaseReservation).not.toHaveBeenCalled();
      expect(mockSeatService.releaseSeat).not.toHaveBeenCalled();
      expect(mockUserService.deductCreditScore).not.toHaveBeenCalled();
      expect(mockSeatGateway.emitReservationExpired).not.toHaveBeenCalled();
    });
  });

  describe('toResponse', () => {
    it('should return formatted reservation response', () => {
      const result = service.toResponse(mockReservation);
      expect(result).toEqual({
        id: mockReservation.id,
        seatId: mockReservation.seatId,
        seatNumber: mockReservation.seat.seatNumber,
        area: mockReservation.seat.area,
        status: mockReservation.status,
        reservedAt: mockReservation.reservedAt,
        expiresAt: mockReservation.expiresAt,
        checkedInAt: mockReservation.checkedInAt,
      });
    });
  });
});
