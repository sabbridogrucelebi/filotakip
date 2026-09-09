const net = require('net');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 36025; // TCP Port
const API_PORT = process.env.API_PORT || 3001; // HTTP/WS Port

// Setup Express and Socket.io
const app = express();
app.use(cors());
app.use(express.json());
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const { parseLocationPacket, crc16 } = require('./parser');
const db = require('./db');
const { createAuthRoutes } = require('./auth');
const { createAllRoutes } = require('./routes');
const AlarmEngine = require('./alarmEngine');
const TripEngine = require('./tripEngine');

// Initialize engines
const alarmEngine = new AlarmEngine(db.pool, io);
const tripEngine = new TripEngine(db.pool);

// Setup auth routes
createAuthRoutes(app, db.pool);

// Setup all API routes (alarms, geofences, history, trips, reports, etc.)
createAllRoutes(app, db.pool, io);

const fs = require('fs');
const path = require('path');

// --- DATABASE AUTO-SETUP ENDPOINT ---
app.get('/api/setup-database', async (req, res) => {
  try {
    const pool = db.pool;
    let logs = [];
    const log = (msg) => { logs.push(msg); console.log(msg); };

    log('🔧 Veritabanı kurulumu başlatılıyor...');

    // We will use the existing schema.sql file to run the entire structure
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute raw SQL file content. MultipleStatements is enabled in db.js
      await pool.query(sqlContent);
      log('✅ schema.sql başarıyla çalıştırıldı ve tüm tablolar oluşturuldu.');
    } else {
      log('❌ schema.sql dosyası bulunamadı!');
    }

    // Default admin user
    try {
      await pool.query(`INSERT IGNORE INTO users (username, password_hash, email, full_name, role) VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@filotakip.com', 'Sistem Yöneticisi', 'admin')`);
      log('✅ Varsayılan admin kullanıcısı eklendi (Şifre: admin123)');
    } catch(e) { log('⏭️ Admin kullanıcısı kontrol edildi.'); }

    res.send(`
      <div style="font-family: sans-serif; padding: 40px; background: #02040a; color: white; height: 100vh;">
        <h1 style="color: #10b981;">🎉 Kurulum Başarılı!</h1>
        <p>Veritabanı tablolarınız sorunsuz şekilde oluşturuldu.</p>
        <pre style="background: #1e293b; padding: 20px; border-radius: 10px; color: #94a3b8; font-size: 12px;">${logs.join('<br/>')}</pre>
        <a href="/dashboard" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">🚀 Panele Dön</a>
      </div>
    `);
  } catch (err) {
    res.status(500).send(`<div style="font-family: sans-serif; padding: 40px; background: #02040a; color: white; height: 100vh;"><h1 style="color: #ef4444;">❌ Kurulum Hatası</h1><pre style="color: #fca5a5;">${err.message}</pre></div>`);
  }
});

// --- REST API ENDPOINTS ---
app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await db.getLatestVehiclePositions();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Debug: Store last 50 raw packets per IMEI
const packetLog = new Map();

function logRawPacket(imei, data) {
  if (!packetLog.has(imei)) packetLog.set(imei, []);
  const logs = packetLog.get(imei);
  logs.unshift({
    time: new Date().toISOString(),
    hex: data.toString('hex'),
    len: data.length,
    proto: '0x' + data[3].toString(16).padStart(2, '0')
  });
  if (logs.length > 50) logs.pop();
}

app.get('/api/diagnostics/packets/:imei', (req, res) => {
  res.json(packetLog.get(req.params.imei) || []);
});

