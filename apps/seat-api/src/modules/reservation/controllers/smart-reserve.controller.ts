import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SmartReserveService, ISmartReservePreference } from '../services/smart-reserve.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IsBoolean, IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';

class SmartReserveDto implements ISmartReservePreference {
  @IsOptional()
  @IsBoolean()
  nearWindow?: boolean;

  @IsOptional()
  @IsBoolean()
  hasOutlet?: boolean;

  @IsOptional()
  @IsBoolean()
  isQuiet?: boolean;

  @IsOptional()
  @IsEnum(['high', 'low', 'any'] as const)
  floor?: 'high' | 'low' | 'any';

  @IsOptional()
  @IsString()
  area?: string;

  @IsBoolean()
  acceptAdjustment: boolean;
}

class SeatIdDto {
  @IsNumber()
  seatId: number;
}

@ApiTags('智能预约')
@Controller('smart-reserve')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SmartReserveController {
  constructor(private readonly smartReserveService: SmartReserveService) {}

  @Post()
  @ApiOperation({ summary: '智能预约座位（直接预约）' })
  async smartReserve(@Request() req, @Body() dto: SmartReserveDto) {
    const result = await this.smartReserveService.smartReserve(req.user.userId, dto);
    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }

  @Post('preview')
  @ApiOperation({ summary: '预览推荐座位（犹豫期锁定）' })
  async preview(@Request() req, @Body() dto: SmartReserveDto) {
    const result = await this.smartReserveService.preview(req.user.userId, dto);
    return {
      code: 0,
      message: result.message || '座位已锁定，请确认',
      data: result,
    };
  }

  @Post('confirm')
  @ApiOperation({ summary: '确认预约（从犹豫期转为正式预约）' })
  async confirm(@Request() req, @Body() dto: SeatIdDto) {
    const result = await this.smartReserveService.confirm(req.user.userId, dto.seatId);
    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }

  @Post('cancel-preview')
  @ApiOperation({ summary: '取消预览（释放犹豫期锁定）' })
  async cancelPreview(@Request() req, @Body() dto: SeatIdDto) {
    const result = await this.smartReserveService.cancelPreview(req.user.userId, dto.seatId);
    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }
}
