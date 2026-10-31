export function parseDateTime(value) {
  const input = String(value || '');
  if (!input) return null;

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(input)
    ? input
    : `${input.replace(' ', 'T')}+07:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
  const date = parseDateTime(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date) + ' WIB';
}
