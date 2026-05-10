import { Controller, Get, Param, Query, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SeatService } from '../services/seat.service';
import { QrCodeService } from '../services/qr-code.service';
import { SeatStatus } from '../enums/seat-status.enum';

@ApiTags('座位')
@Controller('seats')
export class SeatController {
  constructor(
    private readonly seatService: SeatService,
    private readonly qrCodeService: QrCodeService,
  ) {}

  @Get('areas')
  @ApiOperation({ summary: '获取区域列表' })
  async getAreas() {
    const areas = await this.seatService.getAreas();
    return {
      code: 0,
      data: areas.map((a) => ({
        id: a.area,
        name: `${a.area}区`,
        seatCount: a.total,
        availableCount: a.available,
      })),
    };
  }

  @Get()
  @ApiOperation({ summary: '获取座位列表' })
  @ApiQuery({ name: 'area', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SeatStatus })
  @ApiQuery({ name: 'hasOutlet', required: false })
  @ApiQuery({ name: 'isQuiet', required: false })
  @ApiQuery({ name: 'nearWindow', required: false })
  async getSeats(
    @Query('area') area?: string,
    @Query('status') status?: SeatStatus,
    @Query('hasOutlet', new ParseBoolPipe({ optional: true })) hasOutlet?: boolean,
    @Query('isQuiet', new ParseBoolPipe({ optional: true })) isQuiet?: boolean,
    @Query('nearWindow', new ParseBoolPipe({ optional: true })) nearWindow?: boolean,
  ) {
    const attributes = { hasOutlet, isQuiet, nearWindow };
    const seats = await this.seatService.findAll({ area, status, attributes });
    return {
      code: 0,
      data: seats.map((s) => this.seatService.toResponse(s)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取座位详情' })
  async getSeat(@Param('id', ParseIntPipe) id: number) {
    const seat = await this.seatService.findById(id);
    return {
      code: 0,
      data: this.seatService.toResponse(seat),
    };
  }

  @Get(':id/qr-code')
  @ApiOperation({ summary: '获取座位二维码内容（供打印）' })
  async getSeatQrCode(@Param('id', ParseIntPipe) id: number) {
    const seat = await this.seatService.findById(id);
    const qrToken = this.qrCodeService.generateSeatQrToken(seat.id);
    return {
      code: 0,
      data: {
        seatId: seat.id,
        area: seat.area,
        seatNumber: seat.seatNumber,
        qrToken,
      },
    };
  }
}
