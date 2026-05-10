import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CheckinService } from '../services/checkin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CheckinMethod } from '../enums/checkin.enum';
import { IsString, IsEnum, IsOptional } from 'class-validator';

class CheckinDto {
  @IsString()
  reservationId: string;

  @IsEnum(CheckinMethod)
  method: CheckinMethod;

  @IsOptional()
  location?: { lat: number; lng: number };

  @IsOptional()
  @IsString()
  qrCode?: string;
}

class ScanDto {
  @IsString()
  qrToken: string;
}

@ApiTags('签到')
@Controller('checkin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post()
  @ApiOperation({ summary: '签到' })
  async checkin(@Request() req, @Body() dto: CheckinDto) {
    const result = await this.checkinService.checkin(req.user.userId, dto);
    return {
      code: 0,
      message: '签到成功',
      data: result,
    };
  }

  @Post('scan')
  @ApiOperation({ summary: '扫码查询座位状态' })
  async scan(@Request() req, @Body() dto: ScanDto) {
    const result = await this.checkinService.scan(req.user.userId, dto.qrToken);
    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }
}
