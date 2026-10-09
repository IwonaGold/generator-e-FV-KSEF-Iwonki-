import { InvoiceItem } from '../types/ksef';
import { BatchRecord } from '../types/twoStageOcr';
import Tesseract from 'tesseract.js';
import { DOZ_SPECIAL_PRICE_LIST } from '../types/knowledgeBase';

/**
 * Oblicza ostatni dzień wskazanego miesiąca i roku (uwzględnia lata przestępne)
 * np. 06/27 -> 2027-06-30, 11/2027 -> 2027-11-30, 02/28 -> 2028-02-29, 08-2028 -> 2028-08-31
 */
export function calculateLastDayOfMonth(month: number, year: number): string {
  if (month < 1 || month > 12) month = 12;
  if (year < 100) year += 2000;
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Formatuje datę YYYY-MM-DD do postaci wyświetlanej DD.MM.YYYY
 */
export function formatDateToDisplay(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Normalizuje ręcznie wpisywaną datę (YYYY-MM-DD, DD.MM.YYYY, MM/YYYY, MM-YYYY, MM/YY, MM.YY, MMYY)
 * Dla formatu miesiąc/rok ZAWSZE wylicza ostatni dzień wskazanego miesiąca!
 */
export function normalizeManualDate(val: string): string {
  if (!val) return '';
  val = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  const dmy = val.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const my = val.match(/^(\d{1,2})[./\-](\d{2,4})$/);
  if (my) {
    const m = parseInt(my[1], 10);
    const y = parseInt(my[2], 10);
    return calculateLastDayOfMonth(m, y);
  }

  if (/^\d{4}$/.test(val)) {
    const m = parseInt(val.slice(0, 2), 10);
    const y = 2000 + parseInt(val.slice(2, 4), 10);
    return calculateLastDayOfMonth(m, y);
  }

  return val;
}

/**
 * Normalizuje odczytany numer partii Charge / LOT (koryguje typowe artefakty OCR,
 * np. odczytanie cyfry 5 w prefiksie rocznym "25E..." jako "2SE..." lub wtrącenie znaku "I" pomiędzy cyframi)
 */
function normalizeLotCandidate(raw: string): string {
  let cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_/]/g, '')
    .replace(/^[.\-_/]+|[.\-_/]+$/g, '');

  // W nadruku punktowym (dot-matrix) np. LOT:25E3484 cyfra 5 po 2 bywa odczytywana jako S (2SE3484 lub 2S5E3484)
  cleaned = cleaned.replace(/^2S5([A-Z]\d+)/, '25$1');
  cleaned = cleaned.replace(/^2S([A-Z]\d+)/, '25$1');
  // Usunięcie ewentualnego fałszywego 'I' sklejonego z cyfrą w 7-znakowym kodzie (np. 25E3I484 -> 25E3484)
  cleaned = cleaned.replace(/^(\d{2}[A-Z]\d)I(\d{3})$/, '$1$2');

  return cleaned;
}

/**
 * Szuka numeru serii po słowie kluczowym:
 * - "Charge:" (etykiety całego kartonu, np. Charge: 25E3475, Charge: FP00809, Charge: 2085, Charge: 25E1514)
 * - "LOT:" (oraz warianty OCR: L0T, LOI, LNT, LOY, LAT)
 * - Dolny wiersz kodu kreskowego GS1 na kartonie: (10)<SERIA> lub /F37<ILOSC>F10<SERIA>
 */
export function extractLotAfterPrefix(text: string): string {
  if (!text) return '';

  // 1. Szukaj Charge: (etykiety kartonów zbiorczych) oraz LOT: / Ch.-B. / Seria:
  const chargeOrLotRegex =
    /(?:C[hln][aeo]r[gq][ea]?|Ch\.?\s*-?\s*B\.?|L[O0NAT][TIY1]|SERIA|BATCH)\s*[:.;=\-]?\s*([A-Za-z0-9\-_/]{3,18})/gi;
  let match: RegExpExecArray | null;
  while ((match = chargeOrLotRegex.exec(text)) !== null) {
    const extracted = normalizeLotCandidate(match[1]);
    if (
      extracted &&
      extracted.length >= 3 &&
      /\d/.test(extracted) &&
      !/^(MHD|MDH|BBE|EXP|VERFALL|DATE|ART|NR|ANZAHL|PROD)$/i.test(extracted)
    ) {
      return extracted;
    }
  }

  // 2. Obsługa GS1 AI (10) na dole etykiety kartonu, np. (8008)2510142014(241)55759(37)51(10)25E3475
  const gs1Lot = text.match(/\(10\)\s*([a-zA-Z0-9\-_]{3,18})/);
  if (gs1Lot) {
    const candidate = normalizeLotCandidate(gs1Lot[1]);
    if (candidate && /\d/.test(candidate)) return candidate;
  }

  // 3. Obsługa zapisu kodu kreskowego na kartonie typu: 80081905101455/24155773/F3712F10FP00809
  const f10Lot = text.match(/F37\d+F10([A-Za-z0-9\-_]{3,18})/i);
  if (f10Lot) {
    const candidate = normalizeLotCandidate(f10Lot[1]);
    if (candidate && /\d/.test(candidate)) return candidate;
  }

  return '';
}

/**
 * Normalizuje typowe pomyłki OCR w cyfrach daty ważności (np. "0B-2028" -> "08-2028", "O5/2027" -> "05/2027")
 */
function normalizeOcrDateToken(raw: string): string {
  return raw
    .trim()
    .replace(/[OoQq]/g, '0')
    .replace(/B/g, '8')
    .replace(/[Il|]/g, '1')
    .replace(/S/g, '5')
    .replace(/Z/g, '2')
    .replace(/[\-–—~]/g, '-');
}

/**
 * Szuka daty ważności po słowie kluczowym:
 * - "Verfall:" (etykiety całego kartonu, np. Verfall: 10/2027, Verfall: 05/2027)
 * - "MHD:" (etykiety całego kartonu i opakowań, np. MHD: 08-2028, MHD: 03-2028)
 * - "MDH:", "BBE:", "EXP:"
 * ZAWSZE wylicza ostatni dzień miesiąca (np. 08-2028 -> 2028-08-31, 10/2027 -> 2027-10-31).
 * Ignoruje datę produkcji "Prod.: DD.MM.YY" znajdującą się w tej samej linii co MHD!
 */
