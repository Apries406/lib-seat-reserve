/**
 * Redis+Lua 原子锁并发测试
 * 对应论文表@tbl:concurrent-test 中的 "Redis原子锁" 项
 *
 * 测试方法：并发发送 100 个预约同一座位的请求，
 * 验证仅 1 个成功，其余 99 个返回冲突。
 *
 * 运行前确保：
 * 1. seat id=1 的状态为 FREE
 * 2. 当前用户没有进行中的预约
 * 3. 后端已启动
 *
 * 运行命令：node redis-lock-test.js
 */

const CONCURRENT = 100;
const SEAT_ID = 1;
const BASE_URL = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZmY1NWQwOS02MjE5LTQ2ZGQtOWNkMC1jZjNmNzY3NjIzMDQiLCJvcGVuaWQiOiJvcXRCcDdmQ0ktWEZMSXNmX0V6U3A4Y1JJT1AwIiwiaWF0IjoxNzc4NjM5Njg3LCJleHAiOjE3NzkyNDQ0ODd9.P4HCbVVmvs6837Vdkmw-n2ZD93_R3Y2hnTB-nMcY8Z8';
const DEVICE_FP = 'fp_34fbedf7';

async function reserveSeat(index) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'X-Device-Fingerprint': DEVICE_FP,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seatId: SEAT_ID }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    return {
      index,
      status: res.status,
      elapsed,
      success: res.status === 201 || (body.code === 0),
      message: body.message || body.error || '',
    };
  } catch (err) {
    return { index, status: 0, elapsed: Date.now() - start, success: false, message: err.message };
  }
}

async function main() {
  console.log(`=== Redis 原子锁并发测试 ===`);
  console.log(`并发数: ${CONCURRENT}`);
  console.log(`目标座位: #${SEAT_ID}`);
  console.log('');

  // 前置检查：后端是否存活
  try {
    const health = await fetch(`${BASE_URL}/seats`, { method: 'HEAD' });
    if (!health.ok && health.status !== 404) {
      console.error(`❌ 后端未就绪: HTTP ${health.status}`);
      console.error('请先运行 npm run start:dev');
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ 无法连接到 ${BASE_URL}`);
    console.error('错误:', err.message);
    console.error('请先运行 npm run start:dev');
    process.exit(1);
  }

  console.log('✅ 后端连接正常，开始测试...\n');

  // 并发发送所有请求
  const promises = Array.from({ length: CONCURRENT }, (_, i) => reserveSeat(i));
  const results = await Promise.all(promises);

  const successCount = results.filter(r => r.success).length;
  const conflictCount = results.filter(r => !r.success && r.status === 409).length;
  const otherFailCount = results.filter(r => !r.success && r.status !== 409).length;

  const latencies = results.map(r => r.elapsed);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log('--- 结果统计 ---');
  console.log(`成功预约: ${successCount}`);
  console.log(`冲突拒绝 (409): ${conflictCount}`);
  console.log(`其他失败: ${otherFailCount}`);
  console.log('');
  console.log(`平均响应: ${avgLatency.toFixed(0)}ms`);
  console.log(`最小响应: ${minLatency}ms`);
  console.log(`最大响应: ${maxLatency}ms`);
  console.log('');

  if (successCount === 1 && conflictCount === CONCURRENT - 1) {
    console.log('✅ 测试通过: 仅1个成功，其余全部正确返回冲突');
  } else {
    console.log('⚠️  结果异常，请检查座位状态或是否有其他用户干扰');
    console.log('失败样例:', results.filter(r => !r.success).slice(0, 3).map(r => `${r.status}: ${r.message}`));
  }
}

main().catch(console.error);
