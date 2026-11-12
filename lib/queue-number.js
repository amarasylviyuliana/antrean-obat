export function normalizeQueueNumber(value) {
  const queueNumber = String(value ?? '').trim().toUpperCase();
  const appointmentNumber = queueNumber.match(/^A-(\d{1,3})$/);
  return appointmentNumber
    ? `A-${appointmentNumber[1].padStart(3, '0')}`
    : queueNumber;
}
