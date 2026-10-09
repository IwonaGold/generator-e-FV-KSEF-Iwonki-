import { EntityDetails, ThirdPartyEntity, InvoiceMeta, InvoiceItem, PharmacyChain } from '../types/ksef';
import { INITIAL_KEY_CLIENTS, KeyClientProfile, ClientContactPerson } from '../types/knowledgeBase';
import { getKeyClients } from './knowledgeStorage';
import { cleanNumeric, cleanProductName, formatAdresL1 } from './ksefGenerator';

export interface OrderCsvGenerationInput {
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;
  meta: {
    invoiceNumber?: string;
    orderNumber?: string;
    issueDate?: string;
    orderDate?: string;
    deliveryDate?: string;
    dueDate?: string;
    paymentDays?: number;
    paymentMethod?: string;
    currency?: string;
  };
  items: InvoiceItem[];
  selectedChain?: PharmacyChain | string;
  knowledgeClients?: KeyClientProfile[];
}

/**
 * Bezpieczne uciekanie pola CSV (separator średnikowy ';' dla polskiego Excela)
 */
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).replace(/\r?\n/g, ' | ').trim();
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCsvCell).join(';');
}

/**
 * Dopasowuje profil klienta z Centrum Wiedzy na podstawie NIP, nazwy sieci lub nazwy nabywcy
 */
export function findMatchingKnowledgeClient(
  buyer: EntityDetails,
  selectedChain?: PharmacyChain | string,
  clients: KeyClientProfile[] = INITIAL_KEY_CLIENTS
): KeyClientProfile | null {
  const list = clients && clients.length > 0 ? clients : INITIAL_KEY_CLIENTS;
  const buyerNip = cleanNumeric(buyer?.nip);

  // 1. Dopasowanie po 10-cyfrowym NIP
  if (buyerNip && buyerNip.length === 10) {
    const byNip = list.find((c) => cleanNumeric(c.nip) === buyerNip);
    if (byNip) return byNip;
  }

  // 2. Dopasowanie po wybranej sieci
  const chainStr = (selectedChain || '').toLowerCase();
  if (chainStr && chainStr !== 'custom') {
    if (chainStr.includes('doz')) {
      return list.find((c) => c.id === 'client-doz' || c.shortName.toLowerCase().includes('doz')) || null;
    }
    if (chainStr.includes('max')) {
      return list.find((c) => c.id === 'client-drmax' || c.shortName.toLowerCase().includes('max')) || null;
    }
    if (chainStr.includes('gemini')) {
      return list.find((c) => c.id === 'client-gemini' || c.shortName.toLowerCase().includes('gemini')) || null;
    }
    if (chainStr.includes('super')) {
      return list.find((c) => c.id === 'client-superpharm' || c.shortName.toLowerCase().includes('super')) || null;
    }
    if (chainStr.includes('modum')) {
      return list.find((c) => c.id === 'client-modumpharma' || c.shortName.toLowerCase().includes('modum')) || null;
    }
  }

  // 3. Dopasowanie po nazwie nabywcy
  const bName = (buyer?.name || '').toLowerCase();
  if (bName) {
    const byName = list.find((c) => {
      const s = c.shortName.toLowerCase();
      const f = c.fullName.toLowerCase();
      return (
        bName.includes(s) ||
        s.includes(bName) ||
        bName.includes(f) ||
        (bName.includes('doz') && s.includes('doz')) ||
        (bName.includes('max') && s.includes('max')) ||
        (bName.includes('lekomat') && s.includes('max')) ||
        (bName.includes('gemini') && s.includes('gemini')) ||
        (bName.includes('super') && s.includes('super')) ||
        (bName.includes('modum') && s.includes('modum'))
      );
    });
    if (byName) return byName;
  }

  return null;
}

/**
 * Pobiera kontakt z Centrum Wiedzy z sekcji "Potwierdzenie, FORMULARZ awizacji, forma wysyłki"
 * (lub odpowiednika dla danego klienta w sekcji awizacji / potwierdzenia)
 */
