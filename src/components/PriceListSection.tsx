import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  Download,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  ClipboardPaste,
  ArrowRight,
  Barcode,
  BookOpen,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PriceListItem,
  PriceListAuditSummary,
  PriceComparisonItem,
  RawSheetInfo,
  ColumnMapping,
} from '../types/priceList';
import {
  SAMPLE_XLSX_PRICE_LIST,
  generateSamplePriceListXlsxBlob,
  extractItemsFromGrid,
  inspectAndParseWorkbook,
  parsePastedExcelText,
  detectColumnMapping,
  isPlaceholderOrEmptyGtin,
} from '../utils/priceListParser';

interface PriceListSectionProps {
  priceList: PriceListItem[] | null;
  priceListFileName: string | null;
  onPriceListLoaded: (fileName: string, items: PriceListItem[]) => void;
  onClearPriceList: () => void;
  auditSummary: PriceListAuditSummary | null;
  comparisons?: Map<string, PriceComparisonItem>;
  isVerificationEnabled: boolean;
  onToggleVerification: (enabled: boolean) => void;
  onApplyPriceListDiscrepancies: () => void;
  onApplyPriceListGtins?: () => void;
  onApplyAllFromPriceList?: () => void;
  onApplySinglePrice?: (itemId: string, newPrice: number) => void;
  onApplySingleGtin?: (itemId: string, newGtin: string) => void;
  onApplySingleBoth?: (
    itemId: string,
    newPrice?: number | null,
    newGtin?: string | null
  ) => void;
  priceListSource?: 'knowledge_auto' | 'manual_xlsx';
  activeKnowledgePriceListType?: 'DOZ_SPECIAL' | 'Q3_STANDARD';
  matchedRecipientLabel?: string;
  onSwitchKnowledgePriceList?: (type: 'DOZ_SPECIAL' | 'Q3_STANDARD' | 'AUTO') => void;
}

