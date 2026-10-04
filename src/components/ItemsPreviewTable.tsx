import React from 'react';
import { InvoiceItem, LogisticsFormat, VatRate } from '../types/ksef';
import { formatGS1CompositeString } from '../utils/ksefGenerator';
import { PriceComparisonItem } from '../types/priceList';
import { evaluateShelfLife, getRequiredShelfLifeRule } from '../utils/expiryDateValidator';
import { Plus, Trash2, AlertTriangle, Sparkles, Check, Hash, Calendar, Barcode, ArrowRightLeft, FileCode, BookmarkPlus, Clock, FileText } from 'lucide-react';

interface ItemsPreviewTableProps {
  items: InvoiceItem[];
  logisticsFormat: LogisticsFormat;
  selectedChain?: string;
  buyerName?: string;
  buyerNip?: string;
  onUpdateItem: (id: string, updatedFields: Partial<InvoiceItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: () => void;
  onQuickFillBatches: () => void;
  onClearBatches?: () => void;
  onToggleLogisticsFormat?: (format: LogisticsFormat) => void;
  priceComparisons?: Map<string, PriceComparisonItem>;
  isVerificationEnabled?: boolean;
  onApplySinglePrice?: (itemId: string, newPrice: number) => void;
  onApplySingleGtin?: (itemId: string, newGtin: string) => void;
  onOpenXmlModal?: () => void;
  onOpenWzModal?: () => void;
  onSaveToHistory?: (navigateToInProgress?: boolean) => void;
  onSaveOrderWithMode?: (
    mode: 'with_fv_xml' | 'complete_later' | 'without_fv',
    navigateToInProgress?: boolean
  ) => void;
  viewMode?: 'new_order' | 'invoice_only';
}

export const ItemsPreviewTable: React.FC<ItemsPreviewTableProps> = ({
  items,
  logisticsFormat,
  selectedChain,
  buyerName,
  buyerNip,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onQuickFillBatches,
  onClearBatches,
  onToggleLogisticsFormat,
  priceComparisons,
  isVerificationEnabled,
  onApplySinglePrice,
  onApplySingleGtin,
  onOpenXmlModal,
  onOpenWzModal,
  onSaveToHistory,
  onSaveOrderWithMode,
  viewMode = 'invoice_only',
}) => {
  const shelfLifeRule = getRequiredShelfLifeRule(selectedChain, buyerName, buyerNip);

  // Weryfikacja dat ważności pod kątem wymogu odbiorcy (np. Dr. Max > 6 msc, DOZ / Super-Pharm min. 12 msc, Modum min. 13 msc)
  const shelfLifeWarnings = items.filter((it) => {
    if (!it.expiryDate) return false;
    const res = evaluateShelfLife(it.expiryDate, new Date(), shelfLifeRule.minMonths);
    return res.status === 'short_warning' || res.status === 'expired';
  });

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
    <div className="bg-white/95 border-2 border-slate-600 rounded-2xl shadow-md overflow-hidden mb-6">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b-2 border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-fuchsia-50/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shadow-2xs">
              5
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>
                  {viewMode === 'new_order'
                    ? 'Pozycje Towarowe i Podsumowanie Zamówienia'
                    : 'Pozycje Towarowe i Podsumowanie E-Faktury'}
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
                GS1
              </button>
              <button
                type="button"
                onClick={() => onToggleLogisticsFormat('separate_fields')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  logisticsFormat === 'separate_fields'
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-fuchsia-700'
                }`}
                title="Osobne wiersze w <DodatkowyOpis>: Data ważności oraz Seria (wymagane m.in. przez Super-Pharm)"
              >
                Osobne wiersze (Data + Seria)
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

      {/* PODPOWIEDŹ DLA SUPER-PHARM: WYMAGANE DATY WAŻNOŚCI W OSOBNYCH WIERSZACH */}
      {(selectedChain === 'Super-Pharm' ||
        (buyerNip || '').replace(/\D/g, '') === '5213842837' ||
        (buyerName || '').toLowerCase().includes('super-pharm') ||
        (buyerName || '').toLowerCase().includes('super pharm')) && (
        <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-blue-900">
                Wymóg Super-Pharm: Daty ważności (MHD) oraz serie (LOT) w osobnych wierszach!
              </span>{' '}
              <span className="text-[11px] text-blue-800">
                W pliku KSeF XML dla każdej pozycji generowane są 2 osobne wiersze <code>&lt;DodatkowyOpis&gt;</code>: wiersz <strong>Data ważności</strong> oraz wiersz <strong>Seria</strong>.
              </span>
            </div>
          </div>
          {logisticsFormat !== 'separate_fields' && onToggleLogisticsFormat ? (
            <button
              type="button"
              onClick={() => onToggleLogisticsFormat('separate_fields')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors shrink-0"
            >
              Włącz: Osobne wiersze (Data + Seria)
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
              ✓ Aktywny tryb: Osobne wiersze
            </span>
          )}
        </div>
      )}

      {/* ALERT KRÓTKICH DAT WAŻNOŚCI (WG WYMOGU ODBIORCY: DR. MAX > 6 MSC, DOZ/SUPER-PHARM MIN. 12 MSC, MODUM MIN. 13 MSC) */}
      {shelfLifeWarnings.length > 0 && (
        <div className="mx-4 sm:mx-5 my-3 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-amber-900">
                ⚠️ Uwaga logistyczna ({shelfLifeRule.chainLabel}): Wykryto {shelfLifeWarnings.length}{' '}
                {shelfLifeWarnings.length === 1 ? 'pozycję' : 'pozycji'} z terminem ważności krótszym niż {shelfLifeRule.minMonths} miesięcy!
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                Wymóg {shelfLifeRule.chainLabel}: min. {shelfLifeRule.minMonths} msc
              </span>
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              {shelfLifeRule.ruleDescription} Sprawdź pozycje oznaczone poniżej czerwoną lub żółtą etykietą.
            </p>
          </div>
        </div>
      )}

      {/* Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-3 w-10 text-center">Lp.</th>
              <th className="py-2.5 px-3 min-w-[200px]">Nazwa towaru lub usługi</th>
              <th className="py-2.5 px-3 min-w-[140px]">
                <div className="flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-slate-500" />
                  <span>GTIN (EAN)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[140px] bg-emerald-50/70 text-emerald-900 border-x border-emerald-100">
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-emerald-700" />
                  <span>Nr Serii (LOT)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[140px] bg-emerald-50/70 text-emerald-900 border-r border-emerald-100">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-700" />
                  <span>Data Ważności (MHD)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[190px] text-slate-700 bg-slate-50">
                Format KSeF ({logisticsFormat === 'gs1_composite' ? 'Ciąg GS1' : logisticsFormat === 'separate_fields' ? 'Osobne wiersze' : 'Bez serii/dat'})
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
                const shelfLife = evaluateShelfLife(item.expiryDate, new Date(), shelfLifeRule.minMonths);

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

                    {/* GTIN / EAN Field (Z WERYFIKACJĄ Z CENNIKIEM) */}
                    <td className="py-3 px-3 font-mono">
                      <input
                        type="text"
                        value={item.gtin}
                        maxLength={14}
                        onChange={(e) => onUpdateItem(item.id, { gtin: e.target.value })}
                        className={`w-full font-mono text-xs rounded px-1.5 py-0.5 transition-colors ${
                          isVerificationEnabled && comparison?.gtinStatus === 'discrepancy'
                            ? 'border-amber-400 bg-amber-50/70 text-amber-950 font-bold focus:border-amber-600'
                            : isVerificationEnabled && comparison?.gtinStatus === 'match'
                            ? 'border-emerald-300 text-emerald-950 bg-emerald-50/30'
                            : 'bg-transparent hover:bg-white focus:bg-white border-transparent hover:border-slate-300 focus:border-emerald-600 text-slate-800'
                        }`}
                        placeholder="np. 9120117912773"
                      />
                      {isVerificationEnabled && comparison && (
                        <div className="mt-1 flex flex-col items-start gap-0.5">
                          {comparison.gtinStatus === 'match' && (
                            <span
                              className="text-[10px] text-emerald-700 font-mono flex items-center gap-0.5"
                              title={`Kod EAN zgodny z cennikiem (${comparison.priceListGtin})`}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span>EAN: OK</span>
                            </span>
                          )}
                          {comparison.gtinStatus === 'discrepancy' && comparison.priceListGtin && (
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-300 whitespace-nowrap"
                                title={`W zamówieniu: ${item.gtin || 'Brak'} | W cenniku: ${comparison.priceListGtin}`}
                              >
                                Cennik: {comparison.priceListGtin}
                              </span>
                              {onApplySingleGtin && (
                                <button
                                  type="button"
                                  onClick={() => onApplySingleGtin(item.id, comparison.priceListGtin!)}
                                  className="text-[9px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                  title="Wstaw kod EAN z cennika"
                                >
                                  ⚡ Wstaw EAN
                                </button>
                              )}
                            </div>
                          )}
                          {comparison.gtinStatus === 'missing_in_order' && comparison.priceListGtin && (
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 whitespace-nowrap"
                                title={`Brak EAN w zamówieniu. W cenniku: ${comparison.priceListGtin}`}
                              >
                                Brak EAN ({comparison.priceListGtin})
                              </span>
                              {onApplySingleGtin && (
                                <button
                                  type="button"
                                  onClick={() => onApplySingleGtin(item.id, comparison.priceListGtin!)}
                                  className="text-[9px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                  title="Wstaw kod EAN z cennika"
                                >
                                  ⚡ Wstaw EAN
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
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

                    {/* Expiry Date (Z WERYFIKACJĄ MINIMUM 12 MIESIĘCY) */}
                    <td className="py-3 px-3 bg-emerald-50/30 border-r border-emerald-100">
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => onUpdateItem(item.id, { expiryDate: e.target.value })}
                        className={`w-full font-mono text-xs px-2 py-1 rounded border transition-colors ${
                          hasExpMissing
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : shelfLife.status === 'short_warning'
                            ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-semibold'
                            : shelfLife.status === 'expired'
                            ? 'bg-red-50 border-red-400 text-red-950 font-bold'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                      {item.expiryDate && (
                        <div className="mt-1">
                          {shelfLife.status === 'valid' && (
                            <span
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-0.5"
                              title={shelfLife.warningMessage}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{shelfLife.formattedMonths} (OK)</span>
                            </span>
                          )}
                          {shelfLife.status === 'short_warning' && (
                            <span
                              className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-400 inline-flex items-center gap-0.5 shadow-2xs"
                              title={shelfLife.warningMessage}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                              <span>&lt; {shelfLife.requiredMonths} msc ({shelfLife.formattedMonths})</span>
                            </span>
                          )}
                          {shelfLife.status === 'expired' && (
                            <span
                              className="text-[10px] font-bold text-red-800 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 inline-flex items-center gap-0.5"
                              title={shelfLife.warningMessage}
                            >
                              <span>🚨 Przeterminowany!</span>
                            </span>
                          )}
                        </div>
                      )}
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
                          className="bg-blue-50/70 text-blue-950 border border-blue-200 px-2 py-1 rounded select-all max-w-[215px] flex flex-col gap-0.5 leading-tight"
                          title={`Wiersz 1 (<DodatkowyOpis>): Data ważności = ${item.expiryDate || 'BRAK'}\nWiersz 2 (<DodatkowyOpis>): Seria = ${item.batchNumber || 'BRAK'}`}
                        >
                          <div className="truncate">
                            <span className="font-bold text-blue-800">Data ważności:</span>{' '}
                            {item.expiryDate || <span className="text-amber-700 font-bold">BRAK</span>}
                          </div>
                          <div className="truncate border-t border-blue-100 pt-0.5">
                            <span className="font-bold text-blue-800">Seria:</span>{' '}
                            {item.batchNumber || <span className="text-amber-700 font-bold">BRAK</span>}
                          </div>
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

      {viewMode === 'new_order' ? (
        /* Pasek wyboru trybu zapisu zamówienia (wszystkie 3 opcje trafiają do folderu W REALIZACJI) + Wygeneruj WZ */
        <div className="p-4 sm:p-5 bg-gradient-to-r from-fuchsia-50/70 via-pink-50/40 to-amber-50/40 border-t-2 border-slate-500 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              <span className="font-black text-slate-900 text-sm">
                Wybierz sposób zapisu zamówienia ({items.length} poz.):
              </span>{' '}
              Każda opcja zapisuje zamówienie w folderze{' '}
              <strong className="text-amber-800">„W REALIZACJI”</strong>, aby uzupełnić list przewozowy, śledzić status przesyłki i po zaznaczeniu{' '}
              <strong className="text-emerald-800">„Towar dotarł do klienta”</strong> przenieść do ZAKOŃCZONE.
            </div>
            {onOpenXmlModal && (
              <button
                type="button"
                onClick={onOpenXmlModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-fuchsia-800 bg-white hover:bg-fuchsia-50 border border-fuchsia-300 rounded-xl shadow-2xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                title="Otwórz sam podgląd wygenerowanego pliku XML FA(3)"
              >
                <FileCode className="w-3.5 h-3.5 text-fuchsia-600" />
                <span>Podgląd XML FA(3)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* OPCJA 1: Zapisz z wystawieniem FV XML */}
            <button
              type="button"
              onClick={() => {
                if (onSaveOrderWithMode) {
                  onSaveOrderWithMode('with_fv_xml');
                } else if (onSaveToHistory) {
                  onSaveToHistory(false);
                }
              }}
              className="text-left p-3.5 rounded-2xl bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white border-2 border-fuchsia-900 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black tracking-tight">
                    <FileCode className="w-4 h-4 shrink-0" />
                    <span>1. Zapisz z wystawieniem FV XML</span>
                  </span>
                </div>
                <p className="text-[11px] text-pink-100 leading-snug">
                  Generuje e-Fakturę KSeF FA(3) XML, otwiera pobranie pliku XML i zapisuje zamówienie w folderze <strong>W REALIZACJI</strong> (do listu przewozowego).
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between text-[10px] font-bold text-white/90">
                <span>🧾 Faktura XML FA(3) + W REALIZACJI</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </button>

            {/* OPCJA 2: Zapisz i uzupełnij zamówienie później */}
            <button
              type="button"
              onClick={() => {
                if (onSaveOrderWithMode) {
                  onSaveOrderWithMode('complete_later', true);
                }
              }}
              className="text-left p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/70 to-white hover:from-amber-100/90 hover:to-orange-50 border-2 border-amber-500 hover:border-amber-700 text-slate-900 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-950 tracking-tight">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>2. Zapisz i uzupełnij zamówienie później</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Pakowanie, zdjęcia opakowań (LOT/MHD), uzupełnienie danych do FV i wystawienie FV odbędzie się później — z poziomu <strong>W REALIZACJI</strong> wrócisz do tej karty zamówienia.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex items-center justify-between text-[10px] font-bold text-amber-900">
                <span>⏳ Wrócisz do karty z „W REALIZACJI”</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </button>

            {/* OPCJA 3: Zapisz bez wystawiania FV */}
            <button
              type="button"
              onClick={() => {
                if (onSaveOrderWithMode) {
                  onSaveOrderWithMode('without_fv', true);
                }
              }}
              className="text-left p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50/60 to-white hover:from-sky-100/80 hover:to-cyan-50 border-2 border-sky-500 hover:border-sky-700 text-slate-900 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-sky-950 tracking-tight">
                    <BookmarkPlus className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>3. Zapisz bez wystawiania FV</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Zapisuje zamówienie w folderze <strong>W REALIZACJI</strong> bez generowania FV XML — z opcją wpisania numeru dokumentu ręcznie z poziomu <strong>W REALIZACJI</strong>.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-sky-200/80 flex items-center justify-between text-[10px] font-bold text-sky-900">
                <span>📝 Ręczny nr dokumentu w „W REALIZACJI”</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </button>

            {/* PRZYCISK 4: Wygeneruj WZ */}
            {onOpenWzModal && (
              <button
                type="button"
                onClick={onOpenWzModal}
                className="text-left p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50/60 to-white hover:from-indigo-100/80 hover:to-violet-50 border-2 border-indigo-500 hover:border-indigo-700 text-slate-900 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-indigo-950 tracking-tight">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>📄 Wygeneruj WZ</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Generuje i pozwala wydrukować dokument magazynowy <strong>WZ (Wydanie Zewnętrzne)</strong> z seriami i datami ważności do paczki / dla kierowcy.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-indigo-200/80 flex items-center justify-between text-[10px] font-bold text-indigo-900">
                  <span>🖨️ Podgląd i druk dokumentu WZ</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Pasek akcji głównych w trybie "1. Wygeneruj Fakturę XML" — te same opcje co w "2. Wygeneruj Korektę Faktury XML" */
        <div className="p-4 sm:p-5 bg-white border-t-2 border-slate-500 flex flex-wrap items-center justify-end gap-3">
          {onSaveToHistory && (
            <button
              type="button"
              onClick={() => onSaveToHistory(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fuchsia-800 bg-fuchsia-100 hover:bg-fuchsia-200 border border-fuchsia-300 rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.01]"
            >
              <span>💾 Zapisz w Historii Zamówień</span>
            </button>
          )}

          {onOpenXmlModal && (
            <button
              type="button"
              onClick={onOpenXmlModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-700 hover:to-pink-700 rounded-xl shadow-sm shadow-fuchsia-300 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileCode className="w-4 h-4" />
              <span>Generuj KSeF XML Faktury (FA3 UTF-8)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
