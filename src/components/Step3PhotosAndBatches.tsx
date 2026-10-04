import React, { useRef, useState, useEffect, useCallback } from 'react';
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
import { evaluateShelfLife, getRequiredShelfLifeRule } from '../utils/expiryDateValidator';
import { compressImageToDataUrl } from '../utils/imageUtils';
import {
  WorkstationRole,
  getWorkstationRole,
  setWorkstationRole,
  getWorkstationName,
  getSharedPackagingPhotos,
  uploadSharedPackagingPhotos,
  deleteSharedPackagingPhoto,
  clearSharedPackagingPhotos,
  dataUrlToFile,
  subscribeToMultiUserSync,
} from '../utils/cloudSyncService';
import { PhotoZoomCropModal } from './PhotoZoomCropModal';
import { OrderPackagingPhoto } from '../types/ordersHistory';

interface Step3PhotosAndBatchesProps {
  logisticsFormat: LogisticsFormat;
  onToggleLogisticsFormat: (format: LogisticsFormat) => void;
  items: InvoiceItem[];
  selectedChain?: string;
  buyerName?: string;
  buyerNip?: string;
  onUpdateItem: (id: string, updatedFields: Partial<InvoiceItem>) => void;
  onOcrCompleted?: (ocrResults: any[]) => void;
  onOpenAiGuide?: () => void;
  orderPackagingPhotos?: OrderPackagingPhoto[];
  onOrderPackagingPhotosChange?: (photos: OrderPackagingPhoto[]) => void;
  onSendTaskToWarehouse?: () => Promise<void> | void;
  warehouseTaskStatus?: 'none' | 'assigned' | 'in_progress' | 'completed';
}

