import React, { useState, useRef, useMemo } from 'react';
import {
  WMSFullState,
  KitHandlingMode,
  ProductCatalogItem,
} from '../types/wms';
import { computeAllProductsSummary } from '../utils/wmsEngine';
import { extractPdfTextViaServer } from '../utils/wmsSyncService';
import {
  parseWFirmaInventoryText,
  matchProductFromCatalog,
} from '../utils/wfirmaParser';
import { buildInitialSlotsWithAllocations } from '../utils/defaultWmsData';
import {
  ClipboardCheck,
  Upload,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Plus,
  Layers,
  X,
} from 'lucide-react';

interface InventoryAndCatalogViewProps {
  state: WMSFullState;
  mode: 'inventory' | 'catalog';
  workstationName: string;
  onUpdateState: (nextState: WMSFullState, summary: string) => void;
}

export const InventoryAndCatalogView: React.FC<InventoryAndCatalogViewProps> = ({
  state,
  mode,
  workstationName,
  onUpdateState,
}) => {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDiff, setFilterDiff] = useState<
    'ALL' | 'discrepancy' | 'suspended_match' | 'partner_12m_warn'
  >('ALL');
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modal dodawania nowego produktu do katalogu
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdShort, setNewProdShort] = useState('');
  const [newProdEan, setNewProdEan] = useState('');
  const [newProdCategory, setNewProdCategory] =
    useState<ProductCatalogItem['category']>('probiotic');
  const [newProdMinPick, setNewProdMinPick] = useState(40);

  const summaries = useMemo(() => computeAllProductsSummary(state), [state]);

  // Wgranie nowego pliku PDF "Zestawienie stanów / STANY MAGAZYNOWE" z wFirma
  const handleUploadWFirmaInventoryPdf = async (file: File) => {
    setIsUploading(true);
    setBanner(null);

    try {
      const rawText = await extractPdfTextViaServer(file);
      const snapshot = parseWFirmaInventoryText(rawText);

      if (snapshot.rows.length === 0) {
        setBanner({
          type: 'err',
          text: 'Nie udało się odczytać wierszy tabeli z zestawienia stanów wFirma. Upewnij się, że to wydruk "Zestawienie stanów" z wFirma.pl.',
        });
        return;
      }

      // Zsumuj wiersze cenowe FIFO z wFirma dla każdego produktu w katalogu (osobno PL i osobno PARTNER)
      const nextProducts: ProductCatalogItem[] = state.products.map((p) => ({
        ...p,
        wfirmaStockRegular: 0,
        wfirmaStockPartner: 0,
        wfirmaLastUpdated: snapshot.snapshotDate,
      }));

      for (const row of snapshot.rows) {
        let matched = matchProductFromCatalog(row.ktm, row.name, nextProducts);
        if (!matched) {
          // Jeśli w nowym zestawieniu wFirma pojawił się zupełnie nowy produkt, dodaj go automatycznie do katalogu!
          const newId = `prod-auto-${Date.now()}-${row.lp}`;
          const created: ProductCatalogItem = {
            id: newId,
            baseEan: row.baseEan || '',
            skuRegular: row.isPartner ? row.baseEan || row.ktm : row.ktm || row.name,
            skuPartner: row.isPartner ? row.ktm : undefined,
            name: row.name.replace(/\s*PARTNER\s*$/i, '').trim(),
            shortName: row.name.slice(0, 32),
            category: /PRÓBKA/i.test(row.name)
              ? 'sample'
              : /ZESTAW|PROMOCJA/i.test(row.name)
              ? 'promo_kit'
              : 'probiotic',
            unit: row.unit || 'szt.',
            avgPurchasePriceNet: row.purchasePrice || 0,
            minPickingStock: 20,
            kitHandlingMode: 'separate_slot',
            wfirmaStockRegular: row.isPartner ? 0 : row.quantity,
            wfirmaStockPartner: row.isPartner ? row.quantity : 0,
            wfirmaLastUpdated: snapshot.snapshotDate,
          };
          nextProducts.push(created);
        } else {
          if (row.isPartner) {
            matched.wfirmaStockPartner += row.quantity;
          } else {
            matched.wfirmaStockRegular += row.quantity;
          }
          if (row.purchasePrice > 0) {
            matched.avgPurchasePriceNet = row.purchasePrice;
          }
        }
      }

      const nowIso = new Date().toISOString();
      onUpdateState(
        {
          ...state,
          revision: state.revision + 1,
          updatedAt: nowIso,
          products: nextProducts,
          wfirmaSnapshot: snapshot,
        },
        `Wgrano zestawienie stanów wFirma na dzień ${snapshot.snapshotDate} (${snapshot.totalRowsParsed} wierszy FIFO)`
      );

      setBanner({
        type: 'ok',
        text: `Wczytano zestawienie stanów z wFirma na dzień ${snapshot.snapshotDate}: przeanalizowano i zsumowano ${snapshot.totalRowsParsed} wierszy cenowych FIFO (łączna wartość netto wFirma: ${snapshot.totalValueNet.toLocaleString(
          'pl-PL',
          { minimumFractionDigits: 2 }
        )} PLN).`,
      });
    } catch (err: any) {
      setBanner({
        type: 'err',
        text: err?.message || 'Błąd odczytu pliku PDF z wFirma.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Przełączenie trybu obsługi zestawu / promocji (Osobne miejsce na półce vs Wirtualny zestaw rozbijany na składowe)
  const handleToggleKitMode = (productId: string, nextMode: KitHandlingMode) => {
    const nextProducts = state.products.map((p) =>
      p.id === productId ? { ...p, kitHandlingMode: nextMode } : p
    );
    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
        products: nextProducts,
      },
      'Zmieniono tryb obsługi zestawu/promocji'
    );
  };

  // Wyrównanie stanu pojedynczego produktu na Strefie Kompletacji do stanu z wFirma
  const handleSyncSingleProductToWFirma = (
    summary: ReturnType<typeof computeAllProductsSummary>[number]
  ) => {
    const diff = summary.wfirmaTotal - summary.totalControlledStock;
    if (diff === 0) return;

    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) => ({
      ...s,
      allocations: s.allocations.map((a) => ({ ...a })),
    }));

    // Znajdź miejsce, na którym leży ten produkt (lub pierwsze gniazdo kompletacji)
    let targetSlot =
      nextSlots.find((s) => s.allocations.some((a) => a.productId === summary.product.id)) ||
      nextSlots.find((s) => s.slotType === 'picking_standard') ||
      nextSlots[0];

    if (!targetSlot) return;

    if (diff > 0) {
      // Dodaj brakującą ilość
      const existing = targetSlot.allocations.find((a) => a.productId === summary.product.id);
      if (existing) {
        existing.quantity += diff;
        existing.updatedAt = nowIso;
      } else {
        targetSlot.allocations.push({
          id: `batch-adj-${Date.now()}`,
          productId: summary.product.id,
          quantity: diff,
          lotNumber: 'KOR-INW-2026',
          expiryDate: '2028-06-30',
          palletLabel: 'Wyrównanie do wFirma',
          updatedAt: nowIso,
        });
      }
    } else {
      // Odejmij nadwyżkę
      let toRemove = Math.abs(diff);
      for (const s of nextSlots) {
        for (const b of s.allocations) {
          if (toRemove <= 0) break;
          if (b.productId !== summary.product.id || b.quantity <= 0) continue;
          const cut = Math.min(b.quantity, toRemove);
          b.quantity -= cut;
          toRemove -= cut;
        }
        s.allocations = s.allocations.filter((b) => b.quantity > 0);
      }
    }

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
        movementsHistory: [
          {
            id: `mov-adj-${Date.now()}`,
            timestamp: nowIso,
            type: 'INVENTORY_ADJUST',
            productId: summary.product.id,
            productName: summary.product.shortName,
            quantity: Math.abs(diff),
            lotNumber: 'INWENTARYZACJA',
            expiryDate: '-',
            toSlotCode: targetSlot.code,
            performedBy: workstationName,
            notes: `Wyrównanie stanu magazynowego do zestawienia wFirma (${diff > 0 ? `+${diff}` : diff} szt.)`,
          },
          ...state.movementsHistory,
        ],
      },
      `Wyrównano stan produktu ${summary.product.shortName} do wFirma`
    );
  };

  // Eksport pełnego raportu inwentaryzacji i porównania z wFirma do CSV (Excel)
  const handleExportInventoryCsv = () => {
    const headers = [
      'Kod EAN',
      'Indeks PL (wFirma)',
      'Indeks PARTNER (wFirma)',
      'Nazwa Produktu',
      'wFirma PL (szt.)',
      'wFirma PARTNER (szt.)',
      'wFirma LACZNIE (szt.)',
      'Strefa Kompletacji Glowna (szt.)',
      'Gniazdo PARTNER >12 msc (szt.)',
      'Miejsca Paletowe Zapas (szt.)',
      'Fizycznie na Regalach Razem (szt.)',
      'W Zawieszeniu / Konferencje (szt.)',
      'Bilans Kontrolny (Na regalach + W zawieszeniu)',
      'Roznica vs wFirma (szt.)',
      'Sztuki z data >12 msc (dla Partnerow)',
      'Miejsca w magazynie (Regaly i LOT)',
    ];

    const rowsCsv = summaries.map((s) => {
      const locsStr = s.locations
        .map((l) => `${l.slotCode}: ${l.quantity}szt (${l.lotNumber} MHD:${l.expiryDate})`)
        .join(' | ');
      return [
        s.product.baseEan || '',
        s.product.skuRegular,
        s.product.skuPartner || '',
        `"${s.product.name.replace(/"/g, '""')}"`,
        s.product.wfirmaStockRegular,
        s.product.wfirmaStockPartner,
        s.wfirmaTotal,
        s.pickingStandardQty,
        s.pickingPartnerQty,
        s.palletReserveQty,
        s.totalPhysicalOnRacks,
        s.suspendedQty,
        s.totalControlledStock,
        s.inventoryDiff,
        s.eligibleForPartnerQty,
        `"${locsStr.replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rowsCsv].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inwentaryzacja_WMS_vs_wFirma_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    const ean = newProdEan.trim();
    const newItem: ProductCatalogItem = {
      id: `prod-${Date.now()}`,
      baseEan: ean,
      skuRegular: ean || `SKU-${Date.now()}`,
      skuPartner: ean ? `EAN${ean}` : undefined,
      name: newProdName.trim(),
      shortName: newProdShort.trim() || newProdName.trim().slice(0, 28),
      category: newProdCategory,
      unit: 'szt.',
      avgPurchasePriceNet: 50,
      minPickingStock: Number(newProdMinPick) || 30,
      kitHandlingMode: 'separate_slot',
      wfirmaStockRegular: 0,
      wfirmaStockPartner: 0,
      wfirmaLastUpdated: new Date().toISOString().slice(0, 10),
    };

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
        products: [newItem, ...state.products],
      },
      `Dodano nowy produkt do katalogu: ${newItem.shortName}`
    );
    setShowAddProductModal(false);
    setNewProdName('');
    setNewProdShort('');
    setNewProdEan('');
  };

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summaries.filter((s) => {
      if (q) {
        const match =
          s.product.name.toLowerCase().includes(q) ||
          s.product.shortName.toLowerCase().includes(q) ||
          s.product.baseEan.toLowerCase().includes(q) ||
          s.product.skuRegular.toLowerCase().includes(q) ||
          s.locations.some(
            (l) =>
              l.slotCode.toLowerCase().includes(q) || l.lotNumber.toLowerCase().includes(q)
          );
        if (!match) return false;
      }

      if (filterDiff === 'discrepancy') return s.inventoryDiff !== 0;
      if (filterDiff === 'suspended_match') return s.suspendedQty > 0;
      if (filterDiff === 'partner_12m_warn') return s.partnerCoverageDiff < 0;
      return true;
    });
  }, [summaries, searchQuery, filterDiff]);

  const globalMetrics = useMemo(() => {
    let totalWfirma = 0;
    let totalOnRacks = 0;
    let totalSuspended = 0;
    let matchingCount = 0;
    let discrepancyCount = 0;

    for (const s of summaries) {
      totalWfirma += s.wfirmaTotal;
      totalOnRacks += s.totalPhysicalOnRacks;
      totalSuspended += s.suspendedQty;
      if (s.inventoryDiff === 0) matchingCount++;
      else discrepancyCount++;
    }

    return {
      totalWfirma,
      totalOnRacks,
      totalSuspended,
      matchingCount,
      discrepancyCount,
    };
  }, [summaries]);

  return (
    <div className="space-y-6">
      {/* Nagłówek Inwentaryzacji wFirma / Katalogu */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-950 font-extrabold text-xs">
                {mode === 'inventory'
                  ? `Zestawienie stanów wFirma (${state.wfirmaSnapshot?.snapshotDate || '11-10-2026'})`
                  : 'Katalog Produktów, Zestawów i Alokacji'}
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                {mode === 'inventory'
                  ? 'Inwentaryzacja: Porównanie Magazynu Przestrzennego i Towarów w Zawieszeniu ze Stanem wFirma'
                  : 'Podsumowanie Wszystkich Ilości i Konfiguracja Zestawów / Promocji'}
              </h2>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl">
              System automatycznie <strong>sumuje partie cenowe FIFO z wydruku wFirma</strong> oraz łączy indeksy{' '}
              <strong>PL + PL PARTNER</strong> (pokazując ich dokładne rozbicie i sprawdzając, czy liczba sztuk z datą{' '}
              <strong>&gt; 12 miesięcy</strong> pokrywa stan <strong>PARTNER</strong>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadWFirmaInventoryPdf(e.target.files[0]);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => pdfInputRef.current?.click()}
              className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Wgraj PDF „Zestawienie stanów” z wFirma</span>
            </button>

            <button
              type="button"
              onClick={handleExportInventoryCsv}
              className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Eksportuj Raport Inwentaryzacji (CSV / Excel)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddProductModal(true)}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nowy produkt</span>
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
              banner.type === 'ok'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Kafelki podsumowania bilansu */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">
              Stan księgowy wFirma (PL + PARTNER):
            </span>
            <span className="text-xl font-extrabold font-mono text-slate-900">
              {globalMetrics.totalWfirma.toLocaleString('pl-PL')} szt.
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200">
            <span className="text-[11px] font-bold text-teal-900 block">
              Fizycznie na regałach (Kompl. + Palety):
            </span>
            <span className="text-xl font-extrabold font-mono text-teal-950">
              {globalMetrics.totalOnRacks.toLocaleString('pl-PL')} szt.
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-900 block">
              W zawieszeniu (Konferencje bez dok.):
            </span>
            <span className="text-xl font-extrabold font-mono text-amber-950">
              {globalMetrics.totalSuspended.toLocaleString('pl-PL')} szt.
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-900 block">
              Pozycje zgodne co do sztuki:
            </span>
            <span className="text-xl font-extrabold font-mono text-emerald-950">
              {globalMetrics.matchingCount} / {summaries.length}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200">
            <span className="text-[11px] font-bold text-rose-900 block">
              Pozycje z różnicą inwentaryzacyjną:
            </span>
            <span className="text-xl font-extrabold font-mono text-rose-950">
              {globalMetrics.discrepancyCount} poz.
            </span>
          </div>
        </div>

        {/* Wyszukiwarka i filtry */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj produktu po nazwie, kodzie EAN, indeksie wFirma lub numerze regału..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: `Wszystkie pozycje (${summaries.length})` },
              {
                id: 'discrepancy',
                label: `🔴 Tylko różnice vs wFirma (${globalMetrics.discrepancyCount})`,
              },
              { id: 'suspended_match', label: '🎪 Z towarem na konferencji (W zawieszeniu)' },
              { id: 'partner_12m_warn', label: '🟣 Kontrola >12 msc dla PARTNER' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterDiff(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  filterDiff === f.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Główna Tabela Inwentaryzacji i Podsumowania */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                <th className="py-3.5 px-4">Produkt / Kod EAN</th>
                <th className="py-3.5 px-3 text-right bg-slate-800">
                  Stan wFirma
                  <span className="block text-[9px] text-slate-300 font-normal">
                    Łącznie (PL + PARTNER)
                  </span>
                </th>
                <th className="py-3.5 px-3 text-right bg-emerald-950">
                  Strefa Kompletacji
                  <span className="block text-[9px] text-emerald-300 font-normal">
                    Główna + PARTNER &gt;12m
                  </span>
                </th>
                <th className="py-3.5 px-3 text-right bg-blue-950">
                  Miejsca Paletowe
                  <span className="block text-[9px] text-blue-300 font-normal">
                    Zapas na regałach
                  </span>
                </th>
                <th className="py-3.5 px-3 text-right">
                  W Zawieszeniu
                  <span className="block text-[9px] text-amber-300 font-normal">
                    Konferencje (bez dok.)
                  </span>
                </th>
                <th className="py-3.5 px-3 text-center">
                  Bilans vs wFirma
                  <span className="block text-[9px] text-slate-300 font-normal">
                    (Regały + Zawieszone) - wFirma
                  </span>
                </th>
                <th className="py-3.5 px-3">
                  Zasada PARTNER (&gt;12 msc) &amp; Zestawy
                </th>
                <th className="py-3.5 px-4">Gdzie dokładnie leży w magazynie (Miejsca i LOT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSummaries.map((s) => {
                const isExactMatch = s.inventoryDiff === 0;
                const isExplainedBySuspended =
                  s.inventoryDiff === 0 && s.suspendedQty > 0;

                return (
                  <tr key={s.product.id} className="hover:bg-slate-50/90 align-top">
                    {/* Produkt i EAN */}
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{s.product.name}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-[11px] text-slate-500">
                        {s.product.baseEan && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                            EAN: {s.product.baseEan}
                          </span>
                        )}
                        {s.product.skuPartner && (
                          <span className="text-violet-700 font-semibold">
                            + {s.product.skuPartner}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stan wFirma (Łącznie + Rozbicie PL / PARTNER) */}
                    <td className="py-3 px-3 text-right font-mono bg-slate-50/70">
                      <div className="text-sm font-extrabold text-slate-900">
                        {s.wfirmaTotal.toLocaleString('pl-PL')} szt.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        PL: <strong>{s.product.wfirmaStockRegular}</strong> | PARTNER:{' '}
                        <strong className="text-violet-700">{s.product.wfirmaStockPartner}</strong>
                      </div>
                    </td>

                    {/* Strefa Kompletacji */}
                    <td className="py-3 px-3 text-right font-mono bg-emerald-50/30">
                      <div className="text-sm font-extrabold text-emerald-950">
                        {s.totalPickingQty.toLocaleString('pl-PL')} szt.
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        Główna: {s.pickingStandardQty}
                        {s.pickingPartnerQty > 0 && (
                          <span className="text-violet-800 font-bold">
                            {' '}
                            | PARTNER: {s.pickingPartnerQty}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Miejsca Paletowe */}
                    <td className="py-3 px-3 text-right font-mono bg-blue-50/30">
                      <div className="text-sm font-extrabold text-blue-950">
                        {s.palletReserveQty.toLocaleString('pl-PL')} szt.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Razem na półkach: <strong>{s.totalPhysicalOnRacks}</strong>
                      </div>
                    </td>

                    {/* W Zawieszeniu (Konferencje) */}
                    <td className="py-3 px-3 text-right font-mono">
                      {s.suspendedQty > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-xs inline-block">
                          🎪 {s.suspendedQty} szt.
                        </span>
                      ) : (
                        <span className="text-slate-400">0 szt.</span>
                      )}
                    </td>

                    {/* Bilans Inwentaryzacyjny vs wFirma */}
                    <td className="py-3 px-3 text-center">
                      {isExplainedBySuspended ? (
                        <div className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-300 text-amber-950">
                          <span className="font-extrabold text-xs">
                            Zgodny z uwzględnieniem konferencji (0)
                          </span>
                          <span className="text-[10px]">
                            Na półce: {s.totalPhysicalOnRacks} + Konferencja: {s.suspendedQty}
                          </span>
                        </div>
                      ) : isExactMatch ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-extrabold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Zgodny (0)</span>
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-extrabold text-xs ${
                              s.inventoryDiff < 0
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>
                              {s.inventoryDiff > 0
                                ? `Nadwyżka +${s.inventoryDiff} szt.`
                                : `Brak ${s.inventoryDiff} szt.`}
                            </span>
                          </span>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleSyncSingleProductToWFirma(s)}
                              className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                            >
                              Wyrównaj do wFirma
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Zasada PARTNER (>12 msc) oraz konfiguracja Zestawu */}
                    <td className="py-3 px-3 space-y-1.5">
                      {s.product.wfirmaStockPartner > 0 && (
                        <div
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            s.partnerCoverageDiff >= 0
                              ? 'bg-violet-50 text-violet-900 border border-violet-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Partii &gt;12 msc: <strong>{s.eligibleForPartnerQty} szt.</strong> (wFirma PARTNER:{' '}
                            {s.product.wfirmaStockPartner})
                          </span>
                        </div>
                      )}

                      {s.product.category === 'promo_kit' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Tryb zestawu / promocji:
                          </label>
                          <select
                            value={s.product.kitHandlingMode}
                            onChange={(e) =>
                              handleToggleKitMode(
                                s.product.id,
                                e.target.value as KitHandlingMode
                              )
                            }
                            className="w-full px-2 py-1 text-[11px] font-bold bg-amber-50 border border-amber-300 rounded-lg text-amber-950"
                          >
                            <option value="separate_slot">
                              📦 Osobna pozycja na półce
                            </option>
                            <option value="virtual_bundle">
                              🔗 Zestaw wirtualny (rozbijaj na składowe)
                            </option>
                          </select>
                        </div>
                      )}
                    </td>

                    {/* Dokładne miejsca w magazynie */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {s.locations.map((loc) => (
                          <span
                            key={`${loc.slotId}-${loc.batchId}`}
                            className={`px-2 py-1 rounded-lg border font-mono text-[10px] ${
                              loc.slotType === 'picking_partner_12m'
                                ? 'bg-violet-50 border-violet-300 text-violet-950'
                                : loc.slotType === 'picking_standard'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <strong>{loc.slotCode}</strong>: {loc.quantity} szt. (LOT:{' '}
                            {loc.lotNumber}, MHD: {loc.expiryDate.slice(0, 7)})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DODAWANIA NOWEGO PRODUKTU */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddProduct}
            className="bg-white rounded-3xl max-w-md w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Dodaj nowy produkt do katalogu WMS
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pełna nazwa produktu (jak w wFirma):
              </label>
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="np. OMNi-BiOTiC® Nowy Produkt - 30 sasz. PL"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Krótka nazwa na kafelkach regałów:
              </label>
              <input
                type="text"
                value={newProdShort}
                onChange={(e) => setNewProdShort(e.target.value)}
                placeholder="np. Nowy Produkt (30 sasz.)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kod EAN (13 cyfr):
                </label>
                <input
                  type="text"
                  value={newProdEan}
                  onChange={(e) => setNewProdEan(e.target.value)}
                  placeholder="91201179..."
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategoria:</label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                >
                  <option value="probiotic">OMNi-BiOTiC (Probiotyk)</option>
                  <option value="prebiotic">OMNi-LOGiC (Prebiotyk)</option>
                  <option value="mikrosan">MikroSan</option>
                  <option value="promo_kit">Zestaw / Promocja</option>
                  <option value="sample">Próbka z ulotką</option>
                  <option value="accessory">Akcesoria / Torby</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
              >
                Dodaj produkt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
