import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatisticsService } from './statistics.service';
import { SeatUsageStatistic } from '../entities/seat-usage.entity';
import { SeatStatusLog } from '../../seat/entities/seat-status-log.entity';
import { SeatStatus } from '../../seat/enums/seat-status.enum';

const mockUsageStat: SeatUsageStatistic = {
  id: 'stat-uuid-1',
  seatId: 1,
  seatNumber: 'A-01',
  area: 'A区',
  date: '2026-04-19',
  totalMinutes: 480,
  usageRate: 0.75,
  peakHours: [9, 10, 14, 15],
  reservationCount: 5,
  checkinCount: 4,
  noShowCount: 1,
  avgDuration: 120,
  createdAt: new Date(),
};

const mockLog: SeatStatusLog = {
  id: 'log-uuid-1',
  seatId: 1,
  seat: { id: 1, area: 'A区', seatNumber: 'A-01', status: SeatStatus.FREE, deviceId: null, latitude: null, longitude: null, floor: '1楼', building: '图书馆', attributes: null, currentUserId: null, reservedUntil: null, statusLogs: [], createdAt: new Date(), updatedAt: new Date() },
  previousStatus: SeatStatus.FREE,
  currentStatus: SeatStatus.IN_USE,
  trigger: null,
  userId: 'user-123',
  metadata: null,
  createdAt: new Date(),
};

describe('StatisticsService', () => {
  let service: StatisticsService;
  let usageRepo: Repository<SeatUsageStatistic>;
  let statusLogRepo: Repository<SeatStatusLog>;

  const mockUsageRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockUsageStat]),
      getOne: jest.fn().mockResolvedValue(mockUsageStat),
    })),
    upsert: jest.fn(),
  };

  const mockStatusLogRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: getRepositoryToken(SeatUsageStatistic), useValue: mockUsageRepo },
        { provide: getRepositoryToken(SeatStatusLog), useValue: mockStatusLogRepo },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    usageRepo = module.get<Repository<SeatUsageStatistic>>(getRepositoryToken(SeatUsageStatistic));
    statusLogRepo = module.get<Repository<SeatStatusLog>>(getRepositoryToken(SeatStatusLog));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSeatStatistics', () => {
    it('should return seat statistics', async () => {
      const result = await service.getSeatStatistics({
        startDate: '2026-04-01',
        endDate: '2026-04-19',
      });
      expect(result).toEqual([mockUsageStat]);
    });

    it('should filter by area', async () => {
      const result = await service.getSeatStatistics({
        startDate: '2026-04-01',
        endDate: '2026-04-19',
        area: 'A区',
      });
      expect(result).toEqual([mockUsageStat]);
    });

    it('should filter by seatId', async () => {
      const result = await service.getSeatStatistics({
        startDate: '2026-04-01',
        endDate: '2026-04-19',
        seatId: 1,
      });
      expect(result).toEqual([mockUsageStat]);
    });
  });

  describe('getAreaHeatmap', () => {
    it('should return heatmap data', async () => {
      const result = await service.getAreaHeatmap('2026-04-19');
      expect(result).toEqual([mockUsageStat]);
    });

    it('should filter by area', async () => {
      const result = await service.getAreaHeatmap('2026-04-19', 'A区');
      expect(result).toEqual([mockUsageStat]);
    });
  });

  describe('generateDailyStatistics', () => {
    it('should generate statistics for a date', async () => {
      mockStatusLogRepo.find.mockResolvedValue([mockLog]);
      mockUsageRepo.upsert.mockResolvedValue(undefined);

      await service.generateDailyStatistics('2026-04-19');
      expect(mockStatusLogRepo.find).toHaveBeenCalled();
      expect(mockUsageRepo.upsert).toHaveBeenCalled();
    });

    it('should handle empty logs', async () => {
      mockStatusLogRepo.find.mockResolvedValue([]);
      await service.generateDailyStatistics('2026-04-19');
      expect(mockUsageRepo.upsert).not.toHaveBeenCalled();
    });
  });
});
