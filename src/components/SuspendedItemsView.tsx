import React, { useState, useMemo } from 'react';
import { WMSFullState, SuspendedItemRecord, SuspendedSubItem } from '../types/wms';
import { computeAllProductsSummary } from '../utils/wmsEngine';
import {
  Briefcase,
  Plus,
  RotateCcw,
  FileCheck2,
  Calendar,
  User,
  Package,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
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

  const [showNewModal, setShowNewModal] = useState(false);
  const [eventName, setEventName] = useState('Konferencja Medycyny Funkcjonalnej');
  const [takenBy, setTakenBy] = useState('');
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<
    { productId: string; quantity: number }[]
  >([{ productId: state.products[0]?.id || '', quantity: 10 }]);

  // Modal rozliczenia częściowego (ile wróciło na półkę, a ile poszło w RW/WZ)
  const [settleModalRecord, setSettleModalRecord] = useState<SuspendedItemRecord | null>(null);
  const [settleDocNum, setSettleDocNum] = useState('RW 15/10/2026');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

  // Utworzenie nowego wydania "W zawieszeniu" (zdejmuje sztuki z półki i wrzuca w status "W zawieszeniu")
  const handleCreateSuspendedIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = draftItems.filter((it) => it.productId && it.quantity > 0);
    if (valid.length === 0 || !eventName.trim()) return;

    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) => ({
      ...s,
      allocations: s.allocations.map((a) => ({ ...a })),
    }));
    const nextHistory = [...state.movementsHistory];
    const subItems: SuspendedSubItem[] = [];

    for (const reqItem of valid) {
      const prod = productMap.get(reqItem.productId);
      if (!prod) continue;

      let remaining = reqItem.quantity;
      // Szukamy najpierw w Strefie Kompletacji, a potem na paletach
      const candidateSlots = [
        ...nextSlots.filter((s) => s.slotType === 'picking_standard' || s.slotType === 'shelf_storage'),
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
          `Brak wystarczającej ilości produktu "${prod.shortName}" na magazynie (dostępne: ${totalAvail} szt., wpisano: ${remaining} szt.).`
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
            toSlotCode: 'W ZAWIESZENIU (KONFERENCJA)',
            referenceDoc: eventName.trim(),
            performedBy: workstationName,
            notes: `Wydano bez dokumentu (W zawieszeniu): ${eventName.trim()} (${takenBy || 'Brak osoby'})`,
          });
        }
      }
    }

    for (const s of nextSlots) {
      s.allocations = s.allocations.filter((a) => a.quantity > 0);
    }

    const newRec: SuspendedItemRecord = {
      id: `susp-${Date.now()}`,
      eventName: eventName.trim(),
      takenBy: takenBy.trim() || 'Przedstawiciel / Konferencja',
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
      `Wydano w zawieszeniu (bez dokumentu): ${newRec.eventName}`
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
            palletLabel: `Zwrot z: ${rec.eventName}`,
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
          referenceDoc: rec.eventName,
          performedBy: workstationName,
          notes: `Zwrot towaru z konferencji/zawieszenia na miejsce ${targetSlot.code}`,
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
              palletLabel: `Zwrot z: ${settleModalRecord.eventName}`,
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
            referenceDoc: settleModalRecord.eventName,
            performedBy: workstationName,
            notes: `Częściowy zwrot z konferencji na ${targetSlot.code}`,
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
          notes: `Rozliczono dokumentem ${settleDocNum.trim()} (${settleModalRecord.eventName})`,
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-extrabold text-xs">
              Wydane bez dokumentu (Konferencje / Targi / Próbki)
            </span>
            <h2 className="text-lg font-extrabold text-slate-900">
              Rejestr Towarów „W Zawieszeniu”
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-3xl">
            Zapisuj tutaj towary fizycznie zabrane z magazynu (np. na konferencję, targi, dla przedstawiciela), które
            <strong> nie mają jeszcze wystawionego dokumentu WZ/RW w systemie wFirma</strong>.
            Podczas inwentaryzacji aplikacja automatycznie doliczy te sztuki do bilansu, abyś od razu wiedziała, skąd wynika różnica między półką a wFirma!
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-300 text-right">
            <span className="text-[11px] font-bold text-amber-900 block">
              Aktualnie poza magazynem (w zawieszeniu):
            </span>
            <span className="text-xl font-extrabold font-mono text-amber-950">
              {totalSuspendedUnits} szt.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-4 py-3 rounded-2xl text-xs font-extrabold bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Wydaj towar w zawieszeniu (np. na Konferencję)</span>
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
            Gdy wydasz produkty z magazynu bez dokumentu WZ/RW (np. na konferencję medyczną lub spotkanie), kliknij przycisk powyżej — aplikacja zdejmie je ze stanu półki i zapamięta do inwentaryzacji.
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
                    <div className="flex items-center gap-2">
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
                        Pobrał(a): <strong>{rec.takenBy}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Wydano: {rec.issuedAt}
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
                    return (
                      <div
                        key={it.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-slate-900">{it.productName}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Pobrano z: <strong>{it.sourceSlotCode}</strong> • LOT: {it.lotNumber} (MHD:{' '}
                            {it.expiryDate})
                          </div>
                        </div>
                        <div className="text-right font-mono">
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

      {/* MODAL WYDANIA TOWARU W ZAWIESZENIU */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateSuspendedIssue}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Wydaj towar z magazynu „W Zawieszeniu” (bez dokumentu wFirma)
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nazwa konferencji / cel pobrania:
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="np. Konferencja Medycyny Funkcjonalnej Warszawa"
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kto pobrał towar:
                </label>
                <input
                  type="text"
                  value={takenBy}
                  onChange={(e) => setTakenBy(e.target.value)}
                  placeholder="np. Przedstawiciel / Dział Marketingu"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data wydania:</label>
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Uwagi:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="np. Rozliczenie po powrocie z targów"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800">
                  Produkty zabierane z magazynu:
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraftItems([
                      ...draftItems,
                      { productId: state.products[0]?.id || '', quantity: 5 },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-950 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dodaj produkt</span>
                </button>
              </div>

              {draftItems.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                >
                  <select
                    value={it.productId}
                    onChange={(e) => {
                      const next = [...draftItems];
                      next[idx].productId = e.target.value;
                      setDraftItems(next);
                    }}
                    className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                  >
                    {summaries.map((s) => (
                      <option key={s.product.id} value={s.product.id}>
                        {s.product.shortName} (Na magazynie: {s.totalPhysicalOnRacks} szt.)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => {
                      const next = [...draftItems];
                      next[idx].quantity = Number(e.target.value);
                      setDraftItems(next);
                    }}
                    className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                  />
                  <span className="text-xs text-slate-500">szt.</span>
                  {draftItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
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
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
              >
                Zatwierdź wydanie w zawieszeniu
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
                      <div className="font-bold text-slate-900">{it.productName}</div>
                      <div className="text-[11px] text-slate-500">
                        Pobrano: <strong>{activeQty} szt.</strong> (z {it.sourceSlotCode})
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
