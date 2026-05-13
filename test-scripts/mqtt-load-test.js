/**
 * MQTT 消息吞吐量测试
 * 对应论文表@tbl:concurrent-test 中的 "MQTT消息" 项
 *
 * 测试方法：向 MQTT Broker 以 ~100条/秒 的速率发送座位状态消息，
 * 观察后端处理能力和资源占用。
 *
 * 运行前确保后端已启动（内含 Aedes MQTT Broker）。
 * 运行时可配合 `top -pid $(lsof -ti:3000)` 观察资源。
 *
 * 运行命令：node mqtt-load-test.js
 */

const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://localhost:1883';
const DEVICE_ID = 'seat-esp32-hcsr501-001';
const SENSOR_TOPIC = `device/${DEVICE_ID}/sensor`;
const TARGET_RATE = 100; // 条/秒
const DURATION_SECONDS = 30; // 持续30秒

function buildSensorPayload(occupied) {
  return JSON.stringify({
    deviceId: DEVICE_ID,
    timestamp: Date.now(),
    sensor: {
      type: 'infrared',
      value: occupied,
      confidence: 0.95,
    },
    metadata: {
      wifiStrength: -45,
    },
  });
}

async function main() {
  console.log('=== MQTT 消息吞吐量测试 ===');
  console.log(`目标速率: ${TARGET_RATE} 条/秒`);
  console.log(`持续时间: ${DURATION_SECONDS} 秒`);
  console.log(`预计总消息: ${TARGET_RATE * DURATION_SECONDS}`);
  console.log('');

  // 前置检查
  try {
    await fetch('http://localhost:3000/seats');
  } catch (err) {
    console.error('❌ 无法连接到 http://localhost:3000');
    console.error('请先运行 npm run start:dev');
    process.exit(1);
  }
  console.log('✅ 后端连接正常');
  console.log('提示: 请另开终端运行: top -pid $(lsof -ti:3000)');
  console.log('');

  const client = mqtt.connect(BROKER_URL, {
    clientId: `load-tester-${Date.now()}`,
    clean: true,
    connectTimeout: 5000,
  });

  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('error', reject);
    setTimeout(() => reject(new Error('MQTT connect timeout')), 10000);
  });

  console.log('MQTT 已连接，开始发送...');

  let sent = 0;
  const intervalMs = 1000 / TARGET_RATE;
  const startTime = Date.now();

  const timer = setInterval(() => {
    const payload = buildSensorPayload(sent % 2 === 0);
    client.publish(SENSOR_TOPIC, payload, { qos: 1 }, (err) => {
      if (err) console.error('publish error:', err.message);
    });
    sent++;

    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= DURATION_SECONDS) {
      clearInterval(timer);
      const actualRate = sent / elapsed;
      console.log('');
      console.log('--- 结果 ---');
      console.log(`实际发送: ${sent} 条`);
      console.log(`实际耗时: ${elapsed.toFixed(1)} 秒`);
      console.log(`实际速率: ${actualRate.toFixed(1)} 条/秒`);
      client.end();
      console.log('');
      console.log('请记录 top/htop 中观察到的 CPU% 和内存(MB)');
    }
  }, intervalMs);
}

main().catch(console.error);
