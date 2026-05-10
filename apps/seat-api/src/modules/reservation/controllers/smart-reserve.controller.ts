import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SmartReserveService, ISmartReservePreference } from '../services/smart-reserve.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IsBoolean, IsOptional, IsString, IsEnum } from 'class-validator';

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

@ApiTags('智能预约')
@Controller('smart-reserve')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SmartReserveController {
  constructor(private readonly smartReserveService: SmartReserveService) {}

  @Post()
  @ApiOperation({ summary: '智能预约座位' })
  async smartReserve(@Request() req, @Body() dto: SmartReserveDto) {
    const result = await this.smartReserveService.smartReserve(req.user.userId, dto);
    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }
}
