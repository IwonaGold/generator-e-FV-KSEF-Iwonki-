import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { extractLotAfterPrefix, extractMhdDateAfterPrefix } from './src/utils/twoStageOcrService';
import { parseKSeFInvoiceText } from './src/utils/ksefPdfInvoiceParser';

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

/**
 * PARSOWANIE FAKTURY PIERWOTNEJ Z PDF DLA KOREKTY KSEF
 * Odczytuje numer KSeF (35-36 znaków), numer faktury, daty, strony i pozycje towarowe
 */
app.post('/api/parse-invoice-pdf', async (req: Request, res: Response) => {
  const { pdfBase64, fileName } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: 'Brak danych pliku PDF (base64)' });
  }

  try {
    const buffer = Buffer.from(pdfBase64, 'base64');
    const pdfModule: any = await import('pdf-parse');
    let rawText = '';

    if (typeof pdfModule.PDFParse === 'function') {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const r = await parser.getText();
      rawText = r.text || '';
    } else {
      const pdfFn = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule);
      const data = await pdfFn(buffer);
      rawText = data.text || '';
    }

    // 1. DETERMINISTYCZNY I BŁYSKAWICZNY PARSER KSEF/wFirma
    const deterministic = parseKSeFInvoiceText(rawText);

    // Jeśli odczytano pozycje towarowe lub kontrahenta i numer KSeF, natychmiast zwracamy pełen wynik
    if (deterministic.items && deterministic.items.length > 0 && deterministic.buyer?.nip) {
      return res.json(deterministic);
    }

    // 2. Fallback: Próba inteligentnej analizy Gemini 2.5 Flash dla nietypowych lub zrastrowanych skanów
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const promptText = `Przeanalizuj tę fakturę VAT.
Wyodrębnij dokładnie następujące informacje:
1. ksefNumber: 35-36 znakowy numer identyfikacyjny KSeF (np. 5833446059-20260928-123456-ABCDEF-01). Szukaj słów: KSeF, Numer referencyjny KSeF, Identyfikator KSeF, Nr KSeF.
2. invoiceNumber: Numer faktury pierwotnej (np. 41/2026/KSEF)
3. issueDate: Data wystawienia (YYYY-MM-DD)
4. buyer: { name, nip, addressLine1, postalCode, city, gln }
5. seller: { name, nip, addressLine1, postalCode, city }
6. thirdParty: { name, nip, gln, idWew, addressLine1 } (jeśli występuje odbiorca/apteka)
7. items: [
     {
       name: nazwa towaru (np. OMNi-BiOTiC...),
       gtin: kod EAN/GTIN,
       quantity: ilość (liczba),
       unit: jednostka (np. szt.),
       netPrice: cena jednostkowa netto,
       vatRate: stawka VAT (np. "8%" lub "23%"),
       batchNumber: numer serii (jeśli podano),
       expiryDate: data ważności YYYY-MM-DD (jeśli podano)
     }
   ]
8. totalGross: łączna kwota brutto (liczba)
9. totalNet: łączna kwota netto (liczba)
10. currency: waluta (domyślnie "PLN")

Zwróć wynik jako czysty obiekt JSON.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: pdfBase64,
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
        const finalKsef = parsed.ksefNumber || deterministic.ksefNumber;

        return res.json({
          success: true,
          method: 'gemini-pdf',
          ksefNumber: finalKsef || '',
          hasKsefNumber: Boolean(finalKsef && finalKsef.length >= 30),
          invoiceNumber: parsed.invoiceNumber || deterministic.invoiceNumber || 'FAKTURA',
          issueDate: parsed.issueDate || deterministic.issueDate || new Date().toISOString().slice(0, 10),
          buyer: parsed.buyer || deterministic.buyer,
          seller: parsed.seller || deterministic.seller,
          thirdParty: parsed.thirdParty || deterministic.thirdParty,
          items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : deterministic.items,
          totalGross: parsed.totalGross || deterministic.totalGross || 0,
          totalNet: parsed.totalNet || deterministic.totalNet || 0,
          currency: parsed.currency || 'PLN',
          rawText: rawText.slice(0, 500),
        });
      } catch (geminiErr) {
        console.warn('Błąd analizy Gemini PDF dla faktury, fallback do parsera deterministycznego:', geminiErr);
      }
    }

    // 3. Ostateczny zwrot z parsera deterministycznego
    return res.json(deterministic);
  } catch (error: any) {
    console.error('Błąd parsowania PDF faktury:', error);
    return res.status(500).json({ error: error.message || 'Błąd odczytu pliku PDF' });
  }
});

/**
 * ARCHIWUM ZAMÓWIEŃ SIECIOWYCH, WSPÓLNY STÓŁ ROBOCZY I CHMURA MULTI-USER (SSE + GITHUB AES-256-GCM)
 */
import crypto from 'crypto';
import zlib from 'zlib';
import { execSync } from 'child_process';

const dataDir = path.join(process.cwd(), 'data');
const ordersFilePath = path.join(dataDir, 'orders_history.json');
const deletedIdsFilePath = path.join(dataDir, 'deleted_orders_ids.json');
const knowledgeFilePath = path.join(dataDir, 'knowledge_base.json');
const sharedDraftsFilePath = path.join(dataDir, 'shared_drafts.json');
const packagingPhotosFilePath = path.join(dataDir, 'packaging_photos.json');
const cloudConfigFilePath = path.join(dataDir, 'cloud_config.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      console.error('Błąd tworzenia katalogu data:', e);
    }
  }
}

function resolveInitialGitHubToken(): string {
  const envTok = (process.env.GITHUB_TOKEN || '').trim();
  if (envTok) return envTok;

  // 1. Sprawdź zapisaną konfigurację w data/cloud_config.json
  try {
    ensureDataDir();
    if (fs.existsSync(cloudConfigFilePath)) {
      const cfg = JSON.parse(fs.readFileSync(cloudConfigFilePath, 'utf8'));
      if (cfg?.githubToken && typeof cfg.githubToken === 'string') {
        return cfg.githubToken.trim();
      }
    }
  } catch {}

  // 2. Automatyczne pobranie poświadczenia Git z systemu (tylko gdy jawnie włączono synchronizację lokalną lub w środowisku produkcyjnym, aby testy na localhost nie nadpisywały historii zamówień na Renderze)
  if (isProduction || process.env.ENABLE_LOCAL_CLOUD_SYNC === 'true') {
    try {
      const gitCandidates = [
        'C:\\Users\\iklos\\.mingit\\cmd\\git.exe',
        'git',
      ];
      for (const gitBin of gitCandidates) {
        try {
          const out = execSync(`"${gitBin}" credential fill`, {
            input: 'protocol=https\nhost=github.com\n\n',
            encoding: 'utf8',
            timeout: 2500,
            stdio: ['pipe', 'pipe', 'ignore'],
          });
          const m = out.match(/password=([^\r\n]+)/);
          if (m && m[1] && m[1].trim().length > 10) {
            return m[1].trim();
          }
        } catch {}
      }
    } catch {}
  }

  return '';
}

// Konfiguracja darmowej chmury GitHub (osobny prywatny sejf + szyfrowanie AES-256-GCM)
let GITHUB_TOKEN = resolveInitialGitHubToken();
const DEFAULT_VAULT_REPO_NAME = 'ksef-prywatny-sejf';
let activeVaultRepo = (process.env.GITHUB_DATA_REPO || `IwonaGold/${DEFAULT_VAULT_REPO_NAME}`).trim();
const GITHUB_DATA_BRANCH = (process.env.GITHUB_DATA_BRANCH || 'app-data').trim();
const ENCRYPTION_SECRET = (process.env.DATA_ENCRYPTION_KEY || 'ksef-iwonka-2026-aes256-master-vault-key-9f8e7d6c5b4a').trim();
let vaultRepoVerified = false;

// --- Stan Real-Time Multi-User Sync (SSE + Rewizje) ---
let serverRevision = 1;
let lastActivity: {
  type: string;
  summary: string;
  workstation: string;
  timestamp: string;
} = {
  type: 'INIT',
  summary: 'Serwer bazy chmurowej Multi-User gotowy do pracy',
  workstation: 'System Chmurowy Eubiosis',
  timestamp: new Date().toISOString(),
};

interface ConnectedClient {
  id: string;
  workstation: string;
  connectedAt: string;
  res: Response;
}

const sseClients = new Map<string, ConnectedClient>();

function broadcastSyncEvent(type: string, summary: string, workstation = 'Stanowisko Eubiosis') {
  serverRevision += 1;
  lastActivity = {
    type,
    summary,
    workstation,
    timestamp: new Date().toISOString(),
  };

  const payload = JSON.stringify({
    revision: serverRevision,
    activity: lastActivity,
    activeUsersCount: Math.max(1, sseClients.size),
    activeWorkstations: Array.from(sseClients.values()).map((c) => ({
      id: c.id,
      workstation: c.workstation,
      connectedAt: c.connectedAt,
    })),
  });

  for (const [clientId, client] of sseClients.entries()) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(clientId);
    }
  }
}

function getEncryptionKey(): Buffer {
  return crypto.scryptSync(ENCRYPTION_SECRET, 'ksef-iwonka-vault-salt-v1', 32);
}

function encryptVaultPayload(payload: {
  orders: any[];
  deletedIds: string[];
  knowledgeClients?: any[];
  sharedDrafts?: any[];
  updatedAt: string;
}): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const rawJson = Buffer.from(JSON.stringify(payload), 'utf8');
  const compressed = zlib.gzipSync(rawJson);

  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm-gzip',
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

function decryptVaultPayload(envelopeStr: string): {
  orders: any[];
  deletedIds: string[];
  knowledgeClients: any[];
  sharedDrafts: any[];
} | null {
  try {
    const env = JSON.parse(envelopeStr);
    if (!env || !env.iv || !env.tag || !env.data) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(env.iv, 'base64');
    const authTag = Buffer.from(env.tag, 'base64');
    const encryptedData = Buffer.from(env.data, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decryptedCompressed = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    const rawJson =
      env.alg === 'aes-256-gcm-gzip'
        ? zlib.gunzipSync(decryptedCompressed).toString('utf8')
        : decryptedCompressed.toString('utf8');

    const parsed = JSON.parse(rawJson);
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      knowledgeClients: Array.isArray(parsed.knowledgeClients) ? parsed.knowledgeClients : [],
      sharedDrafts: Array.isArray(parsed.sharedDrafts) ? parsed.sharedDrafts : [],
    };
  } catch (e) {
    console.error('Błąd odszyfrowywania bazy z chmury GitHub:', e);
    return null;
  }
}

async function ensurePrivateVaultRepoExists(): Promise<void> {
  if (!GITHUB_TOKEN || vaultRepoVerified) return;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${activeVaultRepo}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Generator-KSeF-Iwonki-CloudVault',
      },
    });
    if (checkRes.ok) {
      vaultRepoVerified = true;
      return;
    }
    if (checkRes.status === 404 && !process.env.GITHUB_DATA_REPO) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Generator-KSeF-Iwonki-CloudVault',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DEFAULT_VAULT_REPO_NAME,
          private: true,
          auto_init: true,
          description: '🔒 Prywatny, zaszyfrowany sejf danych zamówień KSeF (AES-256-GCM)',
        }),
      });
      if (createRes.ok) {
        const createdRepo: any = await createRes.json();
        if (createdRepo?.full_name) {
          activeVaultRepo = createdRepo.full_name;
        }
        vaultRepoVerified = true;
        console.log(`🔒 Automatycznie utworzono prywatne repozytorium sejfu: ${activeVaultRepo}`);
        return;
      }
      activeVaultRepo = 'IwonaGold/generator-e-FV-KSEF-Iwonki-';
      vaultRepoVerified = true;
    }
  } catch (e) {
    console.warn('Uwaga przy weryfikacji repozytorium sejfu, używam fallbacku:', e);
    activeVaultRepo = 'IwonaGold/generator-e-FV-KSEF-Iwonki-';
    vaultRepoVerified = true;
  }
}

async function githubApiRequest(endpoint: string, options: RequestInit = {}): Promise<globalThis.Response> {
  await ensurePrivateVaultRepoExists();
  const url = `https://api.github.com/repos/${activeVaultRepo}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Generator-KSeF-Iwonki-CloudVault',
      ...(options.headers || {}),
    },
  });
}

