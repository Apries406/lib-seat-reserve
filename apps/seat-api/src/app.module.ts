import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig, redisConfig, jwtConfig, mqttConfig, wechatConfig } from './config/database.config';
import { RedisProviderModule } from './config/redis.provider';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeatModule } from './modules/seat/seat.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { DeviceModule } from './modules/device/device.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, mqttConfig, wechatConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        charset: 'utf8mb4',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('database.synchronize'),
        logging: configService.get('database.logging'),
      }),
    }),
    RedisProviderModule,
    UserModule,
    AuthModule,
    SeatModule,
    ReservationModule,
    CheckinModule,
    DeviceModule,
    StatisticsModule,
    WebsocketModule,
  ],
})
export class AppModule { }
