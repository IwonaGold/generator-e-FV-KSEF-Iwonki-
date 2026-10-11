import React, { useState, useMemo } from 'react';
import { WMSFullState } from '../types/wms';
import {
  computeAllProductsSummary,
  executeStockTransfer,
  ProductSlotLocationInfo,
} from '../utils/wmsEngine';
import {
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle2,
  Package,
  ArrowRight,
} from 'lucide-react';

interface TransfersAndFefoViewProps {
  state: WMSFullState;
  workstationName: string;
  onUpdateState: (nextState: WMSFullState, summary: string) => void;
}

export const TransfersAndFefoView: React.FC<TransfersAndFefoViewProps> = ({
  state,
  workstationName,
  onUpdateState,
}) => {
  const summaries = useMemo(() => computeAllProductsSummary(state), [state]);

  const [selectedProductId, setSelectedProductId] = useState<string>(
    state.products[0]?.id || ''
  );
  const [selectedSourceBatchKey, setSelectedSourceBatchKey] = useState<string>('');
  const [targetSlotId, setTargetSlotId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(50);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selectedProductSummary = useMemo(
    () => summaries.find((s) => s.product.id === selectedProductId) || summaries[0] || null,
    [summaries, selectedProductId]
  );

  const sourceLocations = useMemo(
    () => selectedProductSummary?.locations || [],
    [selectedProductSummary]
  );

  const activeSourceLoc: ProductSlotLocationInfo | null = useMemo(() => {
    if (sourceLocations.length === 0) return null;
    if (selectedSourceBatchKey) {
      const found = sourceLocations.find(
        (l) => `${l.slotId}::${l.batchId}` === selectedSourceBatchKey
      );
      if (found) return found;
    }
    return sourceLocations[0];
  }, [sourceLocations, selectedSourceBatchKey]);

  // Lista alertów: produkty wymagające uzupełnienia Strefy Kompletacji lub wydzielenia gniazda PARTNER (>12 msc)
  const replenishmentAlerts = useMemo(() => {
    return summaries.filter(
      (s) =>
        s.needsPickingReplenishment ||
        (s.hasShortBatchOnMainPicking &&
          s.product.wfirmaStockPartner > 0 &&
          s.pickingPartnerQty === 0)
    );
  }, [summaries]);

  const handleManualTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceLoc || !targetSlotId) {
      setFeedback({ type: 'err', text: 'Wybierz miejsce źródłowe i docelowe.' });
      return;
    }

    const res = executeStockTransfer(state, {
      fromSlotId: activeSourceLoc.slotId,
      batchId: activeSourceLoc.batchId,
      toSlotId: targetSlotId,
      quantity: transferQty,
      performedBy: workstationName,
      notes: transferNotes.trim() || undefined,
    });

    if (res.error) {
      setFeedback({ type: 'err', text: res.error });
      return;
    }

    const targetSlot = state.slots.find((s) => s.id === targetSlotId);
    onUpdateState(
      res.nextState,
      `Przesunięto ${transferQty} szt. ${selectedProductSummary?.product.shortName || ''} (${
        activeSourceLoc.slotCode
      } ➔ ${targetSlot?.code || ''})`
    );
    setFeedback({
      type: 'ok',
      text: `Pomyślnie przesunięto ${transferQty} szt. (LOT: ${activeSourceLoc.lotNumber}) z ${activeSourceLoc.slotCode} na ${targetSlot?.code}!`,
    });
    setTransferNotes('');
  };

  // Szybkie 1-kliknięcie uzupełnienia Strefy Kompletacji z palety FEFO
  const handleQuickReplenish = (
    productSummary: ReturnType<typeof computeAllProductsSummary>[number],
    forPartner12mSlot: boolean
  ) => {
    const candidatePallet = productSummary.locations.find(
      (l) =>
        l.slotType === 'pallet_storage' &&
        (!forPartner12mSlot || l.isPartnerEligible12m)
    );
    if (!candidatePallet) {
      setFeedback({
        type: 'err',
        text: `Brak odpowiedniej palety zapasowej dla produktu ${productSummary.product.shortName}.`,
      });
      return;
    }

    // Znajdź obecne gniazdo kompletacji tego produktu lub pierwsze wolne
    let destSlot = state.slots.find(
      (s) =>
        s.slotType === (forPartner12mSlot ? 'picking_partner_12m' : 'picking_standard') &&
        s.allocations.some((a) => a.productId === productSummary.product.id)
    );
    if (!destSlot) {
      destSlot = state.slots.find(
        (s) => s.slotType === (forPartner12mSlot ? 'picking_partner_12m' : 'picking_standard')
      );
    }
    if (!destSlot) return;

    const qtyToMove = Math.min(candidatePallet.quantity, Math.max(40, productSummary.product.minPickingStock));
    const res = executeStockTransfer(state, {
      fromSlotId: candidatePallet.slotId,
      batchId: candidatePallet.batchId,
      toSlotId: destSlot.id,
      quantity: qtyToMove,
      performedBy: workstationName,
      notes: forPartner12mSlot
        ? 'Uzupełnienie gniazda PARTNER (>12 msc) z palety FEFO'
        : 'Uzupełnienie Strefy Kompletacji z palety wg FEFO',
      dedicatedForPartnerOnly: forPartner12mSlot,
    });

    if (res.error) {
      setFeedback({ type: 'err', text: res.error });
      return;
    }

    onUpdateState(
      res.nextState,
      `Uzupełniono Strefę Kompletacji (${destSlot.code}): +${qtyToMove} szt. ${productSummary.product.shortName} z palety ${candidatePallet.slotCode}`
    );
    setFeedback({
      type: 'ok',
      text: `Przesunięto ${qtyToMove} szt. "${productSummary.product.shortName}" z palety ${candidatePallet.slotCode} na ${destSlot.code}!`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Kreator Szybkiego Przesunięcia (Z Miejsca ➔ Na Miejsce) */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="p-2 rounded-xl bg-indigo-600 text-white">
            <ArrowRightLeft className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Przesunięcia Magazynowe (Z Miejsca Paletowego ➔ Na Strefę Kompletacji / Inny Regał)
            </h2>
            <p className="text-xs text-slate-600">
              Wybierz produkt, wskaż partię źródłową (system sortuje palety wg <strong>FEFO — najkrótsza data pierwsza</strong>) oraz miejsce docelowe.
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`my-4 p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleManualTransferSubmit} className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Krok 1: Wybór produktu */}
          <div className="lg:col-span-4 space-y-2">
            <label className="block text-xs font-extrabold text-slate-800">
              1. Wybierz produkt do przesunięcia:
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setSelectedSourceBatchKey('');
              }}
              className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
            >
              {summaries.map((s) => (
                <option key={s.product.id} value={s.product.id}>
                  {s.product.shortName} — Łącznie: {s.totalPhysicalOnRacks} szt. (Kompl.:{' '}
                  {s.totalPickingQty}, Palety: {s.palletReserveQty})
                </option>
              ))}
            </select>

            {selectedProductSummary && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">
                  {selectedProductSummary.product.name}
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] font-mono text-slate-600">
                  <span>
                    Kompletacja Główna:{' '}
                    <strong className="text-emerald-700">
                      {selectedProductSummary.pickingStandardQty} szt.
                    </strong>
                  </span>
                  <span>
                    Gniazdo PARTNER (&gt;12m):{' '}
                    <strong className="text-violet-700">
                      {selectedProductSummary.pickingPartnerQty} szt.
                    </strong>
                  </span>
                  <span>
                    Palety:{' '}
                    <strong className="text-blue-700">
                      {selectedProductSummary.palletReserveQty} szt.
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Krok 2: Wybór miejsca źródłowego i partii (posortowane wg FEFO) */}
          <div className="lg:col-span-4 space-y-2">
            <label className="block text-xs font-extrabold text-slate-800">
              2. Skąd pobrać (Miejsca posortowane wg FEFO):
            </label>
            {sourceLocations.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Ten produkt nie jest obecnie zaalokowany na żadnym miejscu.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sourceLocations.map((loc, idx) => {
                  const key = `${loc.slotId}::${loc.batchId}`;
                  const isSelected = activeSourceLoc
                    ? `${activeSourceLoc.slotId}::${activeSourceLoc.batchId}` === key
                    : idx === 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedSourceBatchKey(key);
                        setTransferQty(Math.min(50, loc.quantity));
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-600 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-extrabold text-slate-900">
                            {loc.slotCode}
                          </span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 text-[9px] font-extrabold">
                              FEFO #1
                            </span>
                          )}
                          {loc.isPartnerEligible12m ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[9px] font-bold">
                              &gt;12 msc ({loc.monthsLeft}m)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-extrabold">
                              &lt;12 msc ({loc.monthsLeft}m)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                          LOT: {loc.lotNumber} • MHD: {loc.expiryDate}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-extrabold text-indigo-900">
                        {loc.quantity} szt.
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Krok 3: Miejsce docelowe i ilość */}
          <div className="lg:col-span-4 space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                3. Miejsce docelowe (Dokąd przenieść):
              </label>
              <select
                value={targetSlotId}
                onChange={(e) => setTargetSlotId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
                required
              >
                <option value="">-- Wybierz miejsce docelowe --</option>
                <optgroup label="🎯 Strefa Kompletacji Główna (KOMP-R1)">
                  {state.slots
                    .filter((s) => s.slotType === 'picking_standard')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🟣 Strefa Kompletacji PARTNER >12 msc (KOMP-PARTNER)">
                  {state.slots
                    .filter((s) => s.slotType === 'picking_partner_12m')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="📦 Miejsca Paletowe i Półkowe">
                  {state.slots
                    .filter(
                      (s) =>
                        s.slotType !== 'picking_standard' &&
                        s.slotType !== 'picking_partner_12m'
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Ilość sztuk:
                </label>
                <input
                  type="number"
                  min={1}
                  max={activeSourceLoc?.quantity || 99999}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Powód / Notatka:
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="np. Dotowarowanie kompletacji"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Przesuń towar na wybrane miejsce</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sekcja: Podpowiedzi FEFO i Zasada > 12 msc dla Partnerów */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Asystent Dotowarowania Strefy Kompletacji (FEFO &amp; Zasada &gt;12 msc dla Partnerów)
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Wykryte podpowiedzi: {replenishmentAlerts.length}
          </span>
        </div>

        {replenishmentAlerts.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Wszystkie produkty na Strefie Kompletacji mają wystarczający stan (oraz wydzielone partie &gt;12 msc tam, gdzie na głównym miejscu leży krótka data).
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {replenishmentAlerts.map((alertItem) => {
              const needsPartnerSlot =
                alertItem.hasShortBatchOnMainPicking &&
                alertItem.product.wfirmaStockPartner > 0 &&
                alertItem.pickingPartnerQty === 0;

              return (
                <div
                  key={alertItem.product.id}
                  className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        {alertItem.product.shortName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-extrabold">
                        Kompletacja: {alertItem.totalPickingQty} szt. (Min: {alertItem.product.minPickingStock})
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">
                      {needsPartnerSlot
                        ? '⚠️ Na głównym gnieździe kompletacji leży partia < 12 msc! Wydziel osobną partię > 12 msc na gniazdo PARTNER.'
                        : `Niski stan w Strefie Kompletacji. Sugerowana paleta wg FEFO: ${
                            alertItem.suggestedFefoPallet?.slotCode || 'brak'
                          } (LOT: ${alertItem.suggestedFefoPallet?.lotNumber || '-'}, MHD: ${
                            alertItem.suggestedFefoPallet?.expiryDate || '-'
                          }).`}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleQuickReplenish(alertItem, needsPartnerSlot)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>
                        Uzupełnij 1 kliknięciem z palety {alertItem.suggestedFefoPallet?.slotCode}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dziennik Operacji i Przesunięć Magazynowych */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-extrabold text-slate-900">
              Historia Przesunięć i Operacji Magazynowych ({state.movementsHistory.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <th className="py-2.5 px-3">Czas</th>
                <th className="py-2.5 px-3">Typ</th>
                <th className="py-2.5 px-3">Produkt</th>
                <th className="py-2.5 px-3">Ilość</th>
                <th className="py-2.5 px-3">Seria LOT / MHD</th>
                <th className="py-2.5 px-3">Skąd ➔ Dokąd</th>
                <th className="py-2.5 px-3">Dokument / Opis</th>
                <th className="py-2.5 px-3">Stanowisko</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.movementsHistory.slice(0, 40).map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                    {new Date(mov.timestamp).toLocaleString('pl-PL')}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-extrabold ${
                        mov.type === 'MOVE'
                          ? 'bg-indigo-100 text-indigo-900'
                          : mov.type === 'WZ' || mov.type === 'RW'
                          ? 'bg-rose-100 text-rose-900'
                          : mov.type === 'PZ' || mov.type === 'PW'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {mov.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{mov.productName}</td>
                  <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900">
                    {mov.quantity > 0 ? `${mov.quantity} szt.` : '-'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                    {mov.lotNumber} ({mov.expiryDate})
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">
                    {mov.fromSlotCode && mov.toSlotCode
                      ? `${mov.fromSlotCode} ➔ ${mov.toSlotCode}`
                      : mov.fromSlotCode
                      ? `Z: ${mov.fromSlotCode}`
                      : mov.toSlotCode
                      ? `Na: ${mov.toSlotCode}`
                      : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {mov.referenceDoc ? <strong>{mov.referenceDoc}: </strong> : null}
                    {mov.notes}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{mov.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
