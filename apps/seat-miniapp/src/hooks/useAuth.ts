import { useCallback } from 'react';
import Taro from '@tarojs/taro';
import { useUserStore } from '../store/userStore';

export function useAuth() {
  const { user, isLoggedIn, login, logout, refreshUserInfo } = useUserStore();

  const wxLogin = useCallback(async () => {
    try {
      const loginRes = await Taro.login();
      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败');
      }
      await login(loginRes.code);
    } catch (error: any) {
      Taro.showToast({ title: error.message || '登录失败', icon: 'error' });
      throw error;
    }
  }, [login]);

  const handleLogout = useCallback(async () => {
    const { confirm } = await Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
    });
    if (confirm) {
      await logout();
    }
  }, [logout]);

  return {
    user,
    isLoggedIn,
    wxLogin,
    logout: handleLogout,
    refreshUserInfo,
  };
}