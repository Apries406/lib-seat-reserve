#import "@preview/cetz:0.3.2"

// ============================================================
// 第四章 系统实现
// ============================================================

= 系统实现

== 开发环境与项目结构

=== 开发工具与环境配置

开发环境配置如表@tbl:dev-env 所示。

#figure(
  table(
    columns: (1.5fr, 1fr, 2fr),
    align: center + horizon,
    table.header(
      [工具/软件], [版本], [用途]
    ),
    [Node.js], [v20], [JavaScript运行时],
    [pnpm], [v9], [包管理器],
    [MySQL], [v8.0], [关系型数据库],
    [Redis], [v7], [缓存与分布式锁],
    [Visual Studio Code], [最新版], [代码编辑器],
    [Arduino IDE], [最新版], [硬件代码开发],
    [Git], [v2+], [版本控制],
  ),
  caption: "开发环境配置",
) <tbl:dev-env>

=== Monorepo 项目结构

项目采用Monorepo架构，使用pnpm workspace管理。seat-api包按模块层组织代码，每个模块包含controller、service、entity、dto等子目录。

== 硬件层实现

=== ESP32 红外检测代码

ESP32代码实现了红外传感器状态读取、时间窗口观察和30秒心跳保活机制。时间窗口观察算法过滤90%以上的误触发，心跳机制支持后端精确判断设备在线状态。

=== 硬件连接与调试

硬件连接相对简单，HC-SR501的VCC接ESP32的3.3V，GND接GND，OUT接GPIO4。ESP32通过USB连接电脑进行固件烧录和串口调试。

调试工具包括串口监视器（验证ESP32输出）、MQTTX（验证MQTT消息）和万用表（排查电路）。开发过程中遇到并解决了以下典型问题：ESP32上电后WiFi连接不稳定，通过增加外部天线改善信号；HC-SR501传感器上电后约60秒预热期检测不稳定，部署时需预留预热时间；电源纹波导致偶发误触发，添加100μF滤波电容后解决。

== 后端服务层实现

=== MQTT Broker 搭建

后端采用Aedes库实现MQTT Broker，接收硬件上报消息后解析JSON、更新数据库，并通过Socket.io广播给前端。该方案无需额外部署独立Broker服务，便于在毕业设计阶段快速集成自定义业务逻辑。

=== Socket.io 实时推送

Socket.io实现了"房间"机制以实现按需推送。当用户进入座位页面时，前端调用`join_room(seatId)`加入该座位的Socket.io房间；离开页面时调用`leave_room(seatId)`退出。后端在座位状态变化时仅向目标房间的成员推送`SEAT_STATUS_CHANGE`事件，避免全局广播带来的性能开销。核心实现如代码清单@lst:socket-room 所示。

#figure(
  ```typescript
  // 前端：加入/离开房间
  socket.emit('join_room', seatId);
  socket.on('SEAT_STATUS_CHANGE', (data) => {
    seatStore.updateSeatStatus(data.seatId, data.status);
  });

  // 后端：Gateway房间隔离推送
  @WebSocketGateway()
  export class SeatGateway {
    @WebSocketServer()
    server: Server;

    emitSeatStatusChange(seatId: number, status: SeatStatus) {
      this.server.to(`seat:${seatId}`)
        .emit('SEAT_STATUS_CHANGE', { seatId, status });
    }
  }
  ```,
  caption: "Socket.io房间机制核心实现",
) <lst:socket-room>

=== Redis + Lua 分布式锁

座位预约是系统的核心并发场景。为防止高并发下同一座位被多个用户同时预约，系统采用Redis+Lua原子脚本实现分布式锁。Lua脚本保证"查锁-加锁"操作的原子性，避免竞态条件。关键特性是同用户重入支持：若同一用户已持有锁，再次请求时直接通过，不返回冲突。

核心Lua脚本如代码清单@lst:redis-lua 所示。

#figure(
  ```lua
  -- 原子性座位预约脚本（支持同用户重入）
  -- KEYS[1] = seat:lock:{seatId}
  -- KEYS[2] = seat:reserved:{seatId}
  -- KEYS[3] = user:seat:{userId}
  local locked = redis.call("GET", KEYS[1])
  if locked and locked ~= ARGV[1] then
    return -1
  end

  local reserved = redis.call("GET", KEYS[2])
  if reserved and reserved ~= ARGV[1] then
    return -2
  end

  local userSeat = redis.call("GET", KEYS[3])
  if userSeat and userSeat ~= KEYS[2] then
    return -3
  end

  redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[3])
  redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[2])
  redis.call("SET", KEYS[3], KEYS[2], "EX", ARGV[2])

  return 1
  ```,
  caption: "Redis+Lua原子预约锁脚本",
) <lst:redis-lua>

脚本中`ARGV[1]`为用户ID，若当前锁持有者与该用户相同，则允许重入。这一设计解决了智能推荐流程中`findCandidates`占位后`smartReserve`再次加锁导致的冲突问题。

