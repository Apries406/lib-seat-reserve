import { View, Text } from '@tarojs/components';
import { useLoad, useRouter, showToast, showModal, navigateBack } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { useSeat } from '../../hooks/useSeat';
import { useReservation } from '../../hooks/useReservation';
import { SEAT_STATUS_TEXT } from '../../types/seat';
import { api } from '../../services/api';
import './index.scss';

export default function Seat() {
  const router = useRouter();
  const seatId = Number(router.params.id) || 0;
  
  const { seats } = useSeat();
  const { reserve } = useReservation();
  
  const [seat, setSeat] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useLoad(() => {
    console.log('Seat page loaded.', seatId);
    if (seatId) {
      const foundSeat = seats.find(s => s.id === seatId);
      setSeat(foundSeat);
    }
  });

  const handleReserve = useCallback(async () => {
    if (!seat) return;

    setShowConfirm(true);
  }, [seat]);

  const handleConfirmReserve = useCallback(async () => {
    if (!seat) return;

    setIsLoading(true);
    try {
      await reserve(seat.id);
      setShowConfirm(false);
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsLoading(false);
    }
  }, [seat, reserve]);

  if (!seat) {
    return (
      <View className="seat">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <View className="seat">
      <View className="seat__detail-card">
        <View className="seat__header">
          <Text className="seat__title">{seat.seatNumber}</Text>
          <View className={`seat__status seat__status--${seat.status.toLowerCase()}`}>
            {seat.status === 'FREE' ? '空闲可约' : SEAT_STATUS_TEXT[seat.status]}
          </View>
        </View>

        <View className="seat__info">
          <View className="seat__info-item">
            <Text className="seat__info-label">所在区域</Text>
            <Text className="seat__info-value">{seat.area}</Text>
          </View>
          <View className="seat__info-item">
            <Text className="seat__info-label">座位类型</Text>
            <Text className="seat__info-value">单人座位</Text>
          </View>
          <View className="seat__info-item">
            <Text className="seat__info-label">开放时间</Text>
            <Text className="seat__info-value">08:00 - 22:00</Text>
          </View>
          <View className="seat__info-item">
            <Text className="seat__info-label">今日使用</Text>
            <Text className="seat__info-value">3 次</Text>
          </View>
        </View>

        <View className="seat__attributes">
          {seat.attributes?.hasOutlet && (
            <View className="seat__attribute seat__attribute--active">
              <Text className="seat__attribute-icon">🔌</Text>
              <Text className="seat__attribute-text">有插座</Text>
            </View>
          )}
          {seat.attributes?.nearWindow && (
            <View className="seat__attribute seat__attribute--active">
              <Text className="seat__attribute-icon">🪟</Text>
              <Text className="seat__attribute-text">靠窗</Text>
            </View>
          )}
          {seat.attributes?.isQuiet && (
            <View className="seat__attribute seat__attribute--active">
              <Text className="seat__attribute-icon">🤫</Text>
              <Text className="seat__attribute-text">安静区</Text>
            </View>
          )}
        </View>
      </View>

      <View className="seat__rules">
        <Text className="seat__rules-title">预约须知</Text>
        <View className="seat__rule">
          <View className="seat__rule-icon">1</View>
          <Text className="seat__rule-text">预约成功后需在 30分钟内 到达签到</Text>
        </View>
        <View className="seat__rule">
          <View className="seat__rule-icon">2</View>
          <Text className="seat__rule-text">签到支持扫码或位置验证</Text>
        </View>
        <View className="seat__rule">
          <View className="seat__rule-icon">3</View>
          <Text className="seat__rule-text">离座超过 1小时 将自动释放座位</Text>
        </View>
        <View className="seat__rule">
          <View className="seat__rule-icon">4</View>
          <Text className="seat__rule-text">爽约将影响信誉分，请按时签到</Text>
        </View>
      </View>

      {seat.status === 'FREE' && (
        <View className="seat__reserve-btn" onClick={handleReserve}>
          <Text className="seat__reserve-text">立即预约</Text>
        </View>
      )}

      {showConfirm && (
        <View className="seat__modal-overlay">
          <View className="seat__modal">
            <View className="seat__modal-handle" />
            <Text className="seat__modal-title">确认预约</Text>

            <View className="seat__confirm-info">
              <Text className="seat__confirm-seat">{seat.seatNumber}</Text>
              <View className="seat__confirm-time">
                <Text className="seat__confirm-label">保留时间</Text>
                <Text className="seat__confirm-value">30 分钟</Text>
              </View>
            </View>

            <Text className="seat__confirm-tip">请在30分钟内完成签到，超时自动释放</Text>

            <View className="seat__modal-actions">
              <View className="seat__btn-cancel" onClick={() => setShowConfirm(false)}>
                取消
              </View>
              <View className="seat__btn-confirm" onClick={handleConfirmReserve}>
                确认预约
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
