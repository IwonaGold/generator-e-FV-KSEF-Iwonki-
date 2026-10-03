import {
  EntityDetails,
  InvoiceItem,
  InvoiceMeta,
  LogisticsFormat,
  PharmacyChain,
  ThirdPartyEntity,
} from '../types/ksef';

export interface CloudActivityEvent {
  type: string;
  summary: string;
  workstation: string;
  timestamp: string;
}

export interface ActiveWorkstationInfo {
  id: string;
  workstation: string;
  connectedAt: string;
}

export interface CloudSyncStatus {
  enabled: boolean;
  encryption: string;
  repo: string;
  branch: string;
  lastSyncAt: string | null;
  lastError: string | null;
  revision: number;
  lastActivity?: CloudActivityEvent;
  ordersCount: number;
  knowledgeCount: number;
  sharedDraftsCount: number;
  activeUsersCount: number;
  activeWorkstations: ActiveWorkstationInfo[];
}

export interface SharedInvoiceDraft {
  id: string;
  title: string;
  authorWorkstation: string;
  stageNote: string;
  updatedAt: string;
  selectedChain: PharmacyChain;
  logisticsFormat: LogisticsFormat;
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty: ThirdPartyEntity | null;
  meta: InvoiceMeta;
  items: InvoiceItem[];
}

const WORKSTATION_KEY = 'iwonka_ksef_workstation_name_v1';
const LOCAL_DRAFTS_KEY = 'iwonka_ksef_shared_drafts_v1';
const BROADCAST_CHANNEL_NAME = 'iwonka_ksef_multiuser_channel_v1';

export function getWorkstationName(): string {
  try {
    return localStorage.getItem(WORKSTATION_KEY) || 'Iwona – Faktury & KSeF';
  } catch {
    return 'Iwona – Faktury & KSeF';
  }
}

export function setWorkstationName(name: string): void {
  try {
    localStorage.setItem(WORKSTATION_KEY, name.trim() || 'Iwona – Faktury & KSeF');
  } catch {}
}

export async function fetchCloudStatus(): Promise<CloudSyncStatus | null> {
  try {
    const res = await fetch('/api/cloud-status');
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

export async function triggerForceCloudSync(workstation?: string): Promise<{
  success: boolean;
  ordersCount?: number;
  knowledgeCount?: number;
  draftsCount?: number;
  lastSyncAt?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/cloud-sync-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workstation: workstation || getWorkstationName() }),
    });
    const data = await res.json();
    notifyLocalBroadcast('MANUAL_CLOUD_SYNC', 'Zsynchronizowano bazę z chmurą');
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Błąd połączenia z serwerem' };
  }
}

export async function updateCloudConfig(githubToken: string, vaultRepo?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/cloud-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubToken, vaultRepo }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getSharedDrafts(): Promise<SharedInvoiceDraft[]> {
  let localDrafts: SharedInvoiceDraft[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localDrafts = parsed;
    }
  } catch {}

  try {
    const res = await fetch('/api/shared-drafts');
    if (res.ok) {
      const serverDrafts = await res.json();
      if (Array.isArray(serverDrafts)) {
        const map = new Map<string, SharedInvoiceDraft>();
        for (const d of serverDrafts) {
          if (d?.id) map.set(d.id, d);
        }
        for (const l of localDrafts) {
          if (!l?.id) continue;
          const ex = map.get(l.id);
          if (!ex) {
            map.set(l.id, l);
          } else {
            const tS = ex.updatedAt ? new Date(ex.updatedAt).getTime() : 0;
            const tL = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;
            map.set(l.id, tL >= tS ? l : ex);
          }
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        try {
          localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(merged));
        } catch {}
        return merged;
      }
    }
  } catch {}

  return localDrafts;
}

export async function saveSharedDraft(draft: SharedInvoiceDraft): Promise<SharedInvoiceDraft> {
  const updated: SharedInvoiceDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };

  try {
    const current = await getSharedDrafts();
    const idx = current.findIndex((d) => d.id === updated.id);
    const next =
      idx >= 0 ? current.map((d, i) => (i === idx ? updated : d)) : [updated, ...current];
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(next.slice(0, 30)));
  } catch {}

  try {
    await fetch('/api/shared-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch {}

  notifyLocalBroadcast('SHARED_DRAFT_SAVED', `Udostępniono szkic: ${updated.title}`);
  return updated;
}

export async function deleteSharedDraft(id: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          LOCAL_DRAFTS_KEY,
          JSON.stringify(parsed.filter((d: any) => d.id !== id))
        );
      }
    }
  } catch {}

  try {
    await fetch(`/api/shared-drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {}

  notifyLocalBroadcast('SHARED_DRAFT_DELETED', 'Usunięto szkic roboczy');
}

export function notifyLocalBroadcast(type: string, summary: string) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({
        type,
        summary,
        workstation: getWorkstationName(),
        timestamp: new Date().toISOString(),
      });
      bc.close();
    }
  } catch {}
}

export function subscribeToMultiUserSync(callbacks: {
  onRemoteUpdate: (event: {
    revision?: number;
    activity?: CloudActivityEvent;
    activeUsersCount?: number;
    activeWorkstations?: ActiveWorkstationInfo[];
  }) => void;
}): () => void {
  let eventSource: EventSource | null = null;
  let bc: BroadcastChannel | null = null;
  let lastKnownRevision = 0;

  const connectSse = () => {
    try {
      const ws = encodeURIComponent(getWorkstationName());
      eventSource = new EventSource(`/api/live-sync-stream?workstation=${ws}`);
      eventSource.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.revision && data.revision !== lastKnownRevision) {
            const isFirst = lastKnownRevision === 0;
            lastKnownRevision = data.revision;
            if (!isFirst) {
              callbacks.onRemoteUpdate(data);
            } else {
              // Przy pierwszym połączeniu tylko zaktualizuj licznik użytkowników
              callbacks.onRemoteUpdate({ ...data, activity: undefined });
            }
          }
        } catch {}
      };
    } catch {}
  };

  connectSse();

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (ev) => {
        callbacks.onRemoteUpdate({
          activity: ev.data,
        });
      };
    }
  } catch {}

  return () => {
    try {
      eventSource?.close();
    } catch {}
    try {
      bc?.close();
    } catch {}
  };
}
