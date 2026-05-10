import { useCallback, useEffect } from 'react';
import { useSeatStore } from '../store/seatStore';
import { ISeat } from '../types/seat';

export function useSeat() {
  const {
    areas,
    currentArea,
    seats,
    selectedSeat,
    isLoading,
    fetchAreas,
    fetchSeats,
    setCurrentArea,
    selectSeat,
    resetFilter,
  } = useSeatStore();

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const switchArea = useCallback((area: string) => {
    setCurrentArea(area);
  }, [setCurrentArea]);

  const handleSelectSeat = useCallback((seat: ISeat) => {
    if (seat.status === 'FREE') {
      selectSeat(seat);
    }
  }, [selectSeat]);

  const refreshSeats = useCallback(() => {
    if (currentArea) {
      fetchSeats(currentArea);
    }
  }, [currentArea, fetchSeats]);

  const refreshAreas = useCallback(() => {
    return fetchAreas();
  }, [fetchAreas]);

  const seatsByStatus = useCallback(() => {
    return {
      free: seats.filter((s) => s.status === 'FREE'),
      reserved: seats.filter((s) => s.status === 'RESERVED'),
      inUse: seats.filter((s) => s.status === 'IN_USE'),
      tempLeave: seats.filter((s) => s.status === 'TEMP_LEAVE'),
    };
  }, [seats]);

  return {
    areas,
    currentArea,
    seats,
    selectedSeat,
    isLoading,
    switchArea,
    selectSeat: handleSelectSeat,
    refreshAreas,
    refreshSeats,
    resetFilter,
    seatsByStatus: seatsByStatus(),
  };
}
