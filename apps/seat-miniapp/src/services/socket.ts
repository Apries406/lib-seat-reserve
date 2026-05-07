import Taro from '@tarojs/taro';
import io from 'weapp.socket.io';
import { API_BASE_URL } from './api';
import { useReservationStore } from '../store/reservationStore';
import { useSeatStore } from '../store/seatStore';
import { SeatStatus } from '../types/seat';
import { useUserStore } from '../store/userStore';

interface SeatStatusPayload {
  seatId: number;
  status: string;
  timestamp: number;
}

interface ReservationExpiredPayload {
  userId?: string;
  reservationId: string;
  seatId: number;
  timestamp: number;
}

interface CheckinReminderPayload {
  userId?: string;
  reservationId: string;
  expiresAt: string;
  timestamp: number;
}

const SOCKET_NAMESPACE = '/ws';

let socket: ReturnType<typeof io> | null = null;

const reservationExpiredListener = (payload: ReservationExpiredPayload) => {
  void handleReservationExpired(payload);
};

const normalizeSeatStatus = (status: string): SeatStatus | null => {
  switch (status) {
    case SeatStatus.FREE:
    case SeatStatus.RESERVED:
    case SeatStatus.IN_USE:
    case SeatStatus.TEMP_LEAVE:
      return status;
    case 'MAYBE_LEAVE':
      return SeatStatus.TEMP_LEAVE;
    default:
      return null;
  }
};

const isCurrentUserEvent = (userId?: string) => {
  if (!userId) {
    return true;
  }

  return useUserStore.getState().user?.id === userId;
};

const isCurrentReservationEvent = (reservationId: string, seatId?: number) => {
  const currentReservation = useReservationStore.getState().currentReservation;

  if (!currentReservation) {
    return false;
  }

  return currentReservation.id === reservationId || currentReservation.seatId === seatId;
};

const syncReservationAfterExpiry = async () => {
  const reservationStore = useReservationStore.getState();

  reservationStore.clearCurrent();

  await Promise.allSettled([
    reservationStore.fetchCurrent(),
    reservationStore.fetchHistory(true),
  ]);
};

const handleSeatStatus = (payload: SeatStatusPayload) => {
  const normalizedStatus = normalizeSeatStatus(payload.status);

  if (!normalizedStatus) {
    return;
  }

  useSeatStore.getState().updateSeatStatus(payload.seatId, normalizedStatus);
};

const handleReservationExpired = async (payload: ReservationExpiredPayload) => {
  if (!isCurrentUserEvent(payload.userId)) {
    return;
  }

  if (!payload.userId && !isCurrentReservationEvent(payload.reservationId, payload.seatId)) {
    return;
  }

  useSeatStore.getState().updateSeatStatus(payload.seatId, SeatStatus.FREE);
  await syncReservationAfterExpiry();
  void Taro.showToast({ title: '预约已过期', icon: 'none' });
};

const handleCheckinReminder = (payload: CheckinReminderPayload) => {
  if (!isCurrentUserEvent(payload.userId)) {
    return;
  }

  if (!payload.userId && !isCurrentReservationEvent(payload.reservationId)) {
    return;
  }

  const expiresAt = new Date(payload.expiresAt).getTime();

  if (Number.isNaN(expiresAt)) {
    return;
  }

  const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  useReservationStore.getState().setCountdown(seconds);
};

export const initSeatSocket = () => {
  if (socket || !useUserStore.getState().isLoggedIn) {
    return socket;
  }

  socket = io(`${API_BASE_URL}${SOCKET_NAMESPACE}`, {
    transports: ['websocket'],
    reconnection: true,
  });

  socket.on('connect', () => {
    void useReservationStore.getState().fetchCurrent();
  });

  socket.on('seat:status', handleSeatStatus);
  socket.on('reservation:expired', reservationExpiredListener);
  socket.on('checkin:reminder', handleCheckinReminder);

  return socket;
};

export const disconnectSeatSocket = () => {
  if (!socket) {
    return;
  }

  socket.off('seat:status', handleSeatStatus);
  socket.off('reservation:expired', reservationExpiredListener);
  socket.off('checkin:reminder', handleCheckinReminder);
  socket.disconnect();
  socket = null;
};
