const STORAGE_KEY = 'antreobat.saved-orders';
const MAX_SAVED_ORDERS = 10;

export function getSavedOrders() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (order) =>
        order &&
        typeof order.orderCode === 'string' &&
        /^AO-[A-Z0-9]{6}$/.test(order.orderCode) &&
        typeof order.queueNumber === 'string' &&
        typeof order.createdAt === 'string'
    );
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

export function removeSavedOrder(orderCode) {
  try {
    const saved = getSavedOrders().filter((order) => order.orderCode !== orderCode);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    window.dispatchEvent(new Event('antreobat:saved-orders'));
  } catch (error) {
    console.error('[saved-orders] Gagal menghapus pesanan tersimpan:', error);
  }
}
