import {
  ProductCatalogItem,
  WarehouseDocType,
  WarehouseDocument,
  WarehouseDocumentItem,
  WFirmaInventoryRow,
  WFirmaInventorySnapshot,
  SuspendedReasonCategory,
} from '../types/wms';

/**
 * Oblicza liczbę pełnych miesięcy pozostałych do daty ważności MHD (względem dzisiejszej daty)
 */
export function getMonthsUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  if (!expiryDate) return 0;
  const clean = expiryDate.trim();
  const parsed = new Date(clean);
  if (isNaN(parsed.getTime())) return 0;

  const diffMs = parsed.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.round((diffDays / 30.4375) * 10) / 10;
}

/**
 * Złota reguła Eubiosis dla produktów PARTNER:
 * Produkty dla Partnerów muszą mieć zawsze powyżej 12 miesięcy daty ważności (> 12 msc).
 */
export function isEligibleForPartner12Months(expiryDate: string, now: Date = new Date()): boolean {
  if (!expiryDate) return false;
  return getMonthsUntilExpiry(expiryDate, now) >= 12;
}

/**
 * Wyodrębnia bazowy 13-cyfrowy kod EAN z indeksu KTM wFirma
 * (np. "EAN9120117912766" -> "9120117912766", "EANPL9120117912902" -> "9120117912902")
 */
export function extractBaseEan(ktmOrText: string): string {
  if (!ktmOrText) return '';
  const compact = ktmOrText.replace(/\s+/g, '');
  const m = compact.match(/(?:EAN(?:PL)?)?(\d{11,14})/i);
  return m ? m[1] : '';
}

/**
 * Dopasowuje pozycję z dokumentu WZ/RW/PZ/PW lub zestawienia wFirma do Katalogu Produktów
 */