export function extractMhdDateAfterPrefix(text: string): string {
  if (!text) return '';

  // Wytnij fragmenty "Prod.: 14.10.25 20:14:00", aby data produkcji z kartonu nigdy nie została wzięta za datę ważności
  const textWithoutProd = text.replace(
    /Prod[a-z.,;:\-\s]*\d{1,2}\s*[./\- ]\s*\d{1,2}\s*[./\- ]\s*\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/gi,
    ' '
  );

  // 1. Szukaj Verfall:, MHD:, MDH:, BBE:, EXP: (oraz wariantów OCR np. Vertall, Verfali, MHO, MH0)
  const prefixPattern =
    /(?:Verf[a-z1l]{1,4}|Vorf[a-z1l]{1,4}|MHD|MDH|MH0|MHO|MHB|MND|BBE|EXP|[BPRWFE8][BPRE8][EB])[A-Za-z.]?\s*[:.;=\-]?\s*([0O1Il|B]?\d\s*[\-–—~./ ]\s*\d{1,2}\s*[\-–—~./ ]\s*\d{2,4}|[0O1Il|B]?[0-9B]\s*[\-–—~./ ]\s*\d{2,4}|[0O1Il|B]\d{3,5})/gi;

  let match: RegExpExecArray | null;
  while ((match = prefixPattern.exec(textWithoutProd)) !== null) {
    const raw = normalizeOcrDateToken(match[1]);

    // Miesiąc i rok: MM/YYYY, MM-YYYY, MM.YYYY, MM/YY, MM-YY, MM.YY (np. 08-2028 -> 2028-08-31, 10/2027 -> 2027-10-31)
    const my = raw.match(/^(\d{1,2})\s*[./\- ]\s*(\d{2,4})$/);
    if (my) {
      const m = parseInt(my[1], 10);
      const y = parseInt(my[2], 10);
      if (m >= 1 && m <= 12) {
        return calculateLastDayOfMonth(m, y);
      }
    }

    // Pełna data DD.MM.YYYY lub DD/MM/YYYY -> zgodnie z zasadą przypisujemy ostatni dzień miesiąca (lub dokładny dzień jeśli to już koniec miesiąca)
    const dmy = raw.match(/^(\d{1,2})\s*[./\- ]\s*(\d{1,2})\s*[./\- ]\s*(\d{2,4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10);
      let y = parseInt(dmy[3], 10);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return calculateLastDayOfMonth(m, y);
      }
    }

    // Zapis sklejony MMYYYY (np. 082028) lub MMYY (np. 0927)
    if (/^\d{6}$/.test(raw)) {
      const m = parseInt(raw.slice(0, 2), 10);
      const y = parseInt(raw.slice(2, 6), 10);
      if (m >= 1 && m <= 12 && y >= 2024 && y <= 2036) {
        return calculateLastDayOfMonth(m, y);
      }
    }
    if (/^\d{4}$/.test(raw)) {
      const m = parseInt(raw.slice(0, 2), 10);
      const y = 2000 + parseInt(raw.slice(2, 4), 10);
      if (m >= 1 && m <= 12) {
        return calculateLastDayOfMonth(m, y);
      }
    }
  }

  // 2. Fallback dla etykiet kartonów i opakowań: jeśli w tekście jest Charge: / LOT: / Artikelnr, szukaj wzorca MM-RRRR lub MM/RRRR
  if (
    /(?:C[hln][aeo]r[gq][ea]?|L[O0NAT][TIY1]|Artikelnr|Art\.?\s*[\-–—]?\s*N)/i.test(
      textWithoutProd
    )
  ) {
    const normalizedText = textWithoutProd
      .replace(/0B\s*[\-–—./]\s*(202\d)/gi, '08-$1')
      .replace(/O(\d)\s*[\-–—./]\s*(202\d)/gi, '0$1-$2');
    const fallbackMy = normalizedText.match(
      /\b(0[1-9]|1[0-2])\s*[./\-–—]\s*(202[5-9]|203[0-5]|2[6-9]|3[0-5])\b/
    );
    if (fallbackMy) {
      const m = parseInt(fallbackMy[1], 10);
      const y = parseInt(fallbackMy[2], 10);
      return calculateLastDayOfMonth(m, y);
    }
  }

  // 3. Obsługa GS1 AI (17)YYMMDD
  const gs1Mhd = textWithoutProd.match(/\(17\)(\d{6})/);
  if (gs1Mhd) {
    const yy = parseInt(gs1Mhd[1].slice(0, 2), 10);
    const mm = parseInt(gs1Mhd[1].slice(2, 4), 10);
    const year = 2000 + yy;
    if (mm >= 1 && mm <= 12) {
      return calculateLastDayOfMonth(mm, year);
    }
  }

  return '';
}

/**
 * Mapa znanych kodów Art.-Nummer / Artikelnr. z austriackich etykiet kartonów zbiorczych
 * na kody GTIN/EAN oraz nazwy produktów z katalogu Eubiosis
 */
const CARTON_ART_NR_TO_PRODUCT: Record<
  string,
  { gtin: string; canonicalName: string; keywords: string[] }
> = {
  '55759': {
    gtin: '9120117912742',
    canonicalName: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    keywords: ['panda', '30', '3 g'],
  },
  '55789': {
    gtin: '9120117912742',
    canonicalName: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    keywords: ['panda', '30', '3 g'],
  },
  '56759': {
    gtin: '9120117912742',
    canonicalName: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    keywords: ['panda', '30', '3 g'],
  },
  '85759': {
    gtin: '9120117912742',
    canonicalName: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    keywords: ['panda', '30', '3 g'],
  },
  '55773': {
    gtin: '9120117912889',
    canonicalName: 'OMNi-LOGiC® FIBRE 250 g słoik',
    keywords: ['fibre', '250'],
  },
  '55770': {
    gtin: '9120117912858',
    canonicalName: 'OMNi-BiOTiC® FLORA plus 14 sasz. x 2 g',
    keywords: ['flora', 'plus', '14', '2 g'],
  },
  '55781': {
    gtin: '9120117911370',
    canonicalName: 'OMNi-BiOTiC® 10 AAD Kids 20 sasz. x 2,5 g',
    keywords: ['10', 'aad', 'kids', '20', '2,5'],
  },
};

