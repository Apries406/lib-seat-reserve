import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService, ViolationType } from './user.service';
import { User, CreditScoreLevel } from '../entities/user.entity';
import { NotFoundException } from '@nestjs/common';

const mockUser: User = {
  id: 'test-uuid-1234',
  openId: 'openid_test',
  nickname: 'Test User',
  avatar: 'https://avatar.com/test.jpg',
  creditScore: 100,
  violationCount: 0,
  lastViolationAt: null,
  deviceFingerprint: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  get creditLevel() { return CreditScoreLevel.EXCELLENT; },
  get canReserve() { return this.creditScore >= 65; },
};

describe('UserService', () => {
  let service: UserService;
  let repo: Repository<User>;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByOpenId', () => {
    it('should return user if found', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findByOpenId('openid_test');
      expect(result).toEqual(mockUser);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { openId: 'openid_test' } });
    });

    it('should return null if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findByOpenId('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findById('test-uuid-1234');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createOrUpdate', () => {
    it('should create new user if not exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockUser);
      mockRepo.save.mockResolvedValue(mockUser);

      const result = await service.createOrUpdate('new_openid', 'New User', 'avatar.jpg');
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should update existing user', async () => {
      const existingUser = { ...mockUser, nickname: 'Old Name' };
      mockRepo.findOne.mockResolvedValue(existingUser);
      mockRepo.save.mockImplementation(async (u) => u);

      const result = await service.createOrUpdate('openid_test', 'New Name', 'new_avatar.jpg');
      expect(result.nickname).toBe('New Name');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should update user without avatar if not provided', async () => {
      const existingUser = { ...mockUser, avatar: 'old_avatar.jpg' };
      mockRepo.findOne.mockResolvedValue(existingUser);
      mockRepo.save.mockImplementation(async (u) => u);

      const result = await service.createOrUpdate('openid_test', 'New Name');
      expect(result.avatar).toBe('old_avatar.jpg');
    });
  });

  describe('deductCreditScore', () => {
    it('should deduct credit score for violation', async () => {
      const userWithScore = { ...mockUser, creditScore: 80, violationCount: 0 };
      mockRepo.findOne.mockResolvedValue(userWithScore);
      mockRepo.save.mockImplementation(async (u) => u);

      const result = await service.deductCreditScore('test-uuid-1234', ViolationType.NO_SHOW);
      expect(result.creditScore).toBe(65); // 80 - 15
      expect(result.violationCount).toBe(1);
      expect(result.lastViolationAt).toBeDefined();
    });

    it('should not go below 0', async () => {
      const userWithLowScore = { ...mockUser, creditScore: 5, violationCount: 0 };
      mockRepo.findOne.mockResolvedValue(userWithLowScore);
      mockRepo.save.mockImplementation(async (u) => u);

      const result = await service.deductCreditScore('test-uuid-1234', ViolationType.NO_SHOW);
      expect(result.creditScore).toBe(0); // max(0, 5 - 15) = 0
    });

    it('should deduct correct score for each violation type', async () => {
      const violations = [
        { type: ViolationType.NO_SHOW, expected: -15 },
        { type: ViolationType.CHECKIN_NO_PERSON, expected: -10 },
        { type: ViolationType.LONG_LEAVE, expected: -5 },
        { type: ViolationType.REMOTE_CHECKIN, expected: -3 },
      ];

      for (const { type, expected } of violations) {
        const user = { ...mockUser, creditScore: 100, violationCount: 0 };
        mockRepo.findOne.mockResolvedValue(user);
        mockRepo.save.mockImplementation(async (u) => u);

        const result = await service.deductCreditScore('test-uuid-1234', type);
        expect(result.creditScore).toBe(100 + expected);
      }
    });
  });

  describe('toResponse', () => {
    it('should return formatted user response', () => {
      const result = service.toResponse(mockUser);
      expect(result).toEqual({
        id: mockUser.id,
        nickname: mockUser.nickname,
        avatar: mockUser.avatar,
        creditScore: mockUser.creditScore,
        creditLevel: mockUser.creditLevel,
        canReserve: mockUser.canReserve,
      });
    });

    it('should indicate canReserve is false when score below 65', () => {
      const lowScoreUser = Object.create(mockUser, { creditScore: { value: 60 } });
      Object.defineProperty(lowScoreUser, 'canReserve', { get() { return this.creditScore >= 65; } });
      const result = service.toResponse(lowScoreUser);
      expect(result.canReserve).toBe(false);
    });

    it('should indicate canReserve is true when score >= 65', () => {
      const highScoreUser = Object.create(mockUser, { creditScore: { value: 65 } });
      Object.defineProperty(highScoreUser, 'canReserve', { get() { return this.creditScore >= 65; } });
      const result = service.toResponse(highScoreUser);
      expect(result.canReserve).toBe(true);
    });
  });
});
