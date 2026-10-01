import * as XLSX from 'xlsx';
import {
  EntityDetails,
  InvoiceItem,
  InvoiceMeta,
  ParsedOrderData,
  PharmacyChain,
  ThirdPartyEntity,
  VatRate,
} from '../types/ksef';
import { decodeTextFile, fixPolishMojibake } from './textEncoding';
import { cleanProductName } from './ksefGenerator';
import { PHARMACY_CHAINS } from './sampleData';

export interface ParsedOrderResult {
  items: Partial<InvoiceItem>[];
  headerData?: ParsedOrderData;
  rawText?: string;
  hasBatchesOrExpiry?: boolean;
}

export interface OrderIngestionMatch {
  chain: PharmacyChain;
  buyer: EntityDetails;
  thirdParty: ThirdPartyEntity | null;
  metaUpdates: Partial<InvoiceMeta>;
  isRecognizedChain: boolean;
  chainProfileName?: string;
  extractedSummary: {
    buyerName: string;
    buyerNip: string;
    buyerAddress: string;
    datesFound: string[];
  };
}

/**
 * Normalizuje datę z formatu YYYY-MM-DD lub DD.MM.YYYY do sztywnego standardu KSeF: YYYY-MM-DD
 */
export function normalizeDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();

  // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const ymd = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  return undefined;
}

/**
 * Normalizuje 10-cyfrowy NIP
 */
export function normalizeNip(nip?: string): string | undefined {
  if (!nip) return undefined;
  const digits = nip.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  return undefined;
}

/**
 * Wyciąga metadane nagłówka zamówienia z tekstu dokumentu
 * (w tym pełne dane Nabywcy, Odbiorcy oraz wszystkie daty)
 */
