import { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow, navigateTo, showToast, showModal } from '@tarojs/taro';
import { useReservation } from '../../hooks/useReservation';
import { api } from '../../services/api';
import './index.scss';

const FLOOR_OPTIONS = [
  { value: 'any', label: '不限' },
  { value: 'high', label: '高楼层' },
  { value: 'low', label: '低楼层' },
];

export default function Index() {
  const { currentReservation, fetchCurrent } = useReservation();

  const [preferences, setPreferences] = useState({
    nearWindow: false,
    hasOutlet: false,
    isQuiet: false,
    floor: 'any' as 'any' | 'high' | 'low',
    acceptAdjustment: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  useDidShow(() => {
    void fetchCurrent();
  });

  const togglePreference = useCallback((key: 'nearWindow' | 'hasOutlet' | 'isQuiet') => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSmartReserve = useCallback(async () => {
    if (currentReservation) {
      showToast({ title: '您已有进行中的预约', icon: 'none' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.smartReserve({
        nearWindow: preferences.nearWindow || undefined,
        hasOutlet: preferences.hasOutlet || undefined,
        isQuiet: preferences.isQuiet || undefined,
        floor: preferences.floor === 'any' ? undefined : preferences.floor,
        acceptAdjustment: preferences.acceptAdjustment,
      });

      if (result.adjusted) {
        await showModal({
          title: '预约成功（已调剂）',
          content: `${result.message}\n座位：${result.seat.area}区 ${result.seat.seatNumber}`,
          showCancel: false,
        });
      } else {
        showToast({ title: '预约成功', icon: 'success' });
      }

      void fetchCurrent();
      setTimeout(() => {
        if (result.reservation?.id) {
          navigateTo({ url: `/pages/checkin/index?id=${result.reservation.id}` });
        }
      }, 800);
    } catch (error: any) {
      const message = error.message || '预约失败';
      if (message.includes('暂无符合偏好') && !preferences.acceptAdjustment) {
        const { confirm } = await showModal({
          title: '预约失败',
          content: message + '，是否开启「接受调剂」重试？',
          confirmText: '开启并重试',
        });
        if (confirm) {
          setPreferences((prev) => ({ ...prev, acceptAdjustment: true }));
          setTimeout(() => handleSmartReserve(), 300);
        }
      } else {
        showToast({ title: message, icon: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [preferences, currentReservation, fetchCurrent]);

  const goToSeatSelect = useCallback(() => {
    navigateTo({ url: '/pages/seat-select/index' });
  }, []);

  return (
    <View className="index">
      {currentReservation && (
        <View className="index__status-card">
          <View className="index__status-header">
            <Text className="index__status-label">当前预约</Text>
            <Text className="index__status-badge">
              {currentReservation.status === 'ACTIVE' ? '使用中' : '待签到'}
            </Text>
          </View>
          <View className="index__status-info">
            <Text className="index__seat-number">{currentReservation.seatNumber}</Text>
            <View className="index__status-detail">
              <Text className="index__area">{currentReservation.area}</Text>
            </View>
            {currentReservation.status === 'PENDING' ? (
              <View
                className="index__status-action"
                onClick={() => navigateTo({ url: `/pages/checkin/index?id=${currentReservation.id}` })}
              >
                去签到
              </View>
            ) : (
              <View className="index__status-action index__status-action--active">进行中</View>
            )}
          </View>
        </View>
      )}

      <View className="index__smart-section">
        <Text className="index__section-title">智能预约</Text>
        <Text className="index__section-subtitle">选择偏好，一键分配最优座位</Text>

        <View className="index__preference-group">
          <Text className="index__group-label">座位偏好</Text>
          <View className="index__preference-tags">
            <View
              className={`index__preference-tag ${preferences.nearWindow ? 'index__preference-tag--active' : ''}`}
              onClick={() => togglePreference('nearWindow')}
            >
              <Text className="index__tag-icon">🪟</Text>
              <Text className="index__tag-text">靠窗</Text>
            </View>
            <View
              className={`index__preference-tag ${preferences.hasOutlet ? 'index__preference-tag--active' : ''}`}
              onClick={() => togglePreference('hasOutlet')}
            >
              <Text className="index__tag-icon">🔌</Text>
              <Text className="index__tag-text">有插座</Text>
            </View>
            <View
              className={`index__preference-tag ${preferences.isQuiet ? 'index__preference-tag--active' : ''}`}
              onClick={() => togglePreference('isQuiet')}
            >
              <Text className="index__tag-icon">🤫</Text>
              <Text className="index__tag-text">安静区</Text>
            </View>
          </View>
        </View>

        <View className="index__preference-group">
          <Text className="index__group-label">楼层偏好</Text>
          <View className="index__floor-options">
            {FLOOR_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                className={`index__floor-option ${preferences.floor === opt.value ? 'index__floor-option--active' : ''}`}
                onClick={() => setPreferences((prev) => ({ ...prev, floor: opt.value as any }))}
              >
                <Text className="index__floor-text">{opt.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="index__adjustment-row" onClick={() => setPreferences((prev) => ({ ...prev, acceptAdjustment: !prev.acceptAdjustment }))}>
          <View className={`index__checkbox ${preferences.acceptAdjustment ? 'index__checkbox--checked' : ''}`}>
            {preferences.acceptAdjustment && <Text className="index__checkmark">✓</Text>}
          </View>
          <Text className="index__adjustment-text">接受调剂（无符合座位时自动放宽条件）</Text>
        </View>

        <View
          className={`index__smart-btn ${isLoading ? 'index__smart-btn--loading' : ''}`}
          onClick={handleSmartReserve}
        >
          <Text className="index__smart-btn-text">
            {isLoading ? '预约中...' : '一键预约'}
          </Text>
        </View>

        <View className="index__manual-link" onClick={goToSeatSelect}>
          <Text className="index__manual-text">或选择单座位预约 →</Text>
        </View>
      </View>

      <View className="index__rules">
        <Text className="index__rules-title">预约须知</Text>
        <View className="index__rule">
          <View className="index__rule-icon">1</View>
          <Text className="index__rule-text">预约成功后需在 30分钟内 到达签到</Text>
        </View>
        <View className="index__rule">
          <View className="index__rule-icon">2</View>
          <Text className="index__rule-text">签到支持扫码、位置验证或红外自动检测</Text>
        </View>
        <View className="index__rule">
          <View className="index__rule-icon">3</View>
          <Text className="index__rule-text">离座超过 1小时 将自动释放座位</Text>
        </View>
        <View className="index__rule">
          <View className="index__rule-icon">4</View>
          <Text className="index__rule-text">信誉分低于 65 分将限制预约</Text>
        </View>
      </View>
    </View>
  );
}
