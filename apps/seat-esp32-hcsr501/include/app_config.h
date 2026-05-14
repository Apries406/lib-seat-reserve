#ifndef APP_CONFIG_H
#define APP_CONFIG_H

#include <stdint.h>

// 修改这一处配置即可适配真实环境；占位值用于说明字段含义。
namespace AppConfig {

// ========== 1. WiFi 配置 ==========
constexpr char WIFI_SSID[] = "apries";
constexpr char WIFI_PASSWORD[] = "Cxhzs067311.";

// ========== 2. 设备标识 ==========
// 必须与数据库 seats 表里的 deviceId 一致，例如 DEV-0001 ~ DEV-0500
constexpr char DEVICE_ID[] = "DEV-0001";

// ========== 3. MQTT 配置 ==========
// HiveMQ Cloud 免费版强制 TLS，端口 8883
constexpr char MQTT_HOST[] = "e1ee63562b6a49748af5646f23367179.s1.eu.hivemq.cloud";
constexpr uint16_t MQTT_PORT = 8883;
constexpr char MQTT_USERNAME[] = "apries";
constexpr char MQTT_PASSWORD[] = "Cxhzs067311.";

// HC-SR501 输出为数字信号；如接线不同，可直接改此 GPIO。
constexpr uint8_t PIR_PIN = 27;

// HC-SR501 上电后通常需要预热一段时间，期间不发送占用变化事件。
constexpr unsigned long PIR_WARMUP_MS = 30000;

// 心跳/状态上报间隔；在线状态会在 MQTT 连接成功后立即上报一次。
constexpr unsigned long STATUS_REPORT_INTERVAL_MS = 60000;

// 主循环采样间隔；HC-SR501 自带保持时间，通常无需更复杂滤波。
constexpr unsigned long PIR_SAMPLE_INTERVAL_MS = 250;

// 先给出一个保守固定置信度，后续可按安装位置或多传感器融合调整。
constexpr float INFRARED_CONFIDENCE = 0.95F;

// SSD1306 OLED I2C 配置
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t OLED_ADDR = 0x3C;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;

}  // namespace AppConfig

#endif
