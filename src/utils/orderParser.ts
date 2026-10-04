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
import { decodeArrayBufferText, decodeTextFile, fixPolishMojibake } from './textEncoding';
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

const KNOWN_NIPS = new Set([
  '9571106742', // Eubiosis
  '8943149010', // Dr. Max
  '8982182017',
  '8942998637',
  '8271807718', // DOZ
  '7282800634',
  '5252445105',
  '5272643534',
  '5213842837', // Super-Pharm
  '5252187652',
  '5252801825', // Gemini Apps Sp. z o.o.
  '5862276537', // Gemini Polska
  '5862309489',
  '5842742396',
  '9571117488',
]);

const ORDER_NUMBER_STOPWORDS = new Set([
  'hurtowe',
  'towarowe',
  'handlowe',
  'zakupu',
  'dokument',
  'dokumentu',
  'zlozone',
  'złożone',
  'klienta',
  'sklepu',
  'apteczne',
  'rachunku',
  'konta',
  'telefonu',
  'upuscie',
  'upuście',
  'rabacie',
  'data',
  'dnia',
  'strona',
  'oryginal',
  'oryginał',
  'kopia',
  'nabywca',
  'dostawca',
  'sprzedawca',
  'odbiorca',
  'zamowienie',
  'zamówienie',
  'zamowienia',
  'zamówienia',
  'wystawienia',
  'realizacji',
  'dostawy',
  'platnosci',
  'płatności',
  'wartosc',
  'wartość',
  'ilość',
  'ilosc',
  'netto',
  'brutto',
  'polska',
  'spolka',
  'spółka',
  'prosimy',
]);

/**
 * Sprawdza, czy kandydat na numer zamówienia jest prawidłowym identyfikatorem (zawiera cyfrę, nie jest datą, NIP-em, kodem pocztowym ani słowem kluczowym)
 */
