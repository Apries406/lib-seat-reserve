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

export const useReservationStore = create<ReservationStore>((set, get) => ({
  currentReservation: null,
  history: [],
  countdown: 0,
  isLoading: false,
  historyPage: 1,
  hasMore: true,

  fetchCurrent: async () => {
    const reservation = await api.getCurrentReservation();
    set({
      currentReservation: reservation,
      countdown: reservation
        ? Math.max(0, Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000))
        : 0,
    });
  },

  createReservation: async (seatId: number) => {
    set({ isLoading: true });
    try {
      const result = await api.createReservation(seatId);
      const reservation: IReservation = {
        ...result,
        reservedAt: new Date().toISOString(),
      };
      set({
        currentReservation: reservation,
        countdown: Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000),
      });
      return reservation;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelReservation: async (id: string) => {
    await api.cancelReservation(id);
    set({ currentReservation: null, countdown: 0 });
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

  setCountdown: (seconds) => set({ countdown: seconds }),

  tickCountdown: () => {
    const { countdown } = get();
    if (countdown > 0) {
      set({ countdown: countdown - 1 });
    }
  },

  clearCurrent: () => set({ currentReservation: null, countdown: 0 }),
}));
