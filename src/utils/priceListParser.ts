import * as XLSX from 'xlsx';
import {
  PriceListItem,
  PriceComparisonItem,
  PriceListAuditSummary,
  ColumnMapping,
  RawSheetInfo,
} from '../types/priceList';
import { InvoiceItem } from '../types/ksef';
import { fixPolishMojibake } from './textEncoding';

/**
 * Normalizuje tekst nagłówka (usuwa spacje, znaki diakrytyczne, małe litery)
 */
export function normalizeHeader(header: any): string {
  if (!header) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Czyści i parsuje wartość liczbową (np. "157,94 zł", "157.94", 157.94, spacje twarde)
 */
export function parseNumericValue(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val)
    .replace(/\u00A0/g, '') // Usuń twarde spacje z Excela
    .replace(/\s+/g, '')
    .replace(/zł|pln|eur|%|gross|net/gi, '')
    .replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Czyści kod EAN / GTIN (obsługuje notację wykładniczą z Excela, np. 9.12012E+12)
 */
export function cleanGtinValue(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Jeśli Excel zapisał liczbę całkowitą jako float
    return String(Math.floor(val));
  }
  const str = String(val).trim();
  // Notacja wykładnicza np. 9.120117912773E+12
  if (str.toUpperCase().includes('E+')) {
    const num = parseFloat(str);
    if (!isNaN(num)) {
      return String(Math.floor(num));
    }
  }
  return str.replace(/\D/g, '');
}

// Słownik słów kluczowych do automatycznego rozpoznawania kolumn
const KEYWORDS = {
  gtin: [
    'gtin',
    'ean',
    'kodkreskowy',
    'kodpaskowy',
    'kod',
    'barcode',
    'indeks',
    'index',
    'kodproduktu',
    'bloz',
    'bloz7',
    'symbol',
    'nrkatalogowy',
    'numerkatalogowy',
    'sku',
    'ean13',
    'gtin13',
  ],
  name: [
    'nazwatowaru',
    'nazwaproduktu',
    'nazwa',
    'produkt',
    'towar',
    'artykul',
    'opis',
    'asortyment',
    'nazwahandlowa',
    'opisproduktu',
    'pozycja',
  ],
  discountedNet: [
    'cenanettoporabacie',
    'cenaporabacie',
    'cenazrabatem',
    'nettoporabacie',
    'porabacie',
    'cenanettopoopuscie',
    'cenapoopuscie',
    'cenanettopoupuscie',
    'cenapoupuscie',
    'cenasprzedazynetto',
    'cenasprzedazy',
    'cenazakupunetto',
    'cenazakupu',
    'cenapromocyjnanetto',
    'cenapromocyjna',
    'cenafakturowanetto',
    'cenafakturowa',
    'cenafv',
    'cenazbytunetto',
    'cenazbytu',
    'cenatransakcyjna',
    'cenanettoostateczna',
    'cenakoncowapln',
    'cenakoncowynetto',
    'cenanettopo',
    'nettopo',
  ],
  baseNet: [
    'cenabazowa',
    'cenakatalogowa',
    'cenaprzedrabatem',
    'cenawyjsciowa',
    'cenaregularna',
    'cenacennikowa',
    'cenahurtowa',
    'cenanettobazowa',
    'cenanetto',
    'cena',
    'netto',
    'cenadetaliczna',
    'cenaurzedowa',
  ],
  discountPercent: [
    'rabat',
    'rabat%',
    'upust',
    'upust%',
    'znizka',
    'znizka%',
    'skonto',
    'wartoscrabatu',
    'procentrabatu',
    'rabatprocent',
    'rabathandlowy',
    'rabatpromocyjny',
  ],
};

/**
 * Automatycznie wykrywa wiersz nagłówka w arkuszu (szuka wiersza z największą liczbą trafień słów kluczowych)
 */
