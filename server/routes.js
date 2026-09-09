// FiloTakip PRO - All API Routes
// Alarms, Geofences, Trips, History, Reports, Maintenance, POI, Relay Commands
const { authMiddleware, roleMiddleware } = require('./auth');

function createAllRoutes(app, pool, io) {

  // =====================================================================
  //  ALARM & BİLDİRİM SİSTEMİ
  // =====================================================================

  // Get all alarms (with filters)
  app.get('/api/alarms', async (req, res) => {
    try {
      const { imei, type, severity, resolved, limit = 50, offset = 0 } = req.query;
      let sql = `SELECT a.*, d.plate_number as plate FROM alarms a LEFT JOIN devices d ON a.device_imei = d.imei WHERE 1=1`;
      const params = [];

      if (imei) { sql += ' AND a.device_imei = ?'; params.push(imei); }
      if (type) { sql += ' AND a.alarm_type = ?'; params.push(type); }
      if (severity) { sql += ' AND a.severity = ?'; params.push(severity); }
      if (resolved !== undefined) { sql += ' AND a.is_resolved = ?'; params.push(resolved === 'true' ? 1 : 0); }

      sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await pool.execute(sql, params);

      // Get unread count
      const [unread] = await pool.execute('SELECT COUNT(*) as count FROM alarms WHERE is_read = 0');

      res.json({ alarms: rows, unreadCount: unread[0].count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Mark alarm as read
  app.put('/api/alarms/:id/read', async (req, res) => {
    try {
      await pool.execute('UPDATE alarms SET is_read = 1 WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Mark all alarms as read
  app.put('/api/alarms/read-all', async (req, res) => {
    try {
      await pool.execute('UPDATE alarms SET is_read = 1 WHERE is_read = 0');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Resolve alarm
  app.put('/api/alarms/:id/resolve', async (req, res) => {
    try {
      await pool.execute(
        'UPDATE alarms SET is_resolved = 1, resolved_at = NOW() WHERE id = ?',
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  GEOFENCE (SANAL ÇİT) SİSTEMİ
  // =====================================================================

  // List all geofences
  app.get('/api/geofences', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM geofences ORDER BY created_at DESC');
      // For each geofence, get assigned devices
      for (const gf of rows) {
        const [devices] = await pool.execute(
          'SELECT gd.device_imei, d.plate_number FROM geofence_devices gd LEFT JOIN devices d ON gd.device_imei = d.imei WHERE gd.geofence_id = ?',
          [gf.id]
        );
        gf.devices = devices;
      }
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create geofence
  app.post('/api/geofences', async (req, res) => {
    try {
      const { name, description, type, center_lat, center_lng, radius, coordinates, color, alert_on_enter, alert_on_exit, device_imeis } = req.body;
      
      const [result] = await pool.execute(
        `INSERT INTO geofences (name, description, type, center_lat, center_lng, radius, coordinates, color, alert_on_enter, alert_on_exit) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, description || null, type || 'circle', center_lat || null, center_lng || null, radius || null,
         coordinates ? JSON.stringify(coordinates) : null, color || '#3b82f6',
         alert_on_enter !== false ? 1 : 0, alert_on_exit !== false ? 1 : 0]
      );

      // Assign devices if provided
      if (device_imeis && device_imeis.length > 0) {
        for (const imei of device_imeis) {
          await pool.execute('INSERT IGNORE INTO geofence_devices (geofence_id, device_imei) VALUES (?, ?)', [result.insertId, imei]);
        }
      }

      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update geofence
  app.put('/api/geofences/:id', async (req, res) => {
    try {
      const { name, description, type, center_lat, center_lng, radius, coordinates, color, is_active, alert_on_enter, alert_on_exit, device_imeis } = req.body;
      
      await pool.execute(
        `UPDATE geofences SET name=?, description=?, type=?, center_lat=?, center_lng=?, radius=?, coordinates=?, color=?, is_active=?, alert_on_enter=?, alert_on_exit=? WHERE id=?`,
        [name, description, type, center_lat, center_lng, radius, coordinates ? JSON.stringify(coordinates) : null, color, is_active ? 1 : 0, alert_on_enter ? 1 : 0, alert_on_exit ? 1 : 0, req.params.id]
      );

      // Update device assignments
      if (device_imeis) {
        await pool.execute('DELETE FROM geofence_devices WHERE geofence_id = ?', [req.params.id]);
        for (const imei of device_imeis) {
          await pool.execute('INSERT IGNORE INTO geofence_devices (geofence_id, device_imei) VALUES (?, ?)', [req.params.id, imei]);
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete geofence
  app.delete('/api/geofences/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM geofences WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  GEÇMİŞ ROTA GÖRÜNTÜLEME (PLAYBACK)
  // =====================================================================

  // Get historical route for a device within a date range
  app.get('/api/vehicles/:imei/history', async (req, res) => {
    try {
      const { start, end } = req.query;
      if (!start || !end) return res.status(400).json({ error: 'start ve end tarihleri gerekli (YYYY-MM-DD HH:mm:ss)' });

      const [rows] = await pool.execute(
        `SELECT latitude as lat, longitude as lng, speed, course, ignition, device_time, satellites
         FROM positions WHERE device_imei = ? AND device_time BETWEEN ? AND ?
         ORDER BY device_time ASC`,
        [req.params.imei, start, end]
      );

      // Calculate stops (speed = 0, ignition = 1 for > 2 min)
      const stops = [];
      let stopStart = null;
      for (let i = 0; i < rows.length; i++) {
        const p = rows[i];
        if (p.speed < 5 && p.ignition) {
          if (!stopStart) stopStart = { lat: p.lat, lng: p.lng, startTime: p.device_time, index: i };
        } else {
          if (stopStart) {
            const duration = (new Date(p.device_time) - new Date(stopStart.startTime)) / 1000 / 60;
            if (duration >= 2) {
              stops.push({ ...stopStart, endTime: rows[i-1].device_time, durationMinutes: Math.round(duration) });
            }
            stopStart = null;
          }
        }
      }

      // Distance calculation
      let totalDistance = 0;
      let maxSpeed = 0;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].speed > 5 || rows[i-1].speed > 5) {
          totalDistance += haversine(rows[i-1].lat, rows[i-1].lng, rows[i].lat, rows[i].lng);
        }
        if (rows[i].speed > maxSpeed) maxSpeed = rows[i].speed;
      }

      res.json({
        points: rows,
        stops,
        stats: {
          totalPoints: rows.length,
          totalDistance: totalDistance.toFixed(2),
          maxSpeed,
          totalStops: stops.length
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  SEYAHATLERİ (TRIP LOG)
  // =====================================================================

  app.get('/api/vehicles/:imei/trips', async (req, res) => {
    try {
      const { start, end } = req.query;
      let sql = 'SELECT * FROM trips WHERE device_imei = ?';
      const params = [req.params.imei];

      if (start && end) {
        sql += ' AND start_time BETWEEN ? AND ?';
        params.push(start, end);
      }
      sql += ' ORDER BY start_time DESC LIMIT 100';

      const [rows] = await pool.execute(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  ARAÇ YÖNETİMİ
  // =====================================================================

  // List all vehicles with latest position
  app.get('/api/vehicles', async (req, res) => {
    try {
      const { group_id, status, search } = req.query;
      let sql = `
        SELECT 
          d.id, d.imei, d.plate_number as plate, d.status, d.idle_since, d.acc_on as ignition,
          d.driver_name, d.driver_phone, d.vehicle_model, d.vehicle_year, d.vehicle_type,
          d.speed_limit, d.fuel_consumption, d.sim_number, d.group_id,
          vg.name as group_name, vg.color as group_color,
          p.latitude as lat, p.longitude as lng, p.speed, p.course, p.device_time as last_update
        FROM devices d
        LEFT JOIN vehicle_groups vg ON d.group_id = vg.id
        LEFT JOIN (
          SELECT p1.*
          FROM positions p1
          INNER JOIN (
              SELECT device_imei, MAX(device_time) as max_time
              FROM positions
              GROUP BY device_imei
          ) p2 ON p1.device_imei = p2.device_imei AND p1.device_time = p2.max_time
        ) p ON d.imei = p.device_imei
        WHERE 1=1
      `;
      const params = [];

      if (group_id) { sql += ' AND d.group_id = ?'; params.push(group_id); }
      if (status) { sql += ' AND d.status = ?'; params.push(status); }
      if (search) { sql += ' AND (d.plate_number LIKE ? OR d.imei LIKE ? OR d.driver_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

      sql += ' ORDER BY d.plate_number ASC';
      const [rows] = await pool.execute(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single vehicle detail
  app.get('/api/vehicles/:imei/detail', async (req, res) => {
    try {
      const [vehicles] = await pool.execute(
        `SELECT d.*, vg.name as group_name FROM devices d LEFT JOIN vehicle_groups vg ON d.group_id = vg.id WHERE d.imei = ?`,
        [req.params.imei]
      );
      if (vehicles.length === 0) return res.status(404).json({ error: 'Araç bulunamadı' });

      // Get upcoming maintenance
      const [maintenance] = await pool.execute(
        'SELECT * FROM maintenance WHERE device_imei = ? ORDER BY service_date DESC LIMIT 5',
        [req.params.imei]
      );

      // Get recent alarms
      const [alarms] = await pool.execute(
        'SELECT * FROM alarms WHERE device_imei = ? ORDER BY created_at DESC LIMIT 10',
        [req.params.imei]
      );

      // Get today's trips
      const [trips] = await pool.execute(
        'SELECT * FROM trips WHERE device_imei = ? AND DATE(start_time) = CURDATE() ORDER BY start_time DESC',
        [req.params.imei]
      );

      res.json({
        vehicle: vehicles[0],
        maintenance,
        recentAlarms: alarms,
        todayTrips: trips
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete vehicle
  app.delete('/api/vehicles/:imei', async (req, res) => {
    try {
      await pool.execute('DELETE FROM devices WHERE imei = ?', [req.params.imei]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  ARAÇ GRUPLARI
  // =====================================================================

  app.get('/api/vehicle-groups', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT vg.*, COUNT(d.id) as vehicle_count 
        FROM vehicle_groups vg LEFT JOIN devices d ON vg.id = d.group_id 
        GROUP BY vg.id ORDER BY vg.name
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/vehicle-groups', async (req, res) => {
    try {
      const { name, description, color, icon } = req.body;
      const [result] = await pool.execute(
        'INSERT INTO vehicle_groups (name, description, color, icon) VALUES (?, ?, ?, ?)',
        [name, description || null, color || '#3b82f6', icon || 'truck']
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/vehicle-groups/:id', async (req, res) => {
    try {
      await pool.execute('UPDATE devices SET group_id = NULL WHERE group_id = ?', [req.params.id]);
      await pool.execute('DELETE FROM vehicle_groups WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  BAKIM & SERVİS TAKİBİ
  // =====================================================================

  app.get('/api/maintenance', async (req, res) => {
    try {
      const { imei } = req.query;
      let sql = `SELECT m.*, d.plate_number as plate FROM maintenance m LEFT JOIN devices d ON m.device_imei = d.imei WHERE 1=1`;
      const params = [];
      if (imei) { sql += ' AND m.device_imei = ?'; params.push(imei); }
      sql += ' ORDER BY m.service_date DESC';
      const [rows] = await pool.execute(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/maintenance', async (req, res) => {
    try {
      const { device_imei, type, title, description, cost, service_date, next_service_date, next_service_km, current_km } = req.body;
      const [result] = await pool.execute(
        `INSERT INTO maintenance (device_imei, type, title, description, cost, service_date, next_service_date, next_service_km, current_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [device_imei, type, title, description || null, cost || null, service_date || null, next_service_date || null, next_service_km || null, current_km || null]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/maintenance/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM maintenance WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get upcoming maintenance reminders
  app.get('/api/maintenance/reminders', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT m.*, d.plate_number as plate 
        FROM maintenance m LEFT JOIN devices d ON m.device_imei = d.imei 
        WHERE m.next_service_date IS NOT NULL AND m.next_service_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND m.is_completed = 1
        ORDER BY m.next_service_date ASC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  POI (İLGİ NOKTALARI)
  // =====================================================================

  app.get('/api/poi', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM poi WHERE is_active = 1 ORDER BY name');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/poi', async (req, res) => {
    try {
      const { name, description, latitude, longitude, category, icon, color, radius } = req.body;
      const [result] = await pool.execute(
        'INSERT INTO poi (name, description, latitude, longitude, category, icon, color, radius) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, description || null, latitude, longitude, category || 'general', icon || 'pin', color || '#3b82f6', radius || 100]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/poi/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM poi WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  RELAY CONTROL (MOTOR KESME/AÇMA)
  // =====================================================================

  app.post('/api/vehicles/:imei/relay', async (req, res) => {
    try {
      const { action } = req.body; // 'cut' or 'restore'
      const imei = req.params.imei;

      // Safety check: only allow cut when speed < 20 km/h
      if (action === 'cut') {
        const [pos] = await pool.execute(
          'SELECT speed FROM positions WHERE device_imei = ? ORDER BY device_time DESC LIMIT 1',
          [imei]
        );
        if (pos.length > 0 && pos[0].speed > 20) {
          return res.status(403).json({ error: 'Güvenlik: Araç 20 km/h üzerinde hızla giderken motor kesilemez.' });
        }
      }

      const commandType = action === 'cut' ? 'relay_on' : 'relay_off';
      const commandValue = action === 'cut' ? 'RELAY,1#' : 'RELAY,0#';

      // Log the command
      const [result] = await pool.execute(
        'INSERT INTO command_logs (device_imei, command_type, command_value, status) VALUES (?, ?, ?, ?)',
        [imei, commandType, commandValue, 'pending']
      );

      // TODO: Actually send SMS command through SMS gateway
      // For now, just log it and mark as sent
      await pool.execute('UPDATE command_logs SET status = ?, executed_at = NOW() WHERE id = ?', ['sent', result.insertId]);

      // Emit to dashboard
      io.emit('command_sent', { imei, command: commandType, status: 'sent' });

      res.json({ 
        success: true, 
        message: action === 'cut' ? 'Motor kesme komutu gönderildi' : 'Motor açma komutu gönderildi',
        commandId: result.insertId
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get command history
  app.get('/api/vehicles/:imei/commands', async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM command_logs WHERE device_imei = ? ORDER BY created_at DESC LIMIT 50',
        [req.params.imei]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  RAPORLAMA
  // =====================================================================

  // Fleet summary report
  app.get('/api/reports/fleet-summary', async (req, res) => {
    try {
      const { start, end } = req.query;
      const startDate = start || new Date().toISOString().split('T')[0];
      const endDate = end || new Date().toISOString().split('T')[0];

      const [vehicles] = await pool.execute('SELECT imei, plate_number, vehicle_model, driver_name FROM devices');
      
      const report = [];
      for (const v of vehicles) {
        const [positions] = await pool.execute(
          'SELECT latitude, longitude, speed, ignition, device_time FROM positions WHERE device_imei = ? AND DATE(device_time) BETWEEN ? AND ? ORDER BY device_time ASC',
          [v.imei, startDate, endDate]
        );

        let distance = 0, maxSpeed = 0, movingMinutes = 0, idleMinutes = 0;
        for (let i = 1; i < positions.length; i++) {
          const prev = positions[i - 1];
          const curr = positions[i];
          if (curr.speed > 5 || prev.speed > 5) {
            distance += haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
          }
          if (curr.speed > maxSpeed) maxSpeed = curr.speed;

          const timeDiff = (new Date(curr.device_time) - new Date(prev.device_time)) / 1000 / 60;
          if (timeDiff < 60) {
            if (curr.speed > 5) movingMinutes += timeDiff;
            else if (curr.ignition) idleMinutes += timeDiff;
          }
        }

        const [alarmCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM alarms WHERE device_imei = ? AND DATE(event_time) BETWEEN ? AND ?',
          [v.imei, startDate, endDate]
        );

        report.push({
          imei: v.imei,
          plate: v.plate_number,
          model: v.vehicle_model,
          driver: v.driver_name,
          distance: distance.toFixed(2),
          maxSpeed,
          movingHours: (movingMinutes / 60).toFixed(1),
          idleHours: (idleMinutes / 60).toFixed(1),
          alarmCount: alarmCount[0].count,
          dataPoints: positions.length
        });
      }

      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Speed violations report
  app.get('/api/reports/speed-violations', async (req, res) => {
    try {
      const { start, end, imei } = req.query;
      let sql = `
        SELECT a.*, d.plate_number as plate, d.speed_limit 
        FROM alarms a LEFT JOIN devices d ON a.device_imei = d.imei 
        WHERE a.alarm_type = 'speed'
      `;
      const params = [];
      if (start && end) { sql += ' AND DATE(a.event_time) BETWEEN ? AND ?'; params.push(start, end); }
      if (imei) { sql += ' AND a.device_imei = ?'; params.push(imei); }
      sql += ' ORDER BY a.event_time DESC LIMIT 200';

      const [rows] = await pool.execute(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard statistics
  app.get('/api/reports/dashboard-stats', async (req, res) => {
    try {
      const [totalVehicles] = await pool.execute('SELECT COUNT(*) as count FROM devices');
      const [movingVehicles] = await pool.execute("SELECT COUNT(*) as count FROM devices WHERE status = 'moving'");
      const [stoppedVehicles] = await pool.execute("SELECT COUNT(*) as count FROM devices WHERE status = 'stopped'");
      const [offlineVehicles] = await pool.execute("SELECT COUNT(*) as count FROM devices WHERE status = 'offline' OR last_update < DATE_SUB(NOW(), INTERVAL 1 HOUR)");

      const [todayAlarms] = await pool.execute('SELECT COUNT(*) as count FROM alarms WHERE DATE(created_at) = CURDATE()');
      const [unresolvedAlarms] = await pool.execute('SELECT COUNT(*) as count FROM alarms WHERE is_resolved = 0');

      const [todayDistance] = await pool.execute(`
        SELECT SUM(distance_km) as total FROM trips WHERE DATE(start_time) = CURDATE() AND is_completed = 1
      `);

      const [weeklyAlarms] = await pool.execute(`
        SELECT DATE(created_at) as date, alarm_type, COUNT(*) as count 
        FROM alarms WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at), alarm_type ORDER BY date
      `);

      res.json({
        vehicles: {
          total: totalVehicles[0].count,
          moving: movingVehicles[0].count,
          stopped: stoppedVehicles[0].count,
          offline: offlineVehicles[0].count
        },
        alarms: {
          today: todayAlarms[0].count,
          unresolved: unresolvedAlarms[0].count,
          weekly: weeklyAlarms
        },
        todayDistance: todayDistance[0].total || 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================================
  //  CİHAZ SAĞLIK MONİTÖRÜ
  // =====================================================================

  app.get('/api/devices/health', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT d.imei, d.plate_number as plate, d.status, d.acc_on, d.last_update, d.sim_number,
          TIMESTAMPDIFF(SECOND, d.last_update, NOW()) as seconds_since_update,
          (SELECT COUNT(*) FROM positions WHERE device_imei = d.imei AND DATE(device_time) = CURDATE()) as today_positions,
          (SELECT COUNT(*) FROM alarms WHERE device_imei = d.imei AND is_resolved = 0) as open_alarms
        FROM devices d ORDER BY d.last_update DESC
      `);

      const health = rows.map(r => ({
        ...r,
        connectionStatus: !r.last_update ? 'never' :
          r.seconds_since_update < 300 ? 'online' :
          r.seconds_since_update < 3600 ? 'idle' : 'offline',
        signalQuality: r.today_positions > 100 ? 'excellent' :
          r.today_positions > 30 ? 'good' :
          r.today_positions > 0 ? 'weak' : 'none'
      }));

      res.json(health);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

}

// Haversine formula
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = { createAllRoutes };
