import { View, Text } from '@tarojs/components';
import { navigateTo, useDidShow } from '@tarojs/taro';
import { useReservation } from '../../hooks/useReservation';
import { CountdownTimer } from '../../components/CountdownTimer';
import './index.scss';

const STATUS_BADGE: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待签到', color: '#FFB84D' },
  ACTIVE: { text: '使用中', color: '#3DD9A4' },
};

const ATTR_LABELS: Record<string, string> = {
  hasOutlet: '有插座',
  isQuiet: '安静区',
  nearWindow: '靠窗',
};

export default function Current() {
  const { currentReservation, formattedCountdown, countdown, fetchCurrent, checkout } = useReservation();

  useDidShow(() => {
    void fetchCurrent();
  });

  const badge = currentReservation ? STATUS_BADGE[currentReservation.status] : null;

  const renderAttributes = () => {
    const attrs = currentReservation?.attributes;
    if (!attrs) return null;
    const keys = Object.entries(attrs)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (keys.length === 0) return null;
    return (
      <View className="current__tags">
        {keys.map((k) => (
          <View className="current__tag" key={k}>
            <Text className="current__tag-text">{ATTR_LABELS[k]}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View className="current">
      {currentReservation ? (
        <>
          <View className="current__header">
            <View className="current__header-top">
              <Text className="current__seat-number">{currentReservation.seatNumber}</Text>
              {badge && (
                <View className="current__badge" style={{ background: badge.color }}>
                  <Text className="current__badge-text">{badge.text}</Text>
                </View>
              )}
            </View>
            <Text className="current__location">
              {currentReservation.building} {currentReservation.area} {currentReservation.floor}
            </Text>
            {renderAttributes()}
          </View>

          <View className="current__section">
            <Text className="current__section-title">预约信息</Text>
            <View className="current__row">
              <Text className="current__label">预约时间</Text>
              <Text className="current__value">
                {new Date(currentReservation.reservedAt).toLocaleString('zh-CN', { hour12: false })}
              </Text>
            </View>
            {currentReservation.checkedInAt && (
              <View className="current__row">
                <Text className="current__label">签到时间</Text>
                <Text className="current__value">
                  {new Date(currentReservation.checkedInAt).toLocaleString('zh-CN', { hour12: false })}
                </Text>
              </View>
            )}
            <View className="current__row">
              <Text className="current__label">过期时间</Text>
              <Text className="current__value">
                {new Date(currentReservation.expiresAt).toLocaleString('zh-CN', { hour12: false })}
              </Text>
            </View>
            <View className="current__row">
              <Text className="current__label">预约编号</Text>
              <Text className="current__value current__value--muted">{currentReservation.id.slice(0, 8)}</Text>
            </View>
          </View>

          {currentReservation.status === 'PENDING' && (
            <View className="current__countdown-wrap">
              <CountdownTimer seconds={countdown} label="签到倒计时" />
            </View>
          )}

          <View className="current__actions">
            {currentReservation.status === 'PENDING' && (
              <View
                className="current__btn current__btn--primary"
                onClick={() => navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` })}
              >
                <Text className="current__btn-text">去签到</Text>
              </View>
            )}
            {currentReservation.status === 'ACTIVE' && (
              <View
                className="current__btn current__btn--danger"
                onClick={() => checkout(currentReservation.id)}
              >
                <Text className="current__btn-text">🚪 退座释放座位</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <View className="current__empty">
          <Text className="current__empty-icon">📅</Text>
          <Text className="current__empty-text">暂无进行中的预约</Text>
        </View>
      )}
    </View>
  );
}
