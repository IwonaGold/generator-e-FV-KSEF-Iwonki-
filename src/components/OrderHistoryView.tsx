import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Download,
  FileCode,
  FileEdit,
  FileText,
  Upload,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Building,
  Calendar,
  Layers,
  Copy,
  Plus,
  RefreshCw,
  ExternalLink,
  Edit3,
  Check,
  X,
  FileSpreadsheet,
  CreditCard,
  AlertCircle,
  Truck,
  Package,
  AlertTriangle,
  Camera,
  Eye,
  ZoomIn,
  Globe,
} from 'lucide-react';
import {
  ArchivedOrder,
  OrderChainFilter,
  OrderStatusFilter,
  OrderPaymentFilter,
  OrderDatePeriodFilter,
  ShippingCourier,
  ShippingStatus,
} from '../types/ordersHistory';
import { downloadKSeFXMLFile } from '../utils/ksefGenerator';
import { updateArchivedOrderFields, deleteArchivedOrder, saveArchivedOrder } from '../utils/ordersStorage';
import { parseKSeFXMLString, extractInvoiceNumberFromXml } from '../utils/ksefXmlParser';
import { detectPharmacyChain } from '../utils/orderParser';
import { exportOrdersToCsv } from '../utils/ordersExport';
import {
  getDateRangeForPeriod,
  isOrderInPeriod,
  calculatePeriodCounts,
} from '../utils/orderPeriodFilter';
import {
  COURIER_OPTIONS,
  SHIPPING_STATUSES,
  detectCourierFromTrackingNumber,
  getTrackingUrl,
  getShippingStatusConfig,
  getOrderEffectiveShippingStatus,
} from '../utils/shippingTracking';
import { compressImageToDataUrl, downloadImageDataUrl } from '../utils/imageUtils';
import { ImportOrderModal } from './ImportOrderModal';

interface OrderHistoryViewProps {
  orders: ArchivedOrder[];
  onRefreshOrders: () => void;
  onCreateCorrectionForOrder: (order: ArchivedOrder) => void;
  onNavigateToInvoiceCreation: () => void;
  onLoadOrderForInvoiceCreation?: (order: ArchivedOrder) => void;
}

