import React, { useState, useMemo } from 'react';
import {
  Camera,
  Package,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  X,
  Building,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  Search,
  ClipboardCheck,
  FileText,
} from 'lucide-react';
import { ArchivedOrder, OrderPackagingPhoto, WarehouseTaskStatus } from '../types/ordersHistory';
import { updateArchivedOrderFields } from '../utils/ordersStorage';
import { compressImageToDataUrl } from '../utils/imageUtils';
import {
  getWorkstationName,
  uploadSharedPackagingPhotos,
  deleteSharedPackagingPhoto,
} from '../utils/cloudSyncService';
import { detectPharmacyChain } from '../utils/orderParser';

interface WarehouseWorkstationViewProps {
  orders: ArchivedOrder[];
  onRefreshOrders: () => Promise<void> | void;
  onSwitchToCoordinator?: () => void;
}

type WarehouseFilterTab = 'active' | 'product_photos' | 'parcel_photos';

type WarehouseTaskType = 'product_photos' | 'parcel_photos';

interface WarehouseSplitTaskItem {
  key: string;
  taskType: WarehouseTaskType;
  order: ArchivedOrder;
  status: WarehouseTaskStatus;
  assignedAt?: string | null;
  completedAt?: string | null;
  note?: string | null;
}

export const WarehouseWorkstationView: React.FC<WarehouseWorkstationViewProps> = ({
  orders,
  onRefreshOrders,
  onSwitchToCoordinator,
}) => {
  const [activeTab, setActiveTab] = useState<WarehouseFilterTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemsTaskKey, setExpandedItemsTaskKey] = useState<string | null>(null);
  const [uploadingPackagingOrderId, setUploadingPackagingOrderId] = useState<string | null>(null);
  const [uploadingParcelOrderId, setUploadingParcelOrderId] = useState<string | null>(null);
  const [statusUpdatingKey, setStatusUpdatingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Lightbox do podglądu zdjęć (opakowań produktów lub gotowych przesyłek)
  const [lightbox, setLightbox] = useState<{
    title: string;
    photos: string[];
    currentIndex: number;
  } | null>(null);

  // Budujemy dwa oddzielne typy AKTYWNYCH zadań przypisanych przez Koordynatora (zadania wykonane znikają ze stanowiska Magazyn):
  // 1. Z karty zamówienia: "Uzupełnij zdjęcia produktów" (product_photos)
  // 2. Z folderu W REALIZACJI: "Uzupełnij zdjęcia gotowej przesyłki" (parcel_photos)
  const splitTasks = useMemo<WarehouseSplitTaskItem[]>(() => {
    const list: WarehouseSplitTaskItem[] = [];

    for (const ord of orders) {
      if (ord.isDelivered) continue;

      const productStatus: WarehouseTaskStatus =
        ord.warehouseProductTaskStatus ||
        (ord.warehouseTaskStatus &&
        ord.warehouseTaskStatus !== 'none' &&
        (!ord.warehouseParcelTaskStatus || ord.warehouseParcelTaskStatus === 'none')
          ? ord.warehouseTaskStatus
          : 'none');

      const parcelStatus: WarehouseTaskStatus = ord.warehouseParcelTaskStatus || 'none';

      if (productStatus === 'assigned' || productStatus === 'in_progress') {
        list.push({
          key: `${ord.id}-product`,
          taskType: 'product_photos',
          order: ord,
          status: productStatus,
          assignedAt: ord.warehouseProductTaskAssignedAt || ord.warehouseTaskAssignedAt || ord.updatedAt,
          completedAt: null,
          note: ord.warehouseProductTaskNote ?? ord.warehouseTaskNote ?? null,
        });
      }

      if (parcelStatus === 'assigned' || parcelStatus === 'in_progress') {
        list.push({
          key: `${ord.id}-parcel`,
          taskType: 'parcel_photos',
          order: ord,
          status: parcelStatus,
          assignedAt: ord.warehouseParcelTaskAssignedAt || ord.updatedAt,
          completedAt: null,
          note: ord.warehouseParcelTaskNote ?? ord.warehouseTaskNote ?? null,
        });
      }
    }

    return list.sort((a, b) => {
      const tA = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
      const tB = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
      return tB - tA;
    });
  }, [orders]);

  const counts = useMemo(() => {
    const productActive = splitTasks.filter((t) => t.taskType === 'product_photos').length;
    const parcelActive = splitTasks.filter((t) => t.taskType === 'parcel_photos').length;
    return {
      active: splitTasks.length,
      productActive,
      parcelActive,
    };
  }, [splitTasks]);

  const filteredTasks = useMemo(() => {
    return splitTasks.filter((task) => {
      const ord = task.order;

      if (activeTab === 'product_photos' && task.taskType !== 'product_photos') {
        return false;
      }
      if (activeTab === 'parcel_photos' && task.taskType !== 'parcel_photos') {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOrderNo = (ord.orderNumber || '').toLowerCase().includes(q);
        const matchInvNo = (ord.invoiceNumber || '').toLowerCase().includes(q);
        const matchBuyer = (ord.buyer?.name || '').toLowerCase().includes(q);
        const matchThirdParty = (ord.thirdParty?.name || '').toLowerCase().includes(q);
        const matchChain = (ord.chain || '').toLowerCase().includes(q);
        const matchItem = (ord.items || []).some(
          (it) =>
            (it.name || '').toLowerCase().includes(q) || (it.gtin || '').toLowerCase().includes(q)
        );
        if (
          !matchOrderNo &&
          !matchInvNo &&
          !matchBuyer &&
          !matchThirdParty &&
          !matchChain &&
          !matchItem
        ) {
          return false;
        }
      }

      return true;
    });
  }, [splitTasks, activeTab, searchQuery]);

  const getChainBadgeStyle = (chain: string) => {
    switch (chain) {
      case 'DOZ':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Dr. Max':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Super-Pharm':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Gemini':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  /**
   * 1. Dodawanie zdjęć produktów (LOT / MHD) dla Zadania 1
   */
  const handleAddPackagingPhotos = async (ord: ArchivedOrder, fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setUploadingPackagingOrderId(ord.id);
    try {
      const workstation = getWorkstationName();
      const newPhotos: OrderPackagingPhoto[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await compressImageToDataUrl(file, 1080, 0.72);
        newPhotos.push({
          id: `pkg-${ord.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          dataUrl,
          uploadedBy: workstation,
          uploadedAt: new Date().toISOString(),
          orderId: ord.id,
          orderNumber: ord.orderNumber || ord.invoiceNumber,
        });
      }

      const existingPkg = Array.isArray(ord.packagingPhotos) ? ord.packagingPhotos : [];
      const updatedPkg = [...existingPkg, ...newPhotos];
      const nextStatus: WarehouseTaskStatus =
        ord.warehouseProductTaskStatus === 'completed' ? 'completed' : 'in_progress';

      await updateArchivedOrderFields(ord.id, {
        packagingPhotos: updatedPkg,
        warehouseProductTaskStatus: nextStatus,
        warehouseTaskStatus: nextStatus,
      });

      // Wyślij także do kolejki Chmury Live dla Kroku 3 (z przypisanym orderId i orderNumber)
      await uploadSharedPackagingPhotos(
        newPhotos.map((p) => ({
          ...p,
          orderHint: `${ord.chain} - ${ord.orderNumber || ord.invoiceNumber}`,
        })),
        workstation
      );

      await onRefreshOrders();
      setNotice(
        `📷 Dodano ${newPhotos.length} ${
          newPhotos.length === 1 ? 'zdjęcie produktu' : 'zdjęcia produktów'
        } (LOT/MHD) do zamówienia nr ${ord.orderNumber || ord.invoiceNumber}!`
      );
      setTimeout(() => setNotice(null), 5000);
    } catch (e) {
      console.error('Błąd dodawania zdjęć produktów:', e);
    } finally {
      setUploadingPackagingOrderId(null);
    }
  };

  const handleDeletePackagingPhoto = async (ord: ArchivedOrder, photoId: string) => {
    const existingPkg = Array.isArray(ord.packagingPhotos) ? ord.packagingPhotos : [];
    const updatedPkg = existingPkg.filter((p) => p.id !== photoId);

    await updateArchivedOrderFields(ord.id, {
      packagingPhotos: updatedPkg,
    });
    await deleteSharedPackagingPhoto(photoId);
    await onRefreshOrders();
  };

  /**
   * 2. Dodawanie zdjęć gotowej przesyłki (paczki / palety) dla Zadania 2
   */
  const handleAddParcelPhotos = async (ord: ArchivedOrder, fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setUploadingParcelOrderId(ord.id);
    try {
      const compressedUrls: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageToDataUrl(file, 1024, 0.70);
        compressedUrls.push(dataUrl);
      }

      const existingParcels = Array.isArray(ord.parcelPhotos) ? ord.parcelPhotos : [];
      const updatedParcels = [...existingParcels, ...compressedUrls];
      const nextStatus: WarehouseTaskStatus =
        ord.warehouseParcelTaskStatus === 'completed' ? 'completed' : 'in_progress';

      await updateArchivedOrderFields(ord.id, {
        parcelPhotos: updatedParcels,
        warehouseParcelTaskStatus: nextStatus,
        warehouseTaskStatus: nextStatus,
      });

      await onRefreshOrders();
      setNotice(
        `📦 Dodano ${compressedUrls.length} ${
          compressedUrls.length === 1
            ? 'zdjęcie gotowej przesyłki'
            : 'zdjęcia gotowej przesyłki'
        } do zamówienia nr ${ord.orderNumber || ord.invoiceNumber}!`
      );
      setTimeout(() => setNotice(null), 5000);
    } catch (e) {
      console.error('Błąd dodawania zdjęć gotowej przesyłki:', e);
    } finally {
      setUploadingParcelOrderId(null);
    }
  };

  const handleDeleteParcelPhoto = async (ord: ArchivedOrder, index: number) => {
    const existingParcels = Array.isArray(ord.parcelPhotos) ? ord.parcelPhotos : [];
    const updatedParcels = existingParcels.filter((_, idx) => idx !== index);

    await updateArchivedOrderFields(ord.id, {
      parcelPhotos: updatedParcels,
    });
    await onRefreshOrders();
  };

  /**
  /**
   * 3. Oznaczenie konkretnego zadania (Zadania 1 lub Zadania 2) jako wykonane / przekazane Koordynatorowi
   *    (zadania wykonane nie są przetrzymywane na stanowisku Magazyn)
   */
  const handleToggleTaskCompleted = async (task: WarehouseSplitTaskItem) => {
    setStatusUpdatingKey(task.key);
    try {
      const ord = task.order;
      const nowIso = new Date().toISOString();

      if (task.taskType === 'product_photos') {
        await updateArchivedOrderFields(ord.id, {
          warehouseProductTaskStatus: 'completed',
          warehouseProductTaskCompletedAt: nowIso,
          warehouseTaskStatus: 'completed',
          warehouseTaskCompletedAt: nowIso,
        });
      } else {
        await updateArchivedOrderFields(ord.id, {
          warehouseParcelTaskStatus: 'completed',
          warehouseParcelTaskCompletedAt: nowIso,
          warehouseTaskStatus: 'completed',
          warehouseTaskCompletedAt: nowIso,
        });
      }

      await onRefreshOrders();
      const taskLabel =
        task.taskType === 'product_photos'
          ? 'Zadanie 1 (Uzupełnij zdjęcia produktów)'
          : 'Zadanie 2 (Uzupełnij zdjęcia gotowej przesyłki)';
      setNotice(
        `✅ ${taskLabel} dla zamówienia nr ${ord.orderNumber || ord.invoiceNumber} zostało wykonane, przekazane Koordynatorowi i usunięte z listy zadań Magazynu!`
      );
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setStatusUpdatingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK STANOWISKA MAGAZYNU */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              📦
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-black uppercase tracking-wider mb-1.5">
                <span>Stanowisko 2: Magazyn</span>
                <span>•</span>
                <span>2 Oddzielne Etapy Zadań od Koordynatora</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Moje Zadania Magazynowe — Do Wykonania
              </h1>
              <p className="text-xs sm:text-sm text-amber-50 mt-1 max-w-3xl leading-relaxed">
                Zadania od Koordynatora trafiają tutaj w dwóch oddzielnych etapach:{' '}
                <strong className="text-white underline">
                  1. Uzupełnij zdjęcia produktów (wysyłane z karty zamówienia)
                </strong>{' '}
                oraz kolejno{' '}
                <strong className="text-white underline">
                  2. Uzupełnij zdjęcia gotowej przesyłki (wysyłane gdy zamówienie jest w realizacji)
                </strong>
                . Po oznaczeniu jako wykonane zadanie automatycznie trafia do Koordynatora i znika z listy Magazynu.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onRefreshOrders()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-all cursor-pointer"
              title="Odśwież listę zadań od Koordynatora"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Odśwież zadania</span>
            </button>

            {onSwitchToCoordinator && (
              <button
                type="button"
                onClick={onSwitchToCoordinator}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/80 hover:bg-slate-900 text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                title="Przełącz z powrotem na Stanowisko 1: Koordynator"
              >
                <span>👩‍💼 Przełącz na: 1. Koordynator</span>
              </button>
            )}
          </div>
        </div>

        {/* PASEK ZAKŁADEK AKTYWNYCH ZADAŃ MAGAZYNU I WYSZUKIWARKA */}
        <div className="mt-6 pt-4 border-t border-white/20 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1.5 bg-black/15 p-1 rounded-2xl border border-white/15">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white text-amber-950 shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Do wykonania ({counts.active})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('product_photos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'product_photos'
                  ? 'bg-fuchsia-600 text-white shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>1. Zdjęcia produktów ({counts.productActive})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('parcel_photos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'parcel_photos'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>2. Zdjęcia gotowej przesyłki ({counts.parcelActive})</span>
            </button>
          </div>

          <div className="relative w-full xl:w-72">
            <Search className="w-4 h-4 text-amber-900/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po nr zamówienia, sieci, produkcie..."
              className="w-full pl-9 pr-3 py-2 bg-white/95 border border-white rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* POWIADOMIENIE */}
      {notice && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-950 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* LISTA PRZYPISANYCH ZADAŃ MAGAZYNOWYCH */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center text-3xl mb-4 shadow-2xs">
            {activeTab === 'product_photos' ? '📸' : '📦'}
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900">
            {activeTab === 'product_photos'
              ? 'Brak oczekujących zadań nr 1: „Uzupełnij zdjęcia produktów”'
              : activeTab === 'parcel_photos'
              ? 'Brak oczekujących zadań nr 2: „Uzupełnij zdjęcia gotowej przesyłki”'
              : 'Brak oczekujących zadań od Koordynatora'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-lg mx-auto leading-relaxed">
            1. Na <strong>karcie zamówienia</strong> Koordynator wysyła zadanie{' '}
            <strong>„Uzupełnij zdjęcia produktów”</strong>.<br />
            2. Kolejno w folderze <strong>W REALIZACJI</strong> Koordynator wysyła drugie zadanie{' '}
            <strong>„Uzupełnij zdjęcia gotowej przesyłki”</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredTasks.map((task) => {
            const ord = task.order;
            const isProductTask = task.taskType === 'product_photos';
            const displayChain = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);
            const packagingPhotos = Array.isArray(ord.packagingPhotos) ? ord.packagingPhotos : [];
            const parcelPhotos = Array.isArray(ord.parcelPhotos) ? ord.parcelPhotos : [];
            const isItemsExpanded = expandedItemsTaskKey === task.key;
            const isCompleted = task.status === 'completed';
            const taskPhotosCount = isProductTask ? packagingPhotos.length : parcelPhotos.length;

            return (
              <div
                key={task.key}
                className={`bg-white rounded-3xl border-2 transition-all shadow-md overflow-hidden ${
                  isCompleted
                    ? 'border-emerald-700 bg-emerald-50/10'
                    : isProductTask
                    ? 'border-fuchsia-700 hover:border-fuchsia-800'
                    : 'border-amber-600 hover:border-amber-700'
                }`}
              >
                {/* GÓRNY PASEK KARTY ZADANIA */}
                <div
                  className={`px-5 py-3.5 border-b-2 flex flex-wrap items-center justify-between gap-3 ${
                    isCompleted
                      ? 'bg-emerald-50/70 border-emerald-400'
                      : isProductTask
                      ? 'bg-gradient-to-r from-fuchsia-50/90 via-pink-50/40 to-white border-fuchsia-300'
                      : 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border-amber-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* OZNACZENIE TYPU ZADANIA: 1 LUB 2 */}
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-xl border flex items-center gap-1.5 shadow-2xs ${
                        isProductTask
                          ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                          : 'bg-amber-600 text-white border-amber-700'
                      }`}
                    >
                      {isProductTask ? (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>ZADANIE 1: Uzupełnij zdjęcia produktów</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5" />
                          <span>ZADANIE 2: Uzupełnij zdjęcia gotowej przesyłki</span>
                        </>
                      )}
                    </span>

                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${getChainBadgeStyle(
                        displayChain
                      )}`}
                    >
                      {displayChain}
                    </span>

                    <h2 className="text-base sm:text-lg font-black text-slate-900 flex flex-wrap items-center gap-1.5">
                      <span>Zamówienie nr:</span>
                      <span className="font-mono text-slate-900 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-lg select-all">
                        {ord.orderNumber || ord.invoiceNumber || 'Brak numeru'}
                      </span>
                    </h2>

                    {(ord.orderDate || ord.issueDate) && (
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>z dnia {ord.orderDate || ord.issueDate}</span>
                      </span>
                    )}

                    {(ord.avisoDate || ord.deliveryDate) && (
                      <span className="text-xs font-bold text-amber-900 bg-amber-100/70 border border-amber-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Awizacja / Dostawa: {ord.avisoDate || ord.deliveryDate}</span>
                      </span>
                    )}
                  </div>

                  {/* STATUS ZADANIA MAGAZYNOWEGO + PRZYCISK ZAKOŃCZENIA */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>✅ Zadanie wykonane</span>
                      </span>
                    ) : taskPhotosCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>📸 W trakcie ({taskPhotosCount} zdjęć)</span>
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border animate-pulse ${
                          isProductTask
                            ? 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {isProductTask
                            ? '🔔 Nowe zadanie z karty zamówienia'
                            : '🔔 Nowe zadanie z W REALIZACJI'}
                        </span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleTaskCompleted(task)}
                      disabled={statusUpdatingKey === task.key}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                        isCompleted
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 hover:scale-[1.02]'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isCompleted
                          ? 'Wznów zadanie'
                          : isProductTask
                          ? 'Oznacz Zadanie 1 (Zdjęcia produktów) jako wykonane'
                          : 'Oznacz Zadanie 2 (Zdjęcia przesyłki) jako wykonane'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* DANE ODBIORCY, WYTYCZNE I SPECYFIKACJA POZYCJI */}
                <div className="p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-700">
                        <Building className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-900">{ord.buyer?.name}</span>
                        {ord.thirdParty?.name && (
                          <span className="text-slate-600">
                            ➔ Odbiorca / Magazyn docelowy:{' '}
                            <strong className="text-slate-900">{ord.thirdParty.name}</strong>
                          </span>
                        )}
                      </div>
                      {task.note && (
                        <div
                          className={`text-xs px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 mt-1 shadow-2xs border ${
                            isProductTask
                              ? 'text-fuchsia-950 bg-fuchsia-100/90 border-fuchsia-300'
                              : 'text-amber-950 bg-amber-100/90 border-amber-300'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          <span>
                            <strong>📝 Wytyczne od Koordynatora:</strong> {task.note}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                        Pozycji w zamówieniu:{' '}
                        <strong className={isProductTask ? 'text-fuchsia-700' : 'text-amber-700'}>
                          {ord.items?.length || ord.itemsCount || 0}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedItemsTaskKey(isItemsExpanded ? null : task.key)
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          isProductTask
                            ? 'text-fuchsia-900 bg-fuchsia-100/80 hover:bg-fuchsia-200/80 border-fuchsia-300'
                            : 'text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 border-amber-300'
                        }`}
                      >
                        {isItemsExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Zwiń listę produktów</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Pokaż produkty ({ord.items?.length || 0})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* TABELA POZYCJI DO SPAKOWANIA / SFOTOGRAFOWANIA (BEZ CEN - WIDOK MAGAZYNOWY) */}
                  {isItemsExpanded && ord.items && ord.items.length > 0 && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white animate-in fade-in">
                      <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4 text-amber-600" />
                          <span>Specyfikacja towarowa zamówienia:</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Zamówienie: {ord.orderNumber || ord.invoiceNumber}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-800">
                          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3 w-12">Lp.</th>
                              <th className="py-2 px-3">Nazwa produktu</th>
                              <th className="py-2 px-3">Kod EAN / GTIN</th>
                              <th className="py-2 px-3 text-right">Ilość w zamówieniu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ord.items.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-amber-50/30">
                                <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{item.name}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">
                                  {item.gtin || '—'}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-amber-950 border border-amber-300 font-mono">
                                    {item.quantity} {item.unit || 'SZT.'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* =============================================================== */}
                  {/* WIDOK ZADANIA 1: UZUPEŁNIJ ZDJĘCIA PRODUKTÓW (SERIA LOT / MHD)  */}
                  {/* =============================================================== */}
                  {isProductTask ? (
                    <div className="rounded-2xl border-2 border-fuchsia-200 bg-fuchsia-50/20 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-fuchsia-200/70">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                              1
                            </div>
                            <div>
                              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                                <Camera className="w-4 h-4 text-fuchsia-600" />
                                <span>
                                  Zadanie 1: Uzupełnij zdjęcia produktów z zamówienia (seria LOT i data ważności MHD)
                                </span>
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Zadanie wysłane z karty zamówienia — zrób wyraźne zdjęcia opakowań produktów z widocznym numerem serii (LOT) i datą ważności (MHD)
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                              packagingPhotos.length > 0
                                ? 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {packagingPhotos.length}{' '}
                            {packagingPhotos.length === 1 ? 'zdjęcie produktu' : 'zdjęć produktów'}
                          </span>
                        </div>

                        {/* Galeria zdjęć produktów */}
                        {packagingPhotos.length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            {packagingPhotos.map((pkg, idx) => (
                              <div
                                key={pkg.id}
                                className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-fuchsia-200 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all"
                              >
                                <img
                                  src={pkg.dataUrl}
                                  alt={pkg.fileName}
                                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                                  onClick={() =>
                                    setLightbox({
                                      title: `Zdjęcia produktów (LOT/MHD) — Zamówienie ${ord.orderNumber || ord.invoiceNumber}`,
                                      photos: packagingPhotos.map((p) => p.dataUrl),
                                      currentIndex: idx,
                                    })
                                  }
                                />
                                <div className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightbox({
                                        title: `Zdjęcia produktów (LOT/MHD) — Zamówienie ${ord.orderNumber || ord.invoiceNumber}`,
                                        photos: packagingPhotos.map((p) => p.dataUrl),
                                        currentIndex: idx,
                                      })
                                    }
                                    className="p-1.5 rounded-lg bg-white text-slate-900 hover:text-fuchsia-600 cursor-pointer shadow-xs"
                                    title="Powiększ zdjęcie produktu"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePackagingPhoto(ord, pkg.id)}
                                    className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs"
                                    title="Usuń zdjęcie produktu"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-950/80 text-white">
                                  LOT #{idx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                handleAddPackagingPhotos(ord, e.dataTransfer.files);
                              }
                            }}
                            className="mt-3 p-4 rounded-xl border-2 border-dashed border-fuchsia-300 bg-white/80 text-center text-xs text-slate-500"
                          >
                            Brak zdjęć produktów dla tego zamówienia. Kliknij przycisk poniżej lub przeciągnij zdjęcia opakowań tutaj.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-fuchsia-200/60">
                        <label
                          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                            uploadingPackagingOrderId === ord.id
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white'
                          }`}
                        >
                          {uploadingPackagingOrderId === ord.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Przesyłanie zdjęć produktów...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>+ Uzupełnij zdjęcia produktów (LOT / MHD)</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                disabled={uploadingPackagingOrderId === ord.id}
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleAddPackagingPhotos(ord, e.target.files);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  ) : (
                    /* =============================================================== */
                    /* WIDOK ZADANIA 2: UZUPEŁNIJ ZDJĘCIA GOTOWEJ PRZESYŁKI            */
                    /* =============================================================== */
                    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/20 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-200/70">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                              2
                            </div>
                            <div>
                              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-amber-600" />
                                <span>
                                  Zadanie 2: Uzupełnij zdjęcia gotowej przesyłki (Paczki / Palety / Etykiety)
                                </span>
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Zadanie wysłane z folderu W REALIZACJI — zrób zdjęcia spakowanych kartonów lub palety z naklejoną etykietą wysyłkową
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                              parcelPhotos.length > 0
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {parcelPhotos.length}{' '}
                            {parcelPhotos.length === 1 ? 'zdjęcie przesyłki' : 'zdjęć przesyłki'}
                          </span>
                        </div>

                        {/* Galeria zdjęć gotowej przesyłki */}
                        {parcelPhotos.length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            {parcelPhotos.map((photoUrl, idx) => (
                              <div
                                key={idx}
                                className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-amber-200 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all"
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Przesyłka #${idx + 1}`}
                                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                                  onClick={() =>
                                    setLightbox({
                                      title: `Zdjęcia gotowej przesyłki — ${ord.orderNumber || ord.invoiceNumber}`,
                                      photos: parcelPhotos,
                                      currentIndex: idx,
                                    })
                                  }
                                />
                                <div className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightbox({
                                        title: `Zdjęcia gotowej przesyłki — ${ord.orderNumber || ord.invoiceNumber}`,
                                        photos: parcelPhotos,
                                        currentIndex: idx,
                                      })
                                    }
                                    className="p-1.5 rounded-lg bg-white text-slate-900 hover:text-amber-600 cursor-pointer shadow-xs"
                                    title="Powiększ zdjęcie przesyłki"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParcelPhoto(ord, idx)}
                                    className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs"
                                    title="Usuń zdjęcie przesyłki"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-white">
                                  Paczka #{idx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                handleAddParcelPhotos(ord, e.dataTransfer.files);
                              }
                            }}
                            className="mt-3 p-4 rounded-xl border-2 border-dashed border-amber-300 bg-white/80 text-center text-xs text-slate-500"
                          >
                            Brak zdjęć gotowej przesyłki. Kliknij przycisk poniżej lub przeciągnij zdjęcia spakowanej paczki / palety tutaj.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-amber-200/60">
                        <label
                          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                            uploadingParcelOrderId === ord.id
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          {uploadingParcelOrderId === ord.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Przesyłanie zdjęć przesyłki...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>+ Uzupełnij zdjęcia gotowej przesyłki</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                disabled={uploadingParcelOrderId === ord.id}
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleAddParcelPhotos(ord, e.target.files);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL LIGHTBOX DLA ZDJĘĆ */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold truncate">
                {lightbox.title} ({lightbox.currentIndex + 1} / {lightbox.photos.length})
              </span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-black/60 overflow-hidden">
              <img
                src={lightbox.photos[lightbox.currentIndex]}
                alt="Podgląd"
                className="max-w-full max-h-[72vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
