import Taro from '@tarojs/taro';

const STORAGE_KEY = 'device_fingerprint';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function generateDeviceFingerprint(): string {
  try {
    const info = Taro.getSystemInfoSync();
    const raw = `${info.model || ''}-${info.system || ''}-${info.platform || ''}-${info.deviceBrand || ''}-${info.deviceType || ''}`;
    return `fp_${simpleHash(raw)}`;
  } catch {
    return `fp_${Date.now().toString(36)}`;
  }
}

export function getDeviceFingerprint(): string {
  let fp = Taro.getStorageSync<string>(STORAGE_KEY);
  if (!fp) {
    fp = generateDeviceFingerprint();
    Taro.setStorageSync(STORAGE_KEY, fp);
  }
  return fp;
}

export function clearDeviceFingerprint(): void {
  Taro.removeStorageSync(STORAGE_KEY);
}
