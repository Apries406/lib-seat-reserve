import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SeatStatus } from '../seat/enums/seat-status.enum';

export enum WsEvent {
  SEAT_STATUS = 'seat:status',
  RESERVATION_EXPIRED = 'reservation:expired',
  CHECKIN_REMINDER = 'checkin:reminder',
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class SeatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SeatGateway.name);
  private clients: Map<string, Socket> = new Map();

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clients.delete(client.id);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  emitSeatStatusChange(seatId: number, status: SeatStatus) {
    this.server.emit(WsEvent.SEAT_STATUS, {
      seatId,
      status,
      timestamp: Date.now(),
    });
  }

  emitReservationExpired(userId: string, reservationId: string, seatId: number) {
    this.server.emit(WsEvent.RESERVATION_EXPIRED, {
      reservationId,
      seatId,
      timestamp: Date.now(),
    });
  }

  emitCheckinReminder(userId: string, reservationId: string, expiresAt: Date) {
    this.server.emit(WsEvent.CHECKIN_REMINDER, {
      reservationId,
      expiresAt: expiresAt.toISOString(),
      timestamp: Date.now(),
    });
  }
}
