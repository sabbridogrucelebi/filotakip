function parseLocationPacket(data) {
  // Information content starts at index 4
  const info = data.subarray(4, data.length - 6); // minus 6 for serial(2) + crc(2) + stop(2)
  
  // Date Time (6 bytes)
  const year = info[0];
  const month = info[1];
  const day = info[2];
  const hour = info[3];
  const minute = info[4];
  const second = info[5];
  const date = new Date(Date.UTC(2000 + year, month - 1, day, hour, minute, second));

  // Quantity of GPS info (1 byte)
  const gpsInfoLength = (info[6] & 0xF0) >> 4;
  const satellites = info[6] & 0x0F;

  // Latitude (4 bytes)
  const latRaw = info.readUInt32BE(7);
  let latitude = latRaw / 30000.0 / 60.0;

  // Longitude (4 bytes)
  const lonRaw = info.readUInt32BE(11);
  let longitude = lonRaw / 30000.0 / 60.0;

  // Speed (1 byte)
  const speed = info[15];

  // Course, Status (2 bytes)
  const courseStatus = info.readUInt16BE(16);
  const course = courseStatus & 0x03FF; // lower 10 bits
  
  // Status bits
  const isGpsTrackingOn = (courseStatus & 0x4000) !== 0; // bit 14
  const isWest = (courseStatus & 0x0800) !== 0; // bit 11
  const isNorth = (courseStatus & 0x0400) !== 0; // bit 10
  
  if (!isNorth) latitude = -latitude;
  if (isWest) longitude = -longitude;

  return {
    date,
    satellites,
    latitude,
    longitude,
    speed,
    course,
    isGpsTrackingOn
  };
}

// Basic CRC-ITU implementation
function crc16(buffer) {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (~crc) & 0xFFFF;
}

module.exports = {
  parseLocationPacket,
  crc16
};
