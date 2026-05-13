# 性能测试运行指南

## 前置条件

1. 启动后端（保持运行）
   ```bash
   cd apps/seat-api
   npm run start:dev
   ```
2. 确保 Redis、MySQL 已启动
3. 确保 seat #1 为 FREE 状态（Redis 锁测试用）
4. 建议先清理测试数据：
   ```bash
   # 在 MySQL 中执行
   DELETE FROM reservation WHERE userId LIKE 'test-%';
   UPDATE seat SET status = 'FREE' WHERE id = 1;
   ```

---

## 测试 1：Redis+Lua 原子锁直接测试

**对应论文**：表 @tbl:concurrent-test "Redis原子锁" 项

**终端 1（运行测试）**：
```bash
cd test-scripts
node redis-lua-direct-test.js
```

**预期输出**：
```
成功 (1):        1
座位被锁 (-1):   99
总耗时:          ~1-3ms
✅ 测试通过: 仅 1 个请求成功
```

**记录**：截图终端输出即可，无需 top。

---

## 测试 2：API 响应时间 + ab 并发测试

**对应论文**：表 @tbl:api-response-time、表 @tbl:concurrent-test "HTTP并发" 项

**终端 1（保持运行，观察资源）**：
```bash
top -pid $(lsof -ti:3000)
```
> macOS 用 `top -pid <PID>`；Linux 用 `top -p <PID>`。

**终端 2（运行测试）**：
```bash
cd test-scripts
bash performance-tests.sh
```

**记录**：
- 终端 2 的 API 响应时间结果（前 4 项）→ 填入 @tbl:api-response-time
- 终端 2 的 ab 结果（后 2 项）→ 填入 @tbl:concurrent-test
- 终端 1 的 top 截图（在 ab 运行期间 CPU% 和 MEM 列）

---

## 测试 3：MQTT 消息吞吐量测试

**对应论文**：表 @tbl:concurrent-test "MQTT消息" 项

**终端 1（保持运行，观察资源）**：
```bash
top -pid $(lsof -ti:3000)
```

**终端 2（运行测试）**：
```bash
cd test-scripts
node mqtt-load-test.js
```

**预期输出**：
```
实际发送: 2753 条
实际耗时: 30.0 秒
实际速率: 91.7 条/秒
```

**记录**：
- 终端 2 的输出截图
- 终端 1 的 top 截图（运行期间 CPU% 和 MEM）

---

## 测试 4：WebSocket 并发连接测试

**对应论文**：表 @tbl:concurrent-test "WebSocket连接" 项

**终端 1（保持运行，观察资源）**：
```bash
top -pid $(lsof -ti:3000)
```

**终端 2（运行测试）**：
```bash
cd test-scripts
node websocket-concurrent-test.js
```

**预期输出**：
```
成功连接: 500
失败连接: 0
总耗时: ~1200ms
平均每秒: ~400 连接
```

**记录**：
- 终端 2 的输出截图
- 终端 1 的 top 截图（连接建立期间和保持 10 秒期间的 CPU% / MEM）

---

## 快速命令速查

```bash
# 检查后端是否活着
curl http://localhost:3000/seats

# 查看后端进程 PID
lsof -ti:3000

# 一键清理测试预约（MySQL）
mysql -u root -p seat_reserve -e "DELETE FROM reservation WHERE userId LIKE 'test-%'; UPDATE seat SET status = 'FREE' WHERE id = 1;"

# 一键运行全部测试（4 个终端分别执行）
# 终端A: top -pid $(lsof -ti:3000)
# 终端B: cd test-scripts && node redis-lua-direct-test.js
# 终端B: cd test-scripts && bash performance-tests.sh
# 终端B: cd test-scripts && node mqtt-load-test.js
# 终端B: cd test-scripts && node websocket-concurrent-test.js
```
