import { View, Text, Button, Image } from '@tarojs/components';
import { useDidShow, switchTab, navigateTo } from '@tarojs/taro';
import { useAuth } from '../../hooks/useAuth';
import './index.scss';

export default function Profile() {
  const { user, isLoggedIn, wxLogin, logout, refreshUserInfo } = useAuth();

  useDidShow(() => {
    if (isLoggedIn) {
      void refreshUserInfo();
    }
  });

  const handleLogin = async () => {
    try {
      await wxLogin();
      switchTab({ url: '/pages/index/index' });
    } catch {}
  };

  if (!isLoggedIn) {
    return (
      <View className="profile">
        <View className="profile__login-view">
          <View className="profile__login-icon">👤</View>
          <Text className="profile__login-tip">登录后查看您的预约信息</Text>
          <Button className="profile__login-btn" type="primary" onClick={handleLogin}>
            微信一键登录
          </Button>
        </View>
      </View>
    );
  }

  const handleEditProfile = () => {
    navigateTo({ url: '/pages/login/index?from=profile' });
  };

  return (
    <View className="profile">
      <View className="profile__header">
        <View className="profile__user-info" onClick={handleEditProfile}>
          <View className="profile__avatar">
            {user?.avatar ? (
              <Image
                className="profile__avatar-img"
                src={user.avatar}
                mode="aspectFill"
              />
            ) : (
              <Text>👤</Text>
            )}
          </View>
          <View>
            <Text className="profile__name">{user?.nickname || '未设置昵称'}</Text>
            <Text className="profile__id">ID: {user?.id?.slice(0, 8) || '-'}</Text>
            {!user?.nickname && (
              <Text className="profile__edit-hint">点击完善资料</Text>
            )}
          </View>
        </View>

        <View className="profile__credit-score" onClick={() => navigateTo({ url: '/pages/credit-history/index' })}>
          <View className="profile__credit-header">
            <Text className="profile__credit-label">信誉分</Text>
            <View className="profile__credit-header-right">
              <Text className="profile__credit-link">查看明细</Text>
              <Text className="profile__credit-value">{user?.creditScore || 100}</Text>
            </View>
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
          <Text className="profile__credit-action">点击查看加减分详情</Text>
        </View>
      </View>

      <View className="profile__stats-row">
        <View className="profile__stat-card">
          <Text className="profile__stat-value">-</Text>
          <Text className="profile__stat-label">本月使用</Text>
        </View>
        <View className="profile__stat-card">
          <Text className="profile__stat-value">-</Text>
          <Text className="profile__stat-label">总时长</Text>
        </View>
        <View className="profile__stat-card">
          <Text className="profile__stat-value">-</Text>
          <Text className="profile__stat-label">常去区域</Text>
        </View>
      </View>

      <View className="profile__quick-actions">
        <View className="profile__quick-action" onClick={() => navigateTo({ url: '/pages/current/index' })}>
          <Text className="profile__quick-icon">📅</Text>
          <Text className="profile__quick-label">当前预约</Text>
        </View>
        <View className="profile__quick-action" onClick={() => navigateTo({ url: '/pages/history/index' })}>
          <Text className="profile__quick-icon">📋</Text>
          <Text className="profile__quick-label">历史记录</Text>
        </View>
        <View className="profile__quick-action" onClick={() => navigateTo({ url: '/pages/favorites/index' })}>
          <Text className="profile__quick-icon">⭐</Text>
          <Text className="profile__quick-label">收藏座位</Text>
        </View>
      </View>

      <View className="profile__feature-list">
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