export type OrderLifecycleTab = 'in_progress' | 'completed' | 'all';

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders,
  onRefreshOrders,
  onCreateCorrectionForOrder,
  onNavigateToInvoiceCreation,
  onLoadOrderForInvoiceCreation,
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<OrderLifecycleTab>('in_progress');
  const [chainFilter, setChainFilter] = useState<OrderChainFilter>('Wszystkie');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<OrderDatePeriodFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Modal podglądu XML
  const [viewXmlOrder, setViewXmlOrder] = useState<ArchivedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  // Stan lokalny edycji notatek i statusu dostawy
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [notesState, setNotesState] = useState<Record<string, string>>({});

  // Stan lokalny edycji numeru listu przewozowego
  const [trackingNumberState, setTrackingNumberState] = useState<Record<string, string>>({});
  const [savingTrackingId, setSavingTrackingId] = useState<string | null>(null);
  const [checkingTrackingId, setCheckingTrackingId] = useState<string | null>(null);

  // Stan lokalny edycji numeru faktury (i generowania z XML)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceNumberState, setInvoiceNumberState] = useState<Record<string, string>>({});
  const [savingInvoiceId, setSavingInvoiceId] = useState<string | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);

  // Typ daty używanej do filtrowania okresów: 'issueDate' (Wystawienie) | 'orderDate' (Złożenie zamówienia) | 'avisoDate' (Awizacja)
  const [dateFilterField, setDateFilterField] = useState<'issueDate' | 'orderDate' | 'avisoDate'>('issueDate');

  // Stan lokalny edycji dat zamówienia
  const [editingDatesOrderId, setEditingDatesOrderId] = useState<string | null>(null);
  const [editIssueDate, setEditIssueDate] = useState<string>('');
  const [editOrderDate, setEditOrderDate] = useState<string>('');
  const [editAvisoDate, setEditAvisoDate] = useState<string>('');
  const [isSavingDates, setIsSavingDates] = useState(false);

  // Stan dodawania i podglądu zdjęć przesyłki (dowodu spakowania)
  const [uploadingPhotosOrderId, setUploadingPhotosOrderId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ order: ArchivedOrder; photoIndex: number } | null>(null);

  // Stan zbiorczego sprawdzania statusów przesyłek w drodze
  const [isBulkChecking, setIsBulkChecking] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Klawiatura dla lightboxa zdjęć przesyłki (Esc, Strzałki Lewo/Prawo)
  useEffect(() => {
    if (!lightboxPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxPhoto(null);
      } else if (e.key === 'ArrowLeft') {
        const total = lightboxPhoto.order.parcelPhotos?.length || 1;
        setLightboxPhoto((prev) =>
          prev ? { order: prev.order, photoIndex: (prev.photoIndex - 1 + total) % total } : null
        );
      } else if (e.key === 'ArrowRight') {
        const total = lightboxPhoto.order.parcelPhotos?.length || 1;
        setLightboxPhoto((prev) =>
          prev ? { order: prev.order, photoIndex: (prev.photoIndex + 1) % total } : null
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto]);

  // Liczniki dla 3 głównych kafelków cyklu życia: W REALIZACJI / ZAKOŃCZONE / WSZYSTKIE
  const inProgressCount = useMemo(() => {
    return orders.filter((ord) => {
      const st = getOrderEffectiveShippingStatus(ord);
      return !ord.isDelivered && st !== 'delivered';
    }).length;
  }, [orders]);

  const completedCount = useMemo(() => {
    return orders.filter((ord) => {
      const st = getOrderEffectiveShippingStatus(ord);
      return ord.isDelivered || st === 'delivered';
    }).length;
  }, [orders]);

  // Obliczenia liczników dla sieci w ramach aktywnego kafelka cyklu życia
  const chainCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Wszystkie: 0,
      DOZ: 0,
      'Dr. Max': 0,
      'Super-Pharm': 0,
      Gemini: 0,
      Inne: 0,
    };

    const targetOrders = orders.filter((ord) => {
      const isCompleted = ord.isDelivered || getOrderEffectiveShippingStatus(ord) === 'delivered';
      if (lifecycleTab === 'in_progress') return !isCompleted;
      if (lifecycleTab === 'completed') return isCompleted;
      return true;
    });

    counts.Wszystkie = targetOrders.length;
    targetOrders.forEach((ord) => {
      const resolved = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);
      if (counts[resolved] !== undefined) {
        counts[resolved]++;
      } else {
        counts.Inne++;
      }
    });

    return counts;
  }, [orders, lifecycleTab]);

  // Obliczenia liczników dla statusów dostawy
  const deliveryCounts = useMemo(() => {
    const counts = {
      all: orders.length,
      registered: 0,
      in_transit: 0,
      out_for_delivery: 0,
      delivered: 0,
      exception: 0,
    };

    orders.forEach((ord) => {
      const st = getOrderEffectiveShippingStatus(ord);
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });

    return counts;
  }, [orders]);

  // Lista przesyłek będących wyłącznie w drodze (posiadają list przewozowy i NIE są jeszcze doręczone)
  const inTransitOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (!ord.trackingNumber || !ord.trackingNumber.trim()) return false;
      if (ord.isDelivered) return false;
      if (ord.shippingStatus === 'delivered') return false;
      return true;
    });
  }, [orders]);

  // Obliczenia liczników dla statusów płatności
  const paymentCounts = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const counts = { all: orders.length, paid: 0, pending: 0, overdue: 0 };
    orders.forEach((ord) => {
      const isPaid = ord.paymentStatus === 'paid';
      const dueDate = ord.paymentDueDate || ord.dueDate;
      const isOverdue = !isPaid && Boolean(dueDate && dueDate < todayStr);
      if (isPaid) {
        counts.paid++;
      } else if (isOverdue) {
        counts.overdue++;
      } else {
        counts.pending++;
      }
    });
    return counts;
  }, [orders]);

  // Obliczenia liczników dla okresów z uwzględnieniem wybranego pola daty
  const periodCounts = useMemo(() => {
    const mappedOrders = orders.map((o) => {
      const targetDate =
        dateFilterField === 'orderDate'
          ? (o.orderDate || o.issueDate)
          : dateFilterField === 'avisoDate'
          ? (o.avisoDate || o.deliveryDate || o.issueDate)
          : (o.issueDate || o.createdAt);
      return {
        ...o,
        issueDate: targetDate,
      };
    });
    return calculatePeriodCounts(mappedOrders);
  }, [orders, dateFilterField]);

  // Informacja o aktualnie wybranym zakresie dat
  const activePeriodInfo = useMemo(() => {
    return getDateRangeForPeriod(periodFilter, customDateFrom, customDateTo);
  }, [periodFilter, customDateFrom, customDateTo]);

  // Filtrowanie listy zamówień
  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return orders.filter((ord) => {
      const resolvedChain = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);
      const effectiveShipping = getOrderEffectiveShippingStatus(ord);
      const isCompleted = ord.isDelivered || effectiveShipping === 'delivered';

      // 0. Główny kafelek cyklu życia: W REALIZACJI / ZAKOŃCZONE / WSZYSTKIE
      if (lifecycleTab === 'in_progress' && isCompleted) {
        return false;
      }
      if (lifecycleTab === 'completed' && !isCompleted) {
        return false;
      }

      // 1. Filtr sieci
      if (chainFilter !== 'Wszystkie' && resolvedChain !== chainFilter) {
        return false;
      }

      // 2. Filtr statusu dostawy (sub-filtr)
      if (statusFilter !== 'all') {
        if (effectiveShipping !== statusFilter) {
          return false;
        }
      }

      // 2b. Filtr statusu płatności
      if (paymentFilter !== 'all') {
        const isPaid = ord.paymentStatus === 'paid';
        const dueDate = ord.paymentDueDate || ord.dueDate;
        const isOverdue = !isPaid && Boolean(dueDate && dueDate < todayStr);

        if (paymentFilter === 'paid' && !isPaid) return false;
        if (paymentFilter === 'pending' && (isPaid || isOverdue)) return false;
        if (paymentFilter === 'overdue' && !isOverdue) return false;
      }

      // 2c. Filtr okresu / wybranego typu daty
      if (periodFilter !== 'all') {
        const targetDate =
          dateFilterField === 'orderDate'
            ? (ord.orderDate || ord.issueDate)
            : dateFilterField === 'avisoDate'
            ? (ord.avisoDate || ord.deliveryDate || ord.issueDate)
            : (ord.issueDate || ord.createdAt);

        if (!isOrderInPeriod(targetDate, periodFilter, customDateFrom, customDateTo)) {
          return false;
        }
      }

      // 3. Wyszukiwarka
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const xmlNum = extractInvoiceNumberFromXml(ord.xmlContent);
        const matchesInv =
          ord.invoiceNumber?.toLowerCase().includes(query) ||
          xmlNum?.toLowerCase().includes(query);
        const matchesOrd = ord.orderNumber?.toLowerCase().includes(query);
        const matchesBuyer = ord.buyer?.name?.toLowerCase().includes(query);
        const matchesRecipient = ord.thirdParty?.name?.toLowerCase().includes(query);
        const matchesNotes = ord.notes?.toLowerCase().includes(query);
        const matchesItems = ord.items?.some((it) => it.name?.toLowerCase().includes(query));
        const matchesTracking =
          ord.trackingNumber?.toLowerCase().includes(query) ||
          ord.courierName?.toLowerCase().includes(query);

        if (
          !matchesInv &&
          !matchesOrd &&
          !matchesBuyer &&
          !matchesRecipient &&
          !matchesNotes &&
          !matchesItems &&
          !matchesTracking
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    lifecycleTab,
    chainFilter,
    statusFilter,
    paymentFilter,
    periodFilter,
    customDateFrom,
    customDateTo,
    searchQuery,
    dateFilterField,
  ]);

  // Obsługa wgrywania zdjęć przesyłki (z kompresją do lekkiego formatu JPEG)
  const handleAddParcelPhotos = async (order: ArchivedOrder, files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setInvoiceNotice('Wybierz prawidłowe pliki graficzne (np. JPG, PNG).');
      setTimeout(() => setInvoiceNotice(null), 3000);
      return;
    }

    setUploadingPhotosOrderId(order.id);
    try {
      const compressedUrls: string[] = [];
      for (const file of fileArray) {
        try {
          const url = await compressImageToDataUrl(file, 1280, 0.82);
          compressedUrls.push(url);
        } catch (err) {
          console.error('Błąd optymalizacji zdjęcia:', err);
        }
      }

      if (compressedUrls.length === 0) {
        setInvoiceNotice('Nie udało się przetworzyć wybranych zdjęć.');
        setTimeout(() => setInvoiceNotice(null), 3000);
        return;
      }

      const existingPhotos = Array.isArray(order.parcelPhotos) ? order.parcelPhotos : [];
      const updatedPhotos = [...existingPhotos, ...compressedUrls];

      await updateArchivedOrderFields(order.id, { parcelPhotos: updatedPhotos });
      order.parcelPhotos = updatedPhotos;
      onRefreshOrders();

      setInvoiceNotice(
        `📸 Pomyślnie dodano ${compressedUrls.length} ${
          compressedUrls.length === 1 ? 'zdjęcie' : 'zdjęcia'
        } przesyłki do zamówienia ${order.invoiceNumber}!`
      );
      setTimeout(() => setInvoiceNotice(null), 3500);
    } catch (e) {
      console.error('Błąd zapisu zdjęć przesyłki:', e);
      setInvoiceNotice('Błąd podczas zapisywania zdjęć przesyłki.');
      setTimeout(() => setInvoiceNotice(null), 3500);
    } finally {
      setUploadingPhotosOrderId(null);
    }
  };

  // Obsługa usuwania pojedynczego zdjęcia przesyłki
  const handleDeleteParcelPhoto = async (order: ArchivedOrder, photoIndex: number) => {
    const existingPhotos = Array.isArray(order.parcelPhotos) ? order.parcelPhotos : [];
    if (photoIndex < 0 || photoIndex >= existingPhotos.length) return;

    const confirmDelete = window.confirm('Czy na pewno chcesz usunąć to zdjęcie przesyłki z zamówienia?');
    if (!confirmDelete) return;

    const updatedPhotos = existingPhotos.filter((_, idx) => idx !== photoIndex);
    await updateArchivedOrderFields(order.id, { parcelPhotos: updatedPhotos });
    order.parcelPhotos = updatedPhotos;
    onRefreshOrders();

    if (lightboxPhoto && lightboxPhoto.order.id === order.id) {
      if (updatedPhotos.length === 0) {
        setLightboxPhoto(null);
      } else {
        const nextIndex = Math.min(photoIndex, updatedPhotos.length - 1);
        setLightboxPhoto({ order, photoIndex: nextIndex });
      }
    }

    setInvoiceNotice('Usunięto zdjęcie przesyłki.');
    setTimeout(() => setInvoiceNotice(null), 2500);
  };

  // Obsługa zmiany checkboxa "Towar dotarł do odbiorcy"
  const handleToggleDelivered = async (order: ArchivedOrder) => {
    const newStatus = !order.isDelivered;
    const nowStr = new Date().toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const updates: Partial<ArchivedOrder> = {
      isDelivered: newStatus,
      deliveredAt: newStatus ? (order.deliveredAt || nowStr) : null,
    };

    // Jeśli zamówienie ma przypisany list przewozowy, automatycznie synchronizujemy status przesyłki
    if (newStatus) {
      if (order.trackingNumber) {
        updates.shippingStatus = 'delivered';
        updates.shippingStatusUpdatedAt = nowStr;
      }
    } else {
      if (order.trackingNumber && order.shippingStatus === 'delivered') {
        updates.shippingStatus = 'in_transit';
        updates.shippingStatusUpdatedAt = nowStr;
      }
    }

    await updateArchivedOrderFields(order.id, updates);

    setInvoiceNotice(
      newStatus
        ? `Potwierdzono dostawę zamówienia ${order.invoiceNumber} (data: ${nowStr})`
        : `Cofnięto status doręczenia dla ${order.invoiceNumber}`
    );
    setTimeout(() => setInvoiceNotice(null), 3000);
    onRefreshOrders();
  };

  // Obsługa wpisywania numeru listu przewozowego
  const handleTrackingNumberChange = (orderId: string, value: string) => {
    setTrackingNumberState((prev) => ({ ...prev, [orderId]: value }));
  };

  // Zapisanie numeru listu przewozowego (onBlur lub przycisk Zapisz)
  const handleSaveTrackingNumber = async (order: ArchivedOrder, explicitNumber?: string) => {
    const newTracking = (explicitNumber !== undefined ? explicitNumber : trackingNumberState[order.id])?.trim();
    if (newTracking === undefined) return;

    setSavingTrackingId(order.id);

    const detectedCourier = order.courierName || detectCourierFromTrackingNumber(newTracking);
    const updates: Partial<ArchivedOrder> = {
      trackingNumber: newTracking || null,
      courierName: newTracking ? detectedCourier : null,
    };

    if (newTracking && !order.shippingStatus) {
      updates.shippingStatus = order.isDelivered ? 'delivered' : 'in_transit';
      updates.shippingStatusUpdatedAt = new Date().toLocaleString('pl-PL');
    }

    await updateArchivedOrderFields(order.id, updates);
    setSavingTrackingId(null);
    setInvoiceNotice(
      newTracking
        ? `Zapisano list przewozowy: ${newTracking} (${detectedCourier})`
        : 'Wyczyszczono list przewozowy.'
    );
    setTimeout(() => setInvoiceNotice(null), 3000);
    onRefreshOrders();
  };

  // Zmiana firmy kurierskiej
  const handleCourierChange = async (order: ArchivedOrder, courier: ShippingCourier) => {
    await updateArchivedOrderFields(order.id, { courierName: courier });
    setInvoiceNotice(`Zmieniono firmę kurierską na: ${courier}`);
    setTimeout(() => setInvoiceNotice(null), 2500);
    onRefreshOrders();
  };

  // Zmiana statusu przesyłki kurierskiej z automatyczną aktualizacją doręczenia
  const handleShippingStatusChange = async (order: ArchivedOrder, newStatus: ShippingStatus) => {
    const nowStr = new Date().toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isNowDelivered = newStatus === 'delivered';
    const updates: Partial<ArchivedOrder> = {
      shippingStatus: newStatus,
      shippingStatusUpdatedAt: nowStr,
    };

    if (isNowDelivered) {
      // Automatyczna aktualizacja statusu dostawy gdy przesyłka została doręczona
      updates.isDelivered = true;
      updates.deliveredAt = order.deliveredAt || nowStr;
    } else if (order.shippingStatus === 'delivered' && !isNowDelivered) {
      // Jeśli użytkownik cofnął status z 'doręczona', odznaczamy doręczenie
      updates.isDelivered = false;
      updates.deliveredAt = null;
    }

    await updateArchivedOrderFields(order.id, updates);

    const statusCfg = getShippingStatusConfig(newStatus);
    setInvoiceNotice(
      isNowDelivered
        ? `✅ Przesyłka oznaczona jako DORĘCZONA! Automatycznie zaktualizowano: Towar dotarł do odbiorcy (${nowStr}).`
        : `Zaktualizowano status przesyłki na: ${statusCfg.label}`
    );
    setTimeout(() => setInvoiceNotice(null), 4000);
    onRefreshOrders();
  };

  // Automatyczne sprawdzenie statusu przesyłki u kuriera
  const handleCheckLiveTrackingStatus = async (order: ArchivedOrder) => {
    if (!order.trackingNumber) return;
    setCheckingTrackingId(order.id);

    const detected = order.courierName || detectCourierFromTrackingNumber(order.trackingNumber);
    const cleanNo = order.trackingNumber.trim().replace(/\s+/g, '');

    // Sprawdzenie przez publiczne API InPost (jeśli przesyłka InPost)
    if (detected === 'InPost' && cleanNo.length >= 20) {
      try {
        const res = await fetch(`https://api-shipx-pl.easypack24.net/v1/tracking/${encodeURIComponent(cleanNo)}`);
        if (res.ok) {
          const data = await res.json();
          const rawStatus = (data.status || '').toLowerCase();
          let newStatus: ShippingStatus = 'in_transit';
          let msg = `Status InPost: ${data.status}`;

          if (rawStatus === 'delivered') {
            newStatus = 'delivered';
            msg = '✅ InPost: Przesyłka została pomyślnie DORĘCZONA!';
          } else if (rawStatus.includes('out_for_delivery') || rawStatus === 'ready_to_pickup') {
            newStatus = 'out_for_delivery';
            msg = '⚡ InPost: Paczka wydana do doręczenia / w Paczkomacie!';
          } else if (rawStatus.includes('transit') || rawStatus.includes('sent')) {
            newStatus = 'in_transit';
            msg = '🚚 InPost: Przesyłka w transporcie do odbiorcy.';
          }

          await handleShippingStatusChange(order, newStatus);
          setCheckingTrackingId(null);
          setInvoiceNotice(msg);
          setTimeout(() => setInvoiceNotice(null), 4000);
          return;
        }
      } catch (e) {
        console.warn('Błąd weryfikacji API InPost:', e);
      }
    }

    // Obsługa Globkurier.pl
    if (detected === 'Globkurier' || /^GK/i.test(cleanNo)) {
      setCheckingTrackingId(null);
      navigator.clipboard.writeText(cleanNo);
      setInvoiceNotice(`📋 Skopiowano numer ${cleanNo} do schowka! Wklej go (Ctrl+V) w wyszukiwarce na otwartej stronie Globkurier.pl`);
      window.open('https://www.globkurier.pl/tracking', '_blank');
      setTimeout(() => setInvoiceNotice(null), 5000);
      return;
    }

    // Dla pozostałych kurierów (DPD, DHL, GLS, Pocztex itp.) otwieramy oficjalny portal śledzenia
    setCheckingTrackingId(null);
    setInvoiceNotice(`Otwieram portal śledzenia ${detected}...`);
    window.open(getTrackingUrl(order.trackingNumber, detected), '_blank');
    setTimeout(() => setInvoiceNotice(null), 3000);
  };

  // Zbiorcze sprawdzenie statusów przesyłek w drodze (wyłącznie niedoręczonych)
  const handleBulkCheckTransitShipments = async () => {
    if (inTransitOrders.length === 0) {
      setInvoiceNotice('Brak przesyłek w drodze do weryfikacji. Wszystkie zarejestrowane zamówienia zostały już doręczone!');
      setTimeout(() => setInvoiceNotice(null), 4000);
      return;
    }

    setIsBulkChecking(true);
    setBulkModalOpen(true);

    let inpostDeliveredCount = 0;
    const nowStr = new Date().toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const ord of inTransitOrders) {
      const courier = ord.courierName || detectCourierFromTrackingNumber(ord.trackingNumber || '');
      const cleanNo = (ord.trackingNumber || '').trim().replace(/\s+/g, '');

      // Automatyczna weryfikacja InPost przez oficjalne API
      if (courier === 'InPost' && cleanNo.length >= 20) {
        try {
          const res = await fetch(`https://api-shipx-pl.easypack24.net/v1/tracking/${encodeURIComponent(cleanNo)}`);
          if (res.ok) {
            const data = await res.json();
            const rawStatus = (data.status || '').toLowerCase();

            if (rawStatus === 'delivered') {
              await updateArchivedOrderFields(ord.id, {
                shippingStatus: 'delivered',
                shippingStatusUpdatedAt: nowStr,
                isDelivered: true,
                deliveredAt: ord.deliveredAt || nowStr,
              });
              ord.shippingStatus = 'delivered';
              ord.isDelivered = true;
              ord.deliveredAt = ord.deliveredAt || nowStr;
              inpostDeliveredCount++;
            } else if (rawStatus.includes('out_for_delivery') || rawStatus === 'ready_to_pickup') {
              await updateArchivedOrderFields(ord.id, {
                shippingStatus: 'out_for_delivery',
                shippingStatusUpdatedAt: nowStr,
              });
              ord.shippingStatus = 'out_for_delivery';
            }
          }
        } catch (e) {
          console.warn('Błąd weryfikacji API InPost w zbiorczym sprawdzeniu:', e);
        }
      }
    }

    setIsBulkChecking(false);
    onRefreshOrders();

    if (inpostDeliveredCount > 0) {
      setInvoiceNotice(`✅ Automatycznie zaktualizowano ${inpostDeliveredCount} przesyłek InPost jako doręczone!`);
      setTimeout(() => setInvoiceNotice(null), 5000);
    }
  };

  // Zbiorcze oznaczenie wszystkich przesyłek w drodze jako doręczone
  const handleMarkAllInTransitAsDelivered = async () => {
    if (inTransitOrders.length === 0) return;

    const confirmed = window.confirm(
      `Czy na pewno chcesz oznaczyć wszystkie (${inTransitOrders.length}) przesyłek w drodze jako DORĘCZONE do aptek?`
    );
    if (!confirmed) return;

    const nowStr = new Date().toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const ord of inTransitOrders) {
      await updateArchivedOrderFields(ord.id, {
        shippingStatus: 'delivered',
        shippingStatusUpdatedAt: nowStr,
        isDelivered: true,
        deliveredAt: ord.deliveredAt || nowStr,
      });
      ord.shippingStatus = 'delivered';
      ord.isDelivered = true;
      ord.deliveredAt = ord.deliveredAt || nowStr;
    }

    onRefreshOrders();
    setInvoiceNotice(`✅ Pomyślnie oznaczono ${inTransitOrders.length} przesyłek jako DORĘCZONE!`);
    setTimeout(() => setInvoiceNotice(null), 4500);
  };

  // Obsługa wpisywania notatki
  const handleNoteChange = (orderId: string, value: string) => {
    setNotesState((prev) => ({ ...prev, [orderId]: value }));
  };

  // Zapisanie notatki (onBlur lub przycisk)
  const handleSaveNote = async (orderId: string) => {
    const newNote = notesState[orderId];
    if (newNote === undefined) return;

    setSavingNoteId(orderId);
    await updateArchivedOrderFields(orderId, { notes: newNote });
    setTimeout(() => {
      setSavingNoteId(null);
      onRefreshOrders();
    }, 400);
  };

  // Obsługa edycji dat zamówienia (Wystawienie, Złożenie, Awizacja)
  const handleStartEditDates = (ord: ArchivedOrder) => {
    setEditingDatesOrderId(ord.id);
    setEditIssueDate(ord.issueDate || '');
    setEditOrderDate(ord.orderDate || '');
    setEditAvisoDate(ord.avisoDate || ord.deliveryDate || '');
  };

  const handleCancelEditDates = () => {
    setEditingDatesOrderId(null);
  };

  const handleSaveDates = async (ord: ArchivedOrder) => {
    setIsSavingDates(true);
    const updates: Partial<ArchivedOrder> = {
      issueDate: editIssueDate || ord.issueDate,
      orderDate: editOrderDate ? editOrderDate : null as any,
      avisoDate: editAvisoDate ? editAvisoDate : null as any,
      deliveryDate: editAvisoDate ? editAvisoDate : ord.deliveryDate,
    };
    await updateArchivedOrderFields(ord.id, updates);
    setIsSavingDates(false);
    setEditingDatesOrderId(null);
    setInvoiceNotice(`Zaktualizowano daty dla faktury ${ord.invoiceNumber}.`);
    setTimeout(() => setInvoiceNotice(null), 3000);
    onRefreshOrders();
  };

  // Usuwanie zamówienia
  const handleDeleteOrder = async (order: ArchivedOrder) => {
    if (window.confirm(`Czy na pewno chcesz usunąć z historii zamówienie ${order.invoiceNumber}?`)) {
      await deleteArchivedOrder(order.id);
      onRefreshOrders();
    }
  };

  // Rozpoczęcie edycji numeru faktury
  const handleStartEditInvoice = (order: ArchivedOrder) => {
    const xmlNum = extractInvoiceNumberFromXml(order.xmlContent);
    const initialVal = order.invoiceNumber && order.invoiceNumber !== 'FAKTURA'
      ? order.invoiceNumber
      : (xmlNum || order.invoiceNumber || '');
    setInvoiceNumberState((prev) => ({ ...prev, [order.id]: initialVal }));
    setEditingInvoiceId(order.id);
  };

  // Zmiana tekstu w polu numeru faktury
  const handleInvoiceNumberChange = (orderId: string, value: string) => {
    setInvoiceNumberState((prev) => ({ ...prev, [orderId]: value }));
  };

  // Anulowanie edycji numeru faktury
  const handleCancelEditInvoice = () => {
    setEditingInvoiceId(null);
  };

  // Zapis numeru faktury
  const handleSaveInvoiceNumber = async (orderId: string) => {
    const newNum = invoiceNumberState[orderId]?.trim();
    if (newNum === undefined) {
      setEditingInvoiceId(null);
      return;
    }
    setSavingInvoiceId(orderId);
    await updateArchivedOrderFields(orderId, { invoiceNumber: newNum || 'FAKTURA' });
    setSavingInvoiceId(null);
    setEditingInvoiceId(null);
    setInvoiceNotice(`Zapisano numer faktury: ${newNum || 'FAKTURA'}`);
    setTimeout(() => setInvoiceNotice(null), 3500);
    onRefreshOrders();
  };

  // Automatyczne pobranie numeru z pliku XML (<P_2>) i zapisanie
  const handleExtractFromXmlAndSave = async (order: ArchivedOrder) => {
    const extracted = extractInvoiceNumberFromXml(order.xmlContent);
    if (!extracted) {
      setInvoiceNotice('Nie odnaleziono znacznika <P_2> w dołączonym pliku XML.');
      setTimeout(() => setInvoiceNotice(null), 4000);
      return;
    }
    setSavingInvoiceId(order.id);
    await updateArchivedOrderFields(order.id, { invoiceNumber: extracted });
    setInvoiceNumberState((prev) => ({ ...prev, [order.id]: extracted }));
    setSavingInvoiceId(null);
    setEditingInvoiceId(null);
    setInvoiceNotice(`Pomyślnie wygenerowano numer faktury z XML (<P_2>): ${extracted}`);
    setTimeout(() => setInvoiceNotice(null), 3500);
    onRefreshOrders();
  };

  // Wgranie/podmiana pliku XML dla konkretnego zamówienia i automatyczne wyciągnięcie numeru faktury
  const handleUploadXmlForOrder = (order: ArchivedOrder, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseKSeFXMLString(text);
        const extracted = extractInvoiceNumberFromXml(text);
        const effectiveNum = extracted || (order.invoiceNumber && order.invoiceNumber !== 'FAKTURA' ? order.invoiceNumber : 'FAKTURA');

        const updates: Partial<ArchivedOrder> = {
          xmlContent: text,
          invoiceNumber: effectiveNum,
        };
        if (parsed.orderDate) updates.orderDate = parsed.orderDate;
        if (parsed.deliveryDate) {
          updates.deliveryDate = parsed.deliveryDate;
          updates.avisoDate = parsed.deliveryDate;
        }
        if (parsed.issueDate) updates.issueDate = parsed.issueDate;

        await updateArchivedOrderFields(order.id, updates);

        setInvoiceNotice(
          extracted
            ? `Wgrano plik XML (${file.name}) i wyodrębniono numer faktury: ${extracted}`
            : `Wgrano plik XML (${file.name}).`
        );
        setTimeout(() => setInvoiceNotice(null), 4000);
        onRefreshOrders();
      } catch (err: any) {
        alert('Błąd podczas odczytu pliku XML: ' + (err?.message || 'Niepoprawny format'));
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Zmiana statusu opłacenia (Opłacona <-> Oczekuje na płatność)
  const handleTogglePaymentStatus = async (order: ArchivedOrder) => {
    const isPaid = order.paymentStatus === 'paid';
    const newStatus = isPaid ? 'pending' : 'paid';
    const nowStr = new Date().toLocaleDateString('pl-PL');

    await updateArchivedOrderFields(order.id, {
      paymentStatus: newStatus,
      paidAt: isPaid ? null : nowStr,
    });

    setInvoiceNotice(
      isPaid
        ? `Zmieniono status faktury ${order.invoiceNumber} na: Oczekuje na płatność`
        : `Oznaczono fakturę ${order.invoiceNumber} jako OPŁACONĄ (data: ${nowStr})`
    );
    setTimeout(() => setInvoiceNotice(null), 3500);
    onRefreshOrders();
  };

  // Zmiana terminu płatności
  const handleUpdatePaymentDueDate = async (orderId: string, newDueDate: string) => {
    if (!newDueDate) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const newStatus = newDueDate < todayStr ? 'overdue' : 'pending';

    await updateArchivedOrderFields(orderId, {
      paymentDueDate: newDueDate,
      paymentStatus: newStatus,
    });

    setInvoiceNotice(`Zaktualizowano termin płatności do: ${newDueDate}`);
    setTimeout(() => setInvoiceNotice(null), 3000);
    onRefreshOrders();
  };

  // Eksport aktualnie przefiltrowanych zamówień do CSV/Excel dla biura rachunkowego
  const handleExportCsv = () => {
    let prefix = 'Zestawienie_Faktur_KSeF';
    if (periodFilter === 'this_month') prefix = 'Zestawienie_Faktur_Ten_Miesiac';
    else if (periodFilter === 'last_month') prefix = 'Zestawienie_Faktur_Poprzedni_Miesiac';
    else if (periodFilter === 'this_quarter') prefix = 'Zestawienie_Faktur_Ten_Kwartal';
    else if (periodFilter === 'last_quarter') prefix = 'Zestawienie_Faktur_Poprzedni_Kwartal';
    else if (periodFilter === 'this_year') prefix = 'Zestawienie_Faktur_Ten_Rok';
    else if (periodFilter === 'custom' && (customDateFrom || customDateTo)) {
      prefix = `Zestawienie_Faktur_${customDateFrom || 'od-poczatku'}_${customDateTo || 'do-dzis'}`;
    }
    exportOrdersToCsv(filteredOrders, prefix);
  };

  // Pobieranie pliku XML
  const handleDownloadXml = (order: ArchivedOrder) => {
    downloadKSeFXMLFile(order.xmlContent, order.invoiceNumber, 'FA3');
  };

  // Kopiowanie XML w modalu
  const handleCopyModalXml = () => {
    if (viewXmlOrder) {
      navigator.clipboard.writeText(viewXmlOrder.xmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Wgrywanie pliku XML bezpośrednio do historii
  const handleImportXmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseKSeFXMLString(text);

        const chain = detectPharmacyChain(parsed.buyer, parsed.thirdParty);

        const newOrder: ArchivedOrder = {
          id: `imported-${Date.now()}`,
          chain,
          documentType: 'FV',
          invoiceNumber: parsed.invoiceNumber,
          orderNumber: parsed.orderNumber || 'ZAM-IMPORT',
          orderDate: parsed.orderDate || undefined,
          issueDate: parsed.issueDate,
          avisoDate: parsed.deliveryDate || parsed.issueDate,
          deliveryDate: parsed.deliveryDate || parsed.issueDate,
          seller: parsed.seller,
          buyer: parsed.buyer,
          thirdParty: parsed.thirdParty,
          items: parsed.items,
          itemsCount: parsed.items.length,
          totalNet: parsed.items.reduce((acc, it) => acc + it.quantity * it.netPrice, 0),
          totalVat: Math.round(parsed.totalGross * 0.08 * 100) / 100,
          totalGross: parsed.totalGross,
          currency: parsed.currency,
          xmlContent: text,
          isDelivered: false,
          deliveredAt: null,
          notes: `Zaimportowano z pliku XML ${file.name}`,
          originalFileName: file.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveArchivedOrder(newOrder);
        onRefreshOrders();
        alert(`Pomyślnie zaimportowano fakturę ${parsed.invoiceNumber} do historii.`);
      } catch (err: any) {
        alert('Błąd importu XML: ' + (err.message || 'Niepoprawny format'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getChainBadgeStyle = (chain: string) => {
    switch (chain) {
      case 'DOZ':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Dr. Max':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Super-Pharm':
        return 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200';
      case 'Gemini':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 3 GŁÓWNE KAFELKI NA SAMEJ GÓRZE: W REALIZACJI / ZAKOŃCZONE / WSZYSTKIE */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KAFELEK 1: W REALIZACJI */}
        <button
          type="button"
          onClick={() => {
            setLifecycleTab('in_progress');
            setStatusFilter('all');
          }}
          className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
            lifecycleTab === 'in_progress'
              ? 'bg-gradient-to-br from-amber-50/95 via-orange-50/40 to-white border-amber-500 ring-2 ring-amber-400/30 shadow-amber-100 scale-[1.01]'
              : 'bg-white hover:bg-amber-50/40 border-slate-200 hover:border-amber-300'
          }`}
        >
          {lifecycleTab === 'in_progress' && (
            <span className="absolute top-3.5 right-3.5 flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-amber-600" /> Aktywny
            </span>
          )}
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-colors shadow-xs ${
                lifecycleTab === 'in_progress'
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-300'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              🚚
            </div>
            <div className="pr-10 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  W REALIZACJI
                </h3>
                <span
                  className={`px-2 py-0.5 text-xs font-black rounded-lg ${
                    lifecycleTab === 'in_progress'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {inProgressCount}
                </span>
              </div>
              <p className="text-xs font-medium text-amber-800/80 mt-0.5">
                Do wysłania · w drodze · w doręczeniu
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200/60">
                  📦 Do wysyłki: <strong className="ml-1 text-slate-900">{deliveryCounts.registered}</strong>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 font-semibold border border-amber-200/60">
                  🚚 W drodze: <strong className="ml-1 text-amber-950">{deliveryCounts.in_transit}</strong>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-900 font-semibold border border-blue-200/60">
                  ⚡ W doręczeniu: <strong className="ml-1 text-blue-950">{deliveryCounts.out_for_delivery}</strong>
                </span>
                {deliveryCounts.exception > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 font-semibold border border-rose-200/60">
                    ⚠️ Awizo: <strong className="ml-1 text-rose-950">{deliveryCounts.exception}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* KAFELEK 2: ZAKOŃCZONE */}
        <button
          type="button"
          onClick={() => {
            setLifecycleTab('completed');
            setStatusFilter('all');
          }}
          className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
            lifecycleTab === 'completed'
              ? 'bg-gradient-to-br from-emerald-50/95 via-teal-50/40 to-white border-emerald-500 ring-2 ring-emerald-400/30 shadow-emerald-100 scale-[1.01]'
              : 'bg-white hover:bg-emerald-50/40 border-slate-200 hover:border-emerald-300'
          }`}
        >
          {lifecycleTab === 'completed' && (
            <span className="absolute top-3.5 right-3.5 flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aktywny
            </span>
          )}
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-colors shadow-xs ${
                lifecycleTab === 'completed'
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-emerald-300'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              ✅
            </div>
            <div className="pr-10 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  ZAKOŃCZONE
                </h3>
                <span
                  className={`px-2 py-0.5 text-xs font-black rounded-lg ${
                    lifecycleTab === 'completed'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {completedCount}
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-800/80 mt-0.5">
                Dostarczone do apteki (doręczone)
              </p>
              <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-900 font-semibold border border-emerald-200/60">
                  ✅ Pomyślnie doręczone i odebrane przez apteki
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* KAFELEK 3: WSZYSTKIE */}
        <button
          type="button"
          onClick={() => {
            setLifecycleTab('all');
            setStatusFilter('all');
          }}
          className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
            lifecycleTab === 'all'
              ? 'bg-gradient-to-br from-rose-50/95 via-fuchsia-50/40 to-white border-rose-500 ring-2 ring-rose-400/30 shadow-rose-100 scale-[1.01]'
              : 'bg-white hover:bg-rose-50/40 border-slate-200 hover:border-rose-300'
          }`}
        >
          {lifecycleTab === 'all' && (
            <span className="absolute top-3.5 right-3.5 flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100/90 px-2.5 py-0.5 rounded-full border border-rose-300 shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-rose-600" /> Aktywny
            </span>
          )}
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-colors shadow-xs ${
                lifecycleTab === 'all'
                  ? 'bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-rose-300'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              📚
            </div>
            <div className="pr-10 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  WSZYSTKIE
                </h3>
                <span
                  className={`px-2 py-0.5 text-xs font-black rounded-lg ${
                    lifecycleTab === 'all'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {orders.length}
                </span>
              </div>
              <p className="text-xs font-medium text-rose-800/80 mt-0.5">
                Pełny rejestr zamówień i e-faktur KSeF
              </p>
              <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200/60">
                  Wszystkie sieci: DOZ, Dr. Max, SP, Gemini
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* NAGŁÓWEK MODUŁU I FILTRY SIECIOWE */}
      <div className="bg-white rounded-2xl border border-rose-200/80 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {lifecycleTab === 'in_progress' ? '🚚' : lifecycleTab === 'completed' ? '✅' : '📚'}
              </span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {lifecycleTab === 'in_progress'
                  ? 'ZAMÓWIENIA W REALIZACJI'
                  : lifecycleTab === 'completed'
                  ? 'ZAMÓWIENIA ZAKOŃCZONE (DORĘCZONE)'
                  : 'WSZYSTKIE ZAMÓWIENIA SIECIOWE'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lifecycleTab === 'in_progress'
                ? 'Przesyłki przygotowywane do wysyłki, przekazane kurierom lub będące w trakcie doręczania do aptek.'
                : lifecycleTab === 'completed'
                ? 'Archiwum zamówień pomyślnie zrealizowanych i potwierdzonych jako doręczone do odbiorcy.'
                : 'Rejestr wszystkich zamówień i wygenerowanych faktur KSeF dla sieci farmaceutycznych: DOZ, Dr. Max, Super-Pharm, Gemini.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* PRZYCISK: ZBIORCZA WERYFIKACJA PRZESYŁEK W DRODZE */}
            <button
              type="button"
              onClick={handleBulkCheckTransitShipments}
              disabled={isBulkChecking || inTransitOrders.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all shadow-2xs ${
                inTransitOrders.length > 0
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 hover:scale-[1.02]'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title={
                inTransitOrders.length > 0
                  ? `Sprawdź statusy wszystkich (${inTransitOrders.length}) przesyłek kurierskich będących w drodze (wyłącznie niedoręczonych)`
                  : 'Brak przesyłek w drodze do weryfikacji'
              }
            >
              <Truck className={`w-3.5 h-3.5 text-amber-700 ${isBulkChecking ? 'animate-bounce' : ''}`} />
              <span>
                {isBulkChecking
                  ? 'Sprawdzam...'
                  : `Sprawdź statusy w drodze (${inTransitOrders.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl cursor-pointer transition-colors shadow-2xs"
              title="Pobierz zestawienie faktur w pliku CSV dla biura rachunkowego / Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Eksport do Excela ({filteredOrders.length})</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer transition-colors shadow-2xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Importuj plik XML</span>
              <input type="file" accept=".xml" className="hidden" onChange={handleImportXmlFile} />
            </label>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-200 via-orange-200 to-amber-300 hover:from-amber-300 hover:to-orange-300 border border-amber-400 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer hover:scale-[1.02]"
              title="Wczytaj zamówienie (PDF, TXT, Excel) do realizacji — zaplanuj pakowanie bez wystawiania faktury lub dla sieci zewnętrznej"
            >
              <Upload className="w-3.5 h-3.5 text-amber-800" />
              <span>Nowe Zamówienie</span>
            </button>

            <button
              onClick={onNavigateToInvoiceCreation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02]"
              title="Przejdź do kreatora faktur, aby wczytać zamówienie i od razu wystawić e-Fakturę KSeF"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nowe Zamówienie z wystawieniem FV</span>
            </button>
          </div>
        </div>

        {/* KAFELKI / ZAKŁADKI SIECI FARMACEUTYCZNYCH */}
        <div className="flex flex-wrap items-center gap-2 border-b border-rose-100 pb-4 mb-4">
          <span className="text-xs font-bold text-slate-500 uppercase mr-1">Sieć:</span>
          {(['Wszystkie', 'DOZ', 'Dr. Max', 'Super-Pharm', 'Gemini', 'Inne'] as OrderChainFilter[]).map(
            (chain) => {
              const count = chainCounts[chain] || 0;
              const isActive = chainFilter === chain;
              return (
                <button
                  key={chain}
                  onClick={() => setChainFilter(chain)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-rose-600 text-white shadow-xs shadow-rose-300 scale-[1.02]'
                      : 'bg-rose-50/70 hover:bg-rose-100 text-rose-900 border border-rose-200/60'
                  }`}
                >
                  <span>{chain}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-rose-700 border border-rose-200'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </div>

        {/* FILTRY: WYSZUKIWARKA, STATUS DOSTAWY ORAZ ROZLICZENIE PŁATNOŚCI */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Szukaj po nr faktury, zamówienia, leku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            {/* Filtr dostawy (Statusy logistyczne) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 font-medium text-[11px]">Dostawa:</span>
              <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
                {lifecycleTab === 'in_progress' ? (
                  <>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-amber-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Wszystkie zamówienia będące w toku realizacji"
                    >
                      Wszystkie w toku ({inProgressCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('registered')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'registered'
                          ? 'bg-slate-700 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Nowe zamówienia / przygotowane do wysyłki (jeszcze nieprzekazane kurierowi)"
                    >
                      📦 Do wysyłki ({deliveryCounts.registered})
                    </button>
                    <button
                      onClick={() => setStatusFilter('in_transit')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'in_transit'
                          ? 'bg-amber-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Przesyłki w drodze (odebrane przez kuriera w transporcie)"
                    >
                      🚚 W drodze ({deliveryCounts.in_transit})
                    </button>
                    <button
                      onClick={() => setStatusFilter('out_for_delivery')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'out_for_delivery'
                          ? 'bg-blue-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Wydane kurierowi do doręczenia dzisiaj do apteki"
                    >
                      ⚡ W doręczeniu ({deliveryCounts.out_for_delivery})
                    </button>
                    {deliveryCounts.exception > 0 ? (
                      <button
                        onClick={() => setStatusFilter('exception')}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          statusFilter === 'exception'
                            ? 'bg-rose-600 text-white shadow-2xs font-bold'
                            : 'text-rose-600 hover:text-rose-800'
                        }`}
                        title="Awizo lub problem z doręczeniem przesyłki"
                      >
                        ⚠️ Awizo ({deliveryCounts.exception})
                      </button>
                    ) : null}
                  </>
                ) : lifecycleTab === 'completed' ? (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-2xs cursor-pointer"
                    title="Wszystkie zamówienia pomyślnie doręczone do odbiorcy"
                  >
                    ✅ Wszystkie doręczone ({completedCount})
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Wszystkie zamówienia bez względu na status dostawy"
                    >
                      Wszystkie ({deliveryCounts.all})
                    </button>
                    <button
                      onClick={() => setStatusFilter('registered')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'registered'
                          ? 'bg-slate-700 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Nowe zamówienia / przygotowane do wysyłki (jeszcze nieprzekazane kurierowi)"
                    >
                      📦 Do wysyłki ({deliveryCounts.registered})
                    </button>
                    <button
                      onClick={() => setStatusFilter('in_transit')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'in_transit'
                          ? 'bg-amber-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Przesyłki w drodze (odebrane przez kuriera w transporcie)"
                    >
                      🚚 W drodze ({deliveryCounts.in_transit})
                    </button>
                    <button
                      onClick={() => setStatusFilter('out_for_delivery')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'out_for_delivery'
                          ? 'bg-blue-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Wydane kurierowi do doręczenia dzisiaj do apteki"
                    >
                      ⚡ W doręczeniu ({deliveryCounts.out_for_delivery})
                    </button>
                    <button
                      onClick={() => setStatusFilter('delivered')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'delivered'
                          ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Doręczone i odebrane przez aptekę"
                    >
                      ✅ Doręczone ({deliveryCounts.delivered})
                    </button>
                    {deliveryCounts.exception > 0 ? (
                      <button
                        onClick={() => setStatusFilter('exception')}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          statusFilter === 'exception'
                            ? 'bg-rose-600 text-white shadow-2xs font-bold'
                            : 'text-rose-600 hover:text-rose-800'
                        }`}
                        title="Awizo lub problem z doręczeniem przesyłki"
                      >
                        ⚠️ Awizo ({deliveryCounts.exception})
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Filtr płatności */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium text-[11px]">Płatność:</span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    paymentFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Wszystkie ({paymentCounts.all})
                </button>
                <button
                  onClick={() => setPaymentFilter('paid')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    paymentFilter === 'paid'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ✅ Opłacone ({paymentCounts.paid})
                </button>
                <button
                  onClick={() => setPaymentFilter('pending')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    paymentFilter === 'pending'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⏳ Do zapłaty ({paymentCounts.pending})
                </button>
                <button
                  onClick={() => setPaymentFilter('overdue')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    paymentFilter === 'overdue'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🚨 Po terminie ({paymentCounts.overdue})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FILTR OKRESU (DATA WYSTAWIENIA FAKTURY / ZAMÓWIENIA / AWIZACJI) */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* PRZEŁĄCZNIK TYPU DATY DO FILTROWANIA */}
            <div className="inline-flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 px-1.5 uppercase tracking-wider">
                Wg daty:
              </span>
              <button
                type="button"
                onClick={() => setDateFilterField('issueDate')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  dateFilterField === 'issueDate'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Filtruj wg daty wystawienia faktury (<P_1>)"
              >
                📅 Wystawienia
              </button>
              <button
                type="button"
                onClick={() => setDateFilterField('orderDate')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  dateFilterField === 'orderDate'
                    ? 'bg-fuchsia-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Filtruj wg daty złożenia zamówienia (<DataZamowienia>)"
              >
                📝 Zamówienia
              </button>
              <button
                type="button"
                onClick={() => setDateFilterField('avisoDate')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  dateFilterField === 'avisoDate'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Filtruj wg daty awizacji dostawy (<P_6>)"
              >
                🚚 Awizacji
              </button>
            </div>

            <span className="text-slate-300 hidden sm:inline">|</span>

            <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
              <span>Okres:</span>
            </span>

            <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setPeriodFilter('all');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Wszystkie ({periodCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('this_month')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'this_month'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ten miesiąc ({periodCounts.this_month})
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('last_month')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'last_month'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Poprzedni miesiąc ({periodCounts.last_month})
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('this_quarter')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'this_quarter'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ten kwartał ({periodCounts.this_quarter})
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('last_quarter')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'last_quarter'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Poprzedni kwartał ({periodCounts.last_quarter})
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('this_year')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'this_year'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ten rok ({periodCounts.this_year})
              </button>

              <button
                type="button"
                onClick={() => {
                  setPeriodFilter('custom');
                  if (!customDateFrom && activePeriodInfo?.start) {
                    setCustomDateFrom(activePeriodInfo.start);
                  }
                  if (!customDateTo && activePeriodInfo?.end) {
                    setCustomDateTo(activePeriodInfo.end);
                  }
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodFilter === 'custom'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                📅 Własny zakres
              </button>
            </div>
          </div>

          {/* POLA WYBORU DATY (OD - DO) I PODGLĄD AKTYWNEGO PRZEDZIAŁU */}
          <div className="flex flex-wrap items-center gap-2">
            {activePeriodInfo && (
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-1 rounded-lg font-mono">
                📅 {activePeriodInfo.prettyRange}
              </span>
            )}

            <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <span className="text-[11px] font-semibold text-slate-500">Od:</span>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => {
                  setCustomDateFrom(e.target.value);
                  setPeriodFilter('custom');
                }}
                className="px-1.5 py-0.5 text-xs font-mono bg-white border border-slate-300 rounded focus:border-rose-400 focus:outline-none text-slate-800 cursor-pointer"
                title="Wybierz datę początkową (Od)"
              />

              <span className="text-[11px] font-semibold text-slate-500 ml-1">Do:</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => {
                  setCustomDateTo(e.target.value);
                  setPeriodFilter('custom');
                }}
                className="px-1.5 py-0.5 text-xs font-mono bg-white border border-slate-300 rounded focus:border-rose-400 focus:outline-none text-slate-800 cursor-pointer"
                title="Wybierz datę końcową (Do)"
              />

              {(periodFilter !== 'all' || customDateFrom || customDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriodFilter('all');
                    setCustomDateFrom('');
                    setCustomDateTo('');
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Wyczyść filtr daty i pokaż wszystkie okresy"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* POWIADOMIENIE O AKTUALIZACJI NUMERU FAKTURY / XML */}
      {invoiceNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{invoiceNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInvoiceNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* LISTA ZAMÓWIEŃ */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center text-2xl mb-3 shadow-2xs">
            {lifecycleTab === 'in_progress' ? '🎉' : lifecycleTab === 'completed' ? '📦' : '🌸'}
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {lifecycleTab === 'in_progress'
              ? 'Brak zamówień w realizacji!'
              : lifecycleTab === 'completed'
              ? 'Brak zamówień zakończonych'
              : 'Brak zamówień spełniających kryteria'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            {lifecycleTab === 'in_progress'
              ? 'Wszystkie bieżące zamówienia zostały pomyślnie zrealizowane i doręczone do aptek.'
              : lifecycleTab === 'completed'
              ? 'Żadne zamówienie nie zostało jeszcze oznaczone jako doręczone do odbiorcy.'
              : 'Zmień wybrane filtry wyszukiwania lub wystaw nową fakturę w module Centrum Faktur.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {lifecycleTab === 'in_progress' && completedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setLifecycleTab('completed');
                  setStatusFilter('all');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl cursor-pointer transition-colors shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zobacz zakończone ({completedCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setLifecycleTab('all');
                setStatusFilter('all');
                setChainFilter('Wszystkie');
                setPaymentFilter('all');
                setPeriodFilter('all');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Wyczyść filtry i pokaż wszystkie ({orders.length})</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const isExpanded = expandedOrderId === ord.id;
            const currentNote = notesState[ord.id] !== undefined ? notesState[ord.id] : ord.notes || '';
            const isNoteSaving = savingNoteId === ord.id;

            const xmlInvoiceNo = extractInvoiceNumberFromXml(ord.xmlContent);
            const effectiveInvoiceNumber =
              ord.invoiceNumber && ord.invoiceNumber !== 'FAKTURA'
                ? ord.invoiceNumber
                : xmlInvoiceNo || ord.invoiceNumber || 'Brak numeru';
            const isEditingThisInvoice = editingInvoiceId === ord.id;
            const currentEditingInvoiceVal =
              invoiceNumberState[ord.id] !== undefined
                ? invoiceNumberState[ord.id]
                : (effectiveInvoiceNumber === 'Brak numeru' ? '' : effectiveInvoiceNumber);

            const displayChain = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);

            // Obliczenia statusu płatności i terminu
            const isPaid = ord.paymentStatus === 'paid';
            const todayStr = new Date().toISOString().slice(0, 10);
            const effectiveDueDate = ord.paymentDueDate || ord.dueDate || ord.issueDate || '';
            const isOverdue = !isPaid && Boolean(effectiveDueDate && effectiveDueDate < todayStr);

            let daysDiff: number | null = null;
            if (effectiveDueDate) {
              const dDue = new Date(effectiveDueDate);
              const dNow = new Date(todayStr);
              daysDiff = Math.round((dDue.getTime() - dNow.getTime()) / (1000 * 60 * 60 * 24));
            }

            const currentTrackingNumber =
              trackingNumberState[ord.id] !== undefined
                ? trackingNumberState[ord.id]
                : ord.trackingNumber || '';
            const currentShippingCfg = getShippingStatusConfig(
              ord.shippingStatus || (ord.isDelivered ? 'delivered' : 'in_transit')
            );

            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-rose-300 shadow-xs hover:shadow-md transition-all overflow-hidden"
              >
                {/* GŁÓWNA KARTA ZAMÓWIENIA */}
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* LEWA STRONA: GŁÓWNY NAGŁÓWEK ZAMÓWIENIA, BADGE, NUMERY, DATY, NABYWCA */}
                    <div className="space-y-2.5">
                      {/* ==================================================================== */}
                      {/* GŁÓWNY DUŻY NAGŁÓWEK NA SAMEJ GÓRZE: NAZWA SIECI - ZAMÓWIENIE NR ... Z DNIA ... */}
                      {/* ==================================================================== */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-1 border-b border-slate-100">
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${getChainBadgeStyle(
                            displayChain
                          )}`}
                        >
                          {displayChain === 'Inne' ? 'Inne' : displayChain}
                        </span>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-800">{displayChain}</span>
                          <span className="text-slate-300 font-normal">—</span>
                          <span className="text-slate-700 font-bold">Zamówienie nr:</span>
                          <span className="font-mono text-rose-700 bg-rose-50/70 border border-rose-200/80 px-2 py-0.5 rounded-lg select-all shadow-2xs">
                            {ord.orderNumber || 'Brak numeru'}
                          </span>
                          {(ord.orderDate || ord.issueDate) && (
                            <span className="text-xs sm:text-sm font-bold text-slate-500 font-sans ml-0.5">
                              z dnia{' '}
                              <span className="font-mono font-bold text-slate-800">
                                {ord.orderDate || ord.issueDate}
                              </span>
                            </span>
                          )}
                        </h3>
                      </div>

                      {/* DRUGI WIERSZ: TYP DOKUMENTU, NR FAKTURY, ZDJĘCIA PACZKI */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* BADGE TYPU DOKUMENTU */}
                        {ord.documentType === 'KOR' ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200">
                            📝 Korekta KOR
                          </span>
                        ) : ord.documentType === 'ZAM' ? (
                          ord.invoiceStatus === 'external_billing' ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-indigo-100 text-indigo-900 border-indigo-200 flex items-center gap-1">
                              <Globe className="w-3 h-3 text-indigo-600" />
                              <span>🌐 Zamówienie (FV zewnętrzna)</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>⏳ Zamówienie (Oczekuje na FV)</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-rose-100 text-rose-800 border-rose-200">
                            📄 Faktura VAT FA(3)
                          </span>
                        )}

                        {/* BADGE ZDJĘĆ PRZESYŁKI */}
                        {ord.parcelPhotos && ord.parcelPhotos.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setLightboxPhoto({ order: ord, photoIndex: 0 })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                            title="Kliknij, aby otworzyć zdjęcia przesyłki w powiększeniu"
                          >
                            <Camera className="w-3 h-3 text-amber-600" />
                            <span>
                              {ord.parcelPhotos.length} {ord.parcelPhotos.length === 1 ? 'zdjęcie paczki' : 'zdjęć paczki'}
                            </span>
                          </button>
                        ) : null}

                        {/* DEDYKOWANE MIEJSCE NA NUMER FAKTURY (Z GENEROWANIEM Z XML) */}
                        {isEditingThisInvoice ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50/90 border border-rose-300 rounded-xl px-2.5 py-1 shadow-2xs">
                            <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="text-[11px] font-bold text-rose-800">
                              {ord.invoiceStatus === 'external_billing' ? 'Nr FV zewn.:' : 'Nr faktury:'}
                            </span>
                            <input
                              type="text"
                              value={currentEditingInvoiceVal}
                              onChange={(e) => handleInvoiceNumberChange(ord.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInvoiceNumber(ord.id);
                                if (e.key === 'Escape') handleCancelEditInvoice();
                              }}
                              placeholder="Wpisz nr faktury..."
                              className="px-2 py-0.5 text-xs font-mono font-bold bg-white border border-rose-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-400 w-36 sm:w-44"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInvoiceNumber(ord.id)}
                              disabled={savingInvoiceId === ord.id}
                              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                              title="Zapisz numer faktury"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            {xmlInvoiceNo && (
                              <button
                                type="button"
                                onClick={() => handleExtractFromXmlAndSave(ord)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white hover:bg-pink-100 text-pink-700 border border-pink-300 transition-colors cursor-pointer whitespace-nowrap"
                                title={`Wstaw numer z XML: ${xmlInvoiceNo}`}
                              >
                                ⚡ Z XML ({xmlInvoiceNo})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleCancelEditInvoice}
                              className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                              title="Anuluj"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-50 via-white to-pink-50 border border-rose-200 rounded-xl px-2.5 py-1 shadow-2xs">
                            <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              {ord.invoiceStatus === 'external_billing' ? 'FV zewn.:' : 'Nr faktury:'}
                            </span>
                            <span className="text-sm font-black text-slate-900 font-mono tracking-tight select-all">
                              {ord.documentType === 'ZAM' && ord.invoiceStatus === 'awaiting_invoice' && (!ord.invoiceNumber || ord.invoiceNumber.startsWith('ZAM:'))
                                ? '⏳ Wystaw przed awizacją'
                                : effectiveInvoiceNumber}
                            </span>
                            {xmlInvoiceNo && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title={`Numer wygenerowany z pliku XML (węzeł <P_2>: ${xmlInvoiceNo})`}
                              >
                                XML ✓
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartEditInvoice(ord)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-100/60 transition-colors cursor-pointer"
                              title="Edytuj numer faktury"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {xmlInvoiceNo && ord.invoiceNumber !== xmlInvoiceNo && (
                              <button
                                type="button"
                                onClick={() => handleExtractFromXmlAndSave(ord)}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 transition-colors cursor-pointer"
                                title={`Kliknij, aby zastosować numer z pliku XML: ${xmlInvoiceNo}`}
                              >
                                ⚡ Pobierz z XML
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 truncate max-w-xs" title={ord.buyer.name}>
                            {ord.buyer.name}
                          </span>
                        </div>

                        {ord.thirdParty && (
                          <div className="text-slate-500">
                            → Odbiorca: <span className="font-medium text-slate-700">{ord.thirdParty.name}</span>
                          </div>
                        )}

                        {/* FORMULARZ EDYCJI DAT DLA ZAMÓWIENIA */}
                        {editingDatesOrderId === ord.id ? (
                          <div className="mt-2.5 p-3 bg-fuchsia-50/70 border border-fuchsia-200 rounded-xl space-y-2 animate-in fade-in">
                            <div className="text-[11px] font-bold text-fuchsia-950 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-fuchsia-600" />
                                <span>Edycja dat dla faktury {ord.invoiceNumber}:</span>
                              </span>
                              <span className="text-[10px] text-slate-500 font-normal">KSeF FA(3)</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                  📅 Data wystawienia (&lt;P_1&gt;):
                                </label>
                                <input
                                  type="date"
                                  value={editIssueDate}
                                  onChange={(e) => setEditIssueDate(e.target.value)}
                                  className="w-full text-xs font-mono bg-white border border-slate-300 focus:border-rose-400 rounded-lg px-2 py-1 text-slate-900"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-fuchsia-900 block mb-0.5">
                                  📝 Data złożenia zamówienia:
                                </label>
                                <input
                                  type="date"
                                  value={editOrderDate}
                                  onChange={(e) => setEditOrderDate(e.target.value)}
                                  className="w-full text-xs font-mono bg-white border border-fuchsia-300 focus:border-fuchsia-500 rounded-lg px-2 py-1 text-fuchsia-950 font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-amber-900 block mb-0.5">
                                  🚚 Data awizacji dostawy:
                                </label>
                                <input
                                  type="date"
                                  value={editAvisoDate}
                                  onChange={(e) => setEditAvisoDate(e.target.value)}
                                  className="w-full text-xs font-mono bg-white border border-amber-300 focus:border-amber-500 rounded-lg px-2 py-1 text-amber-950 font-bold"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 justify-end">
                              <button
                                type="button"
                                onClick={handleCancelEditDates}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Anuluj
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveDates(ord)}
                                disabled={isSavingDates}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isSavingDates ? 'Zapisuję...' : 'Zapisz daty'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* WIDOK TRZECH DAT (WYSTAWIENIE / ZAMÓWIENIE / AWIZACJA) */
                          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                            {/* 1. DATA WYSTAWIENIA */}
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors"
                              title="Data wystawienia faktury VAT (węzeł <P_1> w KSeF)"
                            >
                              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>Wystawiono: <strong className="font-bold text-slate-900">{ord.issueDate}</strong></span>
                            </div>

                            {/* 2. DATA ZŁOŻENIA ZAMÓWIENIA */}
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                                ord.orderDate
                                  ? 'bg-fuchsia-50/70 text-fuchsia-950 border-fuchsia-200 hover:bg-fuchsia-100/70'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="Data złożenia zamówienia przez sieć apteczną (<DataZamowienia>)"
                            >
                              <FileText className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                              <span>Zamówiono: <strong className="font-bold font-mono">{ord.orderDate || '—'}</strong></span>
                            </div>

                            {/* 3. DATA AWIZACJI DOSTAWY */}
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                                (ord.avisoDate || ord.deliveryDate)
                                  ? 'bg-amber-50/80 text-amber-950 border-amber-200 hover:bg-amber-100/80'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                              title="Data planowanej awizacji dostawy do magazynu apteki / centrum dystrybucyjnego (<P_6>)"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Awizacja: <strong className="font-bold font-mono">{ord.avisoDate || ord.deliveryDate || '—'}</strong></span>
                            </div>

                            {/* PRZYCISK SZYBKIEJ EDYCJI DAT */}
                            <button
                              type="button"
                              onClick={() => handleStartEditDates(ord)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-fuchsia-700 hover:bg-fuchsia-50 rounded-lg border border-transparent hover:border-fuchsia-200 transition-colors cursor-pointer"
                              title="Kliknij, aby edytować datę wystawienia, datę złożenia zamówienia lub datę awizacji"
                            >
                              <Edit3 className="w-3 h-3 text-slate-400 hover:text-fuchsia-600" />
                              <span>Zmień daty</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PRAWA STRONA: FINANSE, STATUS PŁATNOŚCI & GŁÓWNY STATUS DORĘCZENIA */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                      {/* KWOTY */}
                      <div className="text-left lg:text-right pr-1">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">
                          Wartość brutto
                        </div>
                        <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                          {ord.totalGross.toFixed(2)} PLN
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Netto: {ord.totalNet.toFixed(2)} zł ({ord.itemsCount} poz.)
                        </div>
                      </div>

                      {/* STATUS PŁATNOŚCI & TERMIN */}
                      <div
                        className={`p-2.5 rounded-xl border transition-all text-xs min-w-[210px] ${
                          isPaid
                            ? 'bg-emerald-50/80 border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-50/90 border-rose-300 ring-1 ring-rose-200'
                            : 'bg-amber-50/70 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                            <CreditCard
                              className={`w-3.5 h-3.5 ${
                                isPaid ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-amber-600'
                              }`}
                            />
                            <span>Płatność</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleTogglePaymentStatus(ord)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border ${
                              isPaid
                                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            }`}
                            title={isPaid ? 'Oznacz fakturę jako oczekującą na wpłatę' : 'Oznacz fakturę jako opłaconą'}
                          >
                            {isPaid ? 'Cofnij' : '✓ Opłacona'}
                          </button>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5">
                          {isPaid ? (
                            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Opłacona {ord.paidAt ? `(${ord.paidAt})` : ''}</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>
                                Po terminie ({daysDiff !== null ? `${Math.abs(daysDiff)} dni` : 'zaległość'})
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                Do zapłaty {daysDiff !== null ? `(za ${daysDiff} dni)` : ''}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-slate-200/60 flex items-center justify-between gap-1.5 text-[10px] text-slate-500">
                          <span className="font-medium">Termin:</span>
                          <input
                            type="date"
                            value={effectiveDueDate}
                            onChange={(e) => handleUpdatePaymentDueDate(ord.id, e.target.value)}
                            className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-300 rounded focus:border-rose-400 focus:outline-none text-slate-700 cursor-pointer"
                            title="Kliknij, aby zmienić termin płatności dla tej faktury"
                          />
                        </div>
                      </div>

                      {/* CHECKBOX: TOWAR DOTARŁ DO ODBIORCY */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 min-w-[180px]">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={ord.isDelivered}
                            onChange={() => handleToggleDelivered(ord)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            Towar dotarł do odbiorcy
                          </span>
                        </label>
                        <div className="mt-1 pl-6">
                          {ord.isDelivered ? (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{ord.deliveredAt ? `Dotarł: ${ord.deliveredAt}` : 'Potwierdzono dostawę'}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Oczekuje na doręczenie</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MODUŁ SPEDYCJI: LIST PRZEWOZOWY, KURIER I STATUS PRZESYŁKI */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-rose-50/20 to-slate-50 p-3 rounded-xl border border-slate-200/80">
                    {/* LEWA STRONA: PRZEWOŹNIK, NUMER LISTU, ŚLEDZENIE */}
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
                        <Truck className="w-4 h-4 text-rose-500" />
                        <span>List przewozowy:</span>
                      </div>

                      {/* WYBÓR KURIERA */}
                      <select
                        value={ord.courierName || 'DPD'}
                        onChange={(e) => handleCourierChange(ord, e.target.value as ShippingCourier)}
                        className="px-2 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-rose-500 cursor-pointer shadow-2xs"
                        title="Firma kurierska / Przewoźnik"
                      >
                        {COURIER_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      {/* POLE NUMERU LISTU */}
                      <div className="flex items-center gap-1 flex-1 min-w-[190px] max-w-sm">
                        <input
                          type="text"
                          placeholder="Wpisz nr listu (np. 0000123... lub 62400...)..."
                          value={currentTrackingNumber}
                          onChange={(e) => handleTrackingNumberChange(ord.id, e.target.value)}
                          onBlur={() => handleSaveTrackingNumber(ord)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveTrackingNumber(ord);
                            }
                          }}
                          className="w-full px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 focus:border-rose-400 rounded-lg text-slate-900 shadow-2xs"
                        />
                        {currentTrackingNumber !== (ord.trackingNumber || '') && (
                          <button
                            type="button"
                            onClick={() => handleSaveTrackingNumber(ord)}
                            disabled={savingTrackingId === ord.id}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            {savingTrackingId === ord.id ? '...' : 'Zapisz'}
                          </button>
                        )}
                      </div>

                      {/* PRZYCISK KOPIOWANIA */}
                      {ord.trackingNumber && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(ord.trackingNumber || '');
                            setInvoiceNotice(`Skopiowano nr listu: ${ord.trackingNumber}`);
                            setTimeout(() => setInvoiceNotice(null), 2500);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                          title="Kopiuj numer listu przewozowego"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* PRZYCISK SPRAWDZANIA STATUSU U KURIERA */}
                      {ord.trackingNumber && (
                        <button
                          type="button"
                          onClick={() => handleCheckLiveTrackingStatus(ord)}
                          disabled={checkingTrackingId === ord.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                          title="Sprawdź status przesyłki u kuriera"
                        >
                          <RefreshCw className={`w-3 h-3 text-rose-500 ${checkingTrackingId === ord.id ? 'animate-spin' : ''}`} />
                          <span>{checkingTrackingId === ord.id ? '...' : 'Sprawdź status'}</span>
                        </button>
                      )}

                      {/* LINK DO ŚLEDZENIA PRZESYŁKI */}
                      {ord.trackingNumber && (
                        <a
                          href={getTrackingUrl(ord.trackingNumber, ord.courierName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (ord.trackingNumber) {
                              navigator.clipboard.writeText(ord.trackingNumber.trim());
                              setInvoiceNotice(
                                ord.courierName === 'Globkurier' || /^GK/i.test(ord.trackingNumber)
                                  ? `📋 Skopiowano numer ${ord.trackingNumber} do schowka! Wklej go (Ctrl+V) na stronie Globkurier.pl`
                                  : `Skopiowano nr listu do schowka (${ord.trackingNumber}) i otwarto portal kuriera.`
                              );
                              setTimeout(() => setInvoiceNotice(null), 4000);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                          title={`Otwórz oficjalne śledzenie przesyłki ${ord.courierName || 'Kurier'}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Śledź ↗</span>
                        </a>
                      )}
                    </div>

                    {/* PRAWA STRONA: STATUS PRZESYŁKI & AUTOMATYCZNE OZNACZENIE DORĘCZENIA */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Status paczki:
                      </span>

                      {/* DROPDOWN STATUSU PRZESYŁKI */}
                      <select
                        value={ord.shippingStatus || (ord.isDelivered ? 'delivered' : 'in_transit')}
                        onChange={(e) => handleShippingStatusChange(ord, e.target.value as ShippingStatus)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer shadow-2xs ${
                          currentShippingCfg.badgeClass
                        }`}
                        title="Zmień status przesyłki. Wybór 'Doręczona' automatycznie zaktualizuje status zamówienia jako doręczone z datą!"
                      >
                        {SHIPPING_STATUSES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.label}
                          </option>
                        ))}
                      </select>

                      {/* SZYBKI PRZYCISK: ⚡ OZNACZ JAKO DORĘCZONA */}
                      {!ord.isDelivered && (
                        <button
                          type="button"
                          onClick={() => handleShippingStatusChange(ord, 'delivered')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="Kliknij, aby jednym ruchem oznaczyć przesyłkę jako doręczoną i potwierdzić odbiór towaru przez aptekę"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>⚡ Doręczono</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* POLE NOTATKI (Z AUTOMATYCZNYM ZAPISEM) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
                      <span>📝 Notatka:</span>
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Wpisz notatkę (np. uwagi kierowcy, stan przesyłki, osoba odbierająca)..."
                        value={currentNote}
                        onChange={(e) => handleNoteChange(ord.id, e.target.value)}
                        onBlur={() => handleSaveNote(ord.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveNote(ord.id);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-rose-400 rounded-xl transition-colors text-slate-800"
                      />
                      {currentNote !== ord.notes && (
                        <button
                          type="button"
                          onClick={() => handleSaveNote(ord.id)}
                          disabled={isNoteSaving}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer shrink-0"
                        >
                          {isNoteSaving ? 'Zapisuję...' : 'Zapisz'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SEKCJA ZDJĘĆ PRZESYŁKI / DOWODU SPAKOWANIA PACZKI */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">Zdjęcia przesyłki / Dowód spakowania:</span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            ord.parcelPhotos && ord.parcelPhotos.length > 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {ord.parcelPhotos && ord.parcelPhotos.length > 0
                            ? `${ord.parcelPhotos.length} ${ord.parcelPhotos.length === 1 ? 'zdjęcie' : 'zdjęcia'}`
                            : 'Brak zdjęć'}
                        </span>
                      </div>

                      {/* PRZYCISK DODAWANIA ZDJĘĆ */}
                      <label
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                          uploadingPhotosOrderId === ord.id
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300'
                        }`}
                        title="Dodaj zdjęcia spakowanej paczki, kartonu lub etykiety kurierskiej"
                      >
                        {uploadingPhotosOrderId === ord.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            <span>Optymalizuję zdjęcia...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-rose-600" />
                            <span>+ Dodaj zdjęcia przesyłki</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              disabled={uploadingPhotosOrderId === ord.id}
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

                    {/* GALERIA MINIATUR LUB KOMUNIKAT O BRAKU Z OBSŁUGĄ DRAG & DROP */}
                    {ord.parcelPhotos && ord.parcelPhotos.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        {ord.parcelPhotos.map((photoUrl, photoIdx) => (
                          <div
                            key={photoIdx}
                            className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shadow-2xs hover:shadow-md transition-all shrink-0"
                          >
                            <img
                              src={photoUrl}
                              alt={`Paczka ${ord.invoiceNumber} - ${photoIdx + 1}`}
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-200"
                              onClick={() => setLightboxPhoto({ order: ord, photoIndex: photoIdx })}
                            />

                            {/* NAKŁADKA HOVER Z AKCJAMI */}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                              <button
                                type="button"
                                onClick={() => setLightboxPhoto({ order: ord, photoIndex: photoIdx })}
                                className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white hover:text-rose-600 transition-colors shadow-xs cursor-pointer"
                                title="Powiększ zdjęcie"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteParcelPhoto(ord, photoIdx)}
                                className="p-1.5 rounded-lg bg-rose-600/90 text-white hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
                                title="Usuń to zdjęcie"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* NUMEREK W ROGU */}
                            <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-900/70 text-white pointer-events-none">
                              #{photoIdx + 1}
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
                        className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-500 hover:bg-rose-50/30 hover:border-rose-300 transition-colors"
                      >
                        <Camera className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          Brak zdjęć paczki. Przeciągnij tutaj lub kliknij <strong>„+ Dodaj zdjęcia przesyłki”</strong>, aby zapisać dowód spakowania kartonu i etykiety dla klienta.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* PASEK AKCJI DLA ZAMÓWIENIA */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                      className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? 'Zwiń pozycje zamówienia' : `Pokaż pozycje (${ord.itemsCount})`}</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* PRZYCISK: WYSTAW FAKTURĘ KSEF DLA ZAMÓWIENIA OCZEKUJĄCEGO */}
                      {ord.documentType === 'ZAM' && ord.invoiceStatus !== 'external_billing' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onLoadOrderForInvoiceCreation) {
                              onLoadOrderForInvoiceCreation(ord);
                            } else {
                              onNavigateToInvoiceCreation();
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-white bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
                          title="Wystaw e-Fakturę KSeF dla tego zamówienia przed awizacją — automatycznie wczyta dane i pozycje"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>⚡ Wystaw Fakturę KSeF</span>
                        </button>
                      )}

                      {/* WYGENERUJ KOREKTĘ (tylko dla wystawionych faktur FV) */}
                      {ord.documentType !== 'ZAM' && (
                        <button
                          type="button"
                          onClick={() => onCreateCorrectionForOrder(ord)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl transition-colors cursor-pointer"
                          title="Wygeneruj oficjalną fakturę korygującą (KOR) do tej faktury"
                        >
                          <FileEdit className="w-3.5 h-3.5 text-fuchsia-600" />
                          <span>Wygeneruj Korektę</span>
                        </button>
                      )}

                      {/* WGRAJ XML DLA ZAMÓWIENIA */}
                      <label
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="Wgraj/podmień plik XML dla tego zamówienia, aby automatycznie odczytać numer faktury (<P_2>) i zaktualizować dane"
                      >
                        <Upload className="w-3.5 h-3.5 text-rose-500" />
                        <span>Wgraj XML</span>
                        <input
                          type="file"
                          accept=".xml,text/xml"
                          className="hidden"
                          onChange={(e) => handleUploadXmlForOrder(ord, e)}
                        />
                      </label>

                      {/* PODGLĄD XML I POBIERZ XML (jeśli plik XML istnieje) */}
                      {ord.xmlContent ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setViewXmlOrder(ord)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                          >
                            <FileCode className="w-3.5 h-3.5 text-slate-500" />
                            <span>Podgląd XML</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadXml(ord)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Pobierz XML</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded-xl">
                          Brak pliku XML
                        </span>
                      )}

                      {/* USUŃ */}
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(ord)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                        title="Usuń to zamówienie z historii"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ROZWINIĘCIE POZYCJI TOWAROWYCH */}
                {isExpanded && ord.items && ord.items.length > 0 && (
                  <div className="bg-slate-50/80 p-4 border-t border-slate-200 animate-in fade-in">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 mb-2">
                      <span>Pozycje na fakturze:</span>
                      <span className="font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        {effectiveInvoiceNumber}
                      </span>
                      {xmlInvoiceNo && (
                        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200" title="Numer faktury odczytany z węzła <P_2> w dołączonym pliku XML">
                          XML &lt;P_2&gt;: {xmlInvoiceNo}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Lp.</th>
                            <th className="py-2 px-3">Nazwa Produktu</th>
                            <th className="py-2 px-3">EAN / GTIN</th>
                            <th className="py-2 px-3">Seria & Ważność</th>
                            <th className="py-2 px-3 text-right">Ilość</th>
                            <th className="py-2 px-3 text-right">Cena Netto</th>
                            <th className="py-2 px-3 text-right">VAT</th>
                            <th className="py-2 px-3 text-right">Wartość Brutto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ord.items.map((it, idx) => {
                            const lineNet = it.quantity * it.netPrice;
                            const vatMultiplier = it.vatRate === '23%' ? 0.23 : it.vatRate === '8%' ? 0.08 : 0.05;
                            const lineGross = lineNet * (1 + vatMultiplier);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-medium text-slate-900">{it.name}</td>
                                <td className="py-2 px-3 font-mono text-slate-500">{it.gtin || '-'}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                  {it.batchNumber ? (
                                    <span>
                                      LOT: <strong>{it.batchNumber}</strong>
                                      {it.expiryDate ? ` · EXP: ${it.expiryDate}` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900">
                                  {it.quantity} {it.unit || 'szt.'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">
                                  {it.netPrice.toFixed(2)} zł
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600 font-mono">{it.vatRate}</td>
                                <td className="py-2 px-3 text-right font-bold font-mono text-slate-900">
                                  {lineGross.toFixed(2)} zł
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PODGLĄDU XML Z ARCHIWUM */}
      {viewXmlOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  {(() => {
                    const modalXmlNum = extractInvoiceNumberFromXml(viewXmlOrder.xmlContent);
                    const modalEffectiveNum =
                      viewXmlOrder.invoiceNumber && viewXmlOrder.invoiceNumber !== 'FAKTURA'
                        ? viewXmlOrder.invoiceNumber
                        : modalXmlNum || viewXmlOrder.invoiceNumber || 'Brak numeru';
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          Podgląd Archiwalnego XML: <span className="font-mono text-rose-700">{modalEffectiveNum}</span>
                        </h3>
                        {modalXmlNum && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200"
                            title="Numer faktury odnaleziony w węźle XML <P_2>"
                          >
                            &lt;P_2&gt;: {modalXmlNum}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-slate-500 font-mono">
                    {viewXmlOrder.chain} · {viewXmlOrder.buyer.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyModalXml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Skopiowano' : 'Kopiuj'}</span>
                </button>
                <button
                  onClick={() => handleDownloadXml(viewXmlOrder)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz plik XML</span>
                </button>
                <button
                  onClick={() => setViewXmlOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200 select-text">
              <pre className="whitespace-pre overflow-x-auto leading-relaxed">
                <code>{viewXmlOrder.xmlContent}</code>
              </pre>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewXmlOrder(null)}
                className="px-3 py-1 border border-slate-300 rounded-lg text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX DLA ZDJĘĆ PRZESYŁKI */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-white animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* PASEK GÓRNY LIGHTBOXA */}
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-sm">
                  Zdjęcie przesyłki #{lightboxPhoto.photoIndex + 1} z {lightboxPhoto.order.parcelPhotos?.length || 1}
                </span>
                <span className="text-slate-400 text-xs hidden sm:inline">
                  (Faktura: <strong className="text-white">{lightboxPhoto.order.invoiceNumber}</strong> · {lightboxPhoto.order.buyer?.name})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* POBIERZ ZDJĘCIE */}
                <button
                  type="button"
                  onClick={() => {
                    const photos = lightboxPhoto.order.parcelPhotos || [];
                    const currentUrl = photos[lightboxPhoto.photoIndex];
                    if (currentUrl) {
                      const cleanInv = (lightboxPhoto.order.invoiceNumber || 'zamowienie').replace(/[/\\?%*:|"<>]/g, '_');
                      downloadImageDataUrl(currentUrl, `paczka-${cleanInv}-foto-${lightboxPhoto.photoIndex + 1}.jpg`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Pobierz to zdjęcie na dysk komputera"
                >
                  <Download className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Pobierz</span>
                </button>

                {/* USUŃ ZDJĘCIE */}
                <button
                  type="button"
                  onClick={() => handleDeleteParcelPhoto(lightboxPhoto.order, lightboxPhoto.photoIndex)}
                  className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-rose-100 border border-rose-800/80 transition-colors cursor-pointer"
                  title="Usuń to zdjęcie"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* ZAMKNIJ */}
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
                  title="Zamknij podgląd (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* OBSZAR ZDJĘCIA */}
            <div className="flex-1 min-h-[320px] max-h-[72vh] p-2 sm:p-4 flex items-center justify-center bg-black/50 overflow-hidden relative select-none">
              {/* NAWIGACJA POPRZEDNIE */}
              {(lightboxPhoto.order.parcelPhotos?.length || 0) > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const total = lightboxPhoto.order.parcelPhotos?.length || 1;
                    const prevIndex = (lightboxPhoto.photoIndex - 1 + total) % total;
                    setLightboxPhoto({ order: lightboxPhoto.order, photoIndex: prevIndex });
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-lg z-10"
                  title="Poprzednie zdjęcie (Strzałka w lewo)"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}

              <img
                src={lightboxPhoto.order.parcelPhotos?.[lightboxPhoto.photoIndex]}
                alt={`Powiększenie zdjęcia ${lightboxPhoto.photoIndex + 1}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
              />

              {/* NAWIGACJA NASTĘPNE */}
              {(lightboxPhoto.order.parcelPhotos?.length || 0) > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const total = lightboxPhoto.order.parcelPhotos?.length || 1;
                    const nextIndex = (lightboxPhoto.photoIndex + 1) % total;
                    setLightboxPhoto({ order: lightboxPhoto.order, photoIndex: nextIndex });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-lg z-10"
                  title="Następne zdjęcie (Strzałka w prawo)"
                >
                  <ChevronDown className="w-5 h-5 -rotate-90" />
                </button>
              )}
            </div>

            {/* DOLNY PASEK */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Użyj klawiszy ◀ / ▶ na klawiaturze do przełączania zdjęć, a Esc do zamknięcia.</span>
              <span className="font-mono text-slate-300">
                {lightboxPhoto.photoIndex + 1} / {lightboxPhoto.order.parcelPhotos?.length || 1}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZBIORCZEJ WERYFIKACJI PRZESYŁEK W DRODZE */}
      {bulkModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setBulkModalOpen(false)}
        >
          <div
            className="relative bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* PASEK GÓRNY MODALU */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <Truck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Przesyłki w drodze</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                      {inTransitOrders.length} {inTransitOrders.length === 1 ? 'paczka' : 'paczek'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tylko przesyłki z nadanym numerem listu, które nie zostały jeszcze doręczone
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inTransitOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllInTransitAsDelivered}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
                    title="Oznacz wszystkie widoczne przesyłki jako doręczone do aptek"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>⚡ Oznacz wszystkie jako DORĘCZONE</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zamknij (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* LISTA PRZESYŁEK W DRODZE */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
              {inTransitOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-xl mb-3">
                    ✅
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Wszystkie przesyłki zostały doręczone!</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    W rejestrze nie ma obecnie żadnych przesyłek o statusie „W drodze”.
                  </p>
                </div>
              ) : (
                inTransitOrders.map((ord) => {
                  const courier = ord.courierName || detectCourierFromTrackingNumber(ord.trackingNumber || '');
                  const currentShippingCfg = getShippingStatusConfig(
                    ord.shippingStatus || (ord.isDelivered ? 'delivered' : 'in_transit')
                  );
                  const isGlobkurier = courier === 'Globkurier' || /^GK/i.test(ord.trackingNumber || '');

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-amber-300 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* DANE FAKTURY, NABYWCY I PRZESYŁKI */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {ord.invoiceNumber}
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200">
                            {ord.chain}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700">
                            {ord.buyer?.name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {courier}
                          </span>
                          <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 select-all">
                            {ord.trackingNumber}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${currentShippingCfg.badgeClass}`}>
                            {currentShippingCfg.label}
                          </span>
                          {ord.orderDate && (
                            <span className="text-slate-400 text-[11px]">
                              Data zam: {ord.orderDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* AKCJE DLA TEJ PRZESYŁKI */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* PRZYCISK: ŚLEDŹ U KURIERA */}
                        <a
                          href={getTrackingUrl(ord.trackingNumber || '', ord.courierName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (ord.trackingNumber) {
                              navigator.clipboard.writeText(ord.trackingNumber.trim());
                              setInvoiceNotice(
                                isGlobkurier
                                  ? `📋 Skopiowano numer ${ord.trackingNumber} do schowka! Wklej go (Ctrl+V) na otwartej stronie Globkurier.pl`
                                  : `Skopiowano nr listu (${ord.trackingNumber}) i otwarto stronę kuriera.`
                              );
                              setTimeout(() => setInvoiceNotice(null), 4000);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                          title={isGlobkurier ? 'Kopiuj numer GK i otwórz Globkurier.pl' : 'Otwórz stronę śledzenia kuriera'}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-rose-500" />
                          <span>Śledź ↗</span>
                        </a>

                        {/* PRZYCISK: OZNACZ JAKO DORĘCZONE */}
                        <button
                          type="button"
                          onClick={() => handleShippingStatusChange(ord, 'delivered')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors cursor-pointer shadow-2xs hover:scale-[1.02]"
                          title="Potwierdź doręczenie tej przesyłki do apteki"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>⚡ Doręczono</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DOLNY PASEK PODSUMOWANIA */}
            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                💡 <strong>Wskazówka:</strong> Po oznaczeniu przesyłki jako „Doręczona” znika ona z tej listy i automatycznie aktualizuje się w historii zamówień.
              </span>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 transition-colors cursor-pointer self-end sm:self-auto"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WCZYTYWANIA ZAMÓWIENIA Z WYPRZEDZENIEM / DLA SIECI ZEWNĘTRZNEJ */}
      <ImportOrderModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onOrderSaved={(newOrder) => {
          onRefreshOrders();
          setInvoiceNotice(
            `Pomyślnie dodano zamówienie ${newOrder.orderNumber || newOrder.id} (${newOrder.chain}) do realizacji!`
          );
          setTimeout(() => setInvoiceNotice(null), 4000);
        }}
      />
    </div>
  );
};
