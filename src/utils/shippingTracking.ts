import { ShippingCourier, ShippingStatus } from '../types/ordersHistory';

export const COURIER_OPTIONS: { id: ShippingCourier; name: string }[] = [
  { id: 'DPD', name: 'DPD Polska' },
  { id: 'InPost', name: 'InPost Paczkomat/Kurier' },
  { id: 'DHL', name: 'DHL Express' },
  { id: 'GLS', name: 'GLS Poland' },
  { id: 'FedEx', name: 'FedEx' },
  { id: 'Pocztex', name: 'Pocztex / Poczta Polska' },
  { id: 'Schenker', name: 'DB Schenker' },
  { id: 'Inny', name: 'Inny przewoźnik / transport własny' },
];

export interface ShippingStatusConfig {
  id: ShippingStatus;
  label: string;
  shortLabel: string;
  badgeClass: string;
  iconName: 'Package' | 'Truck' | 'CheckCircle2' | 'AlertTriangle';
}

export const SHIPPING_STATUSES: ShippingStatusConfig[] = [
  {
    id: 'registered',
    label: 'Nadana / Przygotowana do wysyłki',
    shortLabel: '📦 Nadana',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    iconName: 'Package',
  },
  {
    id: 'in_transit',
    label: 'W drodze / W transporcie',
    shortLabel: '🚚 W drodze',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    iconName: 'Truck',
  },
  {
    id: 'out_for_delivery',
    label: 'Wydana kurierowi do doręczenia',
    shortLabel: '⚡ W doręczeniu',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    iconName: 'Truck',
  },
  {
    id: 'delivered',
    label: 'Doręczona do apteki / magazynu',
    shortLabel: '✅ Doręczona',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    iconName: 'CheckCircle2',
  },
  {
    id: 'exception',
    label: 'Awizo / Problem z dostawą',
    shortLabel: '⚠️ Awizo / Problem',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    iconName: 'AlertTriangle',
  },
];

/**
 * Automatyczne wykrywanie firmy kurierskiej na podstawie wzorca numeru listu przewozowego
 */
export function detectCourierFromTrackingNumber(trackingNumber: string): ShippingCourier {
  const clean = trackingNumber.trim().replace(/\s+/g, '');

  if (!clean) return 'Inny';

  // InPost: 24 cyfry
  if (/^\d{24}$/.test(clean)) {
    return 'InPost';
  }

  // DPD: 14 znaków, często kończy się literą lub 14 cyfr
  if (/^\d{13,14}[A-Za-z]?$/i.test(clean) || /^0000\d{9,11}/.test(clean)) {
    return 'DPD';
  }

  // DHL: 10 lub 11 cyfr, albo JJD...
  if (/^(\d{10,11}|JJD\d{14,20})$/i.test(clean)) {
    return 'DHL';
  }

  // GLS: 11 lub 12 cyfr
  if (/^\d{11,12}$/.test(clean)) {
    return 'GLS';
  }

  // FedEx: 12 cyfr
  if (/^\d{12}$/.test(clean)) {
    return 'FedEx';
  }

  // Pocztex: 20 cyfr lub PX...
  if (/^(PX\d{18}|\d{20})$/i.test(clean)) {
    return 'Pocztex';
  }

  return 'DPD'; // Domyślny kurier farmaceutyczny w Polsce
}

/**
 * Zwraca bezpośredni URL do strony śledzenia przesyłki kurierskiej
 */
export function getTrackingUrl(trackingNumber: string, courier?: ShippingCourier | string | null): string {
  const clean = trackingNumber.trim().replace(/\s+/g, '');
  if (!clean) return '';

  const effectiveCourier = courier || detectCourierFromTrackingNumber(clean);

  switch (effectiveCourier) {
    case 'DPD':
      return `https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(clean)}`;
    case 'InPost':
      return `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(clean)}`;
    case 'DHL':
      return `https://sprawdz.dhl.com.pl/szukaj.aspx?m=0&sn=${encodeURIComponent(clean)}`;
    case 'GLS':
      return `https://gls-group.eu/PL/pl/sledzenie-paczek?match=${encodeURIComponent(clean)}`;
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(clean)}`;
    case 'Pocztex':
      return `https://www.pocztex.pl/sledzenie-przesylek/?numer=${encodeURIComponent(clean)}`;
    case 'Schenker':
      return `https://eschenker.dbschenker.com/nges-portal/public/en-US/tracking/tracking-public?refNumber=${encodeURIComponent(clean)}`;
    default:
      return `https://alipaczka.pl/?track=${encodeURIComponent(clean)}`;
  }
}

/**
 * Zwraca konfigurację wizualną dla statusu przesyłki
 */
export function getShippingStatusConfig(status?: ShippingStatus | null): ShippingStatusConfig {
  const found = SHIPPING_STATUSES.find((s) => s.id === status);
  return found || SHIPPING_STATUSES[1]; // Domyślnie 'in_transit'
}

/**
 * Wyznacza efektywny status logistyczny zamówienia na podstawie pól i stanu doręczenia
 */
export function getOrderEffectiveShippingStatus(ord: {
  shippingStatus?: ShippingStatus | null;
  isDelivered?: boolean;
  trackingNumber?: string | null;
}): ShippingStatus {
  if (ord.shippingStatus) {
    return ord.shippingStatus;
  }
  if (ord.isDelivered) {
    return 'delivered';
  }
  if (ord.trackingNumber && ord.trackingNumber.trim()) {
    return 'in_transit';
  }
  return 'registered';
}
