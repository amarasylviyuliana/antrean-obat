import nodemailer from 'nodemailer';
import { STATUS_LABEL } from './constants';

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendOrderEmail(order, subject, intro, options = {}) {
  const t = getTransporter();
  if (!t || !order.email) return false;
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const link = `${base}${options.path || `/lacak/${order.order_code}`}`;
    const metode =
      order.method === 'DELIVERY' ? 'Diantar ke rumah' : 'Diambil sendiri di klinik';
    await t.sendMail({
      from: `"AntreObat" <${process.env.SMTP_USER}>`,
      to: order.email,
      subject,
      text: [
        `Halo ${order.patient_name},`,
        '',
        intro,
        '',
        `Kode pesanan : ${order.order_code}`,
        `No. antrean  : ${order.queue_number}`,
        `Metode       : ${metode}`,
        `Status       : ${STATUS_LABEL[order.status] || order.status}`,
        '',
        `${options.linkLabel || 'Pantau pesanan'}: ${link}`,
        '',
        'Terima kasih,',
        'AntreObat',
      ].join('\n'),
    });
    return true;
  } catch (e) {
    console.error('[mailer] gagal kirim email:', e.message);
    return false;
  }
}
