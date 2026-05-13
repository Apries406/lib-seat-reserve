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

=== OLED 状态显示屏驱动

每个座位节点配备一块SSD1306 0.96寸OLED显示屏，通过I2C接口与ESP32连接。接线方式为：VCC→3.3V，GND→GND，SDA→GPIO21，SCL→GPIO22。OLED负责实时展示座位状态和签到二维码，增强现场用户的交互体验。

ESP32通过`Adafruit_SSD1306`库驱动屏幕，通过`ricmoo/QRCode`库生成二维码图案。二维码采用Version 1规格（21×21模块），在128×64屏幕上以2像素/模块缩放后尺寸为42×42像素，居中显示，扫描识别率良好。屏幕布局设计如表@tbl:oled-layout 所示。

#figure(
  table(
    columns: (1.5fr, 1fr, 2.5fr),
    align: center + horizon,
    table.header(
      [区域], [尺寸], [内容]
    ),
    [顶部状态栏], [128×10px], [座位号（左侧）+ 状态文字（右侧）],
    [分隔线], [128×1px], [横向直线分隔],
    [主体区域], [128×53px], [二维码图案（预约/使用状态）或状态大字（空闲状态）],
  ),
  caption: "OLED屏幕布局设计",
) <tbl:oled-layout>

ESP32订阅后端下发的`server/device/{deviceId}/display`主题，接收JSON格式的显示数据，解析后刷新屏幕。显示数据包括`status`（状态）、`seatNumber`（座位号）、`qrToken`（二维码内容）和`expiresIn`（过期秒数）。核心显示刷新逻辑如代码清单@lst:oled-display 所示。

#figure(
  ```cpp
  void refreshDisplay() {
    display.clearDisplay();
    // 顶部状态栏：座位号 + 状态
    display.setCursor(0, 0);
    display.print("SEAT " + displaySeatNumber);
    display.setCursor(80, 0);
    display.print(displayStatus);  // FREE / RSRV / USE / LEAVE
    display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
    if (displayQrToken.length() > 0 &&
        (displayStatus == "RESERVED" || displayStatus == "IN_USE")) {
      // 居中渲染42×42二维码
      drawQrCode(displayQrToken, 43, 14, 2);
    } else {
      display.setTextSize(2);
      display.setCursor(20, 28);
      display.print("FREE");
    }
    display.display();
  }
  ```,
  caption: "OLED显示刷新核心逻辑",
) <lst:oled-display>

后端在座位状态发生变化时（预约、签到、释放等），自动向对应设备的MQTT display主题推送最新的显示数据，实现硬件屏幕与系统状态的实时同步。具体实现见后端MQTT显示推送章节。

== 后端服务层实现

=== MQTT Broker 搭建

后端采用Aedes库实现MQTT Broker，接收硬件上报消息后解析JSON、更新数据库，并通过Socket.io广播给前端。该方案无需额外部署独立Broker服务，便于在毕业设计阶段快速集成自定义业务逻辑。

=== MQTT 显示数据推送

为支持硬件端OLED屏幕实时刷新，后端在座位状态发生变更时，主动向对应设备推送显示数据。系统通过`MqttService.publishDisplay`方法，向`server/device/{deviceId}/display`主题发布JSON消息，内容包括座位号、状态、签到二维码token和过期时间。

`SeatService`在`updateStatus`、`reserveSeat`和`releaseSeat`三个核心状态变更方法中，均调用`publishDisplay`方法同步屏幕内容。为避免`DeviceModule`与`SeatModule`之间的循环依赖，采用NestJS的`forwardRef`机制延迟解析依赖。当座位被预约或处于使用中状态时，系统生成HMAC-SHA256签名的二维码token推送到设备；当座位释放为空闲状态时，则清空二维码只显示状态文字。核心实现如代码清单@lst:mqtt-display 所示。

