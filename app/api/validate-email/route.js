import { NextResponse } from 'next/server';
import { EmailValidationError, validateEmailAddress } from '@/lib/email-validation';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const email = await validateEmailAddress(body?.email);
    return NextResponse.json({ valid: true, email });
  } catch (error) {
    if (error instanceof EmailValidationError) {
      return NextResponse.json({ valid: false, error: error.message }, { status: error.status });
    }
    console.error('[POST /api/validate-email]', error);
    return NextResponse.json({ error: 'Email tidak dapat diperiksa sekarang.' }, { status: 500 });
  }
}
