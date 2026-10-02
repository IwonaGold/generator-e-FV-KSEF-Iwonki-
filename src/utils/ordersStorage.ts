import { ArchivedOrder } from '../types/ordersHistory';
import { INITIAL_ARCHIVED_ORDERS } from './sampleOrdersHistory';

const LOCAL_STORAGE_KEY = 'iwonka_ksef_orders_history_v1';

/**
 * Pobiera listę archiwalnych zamówień (z serwera lub localStorage z fallbackiem do danych wzorcowych)
 */
export async function getArchivedOrders(): Promise<ArchivedOrder[]> {
  try {
    const res = await fetch('/api/orders-history');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Zapisz kopię zapasową w localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('Serwer API niedostępny, używam bazy lokalnej:', err);
  }

  // Fallback do localStorage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Błąd odczytu z localStorage:', e);
  }

  // Domyślne dane początkowe
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_ARCHIVED_ORDERS));
  return INITIAL_ARCHIVED_ORDERS;
}

/**
 * Zapisuje nowe lub aktualizuje istniejące zamówienie w historii
 */
export async function saveArchivedOrder(order: ArchivedOrder): Promise<ArchivedOrder> {
  // Próba zapisu na serwerze
  let serverSaved = false;
  try {
    const res = await fetch('/api/orders-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (res.ok) {
      serverSaved = true;
    }
  } catch (err) {
    console.warn('Nie udało się zapisać zamówienia na serwerze:', err);
  }

  // Zapis w localStorage
  try {
    const existing = await getArchivedOrders();
    const idx = existing.findIndex((o) => o.id === order.id);
    let updated: ArchivedOrder[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...order, updatedAt: new Date().toISOString() };
    } else {
      updated = [order, ...existing];
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Błąd zapisu do localStorage:', e);
  }

  return order;
}

/**
 * Częściowa aktualizacja (status dostawy, notatka)
 */
export async function updateArchivedOrderFields(
  id: string,
  fields: Partial<Pick<ArchivedOrder, 'isDelivered' | 'deliveredAt' | 'notes'>>
): Promise<boolean> {
  // Próba na serwerze
  try {
    await fetch(`/api/orders-history/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  } catch (err) {
    console.warn('Błąd PATCH na serwerze:', err);
  }

  // Aktualizacja w localStorage
  try {
    const existing = await getArchivedOrders();
    const updated = existing.map((o) =>
      o.id === id ? { ...o, ...fields, updatedAt: new Date().toISOString() } : o
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.warn('Błąd aktualizacji w localStorage:', e);
    return false;
  }
}

/**
 * Usunięcie zamówienia z historii
 */
export async function deleteArchivedOrder(id: string): Promise<boolean> {
  try {
    await fetch(`/api/orders-history/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Błąd DELETE na serwerze:', err);
  }

  try {
    const existing = await getArchivedOrders();
    const filtered = existing.filter((o) => o.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.warn('Błąd usuwania w localStorage:', e);
    return false;
  }
}
