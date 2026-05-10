import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SensorProcessorService } from './sensor-processor.service';
import { SeatService } from '../../seat/services/seat.service';
import { Redis } from 'ioredis';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { Reservation } from '../../reservation/entities/reservation.entity';

const mockSeat = {
  id: 1,
  area: 'A区',
  seatNumber: 'A-01',
  status: SeatStatus.IN_USE,
  deviceId: 'device-001',
  latitude: null,
  longitude: null,
  floor: '1楼',
  building: '图书馆',
  attributes: null,
  currentUserId: 'user-123',
  reservedUntil: null,
  statusLogs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRedis = {
  lpush: jest.fn(),
  ltrim: jest.fn(),
  expire: jest.fn(),
  lrange: jest.fn(),
  del: jest.fn(),
};

const mockSeatService = {
  findByDeviceId: jest.fn(),
  updateStatus: jest.fn(),
  findById: jest.fn(),
};

const mockReservationRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

describe('SensorProcessorService', () => {
  let service: SensorProcessorService;
  let seatService: SeatService;
  let redis: Redis;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SensorProcessorService,
        { provide: SeatService, useValue: mockSeatService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: getRepositoryToken(Reservation), useValue: mockReservationRepo },
      ],
    }).compile();

    service = module.get<SensorProcessorService>(SensorProcessorService);
    seatService = module.get<SeatService>(SeatService);
    redis = module.get<Redis>('REDIS_CLIENT');
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('process', () => {
    it('should process sensor data when seat exists', async () => {
      mockSeatService.findByDeviceId.mockResolvedValue(mockSeat);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.lrange.mockResolvedValue([]);

      await service.process('device-001', {
        sensor: { type: 'infrared' as const, value: true, confidence: 0.9 },
        timestamp: Date.now(),
      });
      expect(mockSeatService.findByDeviceId).toHaveBeenCalledWith('device-001');
    });

    it('should skip if device not associated with seat', async () => {
      mockSeatService.findByDeviceId.mockResolvedValue(null);
      await service.process('unknown-device', {
        sensor: { type: 'infrared' as const, value: true, confidence: 0.9 },
        timestamp: Date.now(),
      });
      expect(mockSeatService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('recordObservation', () => {
    it('should record observation in Redis', async () => {
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      await service.recordObservation(1, true);
      expect(mockRedis.lpush).toHaveBeenCalled();
      expect(mockRedis.ltrim).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('judgeLeave', () => {
    it('should return true if empty ratio exceeds threshold', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - i * 30000,
        isOccupied: i >= 8,
      }));
      mockRedis.lrange.mockResolvedValue(observations.map(o => JSON.stringify(o)));

      const result = await service.judgeLeave(1);
      expect(result).toBe(true);
    });

    it('should return false if empty ratio is below threshold', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - i * 30000,
        isOccupied: i < 8,
      }));
      mockRedis.lrange.mockResolvedValue(observations.map(o => JSON.stringify(o)));

      const result = await service.judgeLeave(1);
      expect(result).toBe(false);
    });

    it('should return false if no observations', async () => {
      mockRedis.lrange.mockResolvedValue([]);
      const result = await service.judgeLeave(1);
      expect(result).toBe(false);
    });
  });

  describe('judgeReturn', () => {
    it('should return true if occupied ratio exceeds threshold', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - i * 30000,
        isOccupied: i < 8,
      }));
      mockRedis.lrange.mockResolvedValue(observations.map(o => JSON.stringify(o)));

      const result = await service.judgeReturn(1);
      expect(result).toBe(true);
    });

    it('should return false if occupied ratio is below threshold', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - i * 30000,
        isOccupied: i >= 8,
      }));
      mockRedis.lrange.mockResolvedValue(observations.map(o => JSON.stringify(o)));

      const result = await service.judgeReturn(1);
      expect(result).toBe(false);
    });

    it('should return false if no observations', async () => {
      mockRedis.lrange.mockResolvedValue([]);
      const result = await service.judgeReturn(1);
      expect(result).toBe(false);
    });
  });
});
