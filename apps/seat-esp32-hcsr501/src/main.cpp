#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <esp_system.h>
#include <time.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <qrcode.h>

#include "app_config.h"

namespace {

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
Adafruit_SSD1306 display(AppConfig::OLED_WIDTH, AppConfig::OLED_HEIGHT, &Wire, -1);

bool pirWarmupFinished = false;
bool hasPublishedSensorState = false;
bool lastOccupancyState = false;

unsigned long bootAtMs = 0;
unsigned long lastPirSampleAtMs = 0;
unsigned long lastStatusReportAtMs = 0;
unsigned long lastWifiReconnectAttemptAtMs = 0;
unsigned long lastMqttReconnectAttemptAtMs = 0;

// Display state
String displaySeatNumber = "";
String displayStatus = "FREE";
String displayQrToken = "";
unsigned long displayQrExpiresIn = 0;
unsigned long displayUpdatedAtMs = 0;
bool displayNeedsRefresh = true;

String sensorTopic() {
  return String("device/") + AppConfig::DEVICE_ID + "/sensor";
}

String statusTopic() {
  return String("device/") + AppConfig::DEVICE_ID + "/status";
}

String commandTopic() {
  return String("server/device/") + AppConfig::DEVICE_ID + "/command";
}

String displayTopic() {
  return String("server/device/") + AppConfig::DEVICE_ID + "/display";
}

String extractCommandValue(const String& payload) {
  const int commandKeyIndex = payload.indexOf("\"command\"");
  if (commandKeyIndex < 0) {
    return payload;
  }

  const int colonIndex = payload.indexOf(':', commandKeyIndex);
  if (colonIndex < 0) {
    return payload;
  }

  const int firstQuoteIndex = payload.indexOf('"', colonIndex + 1);
  if (firstQuoteIndex < 0) {
    return payload;
  }

  const int secondQuoteIndex = payload.indexOf('"', firstQuoteIndex + 1);
  if (secondQuoteIndex < 0) {
    return payload;
  }

  return payload.substring(firstQuoteIndex + 1, secondQuoteIndex);
}

String extractJsonString(const String& payload, const String& key) {
  const String searchKey = "\"" + key + "\"";
  const int keyIndex = payload.indexOf(searchKey);
  if (keyIndex < 0) return "";

  const int colonIndex = payload.indexOf(':', keyIndex + searchKey.length());
  if (colonIndex < 0) return "";

  const int firstQuote = payload.indexOf('"', colonIndex);
  if (firstQuote < 0) return "";

  const int secondQuote = payload.indexOf('"', firstQuote + 1);
  if (secondQuote < 0) return "";

  return payload.substring(firstQuote + 1, secondQuote);
}

long wifiStrength() {
  return WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
}

String uint64ToString(unsigned long long value) {
  char buffer[32];
  snprintf(buffer, sizeof(buffer), "%llu", value);
  return String(buffer);
}

unsigned long long currentTimestampMs() {
  const time_t now = time(nullptr);
  if (now > 1700000000) {
    return static_cast<unsigned long long>(now) * 1000ULL;
  }
  return static_cast<unsigned long long>(millis());
}

String buildStatusPayload(bool online) {
  String payload = "{";
  payload += "\"deviceId\":\"" + String(AppConfig::DEVICE_ID) + "\",";
  payload += "\"online\":" + String(online ? "true" : "false") + ",";
  payload += "\"timestamp\":" + uint64ToString(currentTimestampMs());
  payload += "}";
  return payload;
}

String buildSensorPayload(bool occupied) {
  String payload = "{";
  payload += "\"deviceId\":\"" + String(AppConfig::DEVICE_ID) + "\",";
  payload += "\"timestamp\":" + uint64ToString(currentTimestampMs()) + ",";
  payload += "\"sensor\":{";
  payload += "\"type\":\"infrared\",";
  payload += "\"value\":" + String(occupied ? "true" : "false") + ",";
  payload += "\"confidence\":" + String(AppConfig::INFRARED_CONFIDENCE, 2);
  payload += "},";
  payload += "\"metadata\":{";
  payload += "\"wifiStrength\":" + String(wifiStrength());
  payload += "}";
  payload += "}";
  return payload;
}

void syncClockIfNeeded() {
  static bool timeInitDone = false;
  if (timeInitDone || WiFi.status() != WL_CONNECTED) {
    return;
  }
  configTime(0, 0, "pool.ntp.org", "ntp.aliyun.com", "time.cloudflare.com");
  timeInitDone = true;
}

void ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastWifiReconnectAttemptAtMs < 5000UL) {
    return;
  }

  lastWifiReconnectAttemptAtMs = now;

  Serial.printf("[wifi] connecting to %s\n", AppConfig::WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(AppConfig::WIFI_SSID, AppConfig::WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000UL) {
    delay(500);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[wifi] connected, ip=%s rssi=%ld\n", WiFi.localIP().toString().c_str(), wifiStrength());
    syncClockIfNeeded();
  } else {
    Serial.println("\n[wifi] connect timeout, will retry");
    WiFi.disconnect(true, true);
  }
}

