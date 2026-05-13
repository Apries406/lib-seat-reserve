// ============================================================
// 摘要
// ============================================================

#align(center)[
  #text(size: 16pt, weight: "bold")[摘　　要]
]
#v(1em)

随着高等教育规模的持续扩大，高校图书馆座位资源的供需矛盾日益凸显。根据教育部统计数据，全国各类高等教育在学总规模已达4846万人，多数高校生均座位数低于0.25座的国家标准。在考试周、考研冲刺期等高峰时段，"一座难求"的现象屡见不鲜。传统的人工管理方式存在信息滞后、占座现象严重、座位利用率低等问题；现有智能方案多采用有线部署或高成本传感器，施工难度大、经济可行性低。因此，研究一种低成本、易部署、功能完善的图书馆自习座位智能管理系统具有重要的现实意义。

针对上述问题，本文设计并实现了一套图书馆自习座位智能预约系统。系统采用"端-云-端"三层架构。硬件层选用ESP32-38Pin-CP2102微控制器配合HC-SR501红外传感器进行座位状态检测，通过MQTT协议完成数据传输，单座位器件成本控制在约35元。后端服务层基于NestJS框架构建，采用TypeORM操作MySQL数据库，Redis实现分布式缓存与原子锁；通过MQTT Broker接收硬件数据上报，利用Socket.io房间机制实现前端实时推送。前端应用层使用Taro跨端框架和React实现微信小程序端。系统核心功能包括：座位状态实时监测、智能座位推荐（基于空闲时长、历史使用率与用户偏好的多维度评分算法，结合五级渐进式条件放宽策略）、犹豫期锁定机制（IN_JUDGE状态限时确认防止恶意占座）、多模态签到（HMAC-SHA256签名二维码、GPS位置验证、传感器自动检测）、设备指纹防账号共享、信誉分管理与暂离超时自动释放。

经功能测试、性能测试和边界安全测试验证，系统各模块运行稳定，API平均响应时间45~120ms，端到端延迟控制在1秒以内，满足设计需求。

#v(1em)
#text(weight: "bold")[关键词：]图书馆自习座位管理；ESP32；MQTT；智能推荐；NestJS；微信小程序

#pagebreak()

#align(center)[
  #text(size: 16pt, weight: "bold", font: "Times New Roman")[Abstract]
]
#v(1em)

With the continuous expansion of higher education, the supply-demand contradiction of library seat resources in universities has become increasingly prominent. According to official statistics, the total enrollment in higher education has reached 48.46 million, and the average number of seats per student in most universities falls below the national standard of 0.25. During peak periods such as final exam weeks, the scarcity of library seats is a widespread issue. Traditional manual management methods suffer from problems such as lagging information updates, prevalent seat-hogging phenomena, and low seat utilization rates. Existing intelligent solutions mostly rely on wired deployment or expensive sensors, resulting in high construction costs and low economic feasibility. Therefore, research on a low-cost, easy-to-deploy, and fully functional intelligent library seat management system is of great practical significance.

To address the above issues, this thesis designs and implements an intelligent reservation system for library study seats with a three-tier architecture. The hardware layer uses ESP32-38Pin-CP2102 microcontroller with HC-SR501 infrared sensor to detect seat status and transmits data through MQTT protocol, with a per-seat device cost of approximately ¥35. The backend service layer is based on NestJS framework, uses TypeORM to operate MySQL database, and employs Redis for distributed caching and atomic locking. It receives hardware data via MQTT Broker and implements real-time push to frontend through Socket.io room mechanism. The frontend application layer uses Taro cross-platform framework and React to implement WeChat mini-program. Core functions include real-time seat status monitoring, intelligent seat recommendation based on a multi-dimensional scoring algorithm combining idle time, historical usage rate, and user preference with a five-level gradual condition relaxation strategy, hesitation period locking mechanism to prevent malicious seat occupation, multi-modal check-in including HMAC-SHA256 signed QR code, GPS location verification, and sensor automatic detection, device fingerprinting for anti-account-sharing, credit score management, and automatic release after temporary leave timeout.

Verified through functional testing, performance testing, and boundary security testing, all modules of the system operate stably. The API average response time ranges from 45ms to 120ms, and the end-to-end delay is controlled within one second, meeting the design requirements.

#v(1em)
#text(weight: "bold", font: "Times New Roman")[Keywords: ]#text(font: "Times New Roman")[Library Seat Management; ESP32; MQTT; Intelligent Recommendation; NestJS; WeChat Mini Program]
