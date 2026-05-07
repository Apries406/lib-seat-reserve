import { View, Text, Button, Input, Image } from '@tarojs/components';
import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { useUserStore } from '../../store/userStore';
import './index.scss';

export default function Login() {
  const { wxLogin, isLoggedIn } = useAuth();
  const { refreshUserInfo } = useUserStore();
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [step, setStep] = useState<'auth' | 'info'>('auth');

  const fromProfile = Taro.getCurrentInstance().router?.params.from === 'profile';

  useEffect(() => {
    if (isLoggedIn) {
      if (fromProfile) {
        setStep('info');
      } else {
        Taro.switchTab({ url: '/pages/index/index' });
      }
    }
  }, [isLoggedIn]);

  const handleAuth = async () => {
    try {
      await wxLogin();
      setStep('info');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleChooseAvatar = async (e: any) => {
    const url = e.detail.avatarUrl;
    setAvatarUrl(url);
  };

  const handleSubmit = async () => {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    try {
      await api.updateProfile({ nickname: nickname.trim(), avatar: avatarUrl });
      await refreshUserInfo();
      if (fromProfile) {
        Taro.navigateBack();
      } else {
        Taro.switchTab({ url: '/pages/index/index' });
      }
    } catch (error) {
      console.error('Update profile failed:', error);
      if (fromProfile) {
        Taro.navigateBack();
      } else {
        Taro.switchTab({ url: '/pages/index/index' });
      }
    }
  };

  if (step === 'info') {
    return (
      <View className="login">
        <View className="login__header">
          <Text className="login__title">完善资料</Text>
          <Text className="login__subtitle">让我们更好地为您服务</Text>
        </View>
        <View className="login__content">
          <View className="login__avatar-section">
            <Button className="login__avatar-btn" open-type="chooseAvatar" onChooseAvatar={handleChooseAvatar}>
              {avatarUrl ? (
                <Image className="login__avatar-img" src={avatarUrl} mode="aspectFill" />
              ) : (
                <Text className="login__avatar-placeholder">点击选择头像</Text>
              )}
            </Button>
          </View>
          <View className="login__nickname-section">
            <Text className="login__label">昵称</Text>
            <Input
              className="login__input"
              type="nickname"
              placeholder="请输入昵称"
              value={nickname}
              onInput={(e: any) => setNickname(e.detail.value)}
            />
          </View>
          <Button className="login__btn" type="primary" onClick={handleSubmit}>
            完成
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="login">
      <View className="login__header">
        <Text className="login__title">自习座位预约</Text>
        <Text className="login__subtitle">登录后即可预约座位</Text>
      </View>
      <View className="login__content">
        <View className="login__icon">📚</View>
        <Button className="login__btn" type="primary" onClick={handleAuth}>
          微信一键登录
        </Button>
        <Text className="login__tip">登录即表示同意《用户协议》和《隐私政策》</Text>
      </View>
    </View>
  );
}