let lastCloudSyncAt: string | null = null;
let lastCloudSyncError: string | null = null;

async function loadVaultFromGitHubCloud(): Promise<{
  orders: any[];
  deletedIds: string[];
  knowledgeClients: any[];
  sharedDrafts: any[];
} | null> {
  if (!GITHUB_TOKEN) return null;

  try {
    const refRes = await githubApiRequest(`/git/ref/heads/${GITHUB_DATA_BRANCH}`);
    if (refRes.status === 404) {
      return null;
    }
    if (!refRes.ok) {
      throw new Error(`Błąd odczytu ref z GitHub (${refRes.status})`);
    }
    const refData: any = await refRes.json();
    const commitSha = refData?.object?.sha;
    if (!commitSha) return null;

    const commitRes = await githubApiRequest(`/git/commits/${commitSha}`);
    if (!commitRes.ok) return null;
    const commitData: any = await commitRes.json();
    const treeSha = commitData?.tree?.sha;
    if (!treeSha) return null;

    const treeRes = await githubApiRequest(`/git/trees/${treeSha}`);
    if (!treeRes.ok) return null;
    const treeData: any = await treeRes.json();
    const vaultEntry = Array.isArray(treeData?.tree)
      ? treeData.tree.find((item: any) => item.path === 'orders_vault.enc')
      : null;
    if (!vaultEntry?.sha) return null;

    const blobRes = await githubApiRequest(`/git/blobs/${vaultEntry.sha}`);
    if (!blobRes.ok) return null;
    const blobData: any = await blobRes.json();
    if (!blobData?.content) return null;

    const envelopeStr = Buffer.from(blobData.content.replace(/\s+/g, ''), 'base64').toString('utf8');
    const decrypted = decryptVaultPayload(envelopeStr);
    if (decrypted) {
      lastCloudSyncAt = new Date().toISOString();
      lastCloudSyncError = null;
    }
    return decrypted;
  } catch (err: any) {
    console.error('Błąd pobierania zaszyfrowanej bazy z GitHub:', err);
    lastCloudSyncError = err?.message || String(err);
    return null;
  }
}

