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

export type WorkstationRole = 'coordinator' | 'warehouse';

export const WORKSTATION_COORDINATOR = '1. Koordynator (Iwona / Zastępstwo)';
export const WORKSTATION_WAREHOUSE = '2. Magazyn (Zdjęcia opakowań)';

export interface SharedPackagingPhoto {
  id: string;
  fileName: string;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  orderHint?: string;
}

const WORKSTATION_KEY = 'iwonka_ksef_workstation_name_v1';
const LOCAL_DRAFTS_KEY = 'iwonka_ksef_shared_drafts_v1';
const LOCAL_PACKAGING_PHOTOS_KEY = 'iwonka_ksef_packaging_photos_v1';
const BROADCAST_CHANNEL_NAME = 'iwonka_ksef_multiuser_channel_v1';

export function getWorkstationName(): string {
  try {
    const val = localStorage.getItem(WORKSTATION_KEY);
    if (!val || val === 'Iwona – Faktury & KSeF') return WORKSTATION_COORDINATOR;
    if (val.toLowerCase().includes('magazyn')) return WORKSTATION_WAREHOUSE;
    return val;
  } catch {
    return WORKSTATION_COORDINATOR;
  }
}

export function setWorkstationName(name: string): void {
  try {
    localStorage.setItem(WORKSTATION_KEY, name.trim() || WORKSTATION_COORDINATOR);
    notifyLocalBroadcast('WORKSTATION_CHANGED', `Zmieniono stanowisko na: ${name.trim() || WORKSTATION_COORDINATOR}`);
  } catch {}
}

export function getWorkstationRole(): WorkstationRole {
  const name = getWorkstationName().toLowerCase();
  if (name.includes('magazyn') || name.startsWith('2.')) {
    return 'warehouse';
  }
  return 'coordinator';
}

export function setWorkstationRole(role: WorkstationRole): string {
  const label = role === 'warehouse' ? WORKSTATION_WAREHOUSE : WORKSTATION_COORDINATOR;
  setWorkstationName(label);
  return label;
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

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName || 'opakowanie.jpg', { type: mime });
  } catch {
    return new File([], fileName || 'opakowanie.jpg', { type: 'image/jpeg' });
  }
}

export async function getSharedPackagingPhotos(): Promise<SharedPackagingPhoto[]> {
  let localPhotos: SharedPackagingPhoto[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_PACKAGING_PHOTOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localPhotos = parsed;
    }
  } catch {}

  try {
    const res = await fetch('/api/packaging-photos');
    if (res.ok) {
      const serverPhotos = await res.json();
      if (Array.isArray(serverPhotos)) {
        const map = new Map<string, SharedPackagingPhoto>();
        for (const p of serverPhotos) {
          if (p?.id && p?.dataUrl) map.set(p.id, p);
        }
        for (const lp of localPhotos) {
          if (lp?.id && lp?.dataUrl && !map.has(lp.id)) {
            map.set(lp.id, lp);
          }
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        try {
          localStorage.setItem(LOCAL_PACKAGING_PHOTOS_KEY, JSON.stringify(merged.slice(0, 35)));
        } catch {}
        return merged;
      }
    }
  } catch {}

  return localPhotos;
}

export async function uploadSharedPackagingPhotos(
  photos: SharedPackagingPhoto[],
  workstation?: string
): Promise<SharedPackagingPhoto[]> {
  if (!photos || photos.length === 0) return getSharedPackagingPhotos();
  const ws = workstation || getWorkstationName();

  try {
    const current = await getSharedPackagingPhotos();
    const map = new Map<string, SharedPackagingPhoto>();
    for (const p of current) {
      if (p?.id) map.set(p.id, p);
    }
    for (const inc of photos) {
      if (inc?.id && inc?.dataUrl) {
        map.set(inc.id, { ...inc, uploadedBy: inc.uploadedBy || ws });
      }
    }
    const next = Array.from(map.values())
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 35);
    localStorage.setItem(LOCAL_PACKAGING_PHOTOS_KEY, JSON.stringify(next));
  } catch {}

  try {
    const res = await fetch('/api/packaging-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos, workstation: ws }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.photos)) {
        notifyLocalBroadcast(
          'PACKAGING_PHOTOS_UPLOADED',
          `📦 Magazyn wgrał ${photos.length} ${photos.length === 1 ? 'zdjęcie opakowania' : 'zdjęcia opakowań'} do przypisania i weryfikacji`
        );
        return data.photos;
      }
    }
  } catch {}

  notifyLocalBroadcast(
    'PACKAGING_PHOTOS_UPLOADED',
    `📦 Wgrano ${photos.length} zdjęć opakowań do Chmury Live`
  );
  return getSharedPackagingPhotos();
}

export async function deleteSharedPackagingPhoto(id: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_PACKAGING_PHOTOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          LOCAL_PACKAGING_PHOTOS_KEY,
          JSON.stringify(parsed.filter((p: any) => p.id !== id))
        );
      }
    }
  } catch {}

  try {
    await fetch(`/api/packaging-photos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {}

  notifyLocalBroadcast('PACKAGING_PHOTO_DELETED', 'Usunięto zdjęcie opakowania');
}

export async function clearSharedPackagingPhotos(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_PACKAGING_PHOTOS_KEY);
  } catch {}
  try {
    await fetch('/api/packaging-photos/ALL', { method: 'DELETE' });
  } catch {}
  notifyLocalBroadcast('PACKAGING_PHOTOS_CLEARED', 'Wyczyszczono zdjęcia opakowań');
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
