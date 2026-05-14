import { useCallback } from 'react';
import Taro from '@tarojs/taro';
import { useReservationStore } from '../store/reservationStore';

export function useReservation() {
  const {
    currentReservation,
    history,
    countdown,
    isLoading,
    hasMore,
    fetchCurrent,
    createReservation,
    cancelReservation,
    fetchHistory,
  } = useReservationStore();

  const handleReserve = useCallback(async (seatId: number) => {
    try {
      const reservation = await createReservation(seatId);
      Taro.showToast({ title: '预约成功', icon: 'success' });
      Taro.navigateTo({ url: `/pages/checkin/index?id=${reservation.id}` });
      return reservation;
    } catch (error: any) {
      const message = error.message || '预约失败';
      Taro.showToast({ title: message, icon: 'error' });
      throw error;
    }
  }, [createReservation]);

  const handleCancel = useCallback(async (id: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认取消',
      content: '确定要取消预约吗？',
    });
    if (confirm) {
      await cancelReservation(id);
      Taro.showToast({ title: '已取消', icon: 'success' });
    }
  }, [cancelReservation]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchHistory();
    }
  }, [isLoading, hasMore, fetchHistory]);

  const refreshHistory = useCallback(() => {
    fetchHistory(true);
  }, [fetchHistory]);

  const formatCountdown = useCallback(() => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [countdown]);

  return {
    currentReservation,
    history,
    countdown,
    formattedCountdown: formatCountdown(),
    isLoading,
    hasMore,
    reserve: handleReserve,
    cancel: handleCancel,
    loadMore,
    refreshHistory,
    fetchCurrent,
  };
}