export function detectHeaderRow(rawGrid: any[][]): number {
  let bestRowIndex = 0;
  let maxScore = 0;

  const maxScanRows = Math.min(25, rawGrid.length);

  for (let r = 0; r < maxScanRows; r++) {
    const row = rawGrid[r];
    if (!row || !Array.isArray(row)) continue;

    let score = 0;
    row.forEach((cell) => {
      const norm = normalizeHeader(cell);
      if (!norm) return;

      if (KEYWORDS.gtin.some((k) => norm.includes(k))) score += 4;
      if (KEYWORDS.name.some((k) => norm.includes(k))) score += 4;
      if (KEYWORDS.discountedNet.some((k) => norm.includes(k))) score += 5;
      if (KEYWORDS.baseNet.some((k) => norm.includes(k))) score += 3;
      if (KEYWORDS.discountPercent.some((k) => norm.includes(k))) score += 3;
    });

    if (score > maxScore) {
      maxScore = score;
      bestRowIndex = r;
    }
  }

  return bestRowIndex;
}

/**
 * Automatycznie dopasowuje kolumny na podstawie wskazanego wiersza nagłówka
 */
export function detectColumnMapping(headerRow: any[]): ColumnMapping {
  const mapping: ColumnMapping = {
    gtinColIndex: -1,
    nameColIndex: -1,
    discountedNetColIndex: -1,
    baseNetColIndex: -1,
    discountPercentColIndex: -1,
  };

  if (!headerRow || !Array.isArray(headerRow)) return mapping;

  const normalized = headerRow.map((cell) => normalizeHeader(cell));

  // 1. Szukaj ceny netto po rabacie (najbardziej specyficzna)
  mapping.discountedNetColIndex = normalized.findIndex((norm) =>
    KEYWORDS.discountedNet.some((k) => norm.includes(k))
  );

  // 2. Szukaj kodu GTIN / EAN
  mapping.gtinColIndex = normalized.findIndex((norm) =>
    KEYWORDS.gtin.some((k) => norm.includes(k))
  );

  // 3. Szukaj nazwy towaru
  mapping.nameColIndex = normalized.findIndex((norm) =>
    KEYWORDS.name.some((k) => norm.includes(k))
  );

  // 4. Szukaj rabatu %
  mapping.discountPercentColIndex = normalized.findIndex((norm) =>
    KEYWORDS.discountPercent.some((k) => norm.includes(k))
  );

  // 5. Szukaj ceny bazowej (pomijając kolumnę już wybraną jako cena po rabacie)
  mapping.baseNetColIndex = normalized.findIndex(
    (norm, idx) =>
      idx !== mapping.discountedNetColIndex &&
      KEYWORDS.baseNet.some((k) => norm.includes(k))
  );

  // Jeśli nie znaleziono kolumny "po rabacie", ale jest cena bazowa i rabat -> użyj ceny bazowej jako punktu wyjścia
  if (mapping.discountedNetColIndex === -1 && mapping.baseNetColIndex !== -1) {
    mapping.discountedNetColIndex = mapping.baseNetColIndex;
  }

  // Jeśli brak kolumny nazwy, spróbuj znaleźć pierwszą kolumnę tekstową inną niż kod i cena
  if (mapping.nameColIndex === -1) {
    mapping.nameColIndex = normalized.findIndex(
      (_, idx) =>
        idx !== mapping.gtinColIndex &&
        idx !== mapping.discountedNetColIndex &&
        idx !== mapping.baseNetColIndex
    );
  }

  return mapping;
}

/**
 * Wyciąga pozycje cennika z siatki 2D na podstawie nagłówka i mapowania kolumn
 */
