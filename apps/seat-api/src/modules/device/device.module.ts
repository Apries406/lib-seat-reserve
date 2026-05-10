import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { MqttService } from './services/mqtt.service';
import { SensorProcessorService } from './services/sensor-processor.service';
import { SeatModule } from '../seat/seat.module';
import { UserModule } from '../user/user.module';
import { Reservation } from '../reservation/entities/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Reservation]), SeatModule, UserModule],
  providers: [MqttService, SensorProcessorService],
  exports: [MqttService, SensorProcessorService],
})
export class DeviceModule {}
