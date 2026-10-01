import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { extractLotAfterPrefix, extractMhdDateAfterPrefix } from './src/utils/twoStageOcrService';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Buforowanie schematów XSD FA(3) w pamięci serwera
let cachedSchemas: { fileName: string; contents: string }[] | null = null;

function loadFa3Schemas(): { fileName: string; contents: string }[] {
  if (cachedSchemas) return cachedSchemas;

  const schemaDir = path.join(process.cwd(), 'src', 'schemas', 'fa3');
  const schemaXsd = fs.readFileSync(path.join(schemaDir, 'schemat.xsd'), 'utf8')
    .replace('http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/StrukturyDanych_v10-0E.xsd', 'StrukturyDanych_v10-0E.xsd');
  
  const strukturyXsd = fs.readFileSync(path.join(schemaDir, 'StrukturyDanych_v10-0E.xsd'), 'utf8')
    .replace('http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/ElementarneTypyDanych_v10-0E.xsd', 'ElementarneTypyDanych_v10-0E.xsd');
  
  const elementarneXsd = fs.readFileSync(path.join(schemaDir, 'ElementarneTypyDanych_v10-0E.xsd'), 'utf8')
    .replace('http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/KodyKrajow_v10-0E.xsd', 'KodyKrajow_v10-0E.xsd');
  
  const kodyKrajowXsd = fs.readFileSync(path.join(schemaDir, 'KodyKrajow_v10-0E.xsd'), 'utf8');

  cachedSchemas = [
    { fileName: 'KodyKrajow_v10-0E.xsd', contents: kodyKrajowXsd },
    { fileName: 'ElementarneTypyDanych_v10-0E.xsd', contents: elementarneXsd },
    { fileName: 'StrukturyDanych_v10-0E.xsd', contents: strukturyXsd },
    { fileName: 'schemat.xsd', contents: schemaXsd },
  ];
  return cachedSchemas;
}

/**
 * OFICJALNA RZECZYWISTA WALIDACJA XSD FA(3) KSEF (libxml2 / xmllint-wasm)
 */
app.post('/api/validate-ksef-xsd', async (req: Request, res: Response) => {
  const { xml } = req.body;

  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ error: 'Brak zawartości XML do walidacji' });
  }

  try {
    const { validateXML } = await import('xmllint-wasm');
    const schemas = loadFa3Schemas();

    const result = await validateXML({
      xml: [{ fileName: 'faktura.xml', contents: xml }],
      schema: schemas,
    });

    const parsedErrors = (result.errors || []).map((err: any) => {
      const raw = err.message || err.rawMessage || '';
      const line = err.loc ? err.loc.lineNumber : undefined;

      let element: string | undefined = undefined;
      const elemMatch = raw.match(/Element '(?:\S+?:)?(?:\{[^}]+\})?([^']+)'/);
      if (elemMatch) {
        element = elemMatch[1];
      }

      let expected: string | undefined = undefined;
      const expMatch = raw.match(/Expected is (?:one of )?\(([^)]+)\)/i);
      if (expMatch) {
        expected = expMatch[1]
          .replace(/\{http:\/\/[^}]+\}/g, '')
          .split(',')
          .map((s: string) => s.trim())
          .join(', ');
      }

      const cleanMessage = raw
        .replace(/^faktura\.xml:\d+:\s*/, '')
        .replace(/^Schemas validity error\s*:\s*/i, '')
        .trim();

      return {
        lineNumber: line,
        element,
        message: cleanMessage,
        rawMessage: raw,
        expected,
      };
    });

    return res.json({
      valid: Boolean(result.valid),
      schema: 'FA(3) wzór 13775, wersja 1-0E (Ministerstwo Finansów / KSeF)',
      errorsCount: parsedErrors.length,
      errors: parsedErrors,
    });
  } catch (error: any) {
    console.error('Błąd podczas walidacji XSD:', error);
    return res.status(500).json({
      error: 'Wystąpił błąd silnika walidacji XSD',
      details: error.message || String(error),
    });
  }
});

/**
 * ETAP 1: ROZPOZNANIE WYŁĄCZNIE PRODUKTU (BEZ ODCZYTU LOT I MHD)
 */
app.post('/api/recognize-product-only', async (req: Request, res: Response) => {
  const { fileName, invoiceItems } = req.body;

  let recognizedName = '';
  let recognizedGtin = '';

  const fullText = (fileName || '').toLowerCase();
  const gtinMatch = fullText.match(/\b(590\d{10}|912\d{10}|\d{13}|\d{8})\b/);
  if (gtinMatch) {
    recognizedGtin = gtinMatch[1];
  }

  let matchedItemId = null;
  let isConfident = false;

  if (Array.isArray(invoiceItems)) {
    if (recognizedGtin) {
      const found = invoiceItems.find((it: any) => it.gtin && it.gtin.replace(/\D/g, '') === recognizedGtin.replace(/\D/g, ''));
      if (found) {
        matchedItemId = found.id;
        recognizedName = found.name;
        isConfident = true;
      }
    }

    if (!matchedItemId) {
      for (const item of invoiceItems) {
        const words = item.name.toLowerCase().split(/[\s,()\-]+/).filter((w: string) => w.length >= 4);
        if (words.some((w: string) => fullText.includes(w))) {
          matchedItemId = item.id;
          recognizedName = item.name;
          isConfident = true;
          break;
        }
      }
    }
  }

  return res.json({
    productName: recognizedName || fileName || '',
    gtin: recognizedGtin,
    matchedItemId,
    isConfident,
  });
});