export function resolveAvisoConfirmationContact(
  client: KeyClientProfile | null,
  buyer: EntityDetails
): {
  roleLabel: string;
  contactName: string;
  email: string;
  phone: string;
  avisoMethod: string;
} {
  if (!client) {
    return {
      roleLabel: 'Potwierdzenie, FORMULARZ awizacji, forma wysyłki',
      contactName: buyer.name || '',
      email: buyer.email || '',
      phone: buyer.phone || '',
      avisoMethod: '',
    };
  }

  const contacts: ClientContactPerson[] = Array.isArray(client.contacts) ? client.contacts : [];

  // Priorytet 1: Dokładna sekcja "Potwierdzenie, FORMULARZ awizacji, forma wysyłki" lub "Potwierdzenie przyjęcia, awizacja, forma wysyłki"
  const primaryContact =
    contacts.find((ct) => /potwierdzenie.*awizacj|formularz\s*awizacji|forma\s*wysy[łl]ki/i.test(ct.role)) ||
    contacts.find((ct) => /potwierdzenie|awizacj/i.test(ct.role)) ||
    contacts[0] ||
    null;

  // Jeśli w głównym kontakcie awizacyjnym nie wpisano jeszcze telefonu, sprawdź czy inny kontakt u tego klienta posiada telefon lub użyj buyer.phone
  const fallbackContactWithPhone = contacts.find((ct) => Boolean(ct.phone && ct.phone.trim()));

  const email = (primaryContact?.email || buyer.email || '').trim();
  const phone = (
    primaryContact?.phone?.trim() ||
    fallbackContactWithPhone?.phone?.trim() ||
    buyer.phone?.trim() ||
    ''
  );

  return {
    roleLabel: primaryContact?.role || 'Potwierdzenie, FORMULARZ awizacji, forma wysyłki',
    contactName: primaryContact?.name || '',
    email,
    phone,
    avisoMethod: client.avisoMethod || '',
  };
}

/**
 * Pomocnicze wydobycie ulicy, kodu pocztowego i miasta z opisu adresu magazynu w Centrum Wiedzy
 */
function parseWarehouseAddressString(
  rawAddress?: string,
  fallbackPostal?: string,
  fallbackCity?: string
): {
  streetLine: string;
  postalCode: string;
  city: string;
} {
  if (!rawAddress || !rawAddress.trim()) {
    return {
      streetLine: '',
      postalCode: fallbackPostal || '',
      city: fallbackCity || '',
    };
  }

  // Usuń dopiski w nawiasach typu "(lub ...)" lub "(przyjęcia ...)" dla czystego adresu ulicy/miasta, ale zachowaj informację o rampie jeśli potrzebna
  const cleanedForZip = rawAddress.replace(/\(lub[^)]*\)/gi, '').trim();
  const zipMatch = cleanedForZip.match(/(\d{2}-\d{3})\s+([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż.\-\s]+)/);

  if (zipMatch) {
    const postalCode = zipMatch[1].trim();
    const cityRaw = zipMatch[2].split(/[(\n,·]/)[0].trim();
    const beforeZip = cleanedForZip.slice(0, zipMatch.index).replace(/[,\s]+$/, '').trim();
    return {
      streetLine: beforeZip || rawAddress.trim(),
      postalCode,
      city: cityRaw || fallbackCity || '',
    };
  }

  return {
    streetLine: rawAddress.trim(),
    postalCode: fallbackPostal || '',
    city: fallbackCity || '',
  };
}

/**
 * Wylicza termin płatności (RRRR-MM-DD), jeśli podano datę bazową oraz liczbę dni, a brakuje gotowego dueDate
 */
function resolvePaymentDueDate(
  dueDate?: string,
  baseDate?: string,
  paymentDays?: number
): string {
  if (dueDate && dueDate.trim()) {
    return dueDate.trim();
  }
  if (paymentDays && paymentDays > 0) {
    if (baseDate && /^\d{4}-\d{2}-\d{2}$/.test(baseDate.trim())) {
      const d = new Date(`${baseDate.trim()}T12:00:00Z`);
      if (!isNaN(d.getTime())) {
        d.setUTCDate(d.getUTCDate() + paymentDays);
        return d.toISOString().slice(0, 10);
      }
    }
    return `${paymentDays} dni`;
  }
  return '';
}

