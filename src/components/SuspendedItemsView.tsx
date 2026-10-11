import React, { useState, useMemo, useRef } from 'react';
import {
  WMSFullState,
  SuspendedItemRecord,
  SuspendedSubItem,
  SuspendedReasonCategory,
} from '../types/wms';
import { computeAllProductsSummary } from '../utils/wmsEngine';
import {
  SUSPENDED_REASON_PRESETS,
  detectSuspendedReasonCategory,
  parseSuspendedJustificationsText,
} from '../utils/wfirmaParser';
import { extractPdfTextViaServer } from '../utils/wmsSyncService';
import {
  Briefcase,
  Plus,
  RotateCcw,
  FileCheck2,
  Calendar,
  User,
  Trash2,
  X,
  Upload,
  FileText,
  Sparkles,
} from 'lucide-react';

interface SuspendedItemsViewProps {
  state: WMSFullState;
  workstationName: string;
  onUpdateState: (nextState: WMSFullState, summary: string) => void;
}

export const SuspendedItemsView: React.FC<SuspendedItemsViewProps> = ({
  state,
  workstationName,
  onUpdateState,
}) => {
  const summaries = useMemo(() => computeAllProductsSummary(state), [state]);
  const productMap = useMemo(
    () => new Map(state.products.map((p) => [p.id, p])),
    [state.products]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [entryTab, setEntryTab] = useState<'manual' | 'paste'>('manual');
  // Czy wpis ma zdjąć sztuki z półki teraz, czy jest wyjaśnieniem różnicy inwentaryzacyjnej (towar już wcześniej wyszedł z półki)
  const [deductFromRack, setDeductFromRack] = useState<boolean>(false);

  const [eventName, setEventName] = useState('Wyjaśnienia wydań bez dokumentu / Konferencje');
  const [takenBy, setTakenBy] = useState('');
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  const [draftItems, setDraftItems] = useState<
    {
      productId: string;
      quantity: number;
      reason: string;
      category: SuspendedReasonCategory;
    }[]
  >([
    {
      productId:
        state.products.find((p) => /panda/i.test(p.shortName))?.id ||
        state.products[0]?.id ||
        '',
      quantity: 30,
      reason: 'Konferencja',
      category: 'konferencja',
    },
    {
      productId:
        state.products.find((p) => /panda/i.test(p.shortName))?.id ||
        state.products[0]?.id ||
        '',
      quantity: 6,
      reason: 'Zamówienie pracownicze bez dokumentu sprzedaży',
      category: 'zamowienie_pracownicze',
    },
    {
      productId:
        state.products.find((p) => /panda/i.test(p.shortName))?.id ||
        state.products[0]?.id ||
        '',
      quantity: 4,
      reason: 'Niewystawione RW',
      category: 'niewystawione_rw',
    },
  ]);

  // Stan dla zakładki "Wklej tekst / Wgraj plik"
  const [rawPasteText, setRawPasteText] = useState(
    '30 op. panda 30 - konferencja, 6 zamówienie pracownicze bez dokumentu sprzedaży, 4 niewystawione RW'
  );
  const [fallbackPasteProductId, setFallbackPasteProductId] = useState<string>(
    state.products.find((p) => /panda/i.test(p.shortName))?.id || state.products[0]?.id || ''
  );

  const parsedPastePreview = useMemo(
    () =>
      parseSuspendedJustificationsText(
        rawPasteText,
        state.products,
        fallbackPasteProductId
      ),
    [rawPasteText, state.products, fallbackPasteProductId]
  );

  // Modal rozliczenia częściowego (ile wróciło na półkę, a ile poszło w RW/WZ)
  const [settleModalRecord, setSettleModalRecord] = useState<SuspendedItemRecord | null>(null);
  const [settleDocNum, setSettleDocNum] = useState('RW 15/10/2026');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

  // Wczytanie pliku TXT / CSV / PDF z wyjaśnieniami
  const handleUploadJustificationsFile = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const text = await extractPdfTextViaServer(file);
        setRawPasteText(text);
      } else {
        const text = await file.text();
        setRawPasteText(text);
      }
      setEntryTab('paste');
    } catch (err: any) {
      alert(err?.message || 'Nie udało się odczytać pliku z wyjaśnieniami.');
    }
  };

  // Utworzenie nowego wpisu "W zawieszeniu" (z formularza ręcznego lub z wklejonego tekstu/pliku)
  const handleCreateSuspendedIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToProcess =
      entryTab === 'paste'
        ? parsedPastePreview
        : draftItems.filter((it) => it.productId && it.quantity > 0);

    if (itemsToProcess.length === 0) {
      alert('Dodaj lub wklej przynajmniej jedną pozycję z ilością większą od 0.');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) => ({
      ...s,
      allocations: s.allocations.map((a) => ({ ...a })),
    }));
    const nextHistory = [...state.movementsHistory];
    const subItems: SuspendedSubItem[] = [];

    for (const reqItem of itemsToProcess) {
      const prod = productMap.get(reqItem.productId);
      if (!prod) continue;

      const reasonClean = (reqItem.reason || eventName || 'Wydane bez dokumentu').trim();
      const detectedCat =
        reqItem.category || detectSuspendedReasonCategory(reasonClean).category;

      if (!deductFromRack) {
        // Tryb wyjaśnienia różnicy inwentaryzacyjnej (towar już fizycznie opuścił półkę wcześniej — nie odejmujemy go ponownie ze stanu regału)
        subItems.push({
          id: `susp-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: prod.id,
          productName: prod.shortName,
          quantityIssued: reqItem.quantity,
          quantityReturned: 0,
          quantitySettled: 0,
          lotNumber: 'WG-STANU',
          expiryDate: '2027-12-31',
          sourceSlotId: 'explained-only',
          sourceSlotCode: 'WYJAŚNIENIE INW.',
          reason: reasonClean,
          category: detectedCat,
        });

        nextHistory.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          type: 'SUSPEND_OUT',
          productId: prod.id,
          productName: prod.shortName,
          quantity: reqItem.quantity,
          lotNumber: 'WG-STANU',
          expiryDate: '-',
          fromSlotCode: 'POZA PÓŁKĄ (WYJAŚNIENIE)',
          toSlotCode: 'W ZAWIESZENIU',
          referenceDoc: reasonClean,
          performedBy: workstationName,
          notes: `Dopisano wyjaśnienie różnicy (W zawieszeniu): ${reqItem.quantity} szt. — ${reasonClean}`,
        });
        continue;
      }

      // Tryb fizycznego zdjęcia ze stanu półki teraz
      let remaining = reqItem.quantity;
      const candidateSlots = [
        ...nextSlots.filter(
          (s) => s.slotType === 'picking_standard' || s.slotType === 'shelf_storage'
        ),
        ...nextSlots.filter((s) => s.slotType === 'pallet_storage'),
        ...nextSlots.filter((s) => s.slotType === 'picking_partner_12m'),
      ];

      let totalAvail = 0;
      for (const s of candidateSlots) {
        for (const b of s.allocations) {
          if (b.productId === prod.id) totalAvail += b.quantity;
        }
      }

      if (totalAvail < remaining) {
        alert(
          `Brak wystarczającej ilości produktu "${prod.shortName}" na regałach (dostępne: ${totalAvail} szt., wpisano: ${remaining} szt.). Jeśli towar został już zabrany z półki wcześniej, przełącz na tryb „Wyjaśnienie różnicy inwentaryzacyjnej (bez ponownego odejmowania z półki)”.`
        );
        return;
      }

      for (const slot of candidateSlots) {
        for (const batch of slot.allocations) {
          if (remaining <= 0) break;
          if (batch.productId !== prod.id || batch.quantity <= 0) continue;

          const take = Math.min(batch.quantity, remaining);
          batch.quantity -= take;
          batch.updatedAt = nowIso;
          remaining -= take;

          subItems.push({
            id: `susp-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: prod.id,
            productName: prod.shortName,
            quantityIssued: take,
            quantityReturned: 0,
            quantitySettled: 0,
            lotNumber: batch.lotNumber,
            expiryDate: batch.expiryDate,
            sourceSlotId: slot.id,
            sourceSlotCode: slot.code,
            reason: reasonClean,
            category: detectedCat,
          });

          nextHistory.unshift({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            type: 'SUSPEND_OUT',
            productId: prod.id,
            productName: prod.shortName,
            quantity: take,
            lotNumber: batch.lotNumber,
            expiryDate: batch.expiryDate,
            fromSlotCode: slot.code,
            toSlotCode: 'W ZAWIESZENIU',
            referenceDoc: reasonClean,
            performedBy: workstationName,
            notes: `Wydano bez dokumentu (W zawieszeniu): ${reasonClean} (${takenBy || 'Brak osoby'})`,
          });
        }
      }
    }

    for (const s of nextSlots) {
      s.allocations = s.allocations.filter((a) => a.quantity > 0);
    }

    const summaryTitle =
      eventName.trim() ||
      Array.from(new Set(subItems.map((s) => s.reason).filter(Boolean))).join(', ') ||
      'Wydania w zawieszeniu bez dokumentu';

    const newRec: SuspendedItemRecord = {
      id: `susp-${Date.now()}`,
      eventName: summaryTitle,
      takenBy: takenBy.trim() || 'Wyjaśnienie inwentaryzacyjne / Zespół',
      issuedAt,
      expectedReturnDate: expectedReturnDate || undefined,
      status: 'suspended',
      notes: notes.trim(),
      items: subItems,
    };

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
        suspendedRecords: [newRec, ...state.suspendedRecords],
        movementsHistory: nextHistory,
      },
      `Zapisano pozycje w zawieszeniu: ${newRec.eventName} (${subItems.reduce(
        (acc, i) => acc + i.quantityIssued,
        0
      )} szt.)`
    );
    setShowNewModal(false);
  };

  // Zwrócenie 100% towaru z powrotem na magazyn
  const handleReturnAllToWarehouse = (rec: SuspendedItemRecord) => {
    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) => ({
      ...s,
      allocations: s.allocations.map((a) => ({ ...a })),
    }));
    const nextHistory = [...state.movementsHistory];

    const updatedItems = rec.items.map((it) => {
      const activeQty = Math.max(0, it.quantityIssued - it.quantityReturned - it.quantitySettled);
      if (activeQty <= 0) return it;

      const targetSlot =
        nextSlots.find((s) => s.id === it.sourceSlotId) ||
        nextSlots.find(
          (s) =>
            s.slotType === 'picking_standard' &&
            s.allocations.some((a) => a.productId === it.productId)
        ) ||
        nextSlots.find((s) => s.slotType === 'picking_standard') ||
        nextSlots[0];

      if (targetSlot) {
        const existing = targetSlot.allocations.find(
          (b) =>
            b.productId === it.productId &&
            b.lotNumber === it.lotNumber &&
            b.expiryDate === it.expiryDate
        );
        if (existing) {
          existing.quantity += activeQty;
          existing.updatedAt = nowIso;
        } else {
          targetSlot.allocations.push({
            id: `batch-ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: it.productId,
            quantity: activeQty,
            lotNumber: it.lotNumber,
            expiryDate: it.expiryDate,
            palletLabel: `Zwrot z: ${it.reason || rec.eventName}`,
            updatedAt: nowIso,
          });
        }

        nextHistory.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          type: 'SUSPEND_RETURN',
          productId: it.productId,
          productName: it.productName,
          quantity: activeQty,
          lotNumber: it.lotNumber,
          expiryDate: it.expiryDate,
          fromSlotCode: 'W ZAWIESZENIU',
          toSlotCode: targetSlot.code,
          referenceDoc: it.reason || rec.eventName,
          performedBy: workstationName,
          notes: `Zwrot towaru z zawieszenia (${it.reason || rec.eventName}) na miejsce ${targetSlot.code}`,
        });
      }

      return {
        ...it,
        quantityReturned: it.quantityReturned + activeQty,
      };
    });

    const nextRecords = state.suspendedRecords.map((r) =>
      r.id === rec.id ? { ...r, status: 'returned' as const, items: updatedItems } : r
    );

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
        suspendedRecords: nextRecords,
        movementsHistory: nextHistory,
      },
      `Zwrócono na magazyn towary z: ${rec.eventName}`
    );
  };

  // Rozliczenie częściowe lub całkowite (część wróciła na półkę, a reszta została rozliczona dokumentem RW/WZ w wFirma)
  const handleConfirmMixedSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalRecord) return;

    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) => ({
      ...s,
      allocations: s.allocations.map((a) => ({ ...a })),
    }));
    const nextHistory = [...state.movementsHistory];

    const updatedItems = settleModalRecord.items.map((it) => {
      const activeQty = Math.max(0, it.quantityIssued - it.quantityReturned - it.quantitySettled);
      if (activeQty <= 0) return it;

      const retQty = Math.min(activeQty, Math.max(0, Number(returnQuantities[it.id] || 0)));
      const settledQty = activeQty - retQty;

      if (retQty > 0) {
        const targetSlot =
          nextSlots.find((s) => s.id === it.sourceSlotId) ||
          nextSlots.find((s) => s.slotType === 'picking_standard') ||
          nextSlots[0];

        if (targetSlot) {
          const existing = targetSlot.allocations.find(
            (b) =>
              b.productId === it.productId &&
              b.lotNumber === it.lotNumber &&
              b.expiryDate === it.expiryDate
          );
          if (existing) {
            existing.quantity += retQty;
            existing.updatedAt = nowIso;
          } else {
            targetSlot.allocations.push({
              id: `batch-ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              productId: it.productId,
              quantity: retQty,
              lotNumber: it.lotNumber,
              expiryDate: it.expiryDate,
              palletLabel: `Zwrot z: ${it.reason || settleModalRecord.eventName}`,
              updatedAt: nowIso,
            });
          }

          nextHistory.unshift({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            type: 'SUSPEND_RETURN',
            productId: it.productId,
            productName: it.productName,
            quantity: retQty,
            lotNumber: it.lotNumber,
            expiryDate: it.expiryDate,
            fromSlotCode: 'W ZAWIESZENIU',
            toSlotCode: targetSlot.code,
            referenceDoc: it.reason || settleModalRecord.eventName,
            performedBy: workstationName,
            notes: `Częściowy zwrot z zawieszenia na ${targetSlot.code}`,
          });
        }
      }

      if (settledQty > 0) {
        nextHistory.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          type: 'SUSPEND_SETTLE',
          productId: it.productId,
          productName: it.productName,
          quantity: settledQty,
          lotNumber: it.lotNumber,
          expiryDate: it.expiryDate,
          fromSlotCode: 'W ZAWIESZENIU',
          referenceDoc: settleDocNum.trim() || settleModalRecord.eventName,
          performedBy: workstationName,
          notes: `Rozliczono dokumentem ${settleDocNum.trim()} (${it.reason || settleModalRecord.eventName})`,
        });
      }

      return {
        ...it,
        quantityReturned: it.quantityReturned + retQty,
        quantitySettled: it.quantitySettled + settledQty,
      };
    });

    const nextRecords = state.suspendedRecords.map((r) =>
      r.id === settleModalRecord.id
        ? {
            ...r,
            status: 'settled_by_doc' as const,
            settledDocNumber: settleDocNum.trim(),
            items: updatedItems,
          }
        : r
    );

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
        suspendedRecords: nextRecords,
        movementsHistory: nextHistory,
      },
      `Rozliczono pobranie w zawieszeniu: ${settleModalRecord.eventName} (${settleDocNum})`
    );
    setSettleModalRecord(null);
  };

  const handleDeleteRecord = (id: string) => {
    if (!window.confirm('Czy usunąć ten wpis z historii?')) return;
    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
        suspendedRecords: state.suspendedRecords.filter((r) => r.id !== id),
      },
      'Usunięto wpis z rejestru towarów w zawieszeniu'
    );
  };

  const totalSuspendedUnits = useMemo(() => {
    let sum = 0;
    for (const r of state.suspendedRecords) {
      if (r.status !== 'suspended') continue;
      for (const it of r.items) {
        sum += Math.max(0, it.quantityIssued - it.quantityReturned - it.quantitySettled);
      }
    }
    return sum;
  }, [state.suspendedRecords]);

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-extrabold text-xs">
              Wydane bez dokumentu (Konferencje / Zamówienia pracownicze / Niewystawione RW / Zwroty i Wymiany)
            </span>
            <h2 className="text-lg font-extrabold text-slate-900">
              Rejestr Towarów „W Zawieszeniu” i Wyjaśnień Różnic
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-3xl">
            Wpisz ręcznie lub wklej / wgraj listę towarów z uzasadnieniem wydania, np.{' '}
            <code className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 font-mono text-amber-950 font-bold">
              30 op. panda 30 - konferencja, 6 zamówienie pracownicze bez dokumentu sprzedaży, 4 niewystawione RW
            </code>{' '}
            albo <strong className="text-slate-800">zwrot bez PW, wymiana B2B w toku, ponowna wysyłka przed dostawą zwrotu</strong>.
            System automatycznie dolicza te pozycje do bilansu inwentaryzacji vs wFirma!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-300 text-right">
            <span className="text-[11px] font-bold text-amber-900 block">
              Łącznie w zawieszeniu (wszystkie powody):
            </span>
            <span className="text-xl font-extrabold font-mono text-amber-950">
              {totalSuspendedUnits} szt.
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setEntryTab('manual');
              setShowNewModal(true);
            }}
            className="px-4 py-3 rounded-2xl text-xs font-extrabold bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Wpisz ręcznie z uzasadnieniem</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntryTab('paste');
              setShowNewModal(true);
            }}
            className="px-4 py-3 rounded-2xl text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Wklej tekst / Wgraj plik wyjaśnień</span>
          </button>
        </div>
      </div>

      {/* Lista wydań w zawieszeniu */}
      {state.suspendedRecords.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-slate-300 space-y-2">
          <Briefcase className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-sm font-extrabold text-slate-800">
            Brak aktywnych towarów „W Zawieszeniu”
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Kliknij przycisk powyżej, aby wpisać ręcznie lub wkleić listę wydań z uzasadnieniem (konferencja, zamówienie pracownicze, niewystawione RW, zwrot bez PW, wymiana B2B w toku).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.suspendedRecords.map((rec) => {
            const isActive = rec.status === 'suspended';

            return (
              <div
                key={rec.id}
                className={`bg-white rounded-3xl border-2 p-5 shadow-xs ${
                  isActive ? 'border-amber-300 bg-amber-50/15' : 'border-slate-200 opacity-85'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          isActive
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {isActive
                          ? '🎪 W ZAWIESZENIU (Bez dokumentu)'
                          : rec.status === 'returned'
                          ? '↩️ ZWRÓCONO NA MAGAZYN'
                          : `✅ ROZLICZONO (${rec.settledDocNumber || 'RW/WZ'})`}
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900">{rec.eventName}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Osoba / Dział: <strong>{rec.takenBy}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Data wpisu: {rec.issuedAt}
                      </span>
                      {rec.notes && <span>Uwagi: {rec.notes}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReturnAllToWarehouse(rec)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Zwróć całość z powrotem na półkę</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const initMap: Record<string, number> = {};
                            rec.items.forEach((it) => {
                              initMap[it.id] = 0;
                            });
                            setReturnQuantities(initMap);
                            setSettleModalRecord(rec);
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Rozlicz dokumentem RW/WZ (lub częściowy zwrot)</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(rec.id)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {rec.items.map((it) => {
                    const activeQty = Math.max(
                      0,
                      it.quantityIssued - it.quantityReturned - it.quantitySettled
                    );
                    const itemReason = it.reason || rec.eventName;
                    return (
                      <div
                        key={it.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-900">{it.productName}</span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 font-bold text-[10px]">
                              {itemReason}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Źródło: <strong>{it.sourceSlotCode}</strong> • LOT: {it.lotNumber}
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <span className="font-extrabold text-sm text-amber-900 block">
                            {isActive ? `${activeQty} szt.` : `${it.quantityIssued} szt.`}
                          </span>
                          {(it.quantityReturned > 0 || it.quantitySettled > 0) && (
                            <span className="text-[10px] text-slate-500">
                              Zwrócono: {it.quantityReturned} | RW/WZ: {it.quantitySettled}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DODAWANIA / WKLEJANIA WYDAŃ W ZAWIESZENIU Z UZASADNIENIEM */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateSuspendedIssue}
            className="bg-white rounded-3xl max-w-3xl w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Dodaj towary „W Zawieszeniu” z uzasadnieniem wydania
                </h3>
                <p className="text-xs text-slate-500">
                  Możesz dodać pozycje ręcznie (wiersz po wierszu) lub wkleić / wgrać tekst z kilkoma uzasadnieniami naraz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Przełącznik zakładki: Ręcznie vs Wklej tekst / Wgraj plik */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEntryTab('manual')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    entryTab === 'manual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✍️ Wpisz ręcznie (formularz z gotowymi powodami)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryTab('paste')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                    entryTab === 'paste'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Wklej tekst lub wgraj plik (np. „30 op. panda 30 - konferencja, 6 zamówienie...”)
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadJustificationsFile(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Wgraj plik (.txt / .csv / .pdf)</span>
              </button>
            </div>

            {/* Ważny wybór: Wyjaśnienie różnicy inwentaryzacyjnej vs Zdjęcie z półki teraz */}
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <span className="text-[11px] font-extrabold text-amber-950 block">
                Jak potraktować stan na półce?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeductFromRack(false)}
                  className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer transition-all ${
                    !deductFromRack
                      ? 'bg-amber-600 text-white border-amber-700 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-extrabold">
                    📝 Wyjaśnienie różnicy inwentaryzacyjnej (Zalecane)
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      !deductFromRack ? 'text-amber-100' : 'text-slate-500'
                    }`}
                  >
                    Towar został już wcześniej zabrany z półki — dopisz tylko wyjaśnienie do kolumny „W zawieszeniu” bez ponownego odejmowania z regału.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeductFromRack(true)}
                  className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer transition-all ${
                    deductFromRack
                      ? 'bg-slate-900 text-white border-slate-950 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-extrabold">
                    📦 Fizyczne wydanie teraz — zdejmij ze stanu półki
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      deductFromRack ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Dopiero teraz wydajesz ten towar z regału — odejmij sztuki ze Strefy Kompletacji i przenieś do „W zawieszeniu”.
                  </div>
                </button>
              </div>
            </div>

            {entryTab === 'manual' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800">
                    Pozycje i uzasadnienia wydania (każdy wiersz może mieć inne uzasadnienie):
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftItems([
                        ...draftItems,
                        {
                          productId:
                            draftItems[draftItems.length - 1]?.productId ||
                            state.products[0]?.id ||
                            '',
                          quantity: 1,
                          reason: 'Niewystawione RW',
                          category: 'niewystawione_rw',
                        },
                      ])
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-950 hover:bg-amber-200 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dodaj kolejne wyjaśnienie / wiersz</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {draftItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={it.productId}
                          onChange={(e) => {
                            const next = [...draftItems];
                            next[idx].productId = e.target.value;
                            setDraftItems(next);
                          }}
                          className="flex-1 min-w-[220px] px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                        >
                          {summaries.map((s) => (
                            <option key={s.product.id} value={s.product.id}>
                              {s.product.shortName} (Na półce: {s.totalPhysicalOnRacks} | wFirma:{' '}
                              {s.wfirmaTotal} | Różnica: {s.inventoryDiff})
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => {
                              const next = [...draftItems];
                              next[idx].quantity = Number(e.target.value);
                              setDraftItems(next);
                            }}
                            className="w-20 px-2.5 py-1.5 text-xs font-mono font-extrabold bg-white border border-slate-300 rounded-xl text-center"
                          />
                          <span className="text-xs font-bold text-slate-600">op./szt.</span>
                        </div>

                        <input
                          type="text"
                          value={it.reason}
                          onChange={(e) => {
                            const next = [...draftItems];
                            const val = e.target.value;
                            next[idx].reason = val;
                            next[idx].category = detectSuspendedReasonCategory(val).category;
                            setDraftItems(next);
                          }}
                          placeholder="Wpisz uzasadnienie (np. konferencja, zamówienie pracownicze, niewystawione RW...)"
                          className="flex-1 min-w-[220px] px-3 py-1.5 text-xs font-bold bg-white border border-amber-300 rounded-xl"
                        />

                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftItems(draftItems.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Szybkie pigułki z gotowymi uzasadnieniami */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">
                          Szybki powód:
                        </span>
                        {SUSPENDED_REASON_PRESETS.filter((p) => p.category !== 'inne').map(
                          (preset) => (
                            <button
                              key={preset.category}
                              type="button"
                              onClick={() => {
                                const next = [...draftItems];
                                next[idx].reason = preset.label;
                                next[idx].category = preset.category;
                                setDraftItems(next);
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer border transition-colors ${
                                it.reason.toLowerCase() === preset.label.toLowerCase()
                                  ? 'bg-amber-600 text-white border-amber-700'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                              }`}
                            >
                              {preset.badge}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ZAKŁADKA: WKLEJ TEKST LUB WGRAJ PLIK */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-slate-800">
                    Wklej listę wyjaśnień (w jednej linii po przecinku lub w osobnych wierszach):
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRawPasteText(
                        '30 op. panda 30 - konferencja, 6 zamówienie pracownicze bez dokumentu sprzedaży, 4 niewystawione RW\n2 op. stress 28 - zwrot bez PW, 3 wymiana b2b w toku, 1 ponowna wysyłka przed dostawą zwrotu'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-950 hover:bg-amber-200 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Wstaw pełny przykład</span>
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="np. 30 op. panda 30 - konferencja, 6 zamówienie pracownicze bez dokumentu sprzedaży, 4 niewystawione RW, zwrot bez PW, wymiana b2b w toku, ponowna wysyłka przed dostawą zwrotu"
                  className="w-full p-3 text-xs font-mono bg-slate-50 border-2 border-slate-300 rounded-2xl focus:bg-white focus:border-amber-500 focus:outline-none"
                />

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">
                    Domyślny produkt (gdy w tekście nie podano nazwy produktu, np. samo „4 niewystawione RW”):
                  </span>
                  <select
                    value={fallbackPasteProductId}
                    onChange={(e) => setFallbackPasteProductId(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  >
                    {summaries.map((s) => (
                      <option key={s.product.id} value={s.product.id}>
                        {s.product.shortName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Podgląd rozpoznanych pozycji na żywo */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                    <span>
                      Rozpoznane pozycje do zapisania ({parsedPastePreview.length}):
                    </span>
                    <span className="font-mono text-amber-900">
                      Suma:{' '}
                      {parsedPastePreview.reduce((acc, i) => acc + i.quantity, 0)} szt.
                    </span>
                  </div>
                  {parsedPastePreview.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Wpisz lub wklej tekst powyżej, aby zobaczyć automatycznie rozpoznane produkty, ilości i uzasadnienia.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {parsedPastePreview.map((item, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900">
                              {item.productName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-bold text-[11px]">
                              {item.reason}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-amber-900">
                            {item.quantity} szt.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dodatkowe metadane wpisu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nazwa zbiorcza wpisu:
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="np. Wyjaśnienia inwentaryzacji Październik"
                  className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Osoba / Dział (opcjonalnie):
                </label>
                <input
                  type="text"
                  value={takenBy}
                  onChange={(e) => setTakenBy(e.target.value)}
                  placeholder="np. Konferencja / B2B / Magazyn"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Data wpisu:
                </label>
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-sm"
              >
                Zapisz wyjaśnienia „W zawieszeniu”
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ROZLICZENIA PO KONFERENCJI (ILE WRÓCIŁO NA PÓŁKĘ vs ILE POSZŁO W RW/WZ) */}
      {settleModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmMixedSettlement}
            className="bg-white rounded-3xl max-w-xl w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Rozliczenie: {settleModalRecord.eventName}
              </h3>
              <button
                type="button"
                onClick={() => setSettleModalRecord(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Numer dokumentu rozliczającego w wFirma (np. RW lub WZ):
              </label>
              <input
                type="text"
                value={settleDocNum}
                onChange={(e) => setSettleDocNum(e.target.value)}
                placeholder="np. RW 18/10/2026"
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">
                Wskaż, ile sztuk wróciło fizycznie na półkę (reszta zostanie rozliczona powyższym dokumentem RW/WZ):
              </div>
              {settleModalRecord.items.map((it) => {
                const activeQty = Math.max(
                  0,
                  it.quantityIssued - it.quantityReturned - it.quantitySettled
                );
                const ret = returnQuantities[it.id] || 0;
                const consumed = Math.max(0, activeQty - ret);

                return (
                  <div
                    key={it.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {it.productName}{' '}
                        {it.reason && (
                          <span className="text-amber-800 font-normal">({it.reason})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        W zawieszeniu: <strong>{activeQty} szt.</strong> ({it.sourceSlotCode})
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-teal-800">
                          Wraca na półkę:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={activeQty}
                          value={ret}
                          onChange={(e) =>
                            setReturnQuantities({
                              ...returnQuantities,
                              [it.id]: Number(e.target.value),
                            })
                          }
                          className="w-20 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div className="text-right font-mono">
                        <span className="block text-[10px] text-slate-500">Zużyto (w RW):</span>
                        <strong className="text-rose-700">{consumed} szt.</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettleModalRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              >
                Zatwierdź rozliczenie
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