export function extractOrderHeaderFromText(text: string): ParsedOrderData {
  const result: ParsedOrderData = {};
  const cleaned = fixPolishMojibake(text);
  const SELLER_NIP = '9571106742'; // Eubiosis Sp. z o.o.

  // 1. Numer zamówienia
  // Unikamy błędnego dopasowania słowa 'po' z 'po upuście' czy 'po terminie'
  const orderNumMatch =
    cleaned.match(/(?:^|\n)\s*(?:Zamówienie|Zamowienie|Order)\s+([A-Za-z0-9\-\_\/]{4,})/i) ||
    cleaned.match(
      /(?:Numer zamówienia|Nr zamówienia|Zamówienie(?:\s+[a-ząćęłńóśźż]+)?\s+nr|Zamówienie nr|Order No|PO Number|Purchase Order|Nr ref|Nr zam|Numer zam)[:\s]+([A-Za-z0-9\-\_\/]+)/i
    ) ||
    cleaned.match(/(?:^|\n)\s*nr\s+([A-Za-z0-9\-\_\/]{4,})/i);

  if (orderNumMatch && !/^(hurtowe|towarowe|dokument|złożone|klienta|rachunku|konta|telefonu|upuście|rabacie)$/i.test(orderNumMatch[1].trim())) {
    result.orderNumber = orderNumMatch[1].trim();
  } else {
    const fallbackNum = cleaned.match(/(?:zamówienie|order)[^\n\r]*?(?:nr|numer)[:\s]+([A-Za-z0-9\-\_\/]+)/i);
    if (fallbackNum && !/^(hurtowe|towarowe|dokument|złożone|klienta|rachunku|konta|telefonu|upuście|rabacie)$/i.test(fallbackNum[1].trim())) {
      result.orderNumber = fallbackNum[1].trim();
    }
  }

  // 2. Data złożenia / wystawienia zamówienia
  const orderDateMatch =
    cleaned.match(
      /(?:Data złożenia(?: zamówienia)?|Data zamówienia|Data zam|Data wystawienia(?: zamówienia| dokumentu)?|Data dokumentu|Order Date)[:\s]+(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
    ) ||
    cleaned.match(
      /(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})[\t\s]+(?:Data wystawienia|Data zamówienia|Data złożenia|Data dokumentu)/i
    );
  if (orderDateMatch) {
    const nd = normalizeDate(orderDateMatch[1]);
    if (nd) result.orderDate = nd;
  }

  // 3. Termin płatności (data)
  const dueDateMatch = cleaned.match(
    /(?:Termin płatności|Termin platnosci|Płatność do|Platnosc do|Termin zapłaty|Termin zaplaty|Płatność do dnia)[:\s]+(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
  );
  if (dueDateMatch) {
    const nd = normalizeDate(dueDateMatch[1]);
    if (nd) result.dueDate = nd;
  }

  // 4. Data dostawy / realizacji (np. "Oczekiwany termin dostawy 2026-10-05 12:00", "Data realizacji: 2026-09-30")
  const deliveryDateMatch =
    cleaned.match(
      /(?:Oczekiwany termin dostawy|Termin dostawy|Data dostawy|Termin realizacji|Data realizacji|Dostawa do dnia|Dostawa)[:\s]+(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i
    ) ||
    cleaned.match(
      /(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})[\t\s]+(?:Data realizacji|Termin realizacji|Data dostawy|Termin dostawy)/i
    );
  if (deliveryDateMatch) {
    const nd = normalizeDate(deliveryDateMatch[1]);
    if (nd) result.deliveryDate = nd;
  }

  // 5. Termin płatności (dni) - np. "60 - dniowy", "30 dni", "45 dni"
  const paymentDaysMatch = cleaned.match(
    /(?:Oczekiwany termin płatności|Termin płatności|Termin platnosci|Płatność|Platnosc|Termin)[:\s]+(\d+)\s*[-–]?\s*(?:dniowy|dni|days|dni kalendarzowych|dni roboczych)/i
  );
  if (paymentDaysMatch) {
    result.paymentDays = parseInt(paymentDaysMatch[1], 10);
    if (!result.dueDate) {
      // UWAGA: termin płatności liczony od daty dostawy (deliveryDate), a jeśli brak to od daty zamówienia
      const baseDateStr = result.deliveryDate || result.orderDate;
      const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
      baseDate.setDate(baseDate.getDate() + result.paymentDays);
      result.dueDate = baseDate.toISOString().slice(0, 10);
    }
  }

  // 6. Forma płatności
  if (/przelew/i.test(cleaned)) {
    result.paymentMethod = 'przelew';
  } else if (/gotówk|gotowk/i.test(cleaned)) {
    result.paymentMethod = 'gotowka';
  } else if (/karta/i.test(cleaned)) {
    result.paymentMethod = 'karta';
  }

  // 7a. Blok "Kupujący" / "Nabywca" wielowierszowy (np. DOZ, hurtownie)
  const kupujacySection = cleaned.match(/(?:Kupujący|Kupujacy|Nabywca|Zamawiający)([\s\S]+?)(?:Sprzedawca|Dostawca|Miejsce dostawy|Odbiorca|Lp\.)/i);
  if (kupujacySection) {
    const kText = kupujacySection[1];
    const nipM = kText.match(/NIP[:\s]*([0-9\-]{10,14})/i);
    if (nipM && !result.buyerNip) {
      const parsedNip = normalizeNip(nipM[1]);
      if (parsedNip && parsedNip !== SELLER_NIP) {
        result.buyerNip = parsedNip;
      }
    }

    const nameM = kText.match(/Nazwa[:\s]+([\s\S]+?)(?=(?:Ulica|Adres|Miasto|Kod|NIP|Nr|KRS|Zezwolenia|Miejsce|ILN))/i);
    if (nameM && !result.buyerName) {
      const parsedName = nameM[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (parsedName.length > 2 && !/^(dostawca|sprzedawca)/i.test(parsedName)) {
        result.buyerName = parsedName;
      }
    }

    const ulicaM = kText.match(/(?:Ulica|Adres)[:\s]+([^\r\n]+)/i);
    if (ulicaM && !result.buyerAddress) {
      result.buyerAddress = ulicaM[1].trim();
    }

    const miastoM = kText.match(/Miasto[:\s]+([^\r\n]+)/i);
    if (miastoM && !result.buyerCity) {
      result.buyerCity = miastoM[1].trim();
    }

    const kodM = kText.match(/Kod[:\s]+(\d{2}-\d{3})/i);
    if (kodM && !result.buyerPostalCode) {
      result.buyerPostalCode = kodM[1].trim();
    }
  }

  // 7b. NIP Nabywcy jednoliniowy
  if (!result.buyerNip) {
    const buyerNipMatch = cleaned.match(
      /(?:Nabywca|Kupujący|Kupujacy|Zamawiający|Zamawiajacy|Klient|Fakturować na)[^\n\r]*?(?:NIP:?|PL)?\s*([0-9\-\s]{10,14})/i
    );
    if (buyerNipMatch) {
      const parsed = normalizeNip(buyerNipMatch[1]);
      if (parsed && parsed !== SELLER_NIP) {
        result.buyerNip = parsed;
      }
    }
  }

  // Fallback: jeśli nie znaleziono bezpośrednio przy słowie Nabywca, przeszukaj cały tekst dokumentu
  if (!result.buyerNip) {
    const allNips = Array.from(cleaned.matchAll(/(?:NIP:?|PL)?\s*([0-9\-\s]{10,14})/gi));
    for (const match of allNips) {
      const parsed = normalizeNip(match[1]);
      if (parsed && parsed !== SELLER_NIP) {
        result.buyerNip = parsed;
        break;
      }
    }
  }

  // 8. Nazwa Nabywcy jednoliniowa
  if (!result.buyerName) {
    const buyerNameMatch = cleaned.match(
      /(?:Nabywca|Kupujący|Kupujacy|Zamawiający|Zamawiajacy|Klient|Fakturować na)[:\s]+([^\n\r\|\(\)]+)/i
    );
    if (buyerNameMatch) {
      const rawName = buyerNameMatch[1]
        .replace(/NIP:?\s*[\d\-\s]+/i, '')
        .replace(/Adres:?.*$/i, '')
        .trim();
      if (rawName.length > 2 && !/^(dostawca|sprzedawca)/i.test(rawName)) {
        result.buyerName = rawName;
      }
    }
  }

  // 9. Adres Nabywcy, Kod i Miasto jednoliniowy
  if (!result.buyerAddress) {
    const addressMatch = cleaned.match(
      /(?:Adres|Adres siedziby|Siedziba|Ulica|Ul\.)[:\s]+([^\n\r\|]+)/i
    );
    if (addressMatch) {
      const rawAddr = addressMatch[1].trim();
      const postalCityMatch = rawAddr.match(/(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/);
      if (postalCityMatch) {
        if (!result.buyerPostalCode) result.buyerPostalCode = postalCityMatch[1].trim();
        if (!result.buyerCity) result.buyerCity = postalCityMatch[2].trim().replace(/,.*$/, '');
        const streetPart = rawAddr.replace(postalCityMatch[0], '').replace(/^,\s*|,\s*$/g, '').trim();
        if (streetPart) {
          result.buyerAddress = streetPart;
        }
      } else {
        result.buyerAddress = rawAddr;
      }
    }
  }

  // Kod pocztowy i miasto jeśli nie było wyżej
  if (!result.buyerPostalCode || !result.buyerCity) {
    const postalMatch = cleaned.match(/(?:Kod i miasto|Miejscowość|Miasto)?[:\s]*(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/i);
    if (postalMatch) {
      if (!result.buyerPostalCode) result.buyerPostalCode = postalMatch[1].trim();
      if (!result.buyerCity) result.buyerCity = postalMatch[2].trim().replace(/,.*$/, '');
    }
  }

  // 9b. Fallback dla bloków zamówień (np. Dr. Max, gdzie Nabywca/Wystawca jest na samej górze nad NIP bez etykiety 'Nabywca:')
  if (result.buyerNip && (!result.buyerName || !result.buyerAddress)) {
    const rawLines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const nipIdx = rawLines.findIndex((l) => {
      const m = l.match(/NIP[:\s]*([0-9\-]{10,13})/i);
      return m && normalizeNip(m[1]) === result.buyerNip;
    });

    if (nipIdx > 0) {
      let foundPostalIdx = -1;
      for (let j = nipIdx - 1; j >= Math.max(0, nipIdx - 4); j--) {
        const pm = rawLines[j].match(/^(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/);
        if (pm) {
          foundPostalIdx = j;
          if (!result.buyerPostalCode) result.buyerPostalCode = pm[1].trim();
          if (!result.buyerCity) result.buyerCity = pm[2].trim().replace(/,.*$/, '');
          break;
        }
      }

      if (foundPostalIdx > 0) {
        const streetLine = rawLines[foundPostalIdx - 1];
        if (!result.buyerAddress && streetLine && !isHeaderOrSummaryLine(streetLine)) {
          result.buyerAddress = streetLine;
        }
        if (foundPostalIdx > 1) {
          const nameLine = rawLines[foundPostalIdx - 2];
          if (
            !result.buyerName &&
            nameLine &&
            !isHeaderOrSummaryLine(nameLine) &&
            !/^(dostawca|sprzedawca|adresat|data)/i.test(nameLine)
          ) {
            result.buyerName = nameLine;
          }
        }
      }
    }
  }

  // 10. E-mail Nabywcy
  const emailMatch = cleaned.match(
    /(?:E-mail|Email|Mail|Adres e-mail)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (emailMatch) {
    result.buyerEmail = emailMatch[1].trim();
  }

  // 11a. Blok "Miejsce dostawy" / "Odbiorca" wielowierszowy (np. DOZ, Super-Pharm)
  const dostawaSection = cleaned.match(/(?:Miejsce dostawy|Odbiorca|Magazyn odbiorczy|Dostawa do)([\s\S]+?)(?:Lp\.|Sprzedawca|Kupujący|Kupujacy|Nabywca|Pozycje)/i);
  if (dostawaSection) {
    const dText = dostawaSection[1];
    const ilnM = dText.match(/(?:ILN|GLN)[:\s]*(\d{13})/i);
    if (ilnM) {
      result.recipientGln = ilnM[1];
    }
    const idWewM = dText.match(/(?:ID-Wew|Identyfikator wewnętrzny)[:\s]+([0-9\-]+)/i);
    if (idWewM) {
      const cleanM = idWewM[1].trim();
      if (/^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanM)) {
        result.recipientIdWew = cleanM;
      } else if (/^\d{1,13}$/.test(cleanM)) {
        result.recipientGln = cleanM;
      }
    }

    const nameM = dText.match(/Nazwa[:\s]+([\s\S]+?)(?=(?:Ulica|Adres|Miasto|Kod|Kraj|ILN|GLN))/i);
    if (nameM && !result.recipientName) {
      result.recipientName = nameM[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const ulicaM = dText.match(/(?:Ulica|Adres)[:\s]+([^\r\n]+(?:\r?\n\s*r\.\s*\d+-\d+)?)/i);
    if (ulicaM && !result.recipientAddress) {
      result.recipientAddress = ulicaM[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const miastoM = dText.match(/Miasto[:\s]+([^\r\n]+)/i);
    if (miastoM && !result.recipientCity) {
      result.recipientCity = miastoM[1].trim();
    }

    const kodM = dText.match(/Kod[:\s]+(\d{2}-\d{3})/i);
    if (kodM && !result.recipientPostalCode) {
      result.recipientPostalCode = kodM[1].trim();
    }
  }

  // 11b. Odbiorca / Miejsce dostawy (Podmiot3) jednoliniowy
  if (!result.recipientName) {
    const recipientMatch = cleaned.match(
      /(?:Odbiorca|Miejsce dostawy|Dostawa do|Punkt odbioru|Magazyn odbiorczy)[:\s]+([^\n\r\|]+)/i
    );
    if (recipientMatch) {
      const rawRecipient = recipientMatch[1].trim();
      const idWewInRecipient = rawRecipient.match(/(?:ID-Wew|Identyfikator wewnętrzny)[:\s]+([0-9\-]+)/i);
      if (idWewInRecipient) {
        const cleanM = idWewInRecipient[1].trim();
        if (/^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanM)) {
          result.recipientIdWew = cleanM;
        } else if (/^\d{1,13}$/.test(cleanM)) {
          result.recipientGln = cleanM;
        }
      }

      const cleanRecipientLine = rawRecipient
        .replace(/\(?(?:ID-Wew|Identyfikator wewnętrzny)[:\s]+[0-9\-]+\)?/i, '')
        .trim();
      const parts = cleanRecipientLine.split(',').map((p) => p.trim());
      if (parts.length > 0) {
        result.recipientName = parts[0];
        if (parts.length > 1) {
          result.recipientAddress = parts.slice(1).join(', ').trim();
        }
      }
    }
  }

  // 12. Osobne ID-Wew jeśli nie wyciągnięte wyżej
  if (!result.recipientIdWew && !result.recipientGln) {
    const idWewMatch = cleaned.match(/(?:ID-Wew|Identyfikator wewnętrzny)[:\s]+([0-9\-]+)/i);
    if (idWewMatch) {
      const cleanM = idWewMatch[1].trim();
      if (/^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanM)) {
        result.recipientIdWew = cleanM;
      } else if (/^\d{1,13}$/.test(cleanM)) {
        result.recipientGln = cleanM;
      }
    }
  }

  return result;
}

/**
 * Łączy dane wyciągnięte z zamówienia z zapisanym profilem sieci farmaceutycznej
 * lub tworzy bezpośredni profil Nabywcy z zamówienia.
 * Sprzedawca (Eubiosis Sp. z o.o.) zawsze pozostaje stały.
 */
export function matchOrBuildBuyerFromOrder(headerData?: ParsedOrderData): OrderIngestionMatch {
  const datesFound: string[] = [];
  if (headerData?.orderDate) datesFound.push(`Zamówienie: ${headerData.orderDate}`);
  if (headerData?.deliveryDate) datesFound.push(`Dostawa: ${headerData.deliveryDate}`);
  if (headerData?.dueDate) datesFound.push(`Termin: ${headerData.dueDate}`);
  if (headerData?.paymentDays) datesFound.push(`${headerData.paymentDays} dni`);

  const metaUpdates: Partial<InvoiceMeta> = {};
  if (headerData?.orderNumber) metaUpdates.orderNumber = headerData.orderNumber;
  if (headerData?.orderDate) metaUpdates.orderDate = headerData.orderDate;
  if (headerData?.deliveryDate) metaUpdates.deliveryDate = headerData.deliveryDate;
  if (headerData?.dueDate) metaUpdates.dueDate = headerData.dueDate;
  if (headerData?.paymentDays) metaUpdates.paymentDays = headerData.paymentDays;
  if (headerData?.paymentMethod) metaUpdates.paymentMethod = headerData.paymentMethod;

  const defaultBuyer: EntityDetails = {
    nip: headerData?.buyerNip || '5250000000',
    name: headerData?.buyerName || 'APTEKA / NABYWCA Z ZAMÓWIENIA',
    countryCode: 'PL',
    addressLine1:
      headerData?.buyerAddress ||
      (headerData?.buyerPostalCode && headerData?.buyerCity
        ? `${headerData.buyerPostalCode} ${headerData.buyerCity}`
        : 'ul. Apteczna 1'),
    postalCode: headerData?.buyerPostalCode || '00-001',
    city: headerData?.buyerCity || 'Warszawa',
    email: headerData?.buyerEmail || '',
  };

  if (!headerData) {
    return {
      chain: 'Custom',
      buyer: defaultBuyer,
      thirdParty: null,
      metaUpdates,
      isRecognizedChain: false,
      extractedSummary: {
        buyerName: defaultBuyer.name,
        buyerNip: defaultBuyer.nip,
        buyerAddress: defaultBuyer.addressLine1,
        datesFound,
      },
    };
  }

  const cleanNip = headerData.buyerNip ? headerData.buyerNip.replace(/\D/g, '') : '';
  const cleanNameLower = (headerData.buyerName || '').toLowerCase();

  // Sprawdzenie dopasowania do znanych sieci aptecznych
  let matchedChainId: PharmacyChain | null = null;
  for (const [key, profile] of Object.entries(PHARMACY_CHAINS)) {
    if (key === 'Custom') continue;
    if (cleanNip && profile.buyer.nip === cleanNip) {
      matchedChainId = profile.id;
      break;
    }
    if (cleanNameLower) {
      if (
        key === 'Dr. Max' &&
        (cleanNameLower.includes('dr. max') ||
          cleanNameLower.includes('drmax') ||
          cleanNameLower.includes('lekomat'))
      ) {
        matchedChainId = 'Dr. Max';
        break;
      }
      if (
        key === 'Super-Pharm' &&
        (cleanNameLower.includes('super-pharm') || cleanNameLower.includes('super pharm'))
      ) {
        matchedChainId = 'Super-Pharm';
        break;
      }
      if (
        key === 'DOZ' &&
        (cleanNameLower.includes('doz') || cleanNameLower.includes('dbam o zdrowie'))
      ) {
        matchedChainId = 'DOZ';
        break;
      }
      if (key === 'Gemini' && cleanNameLower.includes('gemini')) {
        matchedChainId = 'Gemini';
        break;
      }
    }
  }

  if (matchedChainId && PHARMACY_CHAINS[matchedChainId]) {
    const profile = PHARMACY_CHAINS[matchedChainId];
    const mergedBuyer: EntityDetails = {
      ...profile.buyer,
      name:
        headerData.buyerName && headerData.buyerName.length > 5
          ? headerData.buyerName
          : profile.buyer.name,
      addressLine1: headerData.buyerAddress || profile.buyer.addressLine1,
      postalCode: headerData.buyerPostalCode || profile.buyer.postalCode,
      city: headerData.buyerCity || profile.buyer.city,
      email: headerData.buyerEmail || profile.buyer.email,
    };

    let thirdParty: ThirdPartyEntity | null = profile.thirdParty ? { ...profile.thirdParty } : null;
    if (headerData.recipientName) {
      const isHeaderIdWewValid = headerData.recipientIdWew && /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(headerData.recipientIdWew);
      const isHeaderGln = headerData.recipientGln || (headerData.recipientIdWew && /^\d{1,13}$/.test(headerData.recipientIdWew) && !isHeaderIdWewValid ? headerData.recipientIdWew : undefined);

      thirdParty = {
        name: headerData.recipientName,
        countryCode: 'PL',
        addressLine1:
          headerData.recipientAddress ||
          profile.thirdParty?.addressLine1 ||
          'Aleja 20-lecia 23, 96-515 Teresin',
        postalCode: headerData.recipientPostalCode || profile.thirdParty?.postalCode || '96-515',
        city: headerData.recipientCity || profile.thirdParty?.city || 'Teresin',
        idWew: isHeaderIdWewValid ? headerData.recipientIdWew : profile.thirdParty?.idWew,
        gln: isHeaderGln || profile.thirdParty?.gln,
        role: '2',
        roleDescription: 'Odbiorca (jednostka wewnętrzna/oddział nabywcy)',
      };
    }

    if (!metaUpdates.paymentDays && profile.standardPaymentDays) {
      metaUpdates.paymentDays = profile.standardPaymentDays;
      if (!metaUpdates.dueDate) {
        const baseDateStr = metaUpdates.deliveryDate || metaUpdates.orderDate;
        const base = baseDateStr ? new Date(baseDateStr) : new Date();
        base.setDate(base.getDate() + profile.standardPaymentDays);
        metaUpdates.dueDate = base.toISOString().slice(0, 10);
      }
    }

    return {
      chain: matchedChainId,
      buyer: mergedBuyer,
      thirdParty,
      metaUpdates,
      isRecognizedChain: true,
      chainProfileName: profile.name,
      extractedSummary: {
        buyerName: mergedBuyer.name,
        buyerNip: mergedBuyer.nip,
        buyerAddress: `${mergedBuyer.addressLine1}, ${mergedBuyer.postalCode} ${mergedBuyer.city}`,
        datesFound,
      },
    };
  }

  // Nowy / indywidualny Nabywca z zamówienia (Custom)
  const customBuyer: EntityDetails = {
    nip: headerData.buyerNip || '5250000000',
    name: headerData.buyerName || 'APTEKA / NABYWCA Z ZAMÓWIENIA',
    countryCode: 'PL',
    addressLine1:
      headerData.buyerAddress ||
      (headerData.buyerPostalCode && headerData.buyerCity
        ? `${headerData.buyerPostalCode} ${headerData.buyerCity}`
        : 'ul. Zamawiająca 1'),
    postalCode: headerData.buyerPostalCode || '00-001',
    city: headerData.buyerCity || 'Warszawa',
    email: headerData.buyerEmail || '',
  };

  let thirdParty: ThirdPartyEntity | null = null;
  if (headerData.recipientName) {
    const isHeaderIdWewValid = headerData.recipientIdWew && /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(headerData.recipientIdWew);
    const isHeaderGln = headerData.recipientGln || (headerData.recipientIdWew && /^\d{1,13}$/.test(headerData.recipientIdWew) && !isHeaderIdWewValid ? headerData.recipientIdWew : undefined);

    thirdParty = {
      name: headerData.recipientName,
      countryCode: 'PL',
      addressLine1: headerData.recipientAddress || 'ul. Magazynowa 1',
      postalCode: headerData.recipientPostalCode || '00-001',
      city: headerData.recipientCity || 'Warszawa',
      idWew: isHeaderIdWewValid ? headerData.recipientIdWew : undefined,
      gln: isHeaderGln,
      role: '2',
      roleDescription: 'Odbiorca (jednostka wewnętrzna/oddział nabywcy)',
    };
  }

  return {
    chain: 'Custom',
    buyer: customBuyer,
    thirdParty,
    metaUpdates,
    isRecognizedChain: false,
    extractedSummary: {
      buyerName: customBuyer.name,
      buyerNip: customBuyer.nip,
      buyerAddress: `${customBuyer.addressLine1}, ${customBuyer.postalCode} ${customBuyer.city}`,
      datesFound,
    },
  };
}

/**
 * Sprawdza, czy linia to nagłówek dokumentu lub tabela podsumowania
 */
function isHeaderOrSummaryLine(lineStr: string): boolean {
  const lower = lineStr.toLowerCase().trim();
  if (!lower) return true;

  const headerPrefixes = [
    'dokument',
    'zamówienie',
    'zamowienie',
    'termin',
    'płatność',
    'platnosc',
    'dostawca',
    'sprzedawca',
    'nabywca',
    'kupujący',
    'kupujacy',
    'zamawiający',
    'zamawiajacy',
    'klient',
    'odbiorca',
    'magazyn',
    'dostawa',
    'pozycje',
    'pozycja',
    'data',
    'wartość',
    'wartosc',
    'razem',
    'suma',
    'podsumowanie',
    'nagłówek',
    'naglowek',
    'uwagi',
    'numer zamówienia',
    'nr zamówienia',
    'lp.',
    'lp ',
    'l.p.',
  ];

  if (headerPrefixes.some((p) => lower.startsWith(p))) {
    return true;
  }

  if (
    lower.includes('termin płatności') ||
    lower.includes('termin platnosci') ||
    lower.includes('data zamówienia') ||
    lower.includes('data zam') ||
    lower.includes('data złożenia') ||
    lower.includes('data dostawy') ||
    lower.includes('numer zamówienia') ||
    lower.includes('nr zamówienia') ||
    lower.includes('forma płatności') ||
    lower.includes('forma platnosci')
  ) {
    return true;
  }

  return false;
}

/**
 * Parsuje treść tekstową zamówienia (TXT, CSV, wklejony tekst ze schowka)
 */
export function parseOrderText(text: string): ParsedOrderResult {
  const cleanedText = fixPolishMojibake(text);
  const headerData = extractOrderHeaderFromText(cleanedText);

  const lines = cleanedText.split(/\r?\n/).map((l) => l.trim());
  const items: Partial<InvoiceItem>[] = [];
  let foundBatchesOrExpiry = false;

  // 1. Sprawdź, czy tekst zawiera jednoliniowy układ DOZ / Hurtowni (Lp + EAN na początku wiersza + Nazwa + dane liczbowe na końcu)
  // Wzór: 1 9120117911370 Omni Biotic 10 ADD Kids, prosz., 2,5 g, 20 sasz. 323473 63 78.7 12.0 69.26
  for (const line of lines) {
    const match = line.match(/^(\d{1,3})\s+(590\d{10}|912\d{10}|\d{13}|\d{8})\s+(.+)$/);
    if (match) {
      const gtin = match[2];
      const rest = match[3].trim();
      const trailingNumsMatch = rest.match(/((?:\d+(?:[.,]\d+)?\s+)+\d+(?:[.,]\d+)?)$/);
      if (trailingNumsMatch) {
        const numsStr = trailingNumsMatch[1];
        const namePart = rest.slice(0, rest.length - numsStr.length).trim();
        const nums = numsStr.split(/\s+/).map((n) => parseFloat(n.replace(',', '.')));
        let qty = 1;
        let netPrice = 100.0;
        if (nums.length >= 5) {
          // [kodNabywcy, ilosc, cenaKatalog, rabat, cenaPoUpuscie]
          qty = nums[1] ?? 1;
          netPrice = nums[4] ?? 100.0;
        } else if (nums.length === 4) {
          // [ilosc, cenaKatalog, rabat, cenaPoUpuscie]
          qty = nums[0] ?? 1;
          netPrice = nums[3] ?? 100.0;
        } else if (nums.length === 3 || nums.length === 2) {
          qty = nums[0] ?? 1;
          netPrice = nums[1] ?? 100.0;
        }

        const cleanName = cleanProductName(namePart);
        items.push({
          name: cleanName || fixPolishMojibake(namePart),
          gtin,
          quantity: Math.round(qty),
          unit: 'SZT.',
          netPrice: isNaN(netPrice) || netPrice < 0 ? 100.0 : netPrice,
          vatRate: '8%',
          batchNumber: '',
          expiryDate: '',
        });
      }
    }
  }

  // 2. Sprawdź, czy tekst zawiera wielowierszowy układ pozycji (charakterystyczny dla PDF z systemów ERP / Dr. Max)
  // Wzór:
  // Linia 1: Lp (np. 1)
  // Linia 2: Nazwa towaru (np. OMNi-BiOTiC® Active 60 g słoik)
  // Linia 3: Ilość, VAT, ceny, EAN (np. 4 szt 8%  156,62 626,48  9120117912773)
  if (items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d{1,3}$/.test(line)) {
        const next1 = lines[i + 1] || '';
        const next2 = lines[i + 2] || '';

        if (
          next1 &&
          !/^\d{1,3}$/.test(next1) &&
          !isHeaderOrSummaryLine(next1) &&
          (next2.includes('szt') || next2.includes('op') || next2.includes('%') || next2.match(/\b\d{8,14}\b/))
        ) {
          const namePart = next1;
          const details = next2;

          const eanMatch = details.match(/\b(\d{13,14}|\d{8})\b/);
          const qtyMatch = details.match(/(\d+(?:[.,]\d+)?)\s*(?:szt|op|opak|flak|blist|sasz|kg|l)\b/i);
          const vatMatch = details.match(/(\d{1,2}%|zw\b)/i);

          let detailsWithoutEan = details;
          if (eanMatch) {
            detailsWithoutEan = details.replace(eanMatch[0], ' ');
          }

          const numbers = detailsWithoutEan.match(/\d+(?:[.,]\d{2})/g) || [];
          const rawPrice = numbers[0] ? numbers[0].replace(',', '.') : '100.00';

          let parsedVat: VatRate = '8%';
          if (vatMatch) {
            const v = vatMatch[1].toUpperCase();
            if (v === '23%' || v === '8%' || v === '5%' || v === '0%' || v === 'ZW') {
              parsedVat = v as VatRate;
            }
          }

          const batchMatch = (namePart + ' ' + details).match(/(?:Seria|LOT|Batch|Ch.-B.):\s*([A-Za-z0-9\-]+)/i);
          const expMatch = (namePart + ' ' + details).match(
            /(?:Ważność|Waznosc|Data ważności|EXP|MHD):\s*(\d{4}[-./]\d{2}[-./]\d{2}|\d{2}[-./]\d{2}[-./]\d{4}|\d{2}\/\d{4})/i
          );

          if (batchMatch || expMatch) {
            foundBatchesOrExpiry = true;
          }

          const cleanName = cleanProductName(namePart);

          items.push({
            name: cleanName || fixPolishMojibake(namePart),
            gtin: eanMatch ? eanMatch[1] : '',
            quantity: qtyMatch ? Math.round(parseFloat(qtyMatch[1].replace(',', '.'))) : 1,
            unit: 'SZT.',
            netPrice: parseFloat(rawPrice) || 100.0,
            vatRate: parsedVat,
            batchNumber: batchMatch ? batchMatch[1].trim() : '',
            expiryDate: expMatch ? expMatch[1].trim() : '',
          });

          i += 2; // pomijamy kolejne 2 przetworzone linie
        }
      }
    }
  }

  // 2. Jeśli nie wykryto układu wielowierszowego, przetwarzaj wiersz po wierszu z separatorami
  if (items.length === 0) {
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isHeaderOrSummaryLine(trimmed)) return;

      // Obsługa linii z separatorami |, tabulatorem lub numeracją wiersza
      if (trimmed.includes('|') || trimmed.includes('\t') || trimmed.match(/^\s*\d+[\.\)]/)) {
        const separator = trimmed.includes('|') ? '|' : trimmed.includes('\t') ? '\t' : '|';
        const parts = trimmed.split(separator).map((p) => p.trim());
        const namePart = parts[0]?.replace(/^\s*\d+[\.\)]\s*/, '').trim();

        if (namePart && namePart.length > 2 && !isHeaderOrSummaryLine(namePart)) {
          const eanMatch =
            trimmed.match(/(?:EAN|GTIN|Kod):\s*(\d{8,14})/i) || trimmed.match(/(\d{13,14})/);
          const blozMatch = trimmed.match(/BLOZ(?:-7)?:\s*(\d{7})/i);
          const qtyMatch =
            trimmed.match(/(?:Ilość|Ilosc|Qty|Szt):\s*(\d+)/i) ||
            trimmed.match(/(\d+)\s*(?:szt|op|opak)/i);
          const priceMatch =
            trimmed.match(/(?:Cena|Netto|PLN):\s*([\d\s]+[\.,]\d{2})/i) ||
            trimmed.match(/([\d]+[\.,]\d{2})\s*(?:zł|pln)/i);
          const vatMatch = trimmed.match(/VAT:\s*(\d{1,2}%|zw)/i) || trimmed.match(/(\d{1,2}%)/);

          const batchMatch = trimmed.match(/(?:Seria|LOT|Batch|Ch.-B.):\s*([A-Za-z0-9\-]+)/i);
          const expMatch = trimmed.match(
            /(?:Ważność|Waznosc|Data ważności|EXP|MHD):\s*(\d{4}[-./]\d{2}[-./]\d{2}|\d{2}[-./]\d{2}[-./]\d{4}|\d{2}\/\d{4})/i
          );

          if (batchMatch || expMatch) {
            foundBatchesOrExpiry = true;
          }

          const rawPrice = priceMatch
            ? priceMatch[1].replace(/\s/g, '').replace(',', '.')
            : '100.00';

          let parsedVat: VatRate = '8%';
          if (vatMatch) {
            const v = vatMatch[1].toUpperCase();
            if (v === '23%' || v === '8%' || v === '5%' || v === '0%' || v === 'ZW') {
              parsedVat = v as VatRate;
            }
          }

          const cleanName = cleanProductName(namePart);

          items.push({
            name: cleanName || fixPolishMojibake(namePart),
            gtin: eanMatch ? eanMatch[1] : '',
            bloz7: blozMatch ? blozMatch[1] : undefined,
            quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
            unit: 'SZT.',
            netPrice: parseFloat(rawPrice) || 100.0,
            vatRate: parsedVat,
            batchNumber: batchMatch ? batchMatch[1].trim() : '',
            expiryDate: expMatch ? expMatch[1].trim() : '',
          });
        }
      }
    });
  }

  return {
    items,
    headerData,
    rawText: cleanedText,
    hasBatchesOrExpiry: foundBatchesOrExpiry,
  };
}