async function saveVaultToGitHubCloud(
  orders: any[],
  deletedIds: string[],
  knowledgeClients: any[],
  sharedDrafts: any[] = []
): Promise<boolean> {
  if (!GITHUB_TOKEN) return false;

  try {
    const encryptedEnvelope = encryptVaultPayload({
      orders,
      deletedIds,
      knowledgeClients,
      sharedDrafts,
      updatedAt: new Date().toISOString(),
    });

    const blobRes = await githubApiRequest('/git/blobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: encryptedEnvelope,
        encoding: 'utf-8',
      }),
    });
    if (!blobRes.ok) {
      throw new Error(`Nie udało się utworzyć bloba na GitHub (${blobRes.status})`);
    }
    const blobData: any = await blobRes.json();

    const treeRes = await githubApiRequest('/git/trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tree: [
          {
            path: 'orders_vault.enc',
            mode: '100644',
            type: 'blob',
            sha: blobData.sha,
          },
          {
            path: 'README.md',
            mode: '100644',
            type: 'blob',
            content:
              '# 🔒 Zaszyfrowany Magazyn Danych (AES-256-GCM)\n\nPlik `orders_vault.enc` zawiera skompresowaną i zaszyfrowaną bazę zamówień, Wspólny Stół Roboczy oraz Centrum Wiedzy CRM (algorytm `AES-256-GCM` + `GZIP`).\nDane są całkowicie nieczytelne dla osób trzecich i mogą zostać odszyfrowane wyłącznie przez serwer aplikacji z kluczem prywatnym.\n',
          },
        ],
      }),
    });
    if (!treeRes.ok) {
      throw new Error(`Nie udało się utworzyć drzewa Git (${treeRes.status})`);
    }
    const treeData: any = await treeRes.json();

    const commitRes = await githubApiRequest('/git/commits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `🔒 Aktualizacja zaszyfrowanej bazy (${orders.length} zamówień, ${knowledgeClients.length} kart CRM, ${sharedDrafts.length} szkiców)`,
        tree: treeData.sha,
        parents: [],
      }),
    });
    if (!commitRes.ok) {
      throw new Error(`Nie udało się utworzyć commita Git (${commitRes.status})`);
    }
    const commitData: any = await commitRes.json();

    const patchRes = await githubApiRequest(`/git/refs/heads/${GITHUB_DATA_BRANCH}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha: commitData.sha,
        force: true,
      }),
    });

    if (patchRes.status === 404 || patchRes.status === 422) {
      const createRefRes = await githubApiRequest('/git/refs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: `refs/heads/${GITHUB_DATA_BRANCH}`,
          sha: commitData.sha,
        }),
      });
      if (!createRefRes.ok) {
        throw new Error(`Nie udało się utworzyć gałęzi ${GITHUB_DATA_BRANCH} (${createRefRes.status})`);
      }
    } else if (!patchRes.ok) {
      throw new Error(`Nie udało się zaktualizować gałęzi ${GITHUB_DATA_BRANCH} (${patchRes.status})`);
    }

    lastCloudSyncAt = new Date().toISOString();
    lastCloudSyncError = null;
    return true;
  } catch (err: any) {
    console.error('Błąd zapisu zaszyfrowanej bazy w chmurze GitHub:', err);
    lastCloudSyncError = err?.message || String(err);
    return false;
  }
}

let syncTimeout: NodeJS.Timeout | null = null;
let isSyncingCloud = false;
let pendingCloudSync = false;

function scheduleCloudSync() {
  if (!GITHUB_TOKEN) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (isSyncingCloud) {
      pendingCloudSync = true;
      return;
    }
    isSyncingCloud = true;
    try {
      const orders = readOrdersFromDisk();
      const deletedIds = readDeletedIdsFromDisk();
      const knowledgeClients = readKnowledgeFromDisk();
      const sharedDrafts = readSharedDraftsFromDisk();
      await saveVaultToGitHubCloud(orders, deletedIds, knowledgeClients, sharedDrafts);
    } finally {
      isSyncingCloud = false;
      if (pendingCloudSync) {
        pendingCloudSync = false;
        scheduleCloudSync();
      }
    }
  }, 1200);
}

function readDeletedIdsFromDisk(): string[] {
  ensureDataDir();
  if (!fs.existsSync(deletedIdsFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(deletedIdsFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDeletedIdsToDisk(ids: string[]): void {
  ensureDataDir();
  try {
    const unique = Array.from(new Set(ids));
    fs.writeFileSync(deletedIdsFilePath, JSON.stringify(unique, null, 2), 'utf8');
  } catch (e) {
    console.error('Błąd zapisu listy usuniętych zamówień:', e);
  }
}

function readOrdersFromDisk(): any[] {
  ensureDataDir();
  if (!fs.existsSync(ordersFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ordersFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Błąd odczytu bazy zamówień:', e);
    return [];
  }
}

function writeOrdersToDisk(orders: any[], triggerCloud = true): boolean {
  ensureDataDir();
  try {
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), 'utf8');
    if (triggerCloud) {
      scheduleCloudSync();
    }
    return true;
  } catch (e) {
    console.error('Błąd zapisu bazy zamówień:', e);
    return false;
  }
}

function readKnowledgeFromDisk(): any[] {
  ensureDataDir();
  if (!fs.existsSync(knowledgeFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(knowledgeFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Błąd odczytu bazy Centrum Wiedzy:', e);
    return [];
  }
}

function writeKnowledgeToDisk(clients: any[], triggerCloud = true): boolean {
  ensureDataDir();
  try {
    fs.writeFileSync(knowledgeFilePath, JSON.stringify(clients, null, 2), 'utf8');
    if (triggerCloud) {
      scheduleCloudSync();
    }
    return true;
  } catch (e) {
    console.error('Błąd zapisu bazy Centrum Wiedzy:', e);
    return false;
  }
}

function readSharedDraftsFromDisk(): any[] {
  ensureDataDir();
  if (!fs.existsSync(sharedDraftsFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(sharedDraftsFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSharedDraftsToDisk(drafts: any[], triggerCloud = true): boolean {
  ensureDataDir();
  try {
    fs.writeFileSync(sharedDraftsFilePath, JSON.stringify(drafts, null, 2), 'utf8');
    if (triggerCloud) {
      scheduleCloudSync();
    }
    return true;
  } catch (e) {
    console.error('Błąd zapisu Wspólnego Stołu Roboczego:', e);
    return false;
  }
}

function readPackagingPhotosFromDisk(): any[] {
  ensureDataDir();
  if (!fs.existsSync(packagingPhotosFilePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(packagingPhotosFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePackagingPhotosToDisk(photos: any[], triggerCloud = true): boolean {
  ensureDataDir();
  try {
    fs.writeFileSync(packagingPhotosFilePath, JSON.stringify(photos, null, 2), 'utf8');
    if (triggerCloud) {
      scheduleCloudSync();
    }
    return true;
  } catch (e) {
    console.error('Błąd zapisu kolejki zdjęć opakowań z Magazynu:', e);
    return false;
  }
}

// Pełna synchronizacja dwukierunkowa z zaszyfrowanym sejfem w chmurze GitHub
async function performFullCloudPullAndMerge(): Promise<{
  ordersCount: number;
  knowledgeCount: number;
  draftsCount: number;
}> {
  const localOrders = readOrdersFromDisk();
  const localKnowledge = readKnowledgeFromDisk();
  const localDrafts = readSharedDraftsFromDisk();
  if (!GITHUB_TOKEN) {
    return {
      ordersCount: localOrders.length,
      knowledgeCount: localKnowledge.length,
      draftsCount: localDrafts.length,
    };
  }

  const cloudVault = await loadVaultFromGitHubCloud();
  if (cloudVault) {
    const localDeleted = readDeletedIdsFromDisk();
    const mergedDeletedSet = new Set<string>([...localDeleted, ...(cloudVault.deletedIds || [])]);
    const mergedDeleted = Array.from(mergedDeletedSet);
    writeDeletedIdsToDisk(mergedDeleted);

    // 1. Połącz zamówienia z chmury i z dysku lokalnego
    const map = new Map<string, any>();
    for (const ord of cloudVault.orders || []) {
      if (ord?.id && !mergedDeletedSet.has(ord.id)) {
        map.set(ord.id, ord);
      }
    }
    for (const loc of localOrders) {
      if (!loc?.id || mergedDeletedSet.has(loc.id)) continue;
      const existing = map.get(loc.id);
      if (!existing) {
        map.set(loc.id, loc);
      } else {
        const tCloud = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const tLoc = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
        const newer = tLoc >= tCloud ? loc : existing;
        const older = tLoc >= tCloud ? existing : loc;
        const photos =
          newer.parcelPhotos && newer.parcelPhotos.length > 0
            ? newer.parcelPhotos
            : older.parcelPhotos || [];
        const pkgPhotos =
          newer.packagingPhotos && newer.packagingPhotos.length > 0
            ? newer.packagingPhotos
            : older.packagingPhotos || [];
        map.set(loc.id, { ...older, ...newer, parcelPhotos: photos, packagingPhotos: pkgPhotos });
      }
    }
    const mergedOrders = Array.from(map.values());
    writeOrdersToDisk(mergedOrders, false);

    // 2. Połącz karty klientów Centrum Wiedzy (CRM)
    const kMap = new Map<string, any>();
    for (const kc of cloudVault.knowledgeClients || []) {
      if (kc?.id) kMap.set(kc.id, kc);
    }
    for (const lk of localKnowledge) {
      if (!lk?.id) continue;
      const ex = kMap.get(lk.id);
      if (!ex) {
        kMap.set(lk.id, lk);
      } else {
        const tC = ex.updatedAt ? new Date(ex.updatedAt).getTime() : 0;
        const tL = lk.updatedAt ? new Date(lk.updatedAt).getTime() : 0;
        kMap.set(lk.id, tL >= tC ? lk : ex);
      }
    }
    const mergedKnowledge = Array.from(kMap.values());
    if (mergedKnowledge.length > 0) {
      writeKnowledgeToDisk(mergedKnowledge, false);
    }

    // 3. Połącz szkice ze Wspólnego Stołu Roboczego
    const dMap = new Map<string, any>();
    for (const cd of cloudVault.sharedDrafts || []) {
      if (cd?.id) dMap.set(cd.id, cd);
    }
    for (const ld of localDrafts) {
      if (!ld?.id) continue;
      const ex = dMap.get(ld.id);
      if (!ex) {
        dMap.set(ld.id, ld);
      } else {
        const tC = ex.updatedAt ? new Date(ex.updatedAt).getTime() : 0;
        const tL = ld.updatedAt ? new Date(ld.updatedAt).getTime() : 0;
        dMap.set(ld.id, tL >= tC ? ld : ex);
      }
    }
    const mergedDrafts = Array.from(dMap.values());
    writeSharedDraftsToDisk(mergedDrafts, false);

    return {
      ordersCount: mergedOrders.length,
      knowledgeCount: mergedKnowledge.length,
      draftsCount: mergedDrafts.length,
    };
  } else if (localOrders.length > 0 || localKnowledge.length > 0 || localDrafts.length > 0) {
    await saveVaultToGitHubCloud(localOrders, readDeletedIdsFromDisk(), localKnowledge, localDrafts);
  }

  return {
    ordersCount: localOrders.length,
    knowledgeCount: localKnowledge.length,
    draftsCount: localDrafts.length,
  };
}

let cloudInitPromise: Promise<void> | null = null;

async function ensureCloudInitialized(): Promise<void> {
  if (!GITHUB_TOKEN) return;
  if (!cloudInitPromise) {
    cloudInitPromise = (async () => {
      const res = await performFullCloudPullAndMerge();
      console.log(`☁️ [GitHub Vault AES-256] Zsynchronizowano ${res.ordersCount} zamówień, ${res.knowledgeCount} kart CRM i ${res.draftsCount} szkiców.`);
    })();
  }
  await cloudInitPromise;
}

/**
 * REAL-TIME MULTI-USER STREAM (Server-Sent Events)
 */
app.get('/api/live-sync-stream', async (req: Request, res: Response) => {
  const workstation = String(req.query.workstation || 'Stanowisko Eubiosis').slice(0, 60);
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.set(clientId, {
    id: clientId,
    workstation,
    connectedAt: new Date().toISOString(),
    res,
  });

  // Wyślij stan początkowy zaraz po podłączeniu
  const initPayload = JSON.stringify({
    revision: serverRevision,
    activity: lastActivity,
    activeUsersCount: Math.max(1, sseClients.size),
    activeWorkstations: Array.from(sseClients.values()).map((c) => ({
      id: c.id,
      workstation: c.workstation,
      connectedAt: c.connectedAt,
    })),
  });
  res.write(`data: ${initPayload}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(keepAlive);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(clientId);
  });
});

