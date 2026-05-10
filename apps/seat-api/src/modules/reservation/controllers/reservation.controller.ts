import { Controller, Post, Delete, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReservationService } from '../services/reservation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IsNumber, IsNotEmpty } from 'class-validator';

class CreateReservationDto {
  @IsNumber()
  @IsNotEmpty()
  seatId: number;
}

@ApiTags('预约')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  @ApiOperation({ summary: '创建预约' })
  async create(@Request() req, @Body() dto: CreateReservationDto) {
    const reservation = await this.reservationService.create(req.user.userId, dto.seatId);
    return {
      code: 0,
      message: '预约成功',
      data: this.reservationService.toResponse(reservation),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: '取消预约' })
  async cancel(@Request() req, @Param('id') id: string) {
    await this.reservationService.cancel(id, req.user.userId);
    return { code: 0, message: '已取消' };
  }

  @Get('current')
  @ApiOperation({ summary: '获取当前预约' })
  async getCurrent(@Request() req) {
    const reservation = await this.reservationService.getCurrent(req.user.userId);
    return {
      code: 0,
      data: reservation,
    };
  }

  @Get('history')
  @ApiOperation({ summary: '预约历史' })
  async getHistory(@Request() req, @Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    const result = await this.reservationService.getHistory(req.user.userId, page, limit);
    return {
      code: 0,
      data: result,
    };
  }
}