/**
 * Generuje jednolity, płaski plik CSV z zamówieniem zdatny do importu do systemu e-commerce / ERP (Sellrocket).
 * Format techniczny: Separator kolumn: średnik (;), kodowanie: UTF-8 (z BOM \uFEFF).
 *
 * Wymagane kolumny (20):
 * - Dane zamówienia i kontrahenta:
 *   Numer zamówienia; Data zamówienia; Nazwa nabywcy; NIP nabywcy; Adres do faktury; Nazwa odbiorcy; Adres dostawy; Termin płatności
 * - Dane pozycji towarowych:
 *   Lp; Nazwa produktu; Kod EAN; Ilość; Jednostka; Cena netto; Stawka VAT; Cena brutto; Wartość netto; Wartość brutto; Numer serii (LOT); Data ważności
 */
export function generateOrderCSV(input: OrderCsvGenerationInput): string {
  const { buyer, thirdParty, meta, items, selectedChain, knowledgeClients } = input;
  const matchedClient = findMatchingKnowledgeClient(buyer, selectedChain, knowledgeClients);

  // 1. Dane zamówienia i nabywcy (do faktury)
  const orderDate = (meta.orderDate || meta.issueDate || new Date().toISOString().slice(0, 10)).trim();
  const orderNumber = (meta.orderNumber || meta.invoiceNumber || `ZAM-${orderDate}`).trim();
  const invoiceCompanyName = (buyer.name || matchedClient?.fullName || '').trim();
  const invoiceNip = cleanNumeric(buyer.nip || matchedClient?.nip || '');

  const invoiceStreet = (
    buyer.addressLine1 ||
    [buyer.street, buyer.houseNumber, buyer.apartmentNumber ? `/${buyer.apartmentNumber}` : '']
      .filter(Boolean)
      .join(' ') ||
    matchedClient?.headquartersAddress ||
    ''
  ).trim();
  const invoicePostalCode = (buyer.postalCode || '').trim();
  const invoiceCity = (buyer.city || '').trim();

  const rawFormattedBuyerAddress = formatAdresL1(buyer);
  const invoiceFullAddress =
    rawFormattedBuyerAddress && rawFormattedBuyerAddress !== 'Polska'
      ? rawFormattedBuyerAddress
      : [invoiceStreet, [invoicePostalCode, invoiceCity].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ');

  // 2. Dane odbiorcy i adres dostawy
  let shippingCompanyName = '';
  let shippingFullAddress = '';

  if (thirdParty && thirdParty.name && thirdParty.name.trim()) {
    shippingCompanyName = thirdParty.name.trim();
    const rawThirdPartyAddr = formatAdresL1(thirdParty);
    shippingFullAddress =
      rawThirdPartyAddr && rawThirdPartyAddr !== 'Polska'
        ? rawThirdPartyAddr
        : invoiceFullAddress;
  } else if (matchedClient && (matchedClient.shippingWarehouseName || matchedClient.shippingAddress)) {
    shippingCompanyName = (matchedClient.shippingWarehouseName || invoiceCompanyName).trim();
    const parsedShip = parseWarehouseAddressString(
      matchedClient.shippingAddress,
      invoicePostalCode,
      invoiceCity
    );
    const shippingStreet = parsedShip.streetLine || invoiceStreet;
    const shippingPostalCode = parsedShip.postalCode || invoicePostalCode;
    const shippingCity = parsedShip.city || invoiceCity;
    shippingFullAddress = [shippingStreet, [shippingPostalCode, shippingCity].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
  } else {
    shippingCompanyName = invoiceCompanyName;
    shippingFullAddress = invoiceFullAddress;
  }

  // 3. Termin płatności
  const effectivePaymentDays = meta.paymentDays ?? matchedClient?.paymentDays;
  const paymentDueDate = resolvePaymentDueDate(
    meta.dueDate,
    meta.issueDate || meta.orderDate,
    effectivePaymentDays
  );

  // Nagłówek jednolitego, płaskiego pliku CSV (Sellrocket / ERP)
  const headers = [
    'Numer zamówienia',
    'Data zamówienia',
    'Nazwa nabywcy',
    'NIP nabywcy',
    'Adres do faktury',
    'Nazwa odbiorcy',
    'Adres dostawy',
    'Termin płatności',
    'Lp',
    'Nazwa produktu',
    'Kod EAN',
    'Ilość',
    'Jednostka',
    'Cena netto',
    'Stawka VAT',
    'Cena brutto',
    'Wartość netto',
    'Wartość brutto',
    'Numer serii (LOT)',
    'Data ważności',
  ];

  const lines: string[] = [buildCsvRow(headers)];

  items.forEach((it: any) => {
    const qty = Number(it.quantity ?? it.correctedQuantity ?? 0);
    const netPrice = Number(
      it.netPrice ?? it.unitPriceNet ?? it.originalNetPrice ?? it.correctedNetPrice ?? 0
    );
    const vatStr = String(it.vatRate || '8%').trim();
    const vatNum = parseFloat(vatStr.replace('%', '').replace(',', '.')) || 0;
    const unitGross = Math.round(netPrice * (1 + vatNum / 100) * 100) / 100;
    const lineNet = Math.round(qty * netPrice * 100) / 100;
    const lineGross = Math.round(lineNet * (1 + vatNum / 100) * 100) / 100;

    const cleanName = cleanProductName(it.name) || it.name || '';
    const eanCode = cleanNumeric(it.gtin || it.ean || '');
    const formattedVat = vatStr.includes('%') || vatStr.toLowerCase() === 'zw' ? vatStr : `${vatStr}%`;

    // UWAGA: W kolumnie "Lp" wpisujemy stałe "1" dla całego zamówienia (a nie 1, 2, 3...),
    // ponieważ Sellrocket Enterprise traktuje "Lp" jako identyfikator/numer porządkowy zamówienia (widoczny w nawiasie pod ID zamówienia, np. (1), (2), (3))
    // i przy różnych wartościach Lp (1, 2, 3, 4, 5) rozbija każdą pozycję na osobne zamówienie.
    lines.push(
      buildCsvRow([
        orderNumber,
        orderDate,
        invoiceCompanyName,
        invoiceNip,
        invoiceFullAddress,
        shippingCompanyName,
        shippingFullAddress,
        paymentDueDate,
        1,
        cleanName,
        eanCode,
        qty,
        it.unit || 'szt.',
        netPrice.toFixed(2).replace('.', ','),
        formattedVat,
        unitGross.toFixed(2).replace('.', ','),
        lineNet.toFixed(2).replace('.', ','),
        lineGross.toFixed(2).replace('.', ','),
        it.batchNumber || '',
        it.expiryDate || '',
      ])
    );
  });

  // Czyste kodowanie UTF-8 (bez ukrytego znaku BOM \uFEFF na początku pierwszego nagłówka "Numer zamówienia",
  // który w importerach ERP / Sellrocket potrafi uszkodzić rozpoznanie pierwszej kolumny)
  return lines.join('\r\n');
}

/**
 * Pobiera aktualną bazę Centrum Wiedzy i wyzwala pobranie pliku CSV z zamówieniem
 */
export async function downloadOrderCSVFile(input: OrderCsvGenerationInput): Promise<void> {
  let clients = input.knowledgeClients;
  if (!clients || clients.length === 0) {
    try {
      clients = await getKeyClients();
    } catch {
      clients = INITIAL_KEY_CLIENTS;
    }
  }

  const csvContent = generateOrderCSV({
    ...input,
    knowledgeClients: clients,
  });

  const rawIdentifier = (input.meta.orderNumber || input.meta.invoiceNumber || 'zamowienie').trim();
  const safeName = rawIdentifier
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const fileName = `Zamowienie_${safeName || 'KSeF'}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
