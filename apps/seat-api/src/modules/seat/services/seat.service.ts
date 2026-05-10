import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Seat } from '../entities/seat.entity';
import { SeatStatusLog } from '../entities/seat-status-log.entity';
import { SeatStatus, StatusTrigger } from '../enums/seat-status.enum';
import { SeatGateway } from '../../websocket/seat.gateway';

@Injectable()
export class SeatService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(SeatStatusLog)
    private readonly logRepo: Repository<SeatStatusLog>,
    private readonly seatGateway: SeatGateway,
  ) {}

  async findAll(query?: { area?: string; status?: SeatStatus }): Promise<Seat[]> {
    const qb = this.seatRepo.createQueryBuilder('seat');
    
    if (query?.area) {
      qb.andWhere('seat.area = :area', { area: query.area });
    }
    if (query?.status) {
      qb.andWhere('seat.status = :status', { status: query.status });
    }
    
    return qb.orderBy('seat.area', 'ASC').addOrderBy('seat.seatNumber', 'ASC').getMany();
  }

  async findById(id: number): Promise<Seat> {
    const seat = await this.seatRepo.findOne({ where: { id } });
    if (!seat) throw new NotFoundException('座位不存在');
    return seat;
  }

  async findByDeviceId(deviceId: string): Promise<Seat | null> {
    return this.seatRepo.findOne({ where: { deviceId } });
  }

  async findTempLeaveSeats(): Promise<Seat[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.seatRepo.find({
      where: {
        status: SeatStatus.TEMP_LEAVE,
        tempLeaveAt: LessThan(oneHourAgo),
      },
    });
  }

  async getAreas(): Promise<{ area: string; total: number; available: number }[]> {
    const result = await this.seatRepo
      .createQueryBuilder('seat')
      .select('seat.area', 'area')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN seat.status = 'FREE' THEN 1 ELSE 0 END)`,
        'available',
      )
      .groupBy('seat.area')
      .getRawMany();

    return result.map((r) => ({
      area: r.area,
      total: parseInt(r.total),
      available: parseInt(r.available),
    }));
  }

  async updateStatus(
    seatId: number,
    newStatus: SeatStatus,
    trigger: StatusTrigger,
    userId?: string,
  ): Promise<Seat> {
    const seat = await this.findById(seatId);
    const previousStatus = seat.status;

    seat.status = newStatus;
    if (userId) seat.currentUserId = userId;
    if (newStatus === SeatStatus.FREE) {
      seat.currentUserId = null;
      seat.reservedUntil = null;
      seat.tempLeaveAt = null;
    }
    if (newStatus === SeatStatus.TEMP_LEAVE) {
      seat.tempLeaveAt = new Date();
    }

    await this.seatRepo.save(seat);

    await this.logRepo.save({
      seatId,
      previousStatus,
      currentStatus: newStatus,
      trigger,
      userId,
    });

    this.seatGateway.emitSeatStatusChange(seatId, newStatus);

    return seat;
  }

  async reserveSeat(seatId: number, userId: string, expiresAt: Date): Promise<Seat> {
    const seat = await this.findById(seatId);
    
    seat.status = SeatStatus.RESERVED;
    seat.currentUserId = userId;
    seat.reservedUntil = expiresAt;

    await this.seatRepo.save(seat);

    await this.logRepo.save({
      seatId,
      previousStatus: SeatStatus.FREE,
      currentStatus: SeatStatus.RESERVED,
      trigger: StatusTrigger.RESERVE,
      userId,
    });

    this.seatGateway.emitSeatStatusChange(seatId, SeatStatus.RESERVED);

    return seat;
  }

  async releaseSeat(seatId: number, trigger: StatusTrigger): Promise<Seat> {
    const seat = await this.findById(seatId);
    const previousStatus = seat.status;

    seat.status = SeatStatus.FREE;
    seat.currentUserId = null;
    seat.reservedUntil = null;

    await this.seatRepo.save(seat);

    await this.logRepo.save({
      seatId,
      previousStatus,
      currentStatus: SeatStatus.FREE,
      trigger,
    });

    this.seatGateway.emitSeatStatusChange(seatId, SeatStatus.FREE);

    return seat;
  }

  toResponse(seat: Seat) {
    return {
      id: seat.id,
      area: seat.area,
      seatNumber: seat.seatNumber,
      status: seat.status,
      attributes: seat.attributes,
      reservedUntil: seat.reservedUntil,
      currentUserId: seat.currentUserId,
    };
  }
}
