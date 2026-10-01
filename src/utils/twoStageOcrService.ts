import { InvoiceItem } from '../types/ksef';
import { BatchRecord } from '../types/twoStageOcr';
import Tesseract from 'tesseract.js';

/**
 * Oblicza ostatni dzień wskazanego miesiąca i roku (uwzględnia lata przestępne)
 * np. 06/27 -> 2027-06-30, 11/2027 -> 2027-11-30, 02/28 -> 2028-02-29
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
 * Normalizuje ręcznie wpisywaną datę (YYYY-MM-DD, DD.MM.YYYY, MM/YYYY, MM/YY, MM.YY, MMYY)
 * Dla formatu miesiąc/rok ZAWSZE wylicza ostatni dzień wskazanego miesiąca!
 */
export function normalizeManualDate(val: string): string {
  if (!val) return '';
  val = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  const dmy = val.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmy) {
    let d = parseInt(dmy[1], 10);
    let m = parseInt(dmy[2], 10);
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const my = val.match(/^(\d{1,2})[./\-](\d{2,4})$/);
  if (my) {
    let m = parseInt(my[1], 10);
    let y = parseInt(my[2], 10);
    return calculateLastDayOfMonth(m, y);
  }

  if (/^\d{4}$/.test(val)) {
    let m = parseInt(val.slice(0, 2), 10);
    let y = 2000 + parseInt(val.slice(2, 4), 10);
    return calculateLastDayOfMonth(m, y);
  }

  return val;
}

/**
 * ZAWSZE szukamy LOT: i sczytujemy wszystko co po nim następuje
 */
export function extractLotAfterPrefix(text: string): string {
  if (!text) return '';

  // 1. Szukaj bezpośrednio LOT: (oraz LOT z dwukropkiem, kropką lub spacją)
  const lotMatch = text.match(/LOT\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i);
  if (lotMatch) {
    const extracted = lotMatch[1].trim().toUpperCase();
    if (extracted && !/^(MHD|BBE|EXP|DATE)$/i.test(extracted)) {
      return extracted;
    }
  }

  // 2. Obsługa GS1 AI (10)
  const gs1Lot = text.match(/\(10\)([a-zA-Z0-9\-_/]+)/);
  if (gs1Lot) {
    return gs1Lot[1].trim().toUpperCase();
  }

  return '';
}

/**
 * ZAWSZE szukamy MHD: lub BBE: i odczytujemy datę
 * (zawsze ostatni dzień miesiąca dla formatu miesiąc/rok)
 */
