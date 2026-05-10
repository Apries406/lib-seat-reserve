import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow, navigateTo } from '@tarojs/taro';
import { useSeat } from '../../hooks/useSeat';
import { useReservation } from '../../hooks/useReservation';
import { SeatCard } from '../../components/SeatCard';
import { ISeat } from '../../types/seat';
import './index.scss';

export default function SeatSelect() {
  const {
    areas,
    currentArea,
    seats,
    selectedSeat,
    switchArea,
    selectSeat,
    seatsByStatus,
    refreshAreas,
  } = useSeat();

  const { currentReservation, fetchCurrent } = useReservation();

  useDidShow(() => {
    void refreshAreas();
    void fetchCurrent();
  });

  const handleSeatSelect = (seat: ISeat) => {
    if (currentReservation?.seatId === seat.id) {
      if (currentReservation.status === 'PENDING') {
        navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` });
      }
      return;
    }
    if (currentReservation) {
      const isActive = currentReservation.status === 'ACTIVE';
      Taro.showModal({
        title: isActive ? '已有进行中的预约' : '已有预约',
        content: isActive
          ? `您当前正在使用 ${currentReservation.seatNumber}，请先结束当前使用`
          : '您当前已有预约，是否前往签到？',
        confirmText: isActive ? '知道了' : '前往签到',
        showCancel: !isActive,
        success: (res) => {
          if (res.confirm && !isActive) {
            navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` });
          }
        }
      });
    } else {
      selectSeat(seat);
    }
  };

  const handleReserve = () => {
    if (selectedSeat) {
      navigateTo({ url: `/pages/seat/index?id=${selectedSeat.id}` });
    }
  };

  const handleAreaChange = (areaId: string) => {
    switchArea(areaId);
  };

  return (
    <View className="seat-select">
      {currentReservation && (
        <View className="seat-select__status-card">
          <View className="seat-select__status-header">
            <Text className="seat-select__status-label">当前预约</Text>
            <Text className="seat-select__status-badge">
              {currentReservation.status === 'ACTIVE' ? '使用中' : '待签到'}
            </Text>
          </View>
          <View className="seat-select__status-info">
            <Text className="seat-select__seat-number">{currentReservation.seatNumber}</Text>
            <View className="seat-select__status-detail">
              <Text className="seat-select__area">{currentReservation.area}</Text>
            </View>
            {currentReservation.status === 'PENDING' ? (
              <View
                className="seat-select__status-action"
                onClick={() => navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` })}
              >
                去签到
              </View>
            ) : (
              <View className="seat-select__status-action seat-select__status-action--active">
                进行中
              </View>
            )}
          </View>
        </View>
      )}

      <ScrollView className="seat-select__area-tabs" scrollX>
        {areas.map((area) => (
          <View
            key={area.id}
            className={`seat-select__area-tab ${currentArea === area.id ? 'seat-select__area-tab--active' : ''}`}
            onClick={() => handleAreaChange(area.id)}
          >
            <Text className="seat-select__area-name">{area.name}</Text>
            <Text className="seat-select__area-status">
              {area.availableCount > 3 ? `空闲${area.availableCount}` : '紧张'}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="seat-select__filter-bar">
        <View className="seat-select__status-legend">
          <View className="seat-select__status-item">
            <View className="seat-select__status-dot seat-select__status-dot--free" />
            <Text>空闲 {seatsByStatus.free.length}</Text>
          </View>
          <View className="seat-select__status-item">
            <View className="seat-select__status-dot seat-select__status-dot--occupied" />
            <Text>占用</Text>
          </View>
          <View className="seat-select__status-item">
            <View className="seat-select__status-dot seat-select__status-dot--temp-leave" />
            <Text>暂离</Text>
          </View>
        </View>
      </View>

      <ScrollView className="seat-select__seat-grid" scrollY>
        <View className="seat-select__grid">
          {seats.map((seat) => (
            <SeatCard
              key={seat.id}
              seat={seat}
              selected={selectedSeat?.id === seat.id}
              isMine={currentReservation?.seatId === seat.id}
              onSelect={handleSeatSelect}
            />
          ))}
        </View>
      </ScrollView>

      {selectedSeat && (
        <View className="seat-select__reserve-btn" onClick={handleReserve}>
          <Text className="seat-select__reserve-text">预约 {selectedSeat.seatNumber}</Text>
        </View>
      )}
    </View>
  );
}
