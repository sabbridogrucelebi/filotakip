const net = require('net');
const { crc16 } = require('./parser');

const HOST = '127.0.0.1';
const PORT = 5000;

// Helper to create a fake location packet
function createLocationPacket(imei, lat, lng, speed) {
  const packet = Buffer.alloc(45); // Approximate size
  packet[0] = 0x78; // Start bit
  packet[1] = 0x78;
  packet[2] = 0x22; // Packet length
  packet[3] = 0x12; // Protocol Number (Location)

  // Datetime (fake)
  const now = new Date();
  packet[4] = now.getFullYear() - 2000;
  packet[5] = now.getMonth() + 1;
  packet[6] = now.getDate();
  packet[7] = now.getHours();
  packet[8] = now.getMinutes();
  packet[9] = now.getSeconds();

  // Quantity of GPS info satellites
  packet[10] = 0xC0 | 12; // 12 satellites

  // Latitude
  let latDegrees = Math.floor(Math.abs(lat));
  let latMinutes = (Math.abs(lat) - latDegrees) * 60;
  let latInt = Math.floor((latDegrees * 60 + latMinutes) * 30000);
  packet.writeUInt32BE(latInt, 11);

  // Longitude
  let lngDegrees = Math.floor(Math.abs(lng));
  let lngMinutes = (Math.abs(lng) - lngDegrees) * 60;
  let lngInt = Math.floor((lngDegrees * 60 + lngMinutes) * 30000);
  packet.writeUInt32BE(lngInt, 15);

  // Speed
  packet[19] = speed;

  // Course, Status
  packet.writeUInt16BE(0x154C, 20);

  // MCC, MNC, LAC, Cell ID (Fake)
  packet.writeUInt16BE(0x01CC, 22);
  packet[24] = 0x01;
  packet.writeUInt16BE(0x270F, 25);
  packet.writeUInt16BE(0x0384, 27);

  // ACC, Data Upload Mode, GPS Real-time (Fake)
  packet[29] = 0x00;
  packet[30] = 0x01;
  packet[31] = 0x00;
  packet[32] = 0x01; // Mileage
  packet.writeUInt32BE(0x00000000, 33);

  // Info Serial No
  packet[37] = 0x00;
  packet[38] = 0x01;

  // CRC
  const crcData = packet.subarray(2, 39);
  const calculatedCrc = crc16(crcData);
  packet[39] = (calculatedCrc >> 8) & 0xFF;
  packet[40] = calculatedCrc & 0xFF;

  packet[41] = 0x0D; // Stop bit
  packet[42] = 0x0A;

  return packet.subarray(0, 43);
}

// Simüle edilecek araçlar
const vehicles = [
  { imei: '861234567890123', lat: 41.0082, lng: 28.9784, speed: 60, name: 'İstanbul Taksi 1' },
  { imei: '869876543210987', lat: 41.0500, lng: 29.0000, speed: 45, name: 'İstanbul Taksi 2' },
  { imei: '865555555555555', lat: 39.9208, lng: 32.8541, speed: 115, name: 'Ankara Kargo (Hız İhlali)' }
];

console.log('Başlatılıyor: FiloTakip GPS Simülatörü...');

vehicles.forEach((vehicle, index) => {
  setTimeout(() => {
    const client = new net.Socket();
    
    client.connect(PORT, HOST, () => {
      console.log(`[${vehicle.name}] Sunucuya bağlandı. IMEI: ${vehicle.imei}`);
      
      // Send Fake Login
      const loginPacket = Buffer.alloc(18);
      loginPacket[0] = 0x78; loginPacket[1] = 0x78;
      loginPacket[2] = 0x0D; loginPacket[3] = 0x01;
      Buffer.from(vehicle.imei, 'hex').copy(loginPacket, 4);
      // Serial & CRC & Stop... (simplified for test)
      loginPacket[12] = 0x00; loginPacket[13] = 0x01;
      loginPacket[16] = 0x0D; loginPacket[17] = 0x0A;
      client.write(loginPacket);

      // Saniyede bir hareket et
      setInterval(() => {
        vehicle.lat += (Math.random() - 0.5) * 0.001;
        vehicle.lng += (Math.random() - 0.5) * 0.001;
        vehicle.speed = Math.floor(Math.random() * 10) + (index === 2 ? 105 : 50); // Ankara speeding

        const locPacket = createLocationPacket(vehicle.imei, vehicle.lat, vehicle.lng, vehicle.speed);
        client.write(locPacket);
        console.log(`[${vehicle.name}] Konum gönderildi -> Hız: ${vehicle.speed}km/h`);
      }, 2000); // 2 saniyede bir paket
    });

    client.on('error', (err) => {
      console.log(`[${vehicle.name}] Bağlantı Hatası: ${err.message}`);
    });

  }, index * 1000); // Stagger connections
});
