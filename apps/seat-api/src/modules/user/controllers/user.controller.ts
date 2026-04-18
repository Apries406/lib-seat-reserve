import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { LoginDto } from '../dtos/login.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('用户')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('login')
  @ApiOperation({ summary: '微信登录' })
  async login(@Body() loginDto: LoginDto) {
    const { code } = loginDto;
    
    const openId = `mock_openid_${code}`;
    const nickname = '微信用户';
    
    const user = await this.userService.createOrUpdate(openId, nickname);
    const token = 'mock_jwt_token_' + user.id;
    
    return {
      code: 0,
      message: '登录成功',
      data: {
        accessToken: token,
        refreshToken: 'mock_refresh_' + user.id,
        user: this.userService.toResponse(user),
      },
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户信息' })
  async getProfile(@Request() req) {
    const user = await this.userService.findById(req.user.userId);
    return {
      code: 0,
      data: this.userService.toResponse(user),
    };
  }

  @Get('credit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取信誉分' })
  async getCreditScore(@Request() req) {
    const user = await this.userService.findById(req.user.userId);
    return {
      code: 0,
      data: {
        score: user.creditScore,
        level: user.creditLevel,
        canReserve: user.canReserve,
      },
    };
  }
}