export function matchProductFromCatalog(
  rawSku: string,
  rawName: string,
  catalog: ProductCatalogItem[]
): ProductCatalogItem | null {
  const cleanSku = (rawSku || '').replace(/\s+/g, '').toUpperCase();
  const baseEan = extractBaseEan(cleanSku) || extractBaseEan(rawName);
  const stripBrand = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/omni[\s-]*biotic®?/gi, '')
      .replace(/omni[\s-]*logic®?/gi, '')
      .replace(/PARTNER/gi, '')
      .replace(/[—–-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normName = stripBrand(rawName);

  // 1. Dokładne dopasowanie po indeksie SKU (zwykłym lub partnerskim)
  if (cleanSku) {
    const byExactSku = catalog.find(
      (p) =>
        p.skuRegular.replace(/\s+/g, '').toUpperCase() === cleanSku ||
        (p.skuPartner && p.skuPartner.replace(/\s+/g, '').toUpperCase() === cleanSku)
    );
    if (byExactSku) return byExactSku;
  }

  // 2. Jeśli to promocja lub zestaw o własnym kodzie EAN (np. 9120117912934 MikroSan promocja 11 2026)
  if (baseEan) {
    const byExactBaseEan = catalog.find((p) => p.baseEan === baseEan);
    if (byExactBaseEan) return byExactBaseEan;
  }

  // 3. Dopasowanie po nazwie (dla pozycji bez kodu EAN)
  if (normName) {
    for (const p of catalog) {
      const pNorm = stripBrand(p.name);
      const pShort = stripBrand(p.shortName);
      if (pNorm === normName || pShort === normName) {
        return p;
      }
    }

    for (const p of catalog) {
      const pNorm = stripBrand(p.name);
      if (pNorm && (normName.includes(pNorm) || pNorm.includes(normName))) {
        return p;
      }
    }
  }

  return null;
}

function parsePolishNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/\s+/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Szybki, liniowy parser (O(N)) dokumentu "Zestawienie stanów / STANY MAGAZYNOWE" z wFirma.pl
 * Obsługuje wielostronicowe pliki PDF (np. 10 stron / 240 pozycji), łamane kody EANPL... oraz wielowierszowe nazwy.
 */
export function parseWFirmaInventoryText(rawText: string): WFirmaInventorySnapshot {
  const lines = (rawText || '').split(/\r?\n/);

  let snapshotDate = new Date().toISOString().slice(0, 10);
  let warehouseName = 'Główny Magazyn';

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(/STANY MAGAZYNOWE NA DZIEŃ\s+(\d{2})-(\d{2})-(\d{4})/i);
    if (dateMatch) {
      snapshotDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    const magMatch = line.match(/^Magazyn:\s*(.+)$/i);
    if (magMatch) {
      warehouseName = magMatch[1].trim();
    }
  }

  const rows: WFirmaInventoryRow[] = [];
  let bufferLines: string[] = [];

  // Wiersz kończący pozycję w zestawieniu stanów ma postać:
  // [ew. początek linii] szt. <ilość> <cena_zakupu> <koszt_produkcji> <wartość>
  const unitAndNumbersRegex =
    /^(.*?)\b(szt\.|op\.|kpl\.|kg|l)\s+(\d+(?:[.,]\d+)?)\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})(?:\s+(.*))?$/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Pomijamy nagłówki i stopki stron z wFirma
    if (
      /^Zestawienie stanów/i.test(line) ||
      /^STANY MAGAZYNOWE/i.test(line) ||
      /^Rodzaj inwentaryzacji/i.test(line) ||
      /^Sposób prowadzenia/i.test(line) ||
      /^Magazyn:/i.test(line) ||
      /^\(nazwa i adres/i.test(line) ||
      /^Skład komisji/i.test(line) ||
      /^\(imię, nazwisko/i.test(line) ||
      /^spis rozpoczęto/i.test(line) ||
      /^Lp\s+KTM/i.test(line) ||
      /^indeksu$/i.test(line) ||
      /^Nazwa \(określenie\)/i.test(line) ||
      /^spisywanego$/i.test(line) ||
      /^Jedn\.\s+Ilość/i.test(line) ||
      /^stwierdzona$/i.test(line) ||
      /^Cena$/i.test(line) ||
      /^zakupu$/i.test(line) ||
      /^Koszt$/i.test(line) ||
      /^produkcji$/i.test(line) ||
      /^Wartość\s+Uwagi/i.test(line) ||
      /^1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9$/.test(line) ||
      /^Suma strony/i.test(line) ||
      /^Podpis osoby/i.test(line) ||
      /^Wycenił/i.test(line) ||
      /^Przewodniczący/i.test(line) ||
      /^Członkowie/i.test(line) ||
      /^Sprawdził/i.test(line) ||
      /^\(podpis\)/i.test(line) ||
      /^Wydruk pochodzi z systemu/i.test(line) ||
      /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) ||
      /^\d{3},\d{2}$/.test(line) // Dalsza część "Suma strony" przeniesiona do nowej linii
    ) {
      continue;
    }

    const match = line.match(unitAndNumbersRegex);
    if (match) {
      const prefixOnSameLine = (match[1] || '').trim();
      if (prefixOnSameLine) {
        bufferLines.push(prefixOnSameLine);
      }

      const fullHeader = bufferLines.join(' ').replace(/\s+/g, ' ').trim();
      bufferLines = [];

      const lpMatch = fullHeader.match(/^(\d{1,3})\s+(.*)$/);
      if (lpMatch) {
        const lp = parseInt(lpMatch[1], 10);
        let rest = lpMatch[2].trim();

        // Naprawa złamanego kodu EANPL (np. "EANPL91201179129 02 OMNi-LOGiC...")
        rest = rest.replace(/^(EANPL\d{10,12})\s+(\d{1,3})\b/i, '$1$2');

        let ktm = '';
        let name = rest;

        const ktmMatch = rest.match(/^((?:EAN(?:PL)?)?\d{10,14})\s+(.+)$/i);
        if (ktmMatch) {
          ktm = ktmMatch[1].trim();
          name = ktmMatch[2].trim();
        }

        const unit = match[2];
        const quantity = parsePolishNumber(match[3]);
        const purchasePrice = parsePolishNumber(match[4]);
        const totalValue = parsePolishNumber(match[6]);
        const isPartner = /PARTNER/i.test(name) || /^EAN\d/i.test(ktm);
        const baseEan = extractBaseEan(ktm) || extractBaseEan(name);

        rows.push({
          lp,
          ktm,
          name,
          unit,
          quantity,
          purchasePrice,
          totalValue,
          isPartner,
          baseEan,
        });
      }
    } else {
      // Jeśli linia zaczyna się od nowego numeru Lp, a w buforze były śmieci ze stopki, wyczyść stary bufor
      if (/^\d{1,3}\s+/.test(line) && bufferLines.length > 3) {
        bufferLines = [line];
      } else {
        bufferLines.push(line);
      }
    }
  }

  const totalValueNet = rows.reduce((acc, r) => acc + r.totalValue, 0);

  return {
    snapshotDate,
    warehouseName,
    totalRowsParsed: rows.length,
    totalValueNet: Math.round(totalValueNet * 100) / 100,
    importedAt: new Date().toISOString(),
    rows,
  };
}

