#import "@preview/cetz:0.3.2"

// ============================================================
// 第三章 系统设计
// ============================================================

= 系统设计

本章首先进行系统需求分析，明确系统的功能目标和非功能约束；在此基础上，详细阐述系统架构设计方案，包括架构演进过程、硬件层设计、后端架构设计、数据库设计、API接口设计和核心算法设计。

== 系统需求分析

=== 系统总体目标

本系统的设计目标是解决"找座位难、占座严重、签到核验困难"的问题。该问题可从以下几个维度进行拆解：

==== 实时性目标

实时性是系统最重要的目标。用户打开小程序后，看到的座位状态应为当前时刻的状态，而非历史数据。

+ *端到端延迟*：硬件检测到状态变化到前端展示，整个链路控制在5秒以内。
+ *心跳保活*：硬件每30秒发送一次心跳包，支持后端判断设备在线状态。

==== 易用性目标

系统面向学生用户，若操作过于复杂，将影响用户使用意愿。

+ *界面响应时间*：用户点击操作，界面反馈时间#sym.lt 200ms。
+ *学习成本*：新用户5分钟内掌握基本操作流程。

==== 成本目标

成本控制影响系统落地推广的经济可行性。

+ *单座位硬件成本*：当前ESP32方案核心器件约¥35。
+ *部署成本*：ESP32方案支持无线部署，无需破墙布线。

=== 功能需求分析

功能需求通过用户访谈、竞品分析和场景模拟三种方式获取。系统用例图如图@fig:use-case 所示，主要参与者包括学生用户和管理员两类角色。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    // 边界
    rect((-4.5, -3.5), (4.5, 3.5), stroke: (dash: "dashed"))
    content((0, 3.7), [图书馆座位预约系统], anchor: "south", size: 10pt)

    // 参与者 - 学生
    circle((-6.5, 2), radius: 0.4, fill: gray.lighten(80%))
    line((-6.5, 2.4), (-6.5, 2.9))
    line((-6.9, 2.9), (-6.1, 2.9))
    content((-6.5, 1.5), [学生], size: 9pt)

    // 参与者 - 管理员
    circle((-6.5, -2), radius: 0.4, fill: gray.lighten(80%))
    line((-6.5, -1.6), (-6.5, -1.1))
    line((-6.9, -1.1), (-6.1, -1.1))
    content((-6.5, -2.5), [管理员], size: 9pt)

    // 用例
    let uc(x, y) = circle((x, y), radius: (1.6, 0.5), fill: blue.lighten(90%), stroke: blue)
    let uct(x, y, t) = content((x, y), text(size: 8pt)[#t])

    uc(0, 2.5); uct(0, 2.5, [查看座位状态])
    uc(0, 1.2); uct(0, 1.2, [预约/签到座位])
    uc(0, 0); uct(0, 0, [智能座位推荐])
    uc(0, -1.2); uct(0, -1.2, [信誉分查询])
    uc(0, -2.4); uct(0, -2.4, [收藏座位])

    uc(3.5, 1.5); uct(3.5, 1.5, [管理座位])
    uc(3.5, 0); uct(3.5, 0, [管理用户])
    uc(3.5, -1.5); uct(3.5, -1.5, [查看统计])

    // 连线
    line((-6.1, 2), (-1.6, 2.5))
    line((-6.1, 2), (-1.6, 1.2))
    line((-6.1, 2), (-1.6, 0))
    line((-6.1, 2), (-1.6, -1.2))
    line((-6.1, 2), (-1.6, -2.4))

    line((-6.1, -2), (-1.6, 2.5))
    line((-6.1, -2), (1.9, 1.5))
    line((-6.1, -2), (1.9, 0))
    line((-6.1, -2), (1.9, -1.5))
  }),
  caption: "系统用例图",
) <fig:use-case>

如图@fig:use-case 所示，学生用户可执行查看座位状态、预约与签到座位、智能座位推荐、信誉分查询以及收藏座位等操作；管理员除具备学生用户全部权限外，还可执行座位管理、用户管理和数据统计查看等维护操作。

==== 座位状态实时监测

