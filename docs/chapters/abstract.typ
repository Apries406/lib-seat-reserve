// ============================================================
// 摘要
// ============================================================

#align(center)[
  #text(size: 16pt, weight: "bold")[摘　　要]
]
#v(1em)

随着高等教育规模的持续扩大，高校图书馆座位资源的供需矛盾日益凸显。在考试周、考研冲刺期等高峰时段，"一座难求"的现象屡见不鲜。传统的人工管理方式存在信息滞后、占座现象严重、座位利用率低等问题，客观上需要通过智能化手段加以改善。

针对上述问题，本文设计并实现了一套图书馆座位智能预约系统。系统采用"端-云-端"三层架构：硬件层选用ESP32-38Pin-CP2102微控制器配合HC-SR501红外传感器进行座位状态检测，通过MQTT协议完成数据传输；后端服务层基于NestJS框架构建，采用TypeORM操作MySQL数据库，Redis实现分布式缓存与原子锁，通过MQTT Broker接收硬件数据上报，利用Socket.io实现前端实时推送；前端应用层使用Taro跨端框架和React实现微信小程序端。系统核心功能包括座位状态实时监测、智能座位推荐（基于空闲时长、历史使用率与用户偏好的多维度评分算法）、犹豫期锁定机制（IN_JUDGE状态防止恶意占座）、扫码签到与位置验证、设备指纹防账号共享、信誉分管理以及暂离超时自动释放等。

系统测试涵盖功能测试、性能测试和边界安全测试三个方面。功能测试验证了用户认证、座位监测、智能推荐、预约冲突检测、签到流程和信誉分管理等核心模块的正确性。性能测试表明，系统API平均响应时间为45--120ms，Redis原子锁操作延迟低于5ms，WebSocket并发支持500连接以上。边界安全测试覆盖了重复预约、跨用户抢占、坐标缺失导致的距离计算异常、远程签到计数NaN穿透等10类边界场景，均通过防护验证。

本文提出的系统为智慧校园建设提供了一种低成本、高可用的技术解决方案。单座位核心器件成本控制在约¥35以内，硬件采用无线部署无需布线，为后续量产推广奠定了基础。未来可在数据分析、智能推荐和微服务架构等方面进一步扩展。

#v(1em)
#text(weight: "bold")[关键词：]图书馆座位管理；ESP32；MQTT；智能推荐；NestJS；微信小程序

#pagebreak()

#align(center)[
  #text(size: 16pt, weight: "bold", font: "Times New Roman")[Abstract]
]
#v(1em)

With the continuous expansion of higher education, the supply-demand contradiction of library seat resources in universities has become increasingly prominent. During peak periods such as final exam weeks, the scarcity of library seats is a widespread issue. Traditional manual management methods suffer from problems such as lagging information updates, prevalent seat-hogging phenomena, and low seat utilization rates, which objectively necessitate improvement through intelligent means.

To address the above issues, this thesis designs and implements an intelligent library seat reservation system. The system adopts a three-tier architecture consisting of edge devices, cloud services, and client terminals: the hardware layer uses ESP32-38Pin-CP2102 microcontroller with HC-SR501 infrared sensor to detect seat status and transmits data through MQTT protocol; the backend service layer is based on NestJS framework, uses TypeORM to operate MySQL database, Redis for distributed caching and atomic locking, receives hardware data via MQTT Broker, and implements real-time push through Socket.io; the frontend application layer uses Taro cross-platform framework and React to implement WeChat mini-program. Core functions include real-time seat status monitoring, intelligent seat recommendation based on multi-dimensional scoring algorithm, hesitation period locking mechanism, QR code check-in with location verification, device fingerprinting for anti-account-sharing, credit score management, and automatic release after temporary leave timeout.

System testing covers functional testing, performance testing, and boundary security testing. Functional testing verifies the correctness of core modules. Performance testing demonstrates that API average response time is 45--120ms, Redis atomic lock operation latency is below 5ms, and WebSocket concurrency supports over 500 connections. Boundary security testing covers 10 scenarios including duplicate reservation, cross-user preempting, and NaN penetration in remote check-in counting, all of which pass protection verification.

The proposed system provides a low-cost and highly available technical solution for smart campus construction. The per-seat core device cost is controlled within approximately ¥35, and the hardware adopts wireless deployment without wiring, laying the foundation for subsequent mass production and promotion.

#v(1em)
#text(weight: "bold", font: "Times New Roman")[Keywords: ]#text(font: "Times New Roman")[Library Seat Management; ESP32; MQTT; Intelligent Recommendation; NestJS; WeChat Mini Program]
