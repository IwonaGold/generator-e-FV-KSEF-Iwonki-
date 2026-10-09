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
 * Normalizuje odczytany numer partii LOT (koryguje typowe artefakty nadruku punktowego inkjet/dot-matrix,
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
 * ZAWSZE szukamy LOT: (oraz wariantów OCR nadruku punktowego: L0T, LOI, LNT, LOY, LAT)
 * i sczytujemy wszystko co po nim następuje
 */
export function extractLotAfterPrefix(text: string): string {
  if (!text) return '';

  // 1. Szukaj bezpośrednio LOT: (oraz wariantów OCR dla czcionki punktowej inkjet)
  const lotRegex = /(?:L[O0NAT][TIY1])\s*[:.;=\-]?\s*([A-Za-z0-9\-_/]{4,18})/gi;
  let match: RegExpExecArray | null;
  while ((match = lotRegex.exec(text)) !== null) {
    const extracted = normalizeLotCandidate(match[1]);
    if (
      extracted &&
      extracted.length >= 4 &&
      !/^(MHD|MDH|BBE|EXP|DATE|ART|NR)$/i.test(extracted)
    ) {
      return extracted;
    }
  }

  // 2. Obsługa GS1 AI (10)
  const gs1Lot = text.match(/\(10\)([a-zA-Z0-9\-_/]+)/);
  if (gs1Lot) {
    return normalizeLotCandidate(gs1Lot[1]);
  }

  return '';
}

/**
 * ZAWSZE szukamy MHD:, MDH:, BBE: lub EXP: (oraz wariantów OCR dla nadruku punktowego BBE na kolorowych ściankach)
 * i odczytujemy datę ważności (zawsze ostatni dzień miesiąca dla formatu miesiąc/rok, np. 09/27 -> 2027-09-30)
 */
export function extractMhdDateAfterPrefix(text: string): string {
  if (!text) return '';

  // 1. Szukaj MHD:, MDH:, BBE:, EXP: oraz wariantów odczytu czcionki punktowej BBE (np. BRE, PRE, RBE, WBE, FEE, EBE, BEE, 8BE, B8E)
  const prefixPattern =
    /(?:MHD|MDH|MH0|MHO|BBE|EXP|[BPRWFE8][BPRE8][EB])[A-Za-z]?\s*[:.;=\-]?\s*([0O1]\d\s*[./\- ]\s*\d{1,2}\s*[./\- ]\s*\d{2,4}|[0O1]?\d\s*[./\- ]\s*\d{2,4}|\d{4})/gi;

  let match: RegExpExecArray | null;
  while ((match = prefixPattern.exec(text)) !== null) {
    const raw = match[1].trim().replace(/O/gi, '0');

    // Pełna data DD.MM.YYYY lub DD/MM/YYYY
    const dmy = raw.match(/^(\d{1,2})\s*[./\- ]\s*(\d{1,2})\s*[./\- ]\s*(\d{2,4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10);
      let y = parseInt(dmy[3], 10);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // Miesiąc i rok: MM/YYYY, MM.YYYY, MM/YY, MM.YY, MM-YY, MM YY (np. 09/27 -> 2027-09-30)
    const my = raw.match(/^(\d{1,2})\s*[./\- ]\s*(\d{2,4})$/);
    if (my) {
      const m = parseInt(my[1], 10);
      const y = parseInt(my[2], 10);
      if (m >= 1 && m <= 12) {
        return calculateLastDayOfMonth(m, y);
      }
    }

    // Zapis 4 cyfr MMYY np. 0927 lub 0627
    if (/^\d{4}$/.test(raw)) {
      const m = parseInt(raw.slice(0, 2), 10);
      const y = 2000 + parseInt(raw.slice(2, 4), 10);
      if (m >= 1 && m <= 12) {
        return calculateLastDayOfMonth(m, y);
      }
    }
  }

  // 2. Fallback: jeśli w tym samym bloku znaleziono już LOT:, szukaj bezpośrednio po linii LOT wzorca daty MM/RR (np. 09/27)
  if (/(?:L[O0NAT][TIY1])\s*[:.;=\-]?\s*[A-Za-z0-9]{4,}/i.test(text)) {
    const fallbackMy = text.match(/\b(0[1-9]|1[0-2])\s*[./\-]\s*(2[4-9]|3[0-5]|202[4-9]|203[0-5])\b/);
    if (fallbackMy) {
      const m = parseInt(fallbackMy[1], 10);
      const y = parseInt(fallbackMy[2], 10);
      return calculateLastDayOfMonth(m, y);
    }
  }

  // 3. Obsługa GS1 AI (17)YYMMDD
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
 * Przygotowuje Canvas i wycina wybrany fragment z adaptacyjną obróbką obrazu:
 * - Dla jasnych etykiet i białych naklejek (LOT / MHD / MDH): wykorzystuje kanał luminancji
 *   i lokalną normalizację tła, zachowując ostrość zarówno czarnego druku, jak i kolorowych logotypów.
 * - Dla ciemnych/kolorowych ścianek opakowań (np. bordowa ścianka OMNi-BiOTiC z czarnym nadrukiem LOT / BBE):
 *   wykorzystuje kanał max(R, G, B), tłumi białe napisy zakłócające (np. Art.-Nr.) wraz z otoczką kompresji JPEG,
 *   a następnie wzmacnia czarny nadruk punktowy (dot-matrix/inkjet) względem lokalnego 70. percentyla tła.
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
        sWidth = Math.max(1, Math.min(naturalWidth - sx, Math.floor((cropArea.width / 100) * naturalWidth)));
        sHeight = Math.max(1, Math.min(naturalHeight - sy, Math.floor((cropArea.height / 100) * naturalHeight)));
      }

      let scale = 1.0;
      if (sWidth < 900) {
        scale = Math.min(3.0, 1400 / sWidth);
      }
      const dWidth = Math.round(sWidth * scale);
      const dHeight = Math.round(sHeight * scale);

      // Krok 1: Odczyt natywnych pikseli 1:1 wycinka (przed skalowaniem), aby uniknąć rozmycia pojedynczych kropek nadruku dot-matrix
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

      // Krok 3: Szybki przesuwny histogram 256-kubłkowy wyznaczający lokalny 70. percentyl tła (25. najjaśniejszy z 81 punktów)
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
          const whitePoint = isDark ? 0.92 : 0.90;

          const v00 = ratioSrc[y0 * sWidth + x0];
          const v10 = ratioSrc[y0 * sWidth + x1];
          const v01 = ratioSrc[y1 * sWidth + x0];
          const v11 = ratioSrc[y1 * sWidth + x1];
          const r = (1 - wy) * ((1 - wx) * v00 + wx * v10) + wy * ((1 - wx) * v01 + wx * v11);

          const norm = Math.max(0, Math.min(1, (r - blackPoint) / (whitePoint - blackPoint)));
          gray[dRow + dx] = norm * 255;
        }
      }

      // Krok 5: Delikatne wygładzenie 3x3 (eliminuje szum i łączy sąsiednie punkty druku dot-matrix)
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
  let fullText = file.name.toLowerCase();

  // Jeśli na fakturze jest tylko 1 pozycja, zdjęcie automatycznie do niej należy
  if (invoiceItems && invoiceItems.length === 1) {
    return {
      recognizedProductName: invoiceItems[0].name,
      recognizedGtin: invoiceItems[0].gtin || '',
      matchedInvoiceItemId: invoiceItems[0].id,
      matchedInvoiceItemIndex: 1,
      isConfident: true,
    };
  }

  try {
    const { dataUrl } = await prepareCanvasFragment(file);
    const ocrText = (await runOcrEngine(dataUrl)) || '';
    fullText = `${file.name} ${ocrText}`.toLowerCase();

    // 1. Szukaj GTIN / EAN (8 lub 13 cyfr)
    const gtinMatch = fullText.match(/\b(590\d{10}|912\d{10}|\d{13}|\d{8})\b/);
    if (gtinMatch) {
      recognizedGtin = gtinMatch[1];
    }

    // 2. Szukaj pełnej nazwy handlowej leku
    for (const item of invoiceItems) {
      const nameParts = item.name
        .toLowerCase()
        .split(/[\s,()\-®™]+/)
        .filter((w) => w.length >= 3);
      if (nameParts.length > 0 && nameParts.every((part) => fullText.includes(part))) {
        recognizedName = item.name;
        break;
      }
    }
  } catch (err) {
    console.error('Błąd Etapu 1:', err);
  }

  // Priorytety dopasowania: 1. Po kodzie GTIN
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

  // 2. Dokładne dopasowanie pełnej nazwy
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

  // 3. Dopasowanie po słowach kluczowych / wyróżnikach produktu (np. TRAVEL, STRESS, PANDA, FLORA) w pełnym tekście OCR
  let bestIdx = -1;
  let bestScore = 0;

  for (let idx = 0; idx < invoiceItems.length; idx++) {
    const item = invoiceItems[idx];
    const words = item.name
      .toLowerCase()
      .split(/[\s,()\-®™]+/)
      .filter((w) => w.length >= 3 && !/^(szt|op|opak|sasz|kaps|tabl)$/i.test(w));

    let score = 0;
    for (const w of words) {
      if (fullText.includes(w)) {
        // Słowa wyróżniające dany wariant (np. travel, stress, panda, repair), które nie występują w każdej pozycji faktury, punktujemy wyżej
        const occurrencesInInvoice = invoiceItems.filter((other) =>
          other.name.toLowerCase().includes(w)
        ).length;
        score += occurrencesInInvoice === 1 ? 3 : 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  if (bestIdx !== -1 && bestScore >= 2) {
    const matched = invoiceItems[bestIdx];
    return {
      recognizedProductName: matched.name,
      recognizedGtin: recognizedGtin || matched.gtin || '',
      matchedInvoiceItemId: matched.id,
      matchedInvoiceItemIndex: bestIdx + 1,
      isConfident: true,
    };
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
 * ETAP 2: ODCZYT LOT ORAZ MHD / MDH / BBE
 * ZAWSZE szukamy „LOT:” i sczytujemy wszystko po nim,
 * oraz „MHD:”, „MDH:” lub „BBE:” i odczytujemy datę ważności (ostatni dzień miesiąca).
 * Obsługuje zarówno białe naklejki, jak i czarny nadruk na kolorowych opakowaniach.
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
        { name: 'Środkowa ścianka / Klapa (LOT / BBE / MHD)', crop: { x: 20, y: 50, width: 55, height: 18 } },
        { name: 'Cały obraz (biała naklejka / etykieta)' },
        { name: 'Węższa strefa nadruku (LOT / BBE)', crop: { x: 25, y: 54, width: 45, height: 13 } },
        { name: 'Szersza ścianka środkowa / dolna', crop: { x: 15, y: 48, width: 70, height: 22 } },
        { name: 'Spód / Krawędź opakowania', crop: { x: 5, y: 50, width: 90, height: 45 } },
        { name: 'Górna część opakowania', crop: { x: 5, y: 5, width: 90, height: 48 } },
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

      // 2. Zawsze szukamy MHD:, MDH: lub BBE: i odczytujemy datę
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

