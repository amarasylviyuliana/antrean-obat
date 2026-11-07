-- AntreObat - skema database (opsional: aplikasi juga membuat tabel otomatis saat pertama kali jalan)
-- Cara pakai di phpMyAdmin: buka tab "Import" lalu pilih file ini, atau tab "SQL" lalu tempel isinya.

CREATE DATABASE IF NOT EXISTS `antreobat` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `antreobat`;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prescriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(24) NOT NULL UNIQUE,
  queue_number VARCHAR(40) NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  email VARCHAR(150) NULL,
  method ENUM('PICKUP','DELIVERY') NOT NULL,
  kota VARCHAR(80) NULL,
  pickup_time DATETIME NULL,
  kecamatan VARCHAR(80) NULL,
  kelurahan VARCHAR(80) NULL,
  address_detail VARCHAR(255) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  distance_km DECIMAL(6,2) NULL,
  shipping_fee INT UNSIGNED NOT NULL DEFAULT 0,
  payment_status ENUM('NONE','PENDING','PAID','FAILED','EXPIRED') NOT NULL DEFAULT 'NONE',
  payment_expires_at DATETIME NULL,
  payment_reminder_sent_at DATETIME NULL,
  auto_cancelled_at DATETIME NULL,
  payment_cancel_email_sent_at DATETIME NULL,
  courier_claim_token CHAR(64) NULL,
  courier_claimed_at DATETIME NULL,
  midtrans_order_id VARCHAR(64) NULL,
  snap_token VARCHAR(100) NULL,
  paid_at DATETIME NULL,
  status ENUM('MENUNGGU_VERIFIKASI','DIPROSES_DIRACIK','SIAP_DIAMBIL','DISERAHKAN_KURIR','SELESAI','DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
  cancellation_reason VARCHAR(255) NULL,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_queue (queue_number),
  INDEX idx_midtrans (midtrans_order_id),
  INDEX idx_courier_claim (method, status, courier_claim_token),
  INDEX idx_payment_expiry (method, status, payment_status, payment_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Akun petugas default (admin / admin123) dibuat otomatis oleh aplikasi saat login pertama
-- kalau tabel users masih kosong. Ganti password-nya setelah masuk.
