const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  user: process.env.DB_USER || 'root',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'filotakip',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

// Test connection and migrate schema
pool.getConnection()
  .then(async connection => {
    console.log('MySQL veritabanına başarıyla bağlanıldı.');
    // Migration: add idle_since column
    try {
      await connection.query("ALTER TABLE devices ADD COLUMN idle_since DATETIME NULL;");
      console.log('Added idle_since column.');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') console.error('idle_since error:', err.message);
    }
    // Migration: add acc_on column (real ignition from Status packet)
    try {
      await connection.query("ALTER TABLE devices ADD COLUMN acc_on TINYINT(1) DEFAULT 0;");
      console.log('Added acc_on column.');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') console.error('acc_on error:', err.message);
    }
    connection.release();
  })
  .catch(err => {
    console.error('MySQL bağlantı hatası:', err.message);
  });

async function saveLocation(imei, locationData) {
  const query = `
    INSERT INTO positions 
    (device_imei, device_time, latitude, longitude, speed, course, satellites, is_gps_valid, ignition) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    imei,
    locationData.date,
    locationData.latitude,
    locationData.longitude,
    locationData.speed,
    locationData.course,
    locationData.satellites,
    true, // assuming valid for now if parsed
    locationData.isGpsTrackingOn
  ];

  try {
    await pool.execute(query, values);
    
    // Update the last known position and status in devices table
    // ACC (ignition) status comes from Status packets (0x13), stored as acc_on in devices table.
    // We read the current acc_on value to decide idle logic.
    const status = locationData.speed > 0 ? 'moving' : 'stopped';
    
    // First, get current acc_on from the device
    const [deviceRows] = await pool.execute('SELECT acc_on FROM devices WHERE imei = ?', [imei]);
    const accOn = deviceRows.length > 0 ? !!deviceRows[0].acc_on : false;
    
    let updateQuery = `UPDATE devices SET last_update = NOW(), status = ?`;
    let queryParams = [status];

    if (locationData.speed > 0 || !accOn) {
      // Moving or ignition off -> reset idle timer
      updateQuery += `, idle_since = NULL`;
    } else if (locationData.speed === 0 && accOn) {
      // Stopped but ignition on -> start/continue idle timer
      updateQuery += `, idle_since = COALESCE(idle_since, NOW())`;
    }

    updateQuery += ` WHERE imei = ?`;
    queryParams.push(imei);

    await pool.execute(updateQuery, queryParams);
    
  } catch (err) {
    console.error('Error saving location to DB:', err);
  }
}

async function verifyOrRegisterDevice(imei) {
  // Auto-register device for testing purposes if it doesn't exist
  const checkQuery = `SELECT * FROM devices WHERE imei = ?`;
  try {
    const [rows] = await pool.execute(checkQuery, [imei]);
    if (rows.length === 0) {
      console.log(`Registering new device: ${imei}`);
      await pool.execute(`
        INSERT INTO devices (imei, plate_number, vehicle_model)
        VALUES (?, ?, ?)
      `, [imei, `NEW-${imei.substring(imei.length - 4)}`, 'Unknown']);
    }
  } catch (err) {
     console.error('Error verifying device:', err);
  }
}

async function getLatestVehiclePositions() {
  const query = `
    SELECT 
      d.id, d.imei, d.plate_number as plate, d.status, d.idle_since, d.acc_on as ignition,
      d.driver_name, d.driver_phone,
      p.latitude as lat, p.longitude as lng, p.speed, p.course, p.device_time as last_update
    FROM devices d
    LEFT JOIN (
      SELECT p1.*
      FROM positions p1
      INNER JOIN (
          SELECT device_imei, MAX(device_time) as max_time
          FROM positions
          GROUP BY device_imei
      ) p2 ON p1.device_imei = p2.device_imei AND p1.device_time = p2.max_time
    ) p ON d.imei = p.device_imei
    WHERE p.latitude IS NOT NULL
  `;
  try {
    const [rows] = await pool.execute(query);
    return rows;
  } catch (err) {
    console.error('Error fetching latest positions:', err);
    return [];
  }
}

async function getLastPositionByImei(imei) {
  const query = `
    SELECT latitude as lat, longitude as lng, speed, device_time
    FROM positions
    WHERE device_imei = ?
    ORDER BY device_time DESC
    LIMIT 1
  `;
  try {
    const [rows] = await pool.execute(query, [imei]);
    return rows[0] || null;
  } catch (err) {
    console.error('Error fetching last position:', err);
    return null;
  }
}

async function updateDeviceMetadata(imei, data) {
  const query = `
    UPDATE devices 
    SET plate_number = ?, vehicle_model = ?, sim_number = ?, 
        driver_name = ?, driver_phone = ?, vehicle_year = ?
    WHERE imei = ?
  `;
  const values = [
    data.plate, data.model, data.sim, 
    data.driver_name, data.driver_phone, data.year,
    imei
  ];
  try {
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  } catch (err) {
    console.error('Error updating device metadata:', err);
    return false;
  }
}

module.exports = {
  pool,
  saveLocation,
  verifyOrRegisterDevice,
  getLatestVehiclePositions,
  getLastPositionByImei,
  updateDeviceMetadata,
  updateDeviceAcc,
  cleanGhostDevices
};

async function updateDeviceAcc(imei, accOn) {
  try {
    await pool.execute(
      `UPDATE devices SET acc_on = ? WHERE imei = ?`,
      [accOn ? 1 : 0, imei]
    );
  } catch (err) {
    console.error('Error updating ACC status:', err);
  }
}

async function cleanGhostDevices() {
  try {
    await pool.execute(`DELETE FROM positions WHERE device_imei LIKE '0%' AND LENGTH(device_imei) > 15`);
    await pool.execute(`DELETE FROM devices WHERE imei LIKE '0%' AND LENGTH(imei) > 15`);
    console.log('🧹 Cleaned up ghost devices from database');
  } catch (err) {
    console.error('Error cleaning ghost devices:', err);
  }
}