#figure(
  ```typescript
  private publishDisplay(seat: Seat) {
    if (!seat.deviceId) return;
    const qrToken = seat.status === SeatStatus.RESERVED
                    || seat.status === SeatStatus.IN_USE
      ? this.qrCodeService.generateSeatQrToken(seat.id)
      : undefined;
    this.mqttService.publishDisplay(seat.deviceId, {
      status: seat.status,
      seatNumber: seat.seatNumber,
      qrToken,
      expiresIn: seat.reservedUntil
        ? Math.floor((seat.reservedUntil.getTime() - Date.now()) / 1000)
        : undefined,
    });
  }
  ```,
  caption: "MQTT显示数据推送核心逻辑",
) <lst:mqtt-display>

该设计保证了硬件屏幕与数据库状态的一致性：任何导致座位状态变更的操作（用户预约、签到、超时释放、暂离等）都会触发一次MQTT推送，屏幕在数百毫秒内完成刷新。

=== Socket.io 实时推送

Socket.io @socketio_docs 实现了"房间"机制以实现按需推送。当用户进入座位页面时，前端调用`join_room(seatId)`加入该座位的Socket.io房间；离开页面时调用`leave_room(seatId)`退出。后端在座位状态变化时仅向目标房间的成员推送`SEAT_STATUS_CHANGE`事件，避免全局广播带来的性能开销。核心实现如代码清单@lst:socket-room 所示。

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

用户认证采用JWT（JSON Web Token）@jwt_rfc 方案，无状态设计利于分布式部署。微信小程序登录流程：前端调用`wx.login`获取code，后端用code向微信服务器换取openid，根据openid查询或创建用户，生成JWT返回前端。令牌有效期设为24小时。

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

=== 系统主要界面展示

系统前端采用Taro框架开发微信小程序，主要界面按照用户操作流程设计，涵盖登录、预约、签到、历史查询和个人中心等核心环节。

*（1）登录界面。* 用户首次进入小程序时，需授权微信登录。系统通过`wx.login`获取code，后端换取openid并完成用户注册或查询，生成JWT令牌返回前端。登录界面如 @fig:ui-login 所示。

#figure(
  image("../figures/examples/login.png", width: 35%),
  caption: "小程序登录界面",
) <fig:ui-login>

*（2）首页与智能预约。* 登录后进入首页，顶部展示当前进行中的预约及签到入口，中部为智能预约偏好选择区，用户可选择靠窗、有插座、安静区等偏好，并设置楼层偏好。开启「接受调剂」后，系统在无严格匹配座位时将自动放宽条件。首页界面如 @fig:ui-home 所示，智能预约偏好选择如 @fig:ui-smart 所示。

#figure(
  image("../figures/examples/home-reversed.png", width: 35%),
  caption: "小程序首页",
) <fig:ui-home>

#figure(
  image("../figures/examples/smart-reverse.png", width: 35%),
  caption: "智能预约偏好选择",
) <fig:ui-smart>

*（3）单座位选择。* 除智能推荐外，用户也可进入单座位选择页面，按区域浏览座位矩阵。每个座位卡片显示属性图标（靠窗、有插座、安静区）和实时状态。单座位选择界面如 @fig:ui-seat-select 所示。

#figure(
  image("../figures/examples/signle-seat-reverse.png", width: 35%),
  caption: "单座位选择界面",
) <fig:ui-seat-select>

*（4）预约确认。* 用户点击「一键预约」后，系统根据多维度评分算法推荐最优座位，弹出确认对话框，显示推荐座位信息和60秒倒计时。用户需在犹豫期内确认，否则座位自动释放。预约确认弹窗如 @fig:ui-confirm 所示。

#figure(
  image("../figures/examples/reverse-confirm.png", width: 35%),
  caption: "预约确认弹窗",
) <fig:ui-confirm>

*（5）签到界面。* 预约成功后，用户需在30分钟内到达座位并签到。签到页面显示预约倒计时、座位信息和签到方式选择（扫码签到或自动定位签到）。签到界面如 @fig:ui-checkin 所示。

#figure(
  image("../figures/examples/checkin.png", width: 35%),
  caption: "签到界面",
) <fig:ui-checkin>

