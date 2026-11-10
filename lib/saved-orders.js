import { parseDateTime } from './format';

const STORAGE_KEY = 'antreobat.saved-orders';
const MAX_SAVED_ORDERS = 10;
const ORDER_RETENTION_MS = 24 * 60 * 60 * 1000;

export function getSavedOrders() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const now = Date.now();
    const valid = saved.filter(
      (order) =>
        order &&
        typeof order.orderCode === 'string' &&
        /^AO-[A-Z0-9]{6}$/.test(order.orderCode) &&
        typeof order.queueNumber === 'string' &&
        typeof order.createdAt === 'string' &&
        (() => {
          const createdAt = parseDateTime(order.createdAt);
          const age = createdAt ? now - createdAt.getTime() : Number.NaN;
          return Number.isFinite(age) && age >= 0 && age < ORDER_RETENTION_MS;
        })()
    );
    if (valid.length !== saved.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (error) {
    console.error('[saved-orders] Gagal membaca pesanan tersimpan:', error);
    return [];
  }
}

export function saveOrder(order) {
  if (!order || !/^AO-[A-Z0-9]{6}$/.test(String(order.orderCode || ''))) return false;
  try {
    const saved = getSavedOrders().filter((entry) => entry.orderCode !== order.orderCode);
    saved.unshift({
      orderCode: order.orderCode,
      queueNumber: String(order.queueNumber || ''),
      createdAt: String(order.createdAt || ''),
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, MAX_SAVED_ORDERS)));
    window.dispatchEvent(new Event('antreobat:saved-orders'));
    return true;
  } catch (error) {
    console.error('[saved-orders] Gagal menyimpan pesanan di perangkat:', error);
    return false;
  }
}
