-- Filo Takip Projesi PostgreSQL Veritabanı Şeması

-- 1. Kullanıcılar Tablosu
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Cihazlar (Araçlar) Tablosu
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(20) UNIQUE NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    vehicle_model VARCHAR(50),
    sim_number VARCHAR(20),
    icon_type VARCHAR(20) DEFAULT 'car', -- 'car', 'truck', 'motorcycle' vs. (3D icon mapping için)
    icon_color VARCHAR(20) DEFAULT 'blue',
    status VARCHAR(20) DEFAULT 'offline', -- 'online', 'offline', 'moving', 'stopped'
    last_update TIMESTAMP WITH TIME ZONE,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Konum Geçmişi Tablosu
CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    device_imei VARCHAR(20) REFERENCES devices(imei) ON DELETE CASCADE,
    server_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_time TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed REAL NOT NULL, -- km/h
    course REAL NOT NULL, -- degrees
    altitude REAL,
    satellites INTEGER,
    is_gps_valid BOOLEAN,
    ignition BOOLEAN, -- Kontak açık/kapalı
    total_distance DOUBLE PRECISION, -- Odometer hesaplaması için
    raw_data TEXT -- Gerekirse debug için ham hex verisi
);
CREATE INDEX idx_positions_device_time ON positions(device_imei, device_time);

-- 4. Alarmlar ve Olaylar Tablosu
CREATE TABLE alarms (
    id BIGSERIAL PRIMARY KEY,
    device_imei VARCHAR(20) REFERENCES devices(imei) ON DELETE CASCADE,
    alarm_type VARCHAR(50) NOT NULL, -- 'SOS', 'OVERSPEED', 'GEOFENCE_ENTER', 'POWER_CUT', 'LOW_BATTERY'
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alarms_device_time ON alarms(device_imei, event_time);
