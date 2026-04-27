import { Test, TestingModule } from '@nestjs/testing';
import { ReservationLockService, LuaScriptResult } from './reservation-lock.service';
import { Redis } from 'ioredis';

const mockRedis = {
  eval: jest.fn(),
  pipeline: jest.fn(),
  get: jest.fn(),
  ttl: jest.fn(),
};

describe('ReservationLockService', () => {
  let service: ReservationLockService;
  let redis: Redis;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationLockService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ReservationLockService>(ReservationLockService);
    redis = module.get<Redis>('REDIS_CLIENT');
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('tryReserve', () => {
    it('should return success when reservation succeeds', async () => {
      mockRedis.eval.mockResolvedValue(LuaScriptResult.SUCCESS);
      const result = await service.tryReserve(1, 'user-123');
      expect(result.success).toBe(true);
      expect(result.result).toBe(LuaScriptResult.SUCCESS);
    });

    it('should return failure when seat is locked', async () => {
      mockRedis.eval.mockResolvedValue(LuaScriptResult.SEAT_LOCKED);
      const result = await service.tryReserve(1, 'user-123');
      expect(result.success).toBe(false);
      expect(result.result).toBe(LuaScriptResult.SEAT_LOCKED);
    });

    it('should return failure when seat is reserved', async () => {
      mockRedis.eval.mockResolvedValue(LuaScriptResult.SEAT_RESERVED);
      const result = await service.tryReserve(1, 'user-123');
      expect(result.success).toBe(false);
      expect(result.result).toBe(LuaScriptResult.SEAT_RESERVED);
    });

    it('should return failure when user has reservation', async () => {
      mockRedis.eval.mockResolvedValue(LuaScriptResult.USER_HAS_RESERVATION);
      const result = await service.tryReserve(1, 'user-123');
      expect(result.success).toBe(false);
      expect(result.result).toBe(LuaScriptResult.USER_HAS_RESERVATION);
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation keys', async () => {
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await service.releaseReservation(1, 'user-123');
      expect(mockPipeline.del).toHaveBeenCalledTimes(3);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('isSeatAvailable', () => {
    it('should return true if seat is available', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.isSeatAvailable(1);
      expect(result).toBe(true);
    });

    it('should return false if seat is reserved', async () => {
      mockRedis.get.mockResolvedValue('user-456');
      const result = await service.isSeatAvailable(1);
      expect(result).toBe(false);
    });
  });

  describe('getRemainingTTL', () => {
    it('should return TTL value', async () => {
      mockRedis.ttl.mockResolvedValue(1800);
      const result = await service.getRemainingTTL(1);
      expect(result).toBe(1800);
    });

    it('should return -1 if key does not exist', async () => {
      mockRedis.ttl.mockResolvedValue(-1);
      const result = await service.getRemainingTTL(1);
      expect(result).toBe(-1);
    });
  });
});
