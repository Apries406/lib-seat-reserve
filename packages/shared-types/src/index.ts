// User types
export interface IUser {
  id: string
  openId: string
  nickname: string
  avatar?: string
  creditScore: number
  violationCount: number
  createdAt: string
  updatedAt: string
}

export interface IUserResponse {
  id: string
  nickname: string
  avatar?: string
  creditScore: number
  creditLevel: CreditScoreLevel
  canReserve: boolean
}

export enum CreditScoreLevel {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

// Seat types
export interface ISeat {
  id: number
  area: string
  seatNumber: string
  status: SeatStatus
  attributes: ISeatAttributes
  reservedUntil?: string
}

export interface ISeatAttributes {
  hasOutlet: boolean
  isQuiet: boolean
  nearWindow: boolean
}

export enum SeatStatus {
  FREE = 'FREE',
  RESERVED = 'RESERVED',
  IN_USE = 'IN_USE',
  TEMP_LEAVE = 'TEMP_LEAVE',
  MAYBE_LEAVE = 'MAYBE_LEAVE',
}

export interface IArea {
  id: string
  name: string
  seatCount: number
  availableCount: number
}

// Reservation types
export interface IReservation {
  id: string
  userId: string
  seatId: number
  seatNumber: string
  area: string
  status: ReservationStatus
  reservedAt: string
  expiresAt: string
  checkedInAt?: string
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

// Checkin types
export enum CheckinMethod {
  QR_CODE = 'QR_CODE',
  LOCATION = 'LOCATION',
}

export interface ICheckinRequest {
  reservationId: string
  method: CheckinMethod
  location?: {
    lat: number
    lng: number
  }
  qrCode?: string
}

// API response types
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// WebSocket event types
export enum WsEvent {
  SEAT_STATUS = 'seat:status',
  RESERVATION_EXPIRED = 'reservation:expired',
  CHECKIN_REMINDER = 'checkin:reminder',
}

export interface ISeatStatusChange {
  seatId: number
  status: SeatStatus
  timestamp: number
}
