import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createInitialWMSState } from './src/utils/defaultWmsData';
import { WMSFullState } from './src/types/wms';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3005;
const isProduction =
  process.env.NODE_ENV === 'production' ||
  fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dataDir = path.join(process.cwd(), 'data');
const backupDir = path.join(process.cwd(), 'data_backup');
const stateFilePath = path.join(dataDir, 'wms_state.json');
const backupFilePath = path.join(backupDir, 'wms_state_backup.json');

function ensureDirs() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

function readWMSStateFromDisk(): WMSFullState {
  ensureDirs();
  try {
    if (fs.existsSync(stateFilePath)) {
      const raw = fs.readFileSync(stateFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.warehouses) && Array.isArray(parsed.slots)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Błąd odczytu data/wms_state.json:', e);
  }
  const initial = createInitialWMSState();
  writeWMSStateToDisk(initial);
  return initial;
}

function writeWMSStateToDisk(state: WMSFullState): void {
  ensureDirs();
  try {
    const json = JSON.stringify(state, null, 2);
    fs.writeFileSync(stateFilePath, json, 'utf8');
    fs.writeFileSync(backupFilePath, json, 'utf8');
  } catch (e) {
    console.error('Błąd zapisu data/wms_state.json:', e);
  }
}

// --- Real-Time Multi-User Wi-Fi Sync (SSE) ---
interface ConnectedClient {
  id: string;
  workstation: string;
  connectedAt: string;
  res: Response;
}

const sseClients = new Map<string, ConnectedClient>();
let serverRevision = 1;

function broadcastWMSEvent(summary: string, workstation: string) {
  serverRevision += 1;
  const payload = JSON.stringify({
    revision: serverRevision,
    activity: {
      summary,
      workstation,
      timestamp: new Date().toISOString(),
    },
    activeUsersCount: Math.max(1, sseClients.size),
  });

  for (const [id, client] of sseClients.entries()) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(id);
    }
  }
}

app.get('/api/sync-events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const workstation = String(req.query.workstation || 'Stanowisko WMS');

  sseClients.set(clientId, {
    id: clientId,
    workstation,
    connectedAt: new Date().toISOString(),
    res,
  });

  const initPayload = JSON.stringify({
    revision: serverRevision,
    activity: {
      summary: 'Połączono z serwerem Magazynu Przestrzennego WMS',
      workstation,
      timestamp: new Date().toISOString(),
    },
    activeUsersCount: Math.max(1, sseClients.size),
  });
  res.write(`data: ${initPayload}\n\n`);

  req.on('close', () => {
    sseClients.delete(clientId);
  });
});

// Pobranie aktualnego stanu magazynu
app.get('/api/wms-state', (_req: Request, res: Response) => {
  const state = readWMSStateFromDisk();
  return res.json({
    success: true,
    state,
    activeUsersCount: Math.max(1, sseClients.size),
  });
});

// Zapisanie zaktualizowanego stanu magazynu i rozgłoszenie po Wi-Fi
app.post('/api/wms-state', (req: Request, res: Response) => {
  const { state, summary, workstation } = req.body;
  if (!state || !Array.isArray(state.warehouses) || !Array.isArray(state.slots)) {
    return res.status(400).json({ error: 'Nieprawidłowa struktura stanu WMS' });
  }

  const nextState: WMSFullState = {
    ...state,
    revision: (Number(state.revision) || serverRevision) + 1,
    updatedAt: new Date().toISOString(),
  };

  writeWMSStateToDisk(nextState);
  broadcastWMSEvent(
    summary || 'Zaktualizowano stan magazynu',
    workstation || 'Stanowisko WMS'
  );

  return res.json({
    success: true,
    state: nextState,
  });
});

// Odczyt tekstu z plików PDF wFirma (WZ, RW, PZ, PW oraz Zestawienie stanów)
app.post('/api/extract-pdf-text', async (req: Request, res: Response) => {
  const { pdfBase64 } = req.body;
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
      const pdfFn =
        typeof pdfModule === 'function' ? pdfModule : pdfModule.default || pdfModule;
      const data = await pdfFn(buffer);
      rawText = data.text || '';
    }

    return res.json({
      success: true,
      text: rawText,
    });
  } catch (error: any) {
    console.error('Błąd odczytu PDF w Magazynie WMS:', error);
    return res.status(500).json({
      error: error?.message || 'Wystąpił błąd podczas odczytu pliku PDF',
    });
  }
});

// Informacje o adresach sieci lokalnej Wi-Fi dla drugiego stanowiska
function getLocalNetworkUrls(activePort: number): string[] {
  const urls: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        urls.push(`http://${iface.address}:${activePort}`);
      }
    }
  }
  return urls;
}

app.get('/api/local-network-info', (_req: Request, res: Response) => {
  return res.json({
    port,
    urls: getLocalNetworkUrls(port),
    hostname: os.hostname(),
    activeUsersCount: Math.max(1, sseClients.size),
  });
});

async function startServer() {
  ensureDirs();
  readWMSStateFromDisk();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    const lanUrls = getLocalNetworkUrls(port);
    console.log('======================================================================');
    console.log(`  MAGAZYN PRZESTRZENNY WMS — EUBIOSIS (Port ${port})`);
    console.log(`  Adres na tym komputerze:  http://localhost:${port}`);
    if (lanUrls.length > 0) {
      console.log(`  Adresy Wi-Fi (Stanowisko 2): ${lanUrls.join(' , ')}`);
    }
    console.log('======================================================================');
  });
}

startServer();
