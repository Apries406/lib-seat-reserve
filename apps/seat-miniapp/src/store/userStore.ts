import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { IUser } from '../types/user';
import { api } from '../services/api';

interface UserStore {
  user: IUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;

  setUser: (user: IUser) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserInfo: () => Promise<void>;
  clearAuth: () => void;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
};

const storedUser = Taro.getStorageSync(STORAGE_KEYS.USER_INFO) || null;

export const useUserStore = create<UserStore>((set, get) => ({
  user: storedUser,
  accessToken: Taro.getStorageSync(STORAGE_KEYS.ACCESS_TOKEN) || null,
  refreshToken: Taro.getStorageSync(STORAGE_KEYS.REFRESH_TOKEN) || null,
  isLoggedIn: !!Taro.getStorageSync(STORAGE_KEYS.ACCESS_TOKEN),

  setUser: (user) => {
    Taro.setStorageSync(STORAGE_KEYS.USER_INFO, user);
    set({ user, isLoggedIn: true });
  },

  setTokens: (accessToken, refreshToken) => {
    Taro.setStorageSync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    Taro.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    set({ accessToken, refreshToken });
  },

  login: async (code: string, deviceFingerprint?: string) => {
    try {
      const result = await api.login(code, deviceFingerprint);
      get().setTokens(result.accessToken, result.refreshToken);
      get().setUser(result.user);
      Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: error.message || '登录失败', icon: 'error' });
      throw error;
    }
  },

  logout: async () => {
    Taro.removeStorageSync(STORAGE_KEYS.ACCESS_TOKEN);
    Taro.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN);
    Taro.removeStorageSync(STORAGE_KEYS.USER_INFO);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
    });
  },

  refreshUserInfo: async () => {
    try {
      const user = await api.getProfile();
      get().setUser(user);
    } catch {
      get().clearAuth();
    }
  },

  clearAuth: () => {
    Taro.removeStorageSync(STORAGE_KEYS.ACCESS_TOKEN);
    Taro.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN);
    Taro.removeStorageSync(STORAGE_KEYS.USER_INFO);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
    });
  },
}));
