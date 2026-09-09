// FiloTakip PRO - Alarm Engine & Geofence Checker
// Real-time alarm generation based on vehicle telemetry data

class AlarmEngine {
  constructor(pool, io) {
    this.pool = pool;
    this.io = io;
    this.geofenceCache = [];
    this.deviceGeofenceState = new Map(); // imei -> { geofenceId: 'inside'|'outside' }
    this.refreshGeofences();
    
    // Refresh geofence cache every 60 seconds
    setInterval(() => this.refreshGeofences(), 60000);
  }

  async refreshGeofences() {
    try {
      const [geofences] = await this.pool.execute(
        'SELECT g.*, GROUP_CONCAT(gd.device_imei) as device_imeis FROM geofences g LEFT JOIN geofence_devices gd ON g.id = gd.geofence_id WHERE g.is_active = 1 GROUP BY g.id'
      );
      this.geofenceCache = geofences.map(gf => ({
        ...gf,
        device_imeis: gf.device_imeis ? gf.device_imeis.split(',') : []
      }));
    } catch (err) {
      console.error('Error refreshing geofences:', err.message);
    }
  }

  // Main check function - called on every location update
  async checkAlarms(imei, locationData, accOn) {
    try {
      // Get device info
      const [devices] = await this.pool.execute('SELECT * FROM devices WHERE imei = ?', [imei]);
      if (devices.length === 0) return;
      const device = devices[0];

      // 1. Speed alarm
      await this.checkSpeedAlarm(imei, device, locationData);

      // 2. Geofence alarm
      await this.checkGeofenceAlarm(imei, locationData);

      // 3. Long idle alarm (> 30 minutes)
      await this.checkIdleAlarm(imei, device, locationData, accOn);

    } catch (err) {
      console.error('AlarmEngine error:', err.message);
    }
  }

  async checkSpeedAlarm(imei, device, locationData) {
    const speedLimit = device.speed_limit || 120;
    if (locationData.speed > speedLimit) {
      await this.createAlarm({
        device_imei: imei,
        alarm_type: 'speed',
        severity: locationData.speed > speedLimit + 30 ? 'critical' : 'warning',
        title: `Hız İhlali: ${locationData.speed} km/h`,
        description: `${device.plate_number} plakalı araç ${speedLimit} km/h hız limitini aştı. Anlık hız: ${locationData.speed} km/h`,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        speed: locationData.speed,
        extra_data: { limit: speedLimit, excess: locationData.speed - speedLimit }
      });
    }
  }

  async checkGeofenceAlarm(imei, locationData) {
    for (const gf of this.geofenceCache) {
      // Check if this geofence applies to this device
      if (gf.device_imeis.length > 0 && !gf.device_imeis.includes(imei)) continue;

      const isInside = this.isPointInGeofence(locationData.latitude, locationData.longitude, gf);
      const stateKey = `${imei}-${gf.id}`;
      const previousState = this.deviceGeofenceState.get(stateKey);

      if (previousState === undefined) {
        // First check, just record state
        this.deviceGeofenceState.set(stateKey, isInside ? 'inside' : 'outside');
        continue;
      }

      if (previousState === 'outside' && isInside && gf.alert_on_enter) {
        await this.createAlarm({
          device_imei: imei,
          alarm_type: 'geofence_enter',
          severity: 'info',
          title: `Bölgeye Giriş: ${gf.name}`,
          description: `Araç "${gf.name}" bölgesine girdi.`,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          extra_data: { geofence_id: gf.id, geofence_name: gf.name }
        });
        // Log geofence event
        await this.pool.execute(
          'INSERT INTO geofence_events (device_imei, geofence_id, event_type, event_time, latitude, longitude) VALUES (?, ?, ?, NOW(), ?, ?)',
          [imei, gf.id, 'enter', locationData.latitude, locationData.longitude]
        );
      }

      if (previousState === 'inside' && !isInside && gf.alert_on_exit) {
        await this.createAlarm({
          device_imei: imei,
          alarm_type: 'geofence_exit',
          severity: 'warning',
          title: `Bölgeden Çıkış: ${gf.name}`,
          description: `Araç "${gf.name}" bölgesinden çıktı.`,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          extra_data: { geofence_id: gf.id, geofence_name: gf.name }
        });
        await this.pool.execute(
          'INSERT INTO geofence_events (device_imei, geofence_id, event_type, event_time, latitude, longitude) VALUES (?, ?, ?, NOW(), ?, ?)',
          [imei, gf.id, 'exit', locationData.latitude, locationData.longitude]
        );
      }

      this.deviceGeofenceState.set(stateKey, isInside ? 'inside' : 'outside');
    }
  }

