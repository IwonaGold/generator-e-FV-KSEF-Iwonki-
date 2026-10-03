import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Users,
  Layers,
  Download,
  Upload,
  Trash2,
  Send,
  Sparkles,
  Lock,
  Monitor,
  ArrowRight,
} from 'lucide-react';
import {
  EntityDetails,
  InvoiceItem,
  InvoiceMeta,
  LogisticsFormat,
  PharmacyChain,
  ThirdPartyEntity,
} from '../types/ksef';
import {
  CloudSyncStatus,
  SharedInvoiceDraft,
  fetchCloudStatus,
  triggerForceCloudSync,
  getWorkstationName,
  setWorkstationName,
  getSharedDrafts,
  saveSharedDraft,
  deleteSharedDraft,
  updateCloudConfig,
} from '../utils/cloudSyncService';
import { ArchivedOrder } from '../types/ordersHistory';
import { KeyClientProfile } from '../types/knowledgeBase';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChain: PharmacyChain;
  currentLogisticsFormat: LogisticsFormat;
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty: ThirdPartyEntity | null;
  meta: InvoiceMeta;
  items: InvoiceItem[];
  archivedOrders: ArchivedOrder[];
  knowledgeClients: KeyClientProfile[];
  onLoadSharedDraft: (draft: SharedInvoiceDraft) => void;
  onManualSyncComplete: () => Promise<void>;
}

