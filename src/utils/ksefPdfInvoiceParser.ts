import { EntityDetails, ThirdPartyEntity, InvoiceItem } from '../types/ksef';

export interface ParsedInvoicePdfResult {
  success: boolean;
  ksefNumber: string;
  hasKsefNumber: boolean;
  invoiceNumber: string;
  issueDate: string;
  deliveryDate?: string;
  issuePlace?: string;
  buyer: EntityDetails;
  seller: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;
  items: InvoiceItem[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  currency: string;
  orderNumber?: string;
  orderDate?: string;
  paymentMethod?: string;
  dueDate?: string;
  bankAccount?: string;
  rawText?: string;
  parsingMethod: 'deterministic-ksef' | 'gemini-vision' | 'regex-fallback';
}

/**
 * Rozbija pojedynczy wiersz adresu (np. "ul. Krzemieniecka 60A 54-613 Wrocław")
 * na ulicę, kod pocztowy i miasto.
 */
export function parseAddressString(addressStr: string): { addressLine1: string; postalCode: string; city: string } {
  if (!addressStr) return { addressLine1: '', postalCode: '', city: '' };

  const clean = addressStr.trim();
  const postalMatch = clean.match(/(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\s.-]+)$/i);
  if (postalMatch) {
    const postalCode = postalMatch[1];
    const city = postalMatch[2].trim();
    const addressLine1 = clean.substring(0, postalMatch.index).trim().replace(/,\s*$/, '');
    return { addressLine1, postalCode, city };
  }

  return { addressLine1: clean, postalCode: '', city: '' };
}

/**
 * Deterministyczny parser tekstu wyodrębnionego z PDF wydruku faktury KSeF (wFirma / Portal Podatnika / MF)
 */
