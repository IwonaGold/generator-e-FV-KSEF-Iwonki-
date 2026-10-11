import {
  ProductCatalogItem,
  WarehouseDocType,
  WarehouseDocument,
  WarehouseDocumentItem,
  WFirmaInventoryRow,
  WFirmaInventorySnapshot,
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
  const normName = (rawName || '')
    .toLowerCase()
    .replace(/PARTNER/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

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

  // 3. Dopasowanie po nazwie (dla pozycji bez kodu EAN, np. "PRÓBKA Z ULOTKĄ PRO-VI", "Torba termiczna MikroSan")
  if (normName) {
    // Sprawdź czy w katalogu jest próbka odpowiadająca tej samej linii produktowej
    for (const p of catalog) {
      const pNorm = p.name
        .toLowerCase()
        .replace(/PARTNER/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (pNorm === normName || p.shortName.toLowerCase() === normName) {
        return p;
      }
    }

    // Dopasowanie próbek (np. "SKLEP B2C - PRÓBKA Z ULOTKĄ - OMNi BiOTiC® PRO-VI" <-> "PRÓBKA Z ULOTKĄ PRO-VI")
    for (const p of catalog) {
      const pNorm = p.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normName.includes(pNorm) || pNorm.includes(normName)) {
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