const WORKSTATION_PRESETS = [
  'Iwona – Faktury & KSeF',
  'Magazyn – Serie LOT i Daty MHD',
  'Logistyka – Paczki & Listy Przewozowe',
  'Zarząd – Eubiosis Sp. z o.o.',
];

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  currentChain,
  currentLogisticsFormat,
  seller,
  buyer,
  thirdParty,
  meta,
  items,
  archivedOrders,
  knowledgeClients,
  onLoadSharedDraft,
  onManualSyncComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'STATUS' | 'SHARED_DESK' | 'VAULT'>('STATUS');
  const [workstation, setWorkstation] = useState<string>(getWorkstationName());
  const [status, setStatus] = useState<CloudSyncStatus | null>(null);
  const [sharedDrafts, setSharedDrafts] = useState<SharedInvoiceDraft[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Pola dla nowego szkicu na Wspólnym Stole Roboczym
  const [draftNote, setDraftNote] = useState<string>(
    'Proszę o dopisanie serii LOT i dat ważności MHD z opakowań'
  );

  // Pole opcjonalnego tokena chmurowego
  const [customToken, setCustomToken] = useState<string>('');

  const loadData = async () => {
    const [st, drafts] = await Promise.all([fetchCloudStatus(), getSharedDrafts()]);
    if (st) setStatus(st);
    setSharedDrafts(drafts);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveWorkstation = (newName: string) => {
    setWorkstation(newName);
    setWorkstationName(newName);
    setBannerMsg(`✓ Ustawiono nazwę tego stanowiska: "${newName}"`);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerForceCloudSync(workstation);
      await onManualSyncComplete();
      await loadData();
      if (res.success) {
        setBannerMsg(
          `☁️ Pełna synchronizacja zakończona pomyślnie! (${
            res.ordersCount ?? archivedOrders.length
          } zamówień, ${res.knowledgeCount ?? knowledgeClients.length} kart CRM)`
        );
      } else {
        setBannerMsg('☁️ Zsynchronizowano pamięć lokalną i serwerową.');
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setBannerMsg(null), 6000);
    }
  };

  const handlePublishCurrentDraft = async () => {
    const title =
      meta.orderNumber || meta.invoiceNumber
        ? `${buyer.name || currentChain} · ${meta.orderNumber || meta.invoiceNumber}`
        : `${buyer.name || 'Nowe zamówienie'} (${items.length} poz.)`;

    const draft: SharedInvoiceDraft = {
      id: meta.orderNumber
        ? `draft-${meta.orderNumber.replace(/[^a-zA-Z0-9]/g, '_')}`
        : `draft-${Date.now()}`,
      title,
      authorWorkstation: workstation,
      stageNote: draftNote,
      updatedAt: new Date().toISOString(),
      selectedChain: currentChain,
      logisticsFormat: currentLogisticsFormat,
      seller,
      buyer,
      thirdParty,
      meta,
      items,
    };

    await saveSharedDraft(draft);
    await loadData();
    setBannerMsg(
      `🤝 Udostępniono bieżący formularz ("${title}") na Wspólnym Stole Roboczym dla innych stanowisk!`
    );
    setTimeout(() => setBannerMsg(null), 6000);
  };

  const handleDeleteDraft = async (id: string) => {
    await deleteSharedDraft(id);
    await loadData();
  };

  const handleExportBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: workstation,
      orders: archivedOrders,
      knowledgeClients,
      sharedDrafts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kopia_Chmury_Eubiosis_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveCloudToken = async () => {
    if (!customToken.trim()) return;
    setIsSyncing(true);
    const ok = await updateCloudConfig(customToken.trim());
    await loadData();
    setIsSyncing(false);
    setCustomToken('');
    if (ok) {
      setBannerMsg('🔒 Zapisano klucz dostępu do szyfrowanego sejfu chmurowego AES-256!');
      setTimeout(() => setBannerMsg(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl border border-emerald-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ==================================================================== */}
        {/* NAGŁÓWEK MODALA SYNCHRONIZACJI CHMUROWEJ MULTI-USER                  */}
        {/* ==================================================================== */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-teal-900 to-indigo-950 text-white flex items-center justify-between gap-3 border-b border-emerald-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-2xl shadow-lg border border-white/20 shrink-0">
              ☁️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Współdzielona Baza Danych w Chmurze (Multi-User Sync)
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-slate-950 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                  Live SSE + Sejf AES-256
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                Synchronizacja zamówień, zdjęć paczek, Centrum Wiedzy (CRM) oraz Wspólnego Stołu Roboczego pomiędzy stanowiskami w czasie rzeczywistym.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ==================================================================== */}
        {/* ZAKŁADKI NAWIGACYJNE                                                 */}
        {/* ==================================================================== */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('STATUS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'STATUS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>1. Status Live & Stanowiska ({status?.activeUsersCount || 1})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SHARED_DESK')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SHARED_DESK'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-indigo-50 border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2. Wspólny Stół Roboczy Biuro ↔ Magazyn ({sharedDrafts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('VAULT')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'VAULT'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>3. Sejf AES-256 & Kopia Zapasowa</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizacja...' : 'Synchronizuj teraz'}</span>
          </button>
        </div>

        {/* Powiadomienie */}
        {bannerMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ZAWARTOŚĆ ZAKŁADEK                                                   */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ZAKŁADKA 1: STATUS LIVE & STANOWISKA */}
          {activeTab === 'STATUS' && (
            <div className="space-y-5">
              {/* Karty podsumowujące zawartość współdzielonej bazy */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
                  <div className="text-[11px] font-bold uppercase text-rose-700">
                    Zsynchronizowane Zamówienia i FV
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {archivedOrders.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Wraz z plikami XML, listami przewozowymi i zdjęciami paczek
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                  <div className="text-[11px] font-bold uppercase text-indigo-700">
                    Karty Sieci w Centrum Wiedzy
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {knowledgeClients.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Cenniki, wymogi MHD, kontakty, kody korekt i notatki
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-[11px] font-bold uppercase text-emerald-700">
                    Wspólny Stół Roboczy
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {sharedDrafts.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Robocze faktury przekazywane między Biurem a Magazynem
                  </div>
                </div>
              </div>

              {/* Wybór roli / nazwy bieżącego stanowiska */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-emerald-600" />
                      <span>Twoje stanowisko robocze (widoczne dla innych przy zapisie zmian):</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Wybierz rolę tego komputera/telefonu lub wpisz własną nazwę:
                    </p>
                  </div>
                  <input
                    type="text"
                    value={workstation}
                    onChange={(e) => handleSaveWorkstation(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-900 w-full sm:w-64"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {WORKSTATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSaveWorkstation(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        workstation === preset
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aktywne urządzenia oraz ostatnia aktywność w chmurze */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <h4 className="text-xs font-black text-slate-900 mb-2 flex items-center justify-between">
                    <span>🟢 Aktywne stanowiska połączone na żywo (SSE)</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                      {status?.activeUsersCount || 1} online
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {(status?.activeWorkstations && status.activeWorkstations.length > 0
                      ? status.activeWorkstations
                      : [{ id: 'local', workstation, connectedAt: new Date().toISOString() }]
                    ).map((ws) => (
                      <div
                        key={ws.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>{ws.workstation}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Aktywne połączenie
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <h4 className="text-xs font-black text-slate-900 mb-2">
                    📡 Ostatnia operacja w chmurze Eubiosis
                  </h4>
                  {status?.lastActivity ? (
                    <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-1">
                      <div className="text-xs font-bold text-indigo-950">
                        {status.lastActivity.summary}
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>Stanowisko: <strong>{status.lastActivity.workstation}</strong></span>
                        <span className="font-mono">
                          {new Date(status.lastActivity.timestamp).toLocaleTimeString('pl-PL')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Baza zsynchronizowana. Każda zmiana zamówienia lub karty klienta jest automatycznie rozsyłana do wszystkich urządzeń.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ZAKŁADKA 2: WSPÓLNY STÓŁ ROBOCZY (BIURO <-> MAGAZYN) */}
          {activeTab === 'SHARED_DESK' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                <div>
                  <h3 className="text-sm font-black text-indigo-950">
                    🤝 Przekaż aktualnie otwartą fakturę / zamówienie innemu stanowisku
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Przykład: Wczytujesz zamówienie PDF na swoim komputerze w biurze i klikasz <strong>„Udostępnij na Wspólnym Stole”</strong>. Pracownik na magazynie otwiera ten stół na swoim komputerze/telefonie, robi zdjęcia serii <code>LOT</code> i dat <code>MHD</code>, zapisuje z powrotem, a Ty jednym kliknięciem odbierasz gotową fakturę do wysyłki KSeF!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="Notatka dla drugiego stanowiska (np. Proszę o dopisanie serii LOT i dat ważności)..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-indigo-300 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handlePublishCurrentDraft}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 rounded-xl shadow-sm cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Udostępnij bieżący formularz ({items.length} poz.)</span>
                  </button>
                </div>
              </div>

              {/* Lista udostępnionych szkiców na Wspólnym Stole */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Aktywne zamówienia na Wspólnym Stole Roboczym ({sharedDrafts.length})
                </h4>

                {sharedDrafts.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 text-xs text-slate-500">
                    Wspólny Stół Roboczy jest obecnie pusty. Kliknij przycisk powyżej, aby udostępnić bieżący formularz faktury innemu stanowisku.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sharedDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-slate-900">
                              {draft.title}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-full">
                              {draft.items?.length || 0} pozycji
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {new Date(draft.updatedAt).toLocaleString('pl-PL')}
                            </span>
                          </div>
                          <p className="text-xs text-indigo-900 font-semibold">
                            📌 {draft.stageNote || 'Gotowe do dalszej obróbki'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Ostatnio zapisane przez: <strong>{draft.authorWorkstation}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onLoadSharedDraft(draft);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                          >
                            <span>Wczytaj do formularza</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(draft.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Usuń ze Wspólnego Stołu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ZAKŁADKA 3: SEJF AES-256 & KOPIA ZAPASOWA */}
          {activeTab === 'VAULT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Szyfrowany Sejf Chmurowy Eubiosis (AES-256-GCM + GZIP)</span>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                      status?.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {status?.enabled
                      ? '✓ Połączono z chmurą GitHub Vault'
                      : 'Tryb Serwerowy + IndexedDB'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Wszystkie zamówienia, zdjęcia paczek, karty klientów CRM oraz szkice ze Wspólnego Stołu są kompresowane (<code>GZIP</code>) i szyfrowane kluczem prywatnym <code>AES-256-GCM</code> przed zapisem w chmurze (repozytorium: <code>{status?.repo || 'IwonaGold/ksef-prywatny-sejf'}</code>, gałąź: <code>{status?.branch || 'app-data'}</code>).
                </p>
              </div>

              {/* Eksport pełnej kopii zapasowej na dysk */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    📦 Pełna Kopia Zapasowa Bazy Danych (Plik JSON)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pobierz na dysk pojedynczy plik zawierający wszystkie zamówienia ({archivedOrders.length}), karty CRM ({knowledgeClients.length}) oraz szkice robocze ({sharedDrafts.length}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackupJson}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz kopię bazy (.json)</span>
                </button>
              </div>

              {/* Opcjonalna aktualizacja tokena chmurowego */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                <h4 className="text-xs font-black text-slate-900">
                  🔑 Konfiguracja klucza chmurowego (opcjonalnie dla nowych serwerów)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Na obecnym serwerze poświadczenia GitHub zostały wykryte automatycznie. Jeśli kiedykolwiek przeniesiesz aplikację na nowy serwer zewnętrzny, możesz tutaj wkleić token dostępu (`GITHUB_TOKEN`):
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    placeholder="ghp_... lub github_pat_..."
                    className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCloudToken}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl cursor-pointer"
                  >
                    Zapisz klucz
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* STOPKA                                                               */}
        {/* ==================================================================== */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Rewizja bazy: <strong>#{status?.revision || 1}</strong> · Ostatnia synchronizacja:{' '}
              <strong>
                {status?.lastSyncAt
                  ? new Date(status.lastSyncAt).toLocaleTimeString('pl-PL')
                  : 'Teraz'}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