bool publishMessage(const String& topic, const String& payload, bool retained = false) {
  if (!mqttClient.connected()) {
    return false;
  }

  const bool published = mqttClient.publish(topic.c_str(), payload.c_str(), retained);
  Serial.printf("[mqtt] %s %s => %s\n", published ? "published" : "publish failed", topic.c_str(), payload.c_str());
  return published;
}

void publishOnlineStatus(bool online) {
  publishMessage(statusTopic(), buildStatusPayload(online), true);
  lastStatusReportAtMs = millis();
}

void publishSensorState(bool occupied, bool force = false) {
  if (!force && hasPublishedSensorState && occupied == lastOccupancyState) {
    return;
  }

  if (publishMessage(sensorTopic(), buildSensorPayload(occupied), false)) {
    lastOccupancyState = occupied;
    hasPublishedSensorState = true;
  }
}

void handleCommand(const String& topic, const String& payload) {
  if (topic != commandTopic()) {
    return;
  }

  Serial.printf("[mqtt] command => %s\n", payload.c_str());

  const String command = extractCommandValue(payload);

  if (command == "get_status") {
    publishOnlineStatus(true);
    if (pirWarmupFinished) {
      publishSensorState(digitalRead(AppConfig::PIR_PIN) == HIGH, true);
    }
    return;
  }

  if (command == "sync_time") {
    syncClockIfNeeded();
    publishOnlineStatus(true);
    return;
  }

  if (command == "reset") {
    publishOnlineStatus(false);
    delay(200);
    ESP.restart();
  }
}

// OLED display functions
bool initDisplay() {
  Wire.begin(AppConfig::OLED_SDA_PIN, AppConfig::OLED_SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, AppConfig::OLED_ADDR)) {
    Serial.println("[oled] SSD1306 init failed");
    return false;
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.display();
  Serial.println("[oled] SSD1306 initialized");
  return true;
}

void drawQrCode(const String& text, uint8_t xOffset, uint8_t yOffset, uint8_t scale) {
  QRCode qrcode;
  uint8_t qrcodeBytes[qrcode_getBufferSize(1)];

  // Version 1 = 21x21 modules, fits well on 128x64
  const int err = qrcode_initText(&qrcode, qrcodeBytes, 1, ECC_LOW, text.c_str());
  if (err != 0) {
    Serial.printf("[oled] QR init failed: %d\n", err);
    return;
  }

  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        display.fillRect(xOffset + x * scale, yOffset + y * scale, scale, scale, SSD1306_WHITE);
      }
    }
  }
}

void refreshDisplay() {
  if (!displayNeedsRefresh) {
    return;
  }
  displayNeedsRefresh = false;

  display.clearDisplay();

  // Top bar: seat number + status
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("SEAT ");
  display.print(displaySeatNumber.length() > 0 ? displaySeatNumber.c_str() : "--");

  // Status on the right side of top bar
  display.setCursor(80, 0);
  if (displayStatus == "FREE") {
    display.print("FREE");
  } else if (displayStatus == "RESERVED") {
    display.print("RSRV");
  } else if (displayStatus == "IN_USE") {
    display.print("USE");
  } else if (displayStatus == "TEMP_LEAVE") {
    display.print("LEAVE");
  } else {
    display.print(displayStatus.c_str());
  }

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  if (displayQrToken.length() > 0 && (displayStatus == "RESERVED" || displayStatus == "IN_USE")) {
    // Draw QR code in the center
    const uint8_t qrScale = 2;
    const uint8_t qrSize = 21 * qrScale;  // Version 1 = 21 modules
    const uint8_t qrX = (AppConfig::OLED_WIDTH - qrSize) / 2;
    const uint8_t qrY = 14 + (AppConfig::OLED_HEIGHT - 14 - qrSize) / 2;
    drawQrCode(displayQrToken, qrX, qrY, qrScale);
  } else {
    // Show idle icon/text
    display.setTextSize(2);
    display.setCursor(20, 28);
    if (displayStatus == "FREE") {
      display.print("FREE");
    } else {
      display.print(displayStatus.c_str());
    }
  }

  display.display();
}