function isValidOrderNumberCandidate(raw?: string): boolean {
  if (!raw) return false;
  const cleaned = raw
    .trim()
    .replace(/^[:#=\-\s]+/, '')
    .replace(/[.,;:\s]+$/, '');
  if (cleaned.length < 2 || cleaned.length > 45) return false;

  // Musi zawierać przynajmniej jedną cyfrę
  if (!/\d/.test(cleaned)) return false;

  const lower = cleaned.toLowerCase();
  if (ORDER_NUMBER_STOPWORDS.has(lower)) return false;

  // Wyklucz kwartalne oznaczenia cenników typu "2Q2026", "3Q2026"
  if (/^[1-4]q20\d{2}$/i.test(cleaned)) return false;

  // Wyklucz czyste daty YYYY-MM-DD lub DD.MM.YYYY
  if (normalizeDate(cleaned)) return false;

  // Wyklucz kody pocztowe XX-XXX
  if (/^\d{2}-\d{3}$/.test(cleaned)) return false;

  // Wyklucz stawki procentowe i kwoty z walutą
  if (/%|zł|pln/i.test(cleaned)) return false;

  // Wyklucz czyste ceny dziesiętne z przecinkiem (np. 166,30)
  if (/^\d+,\d{2}$/.test(cleaned)) return false;

  // Wyklucz 10-cyfrowe znane numery NIP oraz 13-cyfrowe kody EAN/GLN zaczynające się od 912 / 590
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length === 10 && KNOWN_NIPS.has(digitsOnly)) return false;
  if (/^(?:912|590)\d{10}$/.test(cleaned)) return false;

  // Musi składać się z dozwolonych znaków numeru zamówienia
  if (!/^[A-Za-z0-9\-\_\/\.]+$/.test(cleaned)) return false;

  return true;
}

function cleanOrderNumberCandidate(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Weź pierwszy spójny token po oczyszczeniu etykiety
  const trimmed = raw
    .trim()
    .replace(/^(?:nr\.?|numer|zam[óo]wienie(?:\s+nr\.?)?|order(?:\s+no\.?)?)[:\s#=-]*/i, '')
    .trim();
  const firstToken = trimmed.split(/\s+/)[0]?.replace(/[.,;:]+$/, '');
  if (firstToken && isValidOrderNumberCandidate(firstToken)) {
    return firstToken;
  }
  if (isValidOrderNumberCandidate(trimmed)) {
    return trimmed;
  }
  return undefined;
}

/**
 * Automatycznie i niezawodnie wykrywa sieć apteczną / grupę nabywcy (Dr. Max, DOZ, Super-Pharm, Gemini)
 * na podstawie NIP-u, nazwy firmy, adresu e-mail lub odbiorcy (Podmiot3 / GLN).
 * Wszyscy inni kontrahenci (niepasujący do 4 głównych sieci) trafiają do kategorii 'Inne'.
 */
export function detectPharmacyChain(
  buyer?: { name?: string; nip?: string; email?: string; addressLine1?: string } | null,
  thirdParty?: { name?: string; nip?: string; gln?: string; idWew?: string; addressLine1?: string } | null,
  fallbackChain?: PharmacyChain | string
): PharmacyChain {
  const cleanNip = (buyer?.nip || '').replace(/\D/g, '');
  const nameLower = (buyer?.name || '').toLowerCase();
  const emailLower = (buyer?.email || '').toLowerCase();
  const buyerAddrLower = (buyer?.addressLine1 || '').toLowerCase();
  const recipientNameLower = (thirdParty?.name || '').toLowerCase();
  const recipientAddrLower = (thirdParty?.addressLine1 || '').toLowerCase();
  const recipientGln = thirdParty?.gln || '';

  // 1. Dr. Max
  if (
    cleanNip === '8943149010' ||
    cleanNip === '8982182017' ||
    cleanNip === '8942998637' ||
    nameLower.includes('dr. max') ||
    nameLower.includes('dr.max') ||
    nameLower.includes('dr max') ||
    nameLower.includes('drmax') ||
    nameLower.includes('lekomat') ||
    emailLower.includes('drmax') ||
    recipientNameLower.includes('dr. max') ||
    recipientNameLower.includes('dr.max') ||
    recipientNameLower.includes('dr max') ||
    recipientNameLower.includes('drmax') ||
    recipientNameLower.includes('lekomat')
  ) {
    return 'Dr. Max';
  }

  // 2. DOZ (Dbam o Zdrowie)
  if (
    cleanNip === '8271807718' ||
    cleanNip === '7282800634' ||
    cleanNip === '5252445105' ||
    cleanNip === '5272643534' ||
    nameLower.includes('doz') ||
    nameLower.includes('dbam o zdrowie') ||
    nameLower.includes('d.o.z.') ||
    emailLower.includes('doz.pl') ||
    recipientNameLower.includes('doz') ||
    recipientNameLower.includes('dbam o zdrowie') ||
    recipientGln === '5909000848054' ||
    recipientGln === '5909000828476'
  ) {
    return 'DOZ';
  }

  // 3. Super-Pharm
  if (
    cleanNip === '5213842837' ||
    cleanNip === '5252187652' ||
    nameLower.includes('super-pharm') ||
    nameLower.includes('super -pharm') ||
    nameLower.includes('super pharm') ||
    nameLower.includes('superpharm') ||
    emailLower.includes('superpharm') ||
    recipientNameLower.includes('super-pharm') ||
    recipientNameLower.includes('super -pharm') ||
    recipientNameLower.includes('super pharm') ||
    recipientNameLower.includes('superpharm') ||
    recipientNameLower.includes('idl holding')
  ) {
    return 'Super-Pharm';
  }

  // 4. Gemini (Gemini Apps Sp. z o.o. NIP 5252801825 / Gemini Polska / Magazyn Azymutalna 15)
  if (
    cleanNip === '5252801825' ||
    cleanNip === '5862276537' ||
    cleanNip === '5862309489' ||
    cleanNip === '5842742396' ||
    cleanNip === '9571117488' ||
    nameLower.includes('gemini') ||
    emailLower.includes('gemini.pl') ||
    buyerAddrLower.includes('grunwaldzka 411') ||
    buyerAddrLower.includes('azymutalna 15') ||
    recipientNameLower.includes('gemini') ||
    recipientAddrLower.includes('azymutalna')
  ) {
    return 'Gemini';
  }

  // Jeśli jawnie przekazano prawidłową sieć jako fallback (nie Custom ani Inne)
  if (
    fallbackChain &&
    (fallbackChain === 'Dr. Max' ||
      fallbackChain === 'DOZ' ||
      fallbackChain === 'Super-Pharm' ||
      fallbackChain === 'Gemini')
  ) {
    return fallbackChain as PharmacyChain;
  }

  return 'Inne';
}

/**
 * Wyciąga metadane nagłówka zamówienia z tekstu dokumentu
 * (w tym pełne dane Nabywcy, Odbiorcy, Numer zamówienia oraz wszystkie daty)
 */
export function extractOrderHeaderFromText(text: string): ParsedOrderData {
  const result: ParsedOrderData = {};
  const cleaned = fixPolishMojibake(text).replace(/&nbsp;?/gi, ' ');
  const SELLER_NIP = '9571106742'; // Eubiosis Sp. z o.o.

  // 1. Numer zamówienia — wieloetapowe, odporne na układy tabelaryczne i wieloliniowe
  // 1a. Priorytet: "Zamówienie sklepu nr: C008848894" (często z dopiskiem PROSIMY PODAĆ TEN NUMER NA FAKTURZE)
  const storeOrderMatch = cleaned.match(
    /Zam[óo]wienie\s+sklepu\s+nr[:\s]+([A-Za-z0-9\-\_\/\.]{3,})/i
  );
  if (storeOrderMatch) {
    const cand = cleanOrderNumberCandidate(storeOrderMatch[1]);
    if (cand) result.orderNumber = cand;
  }

  // 1b. W tej samej linii po etykiecie "Numer zamówienia", "Nr zamówienia", "Zamówienie nr", "Nr zam"
  if (!result.orderNumber) {
    const sameLineRegex =
      /(?:Numer\s+zam[óo]wienia|Nr\.?\s+zam[óo]wienia|Zam[óo]wienie(?:\s+[a-ząćęłńóśźż]+)?\s+nr\.?|Zam[óo]wienie\s+nr\.?|Nr\.?\s+dokumentu\s+zam[óo]wienia|Order\s+No\.?|PO\s+Number|Purchase\s+Order|Nr\.?\s+zam\.?|Numer\s+zam\.?)[ \t:=-]+([^\r\n]+)/gi;
    for (const match of cleaned.matchAll(sameLineRegex)) {
      const cand = cleanOrderNumberCandidate(match[1]);
      if (cand) {
        result.orderNumber = cand;
        break;
      }
    }
  }

  // 1c. Układ wieloliniowy (etykieta "Numer zamówienia" w jednej linii, a wartość w kolejnej linii — np. PDF lub HTML)
  if (!result.orderNumber) {
    const rawLines = cleaned
      .split(/\r?\n/)
      .map((l) => l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const labelMatch = line.match(
        /(?:Numer\s+zam[óo]wienia|Nr\.?\s+zam[óo]wienia|Zam[óo]wienie\s+(?:zakupu\s+|sklepu\s+|hurtowe\s+)?nr\.?|Nr\.?\s+dokumentu\s+zam[óo]wienia|^Zam[óo]wienie\s*:?$)/i
      );
      if (labelMatch) {
        // Sprawdź najpierw resztę tej samej linii po etykiecie
        const afterLabel = line.slice((labelMatch.index || 0) + labelMatch[0].length).trim();
        const sameLineCand = cleanOrderNumberCandidate(afterLabel);
        if (sameLineCand) {
          result.orderNumber = sameLineCand;
          break;
        }
        // Sprawdź kolejną linię (lub +2 przy pustych znacznikach)
        for (let offset = 1; offset <= 2; offset++) {
          const nextLine = rawLines[i + offset];
          if (!nextLine) continue;
          const nextCand = cleanOrderNumberCandidate(nextLine);
          if (nextCand) {
            result.orderNumber = nextCand;
            break;
          }
        }
        if (result.orderNumber) break;
      }
    }
  }

  // 1d. Samodzielna linia "Zamówienie 22882/2026/KPD" lub "nr ZZ-1009/09/26"
  if (!result.orderNumber) {
    const standaloneRegex =
      /(?:^|\n)\s*(?:Zam[óo]wienie|Order|Nr\.?)\s+([A-Za-z0-9\-\_\/\.]{3,})/gi;
    for (const match of cleaned.matchAll(standaloneRegex)) {
      const cand = cleanOrderNumberCandidate(match[1]);
      if (cand) {
        result.orderNumber = cand;
        break;
      }
    }
  }

  // 2. Data złożenia / wystawienia zamówienia
  const orderDateMatch =
    cleaned.match(
      /(?:Data\s+złożenia(?:\s+zam[óo]wienia)?|Data\s+zam[óo]wienia|Data\s+zam\.?|Data\s+wystawienia(?:\s+zam[óo]wienia|\s+dokumentu)?|Data\s+dokumentu|Order\s+Date)[:\s]+(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
    ) ||
    cleaned.match(
      /(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})[\t\s]+(?:Data\s+wystawienia|Data\s+zam[óo]wienia|Data\s+złożenia|Data\s+dokumentu)/i
    );
  if (orderDateMatch) {
    const nd = normalizeDate(orderDateMatch[1]);
    if (nd) result.orderDate = nd;
  }

  // 3. Termin płatności (data)
  const dueDateMatch = cleaned.match(
    /(?:Termin\s+płatności|Termin\s+platnosci|Płatność\s+do|Platnosc\s+do|Termin\s+zapłaty|Termin\s+zaplaty|Płatność\s+do\s+dnia)[:\s]+(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
  );
  if (dueDateMatch) {
    const nd = normalizeDate(dueDateMatch[1]);
    if (nd) result.dueDate = nd;
  }

  // 4. Data dostawy / realizacji (np. "Oczekiwany termin dostawy 2026-10-05 12:00", "Data realizacji: 2026-09-30", "Data dostawy: 11/09/2026")
  const deliveryDateMatch =
    cleaned.match(
      /(?:Oczekiwany\s+termin\s+dostawy|Termin\s+dostawy|Data\s+dostawy|Termin\s+realizacji|Data\s+realizacji|Dostawa\s+do\s+dnia|Dostawa)[:\s]+(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
    ) ||
    cleaned.match(
      /(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})[\t\s]+(?:Data\s+realizacji|Termin\s+realizacji|Data\s+dostawy|Termin\s+dostawy)/i
    );
  if (deliveryDateMatch) {
    const nd = normalizeDate(deliveryDateMatch[1]);
    if (nd) result.deliveryDate = nd;
  }

  // 5. Termin płatności (dni) - np. "60 - dniowy", "30 dni", "45 dni", lub "PŁAT. 45"
  const paymentDaysMatch =
    cleaned.match(
      /(?:Oczekiwany\s+termin\s+płatności|Termin\s+płatności|Termin\s+platnosci|Płatność|Platnosc|Termin)[:\s]+(\d+)\s*[-–]?\s*(?:dniowy|dni|days|dni\s+kalendarzowych|dni\s+roboczych)/i
    ) || cleaned.match(/PŁAT\.?\s*(?:<\/B>)?\s*(?:<TD[^>]*>)?\s*(?:<B>)?\s*(\d{2})\b/i);
  if (paymentDaysMatch) {
    result.paymentDays = parseInt(paymentDaysMatch[1], 10);
    if (!result.dueDate) {
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

  // 7a. Blok "Kupujący" / "Nabywca" wielowierszowy (np. DOZ, hurtownie, Gemini)
  const kupujacySection = cleaned.match(
    /(?:Kupujący|Kupujacy|Nabywca|Zamawiający|Zamawiajacy)([\s\S]+?)(?:Sprzedawca|Dostawca|Miejsce\s+dostawy|Odbiorca|Lp\.)/i
  );
  if (kupujacySection) {
    const kText = kupujacySection[1];
    const nipM = kText.match(/NIP[:\s]*([0-9\-]{10,14})/i);
    if (nipM && !result.buyerNip) {
      const parsedNip = normalizeNip(nipM[1]);
      if (parsedNip && parsedNip !== SELLER_NIP) {
        result.buyerNip = parsedNip;
      }
    }

    const nameM = kText.match(
      /Nazwa[:\s]+([\s\S]+?)(?=(?:Ulica|Adres|Miasto|Kod|NIP|Nr|KRS|Zezwolenia|Miejsce|ILN))/i
    );
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
      /(?:Nabywca|Kupujący|Kupujacy|Zamawiający|Zamawiajacy|Klient|Fakturować\s+na|Płatnik)[^\n\r]*?(?:NIP:?|PL)?\s*([0-9\-\s]{10,14})/i
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
    const allNips = Array.from(cleaned.matchAll(/(?:NIP:?|PL)\s*([0-9\-]{10,14})|\b(\d{3}-\d{3}-\d{2}-\d{2}|\d{3}-\d{2}-\d{2}-\d{3}|\d{10})\b/gi));
    for (const match of allNips) {
      const rawCandidate = match[1] || match[2];
      const parsed = normalizeNip(rawCandidate);
      if (parsed && parsed !== SELLER_NIP && (KNOWN_NIPS.has(parsed) || match[0].toLowerCase().includes('nip'))) {
        result.buyerNip = parsed;
        break;
      }
    }
  }

  // Automatyczne rozpoznanie Gemini z treści (jeśli dokument zawiera słowa Gemini / Azymutalna 15 / Grunwaldzka 411 / gemini.pl)
  if (
    !result.buyerNip &&
    (/gemini\s*(?:apps|polska|sp\.?\s*z\s*o\.?\s*o\.?)?|apteki\s+gemini|azymutalna\s+15|grunwaldzka\s+411|@gemini\.pl/i.test(
      cleaned
    ))
  ) {
    result.buyerNip = '5252801825';
    if (!result.buyerName) {
      result.buyerName = 'GEMINI APPS SP. Z O.O.';
    }
  }

  // 8. Nazwa Nabywcy jednoliniowa
  if (!result.buyerName) {
    const buyerNameMatch = cleaned.match(
      /(?:Nabywca|Kupujący|Kupujacy|Zamawiający|Zamawiajacy|Klient|Fakturować\s+na)[:\s]+([^\n\r\|\(\)]+)/i
    );
    if (buyerNameMatch) {
      const rawName = buyerNameMatch[1]
        .replace(/NIP:?\s*[\d\-\s]+/i, '')
        .replace(/Adres:?.*$/i, '')
        .trim();
      if (
        rawName.length > 2 &&
        !/^(dostawca|sprzedawca|eubiosis|firma|nazwa)/i.test(rawName)
      ) {
        result.buyerName = rawName;
      }
    }
  }

  // 9. Adres Nabywcy, Kod i Miasto jednoliniowy
  if (!result.buyerAddress) {
    const addressMatch = cleaned.match(
      /(?:Adres|Adres\s+siedziby|Siedziba|Ulica|Ul\.)[:\s]+([^\n\r\|]+)/i
    );
    if (addressMatch) {
      const rawAddr = addressMatch[1].trim();
      if (!/nowator[óo]w/i.test(rawAddr)) {
        const postalCityMatch = rawAddr.match(
          /(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/
        );
        if (postalCityMatch) {
          if (!result.buyerPostalCode) result.buyerPostalCode = postalCityMatch[1].trim();
          if (!result.buyerCity)
            result.buyerCity = postalCityMatch[2].trim().replace(/,.*$/, '');
          const streetPart = rawAddr
            .replace(postalCityMatch[0], '')
            .replace(/^,\s*|,\s*$/g, '')
            .trim();
          if (streetPart) {
            result.buyerAddress = streetPart;
          }
        } else {
          result.buyerAddress = rawAddr;
        }
      }
    }
  }

  // Kod pocztowy i miasto jeśli nie było wyżej
  if (!result.buyerPostalCode || !result.buyerCity) {
    const postalMatch = cleaned.match(
      /(?:Kod\s+i\s+miasto|Miejscowość|Miasto)?[:\s]*(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/i
    );
    if (postalMatch && postalMatch[1] !== '80-298') {
      if (!result.buyerPostalCode) result.buyerPostalCode = postalMatch[1].trim();
      if (!result.buyerCity)
        result.buyerCity = postalMatch[2].trim().replace(/,.*$/, '').replace(/\s*NIP.*$/i, '');
    }
  }

  // 9b. Fallback dla bloków zamówień (np. Dr. Max, gdzie Nabywca/Wystawca jest na samej górze nad NIP bez etykiety 'Nabywca:')
  if (result.buyerNip && (!result.buyerName || !result.buyerAddress)) {
    const rawLines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const nipIdx = rawLines.findIndex((l) => {
      const m = l.match(/NIP[:\s]*([0-9\-]{10,13})/i);
      return m && normalizeNip(m[1]) === result.buyerNip;
    });

    if (nipIdx > 0) {
      let foundPostalIdx = -1;
      for (let j = nipIdx - 1; j >= Math.max(0, nipIdx - 4); j--) {
        const pm = rawLines[j].match(
          /^(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃa-zA-Z\s\.\-]+)/
        );
        if (pm) {
          foundPostalIdx = j;
          if (!result.buyerPostalCode) result.buyerPostalCode = pm[1].trim();
          if (!result.buyerCity)
            result.buyerCity = pm[2].trim().replace(/,.*$/, '').replace(/\s*NIP.*$/i, '');
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
    /(?:E-mail|Email|Mail|Adres\s+e-mail)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (emailMatch) {
    result.buyerEmail = emailMatch[1].trim();
  }

  // 11a. Blok "Miejsce dostawy" / "Odbiorca" wielowierszowy (np. DOZ, Super-Pharm, Gemini)
  const dostawaSection = cleaned.match(
    /(?:Miejsce\s+dostawy|Odbiorca|Magazyn\s+odbiorczy|Dostawa\s+do)([\s\S]+?)(?:Lp\.|Sprzedawca|Kupujący|Kupujacy|Nabywca|Pozycje|Data\s+dostawy)/i
  );
  if (dostawaSection) {
    const dText = dostawaSection[1];
    const ilnM = dText.match(/(?:ILN|GLN)[:\s]*(\d{13})/i);
    if (ilnM) {
      result.recipientGln = ilnM[1];
    }
    const idWewM = dText.match(/(?:ID-Wew|Identyfikator\s+wewnętrzny)[:\s]+([0-9\-]+)/i);
    if (idWewM) {
      const cleanM = idWewM[1].trim();
      if (/^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanM)) {
        result.recipientIdWew = cleanM;
      } else if (/^\d{1,13}$/.test(cleanM)) {
        result.recipientGln = cleanM;
      }
    }

    const nameM = dText.match(
      /Nazwa[:\s]+([\s\S]+?)(?=(?:Ulica|Adres|Miasto|Kod|Kraj|ILN|GLN))/i
    );
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
      /(?:Odbiorca|Miejsce\s+dostawy|Dostawa\s+do|Punkt\s+odbioru|Magazyn\s+odbiorczy)[:\s]+([^\n\r\|]+)/i
    );
    if (recipientMatch) {
      const rawRecipient = recipientMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const idWewInRecipient = rawRecipient.match(
        /(?:ID-Wew|Identyfikator\s+wewnętrzny)[:\s]+([0-9\-]+)/i
      );
      if (idWewInRecipient) {
        const cleanM = idWewInRecipient[1].trim();
        if (/^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanM)) {
          result.recipientIdWew = cleanM;
        } else if (/^\d{1,13}$/.test(cleanM)) {
          result.recipientGln = cleanM;
        }
      }

      const cleanRecipientLine = rawRecipient
        .replace(/\(?(?:ID-Wew|Identyfikator\s+wewnętrzny)[:\s]+[0-9\-]+\)?/i, '')
        .trim();
      const parts = cleanRecipientLine.split(',').map((p) => p.trim());
      if (parts.length > 0 && parts[0]) {
        result.recipientName = parts[0];
        if (parts.length > 1) {
          result.recipientAddress = parts.slice(1).join(', ').trim();
        }
      }
    }
  }

  // 12. Osobne ID-Wew jeśli nie wyciągnięte wyżej
  if (!result.recipientIdWew && !result.recipientGln) {
    const idWewMatch = cleaned.match(/(?:ID-Wew|Identyfikator\s+wewnętrzny)[:\s]+([0-9\-]+)/i);
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
export function matchOrBuildBuyerFromOrder(
  headerData?: ParsedOrderData,
  rawTextOrFallbackChain?: string | PharmacyChain
): OrderIngestionMatch {
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

  const fallbackChain: PharmacyChain | undefined =
    rawTextOrFallbackChain === 'Dr. Max' ||
    rawTextOrFallbackChain === 'DOZ' ||
    rawTextOrFallbackChain === 'Super-Pharm' ||
    rawTextOrFallbackChain === 'Gemini'
      ? rawTextOrFallbackChain
      : undefined;

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
      chain: fallbackChain || 'Custom',
      buyer:
        fallbackChain && PHARMACY_CHAINS[fallbackChain]
          ? { ...PHARMACY_CHAINS[fallbackChain].buyer }
          : defaultBuyer,
      thirdParty:
        fallbackChain && PHARMACY_CHAINS[fallbackChain]?.thirdParty
          ? { ...PHARMACY_CHAINS[fallbackChain].thirdParty! }
          : null,
      metaUpdates,
      isRecognizedChain: Boolean(fallbackChain),
      chainProfileName:
        fallbackChain && PHARMACY_CHAINS[fallbackChain]
          ? PHARMACY_CHAINS[fallbackChain].name
          : undefined,
      extractedSummary: {
        buyerName: defaultBuyer.name,
        buyerNip: defaultBuyer.nip,
        buyerAddress: defaultBuyer.addressLine1,
        datesFound,
      },
    };
  }

  // Sprawdzenie dopasowania do znanych sieci aptecznych
  // Jeśli w pliku nie było jawnego NIP-u ani nazwy nabywcy (np. sam arkusz zamówienia Gemini), użyj fallbackChain wybranego przez użytkownika
  const hasExplicitBuyerInFile = Boolean(headerData.buyerNip || headerData.buyerName);
  const detected = detectPharmacyChain(
    {
      name: headerData.buyerName,
      nip: headerData.buyerNip,
      email: headerData.buyerEmail,
      addressLine1: headerData.buyerAddress,
    },
    {
      name: headerData.recipientName,
      gln: headerData.recipientGln,
      idWew: headerData.recipientIdWew,
      addressLine1: headerData.recipientAddress,
    },
    !hasExplicitBuyerInFile ? fallbackChain : undefined
  );
  const matchedChainId: PharmacyChain | null =
    detected !== 'Inne' && detected !== 'Custom' ? detected : null;

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

    const isHeaderIdWewValid =
      headerData.recipientIdWew &&
      /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(headerData.recipientIdWew.trim());
    const effectiveIdWew = isHeaderIdWewValid
      ? headerData.recipientIdWew!.trim()
      : profile.thirdParty?.idWew;

    let thirdParty: ThirdPartyEntity | null = null;
    if (matchedChainId !== 'DOZ' && effectiveIdWew) {
      thirdParty = {
        name: headerData.recipientName || profile.thirdParty?.name || 'Odbiorca (Podmiot3)',
        countryCode: 'PL',
        addressLine1:
          headerData.recipientAddress ||
          profile.thirdParty?.addressLine1 ||
          'Aleja 20-lecia 23, 96-515 Teresin',
        postalCode: headerData.recipientPostalCode || profile.thirdParty?.postalCode || '96-515',
        city: headerData.recipientCity || profile.thirdParty?.city || 'Teresin',
        idWew: effectiveIdWew,
        role: '2',
        roleDescription: 'Odbiorca (jednostka wewnętrzna/oddział nabywcy)',
      };
    }

    if (profile.standardPaymentDays) {
      metaUpdates.paymentDays = profile.standardPaymentDays;
      const baseDateStr = metaUpdates.deliveryDate || metaUpdates.orderDate;
      const base = baseDateStr ? new Date(baseDateStr) : new Date();
      base.setDate(base.getDate() + profile.standardPaymentDays);
      metaUpdates.dueDate = base.toISOString().slice(0, 10);
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

  // Sprawdzenie Modum Pharma (Centrum Wiedzy: 60 dni)
  const cleanCustomNip = (customBuyer.nip || '').replace(/\D/g, '');
  if (cleanCustomNip === '7010955110' || (customBuyer.name || '').toLowerCase().includes('modum')) {
    metaUpdates.paymentDays = 60;
    const baseDateStr = metaUpdates.deliveryDate || metaUpdates.orderDate;
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    base.setDate(base.getDate() + 60);
    metaUpdates.dueDate = base.toISOString().slice(0, 10);
  }

  let thirdParty: ThirdPartyEntity | null = null;
  const isCustomIdWewValid =
    headerData.recipientIdWew &&
    /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(headerData.recipientIdWew.trim());
  if (headerData.recipientName && isCustomIdWewValid) {
    thirdParty = {
      name: headerData.recipientName,
      countryCode: 'PL',
      addressLine1: headerData.recipientAddress || 'ul. Magazynowa 1',
      postalCode: headerData.recipientPostalCode || '00-001',
      city: headerData.recipientCity || 'Warszawa',
      idWew: headerData.recipientIdWew!.trim(),
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
  const lower = fixPolishMojibake(lineStr).toLowerCase().trim();
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
    'łączna',
    'laczna',
    'podsumowanie',
    'nagłówek',
    'naglowek',
    'uwagi',
    'numer zamówienia',
    'nr zamówienia',
    'lp.',
    'lp ',
    'l.p.',
    'kategoria',
    'wystawił',
    'zatwierdził',
  ];

  if (headerPrefixes.some((p) => lower === p || lower.startsWith(p + ':') || lower.startsWith(p + ' '))) {
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
    lower.includes('forma platnosci') ||
    lower.includes('zamawiana ilość') ||
    lower.includes('ilość zamawiana') ||
    lower.includes('łączna ilość sztuk')
  ) {
    return true;
  }

  return false;
}

/**
 * Parsuje komórkę ilości (np. "12", "12 szt.", "6 op.", 40) do liczby dodatniej lub null (gdy pusta / niepoprawna)
 */
function parseQuantityCellValue(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return !isNaN(val) ? val : null;
  }
  const str = String(val)
    .replace(/&nbsp;?/gi, ' ')
    .trim();
  if (!str || str === '-' || str === '—') return null;

  const m = str.match(
    /^(\d+(?:[.,]\d+)?)\s*(?:szt\.?|op\.?|opak\.?|sasz\.?|słoik|kaps\.?|flak\.?|blist\.?)?$/i
  );
  if (m) {
    const num = parseFloat(m[1].replace(',', '.'));
    return !isNaN(num) ? num : null;
  }
  return null;
}

/**
 * Parsuje komórkę ceny jednostkowej netto (np. "166,30 zł", "416.99", 157.94)
 */
function parsePriceCellValue(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return !isNaN(val) && val > 0 ? val : null;
  }
  const str = String(val)
    .replace(/&nbsp;?/gi, ' ')
    .replace(/zł|pln/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim();
  if (!str) return null;
  const num = parseFloat(str);
  return !isNaN(num) && num > 0 ? num : null;
}

/**
 * Ocenia pojedynczy wiersz siatki 2D pod kątem bycia wierszem nagłówkowym tabeli produktów
 * (z najwyższym priorytetem dla kolumny "Zamawiana ilość" / "Ilość zamawiana")
 */
interface GridHeaderEvaluation {
  score: number;
  nameColIdx: number;
  namePriority: number;
  volumeColIdx: number;
  eanColIdx: number;
  blozColIdx: number;
  skuColIdx: number;
  qtyColIdx: number;
  qtyPriority: number;
  priceColIdx: number;
  pricePriority: number;
  vatColIdx: number;
  batchColIdx: number;
  expColIdx: number;
}

function evaluateGridHeaderRow(
  rawGrid: any[][],
  r: number
): GridHeaderEvaluation {
  const row = rawGrid[r] || [];
  const prevRow = r > 0 ? rawGrid[r - 1] || [] : [];

  let score = 0;
  let nameColIdx = -1;
  let namePriority = 0;
  let volumeColIdx = -1;
  let eanColIdx = -1;
  let blozColIdx = -1;
  let skuColIdx = -1;
  let qtyColIdx = -1;
  let qtyPriority = 0;
  let priceColIdx = -1;
  let pricePriority = 0;
  let vatColIdx = -1;
  let batchColIdx = -1;
  let expColIdx = -1;

  const maxCols = Math.max(row.length, prevRow.length);

  for (let cIdx = 0; cIdx < maxCols; cIdx++) {
    const rawCell = fixPolishMojibake(String(row[cIdx] ?? ''))
      .replace(/&nbsp;?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const prevCell = fixPolishMojibake(String(prevRow[cIdx] ?? ''))
      .replace(/&nbsp;?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // W arkuszach z 2-wierszowym nagłówkiem (scalone komórki powyżej) łączymy opis jeśli bieżąca komórka jest krótka lub pusta
    const val = rawCell.toLowerCase();
    const combinedVal =
      !val && prevCell.length > 0 && prevCell.length < 40
        ? prevCell.toLowerCase()
        : val;

    if (!combinedVal || combinedVal.length > 80) continue;

    // 1. KOLUMNA ILOŚCI ("Zamawiana ilość" / "Ilość zamawiana" ma najwyższy priorytet = 3!)
    const isExplicitOrderedQty =
      /zamawiana\s*ilo|ilo[^\s]*\s*zamawiana|zam[óo\?]wiona\s*ilo|ilo[^\s]*\s*zam[óo\?]wiona|ilo[^\s]*\s*do\s*zam[óo\?]wienia|\bzamawiana\b|zam[óo\?]wiono|ilo[^\s]*\s*zam\.?\b|zam\.?\s*ilo/i.test(
        val
      ) ||
      /zamawiana\s*ilo|ilo[^\s]*\s*zamawiana|zam[óo\?]wiona\s*ilo|ilo[^\s]*\s*zam[óo\?]wiona/i.test(
        `${prevCell} ${rawCell}`.toLowerCase()
      );

    const isExcludedFromQty =
      /w\s*opak|opakowanie\s*zbiorcze|karton|palet|linii|referencji|suma\s*zamawianych|dost[ęe]p|stan\s*mag|potwierdz|zrealizow|dostarcz|gratis|minimaln|moq|cena|warto|kwota|rabat/i.test(
        combinedVal
      );

    if (isExplicitOrderedQty && !/suma\s*zamawianych|warto/i.test(combinedVal)) {
      if (qtyPriority < 3) {
        qtyColIdx = cIdx;
        qtyPriority = 3;
        score += 5; // Bardzo silny sygnał wiersza nagłówkowego (np. Gemini "Zamawiana ilość")
      }
      continue;
    }

    if (!isExcludedFromQty) {
      if (
        /^(?:ilo[śs\?]*[ćc\?]*|qty|quantity)(?:\s*[\/\(]?\s*(?:szt\.?|op\.?|opak\.?|j\.?m\.?)[\)\.]?)?$/i.test(
          val
        )
      ) {
        if (qtyPriority < 2) {
          qtyColIdx = cIdx;
          qtyPriority = 2;
          score += 2;
        }
        continue;
      } else if (
        /ilo[śs\?]*[ćc\?]*|liczba\s*(?:szt|opak)|qty/i.test(val) &&
        qtyPriority < 1
      ) {
        qtyColIdx = cIdx;
        qtyPriority = 1;
        score += 1;
        continue;
      }
    }

    // 2. KOLUMNA EAN / GTIN / KOD KRESKOWY
    if (/\bean\b|\bgtin\b|kod\s*kreskowy|barkod|barcode/i.test(val)) {
      if (eanColIdx === -1) {
        eanColIdx = cIdx;
        score += 3;
      }
      continue;
    }

    // 3. KOLUMNA BLOZ
    if (/\bbloz\b/i.test(val)) {
      if (blozColIdx === -1) {
        blozColIdx = cIdx;
        score += 2;
      }
      continue;
    }

    // 4. KOLUMNA SKU / INDEKS / KOD PRODUKTU
    if (
      /^(?:sku|indeks|kod\s*produktu(?:\s*wg\s*nabywcy)?|kod\s*towaru|id\s*produktu|nr\s*art\.?)$/i.test(
        val
      )
    ) {
      if (skuColIdx === -1) {
        skuColIdx = cIdx;
        score += 1;
      }
      continue;
    }

    // 5. KOLUMNA OBJĘTOŚCI / OPAKOWANIA (np. "Objętość produktu" w Ofercie Eubiosis)
    if (
      /^(?:obj[ęe]to[śs\?]*[ćc\?]*(?:\s*produktu)?|gramatura|wielko[śs]ć\s*opakowania|posta[ćc])$/i.test(
        val
      )
    ) {
      if (volumeColIdx === -1) {
        volumeColIdx = cIdx;
        score += 1;
      }
      continue;
    }

    // 6. KOLUMNA NAZWY PRODUKTU / TOWARU
    const isExcludedFromName =
      /kod\s*produktu|indeks|kategoria|rejestracja|grupa|typ|obj[ęe]to|dostawca|nabywca|producent|zamawiana|ilo[śs\?]*[ćc\?]*|cena|warto/i.test(
        val
      );
    if (!isExcludedFromName) {
      if (
        /^(?:nazwa\s*(?:produktu|towaru|artykułu|asortymentu|leku|preparatu)|produkt|towar|asortyment|artykuł|nazwa\s*towaru\s*lub\s*usługi)$/i.test(
          val
        )
      ) {
        if (namePriority < 3) {
          nameColIdx = cIdx;
          namePriority = 3;
          score += 3;
        }
        continue;
      } else if (
        /nazwa|produkt|towar|asortyment|artykuł|opis\s*towaru|item/i.test(val) &&
        namePriority < 2
      ) {
        nameColIdx = cIdx;
        namePriority = 2;
        score += 2;
        continue;
      }
    }

    // 7. KOLUMNA CENY JEDNOSTKOWEJ NETTO
    const isExcludedFromPrice =
      /warto[śs\?]*[ćc\?]*|suma|razem|kwota|sugerowana|detaliczna|brutto|zmiana\s*ceny|rabat\s*na\s*fakturze|rabat\s*hurtowy/i.test(
        val
      );
    if (!isExcludedFromPrice) {
      if (
        /cena\s*(?:jedn\.?\s*)?netto\s*po\s*(?:upu[śs]cie|rabacie)|cena\s*po\s*(?:upu[śs]cie|rabacie)\s*netto|rabat\s*\d+%\s*netto|cena\s*zakupu.*nowa|cena\s*zakupu\s*netto/i.test(
          val
        )
      ) {
        if (pricePriority < 4) {
          priceColIdx = cIdx;
          pricePriority = 4;
          score += 3;
        }
        continue;
      } else if (
        /^(?:cena\s*(?:jedn(?:ostkowa)?\.?\s*)?netto(?:\s*\(?pln\)?|\s*zł)?|cena\s*jedn\.?)$/i.test(
          val
        )
      ) {
        if (pricePriority < 3) {
          priceColIdx = cIdx;
          pricePriority = 3;
          score += 3;
        }
        continue;
      } else if (/cena.*netto|netto.*cena/i.test(val)) {
        if (pricePriority < 2) {
          priceColIdx = cIdx;
          pricePriority = 2;
          score += 2;
        }
        continue;
      } else if (/^cena(?:\s*pln|\s*zł)?$/i.test(val) && pricePriority < 1) {
        priceColIdx = cIdx;
        pricePriority = 1;
        score += 1;
        continue;
      }
    }

    // 8. KOLUMNA STAWKI VAT
    if (
      /^(?:vat|stawka\s*vat|stawka\s*podatku|podatek\s*vat|vat\s*\[%\])$/i.test(val) &&
      vatColIdx === -1
    ) {
      vatColIdx = cIdx;
      score += 1;
      continue;
    }

    // 9. KOLUMNA SERII (LOT) I DATY WAŻNOŚCI (MHD)
    if (/\b(?:seria|lot|batch|nr\s*serii)\b/i.test(val) && batchColIdx === -1) {
      batchColIdx = cIdx;
      score += 1;
      continue;
    }
    if (/\b(?:ważność|waznosc|data\s*ważności|mhd|exp)\b/i.test(val) && expColIdx === -1) {
      expColIdx = cIdx;
      score += 1;
      continue;
    }
  }

  return {
    score,
    nameColIdx,
    namePriority,
    volumeColIdx,
    eanColIdx,
    blozColIdx,
    skuColIdx,
    qtyColIdx,
    qtyPriority,
    priceColIdx,
    pricePriority,
    vatColIdx,
    batchColIdx,
    expColIdx,
  };
}

/**
 * Uniwersalny parser siatki 2D (obsługuje arkusze Excel .xlsx/.xls, tabele HTML oraz pliki CSV/TSV)
 * Wyciąga miejsce z numerem zamówienia oraz kolumnę "Zamawiana ilość"
 */
export function parseOrderGrid(rawGrid: any[][], fileName?: string): ParsedOrderResult {
  // 1. Zbuduj tekst pomocniczy z siatki, aby wyciągnąć nagłówek bazowy
  const gridLinesText = rawGrid
    .slice(0, 60)
    .map((r) =>
      (r || [])
        .map((c) => fixPolishMojibake(String(c ?? '')).replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('   ')
    )
    .filter(Boolean)
    .join('\n');

  const headerData: ParsedOrderData = extractOrderHeaderFromText(gridLinesText);
  const SELLER_NIP = '9571106742';

  // 2. Precyzyjne skanowanie komórka po komórce dla "Numer zamówienia", dat oraz danych nabywcy
  // (obsługuje wartość w tej samej komórce, w sąsiedniej komórce po prawej po scaleniu, lub w komórce poniżej!)
  for (let r = 0; r < Math.min(rawGrid.length, 60); r++) {
    const row = rawGrid[r] || [];
    const rowStr = row
      .map((c) => fixPolishMojibake(String(c ?? '')).trim())
      .filter(Boolean)
      .join(' ');

    for (let c = 0; c < row.length; c++) {
      const cellStr = fixPolishMojibake(String(row[c] ?? ''))
        .replace(/&nbsp;?/gi, ' ')
        .trim();
      if (!cellStr) continue;

      // A) MIEJSCE Z NUMEREM ZAMÓWIENIA
      if (
        /(?:numer\s+zam[óo\?]wienia|nr\.?\s*zam[óo\?]wienia|zam[óo\?]wienie\s*(?:zakupu|sklepu|hurtowe|handlowe)?\s*nr\.?|nr\.?\s*dokumentu\s*zam[óo\?]wienia|^zam[óo\?]wienie\s*:?$|^nr\.?\s*zam\.?\s*:?$|^numer\s*zam\.?\s*:?$|^order\s*(?:no|number|#)?\s*:?$)/i.test(
          cellStr
        )
      ) {
        const isHighPriorityStoreNum = /zam[óo\?]wienie\s+sklepu\s+nr/i.test(cellStr);
        if (!headerData.orderNumber || isHighPriorityStoreNum) {
          // 1) Sprawdź w tej samej komórce po dwukropku / "nr" / nowej linii
          const afterLabelMatch = cellStr.match(
            /(?:numer\s+zam[óo\?]wienia|nr\.?\s*zam[óo\?]wienia|zam[óo\?]wienie\s*(?:zakupu|sklepu|hurtowe|handlowe)?\s*nr\.?|nr\.?\s*dokumentu\s*zam[óo\?]wienia|^zam[óo\?]wienie|^nr\.?\s*zam\.?|^numer\s*zam\.?|^order\s*(?:no|number|#)?)[:\s#=-]+([A-Za-z0-9\-\_\/\.]{2,})/i
          );
          if (afterLabelMatch) {
            const cand = cleanOrderNumberCandidate(afterLabelMatch[1]);
            if (cand) {
              headerData.orderNumber = cand;
            }
          }

          // 2) Jeśli nie ma w tej samej komórce, sprawdź sąsiednie komórki w prawo (c+1 .. c+6, omijając puste scalone komórki)
          if (!headerData.orderNumber || isHighPriorityStoreNum) {
            for (let adjC = c + 1; adjC <= Math.min(row.length - 1, c + 6); adjC++) {
              const adjVal = fixPolishMojibake(String(row[adjC] ?? '')).trim();
              if (!adjVal) continue;
              // Jeśli trafiliśmy na kolejną etykietę (np. "Data zamówienia"), przerwij szukanie w prawo
              if (/^(?:data|termin|dostawca|nabywca|zamawiający|odbiorca|uwagi)/i.test(adjVal)) {
                break;
              }
              const cand = cleanOrderNumberCandidate(adjVal);
              if (cand) {
                headerData.orderNumber = cand;
                break;
              }
            }
          }

          // 3) Jeśli nadal nie znaleziono, sprawdź komórkę bezpośrednio pod etykietą (r+1, c) lub (r+1, c+1)
          if (!headerData.orderNumber) {
            for (let belowR = r + 1; belowR <= Math.min(rawGrid.length - 1, r + 2); belowR++) {
              for (let belowC = c; belowC <= c + 1; belowC++) {
                const belowVal = fixPolishMojibake(
                  String(rawGrid[belowR]?.[belowC] ?? '')
                ).trim();
                if (!belowVal) continue;
                const cand = cleanOrderNumberCandidate(belowVal);
                if (cand) {
                  headerData.orderNumber = cand;
                  break;
                }
              }
              if (headerData.orderNumber) break;
            }
          }
        }
      }

      // B) Samodzielna komórka typu "Zamówienie 22882/2026/KPD" lub "Zamówienie: GEM/123"
      if (!headerData.orderNumber) {
        const singleCellOrder = cellStr.match(
          /^(?:zam[óo\?]wienie|zam\.?|order)[:\s]+([A-Za-z0-9\-\_\/\.]{3,})$/i
        );
        if (singleCellOrder) {
          const cand = cleanOrderNumberCandidate(singleCellOrder[1]);
          if (cand) headerData.orderNumber = cand;
        }
      }

      // C) Data zamówienia w sąsiedniej komórce lub poniżej
      if (!headerData.orderDate && /^(?:data\s*zam[óo\?]wienia|data\s*wystawienia|data\s*złożenia|data\s*dokumentu)\s*:?$/i.test(cellStr)) {
        for (let adjC = c + 1; adjC <= Math.min(row.length - 1, c + 4); adjC++) {
          const nd = normalizeDate(String(row[adjC] ?? '').trim());
          if (nd) {
            headerData.orderDate = nd;
            break;
          }
        }
        if (!headerData.orderDate && rawGrid[r + 1]?.[c]) {
          const nd = normalizeDate(String(rawGrid[r + 1][c]).trim());
          if (nd) headerData.orderDate = nd;
        }
      }

      // D) Data dostawy / realizacji w sąsiedniej komórce lub poniżej
      if (!headerData.deliveryDate && /^(?:data\s*dostawy|termin\s*dostawy|data\s*realizacji|termin\s*realizacji|oczekiwany\s*termin\s*dostawy)\s*:?$/i.test(cellStr)) {
        for (let adjC = c + 1; adjC <= Math.min(row.length - 1, c + 4); adjC++) {
          const rawD = String(row[adjC] ?? '').trim().split(/\s+/)[0];
          const nd = normalizeDate(rawD);
          if (nd) {
            headerData.deliveryDate = nd;
            break;
          }
        }
        if (!headerData.deliveryDate && rawGrid[r + 1]?.[c]) {
          const rawD = String(rawGrid[r + 1][c]).trim().split(/\s+/)[0];
          const nd = normalizeDate(rawD);
          if (nd) headerData.deliveryDate = nd;
        }
      }

      // E) Rozpoznanie Gemini bezpośrednio z komórki
      if (
        !headerData.buyerNip &&
        /gemini\s*(?:apps|polska|sp\.?\s*z\s*o\.?\s*o\.?)|apteki\s+gemini|azymutalna\s+15|grunwaldzka\s+411|@gemini\.pl/i.test(
          cellStr
        )
      ) {
        headerData.buyerNip = '5252801825';
        if (!headerData.buyerName) headerData.buyerName = 'GEMINI APPS SP. Z O.O.';
      }
    }

    // Uzupełniające dopasowania na poziomie wiersza
    if (!headerData.orderDate) {
      const m = rowStr.match(
        /(?:data\s*zam|data\s*złożenia|data\s*wystawienia|data\s*doc)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
      );
      if (m) {
        const nd = normalizeDate(m[1]);
        if (nd) headerData.orderDate = nd;
      }
    }
    if (!headerData.deliveryDate) {
      const m = rowStr.match(
        /(?:data\s*dostawy|termin\s*dostawy|data\s*realizacji|dostawa)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
      );
      if (m) {
        const nd = normalizeDate(m[1]);
        if (nd) headerData.deliveryDate = nd;
      }
    }
    if (!headerData.buyerNip) {
      const m = rowStr.match(/nip[:\s]*([0-9\-\s]{10,14})/i);
      if (m) {
        const n = normalizeNip(m[1]);
        if (n && n !== SELLER_NIP) headerData.buyerNip = n;
      }
    }
  }

  // Jeśli nazwa pliku wskazuje na Gemini lub zawiera numer zamówienia (jako fallback)
  if (fileName) {
    if (!headerData.buyerNip && /gemini/i.test(fileName)) {
      headerData.buyerNip = '5252801825';
      if (!headerData.buyerName) headerData.buyerName = 'GEMINI APPS SP. Z O.O.';
    }
    if (!headerData.orderNumber) {
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const fnOrderMatch =
        baseName.match(/(?:zam[óo]?wienie|zam|order|gem)[_\-\s]+([A-Za-z0-9\-\_\/]{3,})/i) ||
        baseName.match(/\b([A-Z]{1,4}[-_\/]\d{2,}[A-Za-z0-9\-_\/]*)\b/i);
      if (fnOrderMatch) {
        const cand = cleanOrderNumberCandidate(fnOrderMatch[1]);
        if (cand) headerData.orderNumber = cand;
      }
    }
  }

  // 3. Wybór najlepszego wiersza nagłówkowego tabeli pozycji
  let bestHeaderRowIdx = -1;
  let bestEval: GridHeaderEvaluation | null = null;

  for (let r = 0; r < Math.min(rawGrid.length, 80); r++) {
    const ev = evaluateGridHeaderRow(rawGrid, r);
    const hasCoreColumns =
      ev.nameColIdx !== -1 || (ev.eanColIdx !== -1 && ev.qtyColIdx !== -1);
    if (hasCoreColumns && ev.score >= 3) {
      if (!bestEval || ev.score > bestEval.score) {
        bestEval = ev;
        bestHeaderRowIdx = r;
      }
    }
  }

  let headerRowIdx = bestHeaderRowIdx;
  let nameColIdx = bestEval?.nameColIdx ?? -1;
  let volumeColIdx = bestEval?.volumeColIdx ?? -1;
  let eanColIdx = bestEval?.eanColIdx ?? -1;
  let blozColIdx = bestEval?.blozColIdx ?? -1;
  let qtyColIdx = bestEval?.qtyColIdx ?? -1;
  let priceColIdx = bestEval?.priceColIdx ?? -1;
  let vatColIdx = bestEval?.vatColIdx ?? -1;
  let batchColIdx = bestEval?.batchColIdx ?? -1;
  let expColIdx = bestEval?.expColIdx ?? -1;

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    nameColIdx = 0;
    eanColIdx = 1;
    qtyColIdx = 2;
    priceColIdx = 3;
    vatColIdx = 4;
  } else {
    // Sprawdź, czy w wierszu bezpośrednio pod nagłówkiem (headerRowIdx + 1) nie znajduje się doprecyzowanie "Zamawiana ilość"
    if (qtyColIdx === -1 && headerRowIdx + 1 < rawGrid.length) {
      const subRow = rawGrid[headerRowIdx + 1] || [];
      subRow.forEach((cell: any, cIdx: number) => {
        const v = fixPolishMojibake(String(cell ?? '')).toLowerCase().trim();
        if (/zamawiana\s*ilo|ilo[^\s]*\s*zamawiana|^ilo[śs\?]*[ćc\?]*$/i.test(v)) {
          qtyColIdx = cIdx;
        }
      });
    }

    // Zabezpieczenie na wypadek scalonych komórek nagłówka w Excelu:
    // Jeśli w wyznaczonej kolumnie qtyColIdx wszystkie wiersze danych są puste lub tekstowe (np. "szt."),
    // a w sąsiedniej kolumnie (qtyColIdx + 1 lub qtyColIdx - 1) znajdują się liczby całkowite (zamawiana ilość),
    // automatycznie przesuń qtyColIdx na właściwą kolumnę z liczbami!
    if (qtyColIdx !== -1) {
      const usedCols = new Set(
        [nameColIdx, volumeColIdx, eanColIdx, blozColIdx, priceColIdx, vatColIdx].filter(
          (idx) => idx !== -1
        )
      );

      let validCountInCurrent = 0;
      for (let r = headerRowIdx + 1; r < rawGrid.length; r++) {
        const q = parseQuantityCellValue(rawGrid[r]?.[qtyColIdx]);
        if (q !== null && q > 0) validCountInCurrent++;
      }

      if (validCountInCurrent === 0) {
        for (const candidateCol of [qtyColIdx + 1, qtyColIdx - 1]) {
          if (candidateCol < 0 || usedCols.has(candidateCol)) continue;
          let validCountInAdj = 0;
          for (let r = headerRowIdx + 1; r < rawGrid.length; r++) {
            const q = parseQuantityCellValue(rawGrid[r]?.[candidateCol]);
            if (q !== null && q > 0) validCountInAdj++;
          }
          if (validCountInAdj > 0) {
            qtyColIdx = candidateCol;
            break;
          }
        }
      }
    }
  }

  // 4. Odczyt wierszy pozycji towarowych
  interface RawParsedRow {
    item: Partial<InvoiceItem>;
    explicitQty: number | null;
  }

  const candidateRows: RawParsedRow[] = [];
  let foundBatchesOrExpiry = false;

  for (let r = headerRowIdx + 1; r < rawGrid.length; r++) {
    const row = rawGrid[r];
    if (!row || row.length === 0) continue;

    let rawName =
      nameColIdx !== -1 && row[nameColIdx] !== undefined
        ? fixPolishMojibake(String(row[nameColIdx])).replace(/&nbsp;?/gi, ' ').trim()
        : '';

    const rawVolume =
      volumeColIdx !== -1 &&
      volumeColIdx !== nameColIdx &&
      row[volumeColIdx] !== undefined
        ? fixPolishMojibake(String(row[volumeColIdx])).replace(/&nbsp;?/gi, ' ').trim()
        : '';

    const rawEan =
      eanColIdx !== -1 && row[eanColIdx] !== undefined
        ? String(row[eanColIdx]).replace(/\D/g, '')
        : '';

    const rawBloz =
      blozColIdx !== -1 && row[blozColIdx] !== undefined
        ? String(row[blozColIdx]).replace(/\D/g, '')
        : '';

    if (!rawName && !rawEan) continue;
    if (rawName && isHeaderOrSummaryLine(rawName)) continue;

    // Pomijaj wiersze podsumowania (np. gdy w kolumnie przed nazwą jest "Razem:" lub "Łączna ilość sztuk:")
    const entireRowLower = row
      .map((c) => fixPolishMojibake(String(c ?? '')).toLowerCase())
      .join(' ');
    if (
      /\b(?:razem|podsumowanie|łączna\s+ilość\s+sztuk|wartość\s+zamówienia|suma\s+zamawianych)\b/i.test(
        entireRowLower
      ) &&
      !rawEan
    ) {
      continue;
    }

    if (rawVolume && rawName && !rawName.toLowerCase().includes(rawVolume.toLowerCase())) {
      rawName = `${rawName} ${rawVolume}`.trim();
    }

    const explicitQty = qtyColIdx !== -1 ? parseQuantityCellValue(row[qtyColIdx]) : null;
    const parsedPrice = priceColIdx !== -1 ? parsePriceCellValue(row[priceColIdx]) : null;
    const rawVat =
      vatColIdx !== -1 && row[vatColIdx] !== undefined ? String(row[vatColIdx]).trim() : '8%';

    const rawBatch =
      batchColIdx !== -1 && row[batchColIdx] !== undefined
        ? String(row[batchColIdx]).trim()
        : '';
    const rawExp =
      expColIdx !== -1 && row[expColIdx] !== undefined ? String(row[expColIdx]).trim() : '';

    if (rawBatch || rawExp) {
      foundBatchesOrExpiry = true;
    }

    let parsedVat: VatRate = '8%';
    if (rawVat.includes('23') || rawVat === '0.23') parsedVat = '23%';
    else if (rawVat.includes('8') || rawVat === '0.08') parsedVat = '8%';
    else if (rawVat.includes('5') || rawVat === '0.05') parsedVat = '5%';
    else if (rawVat === '0%' || rawVat === '0') parsedVat = '0%';
    else if (rawVat.toLowerCase().includes('zw')) parsedVat = 'zw';

    // Sprawdź, czy wiersz ma cechy realnego produktu (np. prawidłowy EAN lub niepustą nazwę i cenę/ilość)
    const hasValidEan = rawEan.length >= 8 && rawEan.length <= 14;
    if (!hasValidEan && (!rawName || rawName.length < 3)) continue;
    if (!hasValidEan && parsedPrice === null && explicitQty === null) continue;

    candidateRows.push({
      explicitQty,
      item: {
        name: cleanProductName(rawName) || rawName || `Produkt EAN ${rawEan}`,
        gtin: hasValidEan ? rawEan : '9120000000000',
        bloz7: rawBloz.length === 7 ? rawBloz : undefined,
        quantity: explicitQty !== null && explicitQty > 0 ? Math.round(explicitQty) : 1,
        unit: 'SZT.',
        netPrice: parsedPrice !== null ? Math.round(parsedPrice * 100) / 100 : 100.0,
        vatRate: parsedVat,
        batchNumber: rawBatch,
        expiryDate: rawExp,
      },
    });
  }

  // Jeśli w tabeli występują wiersze z jawnie wpisaną dodatnią ilością w kolumnie "Zamawiana ilość"
  // (np. formularz zamówienia Gemini z wypełnionymi tylko zamawianymi pozycjami),
  // filtrujemy tylko pozycje faktycznie zamówione (explicitQty > 0)!
  const rowsWithPositiveQty = candidateRows.filter(
    (r) => r.explicitQty !== null && r.explicitQty > 0
  );
  const finalItems =
    rowsWithPositiveQty.length > 0
      ? rowsWithPositiveQty.map((r) => r.item)
      : candidateRows.map((r) => r.item);

  return {
    items: finalItems,
    headerData,
    rawText: gridLinesText,
    hasBatchesOrExpiry: foundBatchesOrExpiry,
  };
}

/**
 * Parsuje zamówienie zapisane jako tabela HTML (np. eksport z systemu ERP / .html / .xls będący tabelą HTML)
 */
export function parseOrderHtml(htmlText: string, fileName?: string): ParsedOrderResult {
  const cleanedHtml = fixPolishMojibake(htmlText);
  const plainText = cleanedHtml
    .replace(/&nbsp;?/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:td|th|tr|p|div|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');

  const headerFromText = extractOrderHeaderFromText(plainText);

  // Wyciągnij wiersze <tr>...</tr> i komórki <td>/<th> do siatki 2D
  // Dopasowujemy najbardziej wewnętrzne wiersze <tr> (niezawierające zagnieżdżonych <tr ani <table),
  // dzięki czemu niedomknięty zewnętrzny <TR> w eksporcie ERP nigdy nie połknie wiersza nagłówkowego tabeli!
  const rawGrid: string[][] = [];
  const trMatches =
    cleanedHtml.match(/<tr\b[^>]*>(?:(?!<tr\b|<table\b)[\s\S])*?<\/tr>/gi) || [];

  for (const trHtml of trMatches) {
    // Pomijaj zewnętrzne wiersze-kontenery zawierające zagnieżdżone tabele
    const innerContent = trHtml.replace(/^<tr[^>]*>|<\/tr>$/gi, '');
    if (/<table/i.test(innerContent)) continue;

    const cellMatches =
      innerContent.match(
        /<t[dh]\b[^>]*>(?:(?!<t[dh]\b|<tr\b|<table\b)[\s\S])*?<\/t[dh]>/gi
      ) || [];
    if (cellMatches.length === 0) continue;

    const rowCells = cellMatches.map((cellHtml) =>
      cellHtml
        .replace(/&nbsp;?/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );

    if (rowCells.some((c) => c.length > 0)) {
      rawGrid.push(rowCells);
    }
  }

  if (rawGrid.length > 0) {
    const gridResult = parseOrderGrid(rawGrid, fileName);
    const mergedHeader: ParsedOrderData = {
      ...headerFromText,
      ...gridResult.headerData,
      orderNumber: gridResult.headerData?.orderNumber || headerFromText.orderNumber,
      buyerNip: gridResult.headerData?.buyerNip || headerFromText.buyerNip,
      buyerName: gridResult.headerData?.buyerName || headerFromText.buyerName,
    };
    if (gridResult.items.length > 0) {
      return {
        items: gridResult.items,
        headerData: mergedHeader,
        rawText: plainText,
        hasBatchesOrExpiry: gridResult.hasBatchesOrExpiry,
      };
    }
  }

  return parseOrderText(plainText);
}

/**
 * Wyciąga ilość ("Zamawiana ilość") oraz cenę jednostkową netto z ciągu liczb na końcu wiersza pozycji
 */
function extractQtyAndPriceFromNumbers(
  nums: number[],
  rawTokens: string[],
  priceBeforeQtyInHeader: boolean
): { qty: number; netPrice: number } {
  let qty = 1;
  let netPrice = 100.0;

  // 0. Matematyczna weryfikacja iloczynu: Zamawiana ilość * Cena netto == Wartość netto pozycji
  // (niezawodnie odróżnia kolumnę "Zamawiana ilość" od "Ilość w opakowaniu", rabatu czy kodu SKU)
  if (nums.length >= 3) {
    for (let t = nums.length - 1; t >= 2; t--) {
      const totalCandidate = nums[t];
      if (totalCandidate <= 0) continue;
      for (let i = 0; i < t; i++) {
        for (let j = i + 1; j < t; j++) {
          const a = nums[i];
          const b = nums[j];
          if (a <= 0 || b <= 0) continue;
          const prod = a * b;
          if (Math.abs(prod - totalCandidate) <= Math.max(0.15, totalCandidate * 0.005)) {
            const aIsInt = Number.isInteger(a) && !/[.,]\d{2}$/.test(rawTokens[i] || '');
            const bIsInt = Number.isInteger(b) && !/[.,]\d{2}$/.test(rawTokens[j] || '');
            if (aIsInt && !bIsInt && a < 10000) {
              return { qty: Math.max(1, Math.round(a)), netPrice: b };
            }
            if (bIsInt && !aIsInt && b < 10000) {
              return { qty: Math.max(1, Math.round(b)), netPrice: a };
            }
            if (Number.isInteger(a) && Number.isInteger(b)) {
              return priceBeforeQtyInHeader
                ? { qty: Math.max(1, Math.round(b)), netPrice: a }
                : { qty: Math.max(1, Math.round(a)), netPrice: b };
            }
          }
        }
      }
    }
  }

  if (nums.length >= 5) {
    // Układ DOZ: [kodNabywcy, zamawianaIlosc, cenaBezUpustu, rabat, cenaPoUpuscie]
    if (nums[0] >= 1000 && Number.isInteger(nums[1])) {
      qty = nums[1];
      netPrice = nums[4];
      return { qty: Math.max(1, Math.round(qty)), netPrice };
    }
    // Układ: [zamawianaIlosc, cenaBezUpustu, rabat, cenaPoUpuscie, wartoscNetto]
    if (
      Number.isInteger(nums[0]) &&
      nums[3] > 0 &&
      Math.abs(nums[0] * nums[3] - nums[4]) <= Math.max(1.5, nums[4] * 0.02)
    ) {
      return { qty: Math.max(1, Math.round(nums[0])), netPrice: nums[3] };
    }
    // Układ: [zamawianaIlosc, cenaNetto, stawkaVat, wartoscNetto, wartoscBrutto]
    if (
      Number.isInteger(nums[0]) &&
      nums[1] > 0 &&
      Math.abs(nums[0] * nums[1] - nums[3]) <= Math.max(1.5, nums[3] * 0.02)
    ) {
      return { qty: Math.max(1, Math.round(nums[0])), netPrice: nums[1] };
    }
    qty = nums[1] ?? 1;
    netPrice = nums[4] ?? 100.0;
  } else if (nums.length === 4) {
    // Sprawdź czy pierwszy element to 5-7 cyfrowy kod produktu/BLOZ: [kod, ilosc, cenaNetto, wartoscNetto]
    if (nums[0] >= 10000 && Number.isInteger(nums[1]) && nums[2] > 0) {
      return { qty: Math.max(1, Math.round(nums[1])), netPrice: nums[2] };
    }
    // Sprawdź czy [ilosc, cenaNetto, wartoscNetto, wartoscBrutto]
    if (
      Number.isInteger(nums[0]) &&
      nums[1] > 0 &&
      Math.abs(nums[0] * nums[1] - nums[2]) <= Math.max(1.5, nums[2] * 0.02)
    ) {
      return { qty: Math.max(1, Math.round(nums[0])), netPrice: nums[1] };
    }
    // Domyślny układ 4 liczb: [ilosc, cenaKatalog, rabat, cenaPoUpuscie]
    qty = nums[0] ?? 1;
    netPrice = nums[3] ?? 100.0;
  } else if (nums.length === 3) {
    // 1) Jeśli pierwszy element to kod SKU/BLOZ (>= 10000): [sku, zamawianaIlosc, cenaNetto]
    if (nums[0] >= 10000 && Number.isInteger(nums[1])) {
      return { qty: Math.max(1, Math.round(nums[1])), netPrice: nums[2] };
    }
    // 2) Jeśli iloczyn pierwszych dwóch daje trzecią liczbę (wartość netto): [ilosc, cena] lub [cena, ilosc]
    if (Math.abs(nums[0] * nums[1] - nums[2]) <= Math.max(1.5, nums[2] * 0.02)) {
      const firstHasDecimals = /[.,]\d{2}$/.test(rawTokens[0] || '');
      const secondHasDecimals = /[.,]\d{2}$/.test(rawTokens[1] || '');
      if (
        (priceBeforeQtyInHeader || (firstHasDecimals && !secondHasDecimals)) &&
        Number.isInteger(nums[1])
      ) {
        return { qty: Math.max(1, Math.round(nums[1])), netPrice: nums[0] };
      }
      return { qty: Math.max(1, Math.round(nums[0])), netPrice: nums[1] };
    }
    qty = nums[0] ?? 1;
    netPrice = nums[1] ?? 100.0;
  } else if (nums.length === 2) {
    const firstHasDecimals = /[.,]\d{2}$/.test(rawTokens[0] || '');
    const secondHasDecimals = /[.,]\d{2}$/.test(rawTokens[1] || '');
    if (
      (priceBeforeQtyInHeader || (firstHasDecimals && !secondHasDecimals)) &&
      Number.isInteger(nums[1])
    ) {
      qty = nums[1];
      netPrice = nums[0];
    } else {
      qty = nums[0];
      netPrice = nums[1];
    }
  } else if (nums.length === 1) {
    const hasDecimals = /[.,]\d{2}$/.test(rawTokens[0] || '');
    if (hasDecimals) {
      netPrice = nums[0];
    } else {
      qty = nums[0];
    }
  }

  return {
    qty: isNaN(qty) || qty <= 0 ? 1 : Math.round(qty),
    netPrice: isNaN(netPrice) || netPrice <= 0 ? 100.0 : netPrice,
  };
}

/**
 * Parsuje treść tekstową zamówienia (PDF, TXT, CSV, HTML, wklejony tekst ze schowka)
 */
export function parseOrderText(text: string): ParsedOrderResult {
  const cleanedText = fixPolishMojibake(text);

  // 0. Jeśli tekst zawiera strukturę tabeli HTML (<table ... <td), użyj dedykowanego parsera HTML
  if (/<table[\s>]/i.test(cleanedText) && /<t[dh][\s>]/i.test(cleanedText)) {
    return parseOrderHtml(cleanedText);
  }

  const headerData = extractOrderHeaderFromText(cleanedText);
  const rawLines = cleanedText.split(/\r?\n/);
  const lines = rawLines.map((l) => l.trim());
  const items: Partial<InvoiceItem>[] = [];
  let foundBatchesOrExpiry = false;

  // Sprawdź, czy w nagłówku tabeli "Cena" występuje przed "Zamawiana ilość" / "Ilość"
  const priceBeforeQtyInHeader =
    /cena\s*(?:jedn\.?\s*)?netto[^\r\n]*?(?:zamawiana\s*ilo[śs]ć|ilo[śs]ć\s*zamawiana|\bilo[śs]ć\b)/i.test(
      cleanedText
    );

  // 0b. Jeśli tekst jest tabelą rozdzielaną średnikami (;), tabulatorami (\t) lub pionowymi kreskami (|) z wierszem nagłówkowym (np. CSV / TSV / tabela z PDF)
  const delimitedLines = rawLines.filter(
    (l) =>
      (l.includes(';') && l.split(';').length >= 3) ||
      (l.includes('\t') && l.split('\t').length >= 4) ||
      (l.includes('|') && l.split('|').length >= 4 && !/GTIN:|Ilość:|Cena:/i.test(l))
  );
  if (delimitedLines.length >= 2) {
    const sep = delimitedLines[0].includes(';')
      ? ';'
      : delimitedLines[0].includes('\t')
      ? '\t'
      : '|';
    const grid = rawLines
      .map((l) => l.split(sep).map((c) => c.trim()))
      .filter((r) => r.some(Boolean));
    const gridEval = parseOrderGrid(grid);
    if (gridEval.items.length > 0 && gridEval.items.some((it) => it.gtin !== '9120000000000' || (it.quantity && it.quantity > 1))) {
      return {
        items: gridEval.items,
        headerData: {
          ...headerData,
          ...gridEval.headerData,
          orderNumber: gridEval.headerData?.orderNumber || headerData.orderNumber,
          buyerNip: gridEval.headerData?.buyerNip || headerData.buyerNip,
        },
        rawText: cleanedText,
        hasBatchesOrExpiry: gridEval.hasBatchesOrExpiry,
      };
    }
  }

  // 1A. Jednoliniowy układ tabelaryczny: Lp + EAN na początku wiersza + Nazwa + liczby (np. DOZ, Gemini, hurtownie)
  // Wzór: 1 9120117911370 Omni Biotic 10 ADD Kids, prosz., 2,5 g, 20 sasz. 323473 63 78.7 12.0 69.26
  // Lub: 1. 9120117912711 230078 OMNI-BIOTIC 6 60 SASZ. X 3 G 6 416.99
  for (const line of lines) {
    const match = line.match(
      /^(\d{1,3})[.)]?\s+(590\d{10}|912\d{10}|\d{13}|\d{8})\s+(?:(\d{5,7})\s+)?(.+)$/
    );
    if (match) {
      const gtin = match[2];
      const optionalLeadingSku = match[3];
      const rest = match[4]
        .replace(/\b(?:szt\.?|op\.?|opak\.?|SZT\.?)\b/gi, ' ')
        .replace(/\b\d{1,2}%\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const trailingNumsMatch = rest.match(/((?:\d+(?:[.,]\d+)?\s+)*\d+(?:[.,]\d+)?)$/);
      if (trailingNumsMatch) {
        const numsStr = trailingNumsMatch[1].trim();
        const namePart = rest.slice(0, rest.length - trailingNumsMatch[0].length).trim();
        if (namePart.length >= 3) {
          const rawTokens = numsStr.split(/\s+/);
          const nums = rawTokens.map((n) => parseFloat(n.replace(',', '.')));
          const { qty, netPrice } = extractQtyAndPriceFromNumbers(
            nums,
            rawTokens,
            priceBeforeQtyInHeader
          );

          const cleanName = cleanProductName(namePart);
          items.push({
            name: cleanName || fixPolishMojibake(namePart),
            gtin,
            bloz7: optionalLeadingSku?.length === 7 ? optionalLeadingSku : undefined,
            quantity: qty,
            unit: 'SZT.',
            netPrice,
            vatRate: '8%',
            batchNumber: '',
            expiryDate: '',
          });
        }
      }
    }
  }

  // 1B. Jednoliniowy układ tabelaryczny, gdzie Nazwa produktu jest PRZED kodem EAN (lub EAN na końcu wiersza):
  // Wzór: 1 OMNi-BiOTiC 6 60 g słoik 9120117912681 12 166,30 1995,60
  if (items.length === 0) {
    for (const line of lines) {
      if (line.includes('|') || isHeaderOrSummaryLine(line)) continue;
      const match = line.match(
        /^(?:(\d{1,3})[.)]?\s+)?(.+?)\s+(590\d{10}|912\d{10}|\d{13})\s+(.+)$/
      );
      if (match) {
        const namePart = match[2].trim();
        const gtin = match[3];
        const tail = match[4]
          .replace(/\b(?:szt\.?|op\.?|opak\.?|pln|zł)\b/gi, ' ')
          .replace(/\b\d{1,2}%\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const rawTokens = (tail.match(/\d+(?:[.,]\d+)?/g) || []);
        if (namePart.length >= 3 && rawTokens.length >= 1 && !isHeaderOrSummaryLine(namePart)) {
          const nums = rawTokens.map((n) => parseFloat(n.replace(',', '.')));
          const { qty, netPrice } = extractQtyAndPriceFromNumbers(
            nums,
            rawTokens,
            priceBeforeQtyInHeader
          );
          const cleanName = cleanProductName(namePart);
          items.push({
            name: cleanName || fixPolishMojibake(namePart),
            gtin,
            quantity: qty,
            unit: 'SZT.',
            netPrice,
            vatRate: '8%',
            batchNumber: '',
            expiryDate: '',
          });
        }
      }
    }
  }

  // 2A. Wielowierszowy układ kolumnowy (każda komórka w osobnej linii — np. HTML lub PDF z wąskimi kolumnami):
  // Linia 1: Lp. (np. "1" lub "1.")
  // Linia 2: EAN (np. "9120117912711")
  // Linia 3: Opcjonalnie SKU / BLOZ (np. "230078") + Nazwa produktu (np. "OMNI-BIOTIC 6 60 SASZ. X 3 G")
  // Kolejne linie: Zamawiana ilość (np. "6") oraz Cena netto (np. "416.99")
  if (items.length === 0) {
    for (let i = 0; i < lines.length - 3; i++) {
      const l0 = lines[i];
      const l1 = lines[i + 1] || '';
      if (/^\d{1,3}[.)]?$/.test(l0) && /^(?:590\d{10}|912\d{10}|\d{13}|\d{8})$/.test(l1)) {
        const gtin = l1;
        let cursor = i + 2;
        let skuOrBloz: string | undefined;

        // Jeśli kolejna linia to krótki kod SKU/BLOZ (5-7 cyfr)
        if (/^\d{5,7}$/.test(lines[cursor] || '')) {
          skuOrBloz = lines[cursor];
          cursor++;
        }

        const nameCandidate = lines[cursor] || '';
        if (
          nameCandidate &&
          nameCandidate.length >= 3 &&
          !isHeaderOrSummaryLine(nameCandidate) &&
          !/^\d+(?:[.,]\d+)?$/.test(nameCandidate)
        ) {
          cursor++;
          const numTokens: string[] = [];
          while (
            cursor < lines.length &&
            numTokens.length < 5 &&
            !/^\d{1,3}[.)]?$/.test(lines[cursor]) &&
            !/^(?:590\d{10}|912\d{10}|\d{13})$/.test(lines[cursor]) &&
            !isHeaderOrSummaryLine(lines[cursor])
          ) {
            const cleanedLine = lines[cursor]
              .replace(/\b(?:szt\.?|op\.?|opak\.?|pln|zł)\b/gi, ' ')
              .replace(/\b\d{1,2}%\b/g, ' ')
              .trim();
            const matches = cleanedLine.match(/\d+(?:[.,]\d+)?/g);
            if (matches) {
              numTokens.push(...matches);
            }
            cursor++;
          }

          if (numTokens.length > 0) {
            const nums = numTokens.map((n) => parseFloat(n.replace(',', '.')));
            const { qty, netPrice } = extractQtyAndPriceFromNumbers(
              nums,
              numTokens,
              priceBeforeQtyInHeader
            );
            const cleanName = cleanProductName(nameCandidate);
            items.push({
              name: cleanName || fixPolishMojibake(nameCandidate),
              gtin,
              bloz7: skuOrBloz?.length === 7 ? skuOrBloz : undefined,
              quantity: qty,
              unit: 'SZT.',
              netPrice,
              vatRate: '8%',
              batchNumber: '',
              expiryDate: '',
            });
            i = cursor - 1;
          }
        }
      }
    }
  }

  // 2B. Wielowierszowy układ pozycji (charakterystyczny dla PDF z systemów ERP / Dr. Max / Gemini):
  // Linia 1: Lp (np. 1 lub 1.)
  // Linia 2: Nazwa towaru (np. OMNi-BiOTiC® Active 60 g słoik)
  // Linia 3: Ilość (ze słowem "szt" LUB sama liczba z kolumny "Zamawiana ilość"), VAT, ceny, EAN
  if (items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d{1,3}[.)]?$/.test(line)) {
        const next1 = lines[i + 1] || '';
        const next2 = lines[i + 2] || '';

        if (
          next1 &&
          !/^\d{1,3}[.)]?$/.test(next1) &&
          !isHeaderOrSummaryLine(next1) &&
          (next2.includes('szt') ||
            next2.includes('op') ||
            next2.includes('%') ||
            next2.match(/\b\d{8,14}\b/) ||
            next2.match(/\d+[.,]\d{2}/))
        ) {
          const namePart = next1;
          const details = next2;

          const eanMatch = details.match(/\b(590\d{10}|912\d{10}|\d{13,14}|\d{8})\b/);
          const explicitUnitQtyMatch = details.match(
            /(\d+(?:[.,]\d+)?)\s*(?:szt|op|opak|flak|blist|sasz|kg|l)\b/i
          );
          const vatMatch = details.match(/(\d{1,2}%|zw\b)/i);

          let detailsCleaned = details;
          if (eanMatch) {
            detailsCleaned = detailsCleaned.replace(eanMatch[0], ' ');
          }
          if (vatMatch) {
            detailsCleaned = detailsCleaned.replace(vatMatch[0], ' ');
          }

          // Napraw spacje tysięczne wewnątrz kwot (np. "7 586,25" -> "7586,25")
          detailsCleaned = detailsCleaned.replace(/(\d)\s+(\d{3}[.,]\d{2})\b/g, '$1$2');

          let qty = 1;
          let netPrice = 100.0;

          if (explicitUnitQtyMatch) {
            qty = Math.max(1, Math.round(parseFloat(explicitUnitQtyMatch[1].replace(',', '.'))));
            const decimals = detailsCleaned.match(/\d+(?:[.,]\d{2})/g) || [];
            if (decimals[0]) {
              netPrice = parseFloat(decimals[0].replace(',', '.')) || 100.0;
            }
          } else {
            // Brak słowa "szt" przy liczbie (kolumna w tabeli nazywa się np. "Zamawiana ilość")
            const rawTokens = detailsCleaned.match(/\d+(?:[.,]\d+)?/g) || [];
            const nums = rawTokens.map((n) => parseFloat(n.replace(',', '.')));
            const extracted = extractQtyAndPriceFromNumbers(
              nums,
              rawTokens,
              priceBeforeQtyInHeader
            );
            qty = extracted.qty;
            netPrice = extracted.netPrice;
          }

          let parsedVat: VatRate = '8%';
          if (vatMatch) {
            const v = vatMatch[1].toUpperCase();
            if (v === '23%' || v === '8%' || v === '5%' || v === '0%' || v === 'ZW') {
              parsedVat = v as VatRate;
            }
          }

          const batchMatch = (namePart + ' ' + details).match(
            /(?:Seria|LOT|Batch|Ch\.-B\.):\s*([A-Za-z0-9\-]+)/i
          );
          const expMatch = (namePart + ' ' + details).match(
            /(?:Ważność|Waznosc|Data\s+ważności|EXP|MHD):\s*(\d{4}[-./]\d{2}[-./]\d{2}|\d{2}[-./]\d{2}[-./]\d{4}|\d{2}\/\d{4})/i
          );

          if (batchMatch || expMatch) {
            foundBatchesOrExpiry = true;
          }

          const cleanName = cleanProductName(namePart);

          items.push({
            name: cleanName || fixPolishMojibake(namePart),
            gtin: eanMatch ? eanMatch[1] : '',
            quantity: qty,
            unit: 'SZT.',
            netPrice,
            vatRate: parsedVat,
            batchNumber: batchMatch ? batchMatch[1].trim() : '',
            expiryDate: expMatch ? expMatch[1].trim() : '',
          });

          i += 2;
        }
      }
    }
  }

  // 3. Przetwarzanie wiersz po wierszu z separatorami (|, \t, ; lub numeracja wiersza "1. ...")
  if (items.length === 0) {
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isHeaderOrSummaryLine(trimmed)) return;

      if (
        trimmed.includes('|') ||
        trimmed.includes('\t') ||
        trimmed.includes(';') ||
        trimmed.match(/^\s*\d+[\.\)]/)
      ) {
        const separator = trimmed.includes('|')
          ? '|'
          : trimmed.includes('\t')
          ? '\t'
          : trimmed.includes(';')
          ? ';'
          : '|';
        const parts = trimmed.split(separator).map((p) => p.trim());

        // Znajdź część będącą nazwą produktu (pierwszy nie-liczbowy element o długości > 2)
        let namePart = '';
        for (const p of parts) {
          const candidate = p.replace(/^\s*\d+[\.\)]\s*/, '').trim();
          if (
            candidate.length > 2 &&
            !/^(?:\d+(?:[.,]\d+)?|\d{8,14}|szt\.?|op\.?|\d{1,2}%)$/i.test(candidate) &&
            !isHeaderOrSummaryLine(candidate)
          ) {
            namePart = candidate;
            break;
          }
        }

        if (namePart && namePart.length > 2 && !isHeaderOrSummaryLine(namePart)) {
          const eanMatch =
            trimmed.match(/(?:EAN|GTIN|Kod(?:\s*kreskowy)?):\s*(\d{8,14})/i) ||
            trimmed.match(/\b(590\d{10}|912\d{10}|\d{13,14})\b/);
          const blozMatch = trimmed.match(/BLOZ(?:-7)?:\s*(\d{7})/i);
          const explicitQtyMatch =
            trimmed.match(
              /(?:Zamawiana\s+ilość|Ilość\s+zamawiana|Ilość|Ilosc|Qty|Szt|Zamówiono)[:\s]*(\d+)/i
            ) || trimmed.match(/\b(\d+)\s*(?:szt\.?|op\.?|opak\.?)\b/i);
          const explicitPriceMatch =
            trimmed.match(/(?:Cena(?:\s*netto)?|Netto|PLN):\s*([\d\s]+[\.,]\d{2})/i) ||
            trimmed.match(/([\d]+[\.,]\d{2})\s*(?:zł|pln)/i);
          const vatMatch =
            trimmed.match(/VAT:\s*(\d{1,2}%|zw)/i) || trimmed.match(/\b(\d{1,2}%)\b/);

          const batchMatch = trimmed.match(/(?:Seria|LOT|Batch|Ch\.-B\.):\s*([A-Za-z0-9\-]+)/i);
          const expMatch = trimmed.match(
            /(?:Ważność|Waznosc|Data\s+ważności|EXP|MHD):\s*(\d{4}[-./]\d{2}[-./]\d{2}|\d{2}[-./]\d{2}[-./]\d{4}|\d{2}\/\d{4})/i
          );

          if (batchMatch || expMatch) {
            foundBatchesOrExpiry = true;
          }

          let qty = explicitQtyMatch ? parseInt(explicitQtyMatch[1], 10) : 0;
          let netPrice = explicitPriceMatch
            ? parseFloat(explicitPriceMatch[1].replace(/\s/g, '').replace(',', '.'))
            : 0;

          // Jeśli w komórkach nie było etykiet "Ilość:" / "szt", wyciągnij ilość i cenę z pozostałych kolumn liczbowych
          if (!qty || !netPrice) {
            const numericCells = parts.filter((p, idx) => {
              if (!p) return false;
              if (idx === 0 && /^\d{1,3}[.)]?$/.test(p)) return false; // Lp.
              if (eanMatch && p.includes(eanMatch[1])) return false;
              if (blozMatch && p.includes(blozMatch[1])) return false;
              if (/^\d{1,2}%$/i.test(p)) return false;
              return /^\d+(?:[.,]\d+)?(?:\s*(?:zł|pln|szt\.?|op\.?))?$/i.test(p);
            });
            const cleanTokens = numericCells.map((c) =>
              c.replace(/[^\d.,]/g, '')
            );
            const nums = cleanTokens.map((n) => parseFloat(n.replace(',', '.')));
            if (nums.length > 0) {
              const extracted = extractQtyAndPriceFromNumbers(
                nums,
                cleanTokens,
                priceBeforeQtyInHeader
              );
              if (!qty) qty = extracted.qty;
              if (!netPrice) netPrice = extracted.netPrice;
            }
          }

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
            quantity: qty > 0 ? qty : 1,
            unit: 'SZT.',
            netPrice: netPrice > 0 ? netPrice : 100.0,
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
 * Parsuje plik arkusza Excel (.xlsx, .xls) zawierający zamówienie (np. Gemini, DOZ, Super-Pharm, Dr. Max)
 */
export async function parseOrderExcel(
  buffer: ArrayBuffer,
  fileName?: string
): Promise<ParsedOrderResult> {
  // Sprawdź, czy plik .xls nie jest w rzeczywistości tabelą HTML (częsty przypadek eksportu z ERP)
  const previewText = decodeArrayBufferText(buffer.slice(0, 4096));
  if (/<table[\s>]/i.test(previewText) || /<html[\s>]/i.test(previewText)) {
    const fullHtml = decodeArrayBufferText(buffer);
    return parseOrderHtml(fullHtml, fileName);
  }

  const workbook = XLSX.read(buffer, { type: 'array', codepage: 1250 });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Plik Excel nie zawiera żadnych arkuszy.');
  }

  // Wybierz najlepszy arkusz (taki, który zawiera nagłówek tabeli z "Zamawiana ilość" / "EAN" / "Produkt")
  let bestSheetName = workbook.SheetNames[0];
  let bestSheetScore = -1;

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (grid.length === 0) continue;

    let maxRowScoreInSheet = 0;
    for (let r = 0; r < Math.min(grid.length, 60); r++) {
      const ev = evaluateGridHeaderRow(grid, r);
      if (ev.score > maxRowScoreInSheet) {
        maxRowScoreInSheet = ev.score;
      }
    }

    const totalSheetScore = maxRowScoreInSheet * 100 + Math.min(grid.length, 99);
    if (totalSheetScore > bestSheetScore) {
      bestSheetScore = totalSheetScore;
      bestSheetName = name;
    }
  }

  const worksheet = workbook.Sheets[bestSheetName];
  const rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawGrid.length === 0) {
    throw new Error('Arkusz zamówienia jest pusty.');
  }

  return parseOrderGrid(rawGrid, fileName);
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
 * Główna uniwersalna funkcja do wczytywania zamówienia z dowolnego pliku (PDF, Excel, HTML, TXT, CSV)
 */
export async function parseOrderFromFile(file: File): Promise<ParsedOrderResult> {
  const lowerName = file.name.toLowerCase();
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    return parseOrderExcel(buffer, file.name);
  }

  const isHtml = lowerName.endsWith('.html') || lowerName.endsWith('.htm');
  if (isHtml) {
    const text = await decodeTextFile(file);
    return parseOrderHtml(text, file.name);
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
    const parsed = parseOrderText(data.text || '');
    // Uzupełnij fallback z nazwy pliku dla Gemini lub numeru zamówienia
    if ( parsed.headerData ) {
      if (!parsed.headerData.buyerNip && /gemini/i.test(file.name)) {
        parsed.headerData.buyerNip = '5252801825';
        if (!parsed.headerData.buyerName) parsed.headerData.buyerName = 'GEMINI APPS SP. Z O.O.';
      }
      if (!parsed.headerData.orderNumber) {
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const fnOrderMatch = baseName.match(
          /(?:zam[óo]?wienie|zam|order|gem)[_\-\s]+([A-Za-z0-9\-\_\/]{3,})/i
        );
        if (fnOrderMatch && isValidOrderNumberCandidate(fnOrderMatch[1])) {
          parsed.headerData.orderNumber = fnOrderMatch[1];
        }
      }
    }
    return parsed;
  }

  const text = await decodeTextFile(file);
  const parsed = parseOrderText(text);
  if (parsed.headerData && !parsed.headerData.buyerNip && /gemini/i.test(file.name)) {
    parsed.headerData.buyerNip = '5252801825';
    if (!parsed.headerData.buyerName) parsed.headerData.buyerName = 'GEMINI APPS SP. Z O.O.';
  }
  return parsed;
}