/**
 * Parsuje plik arkusza Excel (.xlsx, .xls) zawierający zamówienie
 */
export async function parseOrderExcel(buffer: ArrayBuffer): Promise<ParsedOrderResult> {
  const workbook = XLSX.read(buffer, { type: 'array', codepage: 1250 });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Plik Excel nie zawiera żadnych arkuszy.');
  }

  let bestSheetName = workbook.SheetNames[0];
  let maxRows = 0;
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (grid.length > maxRows) {
      maxRows = grid.length;
      bestSheetName = name;
    }
  }

  const worksheet = workbook.Sheets[bestSheetName];
  const rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawGrid.length === 0) {
    throw new Error('Arkusz zamówienia jest pusty.');
  }

  const headerData: ParsedOrderData = {};
  const SELLER_NIP = '9571106742';
  let headerRowIdx = -1;
  let nameColIdx = -1;
  let eanColIdx = -1;
  let qtyColIdx = -1;
  let priceColIdx = -1;
  let vatColIdx = -1;
  let batchColIdx = -1;
  let expColIdx = -1;

  for (let r = 0; r < Math.min(rawGrid.length, 30); r++) {
    const row = rawGrid[r];
    const rowStr = row.map((c) => String(c)).join(' ');

    // Numer zamówienia
    if (!headerData.orderNumber) {
      const m = rowStr.match(/(?:zamówienie|order|po|nr zam)[^\d]*([a-z0-9\-\_\/]{4,})/i);
      if (m) headerData.orderNumber = m[1].toUpperCase();
    }
    // Data zamówienia
    if (!headerData.orderDate) {
      const m = rowStr.match(
        /(?:data zam|data złożenia|data doc|data)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
      );
      if (m) {
        const nd = normalizeDate(m[1]);
        if (nd) headerData.orderDate = nd;
      }
    }
    // Termin płatności
    if (!headerData.dueDate) {
      const m = rowStr.match(
        /(?:termin płatności|termin platnosci|płatność do|termin zapłaty)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
      );
      if (m) {
        const nd = normalizeDate(m[1]);
        if (nd) headerData.dueDate = nd;
      }
    }
    // Liczba dni płatności
    if (!headerData.paymentDays) {
      const m = rowStr.match(/(?:termin płatności|termin)[:\s]*(\d+)\s*(?:dni|days)/i);
      if (m) headerData.paymentDays = parseInt(m[1], 10);
    }
    // Data dostawy
    if (!headerData.deliveryDate) {
      const m = rowStr.match(
        /(?:data dostawy|termin dostawy|data realizacji|dostawa)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
      );
      if (m) {
        const nd = normalizeDate(m[1]);
        if (nd) headerData.deliveryDate = nd;
      }
    }
    // NIP Nabywcy
    if (!headerData.buyerNip) {
      const m = rowStr.match(/nip[:\s]*([0-9\-\s]{10,14})/i);
      if (m) {
        const n = normalizeNip(m[1]);
        if (n && n !== SELLER_NIP) headerData.buyerNip = n;
      }
    }
    // Nazwa Nabywcy
    if (!headerData.buyerName) {
      const m = rowStr.match(/(?:nabywca|kupujący|zamawiający|klient)[:\s]+([^,;\n\r]+)/i);
      if (m) {
        const name = m[1].replace(/nip:?\s*[\d\-\s]+/i, '').trim();
        if (name.length > 2 && !/^(dostawca|sprzedawca|eubiosis)/i.test(name)) {
          headerData.buyerName = name;
        }
      }
    }
    // Adres, Kod pocztowy i Miasto
    if (!headerData.buyerPostalCode || !headerData.buyerCity) {
      const m = rowStr.match(/(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/);
      if (m) {
        headerData.buyerPostalCode = m[1].trim();
        headerData.buyerCity = m[2].trim().replace(/,.*$/, '');
      }
    }
    if (!headerData.buyerAddress) {
      const m = rowStr.match(/(?:adres|ulica|ul\.)[:\s]*([^\n\r,]+(?:,\s*\d+)?)/i);
      if (m && !m[1].includes(SELLER_NIP)) {
        headerData.buyerAddress = m[1].trim();
      }
    }
    // Email
    if (!headerData.buyerEmail) {
      const m = rowStr.match(/(?:e-?mail|mail)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (m) headerData.buyerEmail = m[1].trim();
    }
    // Odbiorca
    if (!headerData.recipientName) {
      const m = rowStr.match(/(?:odbiorca|magazyn|miejsce dostawy)[:\s]+([^,;\n\r]+)/i);
      if (m && !/^(dostawca|sprzedawca|nabywca)/i.test(m[1])) {
        headerData.recipientName = m[1].trim();
      }
    }
    if (!headerData.recipientIdWew) {
      const m = rowStr.match(/(?:id-wew|id wew)[:\s]*([0-9\-]+)/i);
      if (m) headerData.recipientIdWew = m[1].trim();
    }

    // Wykrywanie wiersza nagłówka tabeli pozycji
    let matchesFound = 0;
    row.forEach((cell: any, cIdx: number) => {
      const val = String(cell).toLowerCase().trim();
      if (val.match(/nazwa|towar|produkt|artykuł|asortyment|opis|item/)) {
        nameColIdx = cIdx;
        matchesFound++;
      } else if (val.match(/ean|gtin|kod kreskowy|barkod/)) {
        eanColIdx = cIdx;
        matchesFound++;
      } else if (val.match(/ilość|ilosc|szt|qty|zamówiono|zamowiono/)) {
        qtyColIdx = cIdx;
        matchesFound++;
      } else if (val.match(/cena netto|cena|netto|cena jedn/)) {
        priceColIdx = cIdx;
        matchesFound++;
      } else if (val.match(/vat|stawka/)) {
        vatColIdx = cIdx;
        matchesFound++;
      } else if (val.match(/seria|lot|batch/)) {
        batchColIdx = cIdx;
      } else if (val.match(/ważność|waznosc|mhd|exp/)) {
        expColIdx = cIdx;
      }
    });

    if (matchesFound >= 2 && nameColIdx !== -1) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    nameColIdx = 0;
    eanColIdx = 1;
    qtyColIdx = 2;
    priceColIdx = 3;
    vatColIdx = 4;
  }

  const items: Partial<InvoiceItem>[] = [];
  let foundBatchesOrExpiry = false;

  for (let r = headerRowIdx + 1; r < rawGrid.length; r++) {
    const row = rawGrid[r];
    if (!row || row.length === 0) continue;

    const rawName = nameColIdx !== -1 && row[nameColIdx] ? String(row[nameColIdx]).trim() : '';
    if (!rawName || isHeaderOrSummaryLine(rawName)) continue;

    const rawEan =
      eanColIdx !== -1 && row[eanColIdx] ? String(row[eanColIdx]).replace(/\D/g, '') : '';
    const rawQty =
      qtyColIdx !== -1 && row[qtyColIdx]
        ? parseFloat(String(row[qtyColIdx]).replace(',', '.'))
        : 1;
    const rawPrice =
      priceColIdx !== -1 && row[priceColIdx]
        ? parseFloat(String(row[priceColIdx]).replace(',', '.').replace(/\s/g, ''))
        : 100.0;
    const rawVat = vatColIdx !== -1 && row[vatColIdx] ? String(row[vatColIdx]).trim() : '8%';

    const rawBatch = batchColIdx !== -1 && row[batchColIdx] ? String(row[batchColIdx]).trim() : '';
    const rawExp = expColIdx !== -1 && row[expColIdx] ? String(row[expColIdx]).trim() : '';

    if (rawBatch || rawExp) {
      foundBatchesOrExpiry = true;
    }

    let parsedVat: VatRate = '8%';
    if (rawVat.includes('23')) parsedVat = '23%';
    else if (rawVat.includes('5')) parsedVat = '5%';
    else if (rawVat.includes('0')) parsedVat = '0%';
    else if (rawVat.toLowerCase().includes('zw')) parsedVat = 'zw';

    items.push({
      name: cleanProductName(rawName) || rawName,
      gtin: rawEan || '9120000000000',
      quantity: isNaN(rawQty) || rawQty <= 0 ? 1 : Math.round(rawQty),
      unit: 'SZT.',
      netPrice: isNaN(rawPrice) || rawPrice < 0 ? 100.0 : rawPrice,
      vatRate: parsedVat,
      batchNumber: rawBatch,
      expiryDate: rawExp,
    });
  }

  return {
    items,
    headerData,
    hasBatchesOrExpiry: foundBatchesOrExpiry,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Główna uniwersalna funkcja do wczytywania zamówienia z dowolnego pliku (PDF, Excel, TXT, CSV)
 */
export async function parseOrderFromFile(file: File): Promise<ParsedOrderResult> {
  const lowerName = file.name.toLowerCase();
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    return parseOrderExcel(buffer);
  }

  const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
  if (isPdf) {
    const pdfBase64 = await fileToBase64(file);
    const res = await fetch('/api/parse-order-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, fileName: file.name }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Błąd serwera podczas odczytu PDF: ${res.statusText}`);
    }

    const data = await res.json();
    return parseOrderText(data.text || '');
  }

  const text = await decodeTextFile(file);
  return parseOrderText(text);
}
