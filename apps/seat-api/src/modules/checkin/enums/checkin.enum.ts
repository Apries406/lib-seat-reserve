export enum CheckinMethod {
  QR_CODE = 'QR_CODE',
  INFRARED = 'INFRARED',
  LOCATION = 'LOCATION',
  REMOTE = 'REMOTE',
}

export enum CheckinFailReason {
  RESERVATION_NOT_FOUND = 'RESERVATION_NOT_FOUND',
  RESERVATION_NOT_YOURS = 'RESERVATION_NOT_YOURS',
  LOCATION_TOO_FAR = 'LOCATION_TOO_FAR',
  REMOTE_LIMIT_EXCEEDED = 'REMOTE_LIMIT_EXCEEDED',
  SEAT_OCCUPIED = 'SEAT_OCCUPIED',
  CHECKIN_WINDOW_EXPIRED = 'CHECKIN_WINDOW_EXPIRED',
}

export const CHECKIN_FAIL_TEXT: Record<CheckinFailReason, string> = {
  [CheckinFailReason.RESERVATION_NOT_FOUND]: '预约不存在或已过期',
  [CheckinFailReason.RESERVATION_NOT_YOURS]: '预约不属于当前用户',
  [CheckinFailReason.LOCATION_TOO_FAR]: '位置距离过远',
  [CheckinFailReason.REMOTE_LIMIT_EXCEEDED]: '远程签到次数已达上限',
  [CheckinFailReason.SEAT_OCCUPIED]: '座位已被占用',
  [CheckinFailReason.CHECKIN_WINDOW_EXPIRED]: '签到时间窗口已过',
};