=== 用户认证

用户认证采用JWT（JSON Web Token）方案，无状态设计利于分布式部署。微信小程序登录流程：前端调用`wx.login`获取code，后端用code向微信服务器换取openid，根据openid查询或创建用户，生成JWT返回前端。令牌有效期设为24小时。

=== 座位预约系统

预约功能的实现有几个要点：

==== 预约状态流转

座位状态机设计如图@fig:state-machine 所示。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    let state(x, y, t) = {
      circle((x, y), radius: 0.7, fill: blue.lighten(90%))
      content((x, y), text(size: 7pt)[#t])
    }
    let trans(x1, y1, x2, y2, t) = {
      line((x1, y1), (x2, y2), mark: (end: ">"))
      content(((x1 + x2)/2, (y1 + y2)/2), text(size: 6pt, fill: gray)[#t], anchor: "south")
    }

    state(-3, 0, [FREE])
    state(0, 2, [RESERVED])
    state(0, 0, [IN_USE])
    state(0, -2, [MAYBE_LEAVE])
    state(3, -2, [TEMP_LEAVE])

    trans(-2.3, 0.5, -0.7, 1.5, [预约])
    trans(-0.7, -1.5, -2.3, -0.5, [超时释放])
    trans(0, 1.3, 0, 0.7, [签到])
    trans(0, -0.7, 0, -1.3, [传感器检测无人])
    trans(0.7, -2, 2.3, -2, [暂离])
    trans(2.3, -1.5, 0.7, -1.5, [返回])
    trans(0.7, 1.5, -2.3, 0.5, [签退/释放])
  }),
  caption: "座位状态机",
) <fig:state-machine>

状态流转规则如下：

+ FREE → RESERVED：用户发起预约，Redis加锁成功，数据库创建Reservation记录。
+ RESERVED → IN_USE：用户签到（扫码/位置验证/传感器自动检测）。
+ IN_USE → MAYBE_LEAVE：传感器连续检测到无人超过阈值。
+ MAYBE_LEAVE → TEMP_LEAVE：用户主动发起暂离。
+ TEMP_LEAVE → FREE：暂离超过1小时未返回，定时任务自动释放。
+ 任意状态 → FREE：用户主动释放、管理员强制释放或超时释放。

==== 犹豫期锁定机制

智能推荐流程中，系统为用户预留推荐座位并进入IN_JUDGE犹豫状态，限时60秒。用户需在限时内确认，否则座位自动释放。该机制防止用户恶意获取推荐结果但长期不确认，占用系统资源。

`JudgeScheduler`每10秒扫描一次过期IN_JUDGE座位，自动释放并解锁。释放顺序为先`releaseSeat`后`unlock`，防止状态不一致。

=== HMAC-SHA256 签名二维码

扫码签到功能需要防止二维码被截图转发或伪造。系统采用HMAC-SHA256签名机制：后端使用预共享密钥对座位ID进行签名，生成格式为`seat:{seatId}:{signature}`的二维码内容。小程序扫码后，后端重新计算签名进行比对，验证通过后才允许签到。

签名算法：

```typescript
const signature = createHmac('sha256', QR_SECRET)
  .update(`seatId=${seatId}&type=seat`)
  .digest('hex')
  .slice(0, 16);
```

该方案的优势在于：二维码不包含任何敏感用户信息，即使被截图转发，他人扫码后也仅能查看座位状态（系统会检测用户是否已有其他进行中的预约），无法冒名签到。

=== 位置验证签到

位置验证签到通过计算用户当前GPS坐标与座位坐标的直线距离来判断是否在场。系统使用Haversine公式计算地球表面两点间距离：

```typescript
function calculateDistance(lat1, lon1, lat2, lon2): number {
  const R = 6371e3; // 地球半径（米）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 距离（米）
}
```

签到阈值设为100米。边界情况处理：若座位未配置坐标（latitude/longitude为null），直接拒绝位置验证签到，防止NaN穿透导致任意位置均可签到。

=== 设备指纹防账号共享

为防止用户将账号借给他人使用，系统实现了设备指纹机制。小程序端通过`Taro.getSystemInfoSync()`获取设备型号、系统版本、屏幕分辨率等信息，生成唯一设备指纹；每次HTTP请求携带`X-Device-Fingerprint`头部，后端检测同一账号是否在短时间内从多个不同设备登录，若发现异常则触发安全预警。

=== 信誉分管理

信誉分管理由`UserService`和`TempLeaveScheduler`协同实现。`UserService`提供`deductCreditScore`方法，根据违规类型扣减不同分数；`TempLeaveScheduler`每5分钟扫描暂离超时座位，对超时用户执行扣分并释放座位。

信誉分每日恢复由定时任务在凌晨执行：

```typescript
async recoverCreditScore() {
  const users = await this.userRepo.find({
    where: { creditScore: LessThan(100) }
  });
  for (const user of users) {
    user.creditScore = Math.min(100, user.creditScore + 5);
    await this.userRepo.save(user);
  }
}
```

=== 暂离超时处理

`TempLeaveScheduler`每5分钟扫描一次TEMP_LEAVE状态座位。对于超时的座位，处理流程为：

+ 查询该座位对应的ACTIVE预约记录。
+ 将预约状态改为COMPLETED，记录checkedOutAt。
+ 调用`userService.deductCreditScore`扣减用户信誉分。
+ 调用`seatService.updateStatus`将座位释放为FREE。

处理过程中若发生异常，系统会尝试回滚预约状态，防止因部分失败导致的数据不一致。

== 前端应用层实现

=== Taro 小程序端

小程序端采用Taro 4 + React 18框架。核心页面包括：首页（智能预约入口，偏好选择，当前预约状态展示）、座位选择（区域Tab切换，座位矩阵，状态图例）、座位详情（座位信息，预约按钮，确认弹窗）、签到页（扫码/位置验证入口）和个人中心（预约记录，信誉分，收藏）。

前端通过Socket.io-client连接后端，监听`SEAT_STATUS_CHANGE`事件，收到后更新局部seat store，React组件自动重新渲染。

=== 智能预约页面

智能预约页面是系统的核心交互页面，实现如代码清单@lst:smart-reserve 所示。

#figure(
  ```tsx
  const handleSmartReserve = useCallback(async () => {
    if (currentReservation) {
      showToast({ title: '您已有进行中的预约', icon: 'none' });
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.previewSeat({
        nearWindow: preferences.nearWindow || undefined,
        hasOutlet: preferences.hasOutlet || undefined,
        isQuiet: preferences.isQuiet || undefined,
        floor: preferences.floor === 'any' ? undefined : preferences.floor,
        acceptAdjustment: preferences.acceptAdjustment,
      });
      previewSeatRef.current = result.seat;
      startCountdown(result.expiresIn || 60);
      const { confirm } = await showModal({
        title: '确认预约',
        content: `为您推荐座位：${result.seat.area}区 ${result.seat.seatNumber}`,
        confirmText: '确认', cancelText: '取消',
      });
      if (confirm) {
        await handleConfirmPreview(result.seat.id);
      } else {
        await handleCancelPreview(result.seat.id);
      }
    } catch (error: any) {
      const message = error.message || '预约失败';
      if (message.includes('暂无符合偏好') && !preferences.acceptAdjustment) {
        const { confirm } = await showModal({
          title: '预约失败',
          content: message + '，是否开启「接受调剂」重试？',
          confirmText: '开启并重试',
        });
        if (confirm) {
          setPreferences(prev => ({ ...prev, acceptAdjustment: true }));
          setTimeout(() => handleSmartReserve(), 300);
        }
      }
    } finally { setIsLoading(false); }
  }, [preferences, currentReservation, ...]);
  ```,
  caption: "智能预约核心交互逻辑",
) <lst:smart-reserve>