export function extractItemsFromGrid(
  rawGrid: any[][],
  headerRowIndex: number,
  mapping: ColumnMapping
): PriceListItem[] {
  const items: PriceListItem[] = [];

  for (let r = headerRowIndex + 1; r < rawGrid.length; r++) {
    const row = rawGrid[r];
    if (!row || !Array.isArray(row)) continue;

    const rawGtin = mapping.gtinColIndex >= 0 ? row[mapping.gtinColIndex] : '';
    const rawName = mapping.nameColIndex >= 0 ? row[mapping.nameColIndex] : '';
    const rawDiscountedPrice =
      mapping.discountedNetColIndex >= 0 ? row[mapping.discountedNetColIndex] : '';
    const rawBasePrice = mapping.baseNetColIndex >= 0 ? row[mapping.baseNetColIndex] : '';
    const rawDiscount =
      mapping.discountPercentColIndex >= 0 ? row[mapping.discountPercentColIndex] : '';

    const gtin = cleanGtinValue(rawGtin);
    const name = String(rawName || '').trim();

    // Jeśli wiersz jest pusty lub nie ma nazwy i GTIN
    if (!name && !gtin) continue;

    let basePrice = parseNumericValue(rawBasePrice);
    const discountVal = parseNumericValue(rawDiscount);
    let discountedPrice = parseNumericValue(rawDiscountedPrice);

    // Jeśli brak ceny po rabacie, ale jest cena bazowa
    if (discountedPrice <= 0 && basePrice > 0) {
      if (discountVal > 0) {
        discountedPrice = Math.round(basePrice * (1 - discountVal / 100) * 100) / 100;
      } else {
        discountedPrice = basePrice;
      }
    } else if (basePrice <= 0 && discountedPrice > 0) {
      basePrice =
        discountVal > 0
          ? Math.round((discountedPrice / (1 - discountVal / 100)) * 100) / 100
          : discountedPrice;
    }

    // Jeśli nadal 0, a podano cenę bazową
    if (discountedPrice <= 0 && basePrice > 0) {
      discountedPrice = basePrice;
    }

    if (discountedPrice > 0 || name || gtin) {
      const cleanName = fixPolishMojibake(name);
      items.push({
        gtin: gtin || '5900000000000',
        name: cleanName || `Pozycja cennikowa ${items.length + 1}`,
        baseNetPrice: basePrice > 0 ? basePrice : discountedPrice,
        discountPercent: discountVal,
        discountedNetPrice: discountedPrice,
        vatRate: '8%',
      });
    }
  }

  return items;
}

/**
 * Bada strukturę pliku Excel, znajdując arkusze, wiersz nagłówka i mapowanie kolumn
 */
export async function inspectAndParseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  preferredSheet?: string
): Promise<{ rawSheetInfo: RawSheetInfo; items: PriceListItem[] }> {
  const workbook = XLSX.read(buffer, { type: 'array', codepage: 1250 });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Plik nie zawiera żadnych arkuszy.');
  }

  // Wybierz arkusz
  let selectedSheet = preferredSheet || workbook.SheetNames[0];
  if (!workbook.Sheets[selectedSheet]) {
    selectedSheet = workbook.SheetNames[0];
  }

  // Jeśli pierwszy arkusz jest pusty, przeszukaj pozostałe arkusze
  let worksheet = workbook.Sheets[selectedSheet];
  let rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawGrid.length <= 1 && workbook.SheetNames.length > 1) {
    for (const name of workbook.SheetNames) {
      const candidateWs = workbook.Sheets[name];
      const candidateGrid: any[][] = XLSX.utils.sheet_to_json(candidateWs, { header: 1, defval: '' });
      if (candidateGrid.length > rawGrid.length) {
        selectedSheet = name;
        worksheet = candidateWs;
        rawGrid = candidateGrid;
      }
    }
  }

  if (rawGrid.length === 0) {
    throw new Error(`Arkusz "${selectedSheet}" jest pusty.`);
  }

  // Wykryj wiersz nagłówka
  const headerRowIndex = detectHeaderRow(rawGrid);
  const headerRow = rawGrid[headerRowIndex] || [];

  // Dostępne kolumny dla UI mapowania
  const availableColumns = headerRow.map((cell: any, index: number) => {
    // Podgląd wartości z kolejnego wiersza
    const nextRow = rawGrid[headerRowIndex + 1];
    const previewVal = nextRow && nextRow[index] !== undefined ? String(nextRow[index]).slice(0, 25) : '';
    return {
      index,
      label: String(cell || `Kolumna ${index + 1}`).trim() || `Kolumna ${index + 1}`,
      preview: previewVal ? `np. ${previewVal}` : '',
    };
  });

  // Wykryj mapowanie
  const detectedMapping = detectColumnMapping(headerRow);

  // Wyciągnij pozycje
  const items = extractItemsFromGrid(rawGrid, headerRowIndex, detectedMapping);

  const rawSheetInfo: RawSheetInfo = {
    fileName,
    sheetNames: workbook.SheetNames,
    selectedSheet,
    rawGrid,
    headerRowIndex,
    availableColumns,
    detectedMapping,
  };

  return { rawSheetInfo, items };
}