/**
 * Wyodrębnia numer artykułu (Art.-Nummer / Artikelnr. / GS1 (241) / /241XXXXX/) z tekstu etykiety kartonu
 */
export function extractCartonArticleNumber(text: string): string {
  if (!text) return '';
  const artMatch =
    text.match(/Art(?:ikelnr|\.?[\s\-–—~]*N[a-z]*)\.?\s*[:.;=\-]?\s*(\d{5})/i) ||
    text.match(/\(241\)\s*(\d{5})/) ||
    text.match(/\/241(\d{5})\//);
  if (artMatch) {
    return artMatch[1];
  }
  for (const knownArt of Object.keys(CARTON_ART_NR_TO_PRODUCT)) {
    if (text.includes(knownArt)) {
      return knownArt;
    }
  }
  return '';
}

/**
 * Inteligentne dopasowanie tekstu z etykiety całego kartonu (lub opakowania) do pozycji na fakturze
 * oraz do katalogu produktów Eubiosis.
 * Rozumie niemieckie oznaczenia kartonowe:
 * - "30er FS" / "20er FS" -> 30 sasz. / 20 sasz.
 * - "14x2g" (lub OCR "14x29") -> 14 sasz. x 2 g
 * - "2,5g" (lub OCR "2,59") -> 2,5 g
 * - "250g" -> 250 g
 * - Kody Art.-Nummer / Artikelnr. (np. 55759, 55773, 55770, 55781)
 */
export function matchCartonProductToInvoiceItems(
  rawOcrText: string,
  invoiceItems: InvoiceItem[],
  fileName = ''
): {
  recognizedProductName: string;
  recognizedGtin: string;
  matchedInvoiceItemId?: string;
  matchedInvoiceItemIndex?: number;
  isConfident: boolean;
} {
  const combinedRaw = `${fileName} ${rawOcrText}`;
  // Usuń datę produkcji "Prod.: 14.10.25 20:14:00" przed analizą słów kluczowych produktu, aby liczby z daty (np. 14, 10) nie myliły dopasowania
  const cleanedForProduct = combinedRaw.replace(
    /Prod[a-z.,;:\-\s]*\d{1,2}\s*[./\- ]\s*\d{1,2}\s*[./\- ]\s*\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/gi,
    ' '
  );
  const lower = cleanedForProduct
    .toLowerCase()
    // Napraw typowe sklejki OCR na etykietach kartonów, gdzie 'g' na końcu gramatury jest czytane jako '9' lub '¢' (np. "14x29" -> "14x2g", "2,59" -> "2,5g", "250¢" -> "250g")
    .replace(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)[9¢q]\b/g, '$1x$2g')
    .replace(/\b(\d+,\d+)[9¢q]\b/g, '$1g')
    .replace(/\b(60|250|300|450)[9¢q]\b/g, '$1g');

  // 1. Sprawdź czy w tekście jest bezpośredni GTIN (8-13 cyfr) lub znany Art.-Nummer z kartonu
  let detectedGtin = '';
  let catalogCanonicalName = '';

  const gtinMatch = lower.match(/\b(590\d{10}|912\d{10}|\d{13})\b/);
  if (gtinMatch) {
    detectedGtin = gtinMatch[1];
  }

  const artNr = extractCartonArticleNumber(combinedRaw);
  if (artNr && CARTON_ART_NR_TO_PRODUCT[artNr]) {
    if (!detectedGtin) detectedGtin = CARTON_ART_NR_TO_PRODUCT[artNr].gtin;
    catalogCanonicalName = CARTON_ART_NR_TO_PRODUCT[artNr].canonicalName;
  }

  // Wyciągnij cechy ilościowo-wagowe z etykiety kartonu:
  // a) Liczba saszetek/opakowań z zapisu "<N>er" (np. "30er FS" -> 30, "20er FS" -> 20) lub "<N>x<W>g" (np. "14x2g" -> 14)
  const packCounts = new Set<string>();
  const erMatches = lower.matchAll(/\b(\d{1,3})\s*er\b/g);
  for (const m of erMatches) packCounts.add(m[1]);

  const nxwMatches = lower.matchAll(/\b(\d{1,3})\s*x\s*(\d+(?:[.,]\d+)?)\s*g\b/g);
  const gramWeights = new Set<string>();
  for (const m of nxwMatches) {
    packCounts.add(m[1]);
    gramWeights.add(m[2].replace('.', ','));
  }

  // b) Gramatury pojedyncze np. "250g", "3g", "2,5g", "1,2g", "60g", "300g", "450g"
  const weightMatches = lower.matchAll(/\b(\d+(?:[.,]\d+)?)\s*g\b/g);
  for (const m of weightMatches) {
    const wVal = m[1].replace('.', ',');
    gramWeights.add(wVal);
    if (['60', '250', '300', '450'].includes(wVal)) {
      packCounts.add(wVal);
    }
  }

  // c) Liczba sztuk w kartonie ("Anzahl: 12", "Anzahl FS: 51")
  let cartonAnzahl = 0;
  const anzahlMatch = lower.match(/anzahl(?:\s*fs)?\s*[:.;=\-]?\s*(\d{1,3})/i);
  if (anzahlMatch) {
    cartonAnzahl = parseInt(anzahlMatch[1], 10);
  }

  // Słowa wyróżniające rodzinę produktu
  const FAMILY_KEYWORDS = [
    'panda',
    'fibre',
    'flora',
    'aad',
    'kids',
    'stress',
    'repair',
    'travel',
    'colonize',
    'metabolic',
    'power',
    'hetox',
    'metatox',
    'pro-vi',
    'provi',
    'active',
    'pectin',
    'apple',
    'immune',
    'mikrosan',
    'cat',
    'dog',
  ];

  // Jeśli jeszcze nie mamy nazwy kanonicznej z Art.-Nummer, dopasuj do pełnego katalogu Eubiosis (DOZ_SPECIAL_PRICE_LIST)
  if (!catalogCanonicalName) {
    let bestCatScore = 0;
    let bestCatItem: (typeof DOZ_SPECIAL_PRICE_LIST)[0] | null = null;

    for (const catItem of DOZ_SPECIAL_PRICE_LIST) {
      const catLower = catItem.name.toLowerCase();
      let score = 0;

      if (detectedGtin && catItem.ean === detectedGtin) {
        score += 100;
      }

      for (const kw of FAMILY_KEYWORDS) {
        if (lower.includes(kw) && catLower.includes(kw)) {
          score += kw === 'kids' ? 18 : 15;
        } else if (kw === 'kids' && lower.includes('kids') !== catLower.includes('kids')) {
          score -= 12;
        }
      }

      if (lower.includes('plus') && catLower.includes('plus')) score += 8;
      if (/\b10\s*aad\b/.test(lower) && catLower.includes('10 aad')) score += 12;

      for (const cnt of packCounts) {
        const cntRegex = new RegExp(`\\b${cnt}\\s*(?:sasz|kaps|g\\b)`, 'i');
        if (cntRegex.test(catLower)) score += 10;
      }

      for (const gw of gramWeights) {
        const gwRegex = new RegExp(`\\b${gw.replace(',', '[.,]')}\\s*g\\b`, 'i');
        if (gwRegex.test(catLower)) score += 6;
      }

      if (score > bestCatScore) {
        bestCatScore = score;
        bestCatItem = catItem;
      }
    }

    if (bestCatItem && bestCatScore >= 15) {
      catalogCanonicalName = bestCatItem.name;
      if (!detectedGtin) detectedGtin = bestCatItem.ean;
    }
  }

  // Teraz dopasuj do pozycji bieżącego zamówienia (invoiceItems)
  if (!invoiceItems || invoiceItems.length === 0) {
    return {
      recognizedProductName: catalogCanonicalName || fileName,
      recognizedGtin: detectedGtin,
      isConfident: Boolean(catalogCanonicalName),
    };
  }

  // Jeśli zamówienie ma tylko 1 pozycję, zawsze przypisz do niej (z zachowaniem rozpoznanej nazwy/GTIN)
  if (invoiceItems.length === 1) {
    return {
      recognizedProductName: catalogCanonicalName || invoiceItems[0].name,
      recognizedGtin: detectedGtin || invoiceItems[0].gtin || '',
      matchedInvoiceItemId: invoiceItems[0].id,
      matchedInvoiceItemIndex: 1,
      isConfident: true,
    };
  }

  // Priorytet 1: Dokładne dopasowanie po kodzie GTIN (z tekstu lub z mapy Art.-Nummer)
  if (detectedGtin) {
    const cleanDetected = detectedGtin.replace(/\D/g, '');
    const gtinIdx = invoiceItems.findIndex(
      (it) => it.gtin && it.gtin.replace(/\D/g, '') === cleanDetected
    );
    if (gtinIdx !== -1) {
      return {
        recognizedProductName: invoiceItems[gtinIdx].name,
        recognizedGtin: detectedGtin,
        matchedInvoiceItemId: invoiceItems[gtinIdx].id,
        matchedInvoiceItemIndex: gtinIdx + 1,
        isConfident: true,
      };
    }
  }

  // Priorytet 2: Punktowe dopasowanie wielokryterialne (rodzina produktu + ilość saszetek "30er"/"14x2g" + gramatura + ilość w kartonie)
  let bestIdx = -1;
  let bestScore = 0;

  for (let idx = 0; idx < invoiceItems.length; idx++) {
    const item = invoiceItems[idx];
    const itemLower = item.name.toLowerCase();
    let score = 0;

    // A. Dopasowanie słów kluczowych rodziny produktu
    for (const kw of FAMILY_KEYWORDS) {
      const inOcr =
        lower.includes(kw) ||
        Boolean(catalogCanonicalName && catalogCanonicalName.toLowerCase().includes(kw));
      const inItem = itemLower.includes(kw);
      if (inOcr && inItem) {
        const occurrencesInOrder = invoiceItems.filter((other) =>
          other.name.toLowerCase().includes(kw)
        ).length;
        score += occurrencesInOrder === 1 ? 18 : 12;
      } else if (kw === 'kids' && inOcr !== inItem) {
        score -= 10;
      }
    }

    if (
      (lower.includes('plus') || catalogCanonicalName.toLowerCase().includes('plus')) &&
      itemLower.includes('plus')
    ) {
      score += 6;
    }

    // B. Dopasowanie wielkości opakowania (np. 30er -> 30 sasz., 20er -> 20 sasz., 14x2g -> 14 sasz., 250g -> 250 g)
    for (const cnt of packCounts) {
      const cntRegex = new RegExp(`\\b${cnt}\\b`);
      if (cntRegex.test(itemLower)) {
        score += 9;
      }
    }

    // C. Dopasowanie gramatury (np. 3g -> 3 g, 2,5g -> 2,5 g, 2g -> 2 g)
    for (const gw of gramWeights) {
      const gwRegex = new RegExp(`\\b${gw.replace(',', '[.,]')}\\s*g\\b`, 'i');
      if (gwRegex.test(itemLower)) {
        score += 5;
      }
    }

    // D. Jeśli na kartonie było "Anzahl FS: 51" i dokładnie tyle sztuk jest na pozycji zamówienia
    if (cartonAnzahl > 0 && item.quantity === cartonAnzahl) {
      score += 4;
    }

    // E. Ogólne dopasowanie słów z nazwy pozycji
    const words = itemLower
      .split(/[\s,()\-®™]+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !/^(szt|op|opak|sasz|kaps|tabl|sloik|słoik|prosz|omni|biotic|logic)$/i.test(w)
      );
    for (const w of words) {
      if (lower.includes(w)) {
        score += 4;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  if (bestIdx !== -1 && bestScore >= 6) {
    const matched = invoiceItems[bestIdx];
    return {
      recognizedProductName: catalogCanonicalName || matched.name,
      recognizedGtin: detectedGtin || matched.gtin || '',
      matchedInvoiceItemId: matched.id,
      matchedInvoiceItemIndex: bestIdx + 1,
      isConfident: true,
    };
  }

  return {
    recognizedProductName: catalogCanonicalName || fileName,
    recognizedGtin: detectedGtin,
    matchedInvoiceItemId: undefined,
    matchedInvoiceItemIndex: undefined,
    isConfident: false,
  };
}

/**
 * Automatycznie wykrywa położenie białej etykiety na tle brązowego kartonu zbiorczego
 * i zwraca wycięte strefy tekstowe etykiety (z pominięciem kodów kreskowych zakłócających Tesseract).
 */
export async function extractCartonWhiteStickerZones(
  source: File | string
): Promise<Array<{ name: string; dataUrl: string }>> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleLoaded = () => {
      try {
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;
        if (!W || !H) {
          resolve([]);
          return;
        }

        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }

        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;

        // Krok 1: Znajdź wiersze należące do białej etykiety kartonu (chłodna/neutralna biel na tle ciepłego brązowego kartonu)
        const rowHits = new Int32Array(H);
        for (let y = Math.floor(H * 0.04); y < Math.floor(H * 0.96); y++) {
          const rowOff = y * W;
          for (let x = Math.floor(W * 0.03); x < Math.floor(W * 0.93); x++) {
            const i = (rowOff + x) * 4;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            if (
              (b >= 135 && g >= 130 && b - r >= -5) ||
              (r >= 185 && g >= 185 && b >= 180 && r - b <= 15)
            ) {
              rowHits[y]++;
            }
          }
        }

        let y0 = 0;
        let y1 = H - 1;
        while (y0 < H && rowHits[y0] < W * 0.22) y0++;
        while (y1 > y0 && rowHits[y1] < W * 0.22) y1--;

        if (y1 - y0 < H * 0.12) {
          y0 = 0;
          y1 = H - 1;
          while (y0 < H && rowHits[y0] < W * 0.14) y0++;
          while (y1 > y0 && rowHits[y1] < W * 0.14) y1--;
        }

        const sH = y1 - y0;
        if (sH < H * 0.1) {
          resolve([]);
          return;
        }

        const colHits = new Int32Array(W);
        for (let y = y0; y <= y1; y++) {
          const rowOff = y * W;
          for (let x = Math.floor(W * 0.02); x < Math.floor(W * 0.96); x++) {
            const i = (rowOff + x) * 4;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            if (
              (b >= 125 && g >= 120 && b - r >= -10) ||
              (r >= 175 && g >= 175 && b >= 170 && r - b <= 18)
            ) {
              colHits[x]++;
            }
          }
        }

        let x0 = 0;
        let x1 = W - 1;
        while (x0 < W && colHits[x0] < sH * 0.32) x0++;
        while (x1 > x0 && colHits[x1] < sH * 0.32) x1--;

        const sW = x1 - x0;
        if (sW < W * 0.2) {
          resolve([]);
          return;
        }

        const cropToDataUrl = (rect: { left: number; top: number; width: number; height: number }) => {
          const sx = Math.max(0, Math.min(W - 1, rect.left));
          const sy = Math.max(0, Math.min(H - 1, rect.top));
          const sw = Math.max(10, Math.min(W - sx, rect.width));
          const sh = Math.max(10, Math.min(H - sy, rect.height));

          const sub = document.createElement('canvas');
          sub.width = sw;
          sub.height = sh;
          const sctx = sub.getContext('2d');
          if (!sctx) return '';
          sctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          return sub.toDataURL('image/jpeg', 0.95);
        };

        const zones: Array<{ name: string; dataUrl: string }> = [
          {
            name: 'Etykieta kartonu (górna strefa tekstowa: Produkt / Charge / Verfall / MHD)',
            dataUrl: cropToDataUrl({
              left: x0 + Math.floor(sW * 0.02),
              top: y0 + Math.floor(sH * 0.03),
              width: Math.floor(sW * 0.93),
              height: Math.floor(sH * 0.52),
            }),
          },
          {
            name: 'Etykieta kartonu (lewa strefa tekstowa – bez pionowego kodu kreskowego)',
            dataUrl: cropToDataUrl({
              left: x0 + Math.floor(sW * 0.03),
              top: y0 + Math.floor(sH * 0.05),
              width: Math.floor(sW * 0.66),
              height: Math.floor(sH * 0.62),
            }),
          },
          {
            name: 'Etykieta kartonu (dolny wiersz kodu GS1)',
            dataUrl: cropToDataUrl({
              left: x0 + Math.floor(sW * 0.02),
              top: y0 + Math.floor(sH * 0.8),
              width: Math.floor(sW * 0.94),
              height: Math.floor(sH * 0.19),
            }),
          },
        ];

        resolve(zones.filter((z) => Boolean(z.dataUrl)));
      } catch {
        resolve([]);
      }
    };

    img.onload = handleLoaded;
    img.onerror = () => resolve([]);

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Przygotowuje Canvas i wycina wybrany fragment z adaptacyjną obróbką obrazu:
 * - Dla białych etykiet kartonów zbiorczych (Charge / Verfall / MHD): zachowuje czysty, ostry tekst
 *   z łagodnym wyrównaniem kontrastu, bez wycinania wnętrza pogrubionych czcionek.
 * - Dla ciemnych/kolorowych ścianek opakowań jednostkowych (LOT / BBE): wzmacnia nadruk punktowy dot-matrix.
 */
export async function prepareCanvasFragment(
  source: File | string,
  cropArea?: { x: number; y: number; width: number; height: number }
): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleLoaded = () => {
      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;

      let sx = 0;
      let sy = 0;
      let sWidth = naturalWidth;
      let sHeight = naturalHeight;

      if (cropArea) {
        sx = Math.max(0, Math.floor((cropArea.x / 100) * naturalWidth));
        sy = Math.max(0, Math.floor((cropArea.y / 100) * naturalHeight));
        sWidth = Math.max(
          1,
          Math.min(naturalWidth - sx, Math.floor((cropArea.width / 100) * naturalWidth))
        );
        sHeight = Math.max(
          1,
          Math.min(naturalHeight - sy, Math.floor((cropArea.height / 100) * naturalHeight))
        );
      }

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = sWidth;
      srcCanvas.height = sHeight;
      const srcCtx = srcCanvas.getContext('2d');

      if (!srcCtx) {
        resolve({ dataUrl: '', base64: '' });
        return;
      }

      srcCtx.imageSmoothingEnabled = false;
      srcCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
      const srcImgData = srcCtx.getImageData(0, 0, sWidth, sHeight);
      const rawData = srcImgData.data;
      const srcPixels = sWidth * sHeight;

      // Sprawdź czy wycinek to biała etykieta kartonu (duży udział neutralnych jasnych pikseli B >= R - 10)
      let whiteStickerPixels = 0;
      for (let i = 0; i < srcPixels; i += 4) {
        const idx = i * 4;
        const r = rawData[idx];
        const g = rawData[idx + 1];
        const b = rawData[idx + 2];
        if (b >= 125 && g >= 120 && b - r >= -10) {
          whiteStickerPixels++;
        }
      }
      const whiteStickerRatio = whiteStickerPixels / Math.max(1, Math.ceil(srcPixels / 4));

      // Jeśli to wycinek białej etykiety kartonu zbiorczego, zwróć czysty obraz o podbitym kontraście liniowym
      if (whiteStickerRatio >= 0.38) {
        const scale = sWidth < 700 ? 1.5 : 1.0;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = Math.round(sWidth * scale);
        outCanvas.height = Math.round(sHeight * scale);
        const outCtx = outCanvas.getContext('2d');
        if (outCtx) {
          outCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outCanvas.width, outCanvas.height);
          const dataUrl = outCanvas.toDataURL('image/jpeg', 0.95);
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ dataUrl, base64 });
          return;
        }
      }

      let scale = 1.0;
      if (sWidth < 900) {
        scale = Math.min(3.0, 1400 / sWidth);
      }
      const dWidth = Math.round(sWidth * scale);
      const dHeight = Math.round(sHeight * scale);

      const srcMax = new Uint8Array(srcPixels);
      const srcLum = new Uint8Array(srcPixels);
      const maxHist = new Uint32Array(256);
      const lumHist = new Uint32Array(256);

      for (let i = 0; i < srcPixels; i++) {
        const idx = i * 4;
        const r = rawData[idx];
        const g = rawData[idx + 1];
        const b = rawData[idx + 2];
        const m = Math.max(r, g, b);
        const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        srcMax[i] = m;
        srcLum[i] = l;
        maxHist[m]++;
        lumHist[l]++;
      }

      const halfPixels = srcPixels >> 1;
      let globalMaxMed = 128;
      let accMax = 0;
      for (let v = 0; v < 256; v++) {
        accMax += maxHist[v];
        if (accMax >= halfPixels) {
          globalMaxMed = v;
          break;
        }
      }

      let globalLumMed = 128;
      let accLum = 0;
      for (let v = 0; v < 256; v++) {
        accLum += lumHist[v];
        if (accLum >= halfPixels) {
          globalLumMed = v;
          break;
        }
      }

      // Krok 2: Klasyfikacja kafelków (32x32) na jasne etykiety/naklejki vs ciemne/kolorowe ścianki
      const isFocusedCrop = Boolean(cropArea && cropArea.height <= 45);
      const TILE = 32;
      const tw = Math.ceil(sWidth / TILE);
      const th = Math.ceil(sHeight / TILE);
      const tileMaxMeds = new Uint8Array(tw * th);
      const tileIsDark = new Uint8Array(tw * th);

      if (isFocusedCrop) {
        const dark = globalLumMed < 155 || globalMaxMed < 175 ? 1 : 0;
        tileMaxMeds.fill(globalMaxMed);
        tileIsDark.fill(dark);
      } else {
        const tHistMax = new Int32Array(256);
        const tHistLum = new Int32Array(256);
        for (let ty = 0; ty < th; ty++) {
          const y0 = ty * TILE;
          const y1 = Math.min(sHeight, y0 + TILE);
          for (let tx = 0; tx < tw; tx++) {
            const x0 = tx * TILE;
            const x1 = Math.min(sWidth, x0 + TILE);
            tHistMax.fill(0);
            tHistLum.fill(0);
            let count = 0;
            for (let y = y0; y < y1; y++) {
              const rOff = y * sWidth;
              for (let x = x0; x < x1; x++) {
                tHistMax[srcMax[rOff + x]]++;
                tHistLum[srcLum[rOff + x]]++;
                count++;
              }
            }
            const half = count >> 1;
            let aM = 0;
            let medM = 128;
            for (let v = 0; v < 256; v++) {
              aM += tHistMax[v];
              if (aM >= half) {
                medM = v;
                break;
              }
            }
            let aL = 0;
            let medL = 128;
            for (let v = 0; v < 256; v++) {
              aL += tHistLum[v];
              if (aL >= half) {
                medL = v;
                break;
              }
            }
            tileMaxMeds[ty * tw + tx] = medM;
            tileIsDark[ty * tw + tx] = medL < 155 || medM < 170 ? 1 : 0;
          }
        }
      }

      const activeChannel = new Uint8Array(srcPixels);
      for (let y = 0; y < sHeight; y++) {
        const ty = Math.floor(y / TILE);
        const rowOff = y * sWidth;
        for (let x = 0; x < sWidth; x++) {
          const tIdx = ty * tw + Math.floor(x / TILE);
          activeChannel[rowOff + x] = tileIsDark[tIdx] ? srcMax[rowOff + x] : srcLum[rowOff + x];
        }
      }

      // Na ciemnych/kolorowych ściankach wyeliminuj jasny biały nadruk (np. Art.-Nr.) i jego 2-pikselową otoczkę JPEG
      const isWhiteTextMask = new Uint8Array(srcPixels);
      const maskMed = new Uint8Array(srcPixels);
      for (let y = 0; y < sHeight; y++) {
        const ty = Math.floor(y / TILE);
        const rowOff = y * sWidth;
        for (let x = 0; x < sWidth; x++) {
          const tIdx = ty * tw + Math.floor(x / TILE);
          if (tileIsDark[tIdx]) {
            const tMed = tileMaxMeds[tIdx];
            if (activeChannel[rowOff + x] > Math.round(tMed * 1.14)) {
              for (let dy = -2; dy <= 2; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= sHeight) continue;
                const nRow = ny * sWidth;
                for (let dx = -2; dx <= 2; dx++) {
                  const nx = x + dx;
                  if (nx >= 0 && nx < sWidth) {
                    isWhiteTextMask[nRow + nx] = 1;
                    maskMed[nRow + nx] = tMed;
                  }
                }
              }
            }
          }
        }
      }
      for (let i = 0; i < srcPixels; i++) {
        if (isWhiteTextMask[i]) activeChannel[i] = maskMed[i];
      }

      // Krok 3: Szybki przesuwny histogram 256-kubłkowy wyznaczający lokalny 70. percentyl tła
      const ratioSrc = new Float32Array(srcPixels);
      const hist = new Int32Array(256);

      for (let y = 0; y < sHeight; y++) {
        const rowOff = y * sWidth;
        for (let parity = 0; parity < 2; parity++) {
          if (parity >= sWidth) continue;
          hist.fill(0);
          let maxV = 0;
          for (let dy = -8; dy <= 8; dy += 2) {
            const ny = Math.max(0, Math.min(sHeight - 1, y + dy));
            const nRow = ny * sWidth;
            for (let dx = -8; dx <= 8; dx += 2) {
              const nx = Math.max(0, Math.min(sWidth - 1, parity + dx));
              const v = activeChannel[nRow + nx];
              hist[v]++;
              if (v > maxV) maxV = v;
            }
          }

          for (let x = parity; x < sWidth; x += 2) {
            let topCount = 0;
            let bg = 128;
            for (let v = maxV; v >= 0; v--) {
              topCount += hist[v];
              if (topCount >= 25) {
                bg = v;
                break;
              }
            }
            ratioSrc[rowOff + x] = bg > 15 ? activeChannel[rowOff + x] / bg : 1.0;

            if (x + 2 < sWidth) {
              const oldX = Math.max(0, Math.min(sWidth - 1, x - 8));
              const newX = Math.max(0, Math.min(sWidth - 1, x + 10));
              if (oldX !== newX) {
                for (let dy = -8; dy <= 8; dy += 2) {
                  const ny = Math.max(0, Math.min(sHeight - 1, y + dy));
                  const nRow = ny * sWidth;
                  hist[activeChannel[nRow + oldX]]--;
                  const nv = activeChannel[nRow + newX];
                  hist[nv]++;
                  if (nv > maxV) maxV = nv;
                }
              }
            }
          }
        }
      }

      // Krok 4: Powiększenie dwuliniowe (do dWidth x dHeight) z adaptacyjną krzywą kontrastu
      const gray = new Float32Array(dWidth * dHeight);
      for (let dy = 0; dy < dHeight; dy++) {
        const fy = dy / scale;
        const y0 = Math.floor(fy);
        const y1 = Math.min(sHeight - 1, y0 + 1);
        const wy = fy - y0;
        const ty = Math.min(th - 1, Math.floor(y0 / TILE));
        const dRow = dy * dWidth;
        for (let dx = 0; dx < dWidth; dx++) {
          const fx = dx / scale;
          const x0 = Math.floor(fx);
          const x1 = Math.min(sWidth - 1, x0 + 1);
          const wx = fx - x0;

          const isDark = tileIsDark[ty * tw + Math.min(tw - 1, Math.floor(x0 / TILE))];
          const blackPoint = isDark ? 0.84 : 0.72;
          const whitePoint = isDark ? 0.92 : 0.9;

          const v00 = ratioSrc[y0 * sWidth + x0];
          const v10 = ratioSrc[y0 * sWidth + x1];
          const v01 = ratioSrc[y1 * sWidth + x0];
          const v11 = ratioSrc[y1 * sWidth + x1];
          const r = (1 - wy) * ((1 - wx) * v00 + wx * v10) + wy * ((1 - wx) * v01 + wx * v11);

          const norm = Math.max(0, Math.min(1, (r - blackPoint) / (whitePoint - blackPoint)));
          gray[dRow + dx] = norm * 255;
        }
      }

      // Krok 5: Delikatne wygładzenie 3x3
      const canvas = document.createElement('canvas');
      canvas.width = dWidth;
      canvas.height = dHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({ dataUrl: '', base64: '' });
        return;
      }

      const outImgData = ctx.createImageData(dWidth, dHeight);
      const outData = outImgData.data;

      for (let y = 0; y < dHeight; y++) {
        for (let x = 0; x < dWidth; x++) {
          let sumVal = 0;
          for (let ky = -1; ky <= 1; ky++) {
            const ny = Math.max(0, Math.min(dHeight - 1, y + ky));
            const rOff = ny * dWidth;
            for (let kx = -1; kx <= 1; kx++) {
              const nx = Math.max(0, Math.min(dWidth - 1, x + kx));
              sumVal += gray[rOff + nx];
            }
          }
          const c = Math.max(0, Math.min(255, Math.round(sumVal / 9)));
          const idx = (y * dWidth + x) * 4;
          outData[idx] = c;
          outData[idx + 1] = c;
          outData[idx + 2] = c;
          outData[idx + 3] = 255;
        }
      }

      ctx.putImageData(outImgData, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ dataUrl, base64 });
    };

    img.onload = handleLoaded;
    img.onerror = () => resolve({ dataUrl: '', base64: '' });

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Uruchamia silnik OCR Tesseract
 */