系统需实时显示每个座位的当前状态（空闲/占用/已预约/暂离），用户在小程序上看到的信息应为当前时刻的状态。数据流如图@fig:seat-data-flow 所示。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    let block(x, y, t) = {
      rect((x - 1.2, y - 0.4), (x + 1.2, y + 0.4), fill: blue.lighten(90%), radius: 0.1)
      content((x, y), text(size: 8pt)[#t])
    }
    block(-5, 1, [红外传感器])
    block(-1.5, 1, [ESP32处理])
    block(2, 1, [MQTT Broker])
    block(5.5, 1, [后端服务])
    block(5.5, -1, [数据库更新])
    block(2, -1, [Socket推送])
    block(-1.5, -1, [前端展示])

    line((-3.8, 1), (-2.7, 1), mark: (end: ">"))
    line((-0.3, 1), (0.8, 1), mark: (end: ">"))
    line((3.2, 1), (4.3, 1), mark: (end: ">"))
    line((5.5, 0.6), (5.5, -0.6), mark: (end: ">"))
    line((4.3, -1), (3.2, -1), mark: (end: ">"))
    line((0.8, -1), (-0.3, -1), mark: (end: ">"))
  }),
  caption: "座位状态监测数据流",
) <fig:seat-data-flow>

==== 智能座位推荐

用户选择偏好（靠窗、有插座、安静区、楼层偏好），系统自动分配最优座位。若严格匹配无结果，系统按五级渐进策略逐步放宽条件（偏好匹配→仅楼层→仅区域→全馆随机），同时支持"接受调剂"选项。

==== 座位预约与签到

用户可预约座位，预约后需在30分钟内签到，超时自动释放。签到支持三种方式：扫码签到（HMAC-SHA256签名二维码）、位置验证签到（GPS距离阈值#sym.lt 100米）、传感器自动检测（时间窗口置信度≥80%）。

==== 信誉分管理

用户初始信誉分100分，爽约、超时未签到、长时间暂离等行为扣减分数，每日自动恢复5分。低于65分限制预约权限。

==== 用户认证与权限管理

系统支持微信小程序授权登录。采用JWT Token认证，角色分为学生和管理员。

=== 非功能需求分析

==== 性能需求

+ API接口响应时间：#sym.lt 500ms（95%请求），数据库查询#sym.lt 100ms，前端渲染#sym.lt 200ms。
+ 并发用户数≥1000，WebSocket连接≥500，MQTT消息≥100条/秒。

==== 可靠性需求

目标可用性99%（全年停机不超过87小时），实际部署采用PM2进程守护。数据库事务保证操作原子性，如预约时需同时检查冲突、创建记录、更新状态。

==== 安全性需求

密码采用bcrypt加密存储；数据库操作使用TypeORM参数化查询防护SQL注入；Redis Lua脚本保证原子性；HMAC-SHA256签名防止二维码伪造；设备指纹防止账号共享。

==== 可扩展性需求

后端支持水平扩展和多实例部署；模块化设计便于新增功能；数据库结构预留扩展字段。

== 系统总体架构设计

=== 架构的演进过程

系统架构设计经历了从HTTP轮询到MQTT发布/订阅，再到"端-云-端"三层架构的迭代演进。初期方案采用HTTP轮询，存在实时性不足和服务器压力大的问题；引入MQTT协议后解决了硬件与后端的通信解耦，但前端实时推送仍需单独处理。综合各阶段经验，最终确定了"端-云-端"三层架构，如图@fig:system-architecture 所示。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)

    let block(x, y, w, h, t, fill: blue.lighten(90%)) = {
      rect((x - w/2, y - h/2), (x + w/2, y + h/2), fill: fill, radius: 0.1)
      content((x, y), text(size: 8pt)[#t])
    }

    // 前端层
    block(-3.5, 2.5, 2.2, 0.8, [Taro小程序])
    block(0, 2.5, 2.2, 0.8, [Web管理端])
    block(3.5, 2.5, 2.2, 0.8, [ESP32硬件])

    content((-3.5, 1.7), text(size: 7pt, fill: gray)[HTTPS/WSS], anchor: "north")
    content((0, 1.7), text(size: 7pt, fill: gray)[HTTPS/WSS], anchor: "north")
    content((3.5, 1.7), text(size: 7pt, fill: gray)[MQTT], anchor: "north")

    // 后端层
    block(0, 0, 9, 1.6, [], fill: green.lighten(92%))
    content((0, 0.5), text(size: 9pt, weight: "bold")[NestJS应用服务层], anchor: "south")
    content((0, -0.2), text(size: 7pt)[Controller → Service → Repository → TypeORM], anchor: "north")

    // 数据库
    block(0, -2.2, 2, 0.8, [MySQL])
    content((0, -2.9), text(size: 7pt, fill: gray)[Seats, Users, Reservations], anchor: "north")
    block(3.5, -2.2, 1.8, 0.8, [Redis])
    content((3.5, -2.9), text(size: 7pt, fill: gray)[Locks, Counters], anchor: "north")

    // 连线
    line((-3.5, 2.1), (-3.5, 0.8), mark: (end: ">"))
    line((-3.5, 0.8), (-2.5, 0.8))
    line((0, 2.1), (0, 0.8), mark: (end: ">"))
    line((3.5, 2.1), (3.5, 0.8), mark: (end: ">"))
    line((3.5, 0.8), (2.5, 0.8))
    line((0, -0.8), (0, -1.8), mark: (end: ">"))
    line((2.5, -1.8), (2.6, -1.8))
  }),
  caption: "系统三层架构图",
) <fig:system-architecture>

