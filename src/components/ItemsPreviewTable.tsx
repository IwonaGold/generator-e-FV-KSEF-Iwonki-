import React from 'react';
import { InvoiceItem, LogisticsFormat, VatRate } from '../types/ksef';
import { formatGS1CompositeString } from '../utils/ksefGenerator';
import { PriceComparisonItem } from '../types/priceList';
import { Plus, Trash2, AlertTriangle, Sparkles, Check, Hash, Calendar, Barcode, ArrowRightLeft, FileCode, BookmarkPlus } from 'lucide-react';

interface ItemsPreviewTableProps {
  items: InvoiceItem[];
  logisticsFormat: LogisticsFormat;
  onUpdateItem: (id: string, updatedFields: Partial<InvoiceItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: () => void;
  onQuickFillBatches: () => void;
  onClearBatches?: () => void;
  onToggleLogisticsFormat?: (format: LogisticsFormat) => void;
  priceComparisons?: Map<string, PriceComparisonItem>;
  isVerificationEnabled?: boolean;
  onApplySinglePrice?: (itemId: string, newPrice: number) => void;
  onOpenXmlModal?: () => void;
  onSaveToHistory?: () => void;
}

export const ItemsPreviewTable: React.FC<ItemsPreviewTableProps> = ({
  items,
  logisticsFormat,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onQuickFillBatches,
  onClearBatches,
  onToggleLogisticsFormat,
  priceComparisons,
  isVerificationEnabled,
  onApplySinglePrice,
  onOpenXmlModal,
  onSaveToHistory,
}) => {
  // Obliczenia finansowe zgodne w 100% z ustawą o VAT i KSeF FA(3)
  const calculateTotals = () => {
    const vatBreakdown: Record<string, { net: number; vat: number }> = {
      '8%': { net: 0, vat: 0 },
      '23%': { net: 0, vat: 0 },
      '5%': { net: 0, vat: 0 },
      '0%': { net: 0, vat: 0 },
      zw: { net: 0, vat: 0 },
    };

    items.forEach((item) => {
      const lineNet = Math.round(item.quantity * item.netPrice * 100) / 100;
      if (vatBreakdown[item.vatRate]) {
        vatBreakdown[item.vatRate].net += lineNet;
      }
    });

    // Zaokrąglenie sum netto per stawka do 2 miejsc po przecinku
    Object.keys(vatBreakdown).forEach((rate) => {
      vatBreakdown[rate].net = Math.round(vatBreakdown[rate].net * 100) / 100;
    });

    // Wyliczenie kwot podatku od sumy wartości sprzedaży netto poszczególnych stawek (art. 106e ust. 1 pkt 14 ustawy o VAT)
    vatBreakdown['23%'].vat = Math.round(vatBreakdown['23%'].net * 0.23 * 100) / 100;
    vatBreakdown['8%'].vat = Math.round(vatBreakdown['8%'].net * 0.08 * 100) / 100;
    vatBreakdown['5%'].vat = Math.round(vatBreakdown['5%'].net * 0.05 * 100) / 100;
    vatBreakdown['0%'].vat = 0;
    vatBreakdown['zw'].vat = 0;

    const net = Math.round(
      (vatBreakdown['23%'].net +
        vatBreakdown['8%'].net +
        vatBreakdown['5%'].net +
        vatBreakdown['0%'].net +
        vatBreakdown['zw'].net) *
        100
    ) / 100;

    const vat = Math.round(
      (vatBreakdown['23%'].vat + vatBreakdown['8%'].vat + vatBreakdown['5%'].vat) * 100
    ) / 100;

    const gross = Math.round((net + vat) * 100) / 100;

    return { net, vat, gross, vatBreakdown };
  };

  const totals = calculateTotals();

  return (
    <div className="bg-white/95 border border-fuchsia-200/80 rounded-2xl shadow-xs overflow-hidden mb-6">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b border-fuchsia-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-fuchsia-50/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shadow-2xs">
              5
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Pozycje Towarowe i Podsumowanie E-Faktury</span>
                <span className="text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100/80 px-2 py-0.5 rounded-full border border-fuchsia-200">
                  Krok 5 🌸
                </span>
                <span className="text-xs text-fuchsia-700 font-mono font-medium">
                  ({items.length} {items.length === 1 ? 'pozycja' : 'pozycji'})
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Zawiera kody GTIN, stawki VAT oraz edycję serii i daty ważności wg wybranej wersji zapisu
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleLogisticsFormat && (
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-fuchsia-200 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => onToggleLogisticsFormat('gs1_composite')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  logisticsFormat === 'gs1_composite'
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-fuchsia-700'
                }`}
                title="Format GS1 z kluczem NumerSeriiDataPrzydatnosciIlosc"
              >
                GS1 🌸
              </button>
              <button
                type="button"
                onClick={() => onToggleLogisticsFormat('separate_fields')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  logisticsFormat === 'separate_fields'
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-fuchsia-700'
                }`}
                title="Osobne pola Seria oraz Data ważności"
              >
                Osobne pola
              </button>
              <button
                type="button"
                onClick={() => onToggleLogisticsFormat('none')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  logisticsFormat === 'none'
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-fuchsia-700'
                }`}
                title="Faktura standardowa bez serii i dat ważności"
              >
                Bez serii i dat
              </button>
            </div>
          )}

          {onClearBatches && (
            <button
              onClick={onClearBatches}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Wyczyść serie i daty ważności ze wszystkich pozycji"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Wyczyść serie/daty</span>
            </button>
          )}

          {logisticsFormat !== 'none' && (
            <button
              onClick={onQuickFillBatches}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Automatycznie wygeneruj przykładowe serie dla brakujących pozycji"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Uzupełnij brakujące serie</span>
            </button>
          )}

          <button
            onClick={onAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Dodaj pozycję</span>
          </button>
        </div>
      </div>

      {/* Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-3 w-10 text-center">Lp.</th>
              <th className="py-2.5 px-3 min-w-[200px]">Nazwa towaru lub usługi</th>
              <th className="py-2.5 px-3 min-w-[130px]">
                <div className="flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-slate-500" />
                  <span>GTIN</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[140px] bg-emerald-50/70 text-emerald-900 border-x border-emerald-100">
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-emerald-700" />
                  <span>Nr Serii (LOT)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[130px] bg-emerald-50/70 text-emerald-900 border-r border-emerald-100">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-700" />
                  <span>Data Ważności (MHD)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[190px] text-slate-700 bg-slate-50">
                Format KSeF ({logisticsFormat === 'gs1_composite' ? 'Ciąg GS1' : logisticsFormat === 'separate_fields' ? 'Osobne pola' : 'Bez serii/dat'})
              </th>
              <th className="py-2.5 px-3 w-16 text-right">Ilość</th>
              <th className="py-2.5 px-3 w-16 text-center">Miara</th>
              <th className="py-2.5 px-3 w-24 text-right">Cena Netto</th>
              <th className="py-2.5 px-3 w-16 text-center">Stawka</th>
              <th className="py-2.5 px-3 w-24 text-right">Wartość Netto</th>
              <th className="py-2.5 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {items.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500">
                  <p className="text-sm font-medium text-slate-700">Brak pozycji na fakturze</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Wczytaj specyfikację lub kliknij przycisk „Załaduj wzorzec z faktury KSeF” u góry.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const lineNet = Math.round(item.quantity * item.netPrice * 100) / 100;
                const hasBatchMissing = logisticsFormat !== 'none' && (!item.batchNumber || item.batchNumber.trim() === '');
                const hasExpMissing = logisticsFormat !== 'none' && (!item.expiryDate || item.expiryDate.trim() === '');
                const batchQty = item.quantityInBatch || item.quantity;

                // Preview format based on active version
                const gs1StringPreview = formatGS1CompositeString(
                  item.batchNumber,
                  item.expiryDate,
                  batchQty
                );

                const comparison = priceComparisons?.get(item.id);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Index */}
                    <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] tabular-nums">
                      {index + 1}
                    </td>

                    {/* Product Name */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                        className="w-full font-medium text-slate-900 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-1.5 py-0.5 text-xs transition-colors"
                        placeholder="Nazwa leku / suplementu"
                      />
                    </td>

                    {/* GTIN Field */}
                    <td className="py-3 px-3 font-mono">
                      <input
                        type="text"
                        value={item.gtin}
                        maxLength={14}
                        onChange={(e) => onUpdateItem(item.id, { gtin: e.target.value })}
                        className="w-full font-mono text-slate-800 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-1 py-0.5 text-xs"
                        placeholder="np. 9120117912773"
                      />
                    </td>

                    {/* Batch / Lot */}
                    <td className="py-3 px-3 bg-emerald-50/30 border-x border-emerald-100">
                      <div className="relative">
                        <input
                          type="text"
                          value={item.batchNumber}
                          onChange={(e) =>
                            onUpdateItem(item.id, { batchNumber: e.target.value.toUpperCase() })
                          }
                          placeholder={logisticsFormat === 'none' ? 'Opcjonalnie' : 'np. 24E1938'}
                          className={`w-full font-mono text-xs font-semibold px-2 py-1 rounded border transition-colors ${
                            hasBatchMissing
                              ? 'bg-amber-50 border-amber-300 text-amber-900 placeholder:text-amber-400'
                              : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
                          }`}
                        />
                        {item.ocrMatched && (
                          <span
                            className="absolute right-2 top-1.5 text-[10px] text-emerald-600 font-medium flex items-center gap-0.5"
                            title="Dopasowano przez OCR"
                          >
                            <Check className="w-3 h-3" />
                            <span>OCR</span>
                          </span>
                        )}
                        {hasBatchMissing && (
                          <span className="absolute right-2 top-1.5 text-amber-500" title="Brak serii">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3 px-3 bg-emerald-50/30 border-r border-emerald-100">
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => onUpdateItem(item.id, { expiryDate: e.target.value })}
                        className={`w-full font-mono text-xs px-2 py-1 rounded border transition-colors ${
                          hasExpMissing
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </td>

                    {/* Live KSeF XML Payload Preview */}
                    <td className="py-3 px-3 bg-slate-50/60 font-mono text-[10px]">
                      {logisticsFormat === 'none' ? (
                        <div className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-1 rounded text-center truncate max-w-[210px]">
                          — (Standard KSeF)
                        </div>
                      ) : logisticsFormat === 'gs1_composite' ? (
                        <div
                          className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded select-all truncate max-w-[210px]"
                          title={`Klucz: NumerSeriiDataPrzydatnosciIlosc\nWartość: ${gs1StringPreview}`}
                        >
                          {gs1StringPreview || '—'}
                        </div>
                      ) : (
                        <div
                          className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded select-all truncate max-w-[210px]"
                          title={`Data ważności: ${item.expiryDate || 'BRAK'}\nSeria: ${item.batchNumber || 'BRAK'}`}
                        >
                          Data ważności: {item.expiryDate || '—'} · Seria: {item.batchNumber || '—'}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateItem(item.id, {
                            quantity: Math.max(1, parseInt(e.target.value) || 1),
                            quantityInBatch: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-14 text-right font-mono text-xs bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-1 py-0.5 tabular-nums"
                      />
                    </td>

                    {/* Unit (Miara) */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="text"
                        value={item.unit || 'SZT.'}
                        onChange={(e) => onUpdateItem(item.id, { unit: e.target.value })}
                        className="w-12 text-center text-xs font-mono uppercase bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 rounded px-1 py-0.5"
                      />
                    </td>

                    {/* Net Unit Price */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.netPrice}
                          onChange={(e) =>
                            onUpdateItem(item.id, { netPrice: parseFloat(e.target.value) || 0 })
                          }
                          className={`w-20 text-right font-mono text-xs bg-transparent hover:bg-white focus:bg-white border rounded px-1 py-0.5 tabular-nums transition-colors ${
                            isVerificationEnabled && comparison?.status === 'discrepancy'
                              ? 'border-amber-400 bg-amber-50/70 text-amber-950 font-bold focus:border-amber-600'
                              : isVerificationEnabled && comparison?.status === 'match'
                              ? 'border-emerald-300 text-emerald-950'
                              : 'border-transparent hover:border-slate-300 focus:border-emerald-600'
                          }`}
                        />
                        {isVerificationEnabled && comparison && (
                          <div className="mt-1 flex flex-col items-end">
                            {comparison.status === 'match' && (
                              <span
                                className="text-[10px] text-emerald-700 font-mono flex items-center gap-0.5"
                                title="Cena zgodna z cennikiem netto po rabacie"
                              >
                                <Check className="w-2.5 h-2.5" />
                                <span>Cennik: OK</span>
                              </span>
                            )}
                            {comparison.status === 'discrepancy' && comparison.priceListPrice !== null && (
                              <div className="flex flex-col items-end gap-0.5">
                                <span
                                  className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 whitespace-nowrap"
                                  title={`Cena w cenniku: ${comparison.priceListPrice.toFixed(2)} zł (różnica: ${
                                    comparison.difference! > 0 ? `+${comparison.difference!.toFixed(2)}` : comparison.difference!.toFixed(2)
                                  } zł)`}
                                >
                                  Cennik: {comparison.priceListPrice.toFixed(2)} zł
                                </span>
                                {onApplySinglePrice && (
                                  <button
                                    type="button"
                                    onClick={() => onApplySinglePrice(item.id, comparison.priceListPrice!)}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                                    title="Zastosuj cenę z cennika po rabacie"
                                  >
                                    Użyj {comparison.priceListPrice.toFixed(2)} zł
                                  </button>
                                )}
                              </div>
                            )}
                            {comparison.status === 'not_found' && (
                              <span className="text-[10px] text-slate-400 font-mono">Brak w XLSX</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* VAT Rate */}
                    <td className="py-3 px-3 text-center">
                      <select
                        value={item.vatRate}
                        onChange={(e) => onUpdateItem(item.id, { vatRate: e.target.value as VatRate })}
                        className="font-mono text-xs text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 rounded px-1 py-0.5"
                      >
                        <option value="8%">8%</option>
                        <option value="23%">23%</option>
                        <option value="5%">5%</option>
                        <option value="0%">0%</option>
                        <option value="zw">zw.</option>
                      </select>
                    </td>

                    {/* Net Total */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {lineNet.toFixed(2)} zł
                    </td>

                    {/* Delete Action */}
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-all cursor-pointer"
                        title="Usuń pozycję"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Podsumowanie stawek podatku (Układ identyczny jak na wydruku urzędowym KSeF) */}
      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-900 block mb-1.5 uppercase tracking-wide">
              Podsumowanie stawek podatku:
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-500 mr-2">Stawka 8%:</span>
                <span className="text-slate-800 font-semibold">{totals.vatBreakdown['8%'].net.toFixed(2)} netto</span>
                <span className="text-slate-400 mx-1.5">|</span>
                <span className="text-slate-800 font-semibold">{totals.vatBreakdown['8%'].vat.toFixed(2)} VAT</span>
              </div>
              {totals.vatBreakdown['23%'].net > 0 && (
                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 mr-2">Stawka 23%:</span>
                  <span className="text-slate-800 font-semibold">{totals.vatBreakdown['23%'].net.toFixed(2)} netto</span>
                  <span className="text-slate-400 mx-1.5">|</span>
                  <span className="text-slate-800 font-semibold">{totals.vatBreakdown['23%'].vat.toFixed(2)} VAT</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 self-end lg:self-auto">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Kwota netto</span>
              <span className="text-sm font-mono font-semibold text-slate-800 tabular-nums">
                {totals.net.toFixed(2)} PLN
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Kwota podatku</span>
              <span className="text-sm font-mono font-semibold text-slate-800 tabular-nums">
                {totals.vat.toFixed(2)} PLN
              </span>
            </div>
            <div className="text-right pl-5 border-l border-slate-300">
              <span className="text-xs font-bold text-emerald-800 block">Kwota należności ogółem</span>
              <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                {totals.gross.toFixed(2)} PLN
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pasek akcji generowania XML i zapisu do historii (Krok 5) */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-fuchsia-50/70 via-pink-50/40 to-white border-t border-fuchsia-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          <span className="font-bold text-slate-900">Status faktury:</span> Gotowa do wygenerowania oficjalnego pliku XML FA(3) do KSeF ({items.length} pozycji).
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSaveToHistory && (
            <button
              type="button"
              onClick={onSaveToHistory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-fuchsia-800 bg-fuchsia-100 hover:bg-fuchsia-200 border border-fuchsia-300 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Zapisz to zamówienie i wygenerowaną fakturę w Historii Zamówień Sieciowych"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-fuchsia-600" />
              <span>💾 Zapisz w historii</span>
            </button>
          )}
          {onOpenXmlModal && (
            <button
              type="button"
              onClick={onOpenXmlModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 rounded-xl shadow-xs shadow-fuchsia-200 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileCode className="w-4 h-4" />
              <span>🌸 Podgląd i Pobranie XML</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
