import { View, Text } from '@tarojs/components';
import { useLoad, useRouter, showToast } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { CountdownTimer } from '../../components/CountdownTimer';
import { CheckinMethodSelector, CheckinMethod } from '../../components/CheckinMethodSelector';
import { useReservation } from '../../hooks/useReservation';
import { api } from '../../services/api';
import './index.scss';
import Taro from '@tarojs/taro';

export default function Checkin() {
  const router = useRouter();
  const reservationId = router.params.id || '';

  const { currentReservation, formattedCountdown, countdown } = useReservation();
  const [isLoading, setIsLoading] = useState(false);

  useLoad(() => {
    console.log('Checkin page loaded.', reservationId);
  });

  const handleCheckin = useCallback(async (method: CheckinMethod) => {
    if (!reservationId) return;

    setIsLoading(true);
    try {
      if (method === CheckinMethod.QR_CODE) {
        const scanRes = await Taro.scanCode({ scanType: ['qrCode'] });
        await api.checkin({ reservationId, method: 'QR_CODE', qrCode: scanRes.result });
      } else {
        const location = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true });
        await api.checkin({
          reservationId,
          method: 'LOCATION',
          location: { lat: location.latitude, lng: location.longitude },
        });
      }

      showToast({ title: '签到成功', icon: 'success' });
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500);
    } catch (error: any) {
      showToast({ title: error.message || '签到失败', icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  return (
    <View className="checkin">
      <View className="checkin__card">
        <CountdownTimer
          seconds={countdown}
          label="签到倒计时"
        />

        <View className="checkin__seat-info">
          <View className="checkin__info-item">
            <Text className="checkin__info-value">{currentReservation?.seatNumber || '-'}</Text>
            <Text className="checkin__info-label">座位号</Text>
          </View>
          <View className="checkin__info-item">
            <Text className="checkin__info-value">{currentReservation?.area || '-'}</Text>
            <Text className="checkin__info-label">区域</Text>
          </View>
          <View className="checkin__info-item">
            <Text className="checkin__info-value">
              {currentReservation?.expiresAt
                ? new Date(currentReservation.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                : '-'}
            </Text>
            <Text className="checkin__info-label">过期时间</Text>
          </View>
        </View>
      </View>

      <Text className="checkin__title">选择签到方式</Text>

      <CheckinMethodSelector
        onSelect={handleCheckin}
        disabled={isLoading || countdown <= 0}
      />
    </View>
  );
}
