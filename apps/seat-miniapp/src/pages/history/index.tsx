import { View, Text } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { useReservation } from '../../hooks/useReservation';
import './index.scss';

export default function History() {
  const { history, fetchHistory, refreshHistory } = useReservation();

  useDidShow(() => {
    refreshHistory();
  });

  return (
    <View className="history">
      {history.length > 0 ? (
        history.map((item: any) => (
          <View key={item.id} className="history__item">
            <View className="history__seat">{item.seatNumber}</View>
            <View className="history__detail">
              <Text className="history__area">{item.area}</Text>
              <Text className="history__date">
                {item.reservedAt ? new Date(item.reservedAt).toLocaleDateString() : '-'}
              </Text>
            </View>
            <View className={`history__status history__status--${item.status?.toLowerCase()}`}>
              <Text className="history__status-text">{item.status}</Text>
            </View>
          </View>
        ))
      ) : (
        <View className="history__empty">
          <Text className="history__empty-icon">📋</Text>
          <Text className="history__empty-text">暂无历史记录</Text>
        </View>
      )}
    </View>
  );
}