/**
 * STATUS SYNCHRONIZACJI CHMUROWEJ I STANOWISK MULTI-USER
 */
app.get('/api/cloud-status', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const orders = readOrdersFromDisk();
  const knowledge = readKnowledgeFromDisk();
  const drafts = readSharedDraftsFromDisk();
  return res.json({
    enabled: Boolean(GITHUB_TOKEN),
    encryption: 'AES-256-GCM + GZIP',
    repo: activeVaultRepo,
    branch: GITHUB_DATA_BRANCH,
    lastSyncAt: lastCloudSyncAt || new Date().toISOString(),
    lastError: lastCloudSyncError,
    revision: serverRevision,
    lastActivity,
    ordersCount: orders.length,
    knowledgeCount: knowledge.length,
    sharedDraftsCount: drafts.length,
    activeUsersCount: Math.max(1, sseClients.size),
    activeWorkstations: Array.from(sseClients.values()).map((c) => ({
      id: c.id,
      workstation: c.workstation,
      connectedAt: c.connectedAt,
    })),
  });
});

/**
 * WYMUŚ NATYCHMIASTOWĄ SYNCHRONIZACJĘ DWUKIERUNKOWĄ Z CHMURĄ (PULL + PUSH + BROADCAST)
 */
app.post('/api/cloud-sync-now', async (req: Request, res: Response) => {
  const workstation = req.body?.workstation || 'Stanowisko Eubiosis';
  try {
    const counts = await performFullCloudPullAndMerge();
    if (GITHUB_TOKEN) {
      await saveVaultToGitHubCloud(
        readOrdersFromDisk(),
        readDeletedIdsFromDisk(),
        readKnowledgeFromDisk(),
        readSharedDraftsFromDisk()
      );
    }
    broadcastSyncEvent(
      'MANUAL_CLOUD_SYNC',
      `Pełna synchronizacja bazy w chmurze (${counts.ordersCount} zamówień, ${counts.knowledgeCount} kart CRM)`,
      workstation
    );
    return res.json({
      success: true,
      ...counts,
      lastSyncAt: lastCloudSyncAt || new Date().toISOString(),
      revision: serverRevision,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Błąd synchronizacji z chmurą' });
  }
});

/**
 * KONFIGURACJA KLUCZA CHMUROWEGO Z POZIOMU INTERFEJSU
 */
app.post('/api/cloud-config', async (req: Request, res: Response) => {
  const { githubToken, vaultRepo } = req.body || {};
  ensureDataDir();
  if (typeof githubToken === 'string' && githubToken.trim().length > 5) {
    GITHUB_TOKEN = githubToken.trim();
    vaultRepoVerified = false;
    cloudInitPromise = null;
    fs.writeFileSync(
      cloudConfigFilePath,
      JSON.stringify({ githubToken: GITHUB_TOKEN, vaultRepo: vaultRepo || activeVaultRepo }, null, 2),
      'utf8'
    );
  }
  if (typeof vaultRepo === 'string' && vaultRepo.trim().includes('/')) {
    activeVaultRepo = vaultRepo.trim();
    vaultRepoVerified = false;
  }
  await ensureCloudInitialized();
  broadcastSyncEvent('CONFIG_UPDATED', 'Zaktualizowano konfigurację sejfu chmurowego AES-256');
  return res.json({
    success: true,
    enabled: Boolean(GITHUB_TOKEN),
    repo: activeVaultRepo,
    lastSyncAt: lastCloudSyncAt,
  });
});

/**
 * WSPÓLNY STÓŁ ROBOCZY (PRZEKAZYWANIE BIEŻĄCEJ FAKTURY / ZAMÓWIENIA MIĘDZY STANOWISKAMI)
 */
app.get('/api/shared-drafts', async (_req: Request, res: Response) => {
  await ensureCloudInitialized();
  return res.json(readSharedDraftsFromDisk());
});

app.post('/api/shared-drafts', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const draft = req.body;
  if (!draft || !draft.id) {
    return res.status(400).json({ error: 'Brak identyfikatora szkicu roboczego' });
  }
  const drafts = readSharedDraftsFromDisk();
  const now = new Date().toISOString();
  const updatedDraft = { ...draft, updatedAt: now };
  const idx = drafts.findIndex((d: any) => d.id === draft.id);
  if (idx >= 0) {
    drafts[idx] = updatedDraft;
  } else {
    drafts.unshift(updatedDraft);
  }
  writeSharedDraftsToDisk(drafts.slice(0, 30));
  broadcastSyncEvent(
    'SHARED_DRAFT_SAVED',
    `Udostępniono szkic na Wspólnym Stole: ${draft.title || draft.meta?.orderNumber || 'Nowe zamówienie'}`,
    draft.authorWorkstation || 'Stanowisko Eubiosis'
  );
  return res.json({ success: true, draft: updatedDraft });
});

app.delete('/api/shared-drafts/:id', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { id } = req.params;
  const drafts = readSharedDraftsFromDisk().filter((d: any) => d.id !== id);
  writeSharedDraftsToDisk(drafts);
  broadcastSyncEvent('SHARED_DRAFT_DELETED', 'Usunięto szkic ze Wspólnego Stołu Roboczego');
  return res.json({ success: true, deletedId: id });
});