/**
 * Szybki, liniowy parser dokumentów magazynowych z wFirma.pl:
 * Obsługuje PZ (Przyjęcie Zewnętrzne), WZ (Wydanie Zewnętrzne), PW (Przyjęcie Wewnętrzne), RW (Rozchód Wewnętrzny).
 * Potrafi odczytać zarówno pojedynczy dokument PDF, jak i wielostronicowy PDF zawierający wiele dokumentów naraz!
 */
export function parseWFirmaDocumentsText(
  rawText: string,
  catalog: ProductCatalogItem[]
): WarehouseDocument[] {
  const cleanedText = (rawText || '').replace(/\r\n/g, '\n');

  // Dzielimy tekst na poszczególne dokumenty (jeśli w 1 PDF są np. 4 strony: PZ, WZ, PW, RW)
  const docHeaderRegex = /(?:^|\n)\s*(PZ|WZ|PW|RW)\s+(\d+\/\d+\/\d{4})\b/g;
  const matches: { docType: WarehouseDocType; docNumber: string; startIndex: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = docHeaderRegex.exec(cleanedText)) !== null) {
    matches.push({
      docType: m[1].toUpperCase() as WarehouseDocType,
      docNumber: `${m[1].toUpperCase()} ${m[2]}`,
      startIndex: m.index,
    });
  }

  if (matches.length === 0) {
    return [];
  }

  const documents: WarehouseDocument[] = [];

  for (let idx = 0; idx < matches.length; idx++) {
    const current = matches[idx];
    const nextStart = idx + 1 < matches.length ? matches[idx + 1].startIndex : cleanedText.length;
    const chunk = cleanedText.slice(current.startIndex, nextStart);
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);

    let issueDate = new Date().toISOString().slice(0, 10);
    let warehouseName = 'Główny Magazyn';
    let counterparty = 'Eubiosis sp. z o.o.';
    let notes = '';

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const dateM = l.match(/Data wystawienia:\s*(\d{4}-\d{2}-\d{2})/i);
      if (dateM) issueDate = dateM[1];

      const magM = l.match(/^Magazyn:\s*(.+)$/i);
      if (magM) warehouseName = magM[1].trim();

      if (/^(Dostawca|Nabywca)$/i.test(l) && i + 1 < lines.length) {
        counterparty = lines[i + 1];
      }

      if (/^Uwagi:/i.test(l)) {
        const noteLines: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
          if (/^(Razem|Wydał|Odebrał|Podpis|Wydruk|--)/i.test(lines[j])) break;
          noteLines.push(lines[j]);
        }
        notes = noteLines.join(' ');
      }
    }

    // Wyodrębnij sekcję tabeli pozycji (od linii "Lp Nazwa..." do "|", "Uwagi:" lub "Razem")
    const tableStartIdx = lines.findIndex((l) => /^Lp\s+Nazwa/i.test(l));
    const items: WarehouseDocumentItem[] = [];

    if (tableStartIdx !== -1) {
      let itemBuffer: string[] = [];
      // Wiersz kończący pozycję na PZ/WZ/PW/RW zaczyna się od jednostki "szt." i ma po sobie Ilość oraz Ceny/Wartości
      const itemEndRegex = /^(.*?)\b(szt\.|op\.|kpl\.|kg|l)\s+(\d+(?:[.,]\d+)?)\s+(.+)$/i;

      for (let i = tableStartIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (
          line === '|' ||
          /^Razem/i.test(line) ||
          /^Uwagi:/i.test(line) ||
          /^Wydał/i.test(line) ||
          /^Wydruk pochodzi/i.test(line)
        ) {
          break;
        }

        const endMatch = line.match(itemEndRegex);
        if (endMatch) {
          const beforeUnit = (endMatch[1] || '').trim();
          if (beforeUnit) itemBuffer.push(beforeUnit);

          // Usuń z końca bufora złamany 9-cyfrowy kod PKWiU/ID wFirma (np. "3553937" i "55")
          while (
            itemBuffer.length > 1 &&
            /^\d{1,8}$/.test(itemBuffer[itemBuffer.length - 1].trim())
          ) {
            itemBuffer.pop();
          }

          let headerStr = itemBuffer.join(' ').replace(/\s+/g, ' ').trim();
          itemBuffer = [];

          // Usuń ewentualny doklejony na końcu 7-9 cyfrowy kod PKWiU w tej samej linii
          headerStr = headerStr.replace(/\s+\d{6,9}$/, '').trim();

          const lpMatch = headerStr.match(/^(\d{1,3})\s+(.+)$/);
          const lp = lpMatch ? parseInt(lpMatch[1], 10) : items.length + 1;
          const rest = lpMatch ? lpMatch[2].trim() : headerStr;

          let rawSku = '';
          let rawName = rest;

          const skuMatch = rest.match(/^((?:EAN(?:PL)?)?\d{10,14})\s+(.+)$/i);
          if (skuMatch) {
            rawSku = skuMatch[1].trim();
            rawName = skuMatch[2].trim();
          }

          const unit = endMatch[2];
          const quantity = parsePolishNumber(endMatch[3]);
          const numsStr = endMatch[4].trim();
          const numTokens: string[] = numsStr.match(/[\d\s]+,\d{2}/g) ?? [];
          const firstPrice = numTokens.length > 0 ? parsePolishNumber(numTokens[0] || '') : 0;
          const lastVal =
            numTokens.length > 0 ? parsePolishNumber(numTokens[numTokens.length - 1] || '') : 0;

          const isPartnerChannel =
            /PARTNER/i.test(rawName) || /^EAN\d/i.test(rawSku) || /PARTNER/i.test(rawSku);
          const matchedProduct = matchProductFromCatalog(rawSku, rawName, catalog);

          items.push({
            id: `doc-item-${Date.now()}-${idx}-${items.length}`,
            lp,
            rawSku: rawSku || matchedProduct?.skuRegular || '',
            rawName,
            matchedProductId: matchedProduct ? matchedProduct.id : null,
            isPartnerChannel,
            quantity,
            unit,
            unitPrice: firstPrice,
            totalValue: lastVal,
            allocatedMovements: [],
          });
        } else {
          itemBuffer.push(line);
        }
      }
    }

    documents.push({
      id: `doc-${current.docType.toLowerCase()}-${current.docNumber.replace(/\W+/g, '-')}-${idx}`,
      docType: current.docType,
      docNumber: current.docNumber,
      issueDate,
      warehouseName,
      counterparty,
      notes,
      status: 'draft',
      createdAt: new Date().toISOString(),
      items,
    });
  }

  return documents;
}

