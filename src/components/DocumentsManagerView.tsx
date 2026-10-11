import React, { useState, useRef, useMemo } from 'react';
import {
  WMSFullState,
  WarehouseDocType,
  WarehouseDocument,
  WarehouseDocumentItem,
  AllocatedMovementRecord,
} from '../types/wms';
import { extractPdfTextViaServer } from '../utils/wmsSyncService';
import {
  parseWFirmaDocumentsText,
  parseUniversalDeliveryOrInvoiceText,
  isEligibleForPartner12Months,
} from '../utils/wfirmaParser';
import {
  executeWarehouseDocument,
  computeAllProductsSummary,
  getDefaultUnitsPerCarton,
  getPutAwayRecommendationsForItem,
  buildSmartDeliveryAllocationsForDoc,
} from '../utils/wmsEngine';
import {
  Upload,
  Plus,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  PackagePlus,
  PackageMinus,
  Layers,
  Loader2,
  X,
  Check,
  Sparkles,
  MapPin,
  Box,
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
  const deliveryPlannerInputRef = useRef<HTMLInputElement | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [filterDocType, setFilterDocType] = useState<'ALL' | WarehouseDocType>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'draft' | 'applied'>('ALL');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Panel wklejania tekstu Faktury / WZ do planowania dostawy
  const [showPasteInvoiceBox, setShowPasteInvoiceBox] = useState(false);
  const [pastedInvoiceText, setPastedInvoiceText] = useState('');

  // Ręczny kreator dokumentu WZ / RW / PZ / PW
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualType, setManualType] = useState<WarehouseDocType>('PZ');
  const [manualNumber, setManualNumber] = useState('FV/DOSTAWA 10/2026');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualCounterparty, setManualCounterparty] = useState('Institut AllergoSan');
  const [manualNotes, setManualNotes] = useState('');
  const [manualItems, setManualItems] = useState<
    { productId: string; quantity: number; isPartnerChannel: boolean }[]
  >([{ productId: state.products[0]?.id || '', quantity: 144, isPartnerChannel: false }]);

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

  // Automatyczny plan rozmieszczenia dla każdego oczekującego dokumentu PZ / PW
  const autoSmartPlansByDocId = useMemo(() => {
    const map = new Map<string, Record<string, AllocatedMovementRecord[]>>();
    for (const doc of state.documents) {
      if (doc.status === 'draft' && (doc.docType === 'PZ' || doc.docType === 'PW')) {
        map.set(doc.id, buildSmartDeliveryAllocationsForDoc(state, doc));
      }
    }
    return map;
  }, [state]);

  // Wgrywanie Faktury / WZ / PZ w trybie Planowania Przyjęcia Dostawy (zawsze tworzy plan rozmieszczenia na regałach)
  const handleUploadDeliveryPlanFiles = async (
    files: FileList | File[],
    forceAsDeliveryPlan: boolean = true
  ) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    setIsParsingPdf(true);
    setFeedbackBanner(null);

    try {
      const newlyParsedDocs: WarehouseDocument[] = [];
      for (const file of fileArr) {
        const text = await extractPdfTextViaServer(file);
        const parsedDocs = forceAsDeliveryPlan
          ? parseUniversalDeliveryOrInvoiceText(text, state.products, true)
          : parseWFirmaDocumentsText(text, state.products).length > 0
          ? parseWFirmaDocumentsText(text, state.products)
          : parseUniversalDeliveryOrInvoiceText(text, state.products, false);
        newlyParsedDocs.push(...parsedDocs);
      }

      if (newlyParsedDocs.length === 0) {
        setFeedbackBanner({
          type: 'error',
          message:
            'Nie wykryto w pliku PDF pozycji z katalogu produktów. Możesz wkleić tekst z faktury/WZ lub wybrać produkty ręcznie przyciskiem obok.',
        });
      } else {
        // Wygeneruj od razu rekomendacje miejsc dla nowo wgranych dokumentów dostawy
        const newSmartAllocs: Record<string, AllocatedMovementRecord[]> = {};
        for (const doc of newlyParsedDocs) {
          if (doc.docType === 'PZ' || doc.docType === 'PW') {
            const plan = buildSmartDeliveryAllocationsForDoc(state, doc);
            Object.assign(newSmartAllocs, plan);
          }
        }
        setCustomAllocations((prev) => ({ ...prev, ...newSmartAllocs }));

        const nowIso = new Date().toISOString();
        const nextState: WMSFullState = {
          ...state,
          revision: state.revision + 1,
          updatedAt: nowIso,
          documents: [...newlyParsedDocs, ...state.documents],
        };
        onUpdateState(
          nextState,
          `Zaplanowano przyjęcie dostawy z PDF (${newlyParsedDocs.map((d) => d.docNumber).join(', ')})`
        );
        setFeedbackBanner({
          type: 'success',
          message: `✨ Odczytano ${newlyParsedDocs.length} dokument(ów): ${newlyParsedDocs
            .map((d) => `${d.docNumber} (${d.items.length} poz.)`)
            .join(', ')} i przygotowano podpowiedź, gdzie najlepiej umieścić każdą paletę w Magazynie 4, 5 i 6!`,
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

  // Analiza wklejonego tekstu z Faktury / WZ / Excela
  const handleParsePastedInvoice = () => {
    if (!pastedInvoiceText.trim()) return;
    const docs = parseUniversalDeliveryOrInvoiceText(pastedInvoiceText, state.products, true);
    if (docs.length === 0) {
      setFeedbackBanner({
        type: 'error',
        message:
          'Nie rozpoznano nazw produktów ani kodów EAN we wklejonym tekście. Upewnij się, że w linii znajduje się nazwa produktu (np. Stress Repair 28, PANDA, 10 AAD 20) oraz ilość.',
      });
      return;
    }

    const newSmartAllocs: Record<string, AllocatedMovementRecord[]> = {};
    for (const doc of docs) {
      Object.assign(newSmartAllocs, buildSmartDeliveryAllocationsForDoc(state, doc));
    }
    setCustomAllocations((prev) => ({ ...prev, ...newSmartAllocs }));

    const nowIso = new Date().toISOString();
    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        documents: [...docs, ...state.documents],
      },
      `Zaplanowano dostawę ze wklejonej Faktury/WZ (${docs[0].items.length} pozycji)`
    );
    setPastedInvoiceText('');
    setShowPasteInvoiceBox(false);
    setFeedbackBanner({
      type: 'success',
      message: `✨ Przeanalizowano wklejoną Fakturę/WZ (${docs[0].items.length} pozycji) i wyznaczono najlepsze miejsca w Magazynie 4, 5 i 6!`,
    });
  };

  // Symulacja przykładowej Faktury Dostawy do szybkiego przetestowania podpowiedzi
  const handleLoadSampleDeliveryPlan = () => {
    const sampleText = [
      'Faktura DostawyFV 2026/10/ALLERGOSAN',
      'Data wystawienia: 2026-10-12',
      'Dostawca',
      'Institut AllergoSan Pharmazeutische Produkte',
      'EANPL9120117912766 OMNi-BiOTiC Stress Repair 28 sasz. 432 szt.',
      'EANPL9120117912711 OMNi-BiOTiC 10 AAD 20 sasz. 576 szt.',
      'EANPL9120117912735 OMNi-BiOTiC PANDA 30 sasz. 360 szt.',
      'EAN9120117912698 OMNi-BiOTiC 6 60g proszek PARTNER 144 szt.',
      'EANPL9120117912902 OMNi-LOGiC Jabłko 450g 96 szt.',
    ].join('\n');

    const docs = parseUniversalDeliveryOrInvoiceText(sampleText, state.products, true);
    if (docs.length === 0) return;

    const newSmartAllocs: Record<string, AllocatedMovementRecord[]> = {};
    for (const doc of docs) {
      Object.assign(newSmartAllocs, buildSmartDeliveryAllocationsForDoc(state, doc));
    }
    setCustomAllocations((prev) => ({ ...prev, ...newSmartAllocs }));

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
        documents: [...docs, ...state.documents],
      },
      `Utworzono przykładowy plan przyjęcia dostawy (${docs[0].docNumber})`
    );
    setFeedbackBanner({
      type: 'success',
      message:
        '✨ Załadowano przykładową Fakturę Dostawy (5 pozycji) wraz z podpowiedziami najlepszych miejsc na regałach w Magazynie 4, 5 i 6! Sprawdź rekomendacje poniżej.',
    });
  };

  // Przełączenie dowolnego dokumentu WZ na Przyjęcie Dostawy (PZ) z podpowiedzią miejsc
  const handleConvertDocToDeliveryPlan = (doc: WarehouseDocument) => {
    const updatedDoc: WarehouseDocument = {
      ...doc,
      docType: 'PZ',
      docNumber: doc.docNumber.startsWith('DOSTAWA')
        ? doc.docNumber
        : `DOSTAWA (${doc.docNumber})`,
    };
    const smartPlan = buildSmartDeliveryAllocationsForDoc(state, updatedDoc);
    setCustomAllocations((prev) => ({ ...prev, ...smartPlan }));

    const nextDocs = state.documents.map((d) => (d.id === doc.id ? updatedDoc : d));
    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
        documents: nextDocs,
      },
      `Przełączono ${doc.docNumber} w tryb Planowania Przyjęcia Dostawy z podpowiedzią miejsc`
    );
    setFeedbackBanner({
      type: 'success',
      message: `✨ Wygenerowano podpowiedź najlepszych miejsc na regałach dla dokumentu ${updatedDoc.docNumber}!`,
    });
  };

  // Inicjalizacja lub pobranie wierszy alokacji palet dla pozycji PZ / PW
  const getOrInitItemAllocations = (
    doc: WarehouseDocument,
    item: WarehouseDocumentItem
  ): AllocatedMovementRecord[] => {
    if (customAllocations[item.id] && customAllocations[item.id].length > 0) {
      return customAllocations[item.id];
    }

    const docPlan = autoSmartPlansByDocId.get(doc.id);
    if (docPlan && docPlan[item.id] && docPlan[item.id].length > 0) {
      return docPlan[item.id];
    }

    const fallbackPlan = buildSmartDeliveryAllocationsForDoc(state, doc);
    return fallbackPlan[item.id] || [];
  };

  const handleUpdateCustomAllocRow = (
    doc: WarehouseDocument,
    item: WarehouseDocumentItem,
    rowIdx: number,
    patch: Partial<AllocatedMovementRecord>
  ) => {
    const current = getOrInitItemAllocations(doc, item).map((r) => ({ ...r }));
    if (!current[rowIdx]) return;
    const updated = { ...current[rowIdx], ...patch };

    if (patch.slotId) {
      const slot = state.slots.find((s) => s.id === patch.slotId);
      if (slot) updated.slotCode = slot.code;
      const recs = getPutAwayRecommendationsForItem(
        state,
        item.matchedProductId,
        updated.quantity,
        Boolean(updated.dedicatedForPartnerOnly ?? item.isPartnerChannel)
      );
      const matchedRec = recs.find((r) => r.slotId === patch.slotId);
      if (matchedRec) {
        updated.recommendationBadge = matchedRec.badge;
        updated.recommendationReason = matchedRec.reason;
      }
    }

    // Jeśli zmieniono ilość całkowitą, przelicz kartony
    if (patch.quantity !== undefined && patch.cartonsCount === undefined && patch.openCartonQty === undefined) {
      const upc = updated.unitsPerCarton || getDefaultUnitsPerCarton(state, item.matchedProductId);
      updated.unitsPerCarton = upc;
      updated.cartonsCount = upc > 0 ? Math.floor(updated.quantity / upc) : 0;
      updated.openCartonQty = upc > 0 ? updated.quantity % upc : 0;
    }

    // Jeśli zmieniono liczbę kartonów, szt. w kartonie lub otwarty karton -> przelicz ilość całkowitą
    if (
      patch.cartonsCount !== undefined ||
      patch.unitsPerCarton !== undefined ||
      patch.openCartonQty !== undefined
    ) {
      const cCount = Math.max(0, Number(updated.cartonsCount) || 0);
      const upc = Math.max(1, Number(updated.unitsPerCarton) || 1);
      const openQ = Math.max(0, Number(updated.openCartonQty) || 0);
      updated.quantity = cCount * upc + openQ;
    }

    current[rowIdx] = updated;
    setCustomAllocations((prev) => ({ ...prev, [item.id]: current }));
  };

  const handleSplitIntoAnotherPallet = (doc: WarehouseDocument, item: WarehouseDocumentItem) => {
    const current = getOrInitItemAllocations(doc, item).map((r) => ({ ...r }));
    const usedIds = new Set(current.map((r) => r.slotId));
    const recs = getPutAwayRecommendationsForItem(
      state,
      item.matchedProductId,
      Math.ceil(item.quantity / (current.length + 1)),
      item.isPartnerChannel,
      usedIds
    );
    const nextBest = recs[0];
    const upc = getDefaultUnitsPerCarton(state, item.matchedProductId);

    const lastRow = current[current.length - 1];
    const half = Math.max(1, Math.floor((lastRow?.quantity || item.quantity) / 2));
    if (lastRow && lastRow.quantity > half) {
      lastRow.quantity -= half;
      lastRow.cartonsCount = upc > 0 ? Math.floor(lastRow.quantity / upc) : 0;
      lastRow.openCartonQty = upc > 0 ? lastRow.quantity % upc : 0;
    }

    current.push({
      slotId: nextBest?.slotId || state.slots[0]?.id || '',
      slotCode: nextBest?.slotCode || state.slots[0]?.code || '',
      lotNumber: lastRow?.lotNumber || `DOST-${doc.issueDate.replace(/-/g, '')}`,
      expiryDate: lastRow?.expiryDate || '2028-09-30',
      quantity: half,
      cartonsCount: upc > 0 ? Math.floor(half / upc) : 0,
      unitsPerCarton: upc,
      openCartonQty: upc > 0 ? half % upc : 0,
      dedicatedForPartnerOnly: lastRow?.dedicatedForPartnerOnly ?? item.isPartnerChannel,
      firstToExit: false,
      palletLabel: `Paleta #${current.length + 1} (${doc.docNumber})`,
      recommendationBadge: nextBest?.badge || '💡 Sugerowane wolne miejsce',
      recommendationReason:
        nextBest?.reason || 'Kolejne wolne miejsce dla drugiej palety tej pozycji.',
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
    const upc = current[0].unitsPerCarton || getDefaultUnitsPerCarton(state, item.matchedProductId);
    current[0].cartonsCount = upc > 0 ? Math.floor(current[0].quantity / upc) : 0;
    current[0].openCartonQty = upc > 0 ? current[0].quantity % upc : 0;
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
          : 'rozmieszczono dostawę na magazynie'
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
        message: `✅ Dokument ${doc.docNumber} został zrealizowany! Palety zostały rozmieszczone na wskazanych miejscach w Magazynie 4, 5 i 6.`,
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
      {/* ASYSTENT PLANOWANIA PRZYJĘCIA DOSTAWY (FAKTURA / WZ / PZ -> PODPOWIEDŹ GDZIE NAJLEPIEJ UMIEŚCIĆ) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 border-2 border-teal-500/60 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-teal-400 text-slate-950 font-mono font-black text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>INTELIGENTNE PLANOWANIE PRZYJĘCIA DOSTAWY</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-pink-500/25 border border-pink-400/50 text-pink-200 text-[11px] font-bold">
                Faktura / WZ / PZ ➔ Podpowiedź regału i poziomu
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-white">
              Wgraj Fakturę lub WZ dostawy — system podpowie, gdzie najlepiej umieścić każdą paletę
            </h2>
            <p className="text-xs text-slate-300 max-w-4xl leading-relaxed">
              Algorytm sprawdza aktualne ułożenie w <strong>Magazynie 4, Magazynie 5 i Magazynie 6</strong>:
              wskazuje <strong>wolne miejsca na tym samym regale</strong> co reszta danego produktu, pilnuje zasady
              <strong> FEFO</strong> (nowa dostawa wyżej na Poziom 1/2 jako zapas, lub na Poziom 0 gdy na dole brakuje towaru),
              proponuje <strong>dokładki do niepełnych palet</strong> oraz automatycznie przelicza ilość na
              <strong> pełne kartony + sztuki w otwartym kartonie</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <input
              ref={deliveryPlannerInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadDeliveryPlanFiles(e.target.files, true);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              disabled={isParsingPdf}
              onClick={() => deliveryPlannerInputRef.current?.click()}
              className="px-4 py-3 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950 hover:from-teal-300 hover:to-emerald-400 transition-all cursor-pointer flex items-center gap-2 shadow-lg ring-2 ring-teal-300/50"
            >
              {isParsingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>📄 Wgraj Fakturę / WZ / PZ (PDF) — Zaplanuj rozmieszczenie</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteInvoiceBox((prev) => !prev)}
              className="px-3.5 py-3 rounded-2xl text-xs font-extrabold bg-slate-800 text-teal-200 border border-teal-500/50 hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>📋 Wklej pozycje z Faktury / WZ</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleDeliveryPlan}
              className="px-3.5 py-3 rounded-2xl text-xs font-extrabold bg-amber-500/20 text-amber-200 border border-amber-400/50 hover:bg-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
              title="Załaduj przykładową fakturę dostawy, aby od razu zobaczyć podpowiedzi miejsc"
            >
              <span>🧪 Przykładowa dostawa (Test podpowiedzi)</span>
            </button>
          </div>
        </div>

        {/* Rozwijane pole wklejania tekstu z Faktury / WZ / Excela */}
        {showPasteInvoiceBox && (
          <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-teal-300">
                Wklej skopiowany tekst z Faktury, dokumentu WZ, Lieferschein lub tabeli Excel (nazwa / kod EAN + ilość):
              </label>
              <button
                type="button"
                onClick={() => setShowPasteInvoiceBox(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Zamknij ✕
              </button>
            </div>
            <textarea
              rows={5}
              value={pastedInvoiceText}
              onChange={(e) => setPastedInvoiceText(e.target.value)}
              placeholder={`Przykład:\nFaktura FV 2026/10/15\nOMNi-BiOTiC Stress Repair 28 sasz. 432 szt.\nOMNi-BiOTiC PANDA 30 sasz. 360 szt.\n9120117912711 OMNi-BiOTiC 10 AAD 20 sasz. 576 szt.`}
              className="w-full rounded-2xl bg-slate-950/90 border border-slate-600 p-3.5 text-xs font-mono text-white focus:border-teal-400 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleParsePastedInvoice}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-teal-400 text-slate-950 hover:bg-teal-300 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Wyznacz najlepsze miejsca w Magazynie 4, 5 i 6</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Górny panel wgrywania standardowych PDF z wFirma + Ręcznego dodawania */}
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
              Możesz również wgrać standardowe dokumenty rozchodowe <strong>WZ / RW</strong> (do ściągnięcia ze Strefy Kompletacji)
              lub utworzyć dokument przyjęcia <strong>PZ / PW</strong> ręcznie i otrzymać automatyczną podpowiedź rozmieszczenia.
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
                  handleUploadDeliveryPlanFiles(e.target.files, false);
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
              onClick={() => {
                setManualType('PZ');
                setShowManualModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Wpisz dostawę / dokument ręcznie</span>
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
              { id: 'PZ', label: '📥 PZ / Faktury Dostawy (Planowanie Rozmieszczenia Palet)' },
              { id: 'PW', label: '📥 PW — Przyjęcia Wewnętrzne (Na Strefę Kompletacji)' },
              { id: 'WZ', label: '📤 WZ — Wydania Zewnętrzne (Ze Strefy Kompletacji)' },
              { id: 'RW', label: '📤 RW — Rozchody Wewnętrzne (Ze Strefy Kompletacji)' },
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

      {/* Lista dokumentów i planów dostawy */}
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
                  : 'border-teal-400 shadow-md'
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
                        ? 'bg-teal-600 text-white'
                        : 'bg-blue-600 text-white'
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
                        'Wydanie Zewnętrzne — ściąga ilości ze Strefy Kompletacji (lub kliknij obok, aby zaplanować przyjęcie tej WZ jako dostawy)'}
                      {doc.docType === 'RW' &&
                        'Rozchód Wewnętrzny — ściąga ilości ze Strefy Kompletacji'}
                      {doc.docType === 'PZ' &&
                        '✨ Planowanie Przyjęcia Dostawy — system wyznaczył optymalne miejsca w Magazynie 4, 5 i 6'}
                      {doc.docType === 'PW' &&
                        'Przyjęcie Wewnętrzne — dodaje towar na wskazane miejsca'}
                      {doc.notes ? ` • Uwagi: ${doc.notes}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isApplied && isOutbound && (
                    <button
                      type="button"
                      onClick={() => handleConvertDocToDeliveryPlan(doc)}
                      className="px-3 py-2 rounded-xl text-xs font-extrabold bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-100 cursor-pointer flex items-center gap-1.5"
                      title="Jeśli ten dokument WZ to dostawa przychodząca, kliknij tutaj, aby otrzymać podpowiedź gdzie umieścić towar na regałach"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>Zaplanuj jako Przyjęcie Dostawy (Podpowiedź miejsc)</span>
                    </button>
                  )}

                  {!isApplied && (doc.docType === 'PZ' || doc.docType === 'PW') && (
                    <button
                      type="button"
                      onClick={() => {
                        const freshPlan = buildSmartDeliveryAllocationsForDoc(state, doc);
                        setCustomAllocations((prev) => ({ ...prev, ...freshPlan }));
                        setFeedbackBanner({
                          type: 'success',
                          message: `✨ Ponownie przeliczono optymalne miejsca na regałach dla ${doc.docNumber}!`,
                        });
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Przelicz podpowiedzi miejsc</span>
                    </button>
                  )}

                  {isApplied ? (
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Zrealizowano w magazynie ({doc.appliedBy})</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyDocument(doc)}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer flex items-center gap-1.5 shadow-sm ${
                        isOutbound
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-teal-600 hover:bg-teal-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isOutbound
                          ? `Zatwierdź ${doc.docType} (Ściągnij ze Strefy Kompletacji)`
                          : doc.docType === 'PZ'
                          ? '✅ Zatwierdź i rozmieść dostawę na planie magazynu'
                          : 'Zatwierdź PW (Dodaj na magazyn)'}
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
              <div className="mt-4 space-y-4">
                {doc.items.map((item) => {
                  const summary = item.matchedProductId
                    ? summariesMap.get(item.matchedProductId)
                    : null;

                  const itemAllocs =
                    !isApplied && (doc.docType === 'PZ' || doc.docType === 'PW')
                      ? getOrInitItemAllocations(doc, item)
                      : item.allocatedMovements || [];

                  // Top 4 rekomendowane miejsca dla tego produktu (do szybkiego wyboru 1-klikiem)
                  const topRecommendations =
                    !isApplied && (doc.docType === 'PZ' || doc.docType === 'PW')
                      ? getPutAwayRecommendationsForItem(
                          state,
                          item.matchedProductId,
                          item.quantity,
                          item.isPartnerChannel
                        ).slice(0, 4)
                      : [];

                  const defaultUpc = getDefaultUnitsPerCarton(state, item.matchedProductId);
                  const totalFullCartons = defaultUpc > 0 ? Math.floor(item.quantity / defaultUpc) : 0;
                  const totalLoose = defaultUpc > 0 ? item.quantity % defaultUpc : 0;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 space-y-3"
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
                                    ? 'bg-pink-500 text-white border-pink-600 shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-pink-50'
                                }`}
                                title="Kliknij, aby przełączyć etykietę 🩷 PARTNER (Różowy kolor na planie, wymóg MHD ≥ 12 miesięcy)"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>
                                  {item.isPartnerChannel
                                    ? '🩷 PARTNER (Różowa paleta ≥ 12 msc)'
                                    : 'Standard PL (Dodaj 🩷 PARTNER)'}
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Dopasowanie do katalogu produktów + aktualny stan na magazynie */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-600">
                              Produkt w katalogu:
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

                            {summary && (
                              <span className="text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                Aktualnie w magazynie:{' '}
                                <strong className="text-teal-700 font-mono">
                                  {summary.totalPhysicalOnRacks} szt.
                                </strong>{' '}
                                (Kompletacja:{' '}
                                <strong className="font-mono">{summary.pickingStandardQty}</strong>
                                {summary.pickingPartnerQty > 0
                                  ? ` | 🩷 PARTNER: ${summary.pickingPartnerQty}`
                                  : ''}{' '}
                                | Zapas paletowy:{' '}
                                <strong className="font-mono">{summary.palletReserveQty}</strong>)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right bg-white px-3.5 py-2 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Ilość z Faktury / WZ:
                            </span>
                            <span className="text-lg font-extrabold font-mono text-slate-900">
                              {item.quantity} {item.unit}
                            </span>
                            {defaultUpc > 0 && (
                              <span className="block text-[11px] font-mono font-bold text-teal-700">
                                📦 {totalFullCartons} kart. × {defaultUpc} szt.
                                {totalLoose > 0 ? ` + ${totalLoose} otw.` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* SEKCJA PODPOWIEDZI ROZMIESZCZENIA DOSTAWY (PZ / PW) */}
                      {!isApplied && (doc.docType === 'PZ' || doc.docType === 'PW') && (
                        <div className="pt-3 border-t border-slate-200 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-extrabold flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Podpowiedź rozmieszczenia w Magazynie 4, 5 i 6:</span>
                              </span>
                              <span className="text-xs text-slate-600">
                                Kliknij sugerowane miejsce lub dostosuj podział na palety i kartony
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSplitIntoAnotherPallet(doc, item)}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-blue-100 text-blue-900 hover:bg-blue-200 cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Podziel tę pozycję na kolejną paletę</span>
                            </button>
                          </div>

                          {/* Szybki wybór spośród Top 4 rekomendowanych miejsc dla tej pozycji */}
                          {topRecommendations.length > 0 && (
                            <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-3 space-y-2">
                              <div className="text-[11px] font-extrabold text-teal-950 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                <span>
                                  Najlepsze miejsca wytypowane dla „{item.rawName}” (kliknij, aby przypisać do Palety #1):
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                {topRecommendations.map((rec, idx) => {
                                  const isSelectedOnFirst = itemAllocs[0]?.slotId === rec.slotId;
                                  return (
                                    <button
                                      key={rec.slotId}
                                      type="button"
                                      onClick={() =>
                                        handleUpdateCustomAllocRow(doc, item, 0, {
                                          slotId: rec.slotId,
                                        })
                                      }
                                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                        isSelectedOnFirst
                                          ? 'bg-slate-900 text-white border-teal-400 ring-2 ring-teal-400 shadow-sm'
                                          : 'bg-white text-slate-800 border-slate-200 hover:border-teal-400'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                              idx === 0
                                                ? 'bg-amber-400 text-slate-950'
                                                : isSelectedOnFirst
                                                ? 'bg-teal-500 text-slate-950'
                                                : 'bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            {idx === 0 ? `🏆 #1 ${rec.badge}` : `#${idx + 1} ${rec.badge}`}
                                          </span>
                                          <span className="font-mono text-[10px] font-bold opacity-80">
                                            {rec.isEmpty ? 'Wolne' : 'Dokładka'}
                                          </span>
                                        </div>
                                        <div className="font-mono text-xs font-black">
                                          {rec.warehouseName} • {rec.rackName} • Poz. {rec.level} • {rec.position}.
                                        </div>
                                      </div>
                                      <p
                                        className={`text-[10px] mt-1 leading-snug ${
                                          isSelectedOnFirst ? 'text-slate-300' : 'text-slate-600'
                                        }`}
                                      >
                                        {rec.reason}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Szczegółowe wiersze poszczególnych palet tej pozycji */}
                          <div className="space-y-2.5">
                            {itemAllocs.map((allocRow, rIdx) => {
                              const upc =
                                allocRow.unitsPerCarton ||
                                getDefaultUnitsPerCarton(state, item.matchedProductId);
                              const cCount =
                                allocRow.cartonsCount !== undefined
                                  ? allocRow.cartonsCount
                                  : upc > 0
                                  ? Math.floor(allocRow.quantity / upc)
                                  : 0;
                              const openQ =
                                allocRow.openCartonQty !== undefined
                                  ? allocRow.openCartonQty
                                  : upc > 0
                                  ? allocRow.quantity % upc
                                  : 0;

                              return (
                                <div
                                  key={rIdx}
                                  className="bg-white p-3.5 rounded-2xl border-2 border-teal-200 space-y-2.5 shadow-2xs"
                                >
                                  {/* Pasek uzasadnienia podpowiedzi + szybkie przełączniki 🩷 PARTNER / 🟨 1. do wyjścia */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-teal-300 font-mono text-xs font-black">
                                        PALETA #{rIdx + 1}
                                      </span>
                                      {allocRow.recommendationBadge && (
                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 text-xs font-extrabold">
                                          {allocRow.recommendationBadge}
                                        </span>
                                      )}
                                      {allocRow.recommendationReason && (
                                        <span className="text-xs text-slate-700 font-medium">
                                          {allocRow.recommendationReason}
                                        </span>
                                      )}
                                    </div>

                                    {/* Etykiety kolorystyczne palety: 🩷 PARTNER oraz 🟨 1. do wyjścia */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateCustomAllocRow(doc, item, rIdx, {
                                            dedicatedForPartnerOnly: !allocRow.dedicatedForPartnerOnly,
                                          })
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition-all ${
                                          allocRow.dedicatedForPartnerOnly
                                            ? 'bg-pink-500 text-white border-pink-600 shadow-2xs'
                                            : 'bg-white text-pink-700 border-pink-300 hover:bg-pink-50'
                                        }`}
                                      >
                                        🩷 {allocRow.dedicatedForPartnerOnly ? 'PARTNER (Różowy)' : '+ Etykieta PARTNER'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateCustomAllocRow(doc, item, rIdx, {
                                            firstToExit: !allocRow.firstToExit,
                                          })
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition-all ${
                                          allocRow.firstToExit
                                            ? 'bg-yellow-400 text-slate-950 border-yellow-500 shadow-2xs'
                                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                                        }`}
                                      >
                                        🟨 {allocRow.firstToExit ? '1. do wyjścia (Żółty)' : '+ Oznacz 1. do wyjścia'}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                    <div className="sm:col-span-4">
                                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                        Docelowe miejsce w Magazynie 4, 5 lub 6:
                                      </label>
                                      <select
                                        value={allocRow.slotId}
                                        onChange={(e) =>
                                          handleUpdateCustomAllocRow(doc, item, rIdx, {
                                            slotId: e.target.value,
                                          })
                                        }
                                        className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50"
                                      >
                                        {state.slots.map((s) => {
                                          const isFree =
                                            s.allocations.every((a) => a.quantity === 0) &&
                                            !(s.customDescription && s.customDescription.trim());
                                          return (
                                            <option key={s.id} value={s.id}>
                                              {isFree ? '🟢 [WOLNE] ' : '📦 [ZAJĘTE] '}
                                              {s.code} — {s.name}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>

                                    {/* Kalkulator kartonów dla tej palety */}
                                    <div className="sm:col-span-1">
                                      <label className="block text-[10px] font-bold text-teal-800 mb-0.5">
                                        Kartony:
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={cCount}
                                        onChange={(e) =>
                                          handleUpdateCustomAllocRow(doc, item, rIdx, {
                                            cartonsCount: Number(e.target.value),
                                            unitsPerCarton: upc,
                                            openCartonQty: openQ,
                                          })
                                        }
                                        className="w-full px-2 py-1.5 text-xs font-mono font-bold border border-teal-300 rounded-lg bg-teal-50/40"
                                      />
                                    </div>

                                    <div className="sm:col-span-1">
                                      <label className="block text-[10px] font-bold text-teal-800 mb-0.5">
                                        W kart.:
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={upc}
                                        onChange={(e) =>
                                          handleUpdateCustomAllocRow(doc, item, rIdx, {
                                            cartonsCount: cCount,
                                            unitsPerCarton: Number(e.target.value),
                                            openCartonQty: openQ,
                                          })
                                        }
                                        className="w-full px-2 py-1.5 text-xs font-mono font-bold border border-teal-300 rounded-lg bg-teal-50/40"
                                      />
                                    </div>

                                    <div className="sm:col-span-1">
                                      <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                                        Otwarty:
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        placeholder="0 (brak)"
                                        value={openQ === 0 ? '' : openQ}
                                        onChange={(e) =>
                                          handleUpdateCustomAllocRow(doc, item, rIdx, {
                                            cartonsCount: cCount,
                                            unitsPerCarton: upc,
                                            openCartonQty:
                                              e.target.value === '' ? 0 : Number(e.target.value),
                                          })
                                        }
                                        className="w-full px-2 py-1.5 text-xs font-mono font-bold border border-amber-300 rounded-lg bg-amber-50/40"
                                      />
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                        Łącznie sztuk:
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
                                        className="w-full px-2.5 py-1.5 text-xs font-mono font-black border border-slate-300 rounded-lg"
                                      />
                                    </div>

                                    <div className="sm:col-span-1">
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
                                        className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                                      />
                                    </div>

                                    <div className="sm:col-span-2 flex items-end gap-1.5">
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
                                          onClick={() =>
                                            handleRemovePalletSplitRow(doc, item, rIdx)
                                          }
                                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                                          title="Usuń ten podział palety"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Podsumowanie wykonanego ruchu po zatwierdzeniu dokumentu */}
                      {isApplied && item.allocatedMovements.length > 0 && (
                        <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-emerald-900">
                            {isOutbound ? 'Pobrano z miejsc:' : 'Rozmieszczono na miejscach:'}
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