/**
 * KOLEJKA ZDJĘĆ OPAKOWAŃ (STANOWISKO 2: MAGAZYN -> STANOWISKO 1: KOORDYNATOR)
 */
app.get('/api/packaging-photos', async (_req: Request, res: Response) => {
  await ensureCloudInitialized();
  return res.json(readPackagingPhotosFromDisk());
});

app.post('/api/packaging-photos', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { photos, workstation } = req.body || {};
  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'Brak zdjęć opakowań do zapisania' });
  }
  const existing = readPackagingPhotosFromDisk();
  const map = new Map<string, any>();
  for (const p of existing) {
    if (p?.id) map.set(p.id, p);
  }
  for (const inc of photos) {
    if (inc?.id && inc?.dataUrl) {
      map.set(inc.id, {
        ...inc,
        uploadedAt: inc.uploadedAt || new Date().toISOString(),
        uploadedBy: inc.uploadedBy || workstation || '2. Magazyn (Zdjęcia opakowań)',
      });
    }
  }
  const merged = Array.from(map.values())
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 40);
  writePackagingPhotosToDisk(merged);
  broadcastSyncEvent(
    'PACKAGING_PHOTOS_UPLOADED',
    `📦 Magazyn wgrał ${photos.length} ${photos.length === 1 ? 'zdjęcie opakowania' : 'zdjęcia opakowań'} do przypisania i weryfikacji`,
    workstation || '2. Magazyn (Zdjęcia opakowań)'
  );
  return res.json({ success: true, photos: merged });
});