/**
 * Uniwersalny parser Faktur (FV / Invoice / Rechnung), dokumentów dostawy (WZ / PZ / Lieferschein)
 * oraz wklejonych tabel / list towarów do Planowania Przyjęcia Dostawy.
 */
export function parseUniversalDeliveryOrInvoiceText(
  rawText: string,
  catalog: ProductCatalogItem[],
  forceAsDeliveryPlan: boolean = false
): WarehouseDocument[] {
  // 1. Najpierw sprawdź standardowy format dokumentów magazynowych z wFirma (PZ, WZ, PW, RW)
  const standardDocs = parseWFirmaDocumentsText(rawText, catalog);
  if (standardDocs.length > 0) {
    if (!forceAsDeliveryPlan) return standardDocs;
    return standardDocs.map((d) => ({
      ...d,
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      docType: 'PZ',
      docNumber: d.docType === 'PZ' ? d.docNumber : `DOSTAWA (${d.docNumber})`,
      notes: d.notes
        ? `${d.notes} [Zaplanowano z dokumentu ${d.docNumber}]`
        : `Zaplanowano przyjęcie dostawy na podstawie dokumentu ${d.docNumber}`,
    }));
  }

  // 2. Jeśli to Faktura VAT (FV), Faktura Zakupu, Lieferschein, WZ w innym formacie lub wklejona lista pozycji:
  const cleaned = (rawText || '').replace(/\r\n/g, '\n');
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  let docNumber = `FV/DOSTAWA ${new Date().toLocaleDateString('pl-PL')}`;
  let issueDate = new Date().toISOString().slice(0, 10);
  let counterparty = 'Institut AllergoSan / Dostawca';

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const l = lines[i];
    const fvMatch = l.match(
      /(?:Faktura(?:\s+VAT)?(?:\s+nr)?|FV|WZ|PZ|Invoice|Lieferschein|Rechnung)\s*[:#-]?\s*([A-Z0-9/-]{3,25})/i
    );
    if (fvMatch && /\d/.test(fvMatch[1])) {
      docNumber = `DOSTAWA (${fvMatch[0].trim()})`;
    }
    const dateIso = l.match(/\b(202\d-\d{2}-\d{2})\b/);
    if (dateIso) {
      issueDate = dateIso[1];
    } else {
      const datePl = l.match(/\b(\d{2})[.-](\d{2})[.-](202\d)\b/);
      if (datePl) {
        issueDate = `${datePl[3]}-${datePl[2]}-${datePl[1]}`;
      }
    }
    if (/AllergoSan/i.test(l)) {
      counterparty = 'Institut AllergoSan Pharmazeutische Produkte';
    }
  }

  const parsedItems: WarehouseDocumentItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /^(Razem|Suma|Wartość|Podatek|Słownie|Do zapłaty|Sprzedawca|Nabywca|Bank|IBAN)/i.test(line)
    ) {
      continue;
    }

    // Spróbuj dopasować produkt z katalogu na podstawie kodu EAN lub nazwy w linii
    const eanMatch = line.match(/(?:EAN(?:PL)?)?(\d{11,14})/i);
    const rawSku = eanMatch ? eanMatch[0] : '';
    const matchedProd = matchProductFromCatalog(rawSku, line, catalog);

    if (!matchedProd) continue;

    // Wyciągnij ilość z tej linii lub sąsiedniej linii
    let quantity = 0;
    const qtyWithUnit = line.match(
      /\b(\d{1,5}(?:[.,]\d+)?)\s*(?:szt\.?|op\.?|kpl\.?|stk\.?|pcs|kart\.?)\b/i
    );
    if (qtyWithUnit) {
      quantity = Math.round(parsePolishNumber(qtyWithUnit[1]));
    } else {
      // Usuń kod EAN i liczby z nazwy produktu (np. "6", "10", "28", "60", "300", "5", "9", "1000"), aby znaleźć właściwą ilość
      const lineWithoutEan = line
        .replace(/(?:EAN(?:PL)?)?\d{10,14}/gi, ' ')
        .replace(/\b(202\d[-./]\d{2}(?:[-./]\d{2})?)\b/g, ' ')
        .replace(/\b\d+[.,]\d{2}\b/g, ' '); // Usuń ceny z groszami (np. 124,50)

      const standaloneInts = Array.from(lineWithoutEan.matchAll(/\b(\d{1,5})\b/g)).map((m) =>
        parseInt(m[1], 10)
      );
      // Odfiltruj liczby będące częścią wariantu (np. 7, 10, 14, 20, 28, 30, 40, 60, 180, 300, 450, 500, 1000) o ile jest inna liczba
      const nonVariantCandidates = standaloneInts.filter(
        (n) => ![1, 5, 6, 7, 9, 10, 14, 20, 28, 30, 40, 60, 180, 300, 450, 500, 1000].includes(n)
      );
      if (nonVariantCandidates.length > 0) {
        quantity = nonVariantCandidates[nonVariantCandidates.length - 1];
      } else if (standaloneInts.length >= 2) {
        quantity = standaloneInts[standaloneInts.length - 1];
      }
    }

    if (quantity <= 0) continue;

    const isPartnerChannel = /PARTNER/i.test(line) || /^EAN\d/i.test(rawSku);

    parsedItems.push({
      id: `uni-item-${Date.now()}-${parsedItems.length}`,
      lp: parsedItems.length + 1,
      rawSku: rawSku || matchedProd.skuRegular,
      rawName: line.length > 95 ? `${matchedProd.name} (${line.slice(0, 50)}...)` : line,
      matchedProductId: matchedProd.id,
      isPartnerChannel,
      quantity,
      unit: 'szt.',
      unitPrice: matchedProd.avgPurchasePriceNet || 0,
      totalValue: Math.round((matchedProd.avgPurchasePriceNet || 0) * quantity * 100) / 100,
      allocatedMovements: [],
    });
  }

  if (parsedItems.length === 0) return [];

  return [
    {
      id: `doc-plan-${Date.now()}`,
      docType: 'PZ',
      docNumber,
      issueDate,
      warehouseName: 'Główny Magazyn (Magazyn 4, 5, 6)',
      counterparty,
      notes: 'Odczytano automatycznie przez Asystenta Planowania Dostawy',
      status: 'draft',
      createdAt: new Date().toISOString(),
      items: parsedItems,
    },
  ];
}

