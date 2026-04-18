import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StatisticsService } from '../services/statistics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('统计')
@Controller('statistics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('seats')
  @ApiOperation({ summary: '获取座位使用统计' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'area', required: false })
  async getSeatStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('area') area?: string,
  ) {
    const data = await this.statisticsService.getSeatStatistics({
      startDate,
      endDate,
      area,
    });
    return { code: 0, data };
  }

  @Get('heatmap')
  @ApiOperation({ summary: '获取区域热力图' })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'area', required: false })
  async getHeatmap(@Query('date') date: string, @Query('area') area?: string) {
    const data = await this.statisticsService.getAreaHeatmap(date, area);
    return { code: 0, data };
  }
}
