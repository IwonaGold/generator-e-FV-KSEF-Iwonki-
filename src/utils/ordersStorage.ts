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
    const isOrderWithoutXml = ord.documentType === 'ZAM' || !ord.xmlContent;
    let effectiveInvoiceStatus = ord.invoiceStatus || (isOrderWithoutXml ? 'awaiting_invoice' : 'issued');
    if (!ord.invoiceStatus && ord.documentType === 'ZAM') {
      if (ord.notes?.toLowerCase().includes('zewnętrzn') || ord.notes?.toLowerCase().includes('zewnetrzn')) {
        effectiveInvoiceStatus = 'external_billing';
      }
    }

    const xmlInv = ord.xmlContent ? extractInvoiceNumberFromXml(ord.xmlContent) : null;
    let invoiceNumber = ord.invoiceNumber;
    if (!invoiceNumber || invoiceNumber === 'FAKTURA') {
      if (xmlInv) {
        invoiceNumber = xmlInv;
      } else if (ord.documentType === 'ZAM') {
        invoiceNumber = ord.externalInvoiceNumber || (ord.orderNumber ? `ZAM ${ord.orderNumber}` : 'ZAMÓWIENIE');
      } else {
        invoiceNumber = 'FAKTURA';
      }
    }

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

    // Normalizacja statusu doręczenia i logistyki:
    // Zamówienie przechodzi do ZAKOŃCZONE wyłącznie po zaznaczeniu "Towar dotarł do klienta" (isDelivered === true)
    const isActuallyDelivered = Boolean(ord.isDelivered);
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

    const rawLegacyStatus = ord.warehouseTaskStatus || 'none';
    const legacyStatus = rawLegacyStatus === 'completed' ? 'none' : rawLegacyStatus;
    const rawProductStatus =
      ord.warehouseProductTaskStatus || (legacyStatus !== 'none' ? legacyStatus : 'none');
    const effectiveProductTaskStatus =
      rawProductStatus === 'completed' ? 'none' : rawProductStatus;
    const rawParcelStatus = ord.warehouseParcelTaskStatus || 'none';
    const effectiveParcelTaskStatus =
      rawParcelStatus === 'completed' ? 'none' : rawParcelStatus;

    return {
      ...ord,
      documentType: ord.documentType || 'FV',
      invoiceStatus: effectiveInvoiceStatus,
      externalInvoiceNumber: ord.externalInvoiceNumber,
      chain: detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain),
      invoiceNumber,
      orderDate: effectiveOrderDate,
      avisoDate: effectiveAvisoDate,
      deliveryDate: ord.deliveryDate || effectiveAvisoDate,
      paymentDueDate: effectiveDueDate,
      paymentStatus: effectivePaymentStatus,
      parcelPhotos: Array.isArray(ord.parcelPhotos) ? ord.parcelPhotos : [],
      packagingPhotos: Array.isArray(ord.packagingPhotos) ? ord.packagingPhotos : [],
      warehouseProductTaskStatus: effectiveProductTaskStatus,
      warehouseParcelTaskStatus: effectiveParcelTaskStatus,
      warehouseTaskStatus: legacyStatus,
      isDelivered: isActuallyDelivered,
      shippingStatus: effectiveShippingStatus,
    };
  });
}

const DELETED_IDS_KEY = 'iwonka_ksef_deleted_order_ids_v1';
const PERMANENTLY_DELETED_IDS = [
  'ord-1791370137779',
  'ord-1791369888459',
  'ord-1791369877206',
  'ord-1791369875920',
];
const IDB_NAME = 'iwonka_ksef_db_v1';
const IDB_STORE = 'orders_store';
const IDB_KEY = 'archived_orders_list';

function getDeletedIds(): Set<string> {
  const set = new Set<string>(PERMANENTLY_DELETED_IDS);
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string' && id) set.add(id);
        }
      }
    }
  } catch {
    // ignore
  }
  return set;
}

