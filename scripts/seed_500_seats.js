const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'shinkansen.proxy.rlwy.net',
    port: process.env.DB_PORT || 51036,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'seat_reserve',
  });

  const areas = ['A区', 'B区', 'C区', 'D区'];
  const floors = ['1F', '2F', '3F', '4F'];
  const building = '图书馆';
  const baseLat = 30.8265;
  const baseLng = 104.1845;

  const values = [];
  for (let i = 1; i <= 500; i++) {
    const areaIdx = Math.floor((i - 1) / 125);
    const area = areas[areaIdx];
    const floor = floors[areaIdx];
    const seatNumber = String(i).padStart(3, '0');
    const deviceId = `DEV-${String(i).padStart(4, '0')}`;
    const lat = (baseLat + (Math.random() - 0.5) * 0.001).toFixed(7);
    const lng = (baseLng + (Math.random() - 0.5) * 0.001).toFixed(7);
    const hasOutlet = Math.random() > 0.5;
    const isQuiet = Math.random() > 0.5;
    const nearWindow = Math.random() > 0.5;
    const attrs = JSON.stringify({ hasOutlet, isQuiet, nearWindow });

    values.push([area, seatNumber, 'FREE', deviceId, lat, lng, floor, building, attrs]);
  }

  const sql = `
    INSERT INTO seats
      (area, seatNumber, status, deviceId, latitude, longitude, floor, building, attributes, currentUserId, reservedUntil, tempLeaveAt, lastFreedAt, judgeExpiresAt, createdAt, updatedAt)
    VALUES ?
  `;

  await connection.query(sql, [values.map(v => [...v, null, null, null, null, null, new Date(), new Date()])]);
  console.log('Inserted 500 seats successfully.');
  await connection.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
