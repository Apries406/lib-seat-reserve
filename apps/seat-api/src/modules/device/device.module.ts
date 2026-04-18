import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { MqttService } from './services/mqtt.service';
import { SensorProcessorService } from './services/sensor-processor.service';
import { SeatModule } from '../seat/seat.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device]), SeatModule],
  providers: [MqttService, SensorProcessorService],
  exports: [MqttService, SensorProcessorService],
})
export class DeviceModule {}
