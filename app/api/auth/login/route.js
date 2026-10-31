import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  ensureDefaultAdmin,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    await ensureDefaultAdmin();
    const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [
      String(username || '').trim(),
    ]);
    const user = rows[0];
    if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
      return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
    }
    setSessionCookie(createSessionToken(user));
    return NextResponse.json({ ok: true, user: { username: user.username, name: user.name } });
  } catch (e) {
    console.error('[POST /api/auth/login]', e);
    return NextResponse.json(
      { error: 'Gagal login. Pastikan MySQL (XAMPP) sudah menyala.' },
      { status: 500 }
    );
  }
}
