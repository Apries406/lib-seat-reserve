import Taro from '@tarojs/taro';
import { useUserStore } from '../store/userStore';
import { getDeviceFingerprint } from '../utils/fingerprint';

export const API_BASE_URL = TARO_APP_API_URL;

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  params?: Record<string, any>;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, params } = options;

  let fullUrl = `${API_BASE_URL}${url}`;
  if (params) {
    const queryString = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Fingerprint': getDeviceFingerprint(),
  };

  const { accessToken } = useUserStore.getState();
  if (accessToken) {
    header['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const res = await Taro.request<ApiResponse<T>>({
      url: fullUrl,
      method,
      data,
      header,
    });

    if (res.data.code === 0) {
      return res.data.data;
    }

    throw new ApiError(res.data.code, res.data.message, res.data.data);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(-1, '网络请求失败');
  }
}

export const api = {
  login: (code: string, deviceFingerprint?: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>({
      url: '/user/login',
      method: 'POST',
      data: { code, deviceFingerprint },
    }),

  getProfile: () =>
    request<any>({
      url: '/user/profile',
    }),

  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    request<any>({
      url: '/user/profile',
      method: 'POST',
      data,
    }),

  getCreditScore: () =>
    request<{ score: number; level: string; canReserve: boolean }>({
      url: '/user/credit',
    }),

  getCreditScoreDetails: (params: { page: number; limit: number }) =>
    request<{ items: any[]; total: number }>({
      url: '/user/credit-records',
      params,
    }),

  getAreas: () =>
    request<any[]>({
      url: '/seats/areas',
    }),

  getSeats: (params: { area?: string; status?: string; hasOutlet?: boolean; isQuiet?: boolean; nearWindow?: boolean }) =>
    request<any[]>({
      url: '/seats',
      params,
    }),

  getSeatDetail: (id: number) =>
    request<any>({
      url: `/seats/${id}`,
    }),

  createReservation: (seatId: number) =>
    request<any>({
      url: '/reservations',
      method: 'POST',
      data: { seatId },
    }),

  cancelReservation: (id: string) =>
    request<void>({
      url: `/reservations/${id}`,
      method: 'DELETE',
    }),

  checkoutReservation: (id: string) =>
    request<any>({
      url: `/reservations/${id}/checkout`,
      method: 'POST',
    }),

  checkin: (data: { reservationId: string; method: string; location?: { lat: number; lng: number }; qrCode?: string }) =>
    request<any>({
      url: '/checkin',
      method: 'POST',
      data,
    }),

  getCurrentReservation: () =>
    request<any>({
      url: '/reservations/current',
    }),

  getReservationHistory: (params: { page: number; limit: number }) =>
    request<{ items: any[]; total: number }>({
      url: '/reservations/history',
      params,
    }),

  smartReserve: (data: { nearWindow?: boolean; hasOutlet?: boolean; isQuiet?: boolean; floor?: string; area?: string; acceptAdjustment: boolean }) =>
    request<{ reservation: any; seat: any; adjusted: boolean; message: string }>({
      url: '/smart-reserve',
      method: 'POST',
      data,
    }),

  previewSeat: (data: { nearWindow?: boolean; hasOutlet?: boolean; isQuiet?: boolean; floor?: string; area?: string; acceptAdjustment: boolean }) =>
    request<{ seat: any; adjusted: boolean; message: string; expiresIn: number }>({
      url: '/smart-reserve/preview',
      method: 'POST',
      data,
    }),

  confirmPreview: (seatId: number) =>
    request<{ reservation: any; seat: any; message: string }>({
      url: '/smart-reserve/confirm',
      method: 'POST',
      data: { seatId },
    }),

  cancelPreview: (seatId: number) =>
    request<{ message: string }>({
      url: '/smart-reserve/cancel-preview',
      method: 'POST',
      data: { seatId },
    }),

  scanQrCode: (qrToken: string) =>
    request<{
      seat: any;
      statusText: string;
      canReserve: boolean;
      myReservation: any;
      message: string;
    }>({
      url: '/checkin/scan',
      method: 'POST',
      data: { qrToken },
    }),

  getSeatQrCode: (seatId: number) =>
    request<{ seatId: number; area: string; seatNumber: string; qrToken: string }>({
      url: `/seats/${seatId}/qr-code`,
    }),
};
