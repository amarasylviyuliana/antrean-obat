import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from './db';

const COOKIE = 'antreobat_session';
const MAX_AGE = 60 * 60 * 12; // 12 jam

function secret() {
  return process.env.SESSION_SECRET || 'dev-secret-ganti-di-env-local';
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

export function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, u: user.username, n: user.name, exp: Date.now() + MAX_AGE * 1000 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function setSessionCookie(token) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function readSession() {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return { id: data.id, username: data.u, name: data.n };
  } catch {
    return null;
  }
}

// Buat akun petugas default bila tabel users masih kosong
export async function ensureDefaultAdmin() {
  const rows = await query('SELECT COUNT(*) AS c FROM users');
  if (Number(rows[0].c) === 0) {
    const username = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    await query('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)', [
      username,
      hashPassword(password),
      'Petugas Farmasi',
    ]);
  }
}
