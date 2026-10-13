import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  WMSFullState,
  NavigationTab,
} from './types/wms';
import {
  loadLocalWMSState,
  fetchServerWMSState,
  pushServerWMSState,
  subscribeToWMSSync,
  getWorkstationName,
  fetchLocalNetworkInfo,
  LocalNetworkInfo,
} from './utils/wmsSyncService';
import { createInitialWMSState } from './utils/defaultWmsData';
import { SpatialWarehouseView } from './components/SpatialWarehouseView';
import { DocumentsManagerView } from './components/DocumentsManagerView';
import { TransfersAndFefoView } from './components/TransfersAndFefoView';
import { SuspendedItemsView } from './components/SuspendedItemsView';
import { InventoryAndCatalogView } from './components/InventoryAndCatalogView';
import {
  Warehouse,
  FileText,
  ArrowRightLeft,
  Briefcase,
  ClipboardCheck,
  Package,
  Wifi,
  Download,
  Upload,
  RotateCcw,
  Users,
  X,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export function App() {
  const [wmsState, setWmsState] = useState<WMSFullState>(() => loadLocalWMSState());
  const [activeTab, setActiveTab] = useState<NavigationTab>('magazyn_4');
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [liveToast, setLiveToast] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [networkInfo, setNetworkInfo] = useState<LocalNetworkInfo | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setLiveToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 4500);
  }, []);

  const workstationName = 'Magazyn WMS';

  // Inicjalne pobranie najnowszego stanu z lokalnego serwera Node.js
  useEffect(() => {
    fetchServerWMSState().then((remote) => {
      if (remote) {
        setWmsState(remote);
      }
    });
    fetchLocalNetworkInfo().then((info) => {
      if (info) {
        setNetworkInfo(info);
        setActiveUsersCount(info.activeUsersCount || 1);
      }
    });
  }, []);

  // Subskrypcja synchronizacji na żywo po Wi-Fi (SSE + BroadcastChannel)
  useEffect(() => {
    const unsubscribe = subscribeToWMSSync({
      onRemoteStateUpdate: (payload) => {
        if (payload.activeUsersCount) {
          setActiveUsersCount(payload.activeUsersCount);
        }
        fetchServerWMSState().then((remote) => {
          if (remote) {
            setWmsState(remote);
          }
        });
        showToast(`📡 Synchronizacja Wi-Fi: ${payload.summary} (${payload.workstation})`);
      },
    });
    return unsubscribe;
  }, [showToast]);

  const handleUpdateState = useCallback(
    async (nextState: WMSFullState, summary: string) => {
      setWmsState(nextState);
      await pushServerWMSState(nextState, summary);
      showToast(`✅ ${summary}`);
    },
    [showToast]
  );


  // Eksport całej bazy WMS do pliku JSON (Transfer danych między komputerami / Backup)
  const handleExportFullBackup = () => {
    const jsonStr = JSON.stringify(wmsState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Eubiosis_Magazyn_WMS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Pobrano pełną kopię bazy danych Magazynu WMS (.json)');
  };

  // Import bazy WMS z pliku JSON
  const handleImportFullBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.warehouses) || !Array.isArray(parsed.slots)) {
        alert('Nieprawidłowy plik kopii zapasowej Magazynu WMS.');
        return;
      }
      const next: WMSFullState = {
        ...parsed,
        revision: (wmsState.revision || 1) + 1,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateState(next, `Zaimportowano bazę danych z pliku ${file.name}`);
      setShowSyncModal(false);
    } catch (e: any) {
      alert('Błąd wczytywania pliku kopii zapasowej: ' + (e?.message || ''));
    }
  };

  const handleResetToDefaultWFirmaState = async () => {
    if (
      !window.confirm(
        'Czy chcesz przywrócić układ początkowy Magazynu 4, 5 i 6 oraz stany z zestawienia wFirma na dzień 11-10-2026?'
      )
    ) {
      return;
    }
    const fresh = createInitialWMSState();
    fresh.revision = (wmsState.revision || 1) + 1;
    await handleUpdateState(fresh, 'Przywrócono stan początkowy Magazynu 4, 5 i 6 z zestawienia wFirma (11-10-2026)');
    setShowSyncModal(false);
  };

  const pendingDocsCount = wmsState.documents.filter((d) => d.status === 'draft').length;
  const activeSuspendedCount = wmsState.suspendedRecords.filter(
    (r) => r.status === 'suspended'
  ).length;

  const navItems: {
    id: NavigationTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
    isWarehouseTab?: boolean;
  }[] = [
    {
      id: 'magazyn_4',
      label: '🎯 Magazyn 4 — Kompletacja',
      shortLabel: 'Magazyn 4',
      icon: <Warehouse className="w-4 h-4" />,
      isWarehouseTab: true,
    },
    {
      id: 'magazyn_5',
      label: '🏭 Magazyn 5 — Składowanie',
      shortLabel: 'Magazyn 5',
      icon: <Warehouse className="w-4 h-4" />,
      isWarehouseTab: true,
    },
    {
      id: 'magazyn_6',
      label: '🏭 Magazyn 6 — Składowanie',
      shortLabel: 'Magazyn 6',
      icon: <Warehouse className="w-4 h-4" />,
      isWarehouseTab: true,
    },
    {
      id: 'documents',
      label: '📥 Planowanie Dostawy & Dokumenty (FV / WZ / PZ)',
      shortLabel: 'Dostawy & Dok.',
      icon: <FileText className="w-4 h-4" />,
      badge: pendingDocsCount > 0 ? pendingDocsCount : undefined,
    },
    {
      id: 'transfers_fefo',
      label: 'Przesunięcia i FEFO',
      shortLabel: 'Przesunięcia',
      icon: <ArrowRightLeft className="w-4 h-4" />,
    },
    {
      id: 'suspended',
      label: 'W Zawieszeniu (Konferencje)',
      shortLabel: 'Konferencje',
      icon: <Briefcase className="w-4 h-4" />,
      badge: activeSuspendedCount > 0 ? activeSuspendedCount : undefined,
    },
    {
      id: 'inventory_wfirma',
      label: 'Inwentaryzacja vs wFirma',
      shortLabel: 'Inwentaryzacja',
      icon: <ClipboardCheck className="w-4 h-4" />,
    },
    {
      id: 'summary_catalog',
      label: 'Podsumowanie Ilości i Zestawy',
      shortLabel: 'Podsumowanie',
      icon: <Package className="w-4 h-4" />,
    },
  ];

  const activeWarehouseIdForTab =
    activeTab === 'magazyn_4'
      ? 'wh-mag-4'
      : activeTab === 'magazyn_5'
      ? 'wh-mag-5'
      : activeTab === 'magazyn_6'
      ? 'wh-mag-6'
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Górny pasek aplikacji */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo i tytuł */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-sm text-slate-950 font-black">
              <Warehouse className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Magazyn Przestrzenny WMS — Eubiosis
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Magazyn 4, 5, 6 • FEFO &amp; PARTNER &gt;12 msc</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Wizualizacja Przestrzenna 3D Magazynu 4 (Kompletacja), Magazynu 5 i 6 (Składowanie) • Dokumenty wFirma • Inwentaryzacja
              </p>
            </div>
          </div>

          {/* Przełącznik Stanowisk + Synchronizacja Wi-Fi + Transfer Danych */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Przycisk Synchronizacji Wi-Fi i Transferu Danych */}
            <button
              type="button"
              onClick={() => {
                fetchLocalNetworkInfo().then((info) => {
                  if (info) setNetworkInfo(info);
                });
                setShowSyncModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Wi-Fi Sync ({activeUsersCount}) &amp; Kopia Danych</span>
            </button>
          </div>
        </div>

        {/* Pasek zakładek modułów (Osobne zakładki dla Magazynu 4, Magazynu 5 i Magazynu 6) */}
        <div className="bg-slate-950/70 border-t border-slate-800/80">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2">
            {navItems.map((tab, idx) => {
              const isActive = activeTab === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  {idx === 3 && (
                    <div className="h-6 w-[1.5px] bg-slate-700 mx-1 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      isActive
                        ? tab.isWarehouseTab
                          ? 'bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950 font-extrabold shadow-sm ring-2 ring-teal-300/50'
                          : 'bg-teal-500 text-slate-950 font-extrabold shadow-xs'
                        : tab.isWarehouseTab
                        ? 'bg-slate-800/90 text-teal-200 border border-slate-700 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          isActive ? 'bg-slate-950 text-teal-300' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {/* Powiadomienie na żywo (Toast) */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-teal-500/50 text-xs font-bold flex items-center gap-2.5 max-w-md">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Główny obszar roboczy */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* GLOBALNA LEGENDA KOLORÓW PALET WIDOCZNA NA KAŻDEJ KARCIE */}
        <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 border border-slate-700 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-teal-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-wider">
                LEGENDA KOLORÓW PALET
              </span>
              <span className="text-xs font-extrabold text-slate-200">
                Obowiązuje na każdej karcie magazynu (Magazyn 4, Magazyn 5, Magazyn 6)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Kliknij dowolną paletę na planie, aby nadać etykietę <strong className="text-pink-300">PARTNER</strong> lub <strong className="text-yellow-300">1. do wyjścia</strong>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 text-xs">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-pink-500/20 border border-pink-400/60">
              <span className="w-4 h-4 rounded-md bg-pink-500 border border-pink-200 shrink-0 shadow-xs" />
              <div className="leading-tight">
                <div className="font-extrabold text-pink-200">Różowy — PARTNER</div>
                <div className="text-[10px] text-pink-100/80">Etykieta PARTNER (&ge; 12 msc)</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-yellow-400/20 border border-yellow-300/60">
              <span className="w-4 h-4 rounded-md bg-yellow-400 border border-yellow-100 shrink-0 shadow-xs" />
              <div className="leading-tight">
                <div className="font-extrabold text-yellow-200">Żółty — 1. do wyjścia</div>
                <div className="text-[10px] text-yellow-100/80">Palety pierwsze do wydania</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-red-600/25 border border-red-400/60">
              <span className="w-4 h-4 rounded-md bg-red-600 border border-red-200 shrink-0 shadow-xs" />
              <div className="leading-tight">
                <div className="font-extrabold text-red-200">Czerwony — Data &lt; 6 msc</div>
                <div className="text-[10px] text-red-100/80">Krótka data ważności (&lt; 6 msc)</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-600/25 border border-emerald-400/60">
              <span className="w-4 h-4 rounded-md bg-emerald-500 border border-emerald-200 shrink-0 shadow-xs" />
              <div className="leading-tight">
                <div className="font-extrabold text-emerald-200">Zielony — Produkty</div>
                <div className="text-[10px] text-emerald-100/80">Pozostałe miejsca na produkty</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-violet-600/25 border border-violet-400/60">
              <span className="w-4 h-4 rounded-md bg-violet-500 border border-violet-200 shrink-0 shadow-xs" />
              <div className="leading-tight">
                <div className="font-extrabold text-violet-200">Fioletowy — SF</div>
                <div className="text-[10px] text-violet-100/80">Sample Folders / Próbki</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-600/25 border border-blue-400/60">
              <span className="w-4 h-4 rounded-md bg-blue-500 border border-blue-200 shrink-0 shadow-xs" />
              <div className="leading-tight">
                <div className="font-extrabold text-blue-200">Niebieski — Materiały</div>
                <div className="text-[10px] text-blue-100/80">Kartony / Torby / Pozostałe</div>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-300 font-bold">
              ✨ Dodatkowe etykiety obramówki (bez zmiany koloru tła — można włączyć jedną lub obie na tym samym miejscu):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border-2 border-dashed border-cyan-300 text-cyan-200 font-extrabold">
                <span>🎁 ZESTAW</span>
                <span className="text-[10px] font-normal text-cyan-100/80">(przerywana jasna obramówka)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border-2 border-dashed border-amber-300 text-amber-200 font-extrabold">
                <span>🏷️ PROMOCJA</span>
                <span className="text-[10px] font-normal text-amber-100/80">(przerywana złota obramówka)</span>
              </span>
            </div>
          </div>
        </div>

        {activeWarehouseIdForTab && (
          <SpatialWarehouseView
            state={wmsState}
            activeWarehouseId={activeWarehouseIdForTab}
            onSwitchWarehouseTab={(whId) => {
              if (whId === 'wh-mag-4') setActiveTab('magazyn_4');
              else if (whId === 'wh-mag-5') setActiveTab('magazyn_5');
              else if (whId === 'wh-mag-6') setActiveTab('magazyn_6');
            }}
            workstationName={workstationName}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsManagerView
            state={wmsState}
            workstationName={workstationName}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeTab === 'transfers_fefo' && (
          <TransfersAndFefoView
            state={wmsState}
            workstationName={workstationName}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeTab === 'suspended' && (
          <SuspendedItemsView
            state={wmsState}
            workstationName={workstationName}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeTab === 'inventory_wfirma' && (
          <InventoryAndCatalogView
            state={wmsState}
            mode="inventory"
            workstationName={workstationName}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeTab === 'summary_catalog' && (
          <InventoryAndCatalogView
            state={wmsState}
            mode="catalog"
            workstationName={workstationName}
            onUpdateState={handleUpdateState}
          />
        )}
      </main>

      {/* MODAL: SYNCHRONIZACJA PO WI-FI & TRANSFER DANYCH (EKSPORT / IMPORT) */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border-2 border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-teal-600 text-white">
                  <Wifi className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Synchronizacja na żywo po Wi-Fi &amp; Transfer Danych
                  </h3>
                  <p className="text-xs text-slate-500">
                    Praca wielostanowiskowa (Koordynator + Magazyn) w tej samej sieci Wi-Fi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Adresy Wi-Fi dla drugiego komputera / tabletu na magazynie */}
            <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 space-y-2">
              <div className="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-700" />
                <span>
                  Jak połączyć drugi komputer lub tablet na Magazynie (w tym samym Wi-Fi)?
                </span>
              </div>
              <p className="text-xs text-teal-900">
                Wpisz w przeglądarce na drugim urządzeniu jeden z poniższych adresów lokalnych. Wszystkie przesunięcia palet, zatwierdzone WZ/RW/PZ/PW i stany synchronizują się na żywo w ułamku sekundy:
              </p>
              {networkInfo && networkInfo.urls.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {networkInfo.urls.map((u) => (
                    <div
                      key={u}
                      className="px-3 py-2 rounded-xl bg-white border border-teal-300 font-mono text-xs font-bold text-slate-900 flex items-center justify-between"
                    >
                      <span>{u}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(u);
                          showToast(`Skopiowano adres: ${u}`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 text-[11px] font-bold cursor-pointer"
                      >
                        Kopiuj adres
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-white border border-teal-300 font-mono text-xs font-bold text-slate-900">
                  http://localhost:3005
                </div>
              )}
            </div>

            {/* Eksport i Import pliku bazy (Transfer między komputerami) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-slate-800">
                Transfer danych między komputerami (Eksport / Import pliku kopii .json):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  className="p-3.5 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-2 text-xs font-extrabold"
                >
                  <Download className="w-4 h-4" />
                  <span>Pobierz bazę magazynu (.json)</span>
                </button>

                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImportFullBackup(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="p-3.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center justify-center gap-2 text-xs font-extrabold"
                >
                  <Upload className="w-4 h-4" />
                  <span>Wgraj bazę z pliku (.json)</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToDefaultWFirmaState}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Przywróć bilans początkowy z wFirma (11-10-2026)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
