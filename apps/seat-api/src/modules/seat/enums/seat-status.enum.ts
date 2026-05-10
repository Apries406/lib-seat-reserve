export enum SeatStatus {
  FREE = 'FREE',
  RESERVED = 'RESERVED',
  IN_USE = 'IN_USE',
  TEMP_LEAVE = 'TEMP_LEAVE',
  MAYBE_LEAVE = 'MAYBE_LEAVE',
  IN_JUDGE = 'IN_JUDGE',
}

export enum StatusTrigger {
  RESERVE = 'RESERVE',
  CHECKIN = 'CHECKIN',
  RELEASE = 'RELEASE',
  SENSOR_LEAVE = 'SENSOR_LEAVE',
  SENSOR_RETURN = 'SENSOR_RETURN',
  TIMEOUT = 'TIMEOUT',
  JUDGE_LEAVE = 'JUDGE_LEAVE',
  JUDGE_RETURN = 'JUDGE_RETURN',
}

export const SEAT_STATUS_TEXT: Record<SeatStatus, string> = {
  [SeatStatus.FREE]: '空闲',
  [SeatStatus.RESERVED]: '已预约',
  [SeatStatus.IN_USE]: '使用中',
  [SeatStatus.TEMP_LEAVE]: '暂离',
  [SeatStatus.MAYBE_LEAVE]: '可能离座',
  [SeatStatus.IN_JUDGE]: '犹豫中',
};

export const SEAT_STATUS_COLORS: Record<SeatStatus, string> = {
  [SeatStatus.FREE]: '#3DD9A4',
  [SeatStatus.RESERVED]: '#FFB84D',
  [SeatStatus.IN_USE]: '#FF6B81',
  [SeatStatus.TEMP_LEAVE]: '#FFB84D',
  [SeatStatus.MAYBE_LEAVE]: '#FFB84D',
  [SeatStatus.IN_JUDGE]: '#9B8AFB',
};