export function parseKSeFInvoiceText(rawText: string): ParsedInvoicePdfResult {
  const text = (rawText || '').replace(/\r/g, '');

  // 1. Numer KSeF (35 lub 36 znaków)
  let ksefNumber = '';
  const ksefMatch =
    text.match(/Numer\s*KSeF:\s*([0-9A-Za-z-]{32,40})/i) ||
    text.match(/\b([1-9]\d{9}-20[2-9]\d{5}-[0-9A-Fa-f]{6}-?[0-9A-Fa-f]{6}-[0-9A-Fa-f]{2})\b/) ||
    text.match(/(?:ksef|identyfikator\s*ksef|nr\s*ksef)[:\s]*([0-9A-Za-z-]{32,40})/i);

  if (ksefMatch) {
    ksefNumber = ksefMatch[1].trim();
  }

  // 2. Numer faktury
  let invoiceNumber = '';
  const invMatch =
    text.match(/Numer\s*faktury\s*\n\s*([^\n\r]+)/i) ||
    text.match(/(?:faktura\s*(?:vat)?\s*(?:nr|numer)?|nr\s*faktury)[:\s]*([0-9a-zA-Z_\/\-]+)/i) ||
    text.match(/\b(\d{1,4}\/202[5-9]\/(?:KSEF|VAT|FV|FA))\b/i);

  if (invMatch) {
    invoiceNumber = invMatch[1].trim();
  }

  // 3. Daty
  let issueDate = '';
  const dateMatch =
    text.match(/Data\s*wystawienia[^\n:]*:\s*(\d{4}[-./]\d{2}[-./]\d{2})/i) ||
    text.match(/Data\s*wystawienia[^\n:]*:\s*(\d{2}[-./]\d{2}[-./]\d{4})/i) ||
    text.match(/(?:wystawiono)[:\s]*(\d{4}-\d{2}-\d{2})/i);

  if (dateMatch) {
    let d = dateMatch[1].replace(/[./]/g, '-');
    if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
      const parts = d.split('-');
      d = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    issueDate = d;
  }

  let deliveryDate = '';
  const delivMatch = text.match(/Data\s*dokonania[^\n:]*:\s*(\d{4}[-./]\d{2}[-./]\d{2})/i);
  if (delivMatch) {
    deliveryDate = delivMatch[1].replace(/[./]/g, '-');
  }

  let issuePlace = '';
  const placeMatch = text.match(/Miejsce\s*wystawienia:\s*([^\n\r]+)/i);
  if (placeMatch) {
    issuePlace = placeMatch[1].trim();
  }

  // 4. Sprzedawca
  const defaultSeller: EntityDetails = {
    nip: '9571106742',
    name: 'EUBIOSIS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    countryCode: 'PL',
    addressLine1: 'ul. Nowatorów 31 lok. 4',
    postalCode: '80-298',
    city: 'Gdańsk',
    bankAccount: '96 1090 1098 0000 0001 6398 3525',
    bdoNumber: '000585744',
  };

  let seller = { ...defaultSeller };
  const sellerBlock = text.match(/Sprzedawca\s*\n\s*NIP:\s*(\d{10})\s*\n\s*Nazwa:\s*([^\n]+(?:\n[^\n]+)?)\s*\n\s*Adres\s*\n\s*([^\n]+)/i);
  if (sellerBlock) {
    seller.nip = sellerBlock[1];
    seller.name = sellerBlock[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const addr = parseAddressString(sellerBlock[3]);
    if (addr.addressLine1) seller.addressLine1 = addr.addressLine1;
    if (addr.postalCode) seller.postalCode = addr.postalCode;
    if (addr.city) seller.city = addr.city;
  }

  // 5. Nabywca
  let buyer: EntityDetails = {
    nip: '8943149010',
    name: 'DR. MAX LEKOMAT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    countryCode: 'PL',
    addressLine1: 'ul. Krzemieniecka 60A',
    postalCode: '54-613',
    city: 'Wrocław',
    gln: '',
  };

  const buyerBlock = text.match(/Nabywca\s*\n\s*NIP:\s*(\d{10})\s*\n\s*Nazwa:\s*([^\n]+(?:\n[^\n]+)?)\s*\n\s*Adres\s*\n\s*([^\n]+)/i);
  if (buyerBlock) {
    buyer.nip = buyerBlock[1];
    buyer.name = buyerBlock[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const addr = parseAddressString(buyerBlock[3]);
    buyer.addressLine1 = addr.addressLine1 || buyerBlock[3].trim();
    buyer.postalCode = addr.postalCode;
    buyer.city = addr.city;
  } else {
    // Luźniejsze dopasowanie Nabywcy
    const nipMatch = text.match(/(?:Nabywca|Kupujący)[\s\S]*?NIP:\s*(\d{10})/i);
    if (nipMatch) {
      buyer.nip = nipMatch[1];
    }
  }

  // 6. Zamówienie i warunki transakcji
  let orderDate = '';
  let orderNumber = '';
  const orderMatch =
    text.match(/Data\s*zamówienia\s+Numer\s*zamówienia\s*\n\s*(\d{4}[-./]\d{2}[-./]\d{2})\s+([^\n\r]+)/i) ||
    text.match(/(?:nr\s*zamówienia|zamówienie\s*nr)[:\s]*([0-9A-Za-z_\/\-]+)/i);

  if (orderMatch) {
    if (orderMatch[2]) {
      orderDate = orderMatch[1].replace(/[./]/g, '-');
      orderNumber = orderMatch[2].trim();
    } else {
      orderNumber = orderMatch[1].trim();
    }
  }

  // 7. Płatność
  let paymentMethod = 'Przelew';
  let dueDate = '';
  const dueMatch = text.match(/Termin\s*płatności[^\n]*\n\s*(\d{4}[-./]\d{2}[-./]\d{2})/i);
  if (dueMatch) {
    dueDate = dueMatch[1].replace(/[./]/g, '-');
  }

  let bankAccount = '';
  const bankMatch = text.match(/Pełny\s*numer\s*rachunku\s*\n\s*([0-9\s]{26,38})/i);
  if (bankMatch) {
    bankAccount = bankMatch[1].trim();
  }

  // 8. Tabela GTIN
  const gtinMap: Record<string, string> = {};
  const gtinRegex = /^(\d+)\s*\t\s*(\d{8,14})$/gm;
  let gMatch;
  while ((gMatch = gtinRegex.exec(text)) !== null) {
    gtinMap[gMatch[1]] = gMatch[2];
  }

  // 9. Tabela Pozycji (rozpoznawanie wierszy z tabulatorami lub spacjami)
  const items: InvoiceItem[] = [];
  // Format tabeli: Lp \t Nazwa \t CenaJedn \t Ilość \t Miara \t StawkaVAT \t WartośćSprzedażyNetto
  const rowRegex = /^(\d+)\s*\t\s*(.+?)\s*\t\s*([0-9.,\s]+)\s*\t\s*([0-9.,\s]+)\s*\t\s*([A-Za-z.]+)\s*\t\s*([0-9%]+|[a-zA-Z]+)\s*\t\s*([0-9.,\s]+)$/gm;
  let rMatch;
  while ((rMatch = rowRegex.exec(text)) !== null) {
    const lp = rMatch[1];
    const name = rMatch[2].trim();
    const rawPrice = rMatch[3].replace(/\s/g, '').replace(',', '.');
    const rawQty = rMatch[4].replace(/\s/g, '').replace(',', '.');
    const unit = rMatch[5].trim().toUpperCase();
    let rawVat = rMatch[6].trim();
    if (!rawVat.includes('%') && /^\d+$/.test(rawVat)) {
      rawVat = `${rawVat}%`;
    }

    const netPrice = parseFloat(rawPrice) || 0;
    const quantity = parseFloat(rawQty) || 1;
    const gtin = gtinMap[lp] || '';

    items.push({
      id: `it-${lp}-${Date.now()}`,
      name,
      gtin,
      unit: unit || 'SZT.',
      quantity,
      netPrice,
      vatRate: (rawVat as any) || '8%',
    });
  }

  // Jeśli nie dopasowano pozycji tabulatorami, szukamy alternatywnych wariantów
  if (items.length === 0) {
    const looseRowRegex = /(\d+)\s+([A-Za-z0-9®\s\-+]+?)\s+(\d+[.,]\d{2})\s+(\d+)\s+(SZT\.?|OP\.?|KG)\s+(\d+%)\s+(\d+[.,]\d{2})/g;
    let lMatch;
    while ((lMatch = looseRowRegex.exec(text)) !== null) {
      items.push({
        id: `it-${lMatch[1]}-${Date.now()}`,
        name: lMatch[2].trim(),
        netPrice: parseFloat(lMatch[3].replace(',', '.')),
        quantity: parseFloat(lMatch[4]),
        unit: lMatch[5].trim().toUpperCase(),
        vatRate: (lMatch[6].trim() as any) || '8%',
        gtin: gtinMap[lMatch[1]] || '',
      });
    }
  }

  // 10. Kwoty podsumowania
  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;

  const totalGrossMatch = text.match(/Kwota\s*należności\s*ogółem\s*:\s*([0-9.,\s]+)\s*PLN/i);
  if (totalGrossMatch) {
    totalGross = parseFloat(totalGrossMatch[1].replace(/\s/g, '').replace(',', '.')) || 0;
  }

  const vatSummaryMatch = text.match(/(?:7%\s*lub\s*8%|8%|23%)\s+([0-9.,\s]+)\s+([0-9.,\s]+)\s+([0-9.,\s]+)/i);
  if (vatSummaryMatch) {
    totalNet = parseFloat(vatSummaryMatch[1].replace(/\s/g, '').replace(',', '.')) || 0;
    totalVat = parseFloat(vatSummaryMatch[2].replace(/\s/g, '').replace(',', '.')) || 0;
    if (!totalGross) {
      totalGross = parseFloat(vatSummaryMatch[3].replace(/\s/g, '').replace(',', '.')) || 0;
    }
  }

  if (!totalNet && items.length > 0) {
    totalNet = items.reduce((acc, it) => acc + it.quantity * it.netPrice, 0);
    totalVat = totalNet * 0.08;
    totalGross = totalNet + totalVat;
  }

  return {
    success: Boolean(invoiceNumber || ksefNumber || items.length > 0),
    ksefNumber,
    hasKsefNumber: Boolean(ksefNumber && ksefNumber.length >= 30),
    invoiceNumber: invoiceNumber || '41/2026/KSEF',
    issueDate: issueDate || new Date().toISOString().slice(0, 10),
    deliveryDate,
    issuePlace: issuePlace || 'Gdańsk',
    buyer,
    seller,
    thirdParty: null,
    items,
    totalNet: Math.round(totalNet * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    currency: 'PLN',
    orderNumber,
    orderDate,
    paymentMethod,
    dueDate,
    bankAccount,
    rawText: text.slice(0, 1000),
    parsingMethod: 'deterministic-ksef',
  };
}