export const SUSPENDED_REASON_PRESETS: {
  category: SuspendedReasonCategory;
  label: string;
  badge: string;
}[] = [
  {
    category: 'konferencja',
    label: 'Konferencja / Targi',
    badge: '🎪 Konferencja',
  },
  {
    category: 'zamowienie_pracownicze',
    label: 'Zamówienie pracownicze bez dokumentu sprzedaży',
    badge: '👤 Zam. pracownicze bez dok.',
  },
  {
    category: 'niewystawione_rw',
    label: 'Niewystawione RW',
    badge: '📋 Niewystawione RW',
  },
  {
    category: 'zwrot_bez_pw',
    label: 'Zwrot bez PW',
    badge: '↩️ Zwrot bez PW',
  },
  {
    category: 'wymiana_b2b',
    label: 'Wymiana B2B w toku',
    badge: '🔄 Wymiana B2B w toku',
  },
  {
    category: 'ponowna_wysylka',
    label: 'Ponowna wysyłka przed dostawą zwrotu',
    badge: '📦 Ponowna wysyłka przed zwrotem',
  },
  {
    category: 'inne',
    label: 'Inne uzasadnienie (własny opis)',
    badge: '✏️ Inne wyjaśnienie',
  },
];

export function detectSuspendedReasonCategory(text: string): {
  category: SuspendedReasonCategory;
  cleanReason: string;
} {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();
  if (/konferenc|targi|kongres|sympozjum|event/i.test(lower)) {
    return { category: 'konferencja', cleanReason: raw || 'Konferencja' };
  }
  if (/pracownicz|bez\s*dok/i.test(lower)) {
    return {
      category: 'zamowienie_pracownicze',
      cleanReason: raw || 'Zamówienie pracownicze bez dokumentu sprzedaży',
    };
  }
  if (/niewystawion[ey]\s*rw|\brw\b/i.test(lower)) {
    return { category: 'niewystawione_rw', cleanReason: raw || 'Niewystawione RW' };
  }
  if (/zwrot\s*bez\s*pw|\bpw\b/i.test(lower)) {
    return { category: 'zwrot_bez_pw', cleanReason: raw || 'Zwrot bez PW' };
  }
  if (/wymian[ay]\s*b2b|\bb2b\b/i.test(lower)) {
    return { category: 'wymiana_b2b', cleanReason: raw || 'Wymiana B2B w toku' };
  }
  if (/ponown[ae]\s*wysy[łl]k|przed\s*dostaw[aą]\s*zwrotu/i.test(lower)) {
    return {
      category: 'ponowna_wysylka',
      cleanReason: raw || 'Ponowna wysyłka przed dostawą zwrotu',
    };
  }
  return { category: 'inne', cleanReason: raw || 'Wydane bez dokumentu' };
}