app.delete('/api/packaging-photos/:id', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { id } = req.params;
  if (id === 'ALL') {
    writePackagingPhotosToDisk([]);
    broadcastSyncEvent('PACKAGING_PHOTOS_CLEARED', 'Wyczyszczono kolejkę zdjęć opakowań');
    return res.json({ success: true });
  }
  const filtered = readPackagingPhotosFromDisk().filter((p: any) => p.id !== id);
  writePackagingPhotosToDisk(filtered);
  broadcastSyncEvent('PACKAGING_PHOTO_DELETED', 'Usunięto zdjęcie opakowania z kolejki');
  return res.json({ success: true, deletedId: id });
});

app.get('/api/orders-history', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const deletedIds = readDeletedIdsFromDisk();
  const deletedSet = new Set(deletedIds);
  const orders = readOrdersFromDisk().filter((o: any) => o && o.id && !deletedSet.has(o.id));
  res.setHeader('X-Deleted-Order-Ids', JSON.stringify(deletedIds));
  return res.json(orders);
});

app.post('/api/orders-history', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ error: 'Nieprawidłowe dane zamówienia (brak id)' });
  }

  const deletedIds = readDeletedIdsFromDisk().filter((id) => id !== newOrder.id);
  writeDeletedIdsToDisk(deletedIds);

  const orders = readOrdersFromDisk();
  const idx = orders.findIndex((o: any) => o.id === newOrder.id);
  if (idx >= 0) {
    orders[idx] = { ...newOrder, updatedAt: new Date().toISOString() };
  } else {
    orders.unshift(newOrder);
  }

  writeOrdersToDisk(orders);
  const isProductTaskAssigned = newOrder.warehouseProductTaskStatus === 'assigned';
  const isParcelTaskAssigned = newOrder.warehouseParcelTaskStatus === 'assigned';
  const isWarehouseAssigned =
    isProductTaskAssigned || isParcelTaskAssigned || newOrder.warehouseTaskStatus === 'assigned';
  broadcastSyncEvent(
    isWarehouseAssigned ? 'WAREHOUSE_TASK_ASSIGNED' : 'ORDER_SAVED',
    isProductTaskAssigned
      ? `📸 Koordynator wysłał Zadanie 1 (Uzupełnij zdjęcia produktów) do Magazynu: zamówienie nr ${newOrder.orderNumber || newOrder.invoiceNumber || newOrder.id}`
      : isParcelTaskAssigned
      ? `📦 Koordynator wysłał Zadanie 2 (Uzupełnij zdjęcia gotowej przesyłki) do Magazynu: zamówienie nr ${newOrder.orderNumber || newOrder.invoiceNumber || newOrder.id}`
      : isWarehouseAssigned
      ? `📦 Koordynator wysłał zadanie do Magazynu: zamówienie nr ${newOrder.orderNumber || newOrder.invoiceNumber || newOrder.id} (${newOrder.chain || ''})`
      : `Zapisano w bazie: ${newOrder.invoiceNumber || newOrder.orderNumber || 'Zamówienie'} (${newOrder.buyer?.name || ''})`,
    isWarehouseAssigned ? '1. Koordynator' : 'Stanowisko Eubiosis'
  );
  return res.json({ success: true, order: newOrder });
});

