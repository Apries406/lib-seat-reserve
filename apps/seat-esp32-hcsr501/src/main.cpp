#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <esp_system.h>
#include <time.h>

#include "app_config.h"

namespace {

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

bool pirWarmupFinished = false;
bool hasPublishedSensorState = false;
bool lastOccupancyState = false;

unsigned long bootAtMs = 0;
unsigned long lastPirSampleAtMs = 0;
unsigned long lastStatusReportAtMs = 0;
unsigned long lastWifiReconnectAttemptAtMs = 0;
unsigned long lastMqttReconnectAttemptAtMs = 0;

String sensorTopic() {
  return String("device/") + AppConfig::DEVICE_ID + "/sensor";
}

String statusTopic() {
  return String("device/") + AppConfig::DEVICE_ID + "/status";
}

String commandTopic() {
  return String("server/device/") + AppConfig::DEVICE_ID + "/command";
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

  // 未拿到 NTP 时间时退化为开机毫秒值，避免 payload 缺失 timestamp。
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

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String body;
  body.reserve(length);
  for (unsigned int index = 0; index < length; ++index) {
    body += static_cast<char>(payload[index]);
  }

  handleCommand(String(topic), body);
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
  Serial.printf("[mqtt] connected, subscribed %s\n", commandTopic().c_str());

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
}
