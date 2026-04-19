import { View, Text } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import { useAuth } from '../../hooks/useAuth';
import './index.scss';

export default function Profile() {
  const { user, logout } = useAuth();

  useLoad(() => {
    console.log('Profile page loaded.');
  });

  return (
    <View className="profile">
      <View className="profile__header">
        <View className="profile__user-info">
          <View className="profile__avatar">
            <Text>{user?.avatar ? '👤' : '👤'}</Text>
          </View>
          <View>
            <Text className="profile__name">{user?.nickname || '未登录'}</Text>
            <Text className="profile__id">ID: {user?.id?.slice(0, 8) || '-'}</Text>
          </View>
        </View>

        <View className="profile__credit-score">
          <View className="profile__credit-header">
            <Text className="profile__credit-label">信誉分</Text>
            <Text className="profile__credit-value">{user?.creditScore || 100}</Text>
          </View>
          <View className="profile__credit-bar">
            <View
              className="profile__credit-bar-fill"
              style={{ width: `${user?.creditScore || 100}%` }}
            />
          </View>
          <Text className="profile__credit-tip">
            {(user?.creditScore || 100) >= 90 ? '表现良好，继续保持' : '请注意遵守使用规则'}
          </Text>
        </View>
      </View>

      <View className="profile__stats-row">
        <View className="profile__stat-card">
          <Text className="profile__stat-value">23</Text>
          <Text className="profile__stat-label">本月使用</Text>
        </View>
        <View className="profile__stat-card">
          <Text className="profile__stat-value">46h</Text>
          <Text className="profile__stat-label">总时长</Text>
        </View>
        <View className="profile__stat-card">
          <Text className="profile__stat-value">A区</Text>
          <Text className="profile__stat-label">常去区域</Text>
        </View>
      </View>

      <View className="profile__quick-actions">
        <View className="profile__quick-action">
          <Text className="profile__quick-icon">📅</Text>
          <Text className="profile__quick-label">当前预约</Text>
        </View>
        <View className="profile__quick-action">
          <Text className="profile__quick-icon">📋</Text>
          <Text className="profile__quick-label">历史记录</Text>
        </View>
        <View className="profile__quick-action">
          <Text className="profile__quick-icon">⭐</Text>
          <Text className="profile__quick-label">收藏座位</Text>
        </View>
      </View>

      <View className="profile__feature-list">
        <View className="profile__feature-item">
          <View className="profile__feature-left">
            <View className="profile__feature-icon profile__feature-icon--blue">📊</View>
            <Text className="profile__feature-name">使用统计</Text>
          </View>
          <Text className="profile__feature-arrow">›</Text>
        </View>
        <View className="profile__feature-item">
          <View className="profile__feature-left">
            <View className="profile__feature-icon profile__feature-icon--green">🔔</View>
            <Text className="profile__feature-name">消息通知</Text>
          </View>
          <Text className="profile__feature-arrow">›</Text>
        </View>
        <View className="profile__feature-item">
          <View className="profile__feature-left">
            <View className="profile__feature-icon profile__feature-icon--orange">⚙️</View>
            <Text className="profile__feature-name">偏好设置</Text>
          </View>
          <Text className="profile__feature-arrow">›</Text>
        </View>
        <View className="profile__feature-item" onClick={logout}>
          <View className="profile__feature-left">
            <View className="profile__feature-icon profile__feature-icon--red">🚪</View>
            <Text className="profile__feature-name">退出登录</Text>
          </View>
          <Text className="profile__feature-arrow">›</Text>
        </View>
      </View>
    </View>
  );
}
