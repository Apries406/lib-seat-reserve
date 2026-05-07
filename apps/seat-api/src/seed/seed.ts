import { DataSource } from 'typeorm';
import { Seat } from '../modules/seat/entities/seat.entity';
import { SeatStatusLog } from '../modules/seat/entities/seat-status-log.entity';
import { Device } from '../modules/device/entities/device.entity';
import { User } from '../modules/user/entities/user.entity';
import { Reservation } from '../modules/reservation/entities/reservation.entity';
import { SeatUsageStatistic } from '../modules/statistics/entities/seat-usage.entity';
import { SeatStatus } from '../modules/seat/enums/seat-status.enum';
import { DeviceStatus } from '../modules/device/enums/device.enum';
import { databaseConfig, redisConfig, jwtConfig, mqttConfig } from '../config/database.config';

const AREAS = [
  { id: 'A', name: 'A', floor: '1', building: '图书馆', count: 120, label: '社科阅览区' },
  { id: 'B', name: 'B', floor: '1', building: '图书馆', count: 100, label: '自然科学阅览区' },
  { id: 'C', name: 'C', floor: '2', building: '图书馆', count: 80,  label: '考研专区' },
  { id: 'D', name: 'D', floor: '2', building: '图书馆', count: 100, label: '自习区' },
  { id: 'E', name: 'E', floor: '3', building: '图书馆', count: 50,  label: '电子阅览区' },
  { id: 'F', name: 'F', floor: '3', building: '图书馆', count: 50,  label: '静音区' },
];

const BASE_LAT = 30.9876;
const BASE_LNG = 104.1234;

function makeAttributes(): { hasOutlet: boolean; isQuiet: boolean; nearWindow: boolean } {
  return {
    hasOutlet: Math.random() > 0.4,
    isQuiet: Math.random() > 0.6,
    nearWindow: Math.random() > 0.7,
  };
}

function makeSeatNumber(area: string, index: number): string {
  return `${area}${String(index).padStart(3, '0')}`;
}

function makeDeviceId(seatNumber: string): string {
  return `device-${seatNumber}`;
}

async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_DATABASE || 'seat_reserve',
    entities: [Seat, SeatStatusLog, Device, User, Reservation, SeatUsageStatistic],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const userRepo = dataSource.getRepository(User);
  const seatRepo = dataSource.getRepository(Seat);
  const deviceRepo = dataSource.getRepository(Device);

  // Clear existing data
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  await dataSource.query('TRUNCATE TABLE devices');
  await dataSource.query('TRUNCATE TABLE seats');
  await dataSource.query('TRUNCATE TABLE users');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Cleared existing data');

  // Seed users
  const testUsers = [
    { id: '00000000-0000-0000-0000-000000000001', openId: 'test_openid_001', nickname: '张三' },
    { id: '00000000-0000-0000-0000-000000000002', openId: 'test_openid_002', nickname: '李四' },
    { id: '00000000-0000-0000-0000-000000000003', openId: 'test_openid_003', nickname: '王五' },
    { id: '00000000-0000-0000-0000-000000000004', openId: 'test_openid_004', nickname: '赵六' },
    { id: '00000000-0000-0000-0000-000000000005', openId: 'test_openid_005', nickname: '孙七' },
  ];

  const existingUsers = await userRepo.count();
  if (existingUsers === 0) {
    await userRepo.save(testUsers.map(u => ({ ...u, creditScore: 100 })));
    console.log(`Inserted ${testUsers.length} test users`);
  } else {
    console.log(`Users already exist (${existingUsers}), skipping`);
  }

  // Seed seats
  const existingSeats = await seatRepo.count();
  if (existingSeats === 0) {
    let seatCounter = 0;
    let latOffset = 0;

    const seats: Partial<Seat>[] = [];
    const devices: Partial<Device>[] = [];

    for (const area of AREAS) {
      latOffset = 0;
      for (let i = 1; i <= area.count; i++) {
        seatCounter++;
        const seatNumber = makeSeatNumber(area.id, i);
        const deviceId = makeDeviceId(seatNumber);
        const lat = BASE_LAT + latOffset * 0.00001;
        const lng = BASE_LNG + (i % 20) * 0.000003;

        seats.push({
          area: area.id,
          seatNumber,
          status: SeatStatus.FREE,
          deviceId,
          latitude: parseFloat(lat.toFixed(7)),
          longitude: parseFloat(lng.toFixed(7)),
          floor: area.floor,
          building: area.building,
          attributes: makeAttributes(),
        });

        devices.push({
          deviceId,
          seatId: seatCounter,
          status: DeviceStatus.OFFLINE,
        });

        if (i % 20 === 0) latOffset++;
      }
    }

    const insertedSeats = await seatRepo.save(seats);
    console.log(`Inserted ${insertedSeats.length} seats`);

    const devicesWithSeatId = insertedSeats.map(seat => ({
      deviceId: seat.deviceId,
      seatId: seat.id,
      status: DeviceStatus.OFFLINE,
    }));

    await deviceRepo.save(devicesWithSeatId);
    console.log(`Inserted ${devicesWithSeatId.length} devices`);
  } else {
    console.log(`Seats already exist (${existingSeats}), skipping`);
  }

  await dataSource.destroy();
  console.log('Seed complete');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