/**
 * Parsuje wklejony tekst z Excela (np. kopiowanie tabeli z Excela przez Ctrl+C / Ctrl+V)
 */
export function parsePastedExcelText(pastedText: string): PriceListItem[] {
  const lines = pastedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const rawGrid: any[][] = lines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t');
    }
    if (line.includes(';')) {
      return line.split(';');
    }
    if (line.includes(',')) {
      return line.split(',');
    }
    return [line];
  });

  const headerRowIndex = detectHeaderRow(rawGrid);
  const headerRow = rawGrid[headerRowIndex] || [];
  const mapping = detectColumnMapping(headerRow);

  return extractItemsFromGrid(rawGrid, headerRowIndex, mapping);
}

/**
 * Główna funkcja parsująca plik File
 */
export async function parsePriceListFile(
  file: File
): Promise<{ fileName: string; items: PriceListItem[]; rawSheetInfo?: RawSheetInfo }> {
  const buffer = await file.arrayBuffer();
  const { rawSheetInfo, items } = await inspectAndParseWorkbook(buffer, file.name);
  return {
    fileName: file.name,
    items,
    rawSheetInfo,
  };
}

/**
 * Porównuje pozycje z bieżącej faktury z wgranym cennikiem XLSX
 */
export function comparePricesWithInvoice(
  invoiceItems: InvoiceItem[],
  priceList: PriceListItem[]
): {
  comparisons: Map<string, PriceComparisonItem>;
  summary: PriceListAuditSummary;
} {
  const comparisons = new Map<string, PriceComparisonItem>();

  let matchedCount = 0;
  let discrepanciesCount = 0;
  let notFoundCount = 0;
  let totalInvoiceNet = 0;
  let totalPriceListNet = 0;
  let totalPotentialDiff = 0;

  invoiceItems.forEach((item) => {
    totalInvoiceNet += item.quantity * item.netPrice;

    const cleanInvoiceGtin = cleanGtinValue(item.gtin);
    const cleanInvoiceName = (item.name || '').toLowerCase().trim();

    // 1. Próba dopasowania po GTIN / EAN
    let matchedItem = priceList.find((p) => {
      const pGtin = cleanGtinValue(p.gtin);
      return cleanInvoiceGtin && pGtin && (cleanInvoiceGtin === pGtin || cleanInvoiceGtin.includes(pGtin) || pGtin.includes(cleanInvoiceGtin));
    });
    let matchedBy: 'gtin' | 'name' | 'none' = matchedItem ? 'gtin' : 'none';

    // 2. Próba dopasowania po nazwie
    if (!matchedItem && cleanInvoiceName) {
      matchedItem = priceList.find((p) => {
        const pName = (p.name || '').toLowerCase().trim();
        if (pName === cleanInvoiceName) return true;
        // Sprawdź dopasowanie pierwszych kluczowych słów (np. "OMNi-BiOTiC Active")
        const itemWords = cleanInvoiceName.split(/\s+/).slice(0, 3).join(' ');
        const pWords = pName.split(/\s+/).slice(0, 3).join(' ');
        return itemWords.length >= 6 && (pName.includes(itemWords) || cleanInvoiceName.includes(pWords));
      });
      if (matchedItem) matchedBy = 'name';
    }

    if (!matchedItem) {
      notFoundCount++;
      comparisons.set(item.id, {
        invoiceItemId: item.id,
        invoiceItemName: item.name,
        invoiceGtin: item.gtin,
        invoiceNetPrice: item.netPrice,
        priceListPrice: null,
        difference: null,
        differencePercent: null,
        status: 'not_found',
        matchedBy: 'none',
      });
      return;
    }

    const priceListNet = matchedItem.discountedNetPrice;
    totalPriceListNet += item.quantity * priceListNet;

    const diff = Math.round((item.netPrice - priceListNet) * 100) / 100;
    const diffPercent = priceListNet > 0 ? Math.round(((item.netPrice - priceListNet) / priceListNet) * 1000) / 10 : 0;

    const isMatch = Math.abs(diff) <= 0.01;

    if (isMatch) {
      matchedCount++;
    } else {
      discrepanciesCount++;
      totalPotentialDiff += diff * item.quantity;
    }

    comparisons.set(item.id, {
      invoiceItemId: item.id,
      invoiceItemName: item.name,
      invoiceGtin: item.gtin,
      invoiceNetPrice: item.netPrice,
      priceListPrice: priceListNet,
      difference: diff,
      differencePercent: diffPercent,
      status: isMatch ? 'match' : 'discrepancy',
      matchedBy,
      matchedPriceListItem: matchedItem,
    });
  });

  const summary: PriceListAuditSummary = {
    totalItems: invoiceItems.length,
    matchedCount,
    discrepanciesCount,
    notFoundCount,
    totalInvoiceNet: Math.round(totalInvoiceNet * 100) / 100,
    totalPriceListNet: Math.round(totalPriceListNet * 100) / 100,
    totalPotentialDiff: Math.round(totalPotentialDiff * 100) / 100,
  };

  return { comparisons, summary };
}

