import { View, Text, Button } from '@tarojs/components';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './index.scss';

export default function Login() {
  const { wxLogin, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  }, [isLoggedIn]);

  const handleLogin = async () => {
    try {
      await wxLogin();
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <View className="login">
      <View className="login__header">
        <Text className="login__title">自习座位预约</Text>
        <Text className="login__subtitle">登录后即可预约座位</Text>
      </View>

      <View className="login__content">
        <View className="login__icon">📚</View>

        <Button
          className="login__btn"
          type="primary"
          onClick={handleLogin}
        >
          微信一键登录
        </Button>

        <Text className="login__tip">
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  );
}