import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { api } from '../../services/api';
import { ICreditScoreDetail } from '../../types/user';
import './index.scss';

const REASON_LABELS: Record<string, string> = {
  NO_SHOW: '预约超时未签到',
  CHECKIN_NO_PERSON: '签到后人未到场',
  LONG_LEAVE: '暂离超时',
  REMOTE_CHECKIN: '异常远程签到',
  DAILY_RECOVER: '每日信誉分恢复',
};

export default function CreditHistory() {
  const [records, setRecords] = useState<ICreditScoreDetail[]>([]);

  useDidShow(() => {
    void loadRecords();
  });

  const loadRecords = async () => {
    const result = await api.getCreditScoreDetails({ page: 1, limit: 50 });
    setRecords(result.items);
  };

  return (
    <View className="credit-history">
      <View className="credit-history__header">
        <Text className="credit-history__title">信誉分明细</Text>
        <Text className="credit-history__subtitle">查看最近的加减分记录</Text>
      </View>

      {records.length > 0 ? (
        <View className="credit-history__list">
          {records.map((record) => (
            <View className="credit-history__item" key={record.id}>
              <View className="credit-history__item-main">
                <Text className="credit-history__reason">{REASON_LABELS[record.reason] || record.reason}</Text>
                <Text className="credit-history__time">
                  {new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </Text>
                <Text className="credit-history__score-range">
                  {record.beforeScore} → {record.afterScore}
                </Text>
                {record.reservationId ? (
                  <Text className="credit-history__reservation">关联预约：{record.reservationId.slice(0, 8)}</Text>
                ) : null}
              </View>
              <Text
                className={`credit-history__change ${record.changeAmount >= 0 ? 'credit-history__change--plus' : 'credit-history__change--minus'}`}
              >
                {record.changeAmount >= 0 ? '+' : ''}
                {record.changeAmount}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="credit-history__empty">
          <Text className="credit-history__empty-icon">🧾</Text>
          <Text className="credit-history__empty-text">暂无信誉分变动记录</Text>
        </View>
      )}
    </View>
  );
}
