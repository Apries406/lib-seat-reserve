import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { SensorProcessorService } from './sensor-processor.service';
import { ISensorDataMessage, IDeviceStatusMessage, IDeviceCommand, DeviceCommandType } from '../enums/device.enum';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly sensorProcessor: SensorProcessorService,
  ) {}

  async onModuleInit() {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER') || 'mqtt://localhost:1883';

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: `nestjs-server-${Date.now()}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
      });

      this.client.on('connect', () => {
        this.logger.log('MQTT connected to broker');
        this.subscribeDeviceTopics();
      });

      this.client.on('error', (err) => {
        this.logger.error('MQTT connection error:', err.message);
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });
    } catch (err) {
      this.logger.warn('MQTT broker not available, device communication disabled');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }

  private subscribeDeviceTopics() {
    this.client.subscribe('device/+/sensor', { qos: 1 });
    this.client.subscribe('device/+/status', { qos: 1 });
    this.logger.log('Subscribed to device topics');
  }

  private async handleMessage(topic: string, message: Buffer) {
    try {
      const payload = JSON.parse(message.toString());
      const topicParts = topic.split('/');
      const deviceId = topicParts[1];
      const messageType = topicParts[2];

      switch (messageType) {
        case 'sensor':
          await this.sensorProcessor.process(deviceId, payload as ISensorDataMessage);
          break;
        case 'status':
          this.logger.log(`Device ${deviceId} is ${payload.online ? 'online' : 'offline'}`);
          break;
      }
    } catch (err) {
      this.logger.error(`Error handling message on ${topic}:`, err.message);
    }
  }

  publishCommand(deviceId: string, command: IDeviceCommand) {
    if (!this.client?.connected) {
      this.logger.warn('MQTT not connected, cannot send command');
      return;
    }
    const topic = `server/device/${deviceId}/command`;
    this.client.publish(topic, JSON.stringify(command), { qos: 1 });
    this.logger.log(`Sent command ${command.command} to ${deviceId}`);
  }
}