export const PriceListSection: React.FC<PriceListSectionProps> = ({
  priceList,
  priceListFileName,
  onPriceListLoaded,
  onClearPriceList,
  auditSummary,
  comparisons,
  isVerificationEnabled,
  onToggleVerification,
  onApplyPriceListDiscrepancies,
  onApplyPriceListGtins,
  onApplyAllFromPriceList,
  onApplySinglePrice,
  onApplySingleGtin,
  onApplySingleBoth,
  priceListSource = 'knowledge_auto',
  activeKnowledgePriceListType = 'Q3_STANDARD',
  matchedRecipientLabel = 'Wszystkie sieci (Q3)',
  onSwitchKnowledgePriceList,
}) => {
  const [showCustomUploadPanel, setShowCustomUploadPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Raw sheet inspection info for manual column mapping
  const [rawSheetInfo, setRawSheetInfo] = useState<RawSheetInfo | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [customMapping, setCustomMapping] = useState<ColumnMapping>({
    gtinColIndex: -1,
    nameColIndex: -1,
    discountedNetColIndex: -1,
    baseNetColIndex: -1,
    discountPercentColIndex: -1,
  });
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);
  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer | null>(null);

  // Paste text state
  const [pastedText, setPastedText] = useState('');

  // Search in price list modal
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      setCurrentBuffer(buffer);

      const { rawSheetInfo: info, items } = await inspectAndParseWorkbook(buffer, file.name);
      setRawSheetInfo(info);
      setCustomMapping({ ...info.detectedMapping });
      setSelectedHeaderRow(info.headerRowIndex);

      if (items.length === 0) {
        setErrorMessage(
          'Wczytano arkusz, ale nie wykryto automatycznie kolumn z cenami lub nazwami. Otwórz narzędzie dopasowania kolumn poniżej.'
        );
        setShowMappingModal(true);
      } else {
        onPriceListLoaded(file.name, items);
        setShowCustomUploadPanel(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || 'Nie udało się przetworzyć pliku Excel. Upewnij się, że to poprawny plik .xlsx lub .xls.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (!currentBuffer || !rawSheetInfo) return;
    setIsLoading(true);
    try {
      const { rawSheetInfo: info, items } = await inspectAndParseWorkbook(
        currentBuffer,
        rawSheetInfo.fileName,
        sheetName
      );
      setRawSheetInfo(info);
      setCustomMapping({ ...info.detectedMapping });
      setSelectedHeaderRow(info.headerRowIndex);
      onPriceListLoaded(rawSheetInfo.fileName, items);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCustomMapping = () => {
    if (!rawSheetInfo) return;
    const reParsedItems = extractItemsFromGrid(
      rawSheetInfo.rawGrid,
      selectedHeaderRow,
      customMapping
    );

    if (reParsedItems.length === 0) {
      setErrorMessage('Przy wybranym mapowaniu nie udało się wyodrębnić żadnych pozycji.');
      return;
    }

    onPriceListLoaded(rawSheetInfo.fileName, reParsedItems);
    setShowMappingModal(false);
    setShowCustomUploadPanel(false);
    setErrorMessage(null);
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;
    try {
      const items = parsePastedExcelText(pastedText);
      if (items.length === 0) {
        setErrorMessage('Nie udało się rozpoznać tabeli z wklejonego tekstu.');
        return;
      }
      onPriceListLoaded('Wklejone z Excela (Schowek)', items);
      setPastedText('');
      setShowCustomUploadPanel(false);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd podczas przetwarzania wklejonego tekstu.');
    }
  };

  const downloadSampleTemplate = () => {
    const blob = generateSamplePriceListXlsxBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Wzorzec_Cennika_Aptecznego_2026.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredPriceList = (priceList || []).filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      item.gtin.includes(term) ||
      (item.bloz && item.bloz.includes(term))
    );
  });

  // Lista pozycji z faktury, które mają jakąkolwiek rozbieżność (w cenie netto po rabacie LUB w kodzie EAN/GTIN)
  const discrepancyRows = React.useMemo(() => {
    if (!comparisons) return [];
    const list: PriceComparisonItem[] = [];
    comparisons.forEach((comp) => {
      const hasPriceDiff = comp.status === 'discrepancy' && comp.priceListPrice !== null;
      const hasGtinDiff =
        (comp.gtinStatus === 'discrepancy' || comp.gtinStatus === 'missing_in_order') &&
        Boolean(comp.priceListGtin);
      const isNotFound = comp.status === 'not_found';
      if (hasPriceDiff || hasGtinDiff || isNotFound) {
        list.push(comp);
      }
    });
    return list;
  }, [comparisons]);

  const totalPriceIssues = auditSummary ? auditSummary.discrepanciesCount : 0;
  const totalGtinIssues = auditSummary
    ? auditSummary.gtinDiscrepanciesCount + auditSummary.gtinMissingCount
    : 0;
  const totalFixableIssues = totalPriceIssues + totalGtinIssues;
  const isDozPricing =
    priceListSource === 'knowledge_auto' && activeKnowledgePriceListType === 'DOZ_SPECIAL';

  return (
    <div className="bg-white/95 border border-fuchsia-200/80 rounded-2xl p-5 mb-6 shadow-xs">
      {/* NAGŁÓWEK KROKU 4 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-fuchsia-100">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
            4
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-fuchsia-600" />
                <span>
                  Automatyczna Weryfikacja Ceny Netto i Kodów EAN (z Centrum Wiedzy)
                </span>
              </h2>
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                  isDozPricing
                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                    : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                }`}
              >
                {priceListSource === 'manual_xlsx'
                  ? '📂 Własny plik XLSX'
                  : isDozPricing
                  ? '🔥 Cennik DOZ Direct (-12% Kolumna O)'
                  : '📋 Cennik Q3 Sieci (-5% netto)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              System automatycznie dobiera cennik przypisany do odbiorcy w{' '}
              <strong className="text-slate-700">Centrum Wiedzy</strong>, weryfikuje{' '}
              <strong className="text-slate-700">ceny netto po rabacie</strong> oraz{' '}
              <strong className="text-slate-700">kody EAN (GTIN)</strong> i pozwala jednym kliknięciem uzupełnić rozbieżności.
            </p>
          </div>
        </div>

        {/* Szybki przełącznik źródła cennika */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onSwitchKnowledgePriceList && (
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  onSwitchKnowledgePriceList('DOZ_SPECIAL');
                  setShowCustomUploadPanel(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  priceListSource === 'knowledge_auto' &&
                  activeKnowledgePriceListType === 'DOZ_SPECIAL'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Użyj cennika DOZ Direct od sierpnia 2026 (Kolumna O, -12% netto)"
              >
                🔥 DOZ (-12% Kol. O)
              </button>
              <button
                type="button"
                onClick={() => {
                  onSwitchKnowledgePriceList('Q3_STANDARD');
                  setShowCustomUploadPanel(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  priceListSource === 'knowledge_auto' &&
                  activeKnowledgePriceListType === 'Q3_STANDARD'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Użyj standardowego cennika Q3 2026 dla pozostałych sieci (-5% netto)"
              >
                📋 Sieci Q3 (-5%)
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCustomUploadPanel(!showCustomUploadPanel)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
              showCustomUploadPanel || priceListSource === 'manual_xlsx'
                ? 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
            }`}
            title="Wgraj własny plik .XLSX lub wklej tabelę z Excela"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Własny XLSX</span>
            {showCustomUploadPanel ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* ROZWIJANY PANEL WGRYWANIA WŁASNEGO PLIKU XLSX / SCHOWKA (OPCJONALNY) */}
      {showCustomUploadPanel && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`text-xs font-semibold pb-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'upload'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Wgraj plik .XLSX / .XLS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`text-xs font-semibold pb-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'paste'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Wklej bezpośrednio z Excela (Ctrl+C / Ctrl+V)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Wzorzec XLSX</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCustomUploadPanel(false)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer px-1"
              >
                ✕ Zamknij
              </button>
            </div>
          </div>

          {activeTab === 'upload' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : 'border-slate-300 hover:border-emerald-400 bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs font-bold text-slate-800">
                Przeciągnij tutaj własny plik cennika Excel (.XLSX / .XLS) lub kliknij
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Domyślnie system używa wbudowanych cenników z Centrum Wiedzy (DOZ Kolumna O oraz Q3).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={4}
                placeholder="Kod EAN&#9;Nazwa towaru&#9;Cena bazowa&#9;Rabat&#9;Cena netto po rabacie"
                className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleProcessPastedText}
                  disabled={!pastedText.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Przetwórz wklejone dane</span>
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{errorMessage}</p>
                </div>
              </div>
              {rawSheetInfo && (
                <button
                  type="button"
                  onClick={() => setShowMappingModal(true)}
                  className="px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 cursor-pointer shrink-0"
                >
                  Dopasuj kolumny ręcznie
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* GŁÓWNY PANEL AKTYWNEGO CENNIKA Z CENTRUM WIEDZY & WERYFIKACJI */}
      {priceList && (
        <div className="mt-4 space-y-4">
          {/* PASEK AKTYWNEGO CENNIKA KONTRAHENTA */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              isDozPricing
                ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border-amber-300'
                : 'bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                  isDozPricing
                    ? 'bg-amber-200/80 text-amber-950'
                    : 'bg-emerald-200/80 text-emerald-950'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    {priceListFileName}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {priceList.length} produktów w bazie
                  </span>
                  {priceListSource === 'knowledge_auto' && (
                    <span className="text-[10px] font-bold text-fuchsia-800 bg-fuchsia-100 px-2 py-0.5 rounded-md border border-fuchsia-200">
                      ⚡ Przypisany automatycznie wg odbiorcy: {matchedRecipientLabel}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Automatyczna kontrola zgodności: <strong>Ceny netto po rabacie na FV</strong> oraz{' '}
                  <strong>Kody kreskowe EAN-13 (GTIN)</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              {rawSheetInfo && priceListSource === 'manual_xlsx' && (
                <button
                  type="button"
                  onClick={() => setShowMappingModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mapowanie kolumn</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPriceListModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-fuchsia-600" />
                <span>Podgląd cennika ({priceList.length})</span>
              </button>
              {priceListSource === 'manual_xlsx' && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPriceList();
                    setRawSheetInfo(null);
                    setCurrentBuffer(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                  title="Wróć do automatycznego cennika z Centrum Wiedzy"
                >
                  Przywróć cennik z Centrum Wiedzy
                </button>
              )}
            </div>
          </div>

          {/* KARTY STATYSTYK WERYFIKACJI + SZYBKIE PRZYCISKI AUTOMATYCZNEGO UZUPEŁNIANIA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Karta 1: Statystyki Cen Netto i Kodów EAN */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    Wynik weryfikacji (Ceny netto po rabacie + Kody EAN)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer" title="Włącz / wyłącz podświetlanie weryfikacji">
                    <input
                      type="checkbox"
                      checked={isVerificationEnabled}
                      onChange={(e) => onToggleVerification(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {auditSummary && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      💰 Weryfikacja cen netto po rabacie:
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] text-emerald-700 block">Zgodne ceny</span>
                        <span className="text-xs font-black text-emerald-800">{auditSummary.matchedCount}</span>
                      </div>
                      <div
                        className={`p-1.5 rounded border ${
                          auditSummary.discrepanciesCount > 0
                            ? 'bg-amber-100/90 border-amber-400'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <span className="text-[10px] text-amber-800 font-bold block">Rozbieżne ceny</span>
                        <span className="text-xs font-black text-amber-900">{auditSummary.discrepanciesCount}</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Spoza cennika</span>
                        <span className="text-xs font-bold text-slate-700">{auditSummary.notFoundCount}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      🔢 Weryfikacja kodów EAN / GTIN (zamówienie vs cennik):
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] text-emerald-700 block">EAN zgodny</span>
                        <span className="text-xs font-black text-emerald-800">{auditSummary.gtinMatchedCount}</span>
                      </div>
                      <div
                        className={`p-1.5 rounded border ${
                          auditSummary.gtinDiscrepanciesCount > 0
                            ? 'bg-amber-100/90 border-amber-400'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <span className="text-[10px] text-amber-800 font-bold block">Rozbieżny EAN</span>
                        <span className="text-xs font-black text-amber-900">{auditSummary.gtinDiscrepanciesCount}</span>
                      </div>
                      <div
                        className={`p-1.5 rounded border ${
                          auditSummary.gtinMissingCount > 0
                            ? 'bg-rose-50 border-rose-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="text-[10px] text-rose-700 font-bold block">Brak EAN</span>
                        <span className="text-xs font-black text-rose-800">{auditSummary.gtinMissingCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Karta 2: Automatyczne uzupełnianie z cennika po wskazaniu rozbieżności */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-fuchsia-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    Automatyczne uzupełnianie z cennika
                  </span>
                  {totalFixableIssues > 0 ? (
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      ⚠️ Wykryto rozbieżności ({totalFixableIssues})
                    </span>
                  ) : auditSummary && auditSummary.totalItems > 0 ? (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      ✓ Ceny i EAN zgodne
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Oczekuje na pozycje</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Jednym kliknięciem podmień rozbieżne ceny na <strong>ceny netto po rabacie</strong> z cennika kontrahenta oraz uzupełnij brakujące lub błędne <strong>kody EAN (GTIN)</strong>.
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                {auditSummary && auditSummary.totalPotentialDiff !== 0 && (
                  <div className="text-xs text-slate-600 flex items-center justify-between bg-amber-50/70 px-3 py-1.5 rounded-lg border border-amber-200">
                    <span>Sumaryczna różnica wartości netto na FV:</span>
                    <strong className="font-mono text-amber-950">
                      {auditSummary.totalPotentialDiff > 0
                        ? `+${auditSummary.totalPotentialDiff.toFixed(2)}`
                        : auditSummary.totalPotentialDiff.toFixed(2)}{' '}
                      PLN
                    </strong>
                  </div>
                )}

                {/* GŁÓWNY PRZYCISK: UZUPEŁNIJ WSZYSTKO Z CENNIKA (CENY + EAN) */}
                {onApplyAllFromPriceList && (
                  <button
                    type="button"
                    onClick={onApplyAllFromPriceList}
                    disabled={totalFixableIssues === 0}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                      totalFixableIssues === 0
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-700 hover:via-pink-700 hover:to-rose-700 text-white shadow-fuchsia-200'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      Automatycznie uzupełnij z cennika: Ceny + Kody EAN ({totalFixableIssues})
                    </span>
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onApplyPriceListDiscrepancies}
                    disabled={totalPriceIssues === 0}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      totalPriceIssues === 0
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Podmień same ceny ({totalPriceIssues})</span>
                  </button>

                  {onApplyPriceListGtins && (
                    <button
                      type="button"
                      onClick={onApplyPriceListGtins}
                      disabled={totalGtinIssues === 0}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                        totalGtinIssues === 0
                          ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-pink-50 hover:bg-pink-100 text-pink-900 border-pink-300'
                      }`}
                    >
                      <Barcode className="w-3.5 h-3.5" />
                      <span>Uzupełnij same kody EAN ({totalGtinIssues})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SZCZEGÓŁOWY WYKAZ WYKRYTYCH ROZBIEŻNOŚCI (CENY + KODY EAN)            */}
          {/* ===================================================================== */}
          {auditSummary && auditSummary.totalItems > 0 && discrepancyRows.length > 0 && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 overflow-hidden shadow-2xs animate-in fade-in">
              <div className="px-4 py-3 bg-amber-100/90 border-b border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="text-xs font-black text-amber-950">
                    Wskazane rozbieżności między zamówieniem a cennikiem kontrahenta ({discrepancyRows.length}{' '}
                    {discrepancyRows.length === 1 ? 'pozycja' : discrepancyRows.length < 5 ? 'pozycje' : 'pozycji'})
                  </span>
                </div>
                {onApplyAllFromPriceList && totalFixableIssues > 0 && (
                  <button
                    type="button"
                    onClick={onApplyAllFromPriceList}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-amber-900 hover:bg-slate-900 text-white shadow-2xs cursor-pointer transition-colors self-start sm:self-auto"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Zastąp wszystkie danymi z cennika</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-50/90 border-b border-amber-200 text-[10px] font-black uppercase text-amber-950">
                      <th className="py-2 px-3">Pozycja na zamówieniu / Dopasowano w cenniku</th>
                      <th className="py-2 px-3">Kod EAN (Na FV vs Cennik)</th>
                      <th className="py-2 px-3 text-right">Cena netto (Na FV vs Cennik po rabacie)</th>
                      <th className="py-2 px-3 text-right">Automatyczne uzupełnienie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200/70 bg-white/90">
                    {discrepancyRows.map((row) => {
                      const hasPriceDiff =
                        row.status === 'discrepancy' && row.priceListPrice !== null;
                      const hasGtinDiff =
                        (row.gtinStatus === 'discrepancy' ||
                          row.gtinStatus === 'missing_in_order') &&
                        Boolean(row.priceListGtin);
                      const isEmptyOrderGtin = isPlaceholderOrEmptyGtin(row.invoiceGtin);

                      return (
                        <tr key={row.invoiceItemId} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{row.invoiceItemName}</div>
                            {row.matchedPriceListItem ? (
                              <div className="text-[11px] text-slate-500">
                                W cenniku:{' '}
                                <strong className="text-slate-700">
                                  {row.matchedPriceListItem.name}
                                </strong>
                              </div>
                            ) : (
                              <div className="text-[11px] font-bold text-rose-600">
                                ❗ Nie znaleziono odpowiednika w cenniku
                              </div>
                            )}
                          </td>

                          {/* Kolumna porównania EAN */}
                          <td className="py-2.5 px-3 font-mono">
                            {row.status === 'not_found' ? (
                              <span className="text-slate-400">—</span>
                            ) : hasGtinDiff ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="line-through text-rose-600 text-[11px]">
                                    {isEmptyOrderGtin ? 'Brak EAN' : row.invoiceGtin}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                  <span className="font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {row.priceListGtin}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>{row.invoiceGtin} (OK)</span>
                              </span>
                            )}
                          </td>

                          {/* Kolumna porównania Ceny Netto */}
                          <td className="py-2.5 px-3 text-right font-mono">
                            {row.status === 'not_found' ? (
                              <span className="text-slate-400">{row.invoiceNetPrice.toFixed(2)} zł</span>
                            ) : hasPriceDiff && row.priceListPrice !== null ? (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <span className="line-through text-rose-600 text-[11px]">
                                  {row.invoiceNetPrice.toFixed(2)} zł
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                  {row.priceListPrice.toFixed(2)} zł netto
                                </span>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-bold inline-flex items-center justify-end gap-1">
                                <Check className="w-3 h-3" />
                                <span>{row.invoiceNetPrice.toFixed(2)} zł (OK)</span>
                              </span>
                            )}
                          </td>

                          {/* Przyciski szybkiego uzupełnienia w wierszu */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {hasPriceDiff &&
                                hasGtinDiff &&
                                onApplySingleBoth &&
                                row.priceListPrice !== null &&
                                row.priceListGtin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onApplySingleBoth(
                                        row.invoiceItemId,
                                        row.priceListPrice,
                                        row.priceListGtin
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-fuchsia-600 hover:bg-fuchsia-700 text-white cursor-pointer transition-colors shadow-2xs"
                                  >
                                    ⚡ Uzupełnij Cenę + EAN
                                  </button>
                                )}

                              {hasPriceDiff &&
                                onApplySinglePrice &&
                                row.priceListPrice !== null && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onApplySinglePrice(row.invoiceItemId, row.priceListPrice!)
                                    }
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
                                  >
                                    💰 Wstaw cenę ({row.priceListPrice.toFixed(2)} zł)
                                  </button>
                                )}

                              {hasGtinDiff && onApplySingleGtin && row.priceListGtin && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onApplySingleGtin(row.invoiceItemId, row.priceListGtin!)
                                  }
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-pink-600 hover:bg-pink-700 text-white cursor-pointer transition-colors"
                                >
                                  🔢 Wstaw EAN ({row.priceListGtin})
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BANER PEŁNEJ ZGODNOŚCI (GDY WSZYSTKIE POZYCJE MAJĄ ZGODNE CENY I KODY EAN) */}
          {auditSummary && auditSummary.totalItems > 0 && discrepancyRows.length === 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-black">
                    ✅ Pełna zgodność z cennikiem kontrahenta z Centrum Wiedzy!
                  </span>
                  <span className="ml-1.5 text-emerald-800">
                    Wszystkie pozycje ({auditSummary.totalItems}) mają prawidłowe ceny netto po rabacie oraz zgodne kody EAN (GTIN).
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Ręcznego Mapowania Kolumn */}
      {showMappingModal && rawSheetInfo && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Dopasuj kolumny cennika Excel
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{rawSheetInfo.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Sheet selector if multiple sheets */}
              {rawSheetInfo.sheetNames.length > 1 && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <label className="block text-xs font-semibold text-blue-950 mb-1">
                    Wybierz arkusz z pliku Excel:
                  </label>
                  <select
                    value={rawSheetInfo.selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    {rawSheetInfo.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        Arkusz: {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Header row index selector */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Wiersz nagłówka w arkuszu:
                </label>
                <select
                  value={selectedHeaderRow}
                  onChange={(e) => {
                    const rowIdx = parseInt(e.target.value);
                    setSelectedHeaderRow(rowIdx);
                    if (rawSheetInfo.rawGrid[rowIdx]) {
                      const newMapping = detectColumnMapping(rawSheetInfo.rawGrid[rowIdx]);
                      setCustomMapping(newMapping);
                    }
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none font-mono"
                >
                  {rawSheetInfo.rawGrid.slice(0, 15).map((row, idx) => (
                    <option key={idx} value={idx}>
                      Wiersz {idx + 1}: {row.filter(Boolean).slice(0, 4).join(' | ') || '(pusty wiersz)'}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Wybierz wiersz, w którym znajdują się nazwy kolumn (EAN, Nazwa towaru, Cena...).
                </span>
              </div>

              {/* Column Selectors */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                {/* 1. Cena netto po rabacie */}
                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                  <label className="block font-bold text-emerald-950 mb-1">
                    Kolumna: Cena netto po rabacie (KLUCZOWA)
                  </label>
                  <select
                    value={customMapping.discountedNetColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, discountedNetColIndex: parseInt(e.target.value) })
                    }
                    className="w-full text-xs bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value={-1}>-- Nie wybrano (lub wylicz z bazowej i rabatu) --</option>
                    {rawSheetInfo.availableColumns.map((col) => (
                      <option key={col.index} value={col.index}>
                        Kolumna {col.index + 1}: {col.label} {col.preview ? `(${col.preview})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Kod GTIN / EAN */}
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Kolumna: Kod GTIN / EAN
                  </label>
                  <select
                    value={customMapping.gtinColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, gtinColIndex: parseInt(e.target.value) })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value={-1}>-- Pomiń kod GTIN --</option>
                    {rawSheetInfo.availableColumns.map((col) => (
                      <option key={col.index} value={col.index}>
                        Kolumna {col.index + 1}: {col.label} {col.preview ? `(${col.preview})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Nazwa towaru */}
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Kolumna: Nazwa towaru / leku
                  </label>
                  <select
                    value={customMapping.nameColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, nameColIndex: parseInt(e.target.value) })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value={-1}>-- Pomiń nazwę --</option>
                    {rawSheetInfo.availableColumns.map((col) => (
                      <option key={col.index} value={col.index}>
                        Kolumna {col.index + 1}: {col.label} {col.preview ? `(${col.preview})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Cena bazowa (opcjonalnie) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Cena bazowa netto (opcjonalna)
                    </label>
                    <select
                      value={customMapping.baseNetColIndex}
                      onChange={(e) =>
                        setCustomMapping({ ...customMapping, baseNetColIndex: parseInt(e.target.value) })
                      }
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value={-1}>-- Brak --</option>
                      {rawSheetInfo.availableColumns.map((col) => (
                        <option key={col.index} value={col.index}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Rabat % (opcjonalny)
                    </label>
                    <select
                      value={customMapping.discountPercentColIndex}
                      onChange={(e) =>
                        setCustomMapping({ ...customMapping, discountPercentColIndex: parseInt(e.target.value) })
                      }
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value={-1}>-- Brak --</option>
                      {rawSheetInfo.availableColumns.map((col) => (
                        <option key={col.index} value={col.index}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                onClick={handleApplyCustomMapping}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Zastosuj mapowanie kolumn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Podglądu Wgranego Cennika XLSX */}
      {showPriceListModal && priceList && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Zawartość wgranego cennika</span>
                    <span className="text-xs font-mono text-slate-500">({priceList.length} pozycji)</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{priceListFileName}</p>
                </div>
              </div>

              <button
                onClick={() => setShowPriceListModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="p-4 border-b border-slate-200 bg-white">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Szukaj po nazwie towaru lub kodzie GTIN/EAN..."
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>

            {/* Price List Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-2 px-3">Lp.</th>
                    <th className="py-2 px-3">Kod GTIN / EAN</th>
                    <th className="py-2 px-3">Nazwa towaru</th>
                    <th className="py-2 px-3 text-right">Cena bazowa</th>
                    <th className="py-2 px-3 text-center">Rabat %</th>
                    <th className="py-2 px-3 text-right font-bold text-emerald-800 bg-emerald-50/60">
                      Cena netto po rabacie
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredPriceList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nie znaleziono pozycji pasujących do wyszukiwania
                      </td>
                    </tr>
                  ) : (
                    filteredPriceList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-400 text-center">{idx + 1}</td>
                        <td className="py-2 px-3 text-slate-700">{item.gtin}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-900">{item.name}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{item.baseNetPrice.toFixed(2)} zł</td>
                        <td className="py-2 px-3 text-center text-slate-600">
                          {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-800 bg-emerald-50/30">
                          {item.discountedNetPrice.toFixed(2)} zł
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowPriceListModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