app.get('/api/vehicles/:imei/daily-stats', async (req, res) => {
  try {
    const stats = await db.getDailyStats(req.params.imei);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

app.get('/api/diagnostics/packets', (req, res) => {
  const all = {};
  for (const [imei, logs] of packetLog.entries()) {
    all[imei] = logs;
  }
  res.json(all);
});

// Diagnostic: Check data intervals for each device (last 20 records)
app.get('/api/diagnostics/intervals', async (req, res) => {
  try {
    const [rows] = await db.pool.execute(`
      SELECT device_imei, device_time, speed, ignition
      FROM positions 
      ORDER BY id DESC 
      LIMIT 50
    `);
    
    // Group by device and calculate intervals
    const byDevice = {};
    rows.forEach(r => {
      if (!byDevice[r.device_imei]) byDevice[r.device_imei] = [];
      byDevice[r.device_imei].push(r);
    });
    
    const result = {};
    for (const [imei, records] of Object.entries(byDevice)) {
      const intervals = [];
      for (let i = 0; i < records.length - 1; i++) {
        const diff = (new Date(records[i].device_time) - new Date(records[i+1].device_time)) / 1000;
        intervals.push(diff);
      }
      result[imei] = {
        record_count: records.length,
        latest: records[0].device_time,
        oldest: records[records.length - 1].device_time,
        intervals_seconds: intervals,
        avg_interval: intervals.length > 0 ? (intervals.reduce((a,b) => a+b, 0) / intervals.length).toFixed(1) : 'N/A'
      };
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IMEI ile cihazın son konumunu bul
app.get('/api/devices/locate/:imei', async (req, res) => {
  try {
    const position = await db.getLastPositionByImei(req.params.imei);
    if (!position) return res.status(404).json({ error: 'Cihaz bulunamadı veya henüz konum göndermedi' });
    res.json(position);
  } catch (error) {
    res.status(500).json({ error: 'Failed to locate device' });
  }
});

// Cihaz bilgilerini kaydet/güncelle
app.put('/api/devices/:imei', async (req, res) => {
  try {
    const success = await db.updateDeviceMetadata(req.params.imei, req.body);
    if (!success) return res.status(404).json({ error: 'Cihaz bulunamadı' });
    res.json({ success: true, message: 'Cihaz başarıyla kaydedildi' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

io.on('connection', (socket) => {
  console.log(`[+] Dashboard connected via WebSocket: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[-] Dashboard disconnected: ${socket.id}`);
  });
});

// --- TCP SERVER (GT06N PROTOCOL) ---
const START_BIT = Buffer.from([0x78, 0x78]);
const STOP_BIT = Buffer.from([0x0D, 0x0A]);

const PROTOCOLS = {
  LOGIN: 0x01,
  LOCATION: 0x12,
  STATUS: 0x13,
  ALARM: 0x16,
  LOCATION_EXT: 0x22
};

const server = net.createServer((socket) => {
  console.log(`[+] New device connected: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('data', (data) => {
    const currentImei = connectedDevices.get(socket) || 'Unknown';
    logRawPacket(currentImei, data);

    if (data.length >= 10 && data.subarray(0, 2).equals(START_BIT) && data.subarray(data.length - 2).equals(STOP_BIT)) {
      const packetLength = data[2];
      const protocolNumber = data[3];

      switch (protocolNumber) {
        case PROTOCOLS.LOGIN:
          handleLoginPacket(socket, data);
          break;
        case PROTOCOLS.LOCATION:
          handleLocationPacket(socket, data);
          break;
        case PROTOCOLS.STATUS:
          handleStatusPacket(socket, data);
          break;
        case PROTOCOLS.ALARM:
        case PROTOCOLS.LOCATION_EXT:
          // These packets start with normal location data, so parse it
          handleLocationPacket(socket, data);
          
          // Then extract Terminal Information for ACC status
          // Format usually ends with: TerminalInfo(1) + Voltage(1) + GSM(1) + AlarmLang(2) + Serial(2) + Error(2) + Stop(2)
          // Which means TerminalInfo is 11 bytes from the end.
          if (data.length >= 15) {
             const terminalInfo = data[data.length - 11];
             const accOn = (terminalInfo & 0x02) !== 0;
             const imei = connectedDevices.get(socket);
             if (imei) {
                console.log(`[TCP] ACC Extracted from 0x${protocolNumber.toString(16)} for ${imei}: ACC=${accOn ? 'ON' : 'OFF'}`);
                db.updateDeviceAcc(imei, accOn).catch(e => console.error(e));
                io.emit('device_status', { imei, acc_on: accOn });
             }
          }
          break;
        default:
          const imei = connectedDevices.get(socket) || 'Unknown';
          console.log(`[TCP] Unhandled packet 0x${protocolNumber.toString(16)} from ${imei}:`, data.toString('hex'));
          break;
      }
    }
  });

  socket.on('close', () => {
    console.log(`[-] Device disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
  });

  socket.on('error', (err) => {
    console.error(`Socket error: ${err.message}`);
  });
});

const connectedDevices = new Map();

async function handleLoginPacket(socket, data) {
  const terminalIdRaw = data.subarray(4, 12);
  let imei = terminalIdRaw.toString('hex');
  // GT06 sends 8 bytes (16 hex chars). Standard IMEI is 15 digits, usually padded with a leading 0.
  if (imei.startsWith('0') && imei.length === 16) {
    imei = imei.substring(1);
  }
  console.log(`[TCP] Login Packet from IMEI: ${imei}`);
  
  connectedDevices.set(socket, imei);
  await db.verifyOrRegisterDevice(imei);

  const serialNo = data.subarray(12, 14);
  const response = Buffer.alloc(10);
  
  response[0] = 0x78;
  response[1] = 0x78;
  response[2] = 0x05; 
  response[3] = 0x01; 
  response[4] = serialNo[0];
  response[5] = serialNo[1];
  
  const crcData = response.subarray(2, 6);
  const calculatedCrc = crc16(crcData);
  response[6] = (calculatedCrc >> 8) & 0xFF;
  response[7] = calculatedCrc & 0xFF;
  
  response[8] = 0x0D;
  response[9] = 0x0A;

  socket.write(response);
}

async function handleLocationPacket(socket, data) {
  try {
    const imei = connectedDevices.get(socket);
    if (!imei) return;

    const locationData = parseLocationPacket(data);
    
    // Snap-to-road: use OSRM nearest to align GPS coordinates to nearest road
    const snapped = await snapToRoad(locationData.latitude, locationData.longitude);
    if (snapped) {
      locationData.latitude = snapped.lat;
      locationData.longitude = snapped.lng;
    }
    
    // Get current ACC status from device table BEFORE saving
    const accStatus = await db.pool.execute('SELECT acc_on FROM devices WHERE imei = ?', [imei]);
    const accOn = accStatus[0].length > 0 ? !!accStatus[0][0].acc_on : false;

    // Save to DB (passing accOn)
    await db.saveLocation(imei, locationData, accOn ? 1 : 0);
    
    
    // Construct real-time payload
    const payload = {
      imei: imei,
      lat: locationData.latitude,
      lng: locationData.longitude,
      speed: locationData.speed,
      course: locationData.course,
      status: locationData.speed > 0 ? 'moving' : 'stopped',
      ignition: accOn,
      last_update: new Date().toISOString()
    };
    
    // EMIT TO DASHBOARD CLIENTS VIA WEBSOCKETS!
    io.emit('location_update', payload);
    console.log(`Emitted real-time update for ${imei}`);
    
    // Run alarm checks
    alarmEngine.checkAlarms(imei, locationData, accOn).catch(e => console.error('Alarm check error:', e));
    
    // Run trip detection
    tripEngine.onLocationUpdate(imei, locationData, accOn).catch(e => console.error('Trip engine error:', e));
    
  } catch (err) {
    console.error('Error parsing/saving location packet:', err.message);
  }
}

// Snap-to-road using OSRM nearest service (free, no API key needed)
async function snapToRoad(lat, lng) {
  try {
    const url = `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    const result = await response.json();
    if (result.code === 'Ok' && result.waypoints && result.waypoints.length > 0) {
      const wp = result.waypoints[0];
      // Only snap if the distance is reasonable (< 50 meters)
      if (wp.distance < 50) {
        return { lat: wp.location[1], lng: wp.location[0] };
      }
    }
    return null; // Keep original if no road nearby
  } catch (err) {
    // If OSRM is down or timeout, silently fall back to raw GPS
    return null;
  }
}

async function handleStatusPacket(socket, data) {
  try {
    const imei = connectedDevices.get(socket);
    if (!imei) return;

    // GT06 Status Packet (0x13) format:
    // [0-1] Start bits, [2] Length, [3] Protocol (0x13)
    // [4] Terminal Information, [5] Voltage Level, [6] GSM Signal, [7-8] Alarm/Language
    const terminalInfo = data[4];
    
    // Bit 1 of terminal info = ACC status (0=OFF, 1=ON)
    const accOn = (terminalInfo & 0x02) !== 0;
    // Bit 0 = Oil/Electric connected
    const oilElectric = (terminalInfo & 0x01) !== 0;
    
    console.log(`[TCP] Status from ${imei}: ACC=${accOn ? 'ON' : 'OFF'}, Oil=${oilElectric ? 'ON' : 'OFF'}`);
    
    // Save ACC status to devices table
    await db.updateDeviceAcc(imei, accOn);
    
    // Emit to dashboard
    io.emit('device_status', { imei, acc_on: accOn });

    // Send ACK response
    const serialNo = data.subarray(data.length - 6, data.length - 4);
    const response = Buffer.alloc(10);
    response[0] = 0x78; response[1] = 0x78;
    response[2] = 0x05; response[3] = 0x13;
    response[4] = serialNo[0]; response[5] = serialNo[1];
    const crcData = response.subarray(2, 6);
    const calculatedCrc = crc16(crcData);
    response[6] = (calculatedCrc >> 8) & 0xFF;
    response[7] = calculatedCrc & 0xFF;
    response[8] = 0x0D; response[9] = 0x0A;
    socket.write(response);
  } catch (err) {
    console.error('Error handling status packet:', err.message);
  }
}

// Start both servers
server.listen(PORT, () => {
  console.log(`TCP Tracking Server listening on port ${PORT}...`);
});

httpServer.listen(API_PORT, async () => {
  console.log(`HTTP/WebSocket API Server listening on port ${API_PORT}...`);
  await db.cleanGhostDevices();
  
  // Check for disconnected devices every 5 minutes
  setInterval(() => alarmEngine.checkDisconnectedDevices(), 5 * 60 * 1000);
  console.log('🚨 Alarm Engine started.');
  console.log('🚗 Trip Engine started.');
});
