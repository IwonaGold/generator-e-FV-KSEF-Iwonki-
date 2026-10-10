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
 * Rozbija linię ulicy (np. "UL.KINGA C.GILLETTE 11", "ul. Nowatorów 31 lok. 4", "Hurtowa 2/5")
 * na osobne pola wymagane przez Sellrocket: Ulica, Numer domu, Numer mieszkania.
 */
function splitStreetAndNumbers(
  rawStreetLine?: string,
  explicitStreet?: string,
  explicitHouse?: string,
  explicitApartment?: string
): {
  street: string;
  houseNumber: string;
  apartmentNumber: string;
} {
  if (explicitStreet && explicitStreet.trim() && explicitHouse && explicitHouse.trim()) {
    return {
      street: explicitStreet.trim(),
      houseNumber: explicitHouse.trim(),
      apartmentNumber: (explicitApartment || '').trim(),
    };
  }

  let working = (rawStreetLine || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!working) {
    return { street: '', houseNumber: '1', apartmentNumber: '' };
  }

  let street = working;
  let houseNumber = '';
  let apartmentNumber = '';

  // 1. Sprawdź "lok. X", "lokal X", "m. X" na końcu
  const lokMatch = working.match(/^(.*?)\s+(?:lok\.?|lokal|m\.?)\s*([0-9a-zA-Z-]+)$/i);
  if (lokMatch) {
    const beforeLok = lokMatch[1].trim();
    apartmentNumber = lokMatch[2].trim();
    const houseMatch = beforeLok.match(/^(.*?)\s+([0-9]+[a-zA-Z]?)$/);
    if (houseMatch) {
      street = houseMatch[1].trim();
      houseNumber = houseMatch[2].trim();
    } else {
      street = beforeLok;
    }
  } else {
    // 2. Sprawdź zapis "Ulica 11/4" na końcu
    const slashMatch = working.match(/^(.*?)\s+([0-9]+[a-zA-Z]?)\s*\/\s*([0-9a-zA-Z-]+)$/);
    if (slashMatch) {
      street = slashMatch[1].trim();
      houseNumber = slashMatch[2].trim();
      apartmentNumber = slashMatch[3].trim();
    } else {
      // 3. Złożony numer budynku na końcu (np. "ul. Kinga C. Gillette 1, 9 i 11") lub zwykły "Ulica 11" / "Ulica 60A"
      const multiHouseMatch = working.match(
        /^(.+?)\s+(\d+[a-zA-Z]?(?:\s*(?:,|i|oraz)\s*\d+[a-zA-Z]?)+)$/i
      );
      if (multiHouseMatch) {
        street = multiHouseMatch[1].trim();
        houseNumber = multiHouseMatch[2].trim();
      } else {
        const simpleHouseMatch = working.match(/^(.*?)\s+([0-9]+[a-zA-Z]?)$/);
        if (simpleHouseMatch) {
          street = simpleHouseMatch[1].trim();
          houseNumber = simpleHouseMatch[2].trim();
        }
      }
    }
  }

  // Estetyczne oddzielenie "UL." -> "ul. "
  street = street.replace(/^UL\.(\S)/i, 'ul. $1');

  return {
    street: street || working,
    houseNumber: houseNumber || '1',
    apartmentNumber,
  };
}

/**
 * Generuje jednolity, płaski plik CSV dopasowany 1:1 do pól importu w Sellrocket Enterprise.
 * Nazwy nagłówków odpowiadają dokładnie opcjom z listy rozwijanej w Sellrocket Enterprise,
 * dzięki czemu:
 * - wszystkie pozycje jednego zamówienia mają wspólne "Id" oraz "Numer w sklepie" (łączą się w 1 zamówienie),
 * - adres faktury i dostawy jest rozbity na Ulicę, Numer domu, Numer mieszkania, Kod pocztowy, Miasto i Kod kraju ("PL"),
 * - eliminuje to błąd "Brakujące pole Dane dostawy - Kod kraju".
 */