app.patch('/api/orders-history/:id', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { id } = req.params;
  const updates = req.body;
  const orders = readOrdersFromDisk();
  const idx = orders.findIndex((o: any) => o.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Nie znaleziono zamówienia o podanym id' });
  }

  orders[idx] = {
    ...orders[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  writeOrdersToDisk(orders);
  const ordLabel = orders[idx].orderNumber || orders[idx].invoiceNumber || id;
  let eventType = 'ORDER_UPDATED';
  let eventSummary = `Zaktualizowano zamówienie: ${ordLabel}`;
  let eventWorkstation = 'Stanowisko Eubiosis';

  if (updates.warehouseProductTaskStatus === 'assigned') {
    eventType = 'WAREHOUSE_TASK_ASSIGNED';
    eventSummary = `📸 Koordynator wysłał Zadanie 1 (Uzupełnij zdjęcia produktów) do Magazynu: zamówienie nr ${ordLabel}`;
    eventWorkstation = '1. Koordynator';
  } else if (updates.warehouseParcelTaskStatus === 'assigned') {
    eventType = 'WAREHOUSE_TASK_ASSIGNED';
    eventSummary = `📦 Koordynator wysłał Zadanie 2 (Uzupełnij zdjęcia gotowej przesyłki) do Magazynu: zamówienie nr ${ordLabel}`;
    eventWorkstation = '1. Koordynator';
  } else if (updates.warehouseTaskStatus === 'assigned') {
    eventType = 'WAREHOUSE_TASK_ASSIGNED';
    eventSummary = `📦 Koordynator wysłał zadanie do Magazynu: zamówienie nr ${ordLabel} (${orders[idx].chain || ''})`;
    eventWorkstation = '1. Koordynator';
  } else if (updates.warehouseProductTaskStatus === 'completed') {
    eventType = 'WAREHOUSE_TASK_COMPLETED';
    eventSummary = `✅ Magazyn wykonał Zadanie 1 (Uzupełnij zdjęcia produktów) dla zamówienia nr ${ordLabel}`;
    eventWorkstation = '2. Magazyn';
  } else if (updates.warehouseParcelTaskStatus === 'completed') {
    eventType = 'WAREHOUSE_TASK_COMPLETED';
    eventSummary = `✅ Magazyn wykonał Zadanie 2 (Uzupełnij zdjęcia gotowej przesyłki) dla zamówienia nr ${ordLabel}`;
    eventWorkstation = '2. Magazyn';
  } else if (updates.warehouseTaskStatus === 'completed') {
    eventType = 'WAREHOUSE_TASK_COMPLETED';
    eventSummary = `✅ Magazyn uzupełnił zdjęcia i zakończył zadanie dla zamówienia nr ${ordLabel}`;
    eventWorkstation = '2. Magazyn';
  } else if (updates.packagingPhotos || updates.parcelPhotos) {
    eventType = 'WAREHOUSE_PHOTOS_UPDATED';
    eventSummary = `📷 Zaktualizowano zdjęcia dla zamówienia nr ${ordLabel}`;
    eventWorkstation = '2. Magazyn';
  }

  broadcastSyncEvent(eventType, eventSummary, eventWorkstation);
  return res.json({ success: true, order: orders[idx] });
});

app.delete('/api/orders-history/:id', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { id } = req.params;
  const deletedIds = readDeletedIdsFromDisk();
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    writeDeletedIdsToDisk(deletedIds);
  }

  const orders = readOrdersFromDisk();
  const filtered = orders.filter((o: any) => o.id !== id);

  writeOrdersToDisk(filtered);
  broadcastSyncEvent('ORDER_DELETED', `Usunięto zamówienie z bazy (${id})`);
  return res.json({ success: true, deletedId: id });
});