/**
 * Przykładowy cennik sieci
 */
export const SAMPLE_XLSX_PRICE_LIST: PriceListItem[] = [
  {
    gtin: '9120117912773',
    name: 'OMNi-BiOTiC® Active 60 g słoik',
    baseNetPrice: 175.05,
    discountPercent: 5.0,
    discountedNetPrice: 166.3,
  },
  {
    gtin: '9120001435692',
    name: 'OMNi-BiOTiC® TRAVEL 28 sasz. x 5 g',
    baseNetPrice: 169.83,
    discountPercent: 7.0,
    discountedNetPrice: 157.94,
  },
  {
    gtin: '9120117912742',
    name: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    baseNetPrice: 175.49,
    discountPercent: 10.0,
    discountedNetPrice: 157.94,
  },
  {
    gtin: '9120117913138',
    name: 'OMNi-BiOTiC® STRESS Repair 9 7 sasz. x 3 g',
    baseNetPrice: 49.96,
    discountPercent: 8.0,
    discountedNetPrice: 45.96,
  },
  {
    gtin: '9120117914906',
    name: 'Omni Biotic Colonize, prosz., 3 g, 28 sasz.',
    baseNetPrice: 176.25,
    discountPercent: 8.0,
    discountedNetPrice: 162.15,
  },
  {
    gtin: '9120117912865',
    name: 'Omni Biotic Flora Plus, prosz., 2 g, 28 sasz.',
    baseNetPrice: 165.59,
    discountPercent: 7.0,
    discountedNetPrice: 154.0,
  },
  {
    gtin: '9120117912797',
    name: 'Omni Biotic Pro-Vi 5, prosz., 2 g, 14sasz.',
    baseNetPrice: 87.68,
    discountPercent: 8.0,
    discountedNetPrice: 80.67,
  },
  {
    gtin: '9120117915651',
    name: 'Omni Biotic Stress Repair 9 Kids, prosz., 1,2 g, 28 sasz.',
    baseNetPrice: 122.22,
    discountPercent: 10.0,
    discountedNetPrice: 110.0,
  },
  {
    gtin: '5909990145214',
    name: 'Augmentin (875 mg + 125 mg) tabl. a 14',
    baseNetPrice: 32.0,
    discountPercent: 12.5,
    discountedNetPrice: 28.0,
  },
  {
    gtin: '5909990841208',
    name: 'Paracetamol Biofarm 500 mg tabl. a 20',
    baseNetPrice: 6.0,
    discountPercent: 15.0,
    discountedNetPrice: 5.1,
  },
];

/**
 * Generuje plik XLSX (Blob) z przykładowym cennikiem aptecznym
 */
export function generateSamplePriceListXlsxBlob(): Blob {
  const data = SAMPLE_XLSX_PRICE_LIST.map((item) => ({
    'Kod EAN / GTIN': item.gtin,
    'Nazwa towaru': item.name,
    'Cena bazowa netto [PLN]': item.baseNetPrice,
    'Rabat [%]': item.discountPercent,
    'Cena netto po rabacie [PLN]': item.discountedNetPrice,
    'Stawka VAT': '8%',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cennik Rabatowy 2026');

  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 45 },
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
  ];

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
