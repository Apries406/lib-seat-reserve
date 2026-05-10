import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { ReservationLockService, LuaScriptResult } from './reservation-lock.service';
import { SeatService } from '../../seat/services/seat.service';
import { SeatStatus, StatusTrigger } from '../../seat/enums/seat-status.enum';
import { SeatGateway } from '../../websocket/seat.gateway';
import { UserService, ViolationType } from '../../user/services/user.service';

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly lockService: ReservationLockService,
    private readonly seatService: SeatService,
    private readonly seatGateway: SeatGateway,
    private readonly userService: UserService,
  ) {}

  async create(userId: string, seatId: number): Promise<Reservation> {
    const seat = await this.seatService.findById(seatId);

    if (seat.status !== SeatStatus.FREE) {
      throw new BadRequestException('座位不可预约');
    }

    const existing = await this.reservationRepo.findOne({
      where: {
        userId,
        status: ReservationStatus.PENDING,
      },
    });

    if (existing) {
      throw new BadRequestException('您已有进行中的预约');
    }

    const { success, result } = await this.lockService.tryReserve(seatId, userId);

    if (!success) {
      switch (result) {
        case LuaScriptResult.SEAT_LOCKED:
        case LuaScriptResult.SEAT_RESERVED:
          throw new BadRequestException('座位已被预约');
        case LuaScriptResult.USER_HAS_RESERVATION:
          throw new BadRequestException('您已有其他预约');
        default:
          throw new BadRequestException('预约失败，请稍后重试');
      }
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const reservation = this.reservationRepo.create({
      userId,
      seatId,
      status: ReservationStatus.PENDING,
      reservedAt: new Date(),
      expiresAt,
    });

    await this.reservationRepo.save(reservation);
    await this.seatService.reserveSeat(seatId, userId, expiresAt);

    return reservation;
  }

  async cancel(id: string, userId: string): Promise<void> {
    const reservation = await this.findById(id);

    if (reservation.userId !== userId) {
      throw new BadRequestException('无权取消此预约');
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('预约状态不允许取消');
    }

    reservation.status = ReservationStatus.CANCELLED;
    await this.reservationRepo.save(reservation);
    await this.lockService.releaseReservation(reservation.seatId, userId);
    await this.seatService.releaseSeat(reservation.seatId, StatusTrigger.RELEASE);
  }

  async checkin(id: string, userId: string): Promise<Reservation> {
    const reservation = await this.findById(id);

    if (reservation.userId !== userId) {
      throw new BadRequestException('无权签到此预约');
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('预约状态不允许签到');
    }

    if (new Date() > reservation.expiresAt) {
      await this.expireReservation(reservation);
      throw new BadRequestException('预约已过期');
    }

    reservation.status = ReservationStatus.ACTIVE;
    reservation.checkedInAt = new Date();
    await this.reservationRepo.save(reservation);
    await this.seatService.updateStatus(reservation.seatId, SeatStatus.IN_USE, StatusTrigger.CHECKIN, userId);

    return reservation;
  }

  async getCurrent(userId: string): Promise<any> {
    const reservation = await this.reservationRepo.findOne({
      where: {
        userId,
        status: In([ReservationStatus.PENDING, ReservationStatus.ACTIVE]),
      },
      relations: ['seat'],
      order: { createdAt: 'DESC' },
    });
    if (!reservation) return null;
    return this.toResponse(reservation);
  }

  async getHistory(userId: string, page: number = 1, limit: number = 10): Promise<{ items: any[]; total: number }> {
    const [items, total] = await this.reservationRepo.findAndCount({
      where: { userId },
      relations: ['seat'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const mapped = items.map((r) => this.toResponse(r));
    return { items: mapped, total };
  }

  async handleExpiredReservations(): Promise<void> {
    const expired = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const reservation of expired) {
      await this.expireReservation(reservation);
    }
  }

  private async findById(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({ where: { id } });
    if (!reservation) throw new NotFoundException('预约不存在');
    return reservation;
  }

  private async expireReservation(
    reservation: Pick<Reservation, 'id' | 'userId' | 'seatId'>,
  ): Promise<boolean> {
    const updateResult = await this.reservationRepo.update(
      {
        id: reservation.id,
        status: ReservationStatus.PENDING,
      },
      {
        status: ReservationStatus.EXPIRED,
      },
    );

    if (!updateResult.affected) {
      return false;
    }

    await this.lockService.releaseReservation(reservation.seatId, reservation.userId);
    await this.seatService.releaseSeat(reservation.seatId, StatusTrigger.TIMEOUT);
    await this.userService.deductCreditScore(reservation.userId, ViolationType.NO_SHOW, {
      reservationId: reservation.id,
    });
    this.seatGateway.emitReservationExpired(reservation.userId, reservation.id, reservation.seatId);

    return true;
  }

  toResponse(reservation: Reservation) {
    return {
      id: reservation.id,
      seatId: reservation.seatId,
      seatNumber: reservation.seat?.seatNumber,
      area: reservation.seat?.area,
      status: reservation.status,
      reservedAt: reservation.reservedAt,
      expiresAt: reservation.expiresAt,
      checkedInAt: reservation.checkedInAt,
    };
  }
}
