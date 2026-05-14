import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { IReservation } from '../types/reservation';
import { api } from '../services/api';

interface ReservationStore {
  currentReservation: IReservation | null;
  history: IReservation[];
  countdown: number;
  isLoading: boolean;
  historyPage: number;
  hasMore: boolean;

  fetchCurrent: () => Promise<void>;
  createReservation: (seatId: number) => Promise<IReservation>;
  cancelReservation: (id: string) => Promise<void>;
  fetchHistory: (refresh?: boolean) => Promise<void>;
  setCountdown: (seconds: number) => void;
  tickCountdown: () => void;
  clearCurrent: () => void;
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;

const startCountdownTimer = (get: () => ReservationStore, set: any) => {
  if (countdownTimer) return;
  countdownTimer = setInterval(() => {
    const { countdown } = get();
    if (countdown > 0) {
      set({ countdown: countdown - 1 });
    } else {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }
  }, 1000);
};

const stopCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

export const useReservationStore = create<ReservationStore>((set, get) => ({
  currentReservation: null,
  history: [],
  countdown: 0,
  isLoading: false,
  historyPage: 1,
  hasMore: true,

  fetchCurrent: async () => {
    const reservation = await api.getCurrentReservation();
    const countdown = reservation
      ? (reservation.expiresIn ?? Math.max(0, Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000)))
      : 0;
    set({ currentReservation: reservation, countdown });
    if (countdown > 0) startCountdownTimer(get, set);
    else stopCountdownTimer();
  },

  createReservation: async (seatId: number) => {
    set({ isLoading: true });
    try {
      const result = await api.createReservation(seatId);
      const reservation: IReservation = {
        ...result,
        reservedAt: new Date().toISOString(),
      };
      const countdown = result.expiresIn ?? Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
      set({ currentReservation: reservation, countdown });
      startCountdownTimer(get, set);
      return reservation;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelReservation: async (id: string) => {
    await api.cancelReservation(id);
    set({ currentReservation: null, countdown: 0 });
    stopCountdownTimer();
  },

  fetchHistory: async (refresh = false) => {
    const page = refresh ? 1 : get().historyPage;
    set({ isLoading: true });
    try {
      const result = await api.getReservationHistory({ page, limit: 10 });
      set((state) => ({
        history: refresh ? result.items : [...state.history, ...result.items],
        historyPage: page + 1,
        hasMore: result.items.length === 10,
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  setCountdown: (seconds) => {
    set({ countdown: seconds });
    if (seconds > 0) startCountdownTimer(get, set);
    else stopCountdownTimer();
  },

  tickCountdown: () => {
    const { countdown } = get();
    if (countdown > 0) {
      set({ countdown: countdown - 1 });
    } else {
      stopCountdownTimer();
    }
  },

  clearCurrent: () => {
    set({ currentReservation: null, countdown: 0 });
    stopCountdownTimer();
  },
}));
