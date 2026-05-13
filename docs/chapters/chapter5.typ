// ============================================================
// 第五章 系统测试
// ============================================================

= 系统测试

== 测试环境与方法

=== 测试环境配置

硬件测试环境包括ESP32-38Pin-CP2102开发板、HC-SR501红外传感器和Apple M4 Pro测试电脑（48GB RAM，macOS 26.4）。软件环境包括Node.js v20、MySQL v8.0、Redis v7、Chrome浏览器、微信开发者工具和MQTTX客户端。网络环境为192.168.1.0/24局域网，后端本地部署。

=== 测试方法

测试分为功能测试（黑盒/白盒/集成）、性能测试（响应时间/并发/实时性）和边界安全测试三类。

== 功能测试

功能测试采用全链路测试方法，从硬件到后端到前端，验证完整数据流。该方法能发现模块间协作问题。

=== 系统操作流程测试

系统操作流程测试验证用户从登录到预约、签到、查询的完整使用流程。测试在真实微信小程序环境中进行，截图均为实际运行界面。

*（1）登录。* 用户首次进入小程序，授权微信登录后系统自动获取openid并完成注册。登录界面如 @fig:ui-login 所示。

#figure(
  image("../figures/examples/login.png", width: 30%),
  caption: "小程序登录界面",
) <fig:ui-login>

*（2）首页与智能预约。* 登录后进入首页，顶部展示当前预约状态，中部为偏好选择区。用户可选择靠窗、有插座、安静区等偏好，开启「接受调剂」后系统自动放宽条件匹配。首页及偏好选择界面如 @fig:ui-home 和 @fig:ui-smart 所示。

#figure(
  image("../figures/examples/home-reversed.png", width: 30%),
  caption: "小程序首页",
) <fig:ui-home>

#figure(
  image("../figures/examples/smart-reverse.png", width: 30%),
  caption: "智能预约偏好选择",
) <fig:ui-smart>

*（3）预约确认。* 点击「一键预约」后，系统推荐最优座位并弹出60秒倒计时确认框。用户需在犹豫期内确认，否则座位自动释放。预约确认弹窗如 @fig:ui-confirm 所示。

#figure(
  image("../figures/examples/reverse-confirm.png", width: 30%),
  caption: "预约确认弹窗",
) <fig:ui-confirm>

*（4）签到。* 预约成功后需在30分钟内到达座位签到。签到页显示倒计时、座位信息和签到方式（扫码或定位）。签到界面如 @fig:ui-checkin 所示。

#figure(
  image("../figures/examples/checkin.png", width: 30%),
  caption: "签到界面",
) <fig:ui-checkin>

*（5）预约历史与个人中心。* 用户可在「历史记录」查看过往预约，在「我的」查看信誉分和功能入口。信誉分低于65分时预约将被拦截。历史记录、个人中心和信誉分拦截分别如 @fig:ui-history 、 @fig:ui-profile 和 @fig:ui-low-score 所示。

#figure(
  image("../figures/examples/reverse-history.png", width: 30%),
  caption: "预约历史界面",
) <fig:ui-history>

#figure(
  image("../figures/examples/profile.png", width: 30%),
  caption: "个人中心界面",
) <fig:ui-profile>

#figure(
  image("../figures/examples/lower-score.png", width: 30%),
  caption: "信誉分过低拦截提示",
) <fig:ui-low-score>

=== 用户认证测试

用户认证测试覆盖了微信小程序登录（code换取openid、用户创建与查询）、JWT Token过期行为、设备指纹绑定与校验等场景。

=== 座位状态监测测试

座位状态监测是系统最核心的功能。测试时在红外传感器前挥手模拟有人坐下，跟踪完整数据流：ESP32 MQTT上报→MQTTX显示MQTT消息→后端日志显示数据库更新→前端座位颜色变化。测试前50次均成功走完全程，表明跨多组件功能稳定性良好。

测试中发现前端座位颜色变化偶发延迟，排查后定位为React组件useEffect依赖数组配置错误，添加store订阅机制后解决。

=== 智能推荐测试

智能推荐测试重点验证五级渐进式条件放宽策略：

+ 严格匹配：全部偏好+楼层均满足，返回最高评分座位。
+ 一级放宽：放宽楼层限制，仅匹配偏好属性。
+ 二级放宽：放宽部分偏好属性。
+ 三级放宽：仅匹配区域。
+ 四级放宽：全馆随机分配。

测试同时验证了"接受调剂"交互流程：当无严格匹配结果时，系统提示用户开启调剂并自动重试。所有用例均通过。

=== 预约功能测试

预约功能测试重点验证边界条件：

+ 座位状态非FREE时预约，正确拒绝并提示"座位已被占用"。
+ 同一用户已预约时再次预约其他座位，正确拒绝并提示已有进行中的预约。
+ 预约后犹豫期内同用户重入加锁，正确通过不报错。
+ 预约后超时未签到，JudgeScheduler自动释放座位。

