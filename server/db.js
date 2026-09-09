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

async function saveLocation(imei, locationData, accOn) {
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
    accOn !== undefined ? accOn : locationData.isGpsTrackingOn
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
  updateDeviceAcc,
  getLatestVehiclePositions,
  verifyOrRegisterDevice,
  getLastPositionByImei,
  updateDeviceMetadata,
  cleanGhostDevices,
  getDailyStats
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

// =================== DAILY STATS ===================
// Haversine formula to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

async function saveLocation(imei, locationData, accOn) {
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
    accOn !== undefined ? accOn : locationData.isGpsTrackingOn
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
  updateDeviceAcc,
  getLatestVehiclePositions,
  verifyOrRegisterDevice,
  getLastPositionByImei,
  updateDeviceMetadata,
  cleanGhostDevices,
  getDailyStats
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

// =================== DAILY STATS ===================
// Haversine formula to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getDailyStats(imei) {
  try {
    // Fetch all positions for today, ordered chronologically
    const [rows] = await pool.execute(`
      SELECT latitude, longitude, speed, ignition, device_time 
      FROM positions 
      WHERE device_imei = ? AND DATE(device_time) = CURDATE()
      ORDER BY device_time ASC
    `, [imei]);

    if (!rows || rows.length === 0) {
      return { distance: 0, maxSpeed: 0, avgSpeed: 0, idleMinutes: 0 };
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    let sumSpeed = 0;
    let movingPointCount = 0;
    let totalIdleSeconds = 0;
    let currentIdleSessionSeconds = 0; // Track continuous idle

    for (let i = 0; i < rows.length; i++) {
      const current = rows[i];
      
      // Speed stats
      if (current.speed > maxSpeed) maxSpeed = current.speed;
      if (current.speed > 0) {
        sumSpeed += current.speed;
        movingPointCount++;
      }

      // Distance and Idle calculations require a previous point
      if (i > 0) {
        const prev = rows[i - 1];
        
        // Distance (only if moving)
        if (current.speed > 0 || prev.speed > 0) {
          const dist = calculateDistance(prev.latitude, prev.longitude, current.latitude, current.longitude);
          if (dist < 100) { // filter out wild GPS jumps (e.g., > 100km in a few seconds)
            totalDistance += dist;
          }
        }

        // Idle time (speed = 0 AND ignition = 1 for both points)
        if (current.speed === 0 && prev.speed === 0 && current.ignition === 1 && prev.ignition === 1) {
          const timeDiffSeconds = (new Date(current.device_time) - new Date(prev.device_time)) / 1000;
          if (timeDiffSeconds > 0 && timeDiffSeconds < 3600) { // Max 1 hour gap allowed to avoid huge jumps
            currentIdleSessionSeconds += timeDiffSeconds;
            
            // Eğer tek seferdeki rölanti süresi 30 dakikayı (1800 sn) geçerse, cihazın ACC OFF
            // sinyalini kaçırdığını varsayıyoruz ("Hayalet Rölanti" / Ghost Idling).
            // Bu nedenle sadece ilk 30 dakikayı gerçek rölanti olarak kabul ediyoruz.
            if (currentIdleSessionSeconds <= 1800) {
              totalIdleSeconds += timeDiffSeconds;
            }
          }
        } else {
          // Araç hareket ederse veya kontak kapanırsa rölanti oturumunu sıfırla
          currentIdleSessionSeconds = 0;
        }
      }
    }

    const avgSpeed = movingPointCount > 0 ? (sumSpeed / movingPointCount) : 0;
    const idleMinutes = totalIdleSeconds / 60;

    return {
      distance: totalDistance.toFixed(2),
      maxSpeed: maxSpeed,
      avgSpeed: avgSpeed.toFixed(1),
      idleMinutes: idleMinutes.toFixed(0)
    };
  } catch (err) {
    console.error('Error calculating daily stats:', err);
    return { distance: 0, maxSpeed: 0, avgSpeed: 0, idleMinutes: 0 };
  }
}
