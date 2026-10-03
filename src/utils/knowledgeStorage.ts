import { KeyClientProfile, INITIAL_KEY_CLIENTS } from '../types/knowledgeBase';

const STORAGE_KEY = 'iwonka_ksef_knowledge_crm_v1';

function readClientsFromLocalStorage(): KeyClientProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Błąd odczytu Centrum Wiedzy z localStorage:', e);
    return [];
  }
}

function writeClientsToLocalStorage(clients: KeyClientProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn('Błąd zapisu Centrum Wiedzy w localStorage:', e);
  }
}

function mergeServerAndLocalClients(
  serverList: KeyClientProfile[],
  localList: KeyClientProfile[]
): KeyClientProfile[] {
  const map = new Map<string, KeyClientProfile>();

  for (const srv of serverList) {
    if (srv?.id) map.set(srv.id, srv);
  }

  for (const loc of localList) {
    if (!loc?.id) continue;
    const existing = map.get(loc.id);
    if (!existing) {
      map.set(loc.id, loc);
    } else {
      const tSrv = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const tLoc = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      map.set(loc.id, tLoc >= tSrv ? loc : existing);
    }
  }

  // Upewnij się, że domyślni klienci kluczowi są zawsze obecni, jeśli baza nie ma ich jeszcze
  for (const def of INITIAL_KEY_CLIENTS) {
    if (!map.has(def.id)) {
      map.set(def.id, def);
    }
  }

  return Array.from(map.values());
}

export async function getKeyClients(): Promise<KeyClientProfile[]> {
  const localClients = readClientsFromLocalStorage();
  let serverClients: KeyClientProfile[] = [];

  try {
    const res = await fetch('/api/knowledge-base');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        serverClients = data;
      }
    }
  } catch (err) {
    console.warn('Serwer API Centrum Wiedzy niedostępny, używam pamięci lokalnej:', err);
  }

  if (serverClients.length > 0 || localClients.length > 0) {
    const merged = mergeServerAndLocalClients(serverClients, localClients);
    writeClientsToLocalStorage(merged);

    // Synchronizuj z serwerem / chmurą, jeśli w przeglądarce są nowsze wpisy
    const srvMap = new Map(serverClients.map((c) => [c.id, c]));
    const needsSync =
      merged.length !== serverClients.length ||
      merged.some((m) => {
        const s = srvMap.get(m.id);
        return !s || (m.updatedAt || '') !== (s.updatedAt || '') || (m.notes?.length || 0) !== (s.notes?.length || 0);
      });

    if (needsSync) {
      fetch('/api/knowledge-base/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: merged }),
      }).catch(() => {});
    }

    return merged;
  }

  writeClientsToLocalStorage(INITIAL_KEY_CLIENTS);
  return INITIAL_KEY_CLIENTS;
}

export async function saveKeyClient(client: KeyClientProfile): Promise<KeyClientProfile> {
  const updatedClient: KeyClientProfile = {
    ...client,
    updatedAt: new Date().toISOString(),
  };

  try {
    await fetch('/api/knowledge-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedClient),
    });
  } catch (err) {
    console.warn('Nie udało się zapisać klienta na serwerze:', err);
  }

  const current = readClientsFromLocalStorage();
  const base = current.length > 0 ? current : INITIAL_KEY_CLIENTS;
  const idx = base.findIndex((c) => c.id === updatedClient.id);
  const next = idx >= 0 ? base.map((c, i) => (i === idx ? updatedClient : c)) : [...base, updatedClient];
  writeClientsToLocalStorage(next);

  return updatedClient;
}

export async function deleteKeyClient(id: string): Promise<boolean> {
  try {
    await fetch(`/api/knowledge-base/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Błąd usuwania klienta na serwerze:', err);
  }

  const current = readClientsFromLocalStorage();
  const filtered = current.filter((c) => c.id !== id);
  writeClientsToLocalStorage(filtered);
  return true;
}
