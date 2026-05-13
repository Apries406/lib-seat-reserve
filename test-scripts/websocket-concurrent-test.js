/**
 * WebSocket 并发连接测试
 * 对应论文表@tbl:concurrent-test 中的 "WebSocket连接" 项
 *
 * 测试方法：同时建立 N 个 WebSocket 连接，观察后端资源占用。
 * 运行时可配合 `htop` 或 `top` 查看 CPU/内存。
 *
 * 运行命令：node websocket-concurrent-test.js
 */

const { io } = require('socket.io-client');

const CONCURRENT = 500;
const BASE_URL = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZmY1NWQwOS02MjE5LTQ2ZGQtOWNkMC1jZjNmNzY3NjIzMDQiLCJvcGVuaWQiOiJvcXRCcDdmQ0ktWEZMSXNmX0V6U3A4Y1JJT1AwIiwiaWF0IjoxNzc4NjM5Njg3LCJleHAiOjE3NzkyNDQ0ODd9.P4HCbVVmvs6837Vdkmw-n2ZD93_R3Y2hnTB-nMcY8Z8';

async function createConnection(index) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      auth: { token: TOKEN },
      reconnection: false,
      timeout: 10000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      resolve({ index, success: false, error: 'timeout' });
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve({ index, success: true, socket });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      resolve({ index, success: false, error: err.message });
    });
  });
}

async function main() {
  console.log(`=== WebSocket 并发连接测试 ===`);
  console.log(`目标并发数: ${CONCURRENT}`);
  console.log(`请同时打开另一个终端运行: top -pid $(lsof -ti:3000)`);
  console.log('');

  const start = Date.now();
  const batchSize = 50; // 每批50个，避免瞬间冲击
  const connections = [];

  for (let i = 0; i < CONCURRENT; i += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, CONCURRENT - i) },
      (_, j) => createConnection(i + j)
    );
    const results = await Promise.all(batch);
    connections.push(...results);
    process.stdout.write(`\r已连接: ${connections.filter(c => c.success).length} / ${CONCURRENT}`);
    await new Promise(r => setTimeout(r, 100));
  }

  const elapsed = Date.now() - start;
  const successCount = connections.filter(c => c.success).length;
  const failCount = connections.filter(c => !c.success).length;

  console.log('');
  console.log('');
  console.log('--- 结果统计 ---');
  console.log(`成功连接: ${successCount}`);
  console.log(`失败连接: ${failCount}`);
  console.log(`总耗时: ${elapsed}ms`);
  console.log(`平均每秒: ${(successCount / (elapsed / 1000)).toFixed(1)} 连接`);
  console.log('');

  // 保持连接10秒，方便观察资源占用
  console.log('保持连接 10 秒，请观察 CPU/内存占用...');
  await new Promise(r => setTimeout(r, 10000));

  // 断开所有连接
  connections.filter(c => c.success).forEach(c => c.socket.disconnect());
  console.log('已断开所有连接');
}

main().catch(console.error);
