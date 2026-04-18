export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum DeviceCommandType {
  SYNC_TIME = 'sync_time',
  GET_STATUS = 'get_status',
  RESET = 'reset',
  CONFIG_UPDATE = 'config_update',
}

export interface ISensorDataMessage {
  deviceId: string;
  timestamp: number;
  sensor: {
    type: 'infrared';
    value: boolean;
    confidence: number;
  };
  metadata?: {
    batteryLevel?: number;
    wifiStrength?: number;
  };
}

export interface IDeviceStatusMessage {
  deviceId: string;
  online: boolean;
  timestamp: number;
}

export interface IDeviceCommand {
  command: DeviceCommandType;
  payload?: Record<string, any>;
  requestId: string;
}
