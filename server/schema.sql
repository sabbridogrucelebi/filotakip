-- Filo Takip Projesi MySQL Veritabanı Şeması

-- 1. Kullanıcılar Tablosu
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 2. Cihazlar (Araçlar) Tablosu
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imei VARCHAR(20) UNIQUE NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    vehicle_model VARCHAR(50),
    vehicle_year VARCHAR(10),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    sim_number VARCHAR(20),
    icon_type VARCHAR(20) DEFAULT 'car',
    icon_color VARCHAR(20) DEFAULT 'blue',
    status VARCHAR(20) DEFAULT 'offline',
    last_update DATETIME,
    owner_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Konum Geçmişi Tablosu
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

-- 4. Alarmlar ve Olaylar Tablosu
CREATE TABLE IF NOT EXISTS alarms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_imei VARCHAR(20),
    alarm_type VARCHAR(50) NOT NULL,
    event_time DATETIME NOT NULL,
    latitude DOUBLE,
    longitude DOUBLE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_imei) REFERENCES devices(imei) ON DELETE CASCADE,
    INDEX idx_alarms_device_time (device_imei, event_time)
);
