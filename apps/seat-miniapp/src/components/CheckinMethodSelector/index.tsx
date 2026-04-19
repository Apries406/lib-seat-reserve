import { memo } from 'react';
import { View, Text, Button } from '@tarojs/components';
import './index.scss';

export enum CheckinMethod {
  QR_CODE = 'QR_CODE',
  LOCATION = 'LOCATION',
}

interface CheckinMethodSelectorProps {
  onSelect: (method: CheckinMethod) => void;
  disabled?: boolean;
}

export const CheckinMethodSelector = memo<CheckinMethodSelectorProps>(
  ({ onSelect, disabled }) => {
    return (
      <View className="checkin-method-selector">
        <Button
          className="checkin-method-selector__btn checkin-method-selector__btn--primary"
          onClick={() => !disabled && onSelect(CheckinMethod.QR_CODE)}
        >
          <Text className="checkin-method-selector__icon">📷</Text>
          <Text className="checkin-method-selector__label">扫码签到</Text>
        </Button>

        <Button
          className="checkin-method-selector__btn checkin-method-selector__btn--secondary"
          onClick={() => !disabled && onSelect(CheckinMethod.LOCATION)}
        >
          <Text className="checkin-method-selector__icon">📍</Text>
          <Text className="checkin-method-selector__label">自动定位签到</Text>
        </Button>
      </View>
    );
  }
);

CheckinMethodSelector.displayName = 'CheckinMethodSelector';