  async checkIdleAlarm(imei, device, locationData, accOn) {
    if (locationData.speed < 5 && accOn && device.idle_since) {
      const idleMinutes = (Date.now() - new Date(device.idle_since).getTime()) / 1000 / 60;
      // Trigger at 30 min mark (check if we already sent this alarm recently)
      if (idleMinutes >= 30 && idleMinutes < 32) {
        const [existing] = await this.pool.execute(
          "SELECT id FROM alarms WHERE device_imei = ? AND alarm_type = 'idle' AND event_time > DATE_SUB(NOW(), INTERVAL 1 HOUR) LIMIT 1",
          [imei]
        );
        if (existing.length === 0) {
          await this.createAlarm({
            device_imei: imei,
            alarm_type: 'idle',
            severity: 'warning',
            title: `Uzun Rölanti: ${Math.round(idleMinutes)} dk`,
            description: `${device.plate_number} plakalı araç ${Math.round(idleMinutes)} dakikadır kontak açık bekliyor.`,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            extra_data: { idle_minutes: Math.round(idleMinutes) }
          });
        }
      }
    }
  }

  // Check if device went offline (called periodically)
  async checkDisconnectedDevices() {
    try {
      const [devices] = await this.pool.execute(
        "SELECT imei, plate_number, last_update FROM devices WHERE last_update < DATE_SUB(NOW(), INTERVAL 1 HOUR) AND status != 'offline'"
      );
      for (const d of devices) {
        const [existing] = await this.pool.execute(
          "SELECT id FROM alarms WHERE device_imei = ? AND alarm_type = 'disconnect' AND event_time > DATE_SUB(NOW(), INTERVAL 6 HOUR) LIMIT 1",
          [d.imei]
        );
        if (existing.length === 0) {
          await this.createAlarm({
            device_imei: d.imei,
            alarm_type: 'disconnect',
            severity: 'critical',
            title: 'Bağlantı Koptu',
            description: `${d.plate_number} plakalı araçtan 1 saatten fazla sinyal alınamıyor.`
          });
        }
        await this.pool.execute("UPDATE devices SET status = 'offline' WHERE imei = ?", [d.imei]);
      }
    } catch (err) {
      console.error('Disconnect check error:', err.message);
    }
  }

  async createAlarm(data) {
    try {
      const [result] = await this.pool.execute(
        `INSERT INTO alarms (device_imei, alarm_type, severity, title, description, event_time, latitude, longitude, speed, extra_data)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [data.device_imei, data.alarm_type, data.severity || 'warning', data.title, data.description || null,
         data.latitude || null, data.longitude || null, data.speed || null,
         data.extra_data ? JSON.stringify(data.extra_data) : null]
      );

      // Get plate for the notification
      const [device] = await this.pool.execute('SELECT plate_number FROM devices WHERE imei = ?', [data.device_imei]);
      const plate = device.length > 0 ? device[0].plate_number : data.device_imei;

      // Emit alarm to all connected dashboards
      this.io.emit('new_alarm', {
        id: result.insertId,
        ...data,
        plate,
        created_at: new Date().toISOString()
      });

      console.log(`🚨 ALARM: [${data.alarm_type}] ${data.title} - ${plate}`);
    } catch (err) {
      console.error('Error creating alarm:', err.message);
    }
  }

  isPointInGeofence(lat, lng, geofence) {
    if (geofence.type === 'circle') {
      const distance = this.haversineDistance(lat, lng, geofence.center_lat, geofence.center_lng);
      return distance <= (geofence.radius / 1000); // radius is in meters, distance in km
    }

    if (geofence.type === 'polygon') {
      const coords = typeof geofence.coordinates === 'string' ? JSON.parse(geofence.coordinates) : geofence.coordinates;
      if (!coords || coords.length < 3) return false;
      return this.pointInPolygon(lat, lng, coords);
    }

    return false;
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}

module.exports = AlarmEngine;
