-- Filo Takip PRO - MySQL Veritabanı Şeması
-- Tüm tablolar: users, devices, positions, alarms, geofences, geofence_events, 
-- trips, vehicle_groups, maintenance, notifications, sessions, poi, command_logs

-- Güvenli Sütun Güncelleme Prosedürü (Var olan tabloları silmeden günceller)
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DELIMITER //
CREATE PROCEDURE AddColumnIfNotExists(
    IN dbName VARCHAR(255),
    IN tableName VARCHAR(255),
    IN colName VARCHAR(255),
    IN colDef VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = dbName
          AND TABLE_NAME = tableName
          AND COLUMN_NAME = colName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', colName, ' ', colDef);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- 1. Kullanıcılar Tablosu
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'manager', 'driver', 'viewer'
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Eski tablo varsa yeni sütunları ekle
CALL AddColumnIfNotExists(DATABASE(), 'users', 'full_name', 'VARCHAR(100)');
CALL AddColumnIfNotExists(DATABASE(), 'users', 'phone', 'VARCHAR(20)');
CALL AddColumnIfNotExists(DATABASE(), 'users', 'avatar_url', 'VARCHAR(255)');
CALL AddColumnIfNotExists(DATABASE(), 'users', 'is_active', 'BOOLEAN DEFAULT TRUE');

-- 2. Oturum Yönetimi (JWT Refresh Tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500) NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_token (refresh_token(255)),
    INDEX idx_sessions_user (user_id)
);

-- 3. Araç Grupları
CREATE TABLE IF NOT EXISTS vehicle_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    color VARCHAR(20) DEFAULT '#3b82f6',
    icon VARCHAR(20) DEFAULT 'truck',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Cihazlar (Araçlar) Tablosu
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imei VARCHAR(20) UNIQUE NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    vehicle_model VARCHAR(50),
    vehicle_year VARCHAR(10),
    vehicle_type VARCHAR(20) DEFAULT 'car', -- 'car', 'truck', 'bus', 'motorcycle', 'van'
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    sim_number VARCHAR(20),
    icon_type VARCHAR(20) DEFAULT 'car',
    icon_color VARCHAR(20) DEFAULT 'blue',
    status VARCHAR(20) DEFAULT 'offline',
    speed_limit INT DEFAULT 120,
    idle_since DATETIME,
    acc_on TINYINT(1) DEFAULT 0,
    fuel_consumption FLOAT DEFAULT 8.0, -- litre/100km tahmini
    last_update DATETIME,
    group_id INT,
    owner_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (group_id) REFERENCES vehicle_groups(id) ON DELETE SET NULL
);
CALL AddColumnIfNotExists(DATABASE(), 'devices', 'vehicle_type', 'VARCHAR(20) DEFAULT "car"');
CALL AddColumnIfNotExists(DATABASE(), 'devices', 'speed_limit', 'INT DEFAULT 120');
CALL AddColumnIfNotExists(DATABASE(), 'devices', 'idle_since', 'DATETIME');
CALL AddColumnIfNotExists(DATABASE(), 'devices', 'acc_on', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists(DATABASE(), 'devices', 'fuel_consumption', 'FLOAT DEFAULT 8.0');
CALL AddColumnIfNotExists(DATABASE(), 'devices', 'group_id', 'INT');

-- 5. Konum Geçmişi Tablosu
CREATE TABLE IF NOT EXISTS positions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_imei VARCHAR(20),
    server_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_time DATETIME NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    speed FLOAT NOT NULL,
    course FLOAT NOT NULL,
    altitude FLOAT,
    satellites INT,
    is_gps_valid BOOLEAN,
    ignition BOOLEAN,
    total_distance DOUBLE,
    raw_data TEXT,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    INDEX idx_positions_device_time (device_imei, device_time)
);

-- 6. Alarmlar ve Olaylar Tablosu
CREATE TABLE IF NOT EXISTS alarms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_imei VARCHAR(20),
    alarm_type VARCHAR(50) NOT NULL, -- 'speed', 'geofence_enter', 'geofence_exit', 'sos', 'power_cut', 'idle', 'disconnect', 'vibration', 'low_battery'
    severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
    title VARCHAR(200),
    description TEXT,
    event_time DATETIME NOT NULL,
    latitude DOUBLE,
    longitude DOUBLE,
    speed FLOAT,
    extra_data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by INT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alarms_device_time (device_imei, event_time),
    INDEX idx_alarms_unread (is_read, created_at)
);

CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'severity', 'VARCHAR(20) DEFAULT "warning"');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'title', 'VARCHAR(200)');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'description', 'TEXT');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'speed', 'FLOAT');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'extra_data', 'JSON');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'is_read', 'BOOLEAN DEFAULT FALSE');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'is_resolved', 'BOOLEAN DEFAULT FALSE');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'resolved_by', 'INT');
CALL AddColumnIfNotExists(DATABASE(), 'alarms', 'resolved_at', 'DATETIME');

-- 7. Geofence (Sanal Çit) Tanımları
CREATE TABLE IF NOT EXISTS geofences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    type VARCHAR(20) NOT NULL DEFAULT 'circle', -- 'circle', 'polygon'
    center_lat DOUBLE, -- for circle type
    center_lng DOUBLE,
    radius FLOAT, -- meters, for circle type
    coordinates JSON, -- for polygon type: [[lat,lng], [lat,lng], ...]
    color VARCHAR(20) DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT TRUE,
    alert_on_enter BOOLEAN DEFAULT TRUE,
    alert_on_exit BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. Geofence-Cihaz İlişkisi (hangi cihaz hangi geofence'a bağlı)
CREATE TABLE IF NOT EXISTS geofence_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    geofence_id INT NOT NULL,
    device_imei VARCHAR(20) NOT NULL,
    FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    UNIQUE KEY unique_geofence_device (geofence_id, device_imei)
);

-- 9. Geofence Olayları
CREATE TABLE IF NOT EXISTS geofence_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_imei VARCHAR(20),
    geofence_id INT,
    event_type VARCHAR(20) NOT NULL, -- 'enter', 'exit'
    event_time DATETIME NOT NULL,
    latitude DOUBLE,
    longitude DOUBLE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE,
    INDEX idx_geofence_events (device_imei, geofence_id, event_time)
);

-- 10. Seyahat Kayıtları (Trip Log)
CREATE TABLE IF NOT EXISTS trips (
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
    trip_type VARCHAR(20) DEFAULT 'business', -- 'business', 'personal'
    is_completed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    INDEX idx_trips_device_time (device_imei, start_time)
);

-- 11. Bakım & Servis Kayıtları
CREATE TABLE IF NOT EXISTS maintenance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_imei VARCHAR(20),
    type VARCHAR(50) NOT NULL, -- 'oil_change', 'tire_change', 'brake', 'inspection', 'insurance', 'general'
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
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_maintenance_device (device_imei)
);

-- 12. Bildirim Logları
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    alarm_id BIGINT,
    channel VARCHAR(20) NOT NULL, -- 'web', 'email', 'sms', 'push'
    title VARCHAR(200),
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE SET NULL,
    INDEX idx_notifications_user (user_id, is_read, created_at)
);

-- 13. POI (İlgi Noktaları)
CREATE TABLE IF NOT EXISTS poi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    category VARCHAR(50) DEFAULT 'general', -- 'depot', 'customer', 'office', 'parking', 'gas_station'
    icon VARCHAR(20) DEFAULT 'pin',
    color VARCHAR(20) DEFAULT '#3b82f6',
    radius FLOAT DEFAULT 100, -- yaklaşma bildirimi mesafesi (metre)
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 14. Komut Logları (Relay, SMS Komutları)
CREATE TABLE IF NOT EXISTS command_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_imei VARCHAR(20),
    command_type VARCHAR(50) NOT NULL, -- 'relay_on', 'relay_off', 'reset', 'set_apn', 'set_interval'
    command_value VARCHAR(255),
    sent_by INT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'confirmed', 'failed'
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_commands_device (device_imei, created_at)
);

-- 15. Varsayılan admin kullanıcı ekle (şifre: admin123 → bcrypt hash)
INSERT IGNORE INTO users (username, password_hash, email, full_name, role) VALUES 
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@filotakip.com', 'Sistem Yöneticisi', 'admin');