export function extractMhdDateAfterPrefix(text: string): string {
  if (!text) return '';

  // 1. Szukaj bezpośrednio MHD: lub BBE: (lub EXP:) z dwukropkiem, kropką lub spacją
  const mhdMatch = text.match(
    /(?:MHD|BBE|EXP)\s*[:.]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}|\d{1,2}[./\-]\d{2,4}|\d{4})/i
  );

  if (mhdMatch) {
    const raw = mhdMatch[1].trim();

    // Pełna data DD.MM.YYYY lub DD/MM/YYYY
    const dmy = raw.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
    if (dmy) {
      let d = parseInt(dmy[1], 10);
      let m = parseInt(dmy[2], 10);
      let y = parseInt(dmy[3], 10);
      if (y < 100) y += 2000;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Miesiąc i rok: MM/YYYY, MM.YYYY, MM/YY, MM.YY, MM-YY
    const my = raw.match(/^(\d{1,2})[./\-](\d{2,4})$/);
    if (my) {
      let m = parseInt(my[1], 10);
      let y = parseInt(my[2], 10);
      return calculateLastDayOfMonth(m, y);
    }

    // Zapis 4 cyfr MMYY np. 0627
    if (/^\d{4}$/.test(raw)) {
      let m = parseInt(raw.slice(0, 2), 10);
      let y = 2000 + parseInt(raw.slice(2, 4), 10);
      return calculateLastDayOfMonth(m, y);
    }
  }

  // 2. Obsługa GS1 AI (17)YYMMDD
  const gs1Mhd = text.match(/\(17\)(\d{6})/);
  if (gs1Mhd) {
    const yy = parseInt(gs1Mhd[1].slice(0, 2), 10);
    const mm = parseInt(gs1Mhd[1].slice(2, 4), 10);
    let dd = parseInt(gs1Mhd[1].slice(4, 6), 10);
    const year = 2000 + yy;
    if (dd === 0 || isNaN(dd)) {
      dd = new Date(year, mm, 0).getDate();
    }
    return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  return '';
}

/**
 * Przygotowuje Canvas i wycina wybrany fragment z kontrastem dla tuszu inkjet
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
        sWidth = Math.min(naturalWidth - sx, Math.floor((cropArea.width / 100) * naturalWidth));
        sHeight = Math.min(naturalHeight - sy, Math.floor((cropArea.height / 100) * naturalHeight));
      }

      let dWidth = sWidth;
      let dHeight = sHeight;
      if (dWidth < 900) {
        const scale = Math.min(3, 1400 / dWidth);
        dWidth = Math.round(dWidth * scale);
        dHeight = Math.round(dHeight * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = dWidth;
      canvas.height = dHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({ dataUrl: '', base64: '' });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, dWidth, dHeight);

      // Zwiększenie kontrastu (czarny tusz na jasnym tle)
      const imgData = ctx.getImageData(0, 0, dWidth, dHeight);
      const data = imgData.data;
      const contrast = 1.3;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }
      ctx.putImageData(imgData, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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
 * ETAP 1: ROZPOZNANIE WYŁĄCZNIE PRODUKTU (BEZ ODCZYTU LOT I MHD/BBE)
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
}> {
  let recognizedName = '';
  let recognizedGtin = '';

  try {
    const { dataUrl } = await prepareCanvasFragment(file);
    const ocrText = (await runOcrEngine(dataUrl)) || '';
    const fullText = `${file.name} ${ocrText}`.toLowerCase();

    // 1. Szukaj GTIN / EAN (8 lub 13 cyfr)
    const gtinMatch = fullText.match(/\b(590\d{10}|912\d{10}|\d{13}|\d{8})\b/);
    if (gtinMatch) {
      recognizedGtin = gtinMatch[1];
    }

    // 2. Szukaj nazwy handlowej leku
    for (const item of invoiceItems) {
      const nameParts = item.name.toLowerCase().split(/[\s,()\-]+/).filter((w) => w.length >= 3);
      if (nameParts.length > 0 && nameParts.every((part) => fullText.includes(part))) {
        recognizedName = item.name;
        break;
      }
    }
  } catch (err) {
    console.error('Błąd Etapu 1:', err);
  }

  // Priorytety dopasowania
  if (recognizedGtin) {
    const gtinIdx = invoiceItems.findIndex(
      (it) => it.gtin && it.gtin.replace(/\D/g, '') === recognizedGtin.replace(/\D/g, '')
    );
    if (gtinIdx !== -1) {
      return {
        recognizedProductName: invoiceItems[gtinIdx].name,
        recognizedGtin,
        matchedInvoiceItemId: invoiceItems[gtinIdx].id,
        matchedInvoiceItemIndex: gtinIdx + 1,
        isConfident: true,
      };
    }
  }

  if (recognizedName) {
    const nameIdx = invoiceItems.findIndex((it) => it.name === recognizedName);
    if (nameIdx !== -1) {
      return {
        recognizedProductName: recognizedName,
        recognizedGtin: recognizedGtin || invoiceItems[nameIdx].gtin || '',
        matchedInvoiceItemId: invoiceItems[nameIdx].id,
        matchedInvoiceItemIndex: nameIdx + 1,
        isConfident: true,
      };
    }
  }

  const searchName = (recognizedName || file.name).toLowerCase();
  for (let idx = 0; idx < invoiceItems.length; idx++) {
    const item = invoiceItems[idx];
    const words = item.name.toLowerCase().split(/[\s,()\-]+/).filter((w) => w.length >= 4);
    const matchesCount = words.filter((w) => searchName.includes(w)).length;
    if (matchesCount >= 2 || (words.length > 0 && searchName.includes(words[0]) && searchName.includes(words[1] || ''))) {
      return {
        recognizedProductName: item.name,
        recognizedGtin: recognizedGtin || item.gtin || '',
        matchedInvoiceItemId: item.id,
        matchedInvoiceItemIndex: idx + 1,
        isConfident: true,
      };
    }
  }

  return {
    recognizedProductName: recognizedName || file.name,
    recognizedGtin,
    matchedInvoiceItemId: undefined,
    matchedInvoiceItemIndex: undefined,
    isConfident: false,
  };
}

/**
 * ============================================================================
 * ETAP 2: ODCZYT LOT ORAZ MHD / BBE
 * ZAWSZE szukamy „LOT:” i sczytujemy wszystko po nim,
 * oraz „MHD:” lub „BBE:” i odczytujemy datę ważności (ostatni dzień miesiąca).
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

  const candidateZones: Array<{ name: string; crop?: { x: number; y: number; width: number; height: number } }> = customCropArea
    ? [{ name: 'Zaznaczony fragment', crop: customCropArea }]
    : [
        { name: 'Cały obraz' },
        { name: 'Spód / Krawędź opakowania', crop: { x: 0, y: 50, width: 100, height: 50 } },
        { name: 'Okolice etykiety / kodu', crop: { x: 40, y: 15, width: 60, height: 85 } },
        { name: 'Górna część opakowania', crop: { x: 0, y: 0, width: 100, height: 50 } },
      ];

  let scannedCount = 0;

  for (const zone of candidateZones) {
    try {
      const { dataUrl } = await prepareCanvasFragment(file, zone.crop);
      if (!dataUrl) continue;

      scannedCount++;
      const text = await runOcrEngine(dataUrl);
      combinedOcrText += ` [${zone.name}]: ${text}`;

      // 1. Zawsze szukamy LOT: i sczytujemy wszystko po nim
      if (!foundLot) {
        const lotExtracted = extractLotAfterPrefix(text);
        if (lotExtracted) foundLot = lotExtracted;
      }

      // 2. Zawsze szukamy MHD: lub BBE: i odczytujemy datę
      if (!foundMhd) {
        const mhdExtracted = extractMhdDateAfterPrefix(text);
        if (mhdExtracted) foundMhd = mhdExtracted;
      }

      // Jeśli znaleźliśmy już oba, kończymy
      if (foundLot && foundMhd) {
        break;
      }
    } catch (zoneErr) {
      console.warn(`Błąd strefy ${zone.name}:`, zoneErr);
    }
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
