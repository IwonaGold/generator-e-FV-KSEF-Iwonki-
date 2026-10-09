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
 * Generuje zawartość pliku CSV z zamówieniem (UTF-8 z BOM, separator ';'):
 * - wszystkie dane kupującego osobno w sekcji DANE DO WYSYŁKI oraz DANE DO FAKTURY
 * - adres e-mail oraz numer telefonu z Centrum Wiedzy (sekcja Potwierdzenie, FORMULARZ awizacji, forma wysyłki)
 * - wszystkie pozycje zamówienia z kodem EAN, ilościami i cenami jednostkowymi
 */
export function generateOrderCSV(input: OrderCsvGenerationInput): string {
  const { seller, buyer, thirdParty, meta, items, selectedChain, knowledgeClients } = input;
  const matchedClient = findMatchingKnowledgeClient(buyer, selectedChain, knowledgeClients);
  const avisoInfo = resolveAvisoConfirmationContact(matchedClient, buyer);

  // 1. Dane do faktury (Nabywca)
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
  const invoiceCountry = (buyer.countryCode || 'PL').trim();
  const invoiceFullAddress = formatAdresL1(buyer);
  const invoiceGln = (buyer.gln || matchedClient?.glnBuyer || '').trim();

  // 2. Dane do wysyłki (Odbiorca / Magazyn docelowy)
  let shippingCompanyName = '';
  let shippingStreet = '';
  let shippingPostalCode = '';
  let shippingCity = '';
  let shippingCountry = 'PL';
  let shippingFullAddress = '';
  let shippingGlnOrIdWew = '';
  let shippingRemarks = '';

  if (thirdParty && thirdParty.name && thirdParty.name.trim()) {
    shippingCompanyName = thirdParty.name.trim();
    shippingStreet = (thirdParty.addressLine1 || '').trim();
    shippingPostalCode = (thirdParty.postalCode || '').trim();
    shippingCity = (thirdParty.city || '').trim();
    shippingCountry = (thirdParty.countryCode || 'PL').trim();
    shippingFullAddress = formatAdresL1(thirdParty);
    shippingGlnOrIdWew = [
      thirdParty.idWew ? `ID-Wew: ${thirdParty.idWew}` : '',
      thirdParty.gln ? `GLN: ${thirdParty.gln}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    shippingRemarks = matchedClient?.shippingRemarks || '';
  } else if (matchedClient && (matchedClient.shippingWarehouseName || matchedClient.shippingAddress)) {
    shippingCompanyName = (matchedClient.shippingWarehouseName || invoiceCompanyName).trim();
    const parsedShip = parseWarehouseAddressString(
      matchedClient.shippingAddress,
      invoicePostalCode,
      invoiceCity
    );
    shippingStreet = parsedShip.streetLine || invoiceStreet;
    shippingPostalCode = parsedShip.postalCode || invoicePostalCode;
    shippingCity = parsedShip.city || invoiceCity;
    shippingCountry = invoiceCountry;
    shippingFullAddress = [shippingStreet, [shippingPostalCode, shippingCity].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    shippingGlnOrIdWew = [
      matchedClient.idWew ? `ID-Wew: ${matchedClient.idWew}` : '',
      matchedClient.glnDelivery ? `GLN dostawy: ${matchedClient.glnDelivery}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    shippingRemarks = matchedClient.shippingRemarks || '';
  } else {
    shippingCompanyName = invoiceCompanyName;
    shippingStreet = invoiceStreet;
    shippingPostalCode = invoicePostalCode;
    shippingCity = invoiceCity;
    shippingCountry = invoiceCountry;
    shippingFullAddress = invoiceFullAddress;
    shippingGlnOrIdWew = invoiceGln ? `GLN: ${invoiceGln}` : '';
  }

  const lines: string[] = [];

  // Nagłówek dokumentu CSV
  lines.push(buildCsvRow(['SPECYFIKACJA ZAMÓWIENIA (CSV) - DANE DO WYSYŁKI, DANE DO FAKTURY ORAZ POZYCJE TOWAROWE']));
  lines.push(
    buildCsvRow([
      'Numer zamówienia',
      meta.orderNumber || '-',
      'Numer faktury / dokumentu',
      meta.invoiceNumber || '-',
      'Data zamówienia',
      meta.orderDate || meta.issueDate || '-',
      'Data dostawy / awizacji',
      meta.deliveryDate || '-',
    ])
  );
  lines.push(
    buildCsvRow([
      'Sprzedawca (Wystawca)',
      seller.name,
      'NIP Sprzedawcy',
      cleanNumeric(seller.nip),
      'Rachunek bankowy',
      seller.bankAccount || '',
      'Nazwa banku',
      seller.bankName || 'ERSTE BANK POLSKA S.A.',
    ])
  );
  lines.push('');

  // SEKCJA 1: DANE KUPUJĄCEGO - DANE DO WYSYŁKI (DOSTAWY) + KONTAKT Z CENTRUM WIEDZY
  lines.push(buildCsvRow(['=== 1. DANE KUPUJĄCEGO - DANE DO WYSYŁKI (DOSTAWY) ===']));
  lines.push(buildCsvRow(['Pole', 'Wartość']));
  lines.push(buildCsvRow(['Odbiorca / Magazyn docelowy (Nazwa)', shippingCompanyName]));
  lines.push(buildCsvRow(['Ulica i numer (Adres dostawy)', shippingStreet]));
  lines.push(buildCsvRow(['Kod pocztowy (Dostawa)', shippingPostalCode]));
  lines.push(buildCsvRow(['Miejscowość (Dostawa)', shippingCity]));
  lines.push(buildCsvRow(['Kraj (Dostawa)', shippingCountry]));
  lines.push(buildCsvRow(['Pełny adres do wysyłki', shippingFullAddress]));
  lines.push(buildCsvRow(['NIP Kupującego', invoiceNip]));
  if (shippingGlnOrIdWew) {
    lines.push(buildCsvRow(['Identyfikator magazynu (ID-Wew / GLN)', shippingGlnOrIdWew]));
  }
  lines.push(
    buildCsvRow([
      'Adres e-mail (Centrum Wiedzy: Potwierdzenie, FORMULARZ awizacji, forma wysyłki)',
      avisoInfo.email || 'Brak przypisanego e-maila w Centrum Wiedzy',
    ])
  );
  lines.push(
    buildCsvRow([
      'Numer telefonu (Centrum Wiedzy: Potwierdzenie, FORMULARZ awizacji, forma wysyłki)',
      avisoInfo.phone || 'Brak przypisanego telefonu w Centrum Wiedzy',
    ])
  );
  lines.push(
    buildCsvRow([
      'Osoba / Dział (Centrum Wiedzy - Potwierdzenie, FORMULARZ awizacji, forma wysyłki)',
      [avisoInfo.roleLabel, avisoInfo.contactName].filter(Boolean).join(' — '),
    ])
  );
  lines.push(
    buildCsvRow([
      'Forma wysyłki / awizacji (Centrum Wiedzy)',
      avisoInfo.avisoMethod || '-',
    ])
  );
  if (shippingRemarks) {
    lines.push(buildCsvRow(['Uwagi logistyczne do wysyłki', shippingRemarks]));
  }
  lines.push('');

  // SEKCJA 2: DANE KUPUJĄCEGO - DANE DO FAKTURY (NABYWCA)
  lines.push(buildCsvRow(['=== 2. DANE KUPUJĄCEGO - DANE DO FAKTURY (NABYWCA) ===']));
  lines.push(buildCsvRow(['Pole', 'Wartość']));
  lines.push(buildCsvRow(['Nabywca (Pełna nazwa firmy do faktury)', invoiceCompanyName]));
  lines.push(buildCsvRow(['NIP Nabywcy', invoiceNip]));
  lines.push(buildCsvRow(['Ulica i numer (Adres siedziby do faktury)', invoiceStreet]));
  lines.push(buildCsvRow(['Kod pocztowy (Faktura)', invoicePostalCode]));
  lines.push(buildCsvRow(['Miejscowość (Faktura)', invoiceCity]));
  lines.push(buildCsvRow(['Kraj (Faktura)', invoiceCountry]));
  lines.push(buildCsvRow(['Pełny adres do faktury', invoiceFullAddress]));
  if (invoiceGln) {
    lines.push(buildCsvRow(['GLN / ILN Nabywcy', invoiceGln]));
  }
  lines.push(
    buildCsvRow([
      'Adres e-mail (Centrum Wiedzy: Potwierdzenie, FORMULARZ awizacji, forma wysyłki)',
      avisoInfo.email || 'Brak przypisanego e-maila w Centrum Wiedzy',
    ])
  );
  lines.push(
    buildCsvRow([
      'Numer telefonu (Centrum Wiedzy: Potwierdzenie, FORMULARZ awizacji, forma wysyłki)',
      avisoInfo.phone || 'Brak przypisanego telefonu w Centrum Wiedzy',
    ])
  );
  lines.push(
    buildCsvRow([
      'Termin płatności',
      meta.dueDate
        ? `${meta.dueDate}${meta.paymentDays ? ` (${meta.paymentDays} dni)` : ''}`
        : meta.paymentDays
        ? `${meta.paymentDays} dni`
        : '-',
    ])
  );
  lines.push('');

  // SEKCJA 3: POZYCJE ZAMÓWIENIA (PRODUKTY Z KODEM EAN, ILOŚCI, CENY JEDNOSTKOWE)
  lines.push(buildCsvRow(['=== 3. POZYCJE ZAMÓWIENIA (PRODUKTY) ===']));
  lines.push(
    buildCsvRow([
      'Lp.',
      'Nazwa produktu',
      'Kod EAN (GTIN)',
      'Ilość',
      'Jednostka',
      'Cena jednostkowa netto (PLN)',
      'Stawka VAT',
      'Cena jednostkowa brutto (PLN)',
      'Wartość netto (PLN)',
      'Wartość brutto (PLN)',
      'Numer serii (LOT)',
      'Data ważności (MHD/EXP)',
    ])
  );

  let totalQty = 0;
  let totalNet = 0;
  let totalGross = 0;

  items.forEach((it: any, index: number) => {
    const qty = Number(it.quantity ?? it.correctedQuantity ?? 0);
    const netPrice = Number(
      it.netPrice ?? it.unitPriceNet ?? it.originalNetPrice ?? it.correctedNetPrice ?? 0
    );
    const vatStr = String(it.vatRate || '8%');
    const vatNum = parseFloat(vatStr.replace('%', '')) || 0;
    const unitGross = Math.round(netPrice * (1 + vatNum / 100) * 100) / 100;
    const lineNet = Math.round(qty * netPrice * 100) / 100;
    const lineGross = Math.round(lineNet * (1 + vatNum / 100) * 100) / 100;

    totalQty += qty;
    totalNet = Math.round((totalNet + lineNet) * 100) / 100;
    totalGross = Math.round((totalGross + lineGross) * 100) / 100;

    const cleanName = cleanProductName(it.name) || it.name || '';
    const eanCode = cleanNumeric(it.gtin || it.ean || '');

    lines.push(
      buildCsvRow([
        index + 1,
        cleanName,
        eanCode,
        qty,
        it.unit || 'szt.',
        netPrice.toFixed(2).replace('.', ','),
        vatStr.includes('%') || vatStr === 'zw' ? vatStr : `${vatStr}%`,
        unitGross.toFixed(2).replace('.', ','),
        lineNet.toFixed(2).replace('.', ','),
        lineGross.toFixed(2).replace('.', ','),
        it.batchNumber || '',
        it.expiryDate || '',
      ])
    );
  });

  // Wiersz podsumowania
  lines.push(
    buildCsvRow([
      'RAZEM',
      `Liczba pozycji: ${items.length}`,
      '',
      totalQty,
      'szt.',
      '',
      '',
      '',
      totalNet.toFixed(2).replace('.', ','),
      totalGross.toFixed(2).replace('.', ','),
      '',
      '',
    ])
  );

  // Dodajemy BOM UTF-8 (\uFEFF), aby polski Microsoft Excel poprawnie wyświetlał polskie znaki i kolumny po średniku
  return '\uFEFF' + lines.join('\r\n');
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
