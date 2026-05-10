import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../services/user.service';
import { WechatService } from '../../wechat/services/wechat.service';
import { LoginDto } from '../dtos/login.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('用户')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly wechatService: WechatService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('login')
  @ApiOperation({ summary: '微信登录' })
  async login(@Body() loginDto: LoginDto) {
    const { code } = loginDto;

    const session = await this.wechatService.code2Session(code);

    const user = await this.userService.createOrUpdate(session.openid, '微信用户', undefined, loginDto.deviceFingerprint);

    const payload = { sub: user.id, openid: user.openId };
    const accessToken = this.jwtService.sign(payload);

    return {
      code: 0,
      message: '登录成功',
      data: {
        accessToken,
        user: this.userService.toResponse(user),
      },
    };
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新用户信息' })
  async updateProfile(@Request() req, @Body() body: { nickname?: string; avatar?: string }) {
    const user = await this.userService.updateProfile(req.user.userId, body.nickname, body.avatar);
    return {
      code: 0,
      data: this.userService.toResponse(user),
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

  @Get('credit-records')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取信誉分明细' })
  async getCreditScoreDetails(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const result = await this.userService.getCreditScoreDetails(
      req.user.userId,
      Number(page),
      Number(limit),
    );

    return {
      code: 0,
      data: result,
    };
  }
}