app.post('/api/orders-history/sync', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { orders } = req.body;
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: 'Nieprawidłowa lista zamówień do synchronizacji' });
  }
  const deletedSet = new Set(readDeletedIdsFromDisk());
  const existingOrders = readOrdersFromDisk();

  const map = new Map<string, any>();
  for (const srv of existingOrders) {
    if (srv?.id && !deletedSet.has(srv.id)) {
      map.set(srv.id, srv);
    }
  }
  for (const inc of orders) {
    if (!inc?.id || deletedSet.has(inc.id)) continue;
    const ex = map.get(inc.id);
    if (!ex) {
      map.set(inc.id, inc);
    } else {
      const tSrv = ex.updatedAt ? new Date(ex.updatedAt).getTime() : 0;
      const tInc = inc.updatedAt ? new Date(inc.updatedAt).getTime() : 0;
      const newer = tInc >= tSrv ? inc : ex;
      const older = tInc >= tSrv ? ex : inc;
      const photos =
        newer.parcelPhotos && newer.parcelPhotos.length > 0
          ? newer.parcelPhotos
          : older.parcelPhotos || [];
      const pkgPhotos =
        newer.packagingPhotos && newer.packagingPhotos.length > 0
          ? newer.packagingPhotos
          : older.packagingPhotos || [];
      map.set(inc.id, { ...older, ...newer, parcelPhotos: photos, packagingPhotos: pkgPhotos });
    }
  }

  const finalOrders = Array.from(map.values());
  writeOrdersToDisk(finalOrders);
  return res.json({ success: true, count: finalOrders.length });
});

/**
 * CENTRUM WIEDZY (CRM KLIENTÓW KLUCZOWYCH) — ENDPOINTY API
 */
app.get('/api/knowledge-base', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const clients = readKnowledgeFromDisk();
  return res.json(clients);
});

app.post('/api/knowledge-base', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const client = req.body;
  if (!client || !client.id) {
    return res.status(400).json({ error: 'Nieprawidłowe dane klienta (brak id)' });
  }

  const clients = readKnowledgeFromDisk();
  const idx = clients.findIndex((c: any) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = { ...client, updatedAt: new Date().toISOString() };
  } else {
    clients.push({ ...client, updatedAt: new Date().toISOString() });
  }

  writeKnowledgeToDisk(clients);
  broadcastSyncEvent('KNOWLEDGE_UPDATED', `Zaktualizowano kartę CRM: ${client.shortName || client.name}`);
  return res.json({ success: true, client });
});

app.delete('/api/knowledge-base/:id', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { id } = req.params;
  const clients = readKnowledgeFromDisk().filter((c: any) => c.id !== id);
  writeKnowledgeToDisk(clients);
  broadcastSyncEvent('KNOWLEDGE_DELETED', `Usunięto kartę CRM (${id})`);
  return res.json({ success: true, deletedId: id });
});

app.post('/api/knowledge-base/sync', async (req: Request, res: Response) => {
  await ensureCloudInitialized();
  const { clients } = req.body;
  if (!Array.isArray(clients)) {
    return res.status(400).json({ error: 'Nieprawidłowa lista klientów do synchronizacji' });
  }

  const existing = readKnowledgeFromDisk();
  const map = new Map<string, any>();
  for (const ex of existing) {
    if (ex?.id) map.set(ex.id, ex);
  }
  for (const inc of clients) {
    if (!inc?.id) continue;
    const prev = map.get(inc.id);
    if (!prev) {
      map.set(inc.id, inc);
    } else {
      const tPrev = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
      const tInc = inc.updatedAt ? new Date(inc.updatedAt).getTime() : 0;
      map.set(inc.id, tInc >= tPrev ? inc : prev);
    }
  }

  const finalClients = Array.from(map.values());
  writeKnowledgeToDisk(finalClients);
  return res.json({ success: true, count: finalClients.length });
});

function freePortIfBusy(targetPort: number): boolean {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${targetPort}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const pids = new Set<number>();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid && pid !== process.pid) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch {}
      }
      return pids.size > 0;
    } else {
      execSync(`fuser -k ${targetPort}/tcp`, { stdio: 'ignore' });
      return true;
    }
  } catch {
    return false;
  }
}

async function startServer() {
  if (freePortIfBusy(port)) {
    console.log(`🔄 Zwolniono zajęty port ${port} (poprzednia instancja)...`);
    await new Promise((r) => setTimeout(r, 300));
  }

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

  const listenOnPort = (targetPort: number, retried = false) => {
    const server = app.listen(targetPort, '0.0.0.0', () => {
      console.log(`🌸 Generator Iwonki KSeF działa na http://localhost:${targetPort} (http://0.0.0.0:${targetPort}) [tryb: ${isProduction ? 'PRODUKCJA' : 'DEVELOPMENT'}]`);
    });

    server.on('error', (err: any) => {
      if (err?.code === 'EADDRINUSE') {
        if (!retried && freePortIfBusy(targetPort)) {
          console.log(`🔄 Zwolniono zajęty port ${targetPort} (poprzednia instancja) — ponawiam uruchomienie...`);
          setTimeout(() => listenOnPort(targetPort, true), 400);
          return;
        }
        const fallbackPort = targetPort + 1;
        console.warn(`⚠️ Port ${targetPort} jest zajęty. Uruchamiam serwer na porcie zapasowym ${fallbackPort}...`);
        listenOnPort(fallbackPort, true);
      } else {
        console.error('❌ Błąd serwera HTTP:', err);
      }
    });
  };

  listenOnPort(port);
}

startServer();

