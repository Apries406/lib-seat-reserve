import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SeatService } from '../services/seat.service';
import { SeatStatus } from '../enums/seat-status.enum';

@ApiTags('座位')
@Controller('seats')
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

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
  async getSeats(
    @Query('area') area?: string,
    @Query('status') status?: SeatStatus,
  ) {
    const seats = await this.seatService.findAll({ area, status });
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
}