=== 签到功能测试

签到功能测试覆盖三种签到方式：

+ *扫码签到*：验证HMAC-SHA256签名有效性，过期签名拒绝，篡改签名拒绝。同时验证用户已有其他进行中的预约时，不允许扫码签到其他座位。
+ *位置验证签到*：距离#sym.lt 100米允许签到，距离#sym.gt 100米拒绝签到。座位坐标缺失时拒绝签到，防止NaN穿透。
+ *传感器自动签到*：模拟5分钟内80%以上采样为OCCUPIED，验证自动从RESERVED转为IN_USE。

=== 信誉分管理测试

信誉分管理测试验证了违规扣分、每日恢复和阈值限制：

+ 暂离超时后TempLeaveScheduler正确扣减5分。
+ 每日凌晨定时任务正确恢复5分，上限100分。
+ 信誉分低于65分时，预约接口返回403并提示限制原因。

=== 暂离超时释放测试

`TempLeaveScheduler`每5分钟扫描一次TEMP_LEAVE状态座位。测试中模拟暂离超过1小时，验证：

+ 预约状态正确改为COMPLETED。
+ checkedOutAt正确记录。
+ 用户信誉分正确扣减。
+ 座位状态正确释放为FREE。
+ 处理异常时预约状态正确回滚。

== 性能测试

性能测试重点关注三个指标：响应速度、实时延迟、并发能力。

=== 响应时间测试

API响应时间使用curl循环请求100次取平均值，结果如表@tbl:api-response-time 所示。所有接口均在500ms目标以内。

#figure(
  table(
    columns: (1.5fr, 1fr, 1fr),
    align: center + horizon,
    table.header(
      [接口], [平均响应时间], [目标值]
    ),
    [座位列表], [7ms], [#sym.lt 500ms],
    [智能推荐], [377ms], [#sym.lt 500ms],
    [预约创建], [7ms], [#sym.lt 500ms],
    [扫码签到], [55ms], [#sym.lt 500ms],
    [位置验证签到], [4ms], [#sym.lt 500ms],
  ),
  caption: "API响应时间测试结果",
) <tbl:api-response-time>

#figure(
  image("../figures/tests/performance-test.png", width: 75%),
  caption: "API响应时间与ab并发测试终端输出",
) <fig:performance-test>

=== 实时性测试

实时性测试测量从硬件检测到前端显示的端到端延迟，测试5次平均延迟1.2秒。前端渲染是主要耗时环节，经优化后降至约350ms，整体延迟控制在1秒以内。结果如表@tbl:latency-test 所示。

#figure(
  table(
    columns: (1.5fr, 1fr, 1fr),
    align: center + horizon,
    table.header(
      [环节], [平均延迟], [占比]
    ),
    [硬件检测+MQTT上报], [150ms], [13%],
    [后端处理+数据库更新], [80ms], [7%],
    [Socket推送], [40ms], [3%],
    [前端渲染], [880ms], [77%],
    [*总计*], [*1.15s*], [*100%*],
  ),
  caption: "端到端延迟测试结果",
) <tbl:latency-test>

=== 并发测试

并发测试采用Apache Bench (ab)、自定义Node.js脚本及Redis Lua脚本直接测试。WebSocket并发500连接全部成功，耗时约1.2s，CPU占用约7.9%、内存约163MB；API并发测试包含座位列表300并发（mean 263ms）与智能推荐100并发（mean 14ms），CPU占用约8.9%、内存约164MB。MQTT消息吞吐达91.7条/秒，CPU占用约8.9%、内存约163MB。Redis Lua原子锁在100并发预约同一座位场景下，仅1个请求成功，其余99个均正确返回冲突，无重复预约，耗时约2ms。结果如表@tbl:concurrent-test 所示。

#figure(
  table(
    columns: (1.5fr, 1fr, 1fr, 1fr),
    align: center + horizon,
    table.header(
      [测试类型], [并发数], [CPU占用], [内存占用]
    ),
    [WebSocket连接], [500], [7.9%], [163MB],
    [API请求], [300], [8.9%], [164MB],
    [MQTT消息], [100条/秒], [8.9%], [163MB],
    [Redis原子锁], [100并发], [7.8%], [164MB],
  ),
  caption: "并发测试结果",
) <tbl:concurrent-test>

#figure(
  image("../figures/tests/redis-lua-direct-test.png", width: 75%),
  caption: "Redis Lua 原子锁并发测试终端输出",
) <fig:redis-test>

#figure(
  image("../figures/tests/mqtt-load.png", width: 75%),
  caption: "MQTT 消息吞吐量测试终端输出",
) <fig:mqtt-test>

#figure(
  image("../figures/tests/websocket-concurrent.png", width: 75%),
  caption: "WebSocket 并发连接测试终端输出",
) <fig:websocket-test>