==== 为什么是三层

+ *硬件感知层*：红外检测+WiFi上报。ESP32单芯片集成MCU与WiFi，简化了硬件设计。
+ *后端服务层*：数据中转枢纽。接收MQTT消息，更新数据库，推送WebSocket，管理分布式锁。
+ *前端应用层*：用户交互界面。小程序给学生用，Web管理端给管理员用。

=== 技术选型的最终决定

技术选型详见第二章，本节汇总最终决策方案，如表@tbl:tech-stack 所示。

#figure(
  table(
    columns: (1fr, 1.5fr, 2fr),
    align: center + horizon,
    table.header(
      [层级], [技术选型], [选择理由]
    ),
    [硬件层], [ESP32-38Pin-CP2102 + HC-SR501], [集成度高，调试方便，成本可控],
    [后端层], [NestJS + TypeORM], [模块化架构，类型安全，生态丰富],
    [数据层], [MySQL + Redis], [成熟稳定，支持分布式锁与缓存],
    [通信层], [MQTT + Socket.io], [IoT标准协议，实时推送成熟],
    [前端层], [Taro + React 18], [跨端能力，代码复用率高],
  ),
  caption: "技术选型汇总",
) <tbl:tech-stack>

=== Monorepo 项目架构

项目采用Monorepo（单仓库）模式，使用pnpm workspace管理。相比Multirepo，Monorepo支持代码复用、原子提交和统一依赖管理。项目包含seat-api（NestJS后端）、seat-miniapp（Taro小程序）、seat-web（Web管理端）和device-firmware（硬件代码）四个包。

== 硬件层设计

硬件层是整个系统的基础。设计时考虑：成本、稳定性、功耗。

=== ESP32单芯片方案的设计思路

==== 为什么选用ESP32

本系统采用ESP32-38Pin-CP2102作为主控芯片。与STM32+ESP8266组合方案相比，ESP32单芯片方案的优势在于：

+ *集成度高*：双核处理器、WiFi、蓝牙集成在同一芯片，无需额外通信模块，PCB布线更简洁。
+ *开发便利*：Arduino生态支持完善，开发流程简洁，MQTT库支持良好。
+ *性能充足*：240MHz主频、520KB SRAM，完全满足传感器读取和网络通信需求。

==== 硬件选型明细

硬件选型明细及成本估算如表@tbl:hardware-cost 所示。

#figure(
  table(
    columns: (1fr, 1.5fr, 1fr, 2fr),
    align: center + horizon,
    table.header(
      [类别], [器件], [单价], [说明]
    ),
    table.cell(rowspan: 2, [核心器件]), [ESP32-38Pin-CP2102], [¥25], [主控+WiFi芯片],
    [HC-SR501], [¥4.35], [红外传感器],
    table.cell(colspan: 2, align: right)[器件成本小计], table.cell(colspan: 2)[约¥29.35 / 每座],
    [人工部署], [组装调试], [¥5], [接线、固件烧录、测试],
    table.cell(colspan: 2, align: right)[预估单座位成本], table.cell(colspan: 2)[约¥34.35],
  ),
  caption: "单座位硬件成本明细",
) <tbl:hardware-cost>

==== 工作流程

