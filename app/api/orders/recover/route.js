import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendOrderEmail } from '@/lib/mailer';
import { EmailValidationError, validateEmailAddress } from '@/lib/email-validation';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const queueNumber = String(body?.queueNumber || '').trim().toUpperCase();
    if (!/^(A-\d{1,3}|RM-\d{1,10})$/.test(queueNumber)) {
      return NextResponse.json(
        { error: 'Masukkan nomor antrean (contoh A-023) atau nomor RM (contoh RM-12345).' },
        { status: 400 }
      );
    }

    let email;
    try {
      email = await validateEmailAddress(body?.email);
    } catch (validationError) {
      if (validationError instanceof EmailValidationError) {
        return NextResponse.json({ error: validationError.message }, { status: validationError.status });
      }
      throw validationError;
    }

    const orders = await query(
      `SELECT * FROM prescriptions
       WHERE queue_number = ? AND LOWER(email) = ?
         AND created_at >= CURDATE()
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ORDER BY created_at DESC`,
      [queueNumber, email]
    );

    for (const order of orders) {
      const sent = await sendOrderEmail(
        order,
        `Tautan pelacakan pesanan obat ${order.order_code}`,
        'Berikut tautan untuk melihat kembali status pesanan obat Anda.'
      );
      if (!sent) {
        console.error('[POST /api/orders/recover] Email pemulihan tidak dapat dikirim.');
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Jika pesanan cocok, tautan pelacakan akan dikirim ke email tersebut.',
    });
  } catch (error) {
    console.error('[POST /api/orders/recover]', error);
    return NextResponse.json({ error: 'Pesanan tidak dapat dicari sekarang. Coba lagi nanti.' }, { status: 500 });
  }
}