== 边界安全测试

边界安全测试覆盖了系统实现过程中发现的10类典型边界场景。测试不采用测试用例表格形式，而是通过在实际运行环境中注入异常输入、观察系统行为的方式进行验证。以下逐一说明各类边界场景的测试过程与结果。

*位置验证签到参数缺失。* 测试模拟前端请求未携带location参数的场景，后端`locationCheckin`方法通过`@Body`装饰器严格校验参数存在性，缺失时直接返回400错误并提示"缺少位置信息"，未触发后续的Haversine距离计算，避免undefined穿透导致服务端异常。

*座位坐标缺失导致NaN穿透。* 测试将某座位的latitude和longitude字段设为null，然后发起位置验证签到请求。后端在调用`calculateDistance`前检查坐标非空性，发现缺失后直接拒绝签到并返回"该座位不支持位置验证"，防止NaN参与数学运算导致距离计算返回NaN进而通过签到的逻辑漏洞。

*远程签到计数器异常。* 测试构造使`parseInt`返回NaN的输入，后端通过`Number.isNaN`校验计数器解析结果，发现异常时回退为0，保证计数器状态始终为有效数字，避免NaN累计导致签到次数判断失效。

*MQTT主题越界解析。* 测试向Broker发送主题层级不足的消息（如`seat/status`而非`seat/{deviceId}/status`），后端`topicParts.length`判断小于3时直接返回，避免数组越界访问导致进程崩溃。

*犹豫期释放顺序。* 测试验证`JudgeScheduler`释放过期IN_JUDGE座位的处理顺序。代码逻辑为先调用`releaseSeat`更新座位状态为FREE，再调用`unlock`释放Redis锁。若顺序颠倒，可能出现锁已释放但状态仍为IN_JUDGE的窗口期，导致其他用户预约失败。测试确认当前顺序下无状态不一致问题。

*暂离超时异常回滚。* 测试在`TempLeaveScheduler`处理过程中人为注入数据库连接异常，验证系统的容错能力。`try-catch`块捕获异常后，尝试将预约状态回滚为处理前的状态，防止因部分失败导致"预约已结束但座位仍被占用"的数据不一致。

*传感器处理时序。* 测试验证`SensorProcessor`处理传感器上报无人状态时的执行顺序。系统先扣减用户信誉分，再释放座位为FREE。若顺序颠倒，可能出现座位已释放但信誉分未扣减的情况，导致用户无成本违规。测试确认当前时序正确。

*同用户重入Redis锁。* 测试模拟智能推荐流程中`findCandidates`占位后`smartReserve`再次申请同一座位锁的场景。Lua脚本通过比对`ARGV[1]`（用户ID）与当前锁持有者，发现为同一用户时直接返回1允许重入，避免同一用户被自己持有的锁阻塞。

*扫码签到时已有其他预约。* 测试在用户已有一个ACTIVE预约的情况下，扫描另一座位的二维码。后端`scan`接口查询用户当前预约状态，发现存在进行中的预约后返回403并提示"您已有进行中的预约"，防止一用户同时占用多个座位。

*非FREE状态预约拦截。* 测试在座位状态为RESERVED或IN_USE时发起预约请求。后端`reserveSeat`方法前置状态校验，发现状态非FREE时直接返回409冲突并提示"座位已被占用"，未进入后续的Redis加锁和数据库写入流程，避免状态覆盖。

== 测试结果分析

测试过程整体顺利，但发现以下问题：

=== 测试中发现的问题

*前端初次加载较慢*：首屏JS体积700KB导致加载约1.2秒，经代码分割和懒加载优化后降至280KB/500ms。

*小程序内存占用高*：座位数据未在用户退出页面时清理，长时间运行后内存升至180MB以上。添加cleanup函数后稳定在约70MB。

*预约超时处理延迟*：`JudgeScheduler`定时任务10秒执行一次，预约恰好在两次执行之间过期时需等待下次扫描，延迟数秒属可接受范围。

=== 测试范围说明

受限于时间与条件，测试聚焦于功能正确性与核心性能指标。非功能需求中的系统可用性、渗透测试、隐私合规性等主要通过架构设计与代码审查保障。并发测试达500连接，未进行1000并发极限压力测试。

== 本章小结

本章详细描述了系统的测试环境、测试方法和测试结果。功能测试方面，测试用例覆盖核心功能模块，包括用户认证、座位状态监测、智能推荐、预约功能、签到功能、信誉分管理和暂离超时处理，均通过验证。性能测试方面，端到端延迟经优化后控制在1秒以内（目标#sym.lt 5秒），API响应时间4--377ms（目标#sym.lt 500ms），WebSocket并发支持500连接，Redis原子锁在100并发下无重复预约。边界安全测试覆盖了10类边界场景，均通过防护验证。测试结果表明，系统功能完整、性能良好、边界安全，满足设计需求。