function matchProductByShorthandText(
  text: string,
  catalog: ProductCatalogItem[]
): ProductCatalogItem | null {
  // Usuń początkową ilość np. "30 op.", "6 szt." z tekstu przed szukaniem nazwy produktu
  const withoutLeadingQty = (text || '')
    .replace(/^\s*\d{1,5}\s*(?:op\.?|opak\.?|szt\.?|kpl\.?|kart\.?)\s+/i, '')
    .replace(/^\s*\d{1,5}\s+(?=[a-ząćęłńóśźż])/i, '')
    .trim();

  // Jeśli po odjęciu liczby zostały wyłącznie słowa kluczowe uzasadnienia (np. "zamówienie pracownicze...", "niewystawione RW"),
  // NIE próbuj dopasowywać tego jako nazwy produktu!
  if (
    /^(konferenc|targi|zam[oó]wieni|pracownicz|niewystawion|zwrot|wymian|ponown|pr[oó]bk|brak|reklamacj)/i.test(
      withoutLeadingQty
    )
  ) {
    return null;
  }

  const direct = matchProductFromCatalog('', withoutLeadingQty, catalog);
  if (direct) return direct;

  const lower = withoutLeadingQty
    .toLowerCase()
    .replace(/omni[\s-]*biotic®?/g, '')
    .replace(/omni[\s-]*logic®?/g, '')
    .replace(/[^a-z0-9ąćęłńóśźż\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!lower) return null;
  const tokens = lower.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  let bestProd: ProductCatalogItem | null = null;
  let bestScore = 0;

  for (const prod of catalog) {
    const prodSearch = `${prod.shortName} ${prod.name}`
      .toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźż\s]/g, ' ')
      .replace(/\s+/g, ' ');
    const prodWords = prodSearch.split(' ').filter(Boolean);

    let score = 0;
    let matchedNameWord = false;

    for (const tk of tokens) {
      if (
        /^(op|opak|szt|sasz|kaps|konferencja|targi|rw|pw|wz|zamowienie|pracownicze|bez|dokumentu|sprzedazy|niewystawione|zwrot|wymiana|b2b|toku|ponowna|wysylka|przed|dostawa)$/.test(
          tk
        )
      ) {
        continue;
      }

      if (prodWords.includes(tk)) {
        if (/^\d+$/.test(tk)) {
          score += 3; // Zgodna wielkość opakowania (np. 30, 28, 14, 7, 56)
        } else {
          score += 5; // Dokładne słowo nazwy (np. panda, stress, hetox)
          matchedNameWord = true;
        }
      } else if (tk.length >= 3 && prodWords.some((pw) => pw.startsWith(tk) || tk.startsWith(pw))) {
        score += 3;
        if (!/^\d+$/.test(tk)) matchedNameWord = true;
      }
    }

    if (matchedNameWord && score > bestScore) {
      bestScore = score;
      bestProd = prod;
    }
  }

  return bestScore >= 3 ? bestProd : null;
}

