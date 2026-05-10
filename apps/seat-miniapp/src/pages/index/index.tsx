import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow, navigateTo } from '@tarojs/taro';
import { useSeat } from '../../hooks/useSeat';
import { useReservation } from '../../hooks/useReservation';
import { SeatCard } from '../../components/SeatCard';
import { ISeat } from '../../types/seat';
import './index.scss';

export default function Index() {
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
      navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` });
    } else if (currentReservation) {
      Taro.showModal({
        title: '已有预约',
        content: '您当前已有预约，是否前往签到？',
        confirmText: '前往签到',
        success: (res) => {
          if (res.confirm) {
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
    <View className="index">
      {currentReservation && (
        <View className="index__status-card">
          <View className="index__status-header">
            <Text className="index__status-label">当前预约</Text>
            <Text className="index__status-badge">待签到</Text>
          </View>
          <View className="index__status-info">
            <Text className="index__seat-number">{currentReservation.seatNumber}</Text>
            <View className="index__status-detail">
              <Text className="index__area">{currentReservation.area}</Text>
            </View>
            <View
              className="index__status-action"
              onClick={() => navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` })}
            >
              去签到
            </View>
          </View>
        </View>
      )}

      <ScrollView className="index__area-tabs" scrollX>
        {areas.map((area) => (
          <View
            key={area.id}
            className={`index__area-tab ${currentArea === area.id ? 'index__area-tab--active' : ''}`}
            onClick={() => handleAreaChange(area.id)}
          >
            <Text className="index__area-name">{area.name}</Text>
            <Text className="index__area-status">
              {area.availableCount > 3 ? `空闲${area.availableCount}` : '紧张'}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="index__filter-bar">
        <View className="index__status-legend">
          <View className="index__status-item">
            <View className="index__status-dot index__status-dot--free" />
            <Text>空闲 {seatsByStatus.free.length}</Text>
          </View>
          <View className="index__status-item">
            <View className="index__status-dot index__status-dot--occupied" />
            <Text>占用</Text>
          </View>
          <View className="index__status-item">
            <View className="index__status-dot index__status-dot--temp-leave" />
            <Text>暂离</Text>
          </View>
        </View>
      </View>

      <ScrollView className="index__seat-grid" scrollY>
        <View className="index__grid">
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
        <View className="index__reserve-btn" onClick={handleReserve}>
          <Text className="index__reserve-text">预约 {selectedSeat.seatNumber}</Text>
        </View>
      )}
    </View>
  );
}
