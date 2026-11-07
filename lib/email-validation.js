import { resolve4, resolve6, resolveMx } from 'node:dns/promises';

const EMAIL_PATTERN = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i;
const DOMAIN_CACHE_TTL = 5 * 60 * 1000;
const domainCache = new Map();

export class EmailValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'EmailValidationError';
    this.status = status;
  }
}

function hasExpectedDnsError(results) {
  return results.every(
    (result) =>
      result.status === 'rejected' &&
      ['ENODATA', 'ENOTFOUND', 'EAI_NONAME'].includes(result.reason?.code)
  );
}

async function domainAcceptsEmail(domain) {
  const cached = domainCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.acceptsEmail;

  let acceptsEmail = false;
  try {
    const records = await resolveMx(domain);
    acceptsEmail = records.some((record) => record.exchange !== '.');
    if (!acceptsEmail) {
      throw new EmailValidationError('Domain email ini tidak menerima email.');
    }
  } catch (error) {
    if (error instanceof EmailValidationError) throw error;
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_NONAME') {
      throw new EmailValidationError('Domain email tidak ditemukan. Periksa kembali alamat email.');
    }
    if (error.code !== 'ENODATA') {
      throw new EmailValidationError('Domain email tidak bisa diperiksa sekarang. Coba lagi sebentar.', 503);
    }

    const results = await Promise.allSettled([resolve4(domain), resolve6(domain)]);
    acceptsEmail = results.some((result) => result.status === 'fulfilled' && result.value.length > 0);
    if (!acceptsEmail && !hasExpectedDnsError(results)) {
      throw new EmailValidationError('Domain email tidak bisa diperiksa sekarang. Coba lagi sebentar.', 503);
    }
  }

  domainCache.set(domain, { acceptsEmail, expiresAt: Date.now() + DOMAIN_CACHE_TTL });
  if (domainCache.size > 1000) domainCache.clear();
  return acceptsEmail;
}

export async function validateEmailAddress(value) {
  const email = String(value || '').trim().toLowerCase();
  const [localPart, domain] = email.split('@');
  if (
    !email ||
    email.length > 150 ||
    !EMAIL_PATTERN.test(email) ||
    localPart.length > 64 ||
    domain.length > 253
  ) {
    throw new EmailValidationError('Format email tidak valid. Contoh: nama@gmail.com.');
  }

  if (!(await domainAcceptsEmail(domain))) {
    throw new EmailValidationError('Domain email tidak menerima email.');
  }

  return email;
}
