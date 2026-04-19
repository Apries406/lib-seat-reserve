import { memo } from 'react';
import { View, Text } from '@tarojs/components';
import { ISeat, SEAT_STATUS_TEXT } from '../../types/seat';
import './index.scss';

interface SeatCardProps {
  seat: ISeat;
  selected?: boolean;
  isMine?: boolean;
  onSelect?: (seat: ISeat) => void;
}

export const SeatCard = memo<SeatCardProps>(({ seat, selected, isMine, onSelect }) => {
  const statusText = SEAT_STATUS_TEXT[seat.status];
  const isAvailable = seat.status === 'FREE';

  const handleClick = () => {
    if (isAvailable && onSelect) {
      onSelect(seat);
    }
  };

  const getStatusClass = () => {
    if (isMine) return 'mine';
    switch (seat.status) {
      case 'FREE': return 'free';
      case 'RESERVED': return 'reserved';
      case 'IN_USE': return 'occupied';
      case 'TEMP_LEAVE': return 'temp-leave';
      default: return '';
    }
  };

  return (
    <View
      className={`seat-card ${selected ? 'seat-card--selected' : ''} ${
        isAvailable ? 'seat-card--available' : 'seat-card--unavailable'
      }`}
      onClick={handleClick}
    >
      <View className="seat-card__header">
        <Text className="seat-card__number">{seat.seatNumber}</Text>
        {selected && <Text className="seat-card__check">✓</Text>}
        {isMine && <Text className="seat-card__mine">🟣</Text>}
      </View>

      <View className={`seat-card__status seat-card__status--${getStatusClass()}`}>
        {isMine ? '我的预约' : statusText}
      </View>

      {seat.attributes && (
        <View className="seat-card__tags">
          {seat.attributes.hasOutlet && (
            <Text className="seat-card__tag seat-card__tag--outlet">🔌</Text>
          )}
          {seat.attributes.isQuiet && (
            <Text className="seat-card__tag seat-card__tag--quiet">🤫</Text>
          )}
          {seat.attributes.nearWindow && (
            <Text className="seat-card__tag seat-card__tag--window">🪟</Text>
          )}
        </View>
      )}
    </View>
  );
});

SeatCard.displayName = 'SeatCard';
