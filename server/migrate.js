// FiloTakip PRO - Migration Script
// Run: node migrate.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const pool = mysql.createPool({
    user: process.env.DB_USER || 'root',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'filotakip',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  });

  const conn = await pool.getConnection();
  console.log('🔗 MySQL bağlantısı kuruldu.');

  const migrations = [
    // Sessions table
    {
      name: 'Create sessions table',
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        refresh_token VARCHAR(500) NOT NULL,
        device_info VARCHAR(255),
        ip_address VARCHAR(45),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sessions_token (refresh_token(255)),
        INDEX idx_sessions_user (user_id)
      )`
    },
    // Vehicle Groups
    {
      name: 'Create vehicle_groups table',
      sql: `CREATE TABLE IF NOT EXISTS vehicle_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        color VARCHAR(20) DEFAULT '#3b82f6',
        icon VARCHAR(20) DEFAULT 'truck',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    // Geofences
    {
      name: 'Create geofences table',
      sql: `CREATE TABLE IF NOT EXISTS geofences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        type VARCHAR(20) NOT NULL DEFAULT 'circle',
        center_lat DOUBLE,
        center_lng DOUBLE,
        radius FLOAT,
        coordinates JSON,
        color VARCHAR(20) DEFAULT '#3b82f6',
        is_active BOOLEAN DEFAULT TRUE,
        alert_on_enter BOOLEAN DEFAULT TRUE,
        alert_on_exit BOOLEAN DEFAULT TRUE,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    // Geofence Devices
    {
      name: 'Create geofence_devices table',
      sql: `CREATE TABLE IF NOT EXISTS geofence_devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        geofence_id INT NOT NULL,
        device_imei VARCHAR(20) NOT NULL,
        UNIQUE KEY unique_geofence_device (geofence_id, device_imei)
      )`
    },
    // Geofence Events
    {
      name: 'Create geofence_events table',
      sql: `CREATE TABLE IF NOT EXISTS geofence_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_imei VARCHAR(20),
        geofence_id INT,
        event_type VARCHAR(20) NOT NULL,
        event_time DATETIME NOT NULL,
        latitude DOUBLE,
        longitude DOUBLE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_geofence_events (device_imei, geofence_id, event_time)
      )`
    },
    // Trips
    {
      name: 'Create trips table',
      sql: `CREATE TABLE IF NOT EXISTS trips (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_imei VARCHAR(20),
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        start_lat DOUBLE,
        start_lng DOUBLE,
        end_lat DOUBLE,
        end_lng DOUBLE,
        start_address VARCHAR(255),
        end_address VARCHAR(255),
        distance_km FLOAT DEFAULT 0,
        max_speed FLOAT DEFAULT 0,
        avg_speed FLOAT DEFAULT 0,
        duration_minutes INT DEFAULT 0,
        idle_minutes INT DEFAULT 0,
        fuel_used FLOAT DEFAULT 0,
        trip_type VARCHAR(20) DEFAULT 'business',
        is_completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trips_device_time (device_imei, start_time)
      )`
    },
    // Maintenance
    {
      name: 'Create maintenance table',
      sql: `CREATE TABLE IF NOT EXISTS maintenance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_imei VARCHAR(20),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        cost DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'TRY',
        service_date DATE,
        next_service_date DATE,
        next_service_km FLOAT,
        current_km FLOAT,
        is_completed BOOLEAN DEFAULT TRUE,
        reminder_sent BOOLEAN DEFAULT FALSE,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_maintenance_device (device_imei)
      )`
    },
    // Notifications
    {
      name: 'Create notifications table',
      sql: `CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        alarm_id BIGINT,
        channel VARCHAR(20) NOT NULL DEFAULT 'web',
        title VARCHAR(200),
        body TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user (user_id, is_read, created_at)
      )`
    },
    // POI
    {
      name: 'Create poi table',
      sql: `CREATE TABLE IF NOT EXISTS poi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        latitude DOUBLE NOT NULL,
        longitude DOUBLE NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        icon VARCHAR(20) DEFAULT 'pin',
        color VARCHAR(20) DEFAULT '#3b82f6',
        radius FLOAT DEFAULT 100,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    // Command Logs
    {
      name: 'Create command_logs table',
      sql: `CREATE TABLE IF NOT EXISTS command_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_imei VARCHAR(20),
        command_type VARCHAR(50) NOT NULL,
        command_value VARCHAR(255),
        sent_by INT,
        status VARCHAR(20) DEFAULT 'pending',
        response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        executed_at DATETIME,
        INDEX idx_commands_device (device_imei, created_at)
      )`
    },
    // Add new columns to users
    {
      name: 'Add full_name to users',
      sql: `ALTER TABLE users ADD COLUMN full_name VARCHAR(100)`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add phone to users',
      sql: `ALTER TABLE users ADD COLUMN phone VARCHAR(20)`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add avatar_url to users',
      sql: `ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255)`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add is_active to users',
      sql: `ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    // Add new columns to devices
    {
      name: 'Add vehicle_type to devices',
      sql: `ALTER TABLE devices ADD COLUMN vehicle_type VARCHAR(20) DEFAULT 'car'`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add speed_limit to devices',
      sql: `ALTER TABLE devices ADD COLUMN speed_limit INT DEFAULT 120`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add fuel_consumption to devices',
      sql: `ALTER TABLE devices ADD COLUMN fuel_consumption FLOAT DEFAULT 8.0`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add group_id to devices',
      sql: `ALTER TABLE devices ADD COLUMN group_id INT`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    // Update alarms table with new columns
    {
      name: 'Add severity to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN severity VARCHAR(20) DEFAULT 'warning'`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add title to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN title VARCHAR(200)`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add description to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN description TEXT`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add speed to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN speed FLOAT`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add extra_data to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN extra_data JSON`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add is_read to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN is_read BOOLEAN DEFAULT FALSE`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add resolved_by to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN resolved_by INT`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    {
      name: 'Add resolved_at to alarms',
      sql: `ALTER TABLE alarms ADD COLUMN resolved_at DATETIME`,
      ignore_error: 'ER_DUP_FIELDNAME'
    },
    // Default admin user (password: admin123)
    {
      name: 'Insert default admin user',
      sql: `INSERT IGNORE INTO users (username, password_hash, email, full_name, role) VALUES 
        ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@filotakip.com', 'Sistem Yöneticisi', 'admin')`,
      ignore_error: 'ER_DUP_ENTRY'
    }
  ];

  for (const m of migrations) {
    try {
      await conn.query(m.sql);
      console.log(`  ✅ ${m.name}`);
    } catch (err) {
      if (m.ignore_error && err.code === m.ignore_error) {
        console.log(`  ⏭️  ${m.name} (zaten mevcut)`);
      } else {
        console.error(`  ❌ ${m.name}: ${err.message}`);
      }
    }
  }

  conn.release();
  await pool.end();
  console.log('\n🎉 Migration tamamlandı!');
}

migrate().catch(err => {
  console.error('Migration hatası:', err);
  process.exit(1);
});