export async function runOcrEngine(dataUrl: string): Promise<string> {
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {},
    });
    const ret = await worker.recognize(dataUrl);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    console.warn('Tesseract worker error:', err);
    return '';
  }
}

/**
 * ============================================================================
 * ETAP 1 + AUTOMATYCZNY ODCZYT ETYKIETY CAŁEGO KARTONU:
 * Rozpoznaje produkt z etykiety kartonu (lub opakowania) ORAZ od razu sczytuje
 * serię (Charge: / LOT:) i datę ważności (Verfall: / MHD: -> ostatni dzień m-ca).
 * ============================================================================
 */
export async function runStage1ProductRecognition(
  file: File,
  invoiceItems: InvoiceItem[]
): Promise<{
  recognizedProductName: string;
  recognizedGtin: string;
  matchedInvoiceItemId?: string;
  matchedInvoiceItemIndex?: number;
  isConfident: boolean;
  extractedLot?: string;
  extractedMhd?: string;
  rawOcrText?: string;
}> {
  let combinedOcrText = '';
  let foundLot = '';
  let foundMhd = '';

  try {
    // 1. Najpierw sprawdź czy na zdjęciu znajduje się biała etykieta całego kartonu zbiorczego
    const stickerZones = await extractCartonWhiteStickerZones(file);

    if (stickerZones.length > 0) {
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {},
      });
      try {
        for (const z of stickerZones) {
          const ret = await worker.recognize(z.dataUrl);
          const text = ret.data.text || '';
          combinedOcrText += `\n[${z.name}]: ${text}`;

          if (!foundLot) {
            const l = extractLotAfterPrefix(text);
            if (l) foundLot = l;
          }
          if (!foundMhd) {
            const m = extractMhdDateAfterPrefix(text);
            if (m) foundMhd = m;
          }
          // Jeśli w pierwszej strefie (93%x52%) mamy już zarówno Charge jak i Verfall/MHD oraz nazwę/Art.-Nummer, nie musimy skanować kolejnych stref
          if (foundLot && foundMhd && text.trim().length > 25) {
            break;
          }
        }
      } finally {
        await worker.terminate();
      }
    }

    // 2. Jeśli to nie była biała etykieta kartonu (lub nie odczytano tekstu), uruchom klasyczny skan całego obrazu
    if (!combinedOcrText.trim()) {
      const { dataUrl } = await prepareCanvasFragment(file);
      if (dataUrl) {
        const ocrText = (await runOcrEngine(dataUrl)) || '';
        combinedOcrText = ocrText;
        if (!foundLot) foundLot = extractLotAfterPrefix(ocrText);
        if (!foundMhd) foundMhd = extractMhdDateAfterPrefix(ocrText);
      }
    }
  } catch (err) {
    console.error('Błąd Etapu 1:', err);
  }

  // Sprawdź także nazwę pliku
  if (!foundLot && file.name) {
    foundLot = extractLotAfterPrefix(file.name);
  }
  if (!foundMhd && file.name) {
    foundMhd = extractMhdDateAfterPrefix(file.name);
  }

  const matchResult = matchCartonProductToInvoiceItems(combinedOcrText, invoiceItems, file.name);

  return {
    ...matchResult,
    extractedLot: foundLot || undefined,
    extractedMhd: foundMhd || undefined,
    rawOcrText: combinedOcrText,
  };
}

