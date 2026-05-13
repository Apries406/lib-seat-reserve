import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as QRCode from 'qrcode';
import { Seat } from '../entities/seat.entity';
import { SeatStatusLog } from '../entities/seat-status-log.entity';
import { SeatStatus, StatusTrigger } from '../enums/seat-status.enum';
import { SeatGateway } from '../../websocket/seat.gateway';
import { MqttService } from '../../device/services/mqtt.service';
import { QrCodeService } from './qr-code.service';

@Injectable()
export class SeatService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(SeatStatusLog)
    private readonly logRepo: Repository<SeatStatusLog>,
    private readonly seatGateway: SeatGateway,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
    private readonly qrCodeService: QrCodeService,
  ) {}

  async findAll(query?: { area?: string; status?: SeatStatus; attributes?: Partial<{ hasOutlet?: boolean; isQuiet?: boolean; nearWindow?: boolean }> }): Promise<Seat[]> {
    const qb = this.seatRepo.createQueryBuilder('seat');

    if (query?.area) {
      qb.andWhere('seat.area = :area', { area: query.area });
    }
    if (query?.status) {
      qb.andWhere('seat.status = :status', { status: query.status });
    }
    if (query?.attributes) {
      const { hasOutlet, isQuiet, nearWindow } = query.attributes;
      if (hasOutlet !== undefined) {
        qb.andWhere("JSON_EXTRACT(seat.attributes, '$.hasOutlet') = :hasOutlet", { hasOutlet });
      }
      if (isQuiet !== undefined) {
        qb.andWhere("JSON_EXTRACT(seat.attributes, '$.isQuiet') = :isQuiet", { isQuiet });
      }
      if (nearWindow !== undefined) {
        qb.andWhere("JSON_EXTRACT(seat.attributes, '$.nearWindow') = :nearWindow", { nearWindow });
      }
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
      seat.lastFreedAt = new Date();
    }
    if (newStatus === SeatStatus.TEMP_LEAVE) {
      seat.tempLeaveAt = new Date();
    }
    if (newStatus === SeatStatus.IN_JUDGE) {
      seat.judgeExpiresAt = new Date(Date.now() + 60 * 1000);
    }
    if (newStatus !== SeatStatus.IN_JUDGE) {
      seat.judgeExpiresAt = null;
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
    this.publishDisplay(seat);

    return seat;
  }

  async reserveSeat(seatId: number, userId: string, expiresAt: Date): Promise<Seat> {
    const seat = await this.findById(seatId);

    if (seat.status !== SeatStatus.FREE) {
      throw new BadRequestException('座位已被占用，无法预约');
    }

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
    this.publishDisplay(seat);

    return seat;
  }

  async releaseSeat(seatId: number, trigger: StatusTrigger): Promise<Seat> {
    const seat = await this.findById(seatId);
    const previousStatus = seat.status;

    seat.status = SeatStatus.FREE;
    seat.currentUserId = null;
    seat.reservedUntil = null;
    seat.tempLeaveAt = null;
    seat.lastFreedAt = new Date();

    await this.seatRepo.save(seat);

    await this.logRepo.save({
      seatId,
      previousStatus,
      currentStatus: SeatStatus.FREE,
      trigger,
    });

    this.seatGateway.emitSeatStatusChange(seatId, SeatStatus.FREE);
    this.publishDisplay(seat);

    return seat;
  }

  private async publishDisplay(seat: Seat) {
    if (!seat.deviceId) {
      return;
    }
    const qrToken = seat.status === SeatStatus.RESERVED || seat.status === SeatStatus.IN_USE
      ? this.qrCodeService.generateSeatQrToken(seat.id)
      : undefined;
    const expiresIn = seat.reservedUntil
      ? Math.max(0, Math.floor((seat.reservedUntil.getTime() - Date.now()) / 1000))
      : undefined;

    if (qrToken) {
      try {
        const asciiQr = await QRCode.toString(qrToken, { type: 'terminal', small: true });
        console.log(`\n========== 座位 #${seat.seatNumber} 签到二维码 ==========`);
        console.log(asciiQr);
        console.log(`Token: ${qrToken}`);
        console.log(`过期: ${expiresIn ?? 'N/A'} 秒`);
        console.log('===========================================\n');
      } catch (err) {
        console.log(`[QR] seat #${seat.seatNumber} token: ${qrToken}`);
      }
    }

    this.mqttService.publishDisplay(seat.deviceId, {
      status: seat.status,
      seatNumber: seat.seatNumber,
      qrToken,
      expiresIn,
    });
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