void handleDisplay(const String& topic, const String& payload) {
  if (topic != displayTopic()) {
    return;
  }

  Serial.printf("[mqtt] display => %s\n", payload.c_str());

  const String seatNumber = extractJsonString(payload, "seatNumber");
  const String status = extractJsonString(payload, "status");
  const String qrToken = extractJsonString(payload, "qrToken");

  if (seatNumber.length() > 0) {
    displaySeatNumber = seatNumber;
  }
  if (status.length() > 0) {
    displayStatus = status;
  }
  displayQrToken = qrToken;
  displayUpdatedAtMs = millis();
  displayNeedsRefresh = true;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String body;
  body.reserve(length);
  for (unsigned int index = 0; index < length; ++index) {
    body += static_cast<char>(payload[index]);
  }

  handleCommand(String(topic), body);
  handleDisplay(String(topic), body);
}

void ensureMqttConnected() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastMqttReconnectAttemptAtMs < 3000UL) {
    return;
  }

  lastMqttReconnectAttemptAtMs = now;

  const String clientId = String(AppConfig::DEVICE_ID) + "-" + String(static_cast<uint32_t>(esp_random()), HEX);
  const String offlinePayload = buildStatusPayload(false);

  Serial.printf("[mqtt] connecting to %s:%u\n", AppConfig::MQTT_HOST, AppConfig::MQTT_PORT);

  const bool connected = mqttClient.connect(
    clientId.c_str(),
    AppConfig::MQTT_USERNAME,
    AppConfig::MQTT_PASSWORD,
    statusTopic().c_str(),
    1,
    true,
    offlinePayload.c_str());

  if (!connected) {
    Serial.printf("[mqtt] connect failed, state=%d\n", mqttClient.state());
    return;
  }

  mqttClient.subscribe(commandTopic().c_str(), 1);
  mqttClient.subscribe(displayTopic().c_str(), 1);
  Serial.printf("[mqtt] connected, subscribed %s and %s\n", commandTopic().c_str(), displayTopic().c_str());

  publishOnlineStatus(true);
}

void samplePirAndPublishIfChanged() {
  const unsigned long now = millis();
  if (now - lastPirSampleAtMs < AppConfig::PIR_SAMPLE_INTERVAL_MS) {
    return;
  }

  lastPirSampleAtMs = now;

  if (!pirWarmupFinished) {
    if (now - bootAtMs < AppConfig::PIR_WARMUP_MS) {
      return;
    }

    pirWarmupFinished = true;
    Serial.println("[pir] warmup finished");
  }

  publishSensorState(digitalRead(AppConfig::PIR_PIN) == HIGH);
}

void publishStatusHeartbeatIfNeeded() {
  if (!mqttClient.connected()) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastStatusReportAtMs >= AppConfig::STATUS_REPORT_INTERVAL_MS) {
    publishOnlineStatus(true);
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);

  bootAtMs = millis();
  pinMode(AppConfig::PIR_PIN, INPUT);

  mqttClient.setServer(AppConfig::MQTT_HOST, AppConfig::MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(30);

  initDisplay();

  Serial.printf("[boot] deviceId=%s pirPin=%u warmup=%lu ms\n", AppConfig::DEVICE_ID, AppConfig::PIR_PIN, AppConfig::PIR_WARMUP_MS);
}

void loop() {
  ensureWifiConnected();
  syncClockIfNeeded();
  ensureMqttConnected();

  if (mqttClient.connected()) {
    mqttClient.loop();
    publishStatusHeartbeatIfNeeded();
  }

  samplePirAndPublishIfChanged();
  refreshDisplay();
}
