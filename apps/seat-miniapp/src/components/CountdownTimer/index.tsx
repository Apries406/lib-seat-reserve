import { memo, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface CountdownTimerProps {
  seconds: number;
  label?: string;
  onExpire?: () => void;
}

export const CountdownTimer = memo<CountdownTimerProps>(
  ({ seconds, label = '剩余时间', onExpire }) => {
    const { minutes, secs, isExpired } = useMemo(() => {
      const isExpired = seconds <= 0;
      return {
        minutes: Math.floor(seconds / 60),
        seconds: seconds % 60,
        secs: seconds % 60,
        isExpired,
      };
    }, [seconds]);

    if (isExpired && onExpire) {
      onExpire();
    }

    return (
      <View className={`countdown-timer ${isExpired ? 'countdown-timer--expired' : ''}`}>
        <Text className="countdown-timer__label">{label}</Text>
        <View className="countdown-timer__time">
          <Text className="countdown-timer__number">
            {minutes.toString().padStart(2, '0')}
          </Text>
          <Text className="countdown-timer__colon">:</Text>
          <Text className="countdown-timer__number">
            {secs.toString().padStart(2, '0')}
          </Text>
        </View>
        {isExpired && (
          <Text className="countdown-timer__expired-text">已过期</Text>
        )}
      </View>
    );
  }
);

CountdownTimer.displayName = 'CountdownTimer';
