import { create } from 'zustand';
import { ISeat, IArea, SeatStatus } from '../types/seat';
import { api } from '../services/api';

interface SeatStore {
  areas: IArea[];
  currentArea: string | null;
  seats: ISeat[];
  selectedSeat: ISeat | null;
  filter: {
    hasOutlet?: boolean;
    isQuiet?: boolean;
    nearWindow?: boolean;
  };
  isLoading: boolean;

  fetchAreas: () => Promise<void>;
  fetchSeats: (area: string) => Promise<void>;
  setCurrentArea: (area: string) => void;
  selectSeat: (seat: ISeat | null) => void;
  setFilter: (filter: Partial<SeatStore['filter']>) => void;
  updateSeatStatus: (seatId: number, status: SeatStatus) => void;
  resetFilter: () => void;
}

export const useSeatStore = create<SeatStore>((set, get) => ({
  areas: [],
  currentArea: null,
  seats: [],
  selectedSeat: null,
  filter: {},
  isLoading: false,

  fetchAreas: async () => {
    const areas = await api.getAreas();
    set({ areas });
    if (areas.length > 0 && !get().currentArea) {
      set({ currentArea: areas[0].id });
      get().fetchSeats(areas[0].id);
    }
  },

  fetchSeats: async (area: string) => {
    set({ isLoading: true });
    try {
      const seats = await api.getSeats({ area });
      set({ seats, currentArea: area });
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentArea: (area) => {
    set({ currentArea: area, selectedSeat: null });
    get().fetchSeats(area);
  },

  selectSeat: (seat) => set({ selectedSeat: seat }),

  setFilter: (filter) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
    const { currentArea } = get();
    if (currentArea) {
      get().fetchSeats(currentArea);
    }
  },

  updateSeatStatus: (seatId, status) => {
    set((state) => ({
      seats: state.seats.map((seat) =>
        seat.id === seatId ? { ...seat, status } : seat,
      ),
    }));
  },

  resetFilter: () => {
    set({ filter: {} });
    const { currentArea } = get();
    if (currentArea) {
      get().fetchSeats(currentArea);
    }
  },
}));
