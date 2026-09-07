const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'filotakip',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

async function saveLocation(imei, locationData) {
  const query = `
    INSERT INTO positions 
    (device_imei, device_time, latitude, longitude, speed, course, satellites, is_gps_valid, ignition) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    await pool.query(query, values);
    
    // Update the last known position and status in devices table
    await pool.query(`
      UPDATE devices 
      SET last_update = NOW(), status = $1
      WHERE imei = $2
    `, [locationData.speed > 0 ? 'moving' : 'stopped', imei]);
    
  } catch (err) {
    console.error('Error saving location to DB:', err);
  }
}

async function verifyOrRegisterDevice(imei) {
  // Auto-register device for testing purposes if it doesn't exist
  const checkQuery = `SELECT * FROM devices WHERE imei = $1`;
  try {
    const res = await pool.query(checkQuery, [imei]);
    if (res.rows.length === 0) {
      console.log(`Registering new device: ${imei}`);
      await pool.query(`
        INSERT INTO devices (imei, plate_number, vehicle_model)
        VALUES ($1, $2, $3)
      `, [imei, `NEW-${imei.substring(imei.length - 4)}`, 'Unknown']);
    }
  } catch (err) {
     console.error('Error verifying device:', err);
  }
}

async function getLatestVehiclePositions() {
  const query = `
    SELECT 
      d.id, d.imei, d.plate_number as plate, d.status,
      p.latitude as lat, p.longitude as lng, p.speed, p.course, p.device_time as last_update
    FROM devices d
    LEFT JOIN (
      SELECT DISTINCT ON (device_imei) *
      FROM positions
      ORDER BY device_imei, device_time DESC
    ) p ON d.imei = p.device_imei
    WHERE p.latitude IS NOT NULL
  `;
  try {
    const res = await pool.query(query);
    return res.rows;
  } catch (err) {
    console.error('Error fetching latest positions:', err);
    return [];
  }
}

async function getLastPositionByImei(imei) {
  const query = `
    SELECT latitude as lat, longitude as lng, speed, device_time
    FROM positions
    WHERE device_imei = $1
    ORDER BY device_time DESC
    LIMIT 1
  `;
  try {
    const res = await pool.query(query, [imei]);
    return res.rows[0];
  } catch (err) {
    console.error('Error fetching last position:', err);
    return null;
  }
}

async function updateDeviceMetadata(imei, data) {
  const query = `
    UPDATE devices 
    SET plate_number = $1, vehicle_model = $2, sim_number = $3, 
        driver_name = $4, driver_phone = $5, vehicle_year = $6
    WHERE imei = $7
  `;
  const values = [
    data.plate, data.model, data.sim, 
    data.driver_name, data.driver_phone, data.year,
    imei
  ];
  try {
    const res = await pool.query(query, values);
    return res.rowCount > 0;
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
  updateDeviceMetadata
};