export function generateOrderCSV(input: OrderCsvGenerationInput): string {
  const { buyer, thirdParty, meta, items, selectedChain, knowledgeClients } = input;
  const matchedClient = findMatchingKnowledgeClient(buyer, selectedChain, knowledgeClients);
  const avisoInfo = resolveAvisoConfirmationContact(matchedClient, buyer);

  // 1. Identyfikator zamówienia (wspólny dla wszystkich pozycji w tym zamówieniu!)
  const orderDate = (meta.orderDate || meta.issueDate || new Date().toISOString().slice(0, 10)).trim();
  const orderNumber = (meta.orderNumber || meta.invoiceNumber || `ZAM-${orderDate}`).trim();
  // Czysto numeryczne Id zamówienia (np. "23465/2026/KPD" -> "234652026") dla pola "Id" w Sellrocket
  const numericOrderId = cleanNumeric(orderNumber) || cleanNumeric(orderDate) || '1';

  // 2. Dane do faktury (Nabywca)
  const invoiceCompanyName = (buyer.name || matchedClient?.fullName || '').trim();
  const invoiceNip = cleanNumeric(buyer.nip || matchedClient?.nip || '');
  const rawHqAddr =
    buyer.addressLine1 ||
    (matchedClient?.headquartersAddress && !/^zgodnie\s+z/i.test(matchedClient.headquartersAddress)
      ? matchedClient.headquartersAddress
      : '');
  const parsedHq = parseWarehouseAddressString(rawHqAddr, buyer.postalCode, buyer.city);
  const invParts = splitStreetAndNumbers(
    parsedHq.streetLine,
    buyer.street,
    buyer.houseNumber,
    buyer.apartmentNumber
  );
  const invoicePostalCode = (buyer.postalCode || parsedHq.postalCode || '').trim();
  const invoiceCity = (buyer.city || parsedHq.city || '').trim();
  const invoiceCountry = (buyer.countryCode || 'PL').trim() || 'PL';

  // 3. Dane dostawy (Odbiorca / Magazyn docelowy)
  let shippingCompanyName = '';
  let shippingStreet = '';
  let shippingHouseNumber = '';
  let shippingApartmentNumber = '';
  let shippingPostalCode = '';
  let shippingCity = '';
  let shippingCountry = 'PL';

  const hasValidClientShipping =
    matchedClient &&
    matchedClient.shippingAddress &&
    !/^zgodnie\s+z/i.test(matchedClient.shippingAddress.trim());

  if (thirdParty && thirdParty.name && thirdParty.name.trim()) {
    shippingCompanyName = thirdParty.name.trim();
    const parsedTp = parseWarehouseAddressString(
      thirdParty.addressLine1,
      thirdParty.postalCode,
      thirdParty.city
    );
    const tpParts = splitStreetAndNumbers(
      parsedTp.streetLine,
      thirdParty.street,
      thirdParty.houseNumber,
      thirdParty.apartmentNumber
    );
    shippingStreet = tpParts.street || invParts.street;
    shippingHouseNumber = tpParts.houseNumber || invParts.houseNumber;
    shippingApartmentNumber = tpParts.apartmentNumber;
    shippingPostalCode = (thirdParty.postalCode || parsedTp.postalCode || invoicePostalCode).trim();
    shippingCity = (thirdParty.city || parsedTp.city || invoiceCity).trim();
    shippingCountry = (thirdParty.countryCode || 'PL').trim() || 'PL';
  } else if (hasValidClientShipping && matchedClient) {
    shippingCompanyName = (matchedClient.shippingWarehouseName || invoiceCompanyName).trim();
    const parsedShip = parseWarehouseAddressString(
      matchedClient.shippingAddress,
      invoicePostalCode,
      invoiceCity
    );
    const shipParts = splitStreetAndNumbers(parsedShip.streetLine);
    shippingStreet = shipParts.street || invParts.street;
    shippingHouseNumber = shipParts.houseNumber || invParts.houseNumber;
    shippingApartmentNumber = shipParts.apartmentNumber;
    shippingPostalCode = (parsedShip.postalCode || invoicePostalCode).trim();
    shippingCity = (parsedShip.city || invoiceCity).trim();
    shippingCountry = invoiceCountry || 'PL';
  } else {
    shippingCompanyName = invoiceCompanyName;
    shippingStreet = invParts.street;
    shippingHouseNumber = invParts.houseNumber;
    shippingApartmentNumber = invParts.apartmentNumber;
    shippingPostalCode = invoicePostalCode;
    shippingCity = invoiceCity;
    shippingCountry = invoiceCountry || 'PL';
  }

  // 4. Termin płatności i kontakt z Centrum Wiedzy
  const effectivePaymentDays = meta.paymentDays ?? matchedClient?.paymentDays;
  const paymentDueDate = resolvePaymentDueDate(
    meta.dueDate,
    meta.issueDate || meta.orderDate,
    effectivePaymentDays
  );
  const contactEmail = (avisoInfo.email || buyer.email || '').trim();
  const contactPhone = (avisoInfo.phone || buyer.phone || '').trim();
  const sellerNotes = [
    orderNumber ? `Zamówienie: ${orderNumber}` : '',
    paymentDueDate ? `Termin płatności: ${paymentDueDate}` : '',
    avisoInfo.avisoMethod ? `Awizacja: ${avisoInfo.avisoMethod}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  // Nagłówki 1:1 zgodne z listą rozwijaną importu CSV w Sellrocket Enterprise
  const headers = [
    'Id',
    'Numer w sklepie',
    'Data dodania na platformie (UTC)',
    'Kupujący - Email',
    'Kupujący - Telefon',
    'Faktura - Nazwa firmy',
    'Faktura - Pełna nazwa',
    'Faktura - NIP',
    'Faktura - Ulica',
    'Faktura - Numer domu',
    'Faktura - Numer mieszkania',
    'Faktura - Kod pocztowy',
    'Faktura - Miasto',
    'Faktura - Kod kraju',
    'Faktura - Email',
    'Faktura - Telefon',
    'Dane dostawy - Nazwa firmy',
    'Dane dostawy - Pełna nazwa',
    'Dane dostawy - Ulica',
    'Dane dostawy - Numer domu',
    'Dane dostawy - Numer mieszkania',
    'Dane dostawy - Kod pocztowy',
    'Dane dostawy - Miasto',
    'Dane dostawy - Kod kraju',
    'Dane dostawy - Email',
    'Dane dostawy - Telefon',
    'Uwagi sprzedawcy',
    'Pole dodatkowe 1',
    'Pole dodatkowe 2',
    'Produkt - Nazwa',
    'Produkt - EAN',
    'Produkt - SKU',
    'Ilość Produktu',
    'Podatek Produktu - Stawka',
    'Cena Produktu - Waluta',
    'Cena Produktu - Jednostkowa',
  ];

  const lines: string[] = [buildCsvRow(headers)];

  items.forEach((it: any) => {
    const qty = Number(it.quantity ?? it.correctedQuantity ?? 0);
    const netPrice = Number(
      it.netPrice ?? it.unitPriceNet ?? it.originalNetPrice ?? it.correctedNetPrice ?? 0
    );
    const vatStr = String(it.vatRate || '8%').trim();
    const vatNum = parseFloat(vatStr.replace('%', '').replace(',', '.')) || 8;
    const unitGross = Math.round(netPrice * (1 + vatNum / 100) * 100) / 100;

    const cleanName = cleanProductName(it.name) || it.name || '';
    const eanCode = cleanNumeric(it.gtin || it.ean || '');
    const batchStr = (it.batchNumber || '').trim();
    const expiryStr = (it.expiryDate || '').trim();
    const extraField1 = batchStr ? `LOT: ${batchStr}` : paymentDueDate;
    const extraField2 = expiryStr ? `EXP: ${expiryStr}` : '';

    lines.push(
      buildCsvRow([
        numericOrderId,
        orderNumber,
        orderDate,
        contactEmail,
        contactPhone,
        invoiceCompanyName,
        invoiceCompanyName,
        invoiceNip,
        invParts.street,
        invParts.houseNumber,
        invParts.apartmentNumber,
        invoicePostalCode,
        invoiceCity,
        invoiceCountry,
        contactEmail,
        contactPhone,
        shippingCompanyName,
        shippingCompanyName,
        shippingStreet,
        shippingHouseNumber,
        shippingApartmentNumber,
        shippingPostalCode,
        shippingCity,
        shippingCountry,
        contactEmail,
        contactPhone,
        sellerNotes,
        extraField1,
        extraField2,
        cleanName,
        eanCode,
        batchStr || eanCode,
        qty,
        vatNum,
        meta.currency || 'PLN',
        unitGross.toFixed(2).replace('.', ','),
      ])
    );
  });

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
