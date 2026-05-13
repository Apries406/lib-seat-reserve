/**
 * Redis+Lua 原子锁直接测试
 * 对应论文表@tbl:concurrent-test 中的 "Redis原子锁" 项
 *
 * 绕过 HTTP/数据库层，直接用 100 个不同的 userId 并发调用 Lua 脚本，
 * 验证仅 1 个成功，其余 99 个正确返回冲突。
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const CONCURRENT = 100;
const SEAT_ID = 1;

// 读取后端的 Lua 脚本（保证测试用的是同一份代码）
const luaScript = fs.readFileSync(
  path.join(__dirname, '../apps/seat-api/src/modules/reservation/scripts/seat-reserve.lua'),
  'utf-8'
);

async function main() {
  const redis = new Redis({ host: 'localhost', port: 6379 });

  console.log('=== Redis+Lua 原子锁直接测试 ===');
  console.log(`并发数: ${CONCURRENT}`);
  console.log(`目标座位: #${SEAT_ID}`);
  console.log('');

  // 先清理目标座位的所有 Redis 锁
  const keysToDelete = [];
  for (let i = 0; i < CONCURRENT; i++) {
    keysToDelete.push(`user:seat:test-user-${i}`);
  }
  keysToDelete.push(`seat:lock:${SEAT_ID}`, `seat:reserved:${SEAT_ID}`);
  await redis.del(...keysToDelete);
  console.log('✅ 已清理 Redis 锁');
  console.log('');

  // 并发发送 100 个 eval 请求
  const promises = [];
  for (let i = 0; i < CONCURRENT; i++) {
    const userId = `test-user-${i}`;
    const keys = [
      `seat:lock:${SEAT_ID}`,
      `seat:reserved:${SEAT_ID}`,
      `user:seat:${userId}`,
    ];
    const args = [userId, '1800', '10']; // expireTime=1800s, lockTTL=10s
    promises.push(
      redis.eval(luaScript, keys.length, ...keys, ...args)
    );
  }

  const start = Date.now();
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;

  const successCount = results.filter(r => r === 1).length;
  const seatLockedCount = results.filter(r => r === -1).length;
  const seatReservedCount = results.filter(r => r === -2).length;
  const userHasReservationCount = results.filter(r => r === -3).length;

  console.log('--- 结果统计 ---');
  console.log(`成功 (1):        ${successCount}`);
  console.log(`座位被锁 (-1):   ${seatLockedCount}`);
  console.log(`座位已预约 (-2): ${seatReservedCount}`);
  console.log(`用户有预约 (-3): ${userHasReservationCount}`);
  console.log(`总耗时:          ${elapsed}ms`);
  console.log('');

  if (successCount === 1) {
    console.log('✅ 测试通过: 仅 1 个请求成功，其余全部正确返回冲突');
  } else {
    console.log('⚠️  结果异常');
  }

  // 清理
  await redis.del(...keysToDelete);
  await redis.quit();
}

main().catch(console.error);