*（6）预约历史。* 用户可在「历史记录」中查看过往预约，列表显示座位号、区域、预约日期和状态。预约历史界面如 @fig:ui-history 所示。

#figure(
  image("../figures/examples/reverse-history.png", width: 35%),
  caption: "预约历史界面",
) <fig:ui-history>

*（7）个人中心与信誉分管理。* 「我的」页面展示用户基本信息、信誉分和功能入口。信誉分明细页面记录每次加减分的原因和时间。当用户信誉分低于65分时，系统将在预约时拦截并提示限制原因。个人中心、信誉分明细和信誉分过低拦截提示分别如 @fig:ui-profile 、 @fig:ui-score-detail 和 @fig:ui-low-score 所示。

#figure(
  image("../figures/examples/profile.png", width: 35%),
  caption: "个人中心界面",
) <fig:ui-profile>

#figure(
  image("../figures/examples/score-detail.png", width: 35%),
  caption: "信誉分明细界面",
) <fig:ui-score-detail>

#figure(
  image("../figures/examples/lower-score.png", width: 35%),
  caption: "信誉分过低拦截提示",
) <fig:ui-low-score>

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

== 数据库物理设计

=== 数据表结构

系统采用MySQL 8.0作为持久化数据库，TypeORM根据实体定义自动生成物理表结构。各核心实体的物理表结构设计如下。

Seats表存储座位基本信息，是查询最频繁的表。字段包括id（主键自增）、area（所属区域）、seatNumber（座位编号）、status（ENUM类型状态）、deviceId（绑定硬件ID）、latitude与longitude（DECIMAL类型地理坐标）、floor（楼层）、building（楼栋）、attributes（JSON类型座位属性）、currentUserId（当前占用用户ID）、reservedUntil（预约保留截止时间）和judgeExpiresAt（犹豫期截止时间）。

#figure(
  table(
    columns: (1.5fr, 1fr, 2.5fr),
    align: center + horizon,
    table.header(
      [字段], [类型], [说明]
    ),
    [id], [INT], [座位ID（主键，自增）],
    [area], [VARCHAR(50)], [所属区域（如A区）],
    [seatNumber], [VARCHAR(20)], [座位编号（如A-01）],
    [status], [ENUM], [状态（FREE/RESERVED/IN_USE/MAYBE_LEAVE/TEMP_LEAVE）],
    [deviceId], [VARCHAR(50)], [绑定硬件设备ID],
    [latitude], [DECIMAL], [座位纬度（位置验证用）],
    [longitude], [DECIMAL], [座位经度（位置验证用）],
    [floor], [VARCHAR(20)], [楼层（如1楼）],
    [building], [VARCHAR(50)], [楼栋（如图书馆）],
    [attributes], [JSON], [座位属性（靠窗/有插座/安静区）],
    [currentUserId], [VARCHAR(50)], [当前占用用户ID],
    [reservedUntil], [DATETIME], [预约保留截止时间],
    [judgeExpiresAt], [DATETIME], [犹豫期截止时间],
  ),
  caption: "Seats表结构",
) <tbl:seats-table>

Reservations表存储用户的预约记录。字段包括id（主键自增）、userId（用户ID）、seatId（座位ID）、status（预约状态）、checkedInAt（签到时间）、checkedOutAt（签退时间）、createdAt（创建时间）和updatedAt（更新时间）。其中userId关联Users表主键，seatId关联Seats表主键。

#figure(
  table(
    columns: (1.5fr, 1fr, 2.5fr),
    align: center + horizon,
    table.header(
      [字段], [类型], [说明]
    ),
    [id], [INT], [预约ID（主键，自增）],
    [userId], [VARCHAR(50)], [用户ID（外键）],
    [seatId], [INT], [座位ID（外键）],
    [status], [ENUM], [状态（PENDING/ACTIVE/COMPLETED/CANCELLED）],
    [checkedInAt], [DATETIME], [签到时间],
    [checkedOutAt], [DATETIME], [签退时间],
    [createdAt], [DATETIME], [创建时间],
    [updatedAt], [DATETIME], [更新时间],
  ),
  caption: "Reservations表结构",
) <tbl:reservations-table>

