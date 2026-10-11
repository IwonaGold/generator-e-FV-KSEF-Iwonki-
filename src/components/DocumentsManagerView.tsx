import React, { useState, useRef, useMemo } from 'react';
import {
  WMSFullState,
  WarehouseDocType,
  WarehouseDocument,
  WarehouseDocumentItem,
  AllocatedMovementRecord,
} from '../types/wms';
import { extractPdfTextViaServer } from '../utils/wmsSyncService';
import { parseWFirmaDocumentsText, isEligibleForPartner12Months } from '../utils/wfirmaParser';
import { executeWarehouseDocument, computeAllProductsSummary } from '../utils/wmsEngine';
import {
  FileText,
  Upload,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  PackagePlus,
  PackageMinus,
  Layers,
  Loader2,
  X,
  Check,
} from 'lucide-react';

interface DocumentsManagerViewProps {
  state: WMSFullState;
  workstationName: string;
  onUpdateState: (nextState: WMSFullState, summary: string) => void;
}

export const DocumentsManagerView: React.FC<DocumentsManagerViewProps> = ({
  state,
  workstationName,
  onUpdateState,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [filterDocType, setFilterDocType] = useState<'ALL' | WarehouseDocType>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'draft' | 'applied'>('ALL');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Ręczny kreator dokumentu WZ / RW / PZ / PW
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualType, setManualType] = useState<WarehouseDocType>('WZ');
  const [manualNumber, setManualNumber] = useState('WZ 907/10/2026');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualCounterparty, setManualCounterparty] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualItems, setManualItems] = useState<
    { productId: string; quantity: number; isPartnerChannel: boolean }[]
  >([{ productId: state.products[0]?.id || '', quantity: 5, isPartnerChannel: false }]);

  // Alokacja palet dla dokumentów PZ / PW przed zatwierdzeniem: { [docItemId]: AllocatedMovementRecord[] }
  const [customAllocations, setCustomAllocations] = useState<
    Record<string, AllocatedMovementRecord[]>
  >({});

  const productMap = useMemo(
    () => new Map(state.products.map((p) => [p.id, p])),
    [state.products]
  );

  const summariesMap = useMemo(() => {
    const all = computeAllProductsSummary(state);
    return new Map(all.map((s) => [s.product.id, s]));
  }, [state]);

  const handleUploadPdfFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    setIsParsingPdf(true);
    setFeedbackBanner(null);

    try {
      const newlyParsedDocs: WarehouseDocument[] = [];
      for (const file of fileArr) {
        const text = await extractPdfTextViaServer(file);
        const parsedDocs = parseWFirmaDocumentsText(text, state.products);
        newlyParsedDocs.push(...parsedDocs);
      }

      if (newlyParsedDocs.length === 0) {
        setFeedbackBanner({
          type: 'error',
          message:
            'Nie wykryto w pliku PDF nagłówków dokumentów WZ / RW / PZ / PW z systemu wFirma. Możesz też dodać dokument ręcznie przyciskiem obok.',
        });
      } else {
        const nowIso = new Date().toISOString();
        const nextState: WMSFullState = {
          ...state,
          revision: state.revision + 1,
          updatedAt: nowIso,
          documents: [...newlyParsedDocs, ...state.documents],
        };
        onUpdateState(
          nextState,
          `Wgrano ${newlyParsedDocs.length} dokument(ów) z PDF (${newlyParsedDocs.map((d) => d.docNumber).join(', ')})`
        );
        setFeedbackBanner({
          type: 'success',
          message: `Pomyślnie odczytano z PDF ${newlyParsedDocs.length} dokument(ów): ${newlyParsedDocs
            .map((d) => `${d.docNumber} (${d.items.length} poz.)`)
            .join(', ')}. Sprawdź je poniżej i kliknij „Zatwierdź”.`,
        });
      }
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err?.message || 'Wystąpił błąd podczas wczytywania pliku PDF.',
      });
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Inicjalizacja lub pobranie wierszy alokacji palet dla pozycji PZ / PW
  const getOrInitItemAllocations = (
    doc: WarehouseDocument,
    item: WarehouseDocumentItem
  ): AllocatedMovementRecord[] => {
    if (customAllocations[item.id] && customAllocations[item.id].length > 0) {
      return customAllocations[item.id];
    }

    // Domyślne miejsce docelowe:
    // - Dla PW: gniazdo Strefy Kompletacji, na którym leży ten produkt (lub pierwsze gniazdo kompletacji)
    // - Dla PZ: miejsce paletowe (lub gniazdo PARTNER >12m jeśli użytkownik woli)
    const defaultSlot =
      state.slots.find((s) =>
        doc.docType === 'PW'
          ? s.slotType === 'picking_standard' &&
            s.allocations.some((a) => a.productId === item.matchedProductId)
          : s.slotType === 'pallet_storage' &&
            s.allocations.some((a) => a.productId === item.matchedProductId)
      ) ||
      state.slots.find((s) =>
        doc.docType === 'PW' ? s.slotType === 'picking_standard' : s.slotType === 'pallet_storage'
      ) ||
      state.slots[0];

    return [
      {
        slotId: defaultSlot?.id || '',
        slotCode: defaultSlot?.code || '',
        lotNumber: `DOST-${doc.issueDate.replace(/-/g, '')}`,
        expiryDate: '2028-09-30',
        quantity: item.quantity,
        palletLabel: doc.docType === 'PZ' ? 'Paleta #1' : 'Zwrot / PW na Kompletację',
      },
    ];
  };

  const handleUpdateCustomAllocRow = (
    doc: WarehouseDocument,
    item: WarehouseDocumentItem,
    rowIdx: number,
    patch: Partial<AllocatedMovementRecord>
  ) => {
    const current = getOrInitItemAllocations(doc, item).map((r) => ({ ...r }));
    if (!current[rowIdx]) return;
    current[rowIdx] = { ...current[rowIdx], ...patch };
    if (patch.slotId) {
      const slot = state.slots.find((s) => s.id === patch.slotId);
      if (slot) current[rowIdx].slotCode = slot.code;
    }
    setCustomAllocations((prev) => ({ ...prev, [item.id]: current }));
  };

  const handleSplitIntoAnotherPallet = (doc: WarehouseDocument, item: WarehouseDocumentItem) => {
    const current = getOrInitItemAllocations(doc, item).map((r) => ({ ...r }));
    const palletSlots = state.slots.filter((s) => s.slotType === 'pallet_storage');
    const nextSlot = palletSlots[current.length % Math.max(1, palletSlots.length)] || state.slots[0];

    const lastRow = current[current.length - 1];
    const half = Math.max(1, Math.floor((lastRow?.quantity || item.quantity) / 2));
    if (lastRow && lastRow.quantity > half) {
      lastRow.quantity -= half;
    }

    current.push({
      slotId: nextSlot?.id || '',
      slotCode: nextSlot?.code || '',
      lotNumber: lastRow?.lotNumber || `DOST-${doc.issueDate.replace(/-/g, '')}`,
      expiryDate: lastRow?.expiryDate || '2028-09-30',
      quantity: half,
      palletLabel: `Paleta #${current.length + 1}`,
    });

    setCustomAllocations((prev) => ({ ...prev, [item.id]: current }));
  };

  const handleRemovePalletSplitRow = (
    doc: WarehouseDocument,
    item: WarehouseDocumentItem,
    rowIdx: number
  ) => {
    const current = getOrInitItemAllocations(doc, item).map((r) => ({ ...r }));
    if (current.length <= 1) return;
    const removedQty = current[rowIdx].quantity;
    current.splice(rowIdx, 1);
    current[0].quantity += removedQty;
    setCustomAllocations((prev) => ({ ...prev, [item.id]: current }));
  };

  // Zatwierdzenie pojedynczego dokumentu
  const handleApplyDocument = (doc: WarehouseDocument) => {
    const allocMapForDoc: Record<string, AllocatedMovementRecord[]> = {};
    if (doc.docType === 'PZ' || doc.docType === 'PW') {
      for (const it of doc.items) {
        allocMapForDoc[it.id] = getOrInitItemAllocations(doc, it);
      }
    }

    const res = executeWarehouseDocument(state, doc.id, workstationName, allocMapForDoc);
    if (res.error) {
      setFeedbackBanner({ type: 'error', message: res.error });
      return;
    }

    onUpdateState(
      res.nextState,
      `Zrealizowano dokument ${doc.docNumber} (${
        doc.docType === 'WZ' || doc.docType === 'RW'
          ? 'ściągnięto ze Strefy Kompletacji'
          : 'dodano na magazyn'
      })`
    );

    if (res.warnings.length > 0) {
      setFeedbackBanner({
        type: 'warning',
        message: `Zrealizowano ${doc.docNumber}. ${res.warnings.join(' ')}`,
      });
    } else {
      setFeedbackBanner({
        type: 'success',
        message: `Dokument ${doc.docNumber} został pomyślnie zrealizowany, a stany magazynowe zaktualizowane!`,
      });
    }
  };

  // Zbiorcze zatwierdzenie wszystkich oczekujących WZ i RW
  const handleApplyAllPendingOutbound = () => {
    const pendingOutbound = state.documents.filter(
      (d) => d.status === 'draft' && (d.docType === 'WZ' || d.docType === 'RW')
    );
    if (pendingOutbound.length === 0) return;

    let workingState = state;
    const appliedNumbers: string[] = [];
    const allWarnings: string[] = [];

    for (const doc of pendingOutbound) {
      const res = executeWarehouseDocument(workingState, doc.id, workstationName);
      if (res.error) {
        setFeedbackBanner({
          type: 'error',
          message: `Zatrzymano na dokumencie ${doc.docNumber}: ${res.error}`,
        });
        if (appliedNumbers.length > 0) {
          onUpdateState(
            workingState,
            `Zatwierdzono zbiorczo: ${appliedNumbers.join(', ')}`
          );
        }
        return;
      }
      workingState = res.nextState;
      appliedNumbers.push(doc.docNumber);
      allWarnings.push(...res.warnings);
    }

    onUpdateState(
      workingState,
      `Zrealizowano zbiorczo ${appliedNumbers.length} dokumentów rozchodowych (${appliedNumbers.join(', ')})`
    );
    setFeedbackBanner({
      type: allWarnings.length > 0 ? 'warning' : 'success',
      message: `Zrealizowano zbiorczo ${appliedNumbers.length} dokument(ów) WZ/RW ze Strefy Kompletacji! ${allWarnings.join(' ')}`,
    });
  };

  // Zmiana dopasowanego produktu na pozycji dokumentu
  const handleChangeMatchedProduct = (docId: string, itemId: string, productId: string) => {
    const prod = productMap.get(productId);
    const nextDocs = state.documents.map((d) => {
      if (d.id !== docId) return d;
      return {
        ...d,
        items: d.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                matchedProductId: productId,
                rawName: it.rawName || prod?.name || '',
              }
            : it
        ),
      };
    });
    onUpdateState(
      { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), documents: nextDocs },
      'Zmieniono dopasowanie produktu na dokumencie'
    );
  };

  // Przełączenie flagi PARTNER (>12 msc) na pozycji dokumentu
  const handleTogglePartnerFlag = (docId: string, itemId: string) => {
    const nextDocs = state.documents.map((d) => {
      if (d.id !== docId) return d;
      return {
        ...d,
        items: d.items.map((it) =>
          it.id === itemId ? { ...it, isPartnerChannel: !it.isPartnerChannel } : it
        ),
      };
    });
    onUpdateState(
      { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), documents: nextDocs },
      'Przełączono tryb PARTNER (>12 msc) na pozycji dokumentu'
    );
  };

  const handleDeleteDocument = (doc: WarehouseDocument) => {
    if (!window.confirm(`Czy na pewno usunąć dokument ${doc.docNumber} z listy?`)) return;
    const nextDocs = state.documents.filter((d) => d.id !== doc.id);
    onUpdateState(
      { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), documents: nextDocs },
      `Usunięto dokument ${doc.docNumber}`
    );
  };

  // Utworzenie ręcznego dokumentu WZ / RW / PZ / PW
  const handleCreateManualDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = manualItems.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) return;

    const newDoc: WarehouseDocument = {
      id: `doc-manual-${Date.now()}`,
      docType: manualType,
      docNumber: manualNumber.trim() || `${manualType} ${new Date().toLocaleDateString('pl-PL')}`,
      issueDate: manualDate,
      warehouseName: 'Główny Magazyn',
      counterparty: manualCounterparty.trim() || 'Eubiosis sp. z o.o.',
      notes: manualNotes.trim(),
      status: 'draft',
      createdAt: new Date().toISOString(),
      items: validItems.map((it, idx) => {
        const prod = productMap.get(it.productId);
        return {
          id: `manual-item-${Date.now()}-${idx}`,
          lp: idx + 1,
          rawSku: it.isPartnerChannel
            ? prod?.skuPartner || prod?.skuRegular || ''
            : prod?.skuRegular || '',
          rawName: prod ? `${prod.name}${it.isPartnerChannel ? ' PARTNER' : ''}` : '',
          matchedProductId: it.productId,
          isPartnerChannel: it.isPartnerChannel,
          quantity: it.quantity,
          unit: 'szt.',
          unitPrice: prod?.avgPurchasePriceNet || 0,
          totalValue: Math.round((prod?.avgPurchasePriceNet || 0) * it.quantity * 100) / 100,
          allocatedMovements: [],
        };
      }),
    };

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
        documents: [newDoc, ...state.documents],
      },
      `Dodano ręcznie dokument ${newDoc.docNumber}`
    );
    setShowManualModal(false);
  };

  const filteredDocuments = useMemo(() => {
    return state.documents.filter((d) => {
      if (filterDocType !== 'ALL' && d.docType !== filterDocType) return false;
      if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
      return true;
    });
  }, [state.documents, filterDocType, filterStatus]);

  const pendingOutboundCount = useMemo(
    () =>
      state.documents.filter(
        (d) => d.status === 'draft' && (d.docType === 'WZ' || d.docType === 'RW')
      ).length,
    [state.documents]
  );

  return (
    <div className="space-y-6">
      {/* Górny panel wgrywania PDF z wFirma + Ręcznego dodawania */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 font-extrabold text-xs">
                wFirma.pl PDF + Ręcznie
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                Dokumenty Magazynowe: WZ, RW, PZ, PW
              </h2>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl">
              Wgraj pojedyncze lub zbiorcze pliki PDF z systemu <strong>wFirma</strong> (z dnia lub całego tygodnia):
              <strong> WZ i RW</strong> automatycznie ściągną ilości ze <strong>Strefy Kompletacji</strong> (z kontrolą daty &gt; 12 msc dla Partnerów!),
              <strong> PW</strong> doda ilości na Strefę Kompletacji, a <strong>PZ (Dostawy)</strong> pozwoli Ci przypisać każdą paletę na konkretne miejsce paletowe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadPdfFiles(e.target.files);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              disabled={isParsingPdf}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-teal-600 text-white hover:bg-teal-700 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              {isParsingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Wgraj PDF z wFirma (WZ / RW / PZ / PW)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Wpisz dokument ręcznie</span>
            </button>

            {pendingOutboundCount > 0 && (
              <button
                type="button"
                onClick={handleApplyAllPendingOutbound}
                className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Ściągnij wszystkie oczekujące WZ/RW ({pendingOutboundCount}) ze Strefy Kompletacji
                </span>
              </button>
            )}
          </div>
        </div>

        {feedbackBanner && (
          <div
            className={`mt-4 p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : feedbackBanner.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <span>{feedbackBanner.message}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filtry typów dokumentów */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: `Wszystkie (${state.documents.length})` },
              { id: 'WZ', label: '📤 WZ — Wydania Zewnętrzne (Ze Strefy Kompletacji)' },
              { id: 'RW', label: '📤 RW — Rozchody Wewnętrzne (Ze Strefy Kompletacji)' },
              { id: 'PZ', label: '📥 PZ — Dostawy Zewnętrzne (Alokacja Palet)' },
              { id: 'PW', label: '📥 PW — Przyjęcia Wewnętrzne (Na Strefę Kompletacji)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterDocType(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterDocType === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'Wszystkie statusy' },
              { id: 'draft', label: '⏳ Oczekujące do zatwierdzenia' },
              { id: 'applied', label: '✅ Zrealizowane w magazynie' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterStatus(st.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista dokumentów */}
      <div className="space-y-4">
        {filteredDocuments.map((doc) => {
          const isOutbound = doc.docType === 'WZ' || doc.docType === 'RW';
          const isApplied = doc.status === 'applied';

          return (
            <div
              key={doc.id}
              className={`bg-white rounded-3xl border-2 p-5 shadow-xs transition-all ${
                isApplied
                  ? 'border-emerald-300 bg-emerald-50/15'
                  : isOutbound
                  ? 'border-rose-200'
                  : 'border-blue-200'
              }`}
            >
              {/* Nagłówek Dokumentu */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-3 py-1.5 rounded-xl font-mono text-sm font-extrabold flex items-center gap-1.5 ${
                      doc.docType === 'WZ'
                        ? 'bg-rose-600 text-white'
                        : doc.docType === 'RW'
                        ? 'bg-amber-600 text-white'
                        : doc.docType === 'PZ'
                        ? 'bg-blue-600 text-white'
                        : 'bg-teal-600 text-white'
                    }`}
                  >
                    {isOutbound ? (
                      <PackageMinus className="w-4 h-4" />
                    ) : (
                      <PackagePlus className="w-4 h-4" />
                    )}
                    <span>{doc.docNumber}</span>
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        {doc.counterparty}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        Data: {doc.issueDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {doc.docType === 'WZ' &&
                        'Wydanie Zewnętrzne — ściąga ilości ze Strefy Kompletacji'}
                      {doc.docType === 'RW' &&
                        'Rozchód Wewnętrzny — ściąga ilości ze Strefy Kompletacji'}
                      {doc.docType === 'PZ' &&
                        'Przyjęcie Zewnętrzne (Dostawa) — przypisz palety do konkretnych miejsc paletowych'}
                      {doc.docType === 'PW' &&
                        'Przyjęcie Wewnętrzne — dodaje towar na Strefę Kompletacji'}
                      {doc.notes ? ` • Uwagi: ${doc.notes}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isApplied ? (
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Zrealizowano w magazynie ({doc.appliedBy})</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyDocument(doc)}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer flex items-center gap-1.5 shadow-xs ${
                        isOutbound
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isOutbound
                          ? `Zatwierdź ${doc.docType} (Ściągnij ze Strefy Kompletacji)`
                          : doc.docType === 'PZ'
                          ? 'Zatwierdź PZ (Alokuj palety na magazynie)'
                          : 'Zatwierdź PW (Dodaj na Strefę Kompletacji)'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(doc)}
                    className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                    title="Usuń dokument z listy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabela pozycji dokumentu */}
              <div className="mt-4 space-y-3">
                {doc.items.map((item) => {
                  const matchedProd = item.matchedProductId
                    ? productMap.get(item.matchedProductId)
                    : null;
                  const summary = item.matchedProductId
                    ? summariesMap.get(item.matchedProductId)
                    : null;

                  const itemAllocs =
                    !isApplied && (doc.docType === 'PZ' || doc.docType === 'PW')
                      ? getOrInitItemAllocations(doc, item)
                      : item.allocatedMovements || [];

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[260px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-xs font-bold">
                              Poz. {item.lp}
                            </span>
                            {item.rawSku && (
                              <span className="font-mono text-xs font-bold text-slate-600">
                                {item.rawSku}
                              </span>
                            )}
                            <span className="text-sm font-extrabold text-slate-900">
                              {item.rawName}
                            </span>
                            {!isApplied && (
                              <button
                                type="button"
                                onClick={() => handleTogglePartnerFlag(doc.id, item.id)}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold cursor-pointer flex items-center gap-1 border ${
                                  item.isPartnerChannel
                                    ? 'bg-violet-100 text-violet-950 border-violet-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-violet-50'
                                }`}
                                title="Kliknij, aby przełączyć wymóg daty ważności > 12 miesięcy (PARTNER)"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>
                                  {item.isPartnerChannel
                                    ? 'PARTNER (Wymóg MHD > 12 msc)'
                                    : 'Standard PL (Dowolna ważna seria)'}
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Dopasowanie do katalogu produktów */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-600">
                              Dopasowany produkt w magazynie:
                            </span>
                            <select
                              disabled={isApplied}
                              value={item.matchedProductId || ''}
                              onChange={(e) =>
                                handleChangeMatchedProduct(doc.id, item.id, e.target.value)
                              }
                              className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-slate-900"
                            >
                              <option value="">-- Wybierz produkt z katalogu --</option>
                              {state.products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.shortName} ({p.baseEan || p.skuRegular})
                                </option>
                              ))}
                            </select>

                            {summary && !isApplied && isOutbound && (
                              <span className="text-[11px] text-slate-600">
                                Na Kompletacji:{' '}
                                <strong className="text-emerald-800 font-mono">
                                  {summary.pickingStandardQty} szt.
                                </strong>
                                {summary.pickingPartnerQty > 0 && (
                                  <>
                                    {' '}
                                    | Gniazdo PARTNER (&gt;12m):{' '}
                                    <strong className="text-violet-800 font-mono">
                                      {summary.pickingPartnerQty} szt.
                                    </strong>
                                  </>
                                )}
                                {' '}
                                | Na Paletach:{' '}
                                <strong className="text-blue-800 font-mono">
                                  {summary.palletReserveQty} szt.
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-slate-500 block">Ilość z dokumentu:</span>
                            <span className="text-lg font-extrabold font-mono text-slate-900">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Jeśli to PZ (Dostawa) lub PW przed zatwierdzeniem: Pokaż alokację palet i miejsc docelowych! */}
                      {!isApplied && (doc.docType === 'PZ' || doc.docType === 'PW') && (
                        <div className="pt-3 border-t border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-blue-600" />
                              <span>
                                {doc.docType === 'PZ'
                                  ? 'Alokacja dostawy PZ na miejsca paletowe / Strefę Kompletacji:'
                                  : 'Miejsce docelowe przyjęcia PW (domyślnie Strefa Kompletacji):'}
                              </span>
                            </span>
                            {doc.docType === 'PZ' && (
                              <button
                                type="button"
                                onClick={() => handleSplitIntoAnotherPallet(doc, item)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-900 hover:bg-blue-200 cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Rozbij dostawę na kolejną paletę</span>
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {itemAllocs.map((allocRow, rIdx) => (
                              <div
                                key={rIdx}
                                className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-white p-2.5 rounded-xl border border-blue-200 items-end"
                              >
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Miejsce docelowe w magazynie:
                                  </label>
                                  <select
                                    value={allocRow.slotId}
                                    onChange={(e) =>
                                      handleUpdateCustomAllocRow(doc, item, rIdx, {
                                        slotId: e.target.value,
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg"
                                  >
                                    {state.slots.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.code} — {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Ilość na tej palecie:
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={allocRow.quantity}
                                    onChange={(e) =>
                                      handleUpdateCustomAllocRow(doc, item, rIdx, {
                                        quantity: Number(e.target.value),
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Seria LOT:
                                  </label>
                                  <input
                                    type="text"
                                    value={allocRow.lotNumber}
                                    onChange={(e) =>
                                      handleUpdateCustomAllocRow(doc, item, rIdx, {
                                        lotNumber: e.target.value,
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div className="flex items-end gap-1.5">
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                      Data ważności MHD:
                                    </label>
                                    <input
                                      type="date"
                                      value={allocRow.expiryDate}
                                      onChange={(e) =>
                                        handleUpdateCustomAllocRow(doc, item, rIdx, {
                                          expiryDate: e.target.value,
                                        })
                                      }
                                      className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                                    />
                                  </div>
                                  {itemAllocs.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePalletSplitRow(doc, item, rIdx)}
                                      className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                                      title="Usuń ten podział palety"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Podsumowanie wykonanego ruchu po zatwierdzeniu dokumentu */}
                      {isApplied && item.allocatedMovements.length > 0 && (
                        <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-emerald-900">
                            {isOutbound ? 'Pobrano z miejsc:' : 'Zaalokowano na miejscach:'}
                          </span>
                          {item.allocatedMovements.map((mv, mIdx) => (
                            <span
                              key={mIdx}
                              className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-mono text-xs text-slate-800"
                            >
                              <strong>{mv.slotCode}</strong>: {mv.quantity} szt. (LOT: {mv.lotNumber}, MHD:{' '}
                              {mv.expiryDate})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL RĘCZNEGO DODAWANIA DOKUMENTU WZ / RW / PZ / PW */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateManualDocument}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Wprowadź ręcznie dokument WZ / RW / PZ / PW
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Typ dokumentu:</label>
                <select
                  value={manualType}
                  onChange={(e) => {
                    const t = e.target.value as WarehouseDocType;
                    setManualType(t);
                    setManualNumber(`${t} ${Math.floor(Math.random() * 90 + 10)}/10/2026`);
                  }}
                  className="w-full px-3 py-2 text-xs font-extrabold border border-slate-300 rounded-xl"
                >
                  <option value="WZ">📤 WZ (Wydanie Zewnętrzne ze Strefy Kompletacji)</option>
                  <option value="RW">📤 RW (Rozchód Wewnętrzny ze Strefy Kompletacji)</option>
                  <option value="PZ">📥 PZ (Dostawa Zewnętrzna — Alokacja Palet)</option>
                  <option value="PW">📥 PW (Przyjęcie Wewnętrzne na Strefę Kompletacji)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Numer dokumentu:</label>
                <input
                  type="text"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data wystawienia:</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kontrahent (Nabywca / Dostawca):
                </label>
                <input
                  type="text"
                  value={manualCounterparty}
                  onChange={(e) => setManualCounterparty(e.target.value)}
                  placeholder="np. GlobalMed / Eubiosis sp. z o.o."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Uwagi:</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Opcjonalne uwagi do dokumentu"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">Pozycje na dokumencie:</label>
                <button
                  type="button"
                  onClick={() =>
                    setManualItems([
                      ...manualItems,
                      {
                        productId: state.products[0]?.id || '',
                        quantity: 1,
                        isPartnerChannel: false,
                      },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-900 border border-teal-300 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dodaj kolejną pozycję</span>
                </button>
              </div>

              {manualItems.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                >
                  <div className="sm:col-span-6">
                    <select
                      value={it.productId}
                      onChange={(e) => {
                        const next = [...manualItems];
                        next[idx].productId = e.target.value;
                        setManualItems(next);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                    >
                      {state.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.shortName} ({p.baseEan || p.skuRegular})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => {
                        const next = [...manualItems];
                        next[idx].quantity = Number(e.target.value);
                        setManualItems(next);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                      placeholder="Ilość"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-violet-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={it.isPartnerChannel}
                        onChange={(e) => {
                          const next = [...manualItems];
                          next[idx].isPartnerChannel = e.target.checked;
                          setManualItems(next);
                        }}
                        className="rounded text-violet-600"
                      />
                      <span>PARTNER (&gt;12 msc)</span>
                    </label>
                  </div>
                  <div className="sm:col-span-1 text-right">
                    {manualItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setManualItems(manualItems.filter((_, i) => i !== idx))
                        }
                        className="text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
              >
                Dodaj dokument do realizacji
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
