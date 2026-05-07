declare module 'weapp.socket.io' {
  interface SocketOptions {
    transports?: string[];
    reconnection?: boolean;
  }

  interface SocketClient {
    on(event: string, handler: (...args: any[]) => void): SocketClient;
    off(event: string, handler?: (...args: any[]) => void): SocketClient;
    emit(event: string, ...args: any[]): SocketClient;
    disconnect(): void;
  }

  export default function io(uri: string, options?: SocketOptions): SocketClient;
}