整个检测流程如图@fig:hardware-flow 所示。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    let proc(x, y, t) = {
      rect((x - 1.8, y - 0.35), (x + 1.8, y + 0.35), fill: blue.lighten(90%), radius: 0.1)
      content((x, y), text(size: 8pt)[#t])
    }
    let dec(x, y, t) = {
      circle((x, y), radius: 0.6, fill: yellow.lighten(80%))
      content((x, y), text(size: 7pt)[#t])
    }

    proc(0, 3, [红外传感器检测人体])
    dec(0, 1.8, [状态变化?])
    proc(-2.5, 0.5, [时间窗口观察])
    proc(2.5, 0.5, [继续监测])
    proc(-2.5, -0.8, [构建JSON数据])
    proc(-2.5, -2.1, [MQTT上报])

    line((0, 2.65), (0, 2.4), mark: (end: ">"))
    line((0, 1.2), (-2.5, 0.85), mark: (end: ">"))
    line((0, 1.2), (2.5, 0.85), mark: (end: ">"))
    line((2.5, 0.15), (2.5, 1.5))
    line((2.5, 1.5), (0, 1.5))
    line((0, 1.5), (0, 2.4))
    line((-2.5, 0.15), (-2.5, -0.45), mark: (end: ">"))
    line((-2.5, -1.15), (-2.5, -1.75), mark: (end: ">"))

    content((-1.2, 1.3), text(size: 7pt)[是])
    content((1.2, 1.3), text(size: 7pt)[否])
  }),
  caption: "硬件检测工作流程",
) <fig:hardware-flow>

红外传感器感知人体→ESP32读取信号并做时间窗口观察→打包成MQTT消息上报。

==== 边缘侧信号处理

HC-SR501在实际环境中易受空调风、人员经过、电源纹波等干扰。本设计采用*边缘计算*思想，在ESP32端进行预处理，仅上报有效状态变化，具体包括时间窗口观察算法和心跳保活机制。

*时间窗口观察算法。* 硬件端检测到状态变化后，启动5分钟时间窗口，每30秒采集一次传感器状态；若窗口内80%以上采样为同一状态，则确认有效状态变化并上报。该算法可过滤90%以上的误触发，同时仅增加约5分钟的响应延迟。对于座位监测场景，该延迟完全可接受——用户关心的"这个座位有没有人"，而非毫秒级的状态变化。

*心跳保活机制。* 硬件节点每30秒发送一次心跳包，支持后端判断设备在线状态、NAT映射保活和前端设备健康展示。

=== 数据传输效率分析

硬件节点与后端之间的数据传输采用JSON格式，单座位状态上报报文约50字节。JSON格式可读性好、调试方便，但存在一定的数据冗余。与自定义二进制协议（约8字节）相比，JSON在开发效率上具有明显优势。原型阶段采用JSON格式，主要考虑调试便利性和后端兼容性；二进制协议可作为后续生产部署的优化方向。

== 后端架构设计

后端服务是系统的核心，设计质量直接影响系统的稳定性和可维护性。

=== 分层架构

为提高代码的可维护性和可扩展性，后端采用分层架构设计，各层职责单一、边界清晰。后端分层架构如图@fig:backend-arch 所示。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    let layer(y, fill, t, desc) = {
      rect((-4, y - 0.4), (4, y + 0.4), fill: fill, radius: 0.1)
      content((-1.5, y), text(size: 8pt)[#t], anchor: "east")
      content((2, y), text(size: 7pt, fill: gray)[#desc], anchor: "west")
    }
    layer(2, blue.lighten(90%), [Controller层], [业务逻辑编排、参数校验、响应格式化])
    layer(1, green.lighten(90%), [Service层], [SeatService, ReservationService, CheckinService])
    layer(0, yellow.lighten(90%), [Repository层], [TypeORM EntityRepository])
    layer(-1, red.lighten(90%), [MySQL + Redis], [数据持久化与缓存])

    line((0, 1.6), (0, 1.4), mark: (end: ">"))
    line((0, 0.6), (0, 0.4), mark: (end: ">"))
    line((0, -0.4), (0, -0.6), mark: (end: ">"))
  }),
  caption: "后端分层架构",
) <fig:backend-arch>

==== 各层职责

+ *Controller层*：接收HTTP/WebSocket请求，参数校验，调用Service，格式化响应。
+ *Service层*：实现座位搜索算法、预约冲突检测、签到逻辑、信誉分计算等核心业务逻辑。
+ *Repository层*：封装数据库CRUD操作，通过TypeORM实体管理器操作数据。

=== 数据流向

座位状态更新数据流：ESP32通过MQTT上报→Aedes Broker解析→SeatService更新状态→MySQL写入→SeatGateway按区域广播→前端实时更新。

== 数据库设计

数据库设计决定系统的可扩展性和性能。

=== E-R 图

数据库E-R图如图@fig:er-diagram 所示。

#figure(
  cetz.canvas({
    import cetz.draw: *
    set-style(stroke: 0.5pt)
    let entity(x, y, t) = {
      rect((x - 0.9, y - 0.4), (x + 0.9, y + 0.4), fill: blue.lighten(85%), radius: 0.05)
      content((x, y), text(size: 8pt, weight: "bold")[#t])
    }
    let relation(x, y, t) = {
      circle((x, y), radius: 0.35, fill: yellow.lighten(80%))
      content((x, y), text(size: 6pt)[#t])
    }

    entity(0, 2, [Seat])
    entity(-3, 0, [Area])
    entity(3, 0, [User])
    entity(0, -2, [Reservation])
    entity(5, 2, [SeatStatusLog])
    entity(-5, 2, [CreditRecord])

    line((0, 1.6), (0, -1.6), mark: (end: ">", start: ">"))
    content((0.4, 0), text(size: 7pt, fill: gray)[1:n], anchor: "west")

    line((-2.1, 0), (-0.9, 1.6), mark: (end: ">", start: ">"))
    content((-1.8, 1.2), text(size: 7pt, fill: gray)[1:n], anchor: "east")

    line((2.1, 0), (0.9, 1.6), mark: (end: ">", start: ">"))
    content((1.8, 1.2), text(size: 7pt, fill: gray)[1:n], anchor: "west")

    line((0.9, -2), (2.1, 0), mark: (end: ">", start: ">"))
    content((1.8, -1.2), text(size: 7pt, fill: gray)[n:1], anchor: "west")

    line((0.9, 2), (4.1, 2), mark: (end: ">", start: ">"))
    content((2.5, 2.3), text(size: 7pt, fill: gray)[1:n], anchor: "south")

    line((-0.9, 2), (-4.1, 2), mark: (end: ">", start: ">"))
    content((-2.5, 2.3), text(size: 7pt, fill: gray)[1:n], anchor: "south")
  }),
  caption: "数据库E-R图",
) <fig:er-diagram>

=== 数据表结构

==== Seats 表（座位表）

Seats表查询最频繁，结构如表@tbl:seats-table 所示。

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

==== Reservations 表（预约表）

Reservations表结构如表@tbl:reservations-table 所示。

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

==== Users 表（用户表）

Users表存储用户基本信息与信誉分。

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

==== SeatStatusLog 表（状态日志表）

SeatStatusLog表记录座位状态的每次变更，用于审计和数据分析。

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

=== 索引优化

索引设计遵循"按需创建"原则。Seats表按`area`、`status`、`floor`建立复合索引，支持区域座位列表的快速查询；Reservations表按`userId`、`status`建立复合索引，优化当前预约查询性能；SeatStatusLog表按`seatId`、`createdAt`建立索引，支持状态变更历史查询。

== API 接口设计

=== RESTful API 规范

API设计遵循RESTful规范，使用小写路径和连字符分隔，HTTP方法对应CRUD操作。响应采用统一JSON格式：成功时返回`{code: 0, data, message}`，错误时返回`{code, message}`。

=== 后端中间件体系

后端采用NestJS管道-守卫-拦截器体系，请求依次经过全局异常过滤器、验证管道（class-validator）、认证守卫（JWT Guard）、业务路由。认证守卫采用局部挂载策略，按路由模块按需启用，避免全局拦截带来的性能开销。

=== 核心接口定义

核心API接口定义如表@tbl:api-interfaces 所示。

#figure(
  table(
    columns: (1fr, 0.8fr, 2fr, 2fr),
    align: center + horizon,
    table.header(
      [模块], [方法], [路径], [描述]
    ),
    [认证], [POST], [/api/auth/wechat-login], [微信小程序登录],
    [认证], [GET], [/api/auth/me], [获取当前用户信息],
    [座位], [GET], [/api/seats], [获取座位列表],
    [座位], [GET], [/api/seats/areas], [获取区域统计],
    [座位], [POST], [/api/seats/:id/reserve], [预约座位],
    [座位], [POST], [/api/seats/:id/release], [释放座位],
    [预约], [POST], [/api/reservations/preview], [智能推荐预览],
    [预约], [POST], [/api/reservations/confirm], [确认预约],
    [签到], [POST], [/api/checkin/scan], [扫码签到],
    [签到], [POST], [/api/checkin/location], [位置验证签到],
    [用户], [GET], [/api/users/credit], [查询信誉分],
    [管理], [GET], [/api/admin/stats], [查看统计数据],
  ),
  caption: "核心API接口",
) <tbl:api-interfaces>

== 核心算法设计

=== 智能座位评分算法

==== 算法描述

智能座位推荐综合考虑三个维度为每个候选座位计算评分：

+ *空闲时长权重*：座位空闲时间越长，评分越高，优先分配长期空闲座位。
+ *历史使用率权重*：座位历史使用率越低，评分越高，实现负载均衡。
+ *用户偏好匹配度*：根据用户历史预约记录统计偏好属性，匹配度越高评分越高。

综合评分公式：

$ S = w_1 dot T_"idle" + w_2 dot (1 - U_"history") + w_3 dot P_"match" $

其中 $T_"idle"$ 为归一化空闲时长，$U_"history"$ 为历史使用率，$P_"match"$ 为偏好匹配度，$w_1$、$w_2$、$w_3$ 为权重系数（默认均为1/3）。

==== 五级渐进式条件放宽策略

当严格匹配无结果时，系统按以下五级策略逐步放宽条件：

+ 一级：严格匹配全部偏好属性+楼层。
+ 二级：放宽楼层限制，仅匹配偏好属性。
+ 三级：放宽部分偏好（如仅要求靠窗或有插座）。
+ 四级：仅匹配区域，忽略偏好属性。
+ 五级：全馆范围内随机分配空闲座位。

用户可勾选"接受调剂"选项，系统从一级开始尝试，成功则返回推荐结果并标注是否经过调剂。

=== 预约冲突检测算法

==== 算法描述

在创建预约前，检测指定座位当前是否已被其他用户预约或占用。

==== 状态互斥判断

座位状态为FREE时才允许预约。若状态为RESERVED、IN_USE、IN_JUDGE，则拒绝预约请求。同时Redis Lua原子脚本检查分布式锁，防止并发场景下的重复预约。

=== 时间窗口观察算法（传感器自动签到）

==== 算法描述

硬件端检测到有人后，后端启动5分钟时间窗口观察：每30秒采集一次传感器状态，若窗口内80%以上采样为OCCUPIED，则自动将座位状态从RESERVED转为IN_USE，完成自动签到。

==== 伪代码

```python
function autoCheckin(seatId):
    windowSize = 5 * 60  # 5分钟
    sampleInterval = 30  # 30秒
    threshold = 0.8      # 80%阈值

    occupiedCount = 0
    totalSamples = windowSize / sampleInterval

    for i in range(totalSamples):
        status = readSensor(seatId)
        if status == OCCUPIED:
            occupiedCount += 1
        sleep(sampleInterval)

    if occupiedCount / totalSamples >= threshold:
        updateSeatStatus(seatId, IN_USE)
        completeCheckin(seatId)
```

=== 信誉分计算算法

==== 算法描述

用户信誉分管理采用"扣分+每日恢复"机制：

+ *爽约*：预约后未签到，扣10分。
+ *超时暂离*：暂离超过1小时未返回，扣5分。
+ *恶意占座*：频繁预约后立刻取消，扣3分。
+ *每日恢复*：每天凌晨自动恢复5分，上限100分。

当信誉分低于65分时，限制用户预约权限，需等待分数恢复后方可继续使用。

== 本章小结

本章首先分析了系统需求，总体目标包括实时性（5秒内更新）、易用性（5分钟内掌握基本操作流程）、低成本（单座位#sym.lt 50元）。功能需求涵盖座位监测、智能推荐、预约签到、信誉分管理和收藏等模块。非功能需求从性能、可靠性、安全性、可扩展性四个维度进行约束。

在此基础上，本章详细描述了系统的总体架构设计、硬件层设计、后端架构设计、数据库设计、API接口设计和核心算法设计。系统采用三层架构设计，硬件层采用ESP32单芯片方案，后端采用NestJS分层架构，数据库设计包含5个核心表，前端采用跨端架构，核心算法包括智能座位评分算法、五级渐进式条件放宽策略、时间窗口观察算法和信誉分计算算法。这些设计为系统实现提供了详细的指导。