function addDeletedId(id: string): void {
  try {
    const set = getDeletedIds();
    set.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

/**
 * Odczyt / Zapis w IndexedDB (pojemność kilku GB na zdjęcia paczek — całkowicie za darmo w przeglądarce)
 */
function openOrdersIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB niedostępne'));
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readOrdersFromIdb(): Promise<ArchivedOrder[] | null> {
  try {
    const db = await openOrdersIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? req.result : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeOrdersToBrowserStorage(orders: ArchivedOrder[]): Promise<void> {
  // 1. Zapis pełnej bazy wraz ze wszystkimi zdjęciami w IndexedDB (brak limitu 5MB)
  try {
    const db = await openOrdersIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(orders, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Błąd zapisu w IndexedDB:', e);
  }

  // 2. Zapis kopii w localStorage (jeśli przekroczy limit 5MB przez zdjęcia, zapisz wersję lekką)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    try {
      const lightOrders = orders.map((o) => ({ ...o, parcelPhotos: [], packagingPhotos: [] }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightOrders));
    } catch {
      // ignore quota error
    }
  }
}

async function readOrdersFromBrowserStorage(): Promise<ArchivedOrder[]> {
  const idbOrders = await readOrdersFromIdb();
  if (idbOrders && idbOrders.length > 0) {
    return idbOrders;
  }
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
  return [];
}

function mergeParcelPhotosLightweight(
  newerPhotos?: string[],
  olderPhotos?: string[]
): string[] {
  const nArr = Array.isArray(newerPhotos) ? newerPhotos : [];
  const oArr = Array.isArray(olderPhotos) ? olderPhotos : [];
  if (nArr.length === 0) return oArr;
  if (oArr.length === 0) return nArr;
  if (nArr.length === oArr.length) {
    return nArr.map((np, idx) => {
      const op = oArr[idx];
      if (np && op && np.length > 1000 && op.length > 1000) {
        return np.length <= op.length ? np : op;
      }
      return np || op;
    });
  }
  return nArr;
}

function mergePackagingPhotosLightweight(
  newerPhotos?: ArchivedOrder['packagingPhotos'],
  olderPhotos?: ArchivedOrder['packagingPhotos']
): NonNullable<ArchivedOrder['packagingPhotos']> {
  const nArr = Array.isArray(newerPhotos) ? newerPhotos : [];
  const oArr = Array.isArray(olderPhotos) ? olderPhotos : [];
  if (nArr.length === 0) return oArr;
  if (oArr.length === 0) return nArr;

  const olderById = new Map<string, NonNullable<ArchivedOrder['packagingPhotos']>[number]>();
  for (const op of oArr) {
    if (op?.id) olderById.set(op.id, op);
  }

  return nArr.map((np) => {
    if (!np?.id) return np;
    const op = olderById.get(np.id);
    if (
      op?.dataUrl &&
      np.dataUrl &&
      op.dataUrl.length > 1000 &&
      np.dataUrl.length > 1000 &&
      op.dataUrl.length < np.dataUrl.length
    ) {
      return { ...np, dataUrl: op.dataUrl };
    }
    return np;
  });
}

/**
 * Inteligentne łączenie danych z serwera (np. Render.com po restarcie) oraz lokalnej bazy przeglądarki,
 * aby nigdy nie utracić nowo dodanych zamówień ani załączonych zdjęć przesyłek, preferując lżejsze (skompresowane) zdjęcia.
 */
function mergeServerAndLocalOrders(
  serverList: ArchivedOrder[],
  localList: ArchivedOrder[],
  deletedIds: Set<string>
): ArchivedOrder[] {
  const map = new Map<string, ArchivedOrder>();

  for (const srv of serverList) {
    if (!srv || !srv.id || deletedIds.has(srv.id)) continue;
    map.set(srv.id, srv);
  }

  for (const loc of localList) {
    if (!loc || !loc.id || deletedIds.has(loc.id)) continue;
    const existing = map.get(loc.id);
    if (!existing) {
      map.set(loc.id, loc);
    } else {
      const srvTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      const newer = locTime > srvTime ? loc : existing;
      const older = locTime > srvTime ? existing : loc;
      const mergedPhotos = mergeParcelPhotosLightweight(newer.parcelPhotos, older.parcelPhotos);
      const mergedPackagingPhotos = mergePackagingPhotosLightweight(
        newer.packagingPhotos,
        older.packagingPhotos
      );
      map.set(loc.id, {
        ...older,
        ...newer,
        parcelPhotos: mergedPhotos,
        packagingPhotos: mergedPackagingPhotos,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });
}

let lastServerOrdersEtag: string | null = null;
let lastServerOrdersCache: ArchivedOrder[] | null = null;
let inFlightGetOrdersPromise: Promise<ArchivedOrder[]> | null = null;

/**
 * Pobiera listę archiwalnych zamówień (z obsługą ETag 304, deduplikacją zapytań i synchronizacją różnicową)
 */
export async function getArchivedOrders(): Promise<ArchivedOrder[]> {
  if (inFlightGetOrdersPromise) {
    return inFlightGetOrdersPromise;
  }

  inFlightGetOrdersPromise = (async () => {
    try {
      const deletedIds = getDeletedIds();
      const localOrders = await readOrdersFromBrowserStorage();
      let serverOrders: ArchivedOrder[] = [];

      try {
        const headers: Record<string, string> = {};
        if (lastServerOrdersEtag && lastServerOrdersCache) {
          headers['If-None-Match'] = lastServerOrdersEtag;
        }
        const res = await fetch('/api/orders-history', { headers });
        if (res.status === 304 && lastServerOrdersCache) {
          serverOrders = lastServerOrdersCache;
        } else if (res.ok) {
          const etag = res.headers.get('ETag');
          if (etag) {
            lastServerOrdersEtag = etag;
          }
          const deletedHeader = res.headers.get('X-Deleted-Order-Ids');
          if (deletedHeader) {
            try {
              const srvDeleted: string[] = JSON.parse(deletedHeader);
              if (Array.isArray(srvDeleted)) {
                for (const dId of srvDeleted) {
                  deletedIds.add(dId);
                  addDeletedId(dId);
                }
              }
            } catch {}
          }
          const data = await res.json();
          if (Array.isArray(data)) {
            serverOrders = data;
            lastServerOrdersCache = data;
          }
        }
      } catch (err) {
        if (lastServerOrdersCache) {
          serverOrders = lastServerOrdersCache;
        } else {
          console.warn('Serwer API niedostępny, używam bazy lokalnej:', err);
        }
      }

      if (serverOrders.length > 0 || localOrders.length > 0) {
        const merged = normalizeOrdersList(
          mergeServerAndLocalOrders(serverOrders, localOrders, deletedIds)
        );
        await writeOrdersToBrowserStorage(merged);

        // Wyślij w tle WYŁĄCZNIE te zamówienia z przeglądarki, których brakuje na serwerze lub które są nowsze w przeglądarce
        if (serverOrders.length > 0) {
          const serverMap = new Map(serverOrders.map((o) => [o.id, o]));
          const ordersToPush = merged.filter((m) => {
            const s = serverMap.get(m.id);
            if (!s) return true;
            const mTime = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
            const sTime = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
            if (mTime > sTime + 500) return true;
            const mPhotos = m.parcelPhotos?.length || 0;
            const sPhotos = s.parcelPhotos?.length || 0;
            const mPkgPhotos = m.packagingPhotos?.length || 0;
            const sPkgPhotos = s.packagingPhotos?.length || 0;
            return mPhotos > sPhotos || mPkgPhotos > sPkgPhotos;
          });

          if (ordersToPush.length > 0) {
            fetch('/api/orders-history/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orders: ordersToPush }),
            }).catch(() => {});
          }
        }

        return merged;
      }

      const defaultOrders = normalizeOrdersList(INITIAL_ARCHIVED_ORDERS);
      await writeOrdersToBrowserStorage(defaultOrders);
      return defaultOrders;
    } finally {
      inFlightGetOrdersPromise = null;
    }
  })();

  return inFlightGetOrdersPromise;
}

/**
 * Zapisuje nowe lub aktualizuje istniejące zamówienie w historii (bez ponownego ściągania całej bazy)
 */
export async function saveArchivedOrder(order: ArchivedOrder): Promise<ArchivedOrder> {
  const normalizedOrder: ArchivedOrder = normalizeOrdersList([
    {
      ...order,
      chain: detectPharmacyChain(order.buyer, order.thirdParty, order.chain),
      updatedAt: new Date().toISOString(),
    },
  ])[0];

  // Zapis na serwerze (pojedynczy rekord)
  try {
    await fetch('/api/orders-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedOrder),
    });
    lastServerOrdersEtag = null;
  } catch (err) {
    console.warn('Nie udało się zapisać zamówienia na serwerze:', err);
  }

  // Bezpośrednia aktualizacja w IndexedDB oraz localStorage (bez odpytywania GET /api/orders-history)
  try {
    const existing = await readOrdersFromBrowserStorage();
    const idx = existing.findIndex((o) => o.id === normalizedOrder.id);
    const updated =
      idx >= 0
        ? existing.map((o, i) => (i === idx ? normalizedOrder : o))
        : [normalizedOrder, ...existing];
    await writeOrdersToBrowserStorage(updated);
    if (lastServerOrdersCache) {
      const sIdx = lastServerOrdersCache.findIndex((o) => o.id === normalizedOrder.id);
      lastServerOrdersCache =
        sIdx >= 0
          ? lastServerOrdersCache.map((o, i) => (i === sIdx ? normalizedOrder : o))
          : [normalizedOrder, ...lastServerOrdersCache];
    }
  } catch (e) {
    console.warn('Błąd zapisu w pamięci przeglądarki:', e);
  }

  return normalizedOrder;
}

/**
 * Częściowa aktualizacja (status dostawy, notatka, zdjęcia przesyłki) bez ściągania całej bazy
 */
export async function updateArchivedOrderFields(
  id: string,
  fields: Partial<ArchivedOrder>
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  try {
    await fetch(`/api/orders-history/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    lastServerOrdersEtag = null;
  } catch (err) {
    console.warn('Błąd PATCH na serwerze:', err);
  }

  try {
    const existing = await readOrdersFromBrowserStorage();
    const updated = normalizeOrdersList(
      existing.map((o) => (o.id === id ? { ...o, ...fields, updatedAt: nowIso } : o))
    );
    await writeOrdersToBrowserStorage(updated);
    if (lastServerOrdersCache) {
      lastServerOrdersCache = normalizeOrdersList(
        lastServerOrdersCache.map((o) =>
          o.id === id ? { ...o, ...fields, updatedAt: nowIso } : o
        )
      );
    }
    return true;
  } catch (e) {
    console.warn('Błąd aktualizacji w pamięci przeglądarki:', e);
    return false;
  }
}

/**
 * Usunięcie zamówienia z historii
 */
export async function deleteArchivedOrder(id: string): Promise<boolean> {
  addDeletedId(id);
  lastServerOrdersEtag = null;
  if (lastServerOrdersCache) {
    lastServerOrdersCache = lastServerOrdersCache.filter((o) => o.id !== id);
  }

  try {
    await fetch(`/api/orders-history/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Błąd DELETE na serwerze:', err);
  }

  try {
    const existing = await readOrdersFromBrowserStorage();
    const filtered = existing.filter((o) => o.id !== id);
    await writeOrdersToBrowserStorage(filtered);
    return true;
  } catch (e) {
    console.warn('Błąd usuwania w pamięci przeglądarki:', e);
    return false;
  }
}

