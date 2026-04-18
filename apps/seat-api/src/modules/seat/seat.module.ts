import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seat } from './entities/seat.entity';
import { SeatStatusLog } from './entities/seat-status-log.entity';
import { SeatService } from './services/seat.service';
import { SeatController } from './controllers/seat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Seat, SeatStatusLog])],
  controllers: [SeatController],
  providers: [SeatService],
  exports: [SeatService],
})
export class SeatModule {}
