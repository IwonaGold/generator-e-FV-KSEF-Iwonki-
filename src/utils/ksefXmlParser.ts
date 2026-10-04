import { EntityDetails, ThirdPartyEntity, InvoiceItem } from '../types/ksef';
import { CorrectionItem } from '../types/correction';

export interface ParsedKSeFXMLInvoice {
  invoiceNumber: string;
  issueDate: string;
  deliveryDate?: string;
  issuePlace?: string;
  currency: string;
  totalGross: number;
  orderNumber?: string;
  orderDate?: string;
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;
  items: InvoiceItem[];
}

/**
 * Szybkie i bezpieczne wyciąganie numeru faktury z zawartości pliku XML KSeF (węzeł <P_2>)
 */
export function extractInvoiceNumberFromXml(xmlText?: string | null): string | null {
  if (!xmlText || typeof xmlText !== 'string') return null;

  // 1. Dopasowanie Regex (najszybsze i odporne na błędy parsowania)
  const match = xmlText.match(/<P_2(?: [^>]*)?>([\s\S]*?)<\/P_2>/i);
  if (match && match[1]) {
    const val = match[1].trim();
    if (val) return val;
  }

  // 2. DOMParser fallback
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const p2 = doc.getElementsByTagName('P_2')[0];
    if (p2 && p2.textContent) {
      const val = p2.textContent.trim();
      if (val) return val;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export function parseKSeFXMLString(xmlText: string): ParsedKSeFXMLInvoice {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const getTagText = (parent: Element | Document, tagName: string): string => {
    const el = parent.getElementsByTagName(tagName)[0];
    return el && el.textContent ? el.textContent.trim() : '';
  };

  // 1. Numer i daty faktury
  const invoiceNumber = getTagText(xmlDoc, 'P_2') || 'FAKTURA';
  const issueDate = getTagText(xmlDoc, 'P_1') || new Date().toISOString().slice(0, 10);
  const deliveryDate = getTagText(xmlDoc, 'P_6');
  const issuePlace = getTagText(xmlDoc, 'P_1M');
  const currency = getTagText(xmlDoc, 'KodWaluty') || 'PLN';
  const totalGrossStr = getTagText(xmlDoc, 'P_15') || '0';
  const totalGross = parseFloat(totalGrossStr) || 0;

  // 2. Zamówienie
  const orderNumber = getTagText(xmlDoc, 'NrZamowienia');
  const orderDate = getTagText(xmlDoc, 'DataZamowienia');

  // 3. Sprzedawca (Podmiot1)
  const p1El = xmlDoc.getElementsByTagName('Podmiot1')[0];
  const seller: EntityDetails = {
    nip: p1El ? getTagText(p1El, 'NIP') : '5833446059',
    name: p1El ? getTagText(p1El, 'Nazwa') : 'EUBIOSIS SP. Z O.O.',
    countryCode: p1El ? getTagText(p1El, 'KodKraju') || 'PL' : 'PL',
    addressLine1: p1El ? getTagText(p1El, 'AdresL1') : 'al. Grunwaldzka 472D, 80-309 Gdańsk',
    postalCode: '80-309',
    city: 'Gdańsk',
    email: p1El ? getTagText(p1El, 'Email') : 'biuro@eubiosis.pl',
  };

  // 4. Nabywca (Podmiot2)
  const p2El = xmlDoc.getElementsByTagName('Podmiot2')[0];
  const buyer: EntityDetails = {
    nip: p2El ? getTagText(p2El, 'NIP') : '',
    name: p2El ? getTagText(p2El, 'Nazwa') : '',
    countryCode: p2El ? getTagText(p2El, 'KodKraju') || 'PL' : 'PL',
    addressLine1: p2El ? getTagText(p2El, 'AdresL1') : '',
    postalCode: '',
    city: '',
    email: p2El ? getTagText(p2El, 'Email') : '',
    gln: p2El ? getTagText(p2El, 'GLN') : '',
  };

  // 5. Odbiorca (Podmiot3)
  const p3El = xmlDoc.getElementsByTagName('Podmiot3')[0];
  let thirdParty: ThirdPartyEntity | null = null;
  if (p3El) {
    thirdParty = {
      role: (getTagText(p3El, 'Rola') as any) || '2',
      nip: getTagText(p3El, 'NIP'),
      idWew: getTagText(p3El, 'IDWew'),
      gln: getTagText(p3El, 'GLN'),
      name: getTagText(p3El, 'Nazwa'),
      countryCode: getTagText(p3El, 'KodKraju') || 'PL',
      addressLine1: getTagText(p3El, 'AdresL1'),
    };
  }

  // 6. Pozycje (FaWiersz)
  const wiersze = xmlDoc.getElementsByTagName('FaWiersz');
  const items: InvoiceItem[] = [];

  for (let i = 0; i < wiersze.length; i++) {
    const wiersz = wiersze[i];
    const p7 = getTagText(wiersz, 'P_7') || `Pozycja #${i + 1}`;
    const gtin = getTagText(wiersz, 'GTIN');
    const unit = getTagText(wiersz, 'P_8A') || 'szt.';
    const qtyStr = getTagText(wiersz, 'P_8B') || '1';
    const netPriceStr = getTagText(wiersz, 'P_9A') || '0';
    const vatVal = getTagText(wiersz, 'P_12') || '8';

    const quantity = parseFloat(qtyStr) || 1;
    const netPrice = parseFloat(netPriceStr) || 0;

    let vatRate = '8%';
    if (vatVal.includes('23')) vatRate = '23%';
    else if (vatVal.includes('8')) vatRate = '8%';
    else if (vatVal.includes('5')) vatRate = '5%';
    else if (vatVal.includes('0')) vatRate = '0%';
    else if (vatVal.toLowerCase().includes('zw')) vatRate = 'zw';

    items.push({
      id: `xml-item-${i + 1}-${Date.now()}`,
      name: p7,
      gtin: gtin || '',
      unit,
      quantity,
      netPrice,
      vatRate: vatRate as any,
      batchNumber: '',
      expiryDate: '',
    });
  }

  return {
    invoiceNumber,
    issueDate,
    deliveryDate,
    issuePlace,
    currency,
    totalGross,
    orderNumber,
    orderDate,
    seller,
    buyer,
    thirdParty,
    items,
  };
}

export function convertInvoiceItemsToCorrectionItems(items: InvoiceItem[]): CorrectionItem[] {
  return items.map((item, idx) => {
    const netTotal = Math.round(item.quantity * item.netPrice * 100) / 100;
    const vatPct = item.vatRate === '23%' ? 0.23 : item.vatRate === '8%' ? 0.08 : item.vatRate === '5%' ? 0.05 : 0;
    const vatTotal = Math.round(netTotal * vatPct * 100) / 100;
    const grossTotal = Math.round((netTotal + vatTotal) * 100) / 100;

    return {
      id: `corr-${idx + 1}-${Date.now()}`,
      originalRowNumber: idx + 1,
      name: item.name,
      gtin: item.gtin,
      unit: item.unit || 'szt.',
      vatRate: item.vatRate,
      originalQuantity: item.quantity,
      originalNetPrice: item.netPrice,
      originalNetTotal: netTotal,
      originalVatTotal: vatTotal,
      originalGrossTotal: grossTotal,
      correctedQuantity: item.quantity,
      correctedNetPrice: item.netPrice,
      correctedNetTotal: netTotal,
      correctedVatTotal: vatTotal,
      correctedGrossTotal: grossTotal,
      quantityDelta: 0,
      netDelta: 0,
      vatDelta: 0,
      grossDelta: 0,
      isModified: false,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
    };
  });
}
