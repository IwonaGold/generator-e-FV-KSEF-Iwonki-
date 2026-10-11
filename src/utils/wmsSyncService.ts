import { WMSFullState, WorkstationRole } from '../types/wms';
import { createInitialWMSState, DEFAULT_PRODUCTS_CATALOG } from './defaultWmsData';

const LOCAL_STORAGE_STATE_KEY = 'eubiosis_wms_state_v5';
const WORKSTATION_ROLE_KEY = 'eubiosis_wms_workstation_role_v1';
const WORKSTATION_NAME_KEY = 'eubiosis_wms_workstation_name_v1';
const BROADCAST_CHANNEL_NAME = 'eubiosis_wms_realtime_channel_v2';

function applyCleanProductNames(state: WMSFullState): WMSFullState {
  if (!Array.isArray(state.products)) return state;
  const defaultMap = new Map(DEFAULT_PRODUCTS_CATALOG.map((p) => [p.id, p]));
  return {
    ...state,
    products: state.products.map((prod) => {
      const def = defaultMap.get(prod.id);
      if (def) {
        return {
          ...prod,
          name: def.name,
          shortName: def.shortName,
        };
      }
      return prod;
    }),
  };
}

export function getWorkstationRole(): WorkstationRole {
  try {
    const val = localStorage.getItem(WORKSTATION_ROLE_KEY);
    if (val === 'warehouse' || val === 'coordinator') return val;
  } catch {}
  return 'coordinator';
}

export function setWorkstationRoleStorage(role: WorkstationRole): void {
  try {
    localStorage.setItem(WORKSTATION_ROLE_KEY, role);
  } catch {}
}

export function getWorkstationName(): string {
  try {
    const saved = localStorage.getItem(WORKSTATION_NAME_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  const role = getWorkstationRole();
  return role === 'warehouse' ? 'Stanowisko 2: Magazyn' : 'Stanowisko 1: Koordynator';
}

export function setWorkstationNameStorage(name: string): void {
  try {
    localStorage.setItem(WORKSTATION_NAME_KEY, name.trim());
  } catch {}
}

export function loadLocalWMSState(): WMSFullState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.warehouses) &&
        Array.isArray(parsed.racks) &&
        Array.isArray(parsed.slots) &&
        parsed.warehouses.some((w: any) => w.id === 'wh-mag-4') &&
        parsed.racks.some((r: any) => r.id === 'rack-m5-r1')
      ) {
        return applyCleanProductNames(parsed);
      }
    }
  } catch (e) {
    console.warn('Błąd odczytu lokalnego stanu WMS, tworzenie stanu początkowego:', e);
  }
  const initial = createInitialWMSState();
  saveLocalWMSState(initial);
  return initial;
}

export function saveLocalWMSState(state: WMSFullState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Błąd zapisu stanu WMS w localStorage:', e);
  }
}

export async function fetchServerWMSState(): Promise<WMSFullState | null> {
  try {
    const res = await fetch('/api/wms-state', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.state && Array.isArray(data.state.warehouses)) {
      if (
        !data.state.warehouses.some((w: any) => w.id === 'wh-mag-4') ||
        !Array.isArray(data.state.racks) ||
        !data.state.racks.some((r: any) => r.id === 'rack-m5-r1')
      ) {
        const upgraded = createInitialWMSState();
        upgraded.revision = (data.state.revision || 1) + 1;
        await pushServerWMSState(
          upgraded,
          'Aktualizacja układu hal i nazw produktów (od razu rodzaj i wariant)'
        );
        return upgraded;
      }
      const cleaned = applyCleanProductNames(data.state);
      saveLocalWMSState(cleaned);
      return cleaned;
    }
  } catch {}
  return null;
}

export async function pushServerWMSState(
  state: WMSFullState,
  summary: string
): Promise<WMSFullState> {
  saveLocalWMSState(state);

  // Powiadom inne karty tej samej przeglądarki
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({
        type: 'WMS_STATE_UPDATED',
        summary,
        workstation: getWorkstationName(),
        revision: state.revision,
      });
      bc.close();
    }
  } catch {}

  try {
    const res = await fetch('/api/wms-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state,
        summary,
        workstation: getWorkstationName(),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.state) {
        saveLocalWMSState(data.state);
        return data.state;
      }
    }
  } catch {}

  return state;
}

export interface LocalNetworkInfo {
  port: number;
  urls: string[];
  hostname: string;
  activeUsersCount: number;
}

export async function fetchLocalNetworkInfo(): Promise<LocalNetworkInfo | null> {
  try {
    const res = await fetch('/api/local-network-info');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function extractPdfTextViaServer(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const pdfBase64 = btoa(binary);

  const res = await fetch('/api/extract-pdf-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64,
      fileName: file.name,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Błąd odczytu pliku PDF na serwerze');
  }

  const data = await res.json();
  return data.text || '';
}

export function subscribeToWMSSync(callbacks: {
  onRemoteStateUpdate: (payload: {
    revision: number;
    summary: string;
    workstation: string;
    activeUsersCount: number;
  }) => void;
}): () => void {
  let eventSource: EventSource | null = null;
  let bc: BroadcastChannel | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connectSSE = () => {
    if (closed) return;
    try {
      const wsName = encodeURIComponent(getWorkstationName());
      eventSource = new EventSource(`/api/sync-events?workstation=${wsName}`);
      eventSource.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed && typeof parsed.revision === 'number') {
            callbacks.onRemoteStateUpdate({
              revision: parsed.revision,
              summary: parsed.activity?.summary || 'Aktualizacja stanu magazynu',
              workstation: parsed.activity?.workstation || 'Inne stanowisko',
              activeUsersCount: parsed.activeUsersCount || 1,
            });
          }
        } catch {}
      };
      eventSource.onerror = () => {
        try {
          eventSource?.close();
        } catch {}
        if (!closed) {
          reconnectTimer = setTimeout(connectSSE, 4000);
        }
      };
    } catch {}
  };

  connectSSE();

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'WMS_STATE_UPDATED') {
          callbacks.onRemoteStateUpdate({
            revision: ev.data.revision || 0,
            summary: ev.data.summary || 'Aktualizacja w innej karcie',
            workstation: ev.data.workstation || 'Lokalna karta',
            activeUsersCount: 1,
          });
        }
      };
    }
  } catch {}

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      eventSource?.close();
    } catch {}
    try {
      bc?.close();
    } catch {}
  };
}
