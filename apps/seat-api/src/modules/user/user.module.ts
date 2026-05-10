import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CreditScoreDetail } from './entities/credit-score-detail.entity';
import { UserService } from './services/user.service';
import { CreditRecoveryScheduler } from './services/credit-recovery.scheduler';
import { UserController } from './controllers/user.controller';
import { WechatModule } from '../wechat/wechat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CreditScoreDetail]),
    WechatModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: configService.get<string>('jwt.expiresIn') as string & number },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, CreditRecoveryScheduler],
  exports: [UserService],
})
export class UserModule {}
