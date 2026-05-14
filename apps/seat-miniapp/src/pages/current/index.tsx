import { View, Text } from '@tarojs/components';
import { navigateTo, useDidShow } from '@tarojs/taro';
import { useReservation } from '../../hooks/useReservation';
import './index.scss';

export default function Current() {
  const { currentReservation, fetchCurrent, checkout } = useReservation();

  useDidShow(() => {
    void fetchCurrent();
  });

  return (
    <View className="current">
      {currentReservation ? (
        <View className="current__card">
          <View className="current__seat">{currentReservation.seatNumber}</View>
          <View className="current__info">
            <Text className="current__area">{currentReservation.area}</Text>
            <Text className="current__status">
              {currentReservation.status === 'ACTIVE' ? '使用中' : '待签到'}
            </Text>
          </View>
          {currentReservation.status === 'PENDING' && (
            <View
              className="current__checkin-btn"
              onClick={() => navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` })}
            >
              <Text className="current__checkin-text">去签到</Text>
            </View>
          )}
          {currentReservation.status === 'ACTIVE' && (
            <View
              className="current__checkout-btn"
              onClick={() => checkout(currentReservation.id)}
            >
              <Text className="current__checkout-text">退座</Text>
            </View>
          )}
        </View>
      ) : (
        <View className="current__empty">
          <Text className="current__empty-icon">📅</Text>
          <Text className="current__empty-text">暂无进行中的预约</Text>
        </View>
      )}
    </View>
  );
}
