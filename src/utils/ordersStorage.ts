import { ArchivedOrder } from '../types/ordersHistory';
import { INITIAL_ARCHIVED_ORDERS } from './sampleOrdersHistory';
import { detectPharmacyChain } from './orderParser';
import { extractInvoiceNumberFromXml } from './ksefXmlParser';

const LOCAL_STORAGE_KEY = 'iwonka_ksef_orders_history_v1';

/**
 * Normalizuje przypisanie sieci dla każdego zamówienia/korekty, wyciąga numer faktury z XML oraz inicjalizuje status płatności
 */
function normalizeOrdersList(list: ArchivedOrder[]): ArchivedOrder[] {
  const todayStr = new Date().toISOString().slice(0, 10);

  return list.map((ord) => {
    const xmlInv = extractInvoiceNumberFromXml(ord.xmlContent);
    const invoiceNumber =
      ord.invoiceNumber && ord.invoiceNumber !== 'FAKTURA'
        ? ord.invoiceNumber
        : xmlInv || ord.invoiceNumber || 'FAKTURA';

    // Domyślny termin płatności: jeśli brak, data dueDate lub issueDate + 30 dni
    let effectiveDueDate = ord.paymentDueDate || ord.dueDate;
    if (!effectiveDueDate && ord.issueDate) {
      try {
        const d = new Date(ord.issueDate);
        d.setDate(d.getDate() + (ord.paymentTermDays || 30));
        effectiveDueDate = d.toISOString().slice(0, 10);
      } catch {
        effectiveDueDate = ord.issueDate;
      }
    }

    // Inicjalizacja statusu płatności
    let effectivePaymentStatus = ord.paymentStatus;
    if (!effectivePaymentStatus) {
      if (effectiveDueDate && effectiveDueDate < todayStr) {
        effectivePaymentStatus = 'overdue';
      } else {
        effectivePaymentStatus = 'pending';
      }
    } else if (effectivePaymentStatus === 'pending' && effectiveDueDate && effectiveDueDate < todayStr) {
      effectivePaymentStatus = 'overdue';
    }

    // Domyślna data złożenia zamówienia i data awizacji
    const effectiveOrderDate = ord.orderDate || ord.issueDate;
    const effectiveAvisoDate = ord.avisoDate || ord.deliveryDate || ord.issueDate;

    // Normalizacja statusu doręczenia i logistyki
    const isActuallyDelivered = Boolean(ord.isDelivered || ord.shippingStatus === 'delivered');
    let effectiveShippingStatus = ord.shippingStatus;
    if (isActuallyDelivered) {
      effectiveShippingStatus = 'delivered';
    } else if (!effectiveShippingStatus) {
      if (ord.trackingNumber && ord.trackingNumber.trim()) {
        effectiveShippingStatus = 'in_transit';
      } else {
        effectiveShippingStatus = 'registered';
      }
    }

    return {
      ...ord,
      chain: detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain),
      invoiceNumber,
      orderDate: effectiveOrderDate,
      avisoDate: effectiveAvisoDate,
      deliveryDate: ord.deliveryDate || effectiveAvisoDate,
      paymentDueDate: effectiveDueDate,
      paymentStatus: effectivePaymentStatus,
      parcelPhotos: Array.isArray(ord.parcelPhotos) ? ord.parcelPhotos : [],
      isDelivered: isActuallyDelivered,
      shippingStatus: effectiveShippingStatus,
    };
  });
}

/**
 * Pobiera listę archiwalnych zamówień (z serwera lub localStorage z fallbackiem do danych wzorcowych)
 */
export async function getArchivedOrders(): Promise<ArchivedOrder[]> {
  try {
    const res = await fetch('/api/orders-history');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const normalized = normalizeOrdersList(data);
        // Zapisz kopię zapasową w localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
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
        return normalizeOrdersList(parsed);
      }
    }
  } catch (e) {
    console.warn('Błąd odczytu z localStorage:', e);
  }

  // Domyślne dane początkowe
  const defaultOrders = normalizeOrdersList(INITIAL_ARCHIVED_ORDERS);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultOrders));
  return defaultOrders;
}

/**
 * Zapisuje nowe lub aktualizuje istniejące zamówienie w historii
 */
export async function saveArchivedOrder(order: ArchivedOrder): Promise<ArchivedOrder> {
  const normalizedOrder: ArchivedOrder = {
    ...order,
    chain: detectPharmacyChain(order.buyer, order.thirdParty, order.chain),
  };
  // Próba zapisu na serwerze
  let serverSaved = false;
  try {
    const res = await fetch('/api/orders-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedOrder),
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
    const idx = existing.findIndex((o) => o.id === normalizedOrder.id);
    let updated: ArchivedOrder[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...normalizedOrder, updatedAt: new Date().toISOString() };
    } else {
      updated = [normalizedOrder, ...existing];
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Błąd zapisu do localStorage:', e);
  }

  return normalizedOrder;
}

/**
 * Częściowa aktualizacja (status dostawy, notatka)
 */
export async function updateArchivedOrderFields(
  id: string,
  fields: Partial<ArchivedOrder>
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
