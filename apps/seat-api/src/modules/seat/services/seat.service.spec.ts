import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatService } from './seat.service';
import { Seat } from '../entities/seat.entity';
import { SeatStatusLog } from '../entities/seat-status-log.entity';
import { SeatStatus, StatusTrigger } from '../enums/seat-status.enum';
import { NotFoundException } from '@nestjs/common';
import { SeatGateway } from '../../websocket/seat.gateway';

const mockSeat: Seat = {
  id: 1,
  area: 'A区',
  seatNumber: 'A-01',
  status: SeatStatus.FREE,
  deviceId: 'device-001',
  latitude: null,
  longitude: null,
  floor: '1楼',
  building: '图书馆',
  attributes: { hasOutlet: true, isQuiet: true, nearWindow: false },
  currentUserId: null,
  reservedUntil: null,
  statusLogs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLog: SeatStatusLog = {
  id: 'log-uuid-1',
  seatId: 1,
  seat: mockSeat,
  previousStatus: SeatStatus.FREE,
  currentStatus: SeatStatus.RESERVED,
  trigger: StatusTrigger.RESERVE,
  userId: 'user-123',
  metadata: null,
  createdAt: new Date(),
};

describe('SeatService', () => {
  let service: SeatService;
  let seatRepo: Repository<Seat>;
  let logRepo: Repository<SeatStatusLog>;

  const mockSeatRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockSeat]),
      getRawMany: jest.fn().mockResolvedValue([
        { area: 'A区', total: '4', available: '3' },
        { area: 'B区', total: '3', available: '2' },
      ]),
    })),
  };

  const mockLogRepo = {
    save: jest.fn(),
  };

  const mockSeatGateway = {
    emitSeatStatusChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatService,
        { provide: getRepositoryToken(Seat), useValue: mockSeatRepo },
        { provide: getRepositoryToken(SeatStatusLog), useValue: mockLogRepo },
        { provide: SeatGateway, useValue: mockSeatGateway },
      ],
    }).compile();

    service = module.get<SeatService>(SeatService);
    seatRepo = module.get<Repository<Seat>>(getRepositoryToken(Seat));
    logRepo = module.get<Repository<SeatStatusLog>>(getRepositoryToken(SeatStatusLog));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all seats', async () => {
      mockSeatRepo.createQueryBuilder().getMany.mockResolvedValue([mockSeat]);
      const result = await service.findAll();
      expect(result).toEqual([mockSeat]);
    });

    it('should filter by area', async () => {
      mockSeatRepo.createQueryBuilder().getMany.mockResolvedValue([mockSeat]);
      const result = await service.findAll({ area: 'A区' });
      expect(result).toEqual([mockSeat]);
    });

    it('should filter by status', async () => {
      mockSeatRepo.createQueryBuilder().getMany.mockResolvedValue([mockSeat]);
      const result = await service.findAll({ status: SeatStatus.FREE });
      expect(result).toEqual([mockSeat]);
    });
  });

  describe('findById', () => {
    it('should return seat if found', async () => {
      mockSeatRepo.findOne.mockResolvedValue(mockSeat);
      const result = await service.findById(1);
      expect(result).toEqual(mockSeat);
    });

    it('should throw NotFoundException if seat not found', async () => {
      mockSeatRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByDeviceId', () => {
    it('should return seat by device id', async () => {
      mockSeatRepo.findOne.mockResolvedValue(mockSeat);
      const result = await service.findByDeviceId('device-001');
      expect(result).toEqual(mockSeat);
    });

    it('should return null if device not found', async () => {
      mockSeatRepo.findOne.mockResolvedValue(null);
      const result = await service.findByDeviceId('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getAreas', () => {
    it('should return area statistics', async () => {
      const result = await service.getAreas();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ area: 'A区', total: 4, available: 3 });
      expect(result[1]).toEqual({ area: 'B区', total: 3, available: 2 });
    });
  });

  describe('updateStatus', () => {
    it('should update seat status and create log', async () => {
      mockSeatRepo.findOne.mockResolvedValue({ ...mockSeat });
      mockSeatRepo.save.mockImplementation(async (s) => s);
      mockLogRepo.save.mockResolvedValue(mockLog);

      const result = await service.updateStatus(1, SeatStatus.RESERVED, StatusTrigger.RESERVE, 'user-123');
      expect(result.status).toBe(SeatStatus.RESERVED);
      expect(result.currentUserId).toBe('user-123');
      expect(mockLogRepo.save).toHaveBeenCalled();
      expect(mockSeatGateway.emitSeatStatusChange).toHaveBeenCalledWith(1, SeatStatus.RESERVED);
    });

    it('should clear currentUserId and reservedUntil when setting FREE', async () => {
      const reservedSeat = { ...mockSeat, status: SeatStatus.RESERVED, currentUserId: 'user-123', reservedUntil: new Date() };
      mockSeatRepo.findOne.mockResolvedValue(reservedSeat);
      mockSeatRepo.save.mockImplementation(async (s) => s);
      mockLogRepo.save.mockResolvedValue(mockLog);

      const result = await service.updateStatus(1, SeatStatus.FREE, StatusTrigger.RELEASE);
      expect(result.currentUserId).toBeNull();
      expect(result.reservedUntil).toBeNull();
      expect(mockSeatGateway.emitSeatStatusChange).toHaveBeenCalledWith(1, SeatStatus.FREE);
    });
  });

  describe('reserveSeat', () => {
    it('should reserve seat and create log', async () => {
      mockSeatRepo.findOne.mockResolvedValue({ ...mockSeat });
      mockSeatRepo.save.mockImplementation(async (s) => s);
      mockLogRepo.save.mockResolvedValue(mockLog);

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const result = await service.reserveSeat(1, 'user-123', expiresAt);
      expect(result.status).toBe(SeatStatus.RESERVED);
      expect(result.currentUserId).toBe('user-123');
      expect(result.reservedUntil).toBe(expiresAt);
      expect(mockSeatGateway.emitSeatStatusChange).toHaveBeenCalledWith(1, SeatStatus.RESERVED);
    });
  });

  describe('releaseSeat', () => {
    it('should release seat and create log', async () => {
      const reservedSeat = { ...mockSeat, status: SeatStatus.RESERVED, currentUserId: 'user-123' };
      mockSeatRepo.findOne.mockResolvedValue(reservedSeat);
      mockSeatRepo.save.mockImplementation(async (s) => s);
      mockLogRepo.save.mockResolvedValue(mockLog);

      const result = await service.releaseSeat(1, StatusTrigger.RELEASE);
      expect(result.status).toBe(SeatStatus.FREE);
      expect(result.currentUserId).toBeNull();
      expect(result.reservedUntil).toBeNull();
      expect(mockSeatGateway.emitSeatStatusChange).toHaveBeenCalledWith(1, SeatStatus.FREE);
    });
  });

  describe('toResponse', () => {
    it('should return formatted seat response', () => {
      const result = service.toResponse(mockSeat);
      expect(result).toEqual({
        id: mockSeat.id,
        area: mockSeat.area,
        seatNumber: mockSeat.seatNumber,
        status: mockSeat.status,
        attributes: mockSeat.attributes,
        reservedUntil: mockSeat.reservedUntil,
        currentUserId: mockSeat.currentUserId,
      });
    });
  });
});
