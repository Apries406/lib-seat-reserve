import { PropsWithChildren, useEffect } from 'react'
import Taro, { useLaunch, redirectTo } from '@tarojs/taro'
import { useUserStore } from './store/userStore';
import { disconnectSeatSocket, initSeatSocket } from './services/socket';
import './app.scss'

function App({ children }: PropsWithChildren) {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  useLaunch(() => {
  });

  useEffect(() => {
    if (isLoggedIn) {
      initSeatSocket();

      return () => {
        disconnectSeatSocket();
      };
    }

    disconnectSeatSocket();

    const currentPage = Taro.getCurrentPages().slice(-1)[0]?.route;
    if (currentPage !== 'pages/login/index') {
      redirectTo({ url: '/pages/login/index' });
    }
  }, [isLoggedIn]);

  return children
}

export default App