Users表存储用户基本信息与信誉分。字段包括id（主键）、wxOpenid（微信OpenID，唯一索引）、nickname（昵称）、creditScore（信誉分，默认100）、role（ENUM类型角色）和createdAt（创建时间）。

#figure(
  table(
    columns: (1.5fr, 1fr, 2.5fr),
    align: center + horizon,
    table.header(
      [字段], [类型], [说明]
    ),
    [id], [VARCHAR(50)], [用户ID（主键）],
    [wxOpenid], [VARCHAR(100)], [微信OpenID（唯一）],
    [nickname], [VARCHAR(50)], [昵称],
    [creditScore], [INT], [信誉分（默认100）],
    [role], [ENUM], [角色（student/admin）],
    [createdAt], [DATETIME], [创建时间],
  ),
  caption: "Users表结构",
) <tbl:users-table>

SeatStatusLog表记录座位状态的每次变更，用于审计追溯和数据分析。字段包括id（UUID主键）、seatId（座位ID）、previousStatus（变更前状态）、currentStatus（变更后状态）、trigger（触发原因枚举）、userId（操作用户ID）和createdAt（创建时间）。

#figure(
  table(
    columns: (1.5fr, 1fr, 2.5fr),
    align: center + horizon,
    table.header(
      [字段], [类型], [说明]
    ),
    [id], [VARCHAR(50)], [日志ID（UUID）],
    [seatId], [INT], [座位ID],
    [previousStatus], [ENUM], [变更前状态],
    [currentStatus], [ENUM], [变更后状态],
    [trigger], [ENUM], [触发原因（RESERVE/RELEASE/CHECKIN/TIMEOUT等）],
    [userId], [VARCHAR(50)], [操作用户ID],
    [createdAt], [DATETIME], [创建时间],
  ),
  caption: "SeatStatusLog表结构",
) <tbl:seat-status-log-table>

=== 主外键对应关系

系统各表之间的关联关系通过外键约束实现，对应E-R图中的实体关联。Reservations表的userId字段外键关联Users表的id主键，建立用户与预约的一对多关系；Reservations表的seatId字段外键关联Seats表的id主键，建立座位与预约的一对多关系；SeatStatusLog表的seatId字段外键关联Seats表的id主键，建立座位与状态日志的一对多关系；Seats表的currentUserId字段逻辑关联Users表的id主键，标识当前占用用户，但该字段允许为空（FREE状态时无占用用户）。TypeORM通过装饰器`@ManyToOne`和`@JoinColumn`声明外键关系，自动生成数据库外键约束，保证数据参照完整性。

=== 索引设计

索引设计遵循"按需创建"原则，结合查询场景分析建立。Seats表按area、status、floor建立复合索引，支持按区域、状态和楼层组合条件快速筛选座位列表；Reservations表按userId、status建立复合索引，优化查询用户当前进行中的预约记录；SeatStatusLog表按seatId、createdAt建立索引，支持按座位ID查询状态变更历史并按时间排序。此外，Users表的wxOpenid字段建立唯一索引，保证微信OpenID不重复，加速登录查询。索引策略在查询性能与写入性能之间取得平衡，避免过多索引影响数据插入效率。

== 本章小结

本章描述了系统各层的实现细节：硬件层完成ESP32时间窗口检测、MQTT上报和SSD1306 OLED状态显示屏驱动，屏幕实时展示座位号、状态文字和签到二维码；后端实现MQTT Broker、MQTT显示数据推送、Socket.io推送、JWT认证、Redis+Lua分布式锁、预约状态机、HMAC-SHA256签名二维码、位置验证签到、设备指纹防共享、信誉分管理和暂离超时处理；前端完成Taro小程序，通过Socket.io实现实时更新；数据库物理设计给出了Seats、Reservations、Users和SeatStatusLog四张核心表的字段结构、主外键对应关系和索引策略。