/**
 * Inteligentny parser wklejonych lub wgranych wyjaśnień towarów "W zawieszeniu / Bez dokumentu":
 * Rozpoznaje zarówno wpisy wielowierszowe, jak i wpisy po przecinku w jednej linii, np.:
 * "30 op. panda 30 - konferencja, 6 zamówienie pracownicze bez dokumentu sprzedaży, 4 niewystawione RW"
 */
export function parseSuspendedJustificationsText(
  rawText: string,
  catalog: ProductCatalogItem[],
  fallbackProductId?: string
): {
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  category: SuspendedReasonCategory;
}[] {
  const lines = (rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const fallbackProd = fallbackProductId
    ? catalog.find((p) => p.id === fallbackProductId) || null
    : null;

  const results: {
    productId: string;
    productName: string;
    quantity: number;
    reason: string;
    category: SuspendedReasonCategory;
  }[] = [];

  for (const line of lines) {
    // Podziel po przecinku lub średniku, jeśli w jednej linii wymieniono kilka powodów dla tego samego produktu
    const segments = line
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    let lastMatchedProduct: ProductCatalogItem | null = fallbackProd;

    for (const seg of segments) {
      const eanMatch = seg.match(/(?:EAN(?:PL)?)?(\d{11,14})/i);
      const rawSku = eanMatch ? eanMatch[0] : '';

      // Oddziel część przed myślnikiem i po myślniku (np. "30 op. panda 30 - konferencja")
      const dashParts = seg.split(/\s+[-–—:]\s+/);
      const leftPart = dashParts[0] || seg;
      const rightPart = dashParts.slice(1).join(' - ').trim();

      let matchedProd =
        (rawSku ? matchProductFromCatalog(rawSku, leftPart, catalog) : null) ||
        matchProductByShorthandText(leftPart, catalog) ||
        (rightPart ? matchProductByShorthandText(rightPart, catalog) : null);

      if (matchedProd) {
        lastMatchedProduct = matchedProd;
      } else if (lastMatchedProduct) {
        matchedProd = lastMatchedProduct;
      }

      if (!matchedProd) continue;

      // Wyciągnij ilość (np. "30 op.", "6 szt.", albo pierwszą liczbę na początku segmentu)
      let quantity = 1;
      const qtyAtStart = seg.match(/^\s*(\d{1,5})\s*(?:op\.?|opak\.?|szt\.?|kpl\.?|kart\.?)?\b/i);
      if (qtyAtStart) {
        quantity = parseInt(qtyAtStart[1], 10);
      } else {
        const qtyWithUnitAnywhere = seg.match(/\b(\d{1,5})\s*(?:op\.?|opak\.?|szt\.?|kpl\.?)\b/i);
        if (qtyWithUnitAnywhere) {
          quantity = parseInt(qtyWithUnitAnywhere[1], 10);
        }
      }

      // Wyciągnij tekst uzasadnienia
      let reasonText = rightPart;
      if (!reasonText) {
        // Jeśli nie było myślnika (np. "6 zamówienie pracownicze bez dokumentu sprzedaży" albo "zwrot bez PW"),
        // usuń początkową liczbę i ewentualną nazwę produktu
        reasonText = seg
          .replace(/^\s*\d{1,5}\s*(?:op\.?|opak\.?|szt\.?|kpl\.?)?\s*/i, '')
          .trim();
      }

      const detected = detectSuspendedReasonCategory(reasonText);

      results.push({
        productId: matchedProd.id,
        productName: matchedProd.shortName,
        quantity: Math.max(1, quantity),
        reason: detected.cleanReason,
        category: detected.category,
      });
    }
  }

  return results;
}