/**
 * ETAP 2: ODCZYT LOT I MHD
 * Zgodnie z wytyczną użytkownika:
 * Zawsze szukamy LOT: i sczytujemy wszystko po nim, oraz MHD: i odczytujemy datę.
 */
app.post('/api/extract-lot-mhd-stage2', async (req: Request, res: Response) => {
  const { fileName, defaultQuantity } = req.body;

  const lot = extractLotAfterPrefix(fileName || '');
  const mhd = extractMhdDateAfterPrefix(fileName || '');

  const isLotOk = Boolean(lot);
  const isMhdOk = Boolean(mhd);

  return res.json({
    batches: [
      {
        lot,
        mhd,
        quantity: defaultQuantity || 1,
        lotConfidence: isLotOk,
        mhdConfidence: isMhdOk,
      },
    ],
    rawText: fileName || '',
  });
});

/**
 * PRODUKCYJNA ANALIZA ZDJĘĆ Z UŻYCIEM GEMINI 2.5 FLASH (@google/genai)
 */
app.post('/api/ocr-extract', async (req: Request, res: Response) => {
  const { imageBase64, mimeType, fileName, targetProductName } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(400).json({ error: 'Brak skonfigurowanego klucza GEMINI_API_KEY w pliku .env' });
  }

  try {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const promptText =
      'Przeanalizuj etykietę leku farmaceutycznego. Wyodrębnij:\n' +
      '- batchNumber (Numer serii / LOT / Seria / Ch.-B. - sam numer, bez przedrostka)\n' +
      '- expiryDate (Data ważności w formacie RRRR-MM-DD. UWAGA: jeśli na opakowaniu podano tylko miesiąc i rok, np. 11/2027 lub 08.26, oblicz i wpisz dokładnie ostatni dzień tego miesiąca: 2027-11-30 lub 2026-08-31)\n' +
      '- gtin (kod EAN/GTIN 13-14 cyfr, jeśli widoczny)\n' +
      '- productName (Nazwa handlowa produktu/leku, jeśli widoczna)\n' +
      (targetProductName ? `Dodatkowa wskazówka: Szukany produkt z faktury to "${targetProductName}".\n` : '') +
      'Zwróć wynik jako JSON.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      batchNumber: parsed.batchNumber || '',
      expiryDate: parsed.expiryDate || '',
      gtin: parsed.gtin || '',
      productName: parsed.productName || '',
      rawText: response.text || '',
    });
  } catch (error: any) {
    console.error('Server OCR extract error:', error);
    return res.status(500).json({ error: error.message || 'Błąd analizy Gemini API' });
  }
});

/**
 * PARSOWANIE ZAMÓWIEŃ Z PLIKÓW PDF (pdf-parse + Gemini OCR fallback)
 */
app.post('/api/parse-order-pdf', async (req: Request, res: Response) => {
  const { pdfBase64, fileName } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: 'Brak danych pliku PDF (base64)' });
  }

  try {
    const buffer = Buffer.from(pdfBase64, 'base64');
    const pdfModule: any = await import('pdf-parse');
    let rawText = '';
    let pageCount = 1;

    if (typeof pdfModule.PDFParse === 'function') {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      rawText = res.text || '';
      pageCount = res.total || 1;
    } else {
      const pdfFn = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule);
      const data = await pdfFn(buffer);
      rawText = data.text || '';
      pageCount = data.numpages || 1;
    }

    // Jeśli dokument PDF zawiera cyfrowy tekst (np. wygenerowany w systemie ERP Dr. Max, Subiekt, Symfonia)
    if (rawText && rawText.trim().length > 40) {
      return res.json({
        text: rawText,
        method: 'pdf-parse',
        pageCount,
      });
    }

    // Fallback dla zeskanowanych / zrastrowanych PDF (OCR przez Gemini 2.5 Flash)
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Przepisz dokładnie cały tekst z tego zamówienia PDF. Zadbaj o odczytanie nagłówka, numeru zamówienia, dat (wystawienia, realizacji, płatności), danych nabywcy (NIP, nazwa, adres), odbiorcy oraz pełnej tabeli pozycji z Lp, Nazwą, EAN, Ilością, Ceną netto i VAT.',
                },
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: pdfBase64,
                  },
                },
              ],
            },
          ],
        });
        if (response.text && response.text.trim().length > 20) {
          return res.json({
            text: response.text,
            method: 'gemini-ocr',
          });
        }
      } catch (geminiErr) {
        console.warn('Gemini PDF OCR fallback error, returning rawText:', geminiErr);
      }
    }

    return res.json({
      text: rawText,
      method: 'pdf-parse-minimal',
    });
  } catch (error: any) {
    console.error('Błąd parsowania PDF na serwerze:', error);
    return res.status(500).json({ error: error.message || 'Błąd odczytu pliku PDF' });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🌸 Generator Iwonki KSeF działa na http://0.0.0.0:${port} [tryb: ${isProduction ? 'PRODUKCJA' : 'DEVELOPMENT'}]`);
  });
}

startServer();
