import { Module } from '@nestjs/common';
import { SeatGateway } from './seat.gateway';

@Module({
  providers: [SeatGateway],
  exports: [SeatGateway],
})
export class WebsocketModule {}
