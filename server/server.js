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

// --- REST API ENDPOINTS ---
app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await db.getLatestVehiclePositions();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
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
};

const server = net.createServer((socket) => {
  console.log(`[+] New device connected: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('data', (data) => {
    // console.log(`[Data Received] (${data.length} bytes):`, data.toString('hex'));

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
    
    // Save to DB
    await db.saveLocation(imei, locationData);
    
    // Construct real-time payload
    const payload = {
      imei: imei,
      lat: locationData.latitude,
      lng: locationData.longitude,
      speed: locationData.speed,
      course: locationData.course,
      status: locationData.speed > 0 ? 'moving' : 'stopped',
      last_update: new Date().toISOString()
    };
    
    // EMIT TO DASHBOARD CLIENTS VIA WEBSOCKETS!
    io.emit('location_update', payload);
    console.log(`Emitted real-time update for ${imei}`);
    
  } catch (err) {
    console.error('Error parsing/saving location packet:', err.message);
  }
}

function handleStatusPacket(socket, data) {
  // Logic to parse status, battery, signal strength
}

// Start both servers
server.listen(PORT, () => {
  console.log(`TCP Tracking Server listening on port ${PORT}...`);
});

httpServer.listen(API_PORT, async () => {
  console.log(`HTTP/WebSocket API Server listening on port ${API_PORT}...`);
  await db.cleanGhostDevices();
});