=== 实时消息处理时序

系统端到端实时数据流如图@fig:sequence-mqtt 所示。硬件端检测到状态变化后，经MQTT上报至后端Broker；后端解析消息、更新数据库，并通过Socket.io向目标座位房间内的所有前端客户端推送状态更新。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    let actor(x, t) = {
      rect((x - 0.8, 4.5), (x + 0.8, 5.1), fill: blue.lighten(90%), radius: 0.05)
      content((x, 4.8), text(size: 7pt)[#t])
      line((x, 4.5), (x, -1))
    }
    actor(-4, [红外传感器])
    actor(-1.5, [ESP32])
    actor(1, [MQTT Broker])
    actor(3.5, [后端服务])
    actor(6, [前端])

    let msg(y, x1, x2, t) = {
      line((x1, y), (x2, y), mark: (end: ">"))
      content(((x1 + x2)/2, y + 0.15), text(size: 6pt)[#t], anchor: "south")
    }
    msg(3.5, -4, -1.5, [状态变化])
    msg(2.5, -1.5, 1, [MQTT消息])
    msg(1.5, 1, 3.5, [订阅转发])
    content((3.5, 0.5), text(size: 6pt)[更新数据库], anchor: "south")
    msg(-0.5, 3.5, 6, [WebSocket推送])
  }),
  caption: "MQTT消息端到端处理时序图",
) <fig:sequence-mqtt>

== 本章小结

本章描述了系统各层的实现细节：硬件层完成ESP32时间窗口检测和MQTT上报；后端实现MQTT Broker、Socket.io推送、JWT认证、Redis+Lua分布式锁、预约状态机、HMAC-SHA256签名二维码、位置验证签到、设备指纹防共享、信誉分管理和暂离超时处理；前端完成Taro小程序，通过Socket.io实现实时更新。