/**
 * ============================================================================
 * ETAP 2: ODCZYT CHARGE / LOT ORAZ VERFALL / MHD / MDH / BBE
 * Szuka „Charge:” lub „LOT:” i sczytuje numer serii,
 * oraz „Verfall:”, „MHD:”, „MDH:” lub „BBE:” i wylicza datę ważności (ostatni dzień miesiąca).
 * Obsługuje zarówno etykiety całego kartonu zbiorczego, jak i pojedyncze opakowania.
 * ============================================================================
 */
export async function runStage2VisualInspection(
  file: File | string,
  targetProduct: InvoiceItem,
  customCropArea?: { x: number; y: number; width: number; height: number }
): Promise<{
  batches: BatchRecord[];
  rawText: string;
  scannedZonesCount: number;
}> {
  let combinedOcrText = '';
  let foundLot = '';
  let foundMhd = '';
  let scannedCount = 0;

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: () => {},
  });

  try {
    // 1. Jeśli użytkownik nie zaznaczył własnego wycinka (Zoom), najpierw automatycznie wykryj białą etykietę całego kartonu
    if (!customCropArea) {
      const stickerZones = await extractCartonWhiteStickerZones(file);
      for (const sz of stickerZones) {
        scannedCount++;
        const ret = await worker.recognize(sz.dataUrl);
        const text = ret.data.text || '';
        combinedOcrText += ` [${sz.name}]: ${text}`;

        if (!foundLot) {
          const lotExtracted = extractLotAfterPrefix(text);
          if (lotExtracted) foundLot = lotExtracted;
        }
        if (!foundMhd) {
          const mhdExtracted = extractMhdDateAfterPrefix(text);
          if (mhdExtracted) foundMhd = mhdExtracted;
        }
        if (foundLot && foundMhd) {
          break;
        }
      }
    }

    // 2. Jeśli użytkownik zaznaczył własny obszar (Zoom) lub na białej etykiecie kartonu brakowało danych, skanuj strefy
    if (!foundLot || !foundMhd) {
      const candidateZones: Array<{
        name: string;
        crop?: { x: number; y: number; width: number; height: number };
      }> = customCropArea
        ? [{ name: 'Zaznaczony fragment', crop: customCropArea }]
        : [
            {
              name: 'Etykieta kartonu – środek (Charge / Verfall / MHD)',
              crop: { x: 8, y: 28, width: 84, height: 42 },
            },
            {
              name: 'Środkowa ścianka / Klapa (LOT / BBE / MHD)',
              crop: { x: 20, y: 50, width: 55, height: 18 },
            },
            { name: 'Cały obraz (biała naklejka / etykieta)' },
            {
              name: 'Szersza ścianka środkowa / dolna',
              crop: { x: 15, y: 48, width: 70, height: 22 },
            },
            { name: 'Górna część opakowania / kartonu', crop: { x: 5, y: 8, width: 90, height: 45 } },
          ];

      for (const zone of candidateZones) {
        try {
          const { dataUrl } = await prepareCanvasFragment(file, zone.crop);
          if (!dataUrl) continue;

          scannedCount++;
          const ret = await worker.recognize(dataUrl);
          const text = ret.data.text || '';
          combinedOcrText += ` [${zone.name}]: ${text}`;

          if (!foundLot) {
            const lotExtracted = extractLotAfterPrefix(text);
            if (lotExtracted) foundLot = lotExtracted;
          }

          if (!foundMhd) {
            const mhdExtracted = extractMhdDateAfterPrefix(text);
            if (mhdExtracted) foundMhd = mhdExtracted;
          }

          if (foundLot && foundMhd) {
            break;
          }
        } catch (zoneErr) {
          console.warn(`Błąd strefy ${zone.name}:`, zoneErr);
        }
      }
    }
  } finally {
    await worker.terminate();
  }

  // Sprawdź także nazwę pliku
  if (typeof file !== 'string' && file.name) {
    if (!foundLot) {
      const lotFromName = extractLotAfterPrefix(file.name);
      if (lotFromName) foundLot = lotFromName;
    }
    if (!foundMhd) {
      const mhdFromName = extractMhdDateAfterPrefix(file.name);
      if (mhdFromName) foundMhd = mhdFromName;
    }
  }

  const isLotOk = Boolean(foundLot && foundLot.trim() !== '');
  const isMhdOk = Boolean(foundMhd && foundMhd.trim() !== '');

  const finalBatches: BatchRecord[] = [
    {
      id: `batch-${Date.now()}-0`,
      lot: foundLot,
      mhd: foundMhd,
      quantity: targetProduct.quantity || 1,
      lotConfidence: isLotOk,
      mhdConfidence: isMhdOk,
      status: isLotOk && isMhdOk ? 'PEWNY' : 'DO WERYFIKACJI',
    },
  ];

  return {
    batches: finalBatches,
    rawText: combinedOcrText,
    scannedZonesCount: scannedCount,
  };
}
