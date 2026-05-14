export enum ReservationStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export const RESERVATION_STATUS_TEXT: Record<ReservationStatus, string> = {
  [ReservationStatus.PENDING]: '待签到',
  [ReservationStatus.ACTIVE]: '使用中',
  [ReservationStatus.COMPLETED]: '已完成',
  [ReservationStatus.CANCELLED]: '已取消',
  [ReservationStatus.EXPIRED]: '已过期',
};

export interface IReservation {
  id: string;
  seatId: number;
  seatNumber: string;
  area: string;
  status: ReservationStatus;
  reservedAt: string;
  expiresAt: string;
  expiresIn?: number;
  checkedInAt?: string;
}

export interface ICreateReservationResponse {
  reservationId: string;
  seatId: number;
  seatNumber: string;
  area: string;
  status: ReservationStatus;
  expiresAt: string;
}
