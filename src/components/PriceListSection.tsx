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
  Layers,
  ArrowRight,
  Barcode,
} from 'lucide-react';
import {
  PriceListItem,
  PriceListAuditSummary,
  RawSheetInfo,
  ColumnMapping,
} from '../types/priceList';
import {
  parsePriceListFile,
  SAMPLE_XLSX_PRICE_LIST,
  generateSamplePriceListXlsxBlob,
  extractItemsFromGrid,
  inspectAndParseWorkbook,
  parsePastedExcelText,
  detectColumnMapping,
} from '../utils/priceListParser';

interface PriceListSectionProps {
  priceList: PriceListItem[] | null;
  priceListFileName: string | null;
  onPriceListLoaded: (fileName: string, items: PriceListItem[]) => void;
  onClearPriceList: () => void;
  auditSummary: PriceListAuditSummary | null;
  isVerificationEnabled: boolean;
  onToggleVerification: (enabled: boolean) => void;
  onApplyPriceListDiscrepancies: () => void;
  onApplyPriceListGtins?: () => void;
}

export const PriceListSection: React.FC<PriceListSectionProps> = ({
  priceList,
  priceListFileName,
  onPriceListLoaded,
  onClearPriceList,
  auditSummary,
  isVerificationEnabled,
  onToggleVerification,
  onApplyPriceListDiscrepancies,
  onApplyPriceListGtins,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd podczas przetwarzania wklejonego tekstu.');
    }
  };

  const loadSamplePriceList = () => {
    onPriceListLoaded('Cennik_Eubiosis_Sieci_2026.xlsx', SAMPLE_XLSX_PRICE_LIST);
    setErrorMessage(null);
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
    return item.name.toLowerCase().includes(term) || item.gtin.includes(term);
  });

  return (
    <div className="bg-white/95 border border-fuchsia-200/80 rounded-2xl p-5 mb-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-fuchsia-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shadow-2xs">
              4
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-fuchsia-600" />
                <span>Weryfikacja z Cennikiem (Plik XLSX / Schowek)</span>
                <span className="text-[11px] font-mono text-fuchsia-700 bg-fuchsia-50 px-2 py-0.5 rounded-full border border-fuchsia-200">
                  Ceny netto po rabacie
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Wgraj plik XLSX lub wklej bezpośrednio z Excela. System weryfikuje ceny netto po rabacie i pozwala je podmienić na fakturze.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleTemplate}
            className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            title="Pobierz przykładowy szablon XLSX z kolumnami rabatowymi"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pobierz wzorzec XLSX</span>
          </button>
          {!priceList && (
            <button
              onClick={loadSamplePriceList}
              className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Wczytaj przykładowy cennik</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!priceList ? (
        <div className="mt-4">
          {/* Tabs: Upload File vs Paste directly from Excel */}
          <div className="flex items-center gap-3 border-b border-slate-200 pb-2 mb-4">
            <button
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

          {activeTab === 'upload' ? (
            /* Dropzone for XLSX */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Przeciągnij plik cennika Excel (.XLSX / .XLS) lub kliknij tutaj
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xl mx-auto">
                Inteligentne wykrywanie wiersza nagłówka i kolumn (nawet jeśli plik zawiera tytuły lub puste wiersze na górze).
              </p>
            </div>
          ) : (
            /* Paste area */
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Zaznacz wiersze w programie Excel (np. kolumny Kod EAN, Nazwa, Cena netto po rabacie), skopiuj (<kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Ctrl+C</kbd>) i wklej poniżej:
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={5}
                placeholder="Kod EAN&#9;Nazwa towaru&#9;Cena bazowa&#9;Rabat&#9;Cena netto po rabacie&#10;9120117912773&#9;OMNi-BiOTiC Active&#9;175.05&#9;5%&#9;166.30"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleProcessPastedText}
                  disabled={!pastedText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Przetwórz wklejone dane</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message & Manual Mapping Prompt */}
          {errorMessage && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{errorMessage}</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Jeśli nagłówki w Twoim pliku różnią się od standardowych, możesz wskazać odpowiednie kolumny ręcznie.
                  </p>
                </div>
              </div>
              {rawSheetInfo && (
                <button
                  onClick={() => setShowMappingModal(true)}
                  className="px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                >
                  Dopasuj kolumny ręcznie
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Loaded Price List & Verification Panel */
        <div className="mt-4 space-y-4">
          {/* Active File Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{priceListFileName}</span>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {priceList.length} pozycji w cenniku
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Weryfikacja cen netto po rabacie aktywna · Dopasowywanie po GTIN i nazwie
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              {rawSheetInfo && (
                <button
                  onClick={() => setShowMappingModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Zmień mapowanie kolumn w pliku"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mapowanie kolumn</span>
                </button>
              )}
              <button
                onClick={() => setShowPriceListModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Przeglądaj ({priceList.length})</span>
              </button>
              <button
                onClick={() => {
                  onClearPriceList();
                  setRawSheetInfo(null);
                  setCurrentBuffer(null);
                }}
                className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Usuń wgrany cennik"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dwie kluczowe opcje: 1) Weryfikacja cen, 2) Zastosowanie cen z cennika */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opcja 1: Weryfikacja cen z cennikiem */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    Opcja 1: Weryfikacja cen z cennikiem
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVerificationEnabled}
                      onChange={(e) => onToggleVerification(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Podświetla zgodność cen i wylicza ewentualne różnice kwotowe w tabeli pozycji.
                </p>
              </div>

              {/* Status weryfikacji */}
              {auditSummary && (
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Weryfikacja cen netto po rabacie:
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="p-1.5 rounded bg-emerald-50 border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 block">Zgodne</span>
                        <span className="text-xs font-bold text-emerald-800">{auditSummary.matchedCount}</span>
                      </div>
                      <div
                        className={`p-1.5 rounded border ${
                          auditSummary.discrepanciesCount > 0
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <span className="text-[10px] text-amber-700 block">Rozbieżności</span>
                        <span className="text-xs font-bold text-amber-800">{auditSummary.discrepanciesCount}</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Brak w cenniku</span>
                        <span className="text-xs font-bold text-slate-700">{auditSummary.notFoundCount}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Weryfikacja kodów GTIN / EAN (zamówienie vs cennik):
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="p-1.5 rounded bg-emerald-50 border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 block">EAN zgodny</span>
                        <span className="text-xs font-bold text-emerald-800">{auditSummary.gtinMatchedCount}</span>
                      </div>
                      <div
                        className={`p-1.5 rounded border ${
                          auditSummary.gtinDiscrepanciesCount > 0
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <span className="text-[10px] text-amber-700 block">Rozbieżny EAN</span>
                        <span className="text-xs font-bold text-amber-800">{auditSummary.gtinDiscrepanciesCount}</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Brak EAN</span>
                        <span className="text-xs font-bold text-slate-700">{auditSummary.gtinMissingCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Opcja 2: Użycie cen i kodów EAN z cennika jeżeli są rozbieżności */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    Opcja 2: Zastosuj dane z cennika XLSX
                  </span>
                  {auditSummary && auditSummary.discrepanciesCount > 0 ? (
                    <span className="text-[11px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Wykryto {auditSummary.discrepanciesCount} {auditSummary.discrepanciesCount === 1 ? 'różnicę cen' : 'różnice cen'}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Ceny zgodne
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Nadpisuje ceny netto lub kody EAN na fakturze danymi z oficjalnego cennika dla pozycji z rozbieżnościami.
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  {auditSummary && auditSummary.totalPotentialDiff !== 0 && (
                    <span>
                      Różnica netto:{' '}
                      <strong className="font-mono text-slate-900">
                        {auditSummary.totalPotentialDiff > 0
                          ? `+${auditSummary.totalPotentialDiff.toFixed(2)}`
                          : auditSummary.totalPotentialDiff.toFixed(2)}{' '}
                        PLN
                      </strong>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onApplyPriceListGtins && auditSummary && (auditSummary.gtinDiscrepanciesCount > 0 || auditSummary.gtinMissingCount > 0) && (
                    <button
                      type="button"
                      onClick={onApplyPriceListGtins}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-pink-100 hover:bg-pink-200 text-pink-900 border border-pink-300 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                      title="Wstaw brakujące lub rozbieżne kody EAN/GTIN z cennika dla dopasowanych produktów"
                    >
                      <Barcode className="w-3.5 h-3.5 text-pink-700" />
                      <span>
                        Wstaw EAN z cennika ({auditSummary.gtinDiscrepanciesCount + auditSummary.gtinMissingCount})
                      </span>
                    </button>
                  )}

                  <button
                    onClick={onApplyPriceListDiscrepancies}
                    disabled={!auditSummary || auditSummary.discrepanciesCount === 0}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap ${
                      !auditSummary || auditSummary.discrepanciesCount === 0
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      Użyj cen z cennika ({auditSummary ? auditSummary.discrepanciesCount : 0})
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
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
