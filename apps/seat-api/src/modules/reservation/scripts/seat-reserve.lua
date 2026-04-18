-- 原子性座位预约脚本
-- KEYS[1] = seat:lock:{seatId}
-- KEYS[2] = seat:reserved:{seatId}
-- KEYS[3] = user:seat:{userId}
-- ARGV[1] = userId
-- ARGV[2] = expireTime (秒)
-- ARGV[3] = lockTTL (秒)

local locked = redis.call("GET", KEYS[1])
if locked then
  return -1
end

local reserved = redis.call("GET", KEYS[2])
if reserved then
  return -2
end

local userSeat = redis.call("GET", KEYS[3])
if userSeat then
  return -3
end

redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[3])
redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[2])
redis.call("SET", KEYS[3], KEYS[2], "EX", ARGV[2])

return 1
