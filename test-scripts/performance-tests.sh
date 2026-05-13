#!/bin/bash
# ============================================================
# 图书馆座位预约系统 - 性能测试脚本
# 对应论文第五章性能测试
# ============================================================

set -e

BASE_URL="http://localhost:3000"
# 用你的实际 JWT token 替换这里
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZmY1NWQwOS02MjE5LTQ2ZGQtOWNkMC1jZjNmNzY3NjIzMDQiLCJvcGVuaWQiOiJvcXRCcDdmQ0ktWEZMSXNmX0V6U3A4Y1JJT1AwIiwiaWF0IjoxNzc4NjM5Njg3LCJleHAiOjE3NzkyNDQ0ODd9.P4HCbVVmvs6837Vdkmw-n2ZD93_R3Y2hnTB-nMcY8Z8"
DEVICE_FP="fp_34fbedf7"

echo "======================================"
echo "图书馆座位预约系统 - 性能测试"
echo "======================================"
echo ""

# ------------------------------------------------------------
# 测试1：API 响应时间测试（对应论文表@tbl:api-response-time）
# 方法：curl 循环请求100次，取平均响应时间
# ------------------------------------------------------------

run_response_time_test() {
  local name=$1
  local method=$2
  local endpoint=$3
  local body=$4
  local count=${5:-100}

  echo "--- 测试: $name ($count 次请求) ---"

  local tmpfile=$(mktemp)
  for i in $(seq 1 $count); do
    if [ "$method" = "GET" ]; then
      curl -s -o /dev/null -w "%{time_total}\n" \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Device-Fingerprint: $DEVICE_FP" \
        "$BASE_URL$endpoint" >> "$tmpfile"
    else
      curl -s -o /dev/null -w "%{time_total}\n" \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Device-Fingerprint: $DEVICE_FP" \
        -H "Content-Type: application/json" \
        -d "$body" \
        -X POST "$BASE_URL$endpoint" >> "$tmpfile"
    fi
  done

  local avg=$(awk '{sum+=$1; count++} END {printf "%.0f", sum/count*1000}' "$tmpfile")
  local min=$(awk '{if(min==""||$1<min)min=$1} END {printf "%.0f", min*1000}' "$tmpfile")
  local max=$(awk '{if(max==""||$1>max)max=$1} END {printf "%.0f", max*1000}' "$tmpfile")

  echo "  平均: ${avg}ms | 最小: ${min}ms | 最大: ${max}ms"
  rm "$tmpfile"
  echo ""
}

# ------------------------------------------------------------
# 前置检查：后端是否存活
# ------------------------------------------------------------
echo "检查后端连接..."
if ! curl -s -o /dev/null "$BASE_URL/seats"; then
  echo "❌ 无法连接到 $BASE_URL"
  echo "请先运行: cd apps/seat-api && npm run start:dev"
  exit 1
fi
echo "✅ 后端连接正常"
echo ""

echo "【1. API 响应时间测试】"
echo ""

# 注意：测试前确保 seat id=1 是 FREE 状态，否则预约会失败
run_response_time_test "座位列表" "GET" "/seats"
run_response_time_test "智能推荐" "POST" "/smart-reserve/preview" '{"hasOutlet":true,"acceptAdjustment":true}'
run_response_time_test "预约创建" "POST" "/reservations" '{"seatId":2}'
run_response_time_test "位置验证签到" "POST" "/checkin" '{"reservationId":"test","method":"LOCATION","location":{"latitude":30.8266,"longitude":104.1860}}'

echo ""
echo "【2. 并发测试 (ab)】"
echo ""

# ------------------------------------------------------------
# 测试2：API 并发测试（对应论文表@tbl:concurrent-test）
# 方法：Apache Bench (ab)，macOS 自带
# ------------------------------------------------------------

echo "--- API 并发: 座位列表 (300并发, 3000总请求) ---"
ab -n 3000 -c 300 \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Device-Fingerprint: $DEVICE_FP" \
  "$BASE_URL/seats" 2>&1 | tail -20

echo ""
echo "--- API 并发: 智能推荐 (100并发, 1000总请求) ---"
# ab 做 POST JSON 需要把 body 写进文件
POST_BODY_FILE=$(mktemp)
echo '{"hasOutlet":true,"acceptAdjustment":true}' > "$POST_BODY_FILE"
ab -n 1000 -c 100 \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Device-Fingerprint: $DEVICE_FP" \
  -H "Content-Type: application/json" \
  -p "$POST_BODY_FILE" \
  "$BASE_URL/smart-reserve/preview" 2>&1 | tail -20
rm "$POST_BODY_FILE"

echo ""
echo "======================================"
echo "测试完成"
echo "======================================"
