import mysql from 'mysql2/promise';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS prescriptions (
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
    INDEX idx_payment_expiry (method, status, payment_status, payment_expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function init() {
  const base = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
       ssl: (process.env.DB_HOST && process.env.DB_HOST !== 'localhost')
     ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
     : undefined,
  };
  const dbName = process.env.DB_NAME || 'antreobat';

  // Pastikan database ada (kalau belum diimport lewat phpMyAdmin)
  try {
    const boot = await mysql.createConnection(base);
    try {
      await boot.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } finally {
      await boot.end();
    }
  } catch (e) {
    // Abaikan: di hosting cloud database biasanya sudah dibuat manual
    console.warn('Lewati pembuatan database:', e.message);
  }

  const pool = mysql.createPool({
    ...base,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    decimalNumbers: true,
    timezone: '+07:00',
  });

  for (const sql of SCHEMA) await pool.query(sql);
  const [cancellationReasonColumn] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'cancellation_reason'`
  );
  if (!cancellationReasonColumn.length) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN cancellation_reason VARCHAR(255) NULL AFTER status');
  }
  const [cityColumn] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'kota'`
  );
  if (!cityColumn.length) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN kota VARCHAR(80) NULL AFTER method');
  }
  const [paymentColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions'
       AND COLUMN_NAME IN ('payment_expires_at', 'payment_reminder_sent_at', 'auto_cancelled_at', 'payment_cancel_email_sent_at')`
  );
  const existingPaymentColumns = new Set(paymentColumns.map((column) => column.COLUMN_NAME));
  if (!existingPaymentColumns.has('payment_expires_at')) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN payment_expires_at DATETIME NULL AFTER payment_status');
  }
  if (!existingPaymentColumns.has('payment_reminder_sent_at')) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN payment_reminder_sent_at DATETIME NULL AFTER payment_expires_at');
  }
  if (!existingPaymentColumns.has('auto_cancelled_at')) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN auto_cancelled_at DATETIME NULL AFTER payment_reminder_sent_at');
  }
  if (!existingPaymentColumns.has('payment_cancel_email_sent_at')) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN payment_cancel_email_sent_at DATETIME NULL AFTER auto_cancelled_at');
  }
  await pool.query(
    `UPDATE prescriptions
     SET cancellation_reason = 'Pembayaran ongkir tidak diterima sebelum batas waktu.'
     WHERE status = 'DIBATALKAN' AND auto_cancelled_at IS NOT NULL AND cancellation_reason IS NULL`
  );
  const [courierClaimColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions'
       AND COLUMN_NAME IN ('courier_claim_token', 'courier_claimed_at')`
  );
  const existingCourierClaimColumns = new Set(courierClaimColumns.map((column) => column.COLUMN_NAME));
  if (!existingCourierClaimColumns.has('courier_claim_token')) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN courier_claim_token CHAR(64) NULL AFTER payment_cancel_email_sent_at');
  }
  if (!existingCourierClaimColumns.has('courier_claimed_at')) {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN courier_claimed_at DATETIME NULL AFTER courier_claim_token');
  }
  const [courierClaimIndex] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND INDEX_NAME = 'idx_courier_claim'`
  );
  if (!courierClaimIndex.length) {
    await pool.query(
      'CREATE INDEX idx_courier_claim ON prescriptions (method, status, courier_claim_token)'
    );
  }
  await pool.query(
    `UPDATE prescriptions
     SET payment_expires_at = DATE_ADD(created_at, INTERVAL 30 MINUTE)
     WHERE method = 'DELIVERY' AND payment_status <> 'PAID' AND payment_expires_at IS NULL`
  );
  const [expiryIndex] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND INDEX_NAME = 'idx_payment_expiry'`
  );
  if (!expiryIndex.length) {
    await pool.query(
      'CREATE INDEX idx_payment_expiry ON prescriptions (method, status, payment_status, payment_expires_at)'
    );
  }
  return pool;
}

export function getPool() {
  if (!globalThis.__antreobatPool) {
    globalThis.__antreobatPool = init().catch((e) => {
      globalThis.__antreobatPool = null;
      throw e;
    });
  }
  return globalThis.__antreobatPool;
}

export async function query(sql, params = []) {
  const pool = await getPool();
  const [rows] = await pool.query(sql, params);
  return rows;
}