export const Step3PhotosAndBatches: React.FC<Step3PhotosAndBatchesProps> = ({
  logisticsFormat,
  onToggleLogisticsFormat,
  items,
  selectedChain,
  buyerName,
  buyerNip,
  onUpdateItem,
  orderPackagingPhotos,
  onOrderPackagingPhotosChange,
  onSendTaskToWarehouse,
  warehouseTaskStatus = 'none',
}) => {
  const shelfLifeRule = getRequiredShelfLifeRule(selectedChain, buyerName, buyerNip);
  const [photoItems, setPhotoItems] = useState<PhotoVerificationItem[]>([]);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [changingMatchPhotoId, setChangingMatchPhotoId] = useState<string | null>(null);
  const [workstationRole, setWorkstationRoleState] = useState<WorkstationRole>(() =>
    getWorkstationRole()
  );
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isSyncingPhotos, setIsSyncingPhotos] = useState(false);

  // Modal zoomu i zaznaczania fragmentu
  const [cropModalData, setCropModalData] = useState<{
    isOpen: boolean;
    photoId: string;
    photoUrl: string;
    photoFile: File;
    productName: string;
  } | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleSwitchRole = (newRole: WorkstationRole) => {
    setWorkstationRole(newRole);
    setWorkstationRoleState(newRole);
    setSyncNotice(
      newRole === 'warehouse'
        ? '📦 Przełączono na Stanowisko 2: Magazyn (widok zadań magazynowych)'
        : '👩‍💼 Przełączono na Stanowisko 1: Koordynator (przypisywanie zdjęć z Magazynu do pozycji i weryfikacja LOT/MHD)'
    );
    setTimeout(() => setSyncNotice(null), 5000);
  };

  /**
   * Pobiera zdjęcia opakowań przypisane do bieżącego zamówienia (oraz z bufora Chmury Live przy ręcznym odbiorze z Magazynu)
   */
  const syncPackagingPhotosFromCloud = useCallback(
    async (includeSharedBuffer = false) => {
      setIsSyncingPhotos(true);
      try {
        const orderAssigned = Array.isArray(orderPackagingPhotos) ? orderPackagingPhotos : [];
        const shared = includeSharedBuffer ? await getSharedPackagingPhotos() : [];
        const combinedPhotos = [
          ...orderAssigned,
          ...(Array.isArray(shared) ? shared : []),
        ];
        if (combinedPhotos.length === 0) {
          setIsSyncingPhotos(false);
          return;
        }

        // Jeśli odebrano nowe zdjęcia z bufora Magazynu, przypisz je trwale do bieżącego zamówienia i opróżnij bufor tymczasowy
        if (includeSharedBuffer && Array.isArray(shared) && shared.length > 0) {
          const existingOrderIds = new Set(orderAssigned.map((p) => p.id));
          const newFromShared = shared.filter((p) => p?.id && !existingOrderIds.has(p.id));
          if (newFromShared.length > 0) {
            onOrderPackagingPhotosChange?.([...orderAssigned, ...newFromShared]);
          }
          await clearSharedPackagingPhotos();
        }

        const isSingleItem = items && items.length === 1;
        const defaultMatchedItem = isSingleItem ? items[0] : null;
        const newlyAddedForStage1: PhotoVerificationItem[] = [];

        setPhotoItems((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const toAdd: PhotoVerificationItem[] = [];

          for (const sp of combinedPhotos) {
            if (!sp?.id || !sp?.dataUrl || existingIds.has(sp.id)) continue;
            existingIds.add(sp.id);
            const reconstructedFile = dataUrlToFile(sp.dataUrl, sp.fileName || 'opakowanie.jpg');
            const isCoordinator = getWorkstationRole() === 'coordinator';
            const rec: PhotoVerificationItem = {
              id: sp.id,
              file: reconstructedFile,
              fileName: `${sp.fileName} (${sp.uploadedBy || 'Magazyn'})`,
              photoUrl: sp.dataUrl,
              status: isSingleItem ? 'LOT_MHD_PENDING' : 'PRODUCT_PENDING',
              recognizedProductName: defaultMatchedItem?.name || '',
              recognizedGtin: defaultMatchedItem?.gtin || '',
              matchedInvoiceItemId: defaultMatchedItem?.id,
              matchedInvoiceItemIndex: isSingleItem ? 1 : undefined,
              isConfidentProductMatch: isSingleItem,
              isAnalyzingProduct: isCoordinator && !isSingleItem,
              batches: [],
            };
            toAdd.push(rec);
            if (isCoordinator && !isSingleItem) {
              newlyAddedForStage1.push(rec);
            }
          }

          if (toAdd.length === 0) return prev;
          if (includeSharedBuffer) {
            setSyncNotice(
              `📥 Odebrano z Magazynu ${toAdd.length} ${
                toAdd.length === 1 ? 'nowe zdjęcie opakowania' : 'nowe zdjęcia opakowań'
              } i przypisano do tego zamówienia!`
            );
            setTimeout(() => setSyncNotice(null), 5500);
          }
          return [...prev, ...toAdd];
        });

        // Jeśli jesteśmy na Stanowisku 1 (Koordynator), automatycznie uruchom Etap 1 (rozpoznanie produktu) dla nowych zdjęć
        for (const rec of newlyAddedForStage1) {
          try {
            const stage1Res = await runStage1ProductRecognition(rec.file, items);
            setPhotoItems((prev) =>
              prev.map((item) => {
                if (item.id !== rec.id) return item;
                if (
                  item.status === 'LOT_MHD_PENDING' ||
                  item.status === 'LOT_MHD_READ' ||
                  item.status === 'CONFIRMED' ||
                  item.status === 'MANUAL_VERIFICATION_REQUIRED'
                ) {
                  return { ...item, isAnalyzingProduct: false };
                }
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
          } catch {
            setPhotoItems((prev) =>
              prev.map((item) =>
                item.id === rec.id
                  ? { ...item, status: 'PRODUCT_PENDING', isAnalyzingProduct: false }
                  : item
              )
            );
          }
        }
      } finally {
        setIsSyncingPhotos(false);
      }
    },
    [items, orderPackagingPhotos, onOrderPackagingPhotosChange]
  );

  useEffect(() => {
    syncPackagingPhotosFromCloud(false);
    const unsub = subscribeToMultiUserSync({
      onRemoteUpdate: (ev) => {
        setWorkstationRoleState(getWorkstationRole());
        if (ev.activity?.type === 'PACKAGING_PHOTOS_UPLOADED') {
          syncPackagingPhotosFromCloud(true);
        } else if (
          ev.activity?.type === 'WAREHOUSE_PHOTOS_UPDATED' ||
          ev.activity?.type === 'WAREHOUSE_TASK_COMPLETED' ||
          ev.activity?.type === 'MANUAL_CLOUD_SYNC'
        ) {
          syncPackagingPhotosFromCloud(false);
        }
      },
    });
    return () => unsub();
  }, [syncPackagingPhotosFromCloud]);

  /**
   * Dodaje nowe zdjęcia i przypisuje je bezpośrednio do bieżącego zamówienia na karcie:
   * - Na Stanowisku 2 (Magazyn): kompresuje, przypisuje do zamówienia i wysyła do Chmury Live dla Koordynatora.
   * - Na Stanowisku 1 (Koordynator): przypisuje trwale do bieżącego zamówienia i uruchamia Etap 1 (Rozpoznanie produktu).
   */
  const handleAddNewPhotos = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const currentRole = getWorkstationRole();
    const isSingleItem = items && items.length === 1;
    const defaultMatchedItem = isSingleItem ? items[0] : null;

    const newPhotoRecords: PhotoVerificationItem[] = imageFiles.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      fileName: file.name,
      photoUrl: URL.createObjectURL(file),
      status: isSingleItem ? 'LOT_MHD_PENDING' : 'PRODUCT_PENDING',
      recognizedProductName: defaultMatchedItem?.name || '',
      recognizedGtin: defaultMatchedItem?.gtin || '',
      matchedInvoiceItemId: defaultMatchedItem?.id,
      matchedInvoiceItemIndex: isSingleItem ? 1 : undefined,
      isConfidentProductMatch: isSingleItem,
      isAnalyzingProduct: currentRole === 'coordinator' && !isSingleItem,
      batches: [],
    }));

    setPhotoItems((prev) => [...prev, ...newPhotoRecords]);

    // Skompresuj zdjęcia i przypisz je bezpośrednio do bieżącego zamówienia na karcie
    (async () => {
      try {
        const compressedList: OrderPackagingPhoto[] = [];
        for (const rec of newPhotoRecords) {
          const dataUrl = await compressImageToDataUrl(rec.file, 1600, 0.85);
          compressedList.push({
            id: rec.id,
            fileName: rec.fileName,
            dataUrl,
            uploadedBy: getWorkstationName(),
            uploadedAt: new Date().toISOString(),
          });
        }
        const existingOrderPhotos = Array.isArray(orderPackagingPhotos) ? orderPackagingPhotos : [];
        const existingIds = new Set(existingOrderPhotos.map((p) => p.id));
        const mergedForOrder = [
          ...existingOrderPhotos,
          ...compressedList.filter((p) => !existingIds.has(p.id)),
        ];
        onOrderPackagingPhotosChange?.(mergedForOrder);

        if (currentRole === 'warehouse') {
          await uploadSharedPackagingPhotos(compressedList, getWorkstationName());
          setSyncNotice(
            `☁️ Wysłano ${compressedList.length} ${
              compressedList.length === 1 ? 'zdjęcie opakowania' : 'zdjęcia opakowań'
            } do Stanowiska 1 (Koordynator) i przypisano do zamówienia!`
          );
          setTimeout(() => setSyncNotice(null), 6000);
        }
      } catch (e) {
        console.warn('Błąd zapisu zdjęć opakowań do zamówienia:', e);
      }
    })();

    // Jeśli to Stanowisko 2 (Magazyn) lub faktura ma tylko 1 pozycję, nie uruchamiamy Etapu 1 po stronie Magazynu
    if (currentRole === 'warehouse' || isSingleItem) {
      return;
    }

    for (const record of newPhotoRecords) {
      try {
        const stage1Res = await runStage1ProductRecognition(record.file, items);

        setPhotoItems((prev) =>
          prev.map((item) => {
            if (item.id !== record.id) return item;

            // Jeśli użytkownik już ręcznie przypisał pozycję lub przeszedł dalej, nie cofaj statusu!
            if (
              item.status === 'LOT_MHD_PENDING' ||
              item.status === 'LOT_MHD_READ' ||
              item.status === 'CONFIRMED' ||
              item.status === 'MANUAL_VERIFICATION_REQUIRED'
            ) {
              return {
                ...item,
                isAnalyzingProduct: false,
              };
            }

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
   * Wybranie pozycji z listy rozwijanej natychmiast zatwierdza przypisanie (LOT_MHD_PENDING)
   * bez zmuszania użytkownika do ponownego, drugiego klikania przycisku zatwierdzenia.
   */
  const handleManualProductSelect = (photoId: string, invoiceItemId: string) => {
    if (!invoiceItemId) return;
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
          status: 'LOT_MHD_PENDING',
          isConfidentProductMatch: true,
          isAnalyzingProduct: false,
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
    const currentOrderPhotos = Array.isArray(orderPackagingPhotos) ? orderPackagingPhotos : [];
    onOrderPackagingPhotosChange?.(currentOrderPhotos.filter((p) => p.id !== photoId));
    deleteSharedPackagingPhoto(photoId);
  };

  const handleClearAllPhotos = () => {
    setPhotoItems([]);
    onOrderPackagingPhotosChange?.([]);
    clearSharedPackagingPhotos();
  };

  return (
    <div className="bg-white/95 border-2 border-slate-600 rounded-2xl p-5 mb-6 shadow-md">
      {/* Nagłówek sekcji */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-slate-300">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shadow-2xs">
              3
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-fuchsia-600" />
                <span>Zdjęcia Opakowań – Weryfikacja Produktu i Odczyt LOT/MHD (OCR)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Magazyn wgrywa zdjęcia opakowań ➔ Koordynator przypisuje je do pozycji faktury i weryfikuje serie LOT oraz daty MHD
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {logisticsFormat === 'none' ? (
            <span className="text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 px-2.5 py-1 rounded-lg">
              Tryb: Faktura bez serii i dat
            </span>
          ) : (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>
                {workstationRole === 'warehouse'
                  ? '📦 Dodaj zdjęcia z Magazynu'
                  : '📷 Dodaj zdjęcie produktu'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* PASEK WSPÓŁPRACY CHMURA LIVE: 1. KOORDYNATOR <-> 2. MAGAZYN */}
      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            ☁️ Chmura Live — Tryb stanowiska:
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSwitchRole('coordinator')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                workstationRole === 'coordinator'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Stanowisko 1: Przypisuje zdjęcia z Magazynu do pozycji na fakturze i weryfikuje LOT/MHD"
            >
              <span>👩‍💼 1. Koordynator (Przypisanie i weryfikacja)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchRole('warehouse')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                workstationRole === 'warehouse'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Stanowisko 2: Tylko wgrywa zdjęcia opakowań do Chmury Live dla Koordynatora"
            >
              <span>📦 2. Magazyn (Wgrywanie zdjęć opakowań)</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => syncPackagingPhotosFromCloud(true)}
            disabled={isSyncingPhotos}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            title="Pobierz najnowsze zdjęcia opakowań wgrane przez Stanowisko 2 (Magazyn)"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingPhotos ? 'animate-spin' : ''}`} />
            <span>Odbierz zdjęcia z Magazynu</span>
          </button>
        </div>
      </div>

      {/* Powiadomienie o synchronizacji zdjęć Magazyn <-> Koordynator */}
      {syncNotice && (
        <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Baner informacyjny gdy wybrano Stanowisko 2: Magazyn */}
      {workstationRole === 'warehouse' && (
        <div className="mt-3 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
          <span className="text-lg">📦</span>
          <div>
            <p className="font-bold text-amber-900">
              Jesteś w trybie Stanowiska 2: Magazyn (Wgrywanie zdjęć opakowań)
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Dodaj poniżej zdjęcia opakowań z widocznym numerem serii (<code>LOT</code>) i datą ważności (<code>MHD</code>). Zdjęcia zostaną <strong>automatycznie przesłane przez Chmurę Live do Stanowiska 1 (Koordynator)</strong>, który przypisze je do odpowiednich pozycji na fakturze i zweryfikuje dane.
            </p>
          </div>
        </div>
      )}

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
                {selectedChain === 'Super-Pharm' || (buyerNip || '').replace(/\D/g, '') === '5213842837'
                  ? 'Uwaga: Super-Pharm wymaga dat ważności (MHD) oraz serii (LOT) w osobnych wierszach <DodatkowyOpis>!'
                  : 'W tym trybie zdjęcia i odczyt LOT/MHD są pomijane. Faktura zostanie wygenerowana z czystymi pozycjami towarowymi <FaWiersz> bez węzłów <DodatkowyOpis>.'}
              </p>
            </div>
          </div>
          {selectedChain === 'Super-Pharm' ||
          selectedChain === 'Gemini' ||
          (buyerNip || '').replace(/\D/g, '') === '5213842837' ? (
            <button
              onClick={() => onToggleLogisticsFormat('separate_fields')}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Włącz daty ważności (Osobne wiersze)
            </button>
          ) : (
            <button
              onClick={() => onToggleLogisticsFormat('gs1_composite')}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Włącz serie i daty (GS1)
            </button>
          )}
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
          e.target.value = '';
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
              : workstationRole === 'warehouse'
              ? 'border-amber-300 hover:border-amber-400 bg-amber-50/30 hover:bg-amber-50/50'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <div className="w-12 h-12 mx-auto mb-2.5 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
            <Camera className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {workstationRole === 'warehouse'
              ? '📦 Kliknij lub upuść zdjęcia opakowań z Magazynu (trafią od razu do Koordynatora)'
              : 'Kliknij „📷 Dodaj zdjęcie produktu” lub upuść zdjęcia opakowań'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {workstationRole === 'warehouse'
              ? 'Wystarczy zrobić zdjęcia opakowań z widocznym nadrukiem LOT i MHD. Przypisaniem do pozycji i weryfikacją zajmie się Stanowisko 1 (Koordynator).'
              : 'W Etapie 1 przypisujesz produkt z faktury. Dopiero po zatwierdzeniu uruchomisz analizę wizualną nadruku LOT / MHD z możliwością powiększenia fragmentu (Zoom).'}
          </p>
        </div>
      )}

      {/* LISTA ZDJĘĆ Z DWUETAPOWYM PROCESEM */}
      {photoItems.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Przesłane zdjęcia w Chmurze Live ({photoItems.length}):
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
                onClick={handleClearAllPhotos}
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
                  className={`border-2 rounded-xl p-4 transition-all shadow-xs ${
                    photo.status === 'CONFIRMED'
                      ? 'border-emerald-600 bg-emerald-50/20'
                      : photo.status === 'MANUAL_VERIFICATION_REQUIRED'
                      ? 'border-amber-500 bg-amber-50/15'
                      : 'border-slate-500 bg-white'
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
                    {workstationRole === 'warehouse' ? (
                      <div className="flex-1 w-full p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>☁️ Zdjęcie przekazane w Chmurze Live do Koordynatora</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium mt-1">
                            Plik: <strong>{photo.fileName}</strong>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Stanowisko 1 (Koordynator) przypisze to opakowanie do pozycji zamówienia i zweryfikuje serię <code>LOT</code> oraz datę ważności <code>MHD</code>.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSwitchRole('coordinator')}
                          className="px-3 py-1.5 text-[11px] font-bold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer shrink-0"
                        >
                          👩‍💼 Przełącz na Koordynatora (przypisz i zweryfikuj)
                        </button>
                      </div>
                    ) : (
                    <div className="flex-1 w-full space-y-3">
                      {/* ========================================================
                          ETAP 1: ROZPOZNANIE I ZATWIERDZENIE PRODUKTU
                          ======================================================== */}
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-emerald-600" />
                            Etap 1 (Koordynator): Przypisanie zdjęcia opakowania do pozycji faktury
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
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Dopasowana pozycja faktury:</span>
                              {photo.matchedInvoiceItemId && changingMatchPhotoId !== photo.id && photo.status !== 'CONFIRMED' && (
                                <button
                                  type="button"
                                  onClick={() => setChangingMatchPhotoId(photo.id)}
                                  className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                >
                                  Zmień
                                </button>
                              )}
                            </div>
                            <span className="font-bold text-emerald-900 block truncate">
                              {matchedProduct
                                ? `${photo.matchedInvoiceItemIndex || 1}. ${matchedProduct.name}`
                                : '— Wybierz pozycję —'}
                            </span>
                          </div>
                        </div>

                        {/* Potwierdzenie lub zmiana pozycji */}
                        {(photo.status === 'PRODUCT_PENDING' || photo.status === 'PRODUCT_MATCHED' || changingMatchPhotoId === photo.id) && (
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
                                {changingMatchPhotoId === photo.id && (
                                  <button
                                    type="button"
                                    onClick={() => setChangingMatchPhotoId(null)}
                                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
                                  >
                                    Anuluj
                                  </button>
                                )}
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
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                          <span className="text-[10px] text-emerald-800 font-medium">
                                            W fakturze KSeF: <strong>{batch.mhd}</strong>
                                          </span>
                                          {(() => {
                                            const evalRes = evaluateShelfLife(batch.mhd, new Date(), shelfLifeRule.minMonths);
                                            if (evalRes.status === 'valid') {
                                              return (
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title={evalRes.warningMessage}>
                                                  ✓ {evalRes.formattedMonths} (OK)
                                                </span>
                                              );
                                            }
                                            if (evalRes.status === 'short_warning') {
                                              return (
                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs" title={evalRes.warningMessage}>
                                                  ⚠️ &lt; {evalRes.requiredMonths} msc ({evalRes.formattedMonths})
                                                </span>
                                              );
                                            }
                                            if (evalRes.status === 'expired') {
                                              return (
                                                <span className="text-[10px] font-bold text-red-800 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                                                  🚨 Przeterminowany!
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
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
                    )}
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
