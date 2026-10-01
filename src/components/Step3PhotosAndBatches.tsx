import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Tag,
  Check,
  Search,
  Plus,
  RefreshCw,
  Edit3,
  Layers,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import { LogisticsFormat, InvoiceItem } from '../types/ksef';
import { PhotoVerificationItem, BatchRecord } from '../types/twoStageOcr';
import {
  runStage1ProductRecognition,
  runStage2VisualInspection,
  formatDateToDisplay,
  normalizeManualDate,
} from '../utils/twoStageOcrService';
import { PhotoZoomCropModal } from './PhotoZoomCropModal';

interface Step3PhotosAndBatchesProps {
  logisticsFormat: LogisticsFormat;
  onToggleLogisticsFormat: (format: LogisticsFormat) => void;
  items: InvoiceItem[];
  onUpdateItem: (id: string, updatedFields: Partial<InvoiceItem>) => void;
  onOcrCompleted?: (ocrResults: any[]) => void;
  onOpenAiGuide?: () => void;
}

export const Step3PhotosAndBatches: React.FC<Step3PhotosAndBatchesProps> = ({
  logisticsFormat,
  onToggleLogisticsFormat,
  items,
  onUpdateItem,
}) => {
  const [photoItems, setPhotoItems] = useState<PhotoVerificationItem[]>([]);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [changingMatchPhotoId, setChangingMatchPhotoId] = useState<string | null>(null);

  // Modal zoomu i zaznaczania fragmentu
  const [cropModalData, setCropModalData] = useState<{
    isOpen: boolean;
    photoId: string;
    photoUrl: string;
    photoFile: File;
    productName: string;
  } | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  /**
   * Dodaje nowe zdjęcia i uruchamia WYŁĄCZNIE ETAP 1 (Rozpoznanie produktu)
   * Na tym etapie kategorycznie NIE ODCZYTUJEMY ani nie zapisujemy LOT/MHD.
   */
  const handleAddNewPhotos = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newPhotoRecords: PhotoVerificationItem[] = imageFiles.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      fileName: file.name,
      photoUrl: URL.createObjectURL(file),
      status: 'PRODUCT_PENDING',
      isConfidentProductMatch: false,
      isAnalyzingProduct: true,
      batches: [],
    }));

    setPhotoItems((prev) => [...prev, ...newPhotoRecords]);

    for (const record of newPhotoRecords) {
      try {
        const stage1Res = await runStage1ProductRecognition(record.file, items);

        setPhotoItems((prev) =>
          prev.map((item) => {
            if (item.id !== record.id) return item;

            const isMatched = Boolean(stage1Res.matchedInvoiceItemId && stage1Res.isConfident);

            return {
              ...item,
              status: isMatched ? 'PRODUCT_MATCHED' : 'PRODUCT_PENDING',
              recognizedProductName: stage1Res.recognizedProductName,
              recognizedGtin: stage1Res.recognizedGtin,
              matchedInvoiceItemId: stage1Res.matchedInvoiceItemId,
              matchedInvoiceItemIndex: stage1Res.matchedInvoiceItemIndex,
              isConfidentProductMatch: stage1Res.isConfident,
              isAnalyzingProduct: false,
            };
          })
        );
      } catch (err) {
        console.error('Błąd Etapu 1:', err);
        setPhotoItems((prev) =>
          prev.map((item) =>
            item.id === record.id
              ? { ...item, status: 'PRODUCT_PENDING', isAnalyzingProduct: false }
              : item
          )
        );
      }
    }
  };

  /**
   * ZATWIERDZENIE DOPASOWANIA PRODUKTU
   */
  const handleConfirmProductMatch = (photoId: string) => {
    setPhotoItems((prev) =>
      prev.map((item) => {
        if (item.id !== photoId) return item;
        return {
          ...item,
          status: 'LOT_MHD_PENDING',
        };
      })
    );
    setChangingMatchPhotoId(null);
  };

  /**
   * RĘCZNA ZMIANA DOPASOWANIA PRODUKTU
   */
  const handleManualProductSelect = (photoId: string, invoiceItemId: string) => {
    const selectedItem = items.find((it) => it.id === invoiceItemId);
    const itemIndex = items.findIndex((it) => it.id === invoiceItemId);

    setPhotoItems((prev) =>
      prev.map((item) => {
        if (item.id !== photoId) return item;
        return {
          ...item,
          matchedInvoiceItemId: invoiceItemId,
          matchedInvoiceItemIndex: itemIndex !== -1 ? itemIndex + 1 : undefined,
          recognizedProductName: selectedItem?.name || item.recognizedProductName,
          recognizedGtin: selectedItem?.gtin || item.recognizedGtin,
          status: 'PRODUCT_MATCHED',
          isConfidentProductMatch: true,
        };
      })
    );
    setChangingMatchPhotoId(null);
  };

  /**
   * ETAP 2: RĘCZNE URUCHOMIENIE RZECZYWISTEJ ANALIZY WIZUALNEJ LOT I MHD
   */
  const handleRunStage2LotMhd = async (
    photoId: string,
    customCropArea?: { x: number; y: number; width: number; height: number }
  ) => {
    const photoItem = photoItems.find((p) => p.id === photoId);
    if (!photoItem || !photoItem.matchedInvoiceItemId) return;

    const matchedProduct = items.find((it) => it.id === photoItem.matchedInvoiceItemId);
    if (!matchedProduct) return;

    setPhotoItems((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, isAnalyzingLotMhd: true } : p))
    );

    try {
      const result = await runStage2VisualInspection(photoItem.file, matchedProduct, customCropArea);

      // Sprawdź czy cokolwiek odczytano
      const primaryBatch = result.batches[0];
      const hasLot = Boolean(primaryBatch?.lot);
      const hasMhd = Boolean(primaryBatch?.mhd);

      // Jeśli istnieją już wcześniej odczytane lub wpisane wartości, nie kasuj ich
      const existingBatch = photoItem.batches[0];
      let mergedLot = primaryBatch?.lot || existingBatch?.lot || '';
      let mergedMhd = primaryBatch?.mhd || existingBatch?.mhd || '';
      let mergedQty = primaryBatch?.quantity || existingBatch?.quantity || matchedProduct.quantity || 1;

      const isLotConfident = Boolean(primaryBatch?.lotConfidence || existingBatch?.lotConfidence);
      const isMhdConfident = Boolean(primaryBatch?.mhdConfidence || existingBatch?.mhdConfidence);

      const isBothConfident = isLotConfident && isMhdConfident && mergedLot && mergedMhd;
      const nextStatus = isBothConfident ? 'LOT_MHD_READ' : 'MANUAL_VERIFICATION_REQUIRED';

      const updatedBatches: BatchRecord[] = [
        {
          id: existingBatch?.id || `batch-${Date.now()}-0`,
          lot: mergedLot,
          mhd: mergedMhd,
          quantity: mergedQty,
          lotConfidence: isLotConfident,
          mhdConfidence: isMhdConfident,
          status: isBothConfident ? 'PEWNY' : 'DO WERYFIKACJI',
        },
      ];

      setPhotoItems((prev) =>
        prev.map((p) => {
          if (p.id !== photoId) return p;
          return {
            ...p,
            status: nextStatus,
            batches: updatedBatches,
            rawOcrText: result.rawText,
            isAnalyzingLotMhd: false,
          };
        })
      );
    } catch (err) {
      console.error('Błąd Etapu 2 (LOT/MHD):', err);
      setPhotoItems((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                status: 'MANUAL_VERIFICATION_REQUIRED',
                isAnalyzingLotMhd: false,
              }
            : p
        )
      );
    }
  };

  /**
   * ZATWIERDZENIE LOT/MHD I WPISANIE DO FAKTURY
   */
  const handleConfirmLotMhdToInvoice = (photoId: string) => {
    const photo = photoItems.find((p) => p.id === photoId);
    if (!photo || !photo.matchedInvoiceItemId || photo.batches.length === 0) return;

    const primaryBatch = photo.batches[0];

    onUpdateItem(photo.matchedInvoiceItemId, {
      batchNumber: primaryBatch.lot,
      expiryDate: primaryBatch.mhd,
      quantityInBatch: primaryBatch.quantity,
      ocrMatched: true,
      ocrConfidence: primaryBatch.lotConfidence && primaryBatch.mhdConfidence ? 0.98 : 0.85,
    });

    setPhotoItems((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, status: 'CONFIRMED' } : p))
    );
  };

  /**
   * ROZPOCZĘCIE WPISYWANIA RĘCZNEGO LOT / MHD
   */
  const handleStartManualEntry = (photoId: string) => {
    const photo = photoItems.find((p) => p.id === photoId);
    const matchedProduct = items.find((it) => it.id === photo?.matchedInvoiceItemId);
    const defaultQty = matchedProduct?.quantity || 1;

    setPhotoItems((prev) =>
      prev.map((p) => {
        if (p.id !== photoId) return p;

        const existingBatches: BatchRecord[] =
          p.batches.length > 0
            ? p.batches
            : [
                {
                  id: `batch-${Date.now()}-0`,
                  lot: '',
                  mhd: '',
                  quantity: defaultQty,
                  lotConfidence: true,
                  mhdConfidence: true,
                  status: 'PEWNY',
                  isEditing: true,
                },
              ];

        return {
          ...p,
          status: p.status === 'LOT_MHD_PENDING' ? 'MANUAL_VERIFICATION_REQUIRED' : p.status,
          batches: existingBatches,
          isManualEntry: true,
        };
      })
    );
  };

  /**
   * AKTUALIZACJA DANYCH PARTII (LOT / MHD / ILOŚĆ)
   */
  const handleUpdateBatchField = (
    photoId: string,
    batchId: string,
    field: 'lot' | 'mhd' | 'quantity',
    value: any
  ) => {
    setPhotoItems((prev) =>
      prev.map((p) => {
        if (p.id !== photoId) return p;
        return {
          ...p,
          batches: p.batches.map((b) => {
            if (b.id !== batchId) return b;
            let updatedValue = value;
            if (field === 'lot') updatedValue = String(value).toUpperCase();
            if (field === 'mhd') updatedValue = normalizeManualDate(String(value));
            if (field === 'quantity') updatedValue = Math.max(1, parseInt(value, 10) || 1);

            return {
              ...b,
              [field]: updatedValue,
              lotConfidence: field === 'lot' ? true : b.lotConfidence,
              mhdConfidence: field === 'mhd' ? true : b.mhdConfidence,
              status: 'PEWNY',
            };
          }),
        };
      })
    );
  };

  /**
   * DODANIE KOLEJNEJ PARTII TEGO SAMEGO PRODUKTU
   */
  const handleAddExtraBatch = (photoId: string) => {
    setPhotoItems((prev) =>
      prev.map((p) => {
        if (p.id !== photoId) return p;
        const newBatch: BatchRecord = {
          id: `batch-${Date.now()}-${p.batches.length}`,
          lot: '',
          mhd: '',
          quantity: 1,
          lotConfidence: true,
          mhdConfidence: true,
          status: 'PEWNY',
          isEditing: true,
        };
        return {
          ...p,
          batches: [...p.batches, newBatch],
        };
      })
    );
  };

  const handleRemoveBatch = (photoId: string, batchId: string) => {
    setPhotoItems((prev) =>
      prev.map((p) => {
        if (p.id !== photoId) return p;
        return {
          ...p,
          batches: p.batches.filter((b) => b.id !== batchId),
        };
      })
    );
  };

  const removePhoto = (photoId: string) => {
    setPhotoItems((prev) => prev.filter((p) => p.id !== photoId));
  };

  return (
    <div className="bg-white/95 border border-rose-200/80 rounded-2xl p-5 mb-6 shadow-xs">
      {/* Nagłówek sekcji */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              3
            </span>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-rose-500" />
              Krok 3: Zdjęcia Opakowań – Weryfikacja Produktu i Odczyt LOT/MHD 🌸
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Etap 1: Zatwierdzenie produktu ➔ Etap 2: Rzeczywista analiza wizualna nadruków (inkjet / etykiety / GS1)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {logisticsFormat === 'none' ? (
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              Tryb: Faktura bez serii i dat
            </span>
          ) : (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>🌸 Dodaj zdjęcie produktu</span>
            </button>
          )}
        </div>
      </div>

      {/* Baner informacyjny gdy wybrano tryb bez serii i dat */}
      {logisticsFormat === 'none' && (
        <div className="mt-3 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-blue-900">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="font-bold">
                Wybrano tryb: Standardowa faktura KSeF bez serii i dat ważności
              </p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                W tym trybie zdjęcia i odczyt LOT/MHD są pomijane. Faktura zostanie wygenerowana z czystymi pozycjami towarowymi &lt;FaWiersz&gt; bez węzłów &lt;DodatkowyOpis&gt;.
              </p>
            </div>
          </div>
          <button
            onClick={() => onToggleLogisticsFormat('gs1_composite')}
            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Włącz serie i daty (GS1)
          </button>
        </div>
      )}

      <input
        ref={photoInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleAddNewPhotos(Array.from(e.target.files));
          }
        }}
        className="hidden"
      />

      {/* Upload Zone */}
      {photoItems.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingPhotos(true);
          }}
          onDragLeave={() => setIsDraggingPhotos(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingPhotos(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleAddNewPhotos(Array.from(e.dataTransfer.files));
            }
          }}
          onClick={() => photoInputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDraggingPhotos
              ? 'border-emerald-500 bg-emerald-50/70'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <div className="w-12 h-12 mx-auto mb-2.5 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
            <Camera className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Kliknij „📷 Dodaj zdjęcie produktu” lub upuść zdjęcia opakowań
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            W Etapie 1 AI rozpozna <strong>wyłącznie produkt</strong>. Dopiero po zatwierdzeniu
            uruchomisz analizę wizualną nadruku LOT / MHD z możliwością powiększenia fragmentu (Zoom).
          </p>
        </div>
      )}

      {/* LISTA ZDJĘĆ Z DWUETAPOWYM PROCESEM */}
      {photoItems.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Przesłane zdjęcia ({photoItems.length}):
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Dodaj kolejne zdjęcie</span>
              </button>
              <button
                onClick={() => setPhotoItems([])}
                className="text-xs text-red-600 hover:underline cursor-pointer"
              >
                Usuń wszystkie
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {photoItems.map((photo) => {
              const matchedProduct = items.find((it) => it.id === photo.matchedInvoiceItemId);
              const primaryBatch = photo.batches[0];

              const hasNoDataAtAll =
                !photo.isManualEntry &&
                (photo.status === 'LOT_MHD_READ' || photo.status === 'MANUAL_VERIFICATION_REQUIRED') &&
                (!primaryBatch || (!primaryBatch.lot && !primaryBatch.mhd));

              return (
                <div
                  key={photo.id}
                  className={`border rounded-xl p-4 transition-all shadow-xs ${
                    photo.status === 'CONFIRMED'
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : photo.status === 'MANUAL_VERIFICATION_REQUIRED'
                      ? 'border-amber-300 bg-amber-50/15'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start gap-4">
                    {/* ZDJĘCIE Z PRZYCISKIEM ZOOM */}
                    <div className="w-full md:w-36 flex flex-col gap-1.5 shrink-0">
                      <div className="w-full h-36 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative group">
                        <img
                          src={photo.photoUrl}
                          alt={photo.fileName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-1 right-1">
                          <button
                            onClick={() => removePhoto(photo.id)}
                            className="bg-white/80 hover:bg-white text-slate-500 hover:text-red-600 p-1 rounded-full shadow-xs cursor-pointer"
                            title="Usuń zdjęcie"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Przycisk Zoom */}
                        <button
                          onClick={() =>
                            setCropModalData({
                              isOpen: true,
                              photoId: photo.id,
                              photoUrl: photo.photoUrl,
                              photoFile: photo.file,
                              productName: matchedProduct?.name || photo.recognizedProductName || 'Produkt',
                            })
                          }
                          className="absolute bottom-1 right-1 bg-black/70 hover:bg-black text-white text-[10px] font-semibold px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors"
                          title="Powiększ i zaznacz fragment do odczytu"
                        >
                          <ZoomIn className="w-3 h-3" />
                          <span>Zoom</span>
                        </button>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono truncate text-center block">
                        {photo.fileName}
                      </span>
                    </div>

                    {/* SEKCJA GŁÓWNA */}
                    <div className="flex-1 w-full space-y-3">
                      {/* ========================================================
                          ETAP 1: ROZPOZNANIE I ZATWIERDZENIE PRODUKTU
                          ======================================================== */}
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-emerald-600" />
                            Etap 1: Identyfikacja Produktu (bez odczytu LOT/MHD)
                          </span>

                          {photo.isAnalyzingProduct ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Rozpoznawanie produktu...</span>
                            </span>
                          ) : photo.status === 'PRODUCT_PENDING' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              Wybierz pozycję ręcznie
                            </span>
                          ) : photo.status === 'PRODUCT_MATCHED' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                              Dopasowano produkt (wymaga zatwierdzenia)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              Produkt zatwierdzony
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Rozpoznany produkt:</span>
                            <span className="font-bold text-slate-900 truncate block">
                              {photo.recognizedProductName || 'W trakcie analizy...'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block">GTIN / EAN:</span>
                            <span className="font-mono font-medium text-slate-800 block">
                              {photo.recognizedGtin || 'Brak kodu kreskowego'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block">Dopasowana pozycja faktury:</span>
                            <span className="font-bold text-emerald-900 block truncate">
                              {matchedProduct
                                ? `${photo.matchedInvoiceItemIndex || 1}. ${matchedProduct.name}`
                                : '— Wybierz pozycję —'}
                            </span>
                          </div>
                        </div>

                        {/* Potwierdzenie lub zmiana pozycji */}
                        {(photo.status === 'PRODUCT_PENDING' || photo.status === 'PRODUCT_MATCHED') && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            {changingMatchPhotoId === photo.id || !photo.matchedInvoiceItemId ? (
                              <div className="w-full flex items-center gap-2">
                                <select
                                  value={photo.matchedInvoiceItemId || ''}
                                  onChange={(e) => handleManualProductSelect(photo.id, e.target.value)}
                                  className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 px-2.5 focus:border-emerald-600 focus:outline-none"
                                >
                                  <option value="">-- Wybierz pozycję z faktury --</option>
                                  {items.map((it, idx) => (
                                    <option key={it.id} value={it.id}>
                                      Pozycja {idx + 1}: {it.name} (GTIN: {it.gtin || 'brak'}, {it.quantity} szt.)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleConfirmProductMatch(photo.id)}
                                  disabled={!photo.matchedInvoiceItemId}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>✓ ZATWIERDŹ DOPASOWANIE</span>
                                </button>

                                <button
                                  onClick={() => setChangingMatchPhotoId(photo.id)}
                                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
                                >
                                  ✕ ZMIEŃ DOPASOWANIE
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ========================================================
                          ETAP 2: PRZYCISK ODCZYTU LOT I MHD
                          (Odblokowywany WYŁĄCZNIE po zatwierdzeniu produktu)
                          ======================================================== */}
                      {photo.status === 'LOT_MHD_PENDING' && (
                        <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-bold text-emerald-950 block">
                              Etap 2: Rzeczywisty odczyt numeru serii (LOT) oraz daty ważności (MHD / BBE)
                            </span>
                            <span className="text-[11px] text-emerald-800">
                              System przeszuka nadruki LOT: oraz daty MHD: / BBE: (zawsze ostatni dzień miesiąca).
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartManualEntry(photo.id)}
                              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              <span>✏️ Wpisz ręcznie</span>
                            </button>

                            <button
                              onClick={() =>
                                setCropModalData({
                                  isOpen: true,
                                  photoId: photo.id,
                                  photoUrl: photo.photoUrl,
                                  photoFile: photo.file,
                                  productName: matchedProduct?.name || 'Produkt',
                                })
                              }
                              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              <ZoomIn className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Zaznacz fragment (Zoom)</span>
                            </button>

                            <button
                              onClick={() => handleRunStage2LotMhd(photo.id)}
                              disabled={photo.isAnalyzingLotMhd}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                            >
                              {photo.isAnalyzingLotMhd ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Analiza wizualna zdjęcia...</span>
                                </>
                              ) : (
                                <>
                                  <Search className="w-4 h-4" />
                                  <span>🔍 Odczytaj LOT i MHD / BBE</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ========================================================
                          KOMUNIKAT GDY OCR NIE ZNALAZŁ DANYCH
                          ======================================================== */}
                      {hasNoDataAtAll && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
                          <div className="flex items-center gap-2 text-amber-900 font-semibold">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Nie znaleziono oznaczenia LOT/MHD na przypisanym zdjęciu.</span>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            Nadruk może być niewyraźny lub znajdować się w innym miejscu kartonika.
                            Możesz powiększyć fragment zdjęcia z tuszem lub wpisać dane ręcznie.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleRunStage2LotMhd(photo.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>🔄 SPRÓBUJ ODCZYTAĆ PONOWNIE</span>
                            </button>

                            <button
                              onClick={() =>
                                setCropModalData({
                                  isOpen: true,
                                  photoId: photo.id,
                                  photoUrl: photo.photoUrl,
                                  photoFile: photo.file,
                                  productName: matchedProduct?.name || 'Produkt',
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <ZoomIn className="w-3 h-3 text-emerald-600" />
                              <span>🔍 ZAZNACZ FRAGMENT (ZOOM)</span>
                            </button>

                            <button
                              onClick={() => handleStartManualEntry(photo.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>✏️ WPISZ RĘCZNIE</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ========================================================
                          WYNIK ODCZYTU (LOT / MHD / ILOŚĆ) LUB FORMULARZ RĘCZNY
                          ======================================================== */}
                      {(photo.status === 'LOT_MHD_READ' ||
                        photo.status === 'MANUAL_VERIFICATION_REQUIRED' ||
                        photo.status === 'CONFIRMED' ||
                        photo.isManualEntry) &&
                        (!hasNoDataAtAll || photo.isManualEntry) && (
                          <div className="space-y-2.5">
                            {/* Nagłówek statusu produktu i pozycji */}
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Produkt:</span>
                                <span className="font-bold text-slate-900">
                                  {matchedProduct?.name || photo.recognizedProductName}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Pozycja faktury:</span>
                                <span className="font-bold text-emerald-800">
                                  {photo.matchedInvoiceItemIndex || 1}
                                </span>
                              </div>
                            </div>

                            {photo.batches.map((batch, bIndex) => {
                              const hasLotValue = Boolean(batch.lot && batch.lot.trim() !== '');
                              const hasMhdValue = Boolean(batch.mhd && batch.mhd.trim() !== '');

                              return (
                                <div
                                  key={batch.id}
                                  className={`p-3 rounded-lg border transition-all ${
                                    batch.status === 'PEWNY'
                                      ? 'bg-white border-slate-200'
                                      : 'bg-amber-50/30 border-amber-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900">
                                        Partia #{bIndex + 1}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          batch.status === 'PEWNY'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-amber-100 text-amber-800 flex items-center gap-1'
                                        }`}
                                      >
                                        {batch.status === 'PEWNY' ? (
                                          '✓ PEWNY'
                                        ) : (
                                          <>
                                            <AlertTriangle className="w-3 h-3" />
                                            DO WERYFIKACJI
                                          </>
                                        )}
                                      </span>
                                    </div>

                                    {photo.batches.length > 1 && (
                                      <button
                                        onClick={() => handleRemoveBatch(photo.id, batch.id)}
                                        className="text-slate-400 hover:text-red-600 text-xs"
                                      >
                                        Usuń partię
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* LOT */}
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5 flex items-center justify-between">
                                        <span>LOT:</span>
                                        {hasLotValue ? (
                                          <span className="text-emerald-700 font-bold">
                                            {batch.lot} ✓
                                          </span>
                                        ) : (
                                          <span className="text-amber-700 font-bold">
                                            nie znaleziono ⚠️
                                          </span>
                                        )}
                                      </label>
                                      <input
                                        type="text"
                                        value={batch.lot}
                                        onChange={(e) =>
                                          handleUpdateBatchField(photo.id, batch.id, 'lot', e.target.value)
                                        }
                                        placeholder="Wpisz LOT (np. 24G019A)"
                                        className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-emerald-600 focus:outline-none"
                                      />
                                    </div>

                                    {/* MHD / BBE */}
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5 flex items-center justify-between">
                                        <span>MHD / BBE (Data ważności):</span>
                                        {hasMhdValue ? (
                                          <span className="text-emerald-700 font-bold">
                                            {formatDateToDisplay(batch.mhd)} ✓
                                          </span>
                                        ) : (
                                          <span className="text-amber-700 font-bold">
                                            nie znaleziono ⚠️
                                          </span>
                                        )}
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          defaultValue={batch.mhd ? formatDateToDisplay(batch.mhd) : ''}
                                          key={`text-${batch.id}-${batch.mhd}`}
                                          onBlur={(e) =>
                                            handleUpdateBatchField(photo.id, batch.id, 'mhd', e.target.value)
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleUpdateBatchField(photo.id, batch.id, 'mhd', (e.target as HTMLInputElement).value);
                                            }
                                          }}
                                          placeholder="np. 11/2027, 06.27, 30.06.2027"
                                          className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-emerald-600 focus:outline-none"
                                        />
                                        <input
                                          type="date"
                                          value={batch.mhd}
                                          onChange={(e) =>
                                            handleUpdateBatchField(photo.id, batch.id, 'mhd', e.target.value)
                                          }
                                          title="Wybierz z kalendarza"
                                          className="text-xs font-mono bg-white border border-slate-300 rounded px-1.5 py-1.5 cursor-pointer focus:border-emerald-600 focus:outline-none shrink-0"
                                        />
                                      </div>
                                      {hasMhdValue ? (
                                        <span className="text-[10px] text-emerald-800 font-medium mt-0.5 block">
                                          W fakturze KSeF: <strong>{batch.mhd}</strong> (ostatni dzień)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                                          Wpisz np. 11/2027 (przeliczy na ostatni dzień m-ca)
                                        </span>
                                      )}
                                    </div>

                                    {/* Ilość */}
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                        Ilość:
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={batch.quantity}
                                        onChange={(e) =>
                                          handleUpdateBatchField(photo.id, batch.id, 'quantity', e.target.value)
                                        }
                                        className="w-full text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-emerald-600 focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Pasek akcji pod partiami */}
                            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleAddExtraBatch(photo.id)}
                                  className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>+ Dodaj kolejną partię tego produktu</span>
                                </button>

                                <button
                                  onClick={() =>
                                    setCropModalData({
                                      isOpen: true,
                                      photoId: photo.id,
                                      photoUrl: photo.photoUrl,
                                      photoFile: photo.file,
                                      productName: matchedProduct?.name || 'Produkt',
                                    })
                                  }
                                  className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <ZoomIn className="w-3 h-3 text-emerald-600" />
                                  <span>Zaznacz fragment (Zoom)</span>
                                </button>

                                <button
                                  onClick={() => handleRunStage2LotMhd(photo.id)}
                                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Odczytaj ponownie</span>
                                </button>
                              </div>

                              <button
                                onClick={() => handleConfirmLotMhdToInvoice(photo.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer ${
                                  photo.status === 'CONFIRMED'
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {photo.status === 'CONFIRMED'
                                    ? '✓ Zapisano w fakturze'
                                    : 'Zatwierdź i zapisz w fakturze'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Zoom & Wybór obszaru */}
      {cropModalData && (
        <PhotoZoomCropModal
          isOpen={cropModalData.isOpen}
          onClose={() => setCropModalData(null)}
          photoUrl={cropModalData.photoUrl}
          photoFile={cropModalData.photoFile}
          productName={cropModalData.productName}
          onConfirmCropOcr={(cropArea) => {
            handleRunStage2LotMhd(cropModalData.photoId, cropArea);
          }}
        />
      )}

      {/* WYBÓR FORMATU ZAPISU KSEF FA(3) */}
      <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-700" />
            Format zapisu serii i dat ważności w KSeF FA(3):
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {logisticsFormat === 'gs1_composite'
              ? 'Wersja 1: Ciąg GS1 (KSeF)'
              : logisticsFormat === 'separate_fields'
              ? 'Wersja 2: Data ważności & Seria'
              : 'Wersja 3: Bez serii i dat (Standard)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          <div
            onClick={() => onToggleLogisticsFormat('gs1_composite')}
            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              logisticsFormat === 'gs1_composite'
                ? 'bg-white border-pink-500 shadow-xs ring-1 ring-pink-500'
                : 'bg-white/60 border-slate-200 hover:border-pink-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  Ciąg GS1 (KSeF)
                </span>
                {logisticsFormat === 'gs1_composite' && <Check className="w-4 h-4 text-pink-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Oficjalny standard KSeF dla hurtowni i sieci aptecznych. Łączy serię, ważność i ilość w jeden ciąg GS1 w węźle DodatkowyOpis.
              </p>
            </div>
            <div className="mt-2 p-1.5 bg-slate-100 rounded border border-slate-200 font-mono text-[10px] text-slate-800">
              <span className="text-slate-500">GS1:</span> <span className="font-semibold text-rose-800">(10)24G019A(17)270630(37)4</span>
            </div>
          </div>

          <div
            onClick={() => onToggleLogisticsFormat('separate_fields')}
            className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between ${
              logisticsFormat === 'separate_fields'
                ? 'bg-white border-emerald-600 shadow-xs ring-1 ring-emerald-600'
                : 'bg-white/60 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  Osobne pola DodatkowyOpis
                </span>
                {logisticsFormat === 'separate_fields' && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Dwa osobne węzły w DodatkowyOpis: „Data ważności” oraz „Seria” (ilość nie jest dodawana).
              </p>
            </div>
            <div className="mt-2 p-1.5 bg-slate-100 rounded border border-slate-200 font-mono text-[10px] text-slate-800">
              <span className="text-slate-500">Węzły:</span> Data ważności & Seria
            </div>
          </div>

          <div
            onClick={() => onToggleLogisticsFormat('none')}
            className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between ${
              logisticsFormat === 'none'
                ? 'bg-white border-blue-600 shadow-xs ring-1 ring-blue-600'
                : 'bg-white/60 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  Bez serii i dat ważności
                </span>
                {logisticsFormat === 'none' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Standardowa faktura KSeF. Pozycje nie posiadają serii i dat ważności (brak węzłów DodatkowyOpis).
              </p>
            </div>
            <div className="mt-2 p-1.5 bg-slate-100 rounded border border-slate-200 font-mono text-[10px] text-slate-600">
              <span className="text-slate-500">XML:</span> Czyste wiersze &lt;FaWiersz&gt;
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
