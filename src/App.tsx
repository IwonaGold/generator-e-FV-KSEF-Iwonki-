import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { CombinedOrderInvoiceStep } from './components/CombinedOrderInvoiceStep';
import { Step3PhotosAndBatches } from './components/Step3PhotosAndBatches';
import { PriceListSection } from './components/PriceListSection';
import { ItemsPreviewTable } from './components/ItemsPreviewTable';
import { KSeFXMLModal } from './components/KSeFXMLModal';
import { WZDocumentModal } from './components/WZDocumentModal';
import { downloadOrderCSVFile } from './utils/orderCsvGenerator';
import { VisionLLMGuideModal } from './components/VisionLLMGuideModal';
import { EdiDozPrototypeModal } from './components/EdiDozPrototypeModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { DozEdiOrderSample } from './utils/ediGenerator';
import {
  SharedInvoiceDraft,
  getSharedDrafts,
  subscribeToMultiUserSync,
  WorkstationRole,
  getWorkstationRole,
  setWorkstationRole,
  clearSharedPackagingPhotos,
} from './utils/cloudSyncService';
import {
  PharmacyChain,
  LogisticsFormat,
  EntityDetails,
  EMPTY_BUYER,
  ThirdPartyEntity,
  InvoiceItem,
  InvoiceMeta,
  ParsedOrderData,
  OcrExtractionResult,
  KSeFSchemaVersion,
} from './types/ksef';
import { PriceListItem, PriceComparisonItem } from './types/priceList';
import {
  DEFAULT_SELLER,
  PHARMACY_CHAINS,
  PRESET_DR_MAX_ITEMS,
  PRESET_DR_MAX_META,
  PRESET_DOZ_ITEMS,
  PRESET_DOZ_META,
  PRESET_SUPER_PHARM_ITEMS,
  PRESET_SUPER_PHARM_META,
  PRESET_NO_BATCHES_ITEMS,
} from './utils/sampleData';
import { generateKSeFXML, validateKSeFInvoice } from './utils/ksefGenerator';
import {
  comparePricesWithInvoice,
  convertKnowledgePriceListToItems,
} from './utils/priceListParser';
import { matchOrBuildBuyerFromOrder, detectPharmacyChain } from './utils/orderParser';
import { AppModule } from './types/navigation';
import { HomePortalView } from './components/HomePortalView';
import { SubpageHeaderBar } from './components/SubpageHeaderBar';
import { InvoiceCorrectionView } from './components/InvoiceCorrectionView';
import { OrderHistoryView, OrderLifecycleTab } from './components/OrderHistoryView';
import { KnowledgeCenterView } from './components/KnowledgeCenterView';
import { WarehouseWorkstationView } from './components/WarehouseWorkstationView';
import { ArchivedOrder, OrderPackagingPhoto } from './types/ordersHistory';
import {
  getArchivedOrders,
  saveArchivedOrder,
  updateArchivedOrderFields,
} from './utils/ordersStorage';
import { extractInvoiceNumberFromXml } from './utils/ksefXmlParser';
import {
  DOZ_SPECIAL_PRICE_LIST,
  STANDARD_Q3_PRICE_LIST,
  INITIAL_KEY_CLIENTS,
  KeyClientProfile,
} from './types/knowledgeBase';
import { getKeyClients } from './utils/knowledgeStorage';

/**
 * Generator świeżych, czystych metadanych faktury (od zera)
 */
const getFreshInvoiceMeta = (): InvoiceMeta => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    invoiceNumber: '',
    invoiceType: 'VAT',
    issueDate: today,
    issuePlace: 'Gdańsk',
    deliveryDate: '',
    orderNumber: '',
    orderDate: '',
    dueDate: '',
    paymentDays: undefined,
    paymentMethod: 'przelew',
    currency: 'PLN',
    systemSource: 'KSeF Pharmacy Suite v3.2',
  };
};

const AUTH_STORAGE_KEY = 'iwonka_ksef_auth_session';

export default function App() {
  // --- Stan Uwierzytelnienia (Dostęp firmowy Eubiosis) ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem(AUTH_STORAGE_KEY) === 'true' ||
        sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true'
      );
    } catch {
      return false;
    }
  });

  const handleLoginSuccess = (_user: string, remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Storage error:', e);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Storage error:', e);
    }
    setIsAuthenticated(false);
  };

  // --- Stan Aplikacji: CZYSTY START OD ZERA ---
  const [selectedChain, setSelectedChain] = useState<PharmacyChain>('Custom');
  const [logisticsFormat, setLogisticsFormat] = useState<LogisticsFormat>('none');
  const [schemaVersion, setSchemaVersion] = useState<KSeFSchemaVersion>('FA3');

  const [seller, setSeller] = useState<EntityDetails>(DEFAULT_SELLER);
  const [buyer, setBuyer] = useState<EntityDetails>(EMPTY_BUYER);
  const [thirdParty, setThirdParty] = useState<ThirdPartyEntity | null>(null);
  const [meta, setMeta] = useState<InvoiceMeta>(getFreshInvoiceMeta());

  // Czysta lista pozycji (od zera)
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Plik zamówienia z kroku 1 (od zera)
  const [orderFile, setOrderFile] = useState<{ name: string; size: string } | null>(null);

  // Stan Cennika (Automatyczny z Centrum Wiedzy wg Odbiorcy lub Ręczny XLSX)
  const [manualPriceList, setManualPriceList] = useState<PriceListItem[] | null>(null);
  const [manualPriceListFileName, setManualPriceListFileName] = useState<string | null>(null);
  const [priceListSource, setPriceListSource] = useState<'knowledge_auto' | 'manual_xlsx'>('knowledge_auto');
  const [knowledgePriceListOverride, setKnowledgePriceListOverride] = useState<'DOZ_SPECIAL' | 'Q3_STANDARD' | null>(null);
  const [knowledgeClients, setKnowledgeClients] = useState<KeyClientProfile[]>(INITIAL_KEY_CLIENTS);
  const [isVerificationEnabled, setIsVerificationEnabled] = useState<boolean>(true);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

  // Modale
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isWzModalOpen, setIsWzModalOpen] = useState(false);
  const [isAiGuideOpen, setIsAiGuideOpen] = useState(false);
  const [isEdiModalOpen, setIsEdiModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [sharedDraftsCount, setSharedDraftsCount] = useState<number>(0);
  const [liveSyncToast, setLiveSyncToast] = useState<string | null>(null);

  // --- Moduł Aplikacji: 'home' (Strona startowa z 2 kafelkami) | 'invoice' | 'correction' | 'history' | 'knowledge' ---
  const [activeModule, setActiveModule] = useState<AppModule>(() => {
    try {
      const saved = localStorage.getItem('iwonka_active_module');
      if (
        saved === 'home' ||
        saved === 'invoice' ||
        saved === 'correction' ||
        saved === 'history' ||
        saved === 'knowledge'
      ) {
        return saved as AppModule;
      }
    } catch (e) {
      console.warn('Storage error:', e);
    }
    return 'home';
  });

  useEffect(() => {
    try {
      localStorage.setItem('iwonka_active_module', activeModule);
    } catch (e) {
      console.warn('Storage error:', e);
    }
  }, [activeModule]);

  const [archivedOrders, setArchivedOrders] = useState<ArchivedOrder[]>([]);
  const [orderHistoryTab, setOrderHistoryTab] = useState<OrderLifecycleTab>('in_progress');
  const [preloadedOrderForCorrection, setPreloadedOrderForCorrection] = useState<ArchivedOrder | null>(null);
  const [pendingOrderSourceId, setPendingOrderSourceId] = useState<string | null>(null);
  const [currentOrderPackagingPhotos, setCurrentOrderPackagingPhotos] = useState<OrderPackagingPhoto[]>([]);
  const [photoSectionResetKey, setPhotoSectionResetKey] = useState<number>(0);
  const [workstationRole, setWorkstationRoleState] = useState<WorkstationRole>(() =>
    getWorkstationRole()
  );

  const toastTimeoutRef = useRef<number | null>(null);

  const showLiveToast = useCallback((message: string) => {
    setLiveSyncToast(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setLiveSyncToast(null);
    }, 4500);
  }, []);

  const handleSwitchWorkstationRole = useCallback(
    (role: WorkstationRole) => {
      setWorkstationRole(role);
      setWorkstationRoleState(role);
      showLiveToast(
        role === 'warehouse'
          ? '📦 Przełączono na Stanowisko 2: Magazyn — widoczne są wyłącznie zadania przypisane przez Koordynatora'
          : '👩‍💼 Przełączono na Stanowisko 1: Koordynator — pełny dostęp do zamówień i faktur KSeF'
      );
    },
    [showLiveToast]
  );

  const refreshArchivedOrders = useCallback(async () => {
    const data = await getArchivedOrders();
    if (data && Array.isArray(data)) {
      setArchivedOrders(data);
    }
  }, []);

  const refreshAllCloudData = useCallback(async () => {
    try {
      const [ordersData, clientsData, draftsData] = await Promise.all([
        getArchivedOrders(),
        getKeyClients(),
        getSharedDrafts(),
      ]);
      if (ordersData && Array.isArray(ordersData)) {
        setArchivedOrders(ordersData);
      }
      if (clientsData && Array.isArray(clientsData) && clientsData.length > 0) {
        setKnowledgeClients(clientsData);
      }
      if (draftsData && Array.isArray(draftsData)) {
        setSharedDraftsCount(draftsData.length);
      }
    } catch {}
  }, []);

  // Pobranie historii oraz kart klientów z Centrum Wiedzy jednorazowo przy starcie aplikacji
  useEffect(() => {
    refreshAllCloudData();
  }, [refreshAllCloudData]);

  // Subskrypcja Real-Time Multi-User Sync (SSE + BroadcastChannel)
  useEffect(() => {
    const unsubscribe = subscribeToMultiUserSync({
      onRemoteUpdate: (ev) => {
        if (typeof ev.activeUsersCount === 'number' && ev.activeUsersCount > 0) {
          setActiveUsersCount(ev.activeUsersCount);
        }
        const actType = ev.activity?.type;
        if (ev.activity && actType && actType !== 'INIT' && actType !== 'WORKSTATION_CHANGED') {
          if (actType === 'KNOWLEDGE_UPDATED' || actType === 'KNOWLEDGE_DELETED') {
            getKeyClients().then((clients) => {
              if (Array.isArray(clients) && clients.length > 0) setKnowledgeClients(clients);
            });
          } else if (actType === 'SHARED_DRAFT_SAVED' || actType === 'SHARED_DRAFT_DELETED') {
            getSharedDrafts().then((drafts) => {
              if (Array.isArray(drafts)) setSharedDraftsCount(drafts.length);
            });
          } else if (actType === 'MANUAL_CLOUD_SYNC' || actType === 'CONFIG_UPDATED') {
            refreshAllCloudData();
          } else {
            refreshArchivedOrders();
          }
          showLiveToast(
            `☁️ Synchronizacja na żywo: ${ev.activity.summary} (${ev.activity.workstation})`
          );
        }
      },
    });
    return () => unsubscribe();
  }, [refreshAllCloudData, refreshArchivedOrders, showLiveToast]);

  const handleOrderSaved = useCallback((savedOrder: ArchivedOrder) => {
    setArchivedOrders((prev) => [savedOrder, ...prev.filter((o) => o.id !== savedOrder.id)]);
  }, []);

  // Dopasowanie bieżącego zamówienia na Karcie Zamówienia (wyłącznie dla jawnie aktywnego zamówienia przed wyczyszczeniem)
  const activeMatchedArchivedOrder = useMemo(() => {
    if (!pendingOrderSourceId) return null;
    return archivedOrders.find((o) => o.id === pendingOrderSourceId) || null;
  }, [archivedOrders, pendingOrderSourceId]);

  // Synchronizuj zdjęcia opakowań z dopasowanego zamówienia (np. gdy Magazyn doda nowe zdjęcia do tego zamówienia)
  useEffect(() => {
    if (!activeMatchedArchivedOrder) return;
    const orderPhotos = Array.isArray(activeMatchedArchivedOrder.packagingPhotos)
      ? activeMatchedArchivedOrder.packagingPhotos
      : [];
    if (orderPhotos.length === 0) return;
    setCurrentOrderPackagingPhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newOnes = orderPhotos.filter((p) => p?.id && !existingIds.has(p.id));
      if (newOnes.length === 0) return prev;
      return [...prev, ...newOnes];
    });
  }, [activeMatchedArchivedOrder]);

  // Aktualizacja zdjęć opakowań przypisanych do bieżącego zamówienia na karcie
  const handleUpdateCurrentOrderPackagingPhotos = useCallback(
    async (nextPhotos: OrderPackagingPhoto[]) => {
      setCurrentOrderPackagingPhotos(nextPhotos);
      if (pendingOrderSourceId) {
        await updateArchivedOrderFields(pendingOrderSourceId, {
          packagingPhotos: nextPhotos,
        });
        setArchivedOrders((prev) =>
          prev.map((o) =>
            o.id === pendingOrderSourceId ? { ...o, packagingPhotos: nextPhotos } : o
          )
        );
      }
    },
    [pendingOrderSourceId]
  );

  const activeWarehouseTasksCount = useMemo(() => {
    let count = 0;
    for (const o of archivedOrders) {
      const prodStatus =
        o.warehouseProductTaskStatus || (o.warehouseTaskStatus !== 'none' ? o.warehouseTaskStatus : 'none');
      const parcelStatus = o.warehouseParcelTaskStatus || 'none';
      if (prodStatus === 'assigned' || prodStatus === 'in_progress') count++;
      if (parcelStatus === 'assigned' || parcelStatus === 'in_progress') count++;
    }
    return count;
  }, [archivedOrders]);

  /**
   * 1. Wysłanie z Karty Zamówienia zadania nr 1 do Magazynu: "Uzupełnij zdjęcia produktów" (LOT / MHD)
   */
  const handleSendCurrentOrderToWarehouse = async (customTaskNote?: string) => {
    let net23 = 0, vat23 = 0, net8 = 0, vat8 = 0, net5 = 0, vat5 = 0;
    items.forEach((item) => {
      const lineNet = Math.round(item.quantity * item.netPrice * 100) / 100;
      if (item.vatRate === '23%') net23 += lineNet;
      else if (item.vatRate === '8%') net8 += lineNet;
      else if (item.vatRate === '5%') net5 += lineNet;
    });
    vat23 = Math.round(net23 * 0.23 * 100) / 100;
    vat8 = Math.round(net8 * 0.08 * 100) / 100;
    vat5 = Math.round(net5 * 0.05 * 100) / 100;
    const totalNet = Math.round((net23 + net8 + net5) * 100) / 100;
    const totalVat = Math.round((vat23 + vat8 + vat5) * 100) / 100;
    const totalGross = Math.round((totalNet + totalVat) * 100) / 100;

    const resolvedChain = detectPharmacyChain(buyer, thirdParty, selectedChain);
    const cleanOrdNo = (meta.orderNumber || '').trim();
    const existing =
      activeMatchedArchivedOrder ||
      (cleanOrdNo
        ? archivedOrders.find(
            (o) =>
              !o.isDelivered &&
              (o.orderNumber || '').trim().toLowerCase() === cleanOrdNo.toLowerCase()
          ) || null
        : null);
    const nowIso = new Date().toISOString();
    const hasInvoiceNum = Boolean(meta.invoiceNumber?.trim() && meta.invoiceNumber.trim() !== 'FAKTURA');
    const finalTaskNote =
      typeof customTaskNote === 'string'
        ? customTaskNote.trim()
        : activeMatchedArchivedOrder?.warehouseProductTaskNote ||
          activeMatchedArchivedOrder?.warehouseTaskNote ||
          '';

    const mergedPackagingPhotos =
      currentOrderPackagingPhotos.length > 0
        ? currentOrderPackagingPhotos
        : activeMatchedArchivedOrder?.packagingPhotos || [];

    const orderToAssign: ArchivedOrder = {
      ...(existing || {}),
      id: existing?.id || `ord-${Date.now()}`,
      chain: resolvedChain,
      documentType: existing?.documentType || (hasInvoiceNum ? 'FV' : 'ZAM'),
      invoiceStatus: existing?.invoiceStatus || (hasInvoiceNum ? 'issued' : 'awaiting_invoice'),
      invoiceNumber:
        meta.invoiceNumber?.trim() ||
        existing?.invoiceNumber ||
        (meta.orderNumber ? `ZAM ${meta.orderNumber}` : 'NOWE ZAMÓWIENIE'),
      orderNumber: meta.orderNumber || existing?.orderNumber || '',
      orderDate: meta.orderDate || existing?.orderDate || meta.issueDate,
      issueDate: meta.issueDate || existing?.issueDate || nowIso.slice(0, 10),
      avisoDate: meta.deliveryDate || existing?.avisoDate || meta.issueDate,
      deliveryDate: meta.deliveryDate || existing?.deliveryDate || meta.issueDate,
      dueDate: meta.dueDate || existing?.dueDate,
      seller,
      buyer,
      thirdParty,
      items: [...items],
      itemsCount: items.length,
      totalNet,
      totalVat,
      totalGross,
      currency: meta.currency || 'PLN',
      xmlContent: existing?.xmlContent || '',
      isDelivered: existing?.isDelivered || false,
      deliveredAt: existing?.deliveredAt || null,
      shippingStatus: existing?.shippingStatus || 'registered',
      trackingNumber: existing?.trackingNumber,
      courierName: existing?.courierName,
      notes:
        existing?.notes ||
        (orderFile
          ? `Zlecono Zadanie 1 (Uzupełnij zdjęcia etykiet kartonu) z pliku: ${orderFile.name}`
          : 'Zlecono Zadanie 1 (Uzupełnij zdjęcia etykiet kartonu) przez Koordynatora'),
      originalFileName: orderFile?.name || existing?.originalFileName,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      parcelPhotos: existing?.parcelPhotos || [],
      packagingPhotos: mergedPackagingPhotos,
      // Zadanie 1 (Z karty zamówienia): Uzupełnij zdjęcia etykiet kartonu
      warehouseProductTaskStatus: 'assigned',
      warehouseProductTaskAssignedAt: nowIso,
      warehouseProductTaskNote: finalTaskNote,
      // Zadanie 2 (Z poziomu W REALIZACJI): zachowaj dotychczasowy stan
      warehouseParcelTaskStatus: existing?.warehouseParcelTaskStatus || 'none',
      warehouseParcelTaskAssignedAt: existing?.warehouseParcelTaskAssignedAt || null,
      warehouseParcelTaskCompletedAt: existing?.warehouseParcelTaskCompletedAt || null,
      warehouseParcelTaskNote: existing?.warehouseParcelTaskNote || null,
      // Zbiorczy status dla kompatybilności
      warehouseTaskStatus: 'assigned',
      warehouseTaskAssignedAt: nowIso,
      warehouseTaskAssignedBy: '1. Koordynator',
      warehouseTaskNote: finalTaskNote,
    };

    const saved = await saveArchivedOrder(orderToAssign);
    setPendingOrderSourceId(saved.id);
    setCurrentOrderPackagingPhotos(saved.packagingPhotos || []);
    setArchivedOrders((prev) => [saved, ...prev.filter((o) => o.id !== saved.id)]);
    setPriceNotice(
      `📸 Wysłano do Magazynu zadanie: „Uzupełnij zdjęcia etykiet kartonu” dla zamówienia ${
        saved.orderNumber ? `nr ${saved.orderNumber}` : saved.invoiceNumber
      } (${saved.chain})!`
    );
    setTimeout(() => setPriceNotice(null), 6500);
  };

  const handleLoadSharedDraft = (draft: SharedInvoiceDraft) => {
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setSelectedChain(draft.selectedChain || 'Custom');
    setLogisticsFormat(draft.logisticsFormat || 'gs1_composite');
    if (draft.seller) setSeller(draft.seller);
    if (draft.buyer) setBuyer(draft.buyer);
    setThirdParty(draft.thirdParty || null);
    if (draft.meta) setMeta(draft.meta);
    if (draft.items && Array.isArray(draft.items)) {
      setItems([...draft.items]);
    }
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setOrderFile({
      name: `Wspólny_Stół_${draft.title.replace(/\s+/g, '_')}.json`,
      size: `od: ${draft.authorWorkstation}`,
    });
    setActiveModule('invoice');
    setPriceNotice(
      `🤝 Wczytano formularz ze Wspólnego Stołu Roboczego: "${draft.title}" (od: ${draft.authorWorkstation}).`
    );
    setTimeout(() => setPriceNotice(null), 6500);
  };

  const handleStartNewOrderOnCard = () => {
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setItems([]);
    setOrderFile(null);
    setManualPriceList(null);
    setManualPriceListFileName(null);
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setThirdParty(null);
    setBuyer(EMPTY_BUYER);
    setSelectedChain('Custom');
    setMeta(getFreshInvoiceMeta());
    setActiveModule('history');
    setOrderHistoryTab('new');
    setPriceNotice(
      '➕ Otwarto czystą kartę nowego zamówienia. Wgraj plik zamówienia lub uzupełnij pozycje, a na dole karty wybierz jedną z 3 opcji zapisu lub wygeneruj WZ.'
    );
    setTimeout(() => setPriceNotice(null), 6000);
  };

  const handleLoadOrderForInvoiceCreation = (order: ArchivedOrder) => {
    setPendingOrderSourceId(order.id);
    setCurrentOrderPackagingPhotos(Array.isArray(order.packagingPhotos) ? [...order.packagingPhotos] : []);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    const chain = order.chain || 'Custom';
    setSelectedChain(chain);
    if (chain === 'Super-Pharm' || chain === 'Gemini') {
      setLogisticsFormat('separate_fields');
    } else if (chain === 'DOZ') {
      setLogisticsFormat('gs1_composite');
    }
    if (order.seller) setSeller(order.seller);
    if (order.buyer) setBuyer(order.buyer);
    setThirdParty(order.thirdParty || null);
    if (order.items && order.items.length > 0) {
      setItems([...order.items]);
    }
    const isPlaceholderInvoiceNo =
      !order.invoiceNumber ||
      order.invoiceNumber === 'FAKTURA' ||
      order.invoiceNumber.startsWith('ZAM:') ||
      order.invoiceNumber.startsWith('ZAM ') ||
      order.invoiceNumber.startsWith('BEZ FV') ||
      order.invoiceNumber === 'ZAMÓWIENIE' ||
      order.invoiceNumber === 'ZAMÓWIENIE DO UZUPEŁNIENIA' ||
      order.invoiceNumber === 'WPISZ NR DOKUMENTU';

    setMeta((prev) => ({
      ...prev,
      issueDate: order.issueDate || prev.issueDate,
      orderNumber: order.orderNumber || '',
      orderDate: order.orderDate || '',
      deliveryDate: order.avisoDate || order.deliveryDate || '',
      dueDate: order.dueDate || '',
      invoiceNumber: !isPlaceholderInvoiceNo
        ? order.invoiceNumber
        : order.externalInvoiceNumber || '',
    }));
    if (order.originalFileName) {
      setOrderFile({ name: order.originalFileName, size: 'w realizacji' });
    } else if (order.orderNumber) {
      setOrderFile({ name: `Zamówienie_${order.orderNumber}.pdf`, size: 'w realizacji' });
    }
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setActiveModule('history');
    setOrderHistoryTab('new');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setPriceNotice(
      `✏️ Wrócono do karty zamówienia ${order.orderNumber || order.invoiceNumber} z folderu „W REALIZACJI”! Wczytano przypisane pozycje oraz zdjęcia opakowań (${order.packagingPhotos?.length || 0} szt.).`
    );
    setTimeout(() => setPriceNotice(null), 6500);
  };

  const handleSaveOrderFromCard = async (
    mode: 'with_fv_xml' | 'complete_later' | 'without_fv',
    navigateToInProgress?: boolean
  ) => {
    if (items.length === 0) {
      alert('Dodaj lub wczytaj przynajmniej 1 pozycję towarową na karcie zamówienia przed zapisem.');
      return;
    }

    let net23 = 0, vat23 = 0, net8 = 0, vat8 = 0, net5 = 0, vat5 = 0;
    items.forEach((item) => {
      const lineNet = Math.round(item.quantity * item.netPrice * 100) / 100;
      if (item.vatRate === '23%') net23 += lineNet;
      else if (item.vatRate === '8%') net8 += lineNet;
      else if (item.vatRate === '5%') net5 += lineNet;
    });
    vat23 = Math.round(net23 * 0.23 * 100) / 100;
    vat8 = Math.round(net8 * 0.08 * 100) / 100;
    vat5 = Math.round(net5 * 0.05 * 100) / 100;
    const totalNet = Math.round((net23 + net8 + net5) * 100) / 100;
    const totalVat = Math.round((vat23 + vat8 + vat5) * 100) / 100;
    const totalGross = Math.round((totalNet + totalVat) * 100) / 100;

    const resolvedChain = detectPharmacyChain(buyer, thirdParty, selectedChain);
    const xmlInvoiceNum = extractInvoiceNumberFromXml(xmlPayload);
    const rawMetaOrdNo = (meta.orderNumber || '').trim();
    const existingOrder =
      activeMatchedArchivedOrder ||
      (rawMetaOrdNo
        ? archivedOrders.find(
            (o) =>
              !o.isDelivered &&
              (o.orderNumber || '').trim().toLowerCase() === rawMetaOrdNo.toLowerCase()
          ) || null
        : null);
    const preservedShippingStatus =
      existingOrder &&
      !existingOrder.isDelivered &&
      existingOrder.shippingStatus &&
      existingOrder.shippingStatus !== 'delivered'
        ? existingOrder.shippingStatus
        : existingOrder?.trackingNumber
        ? 'in_transit'
        : 'registered';

    const cleanOrdNo = (meta.orderNumber || existingOrder?.orderNumber || '').trim();
    const cleanMetaInv = (meta.invoiceNumber || '').trim();
    const hasCustomMetaInv =
      Boolean(cleanMetaInv) &&
      cleanMetaInv !== 'FAKTURA' &&
      !cleanMetaInv.startsWith('ZAM:') &&
      !cleanMetaInv.startsWith('ZAM ');

    let documentType: 'FV' | 'ZAM' = 'FV';
    let invoiceStatus: 'issued' | 'awaiting_invoice' | 'external_billing' = 'issued';
    let resolvedInvoiceNumber = cleanMetaInv || xmlInvoiceNum || 'FAKTURA';
    let externalInvoiceNumber = existingOrder?.externalInvoiceNumber;
    let finalXmlContent = xmlPayload;
    let defaultNote = '';

    if (mode === 'with_fv_xml') {
      documentType = 'FV';
      invoiceStatus = 'issued';
      resolvedInvoiceNumber = cleanMetaInv || xmlInvoiceNum || 'FAKTURA';
      finalXmlContent = xmlPayload;
      defaultNote = orderFile
        ? `Wystawiono fakturę KSeF XML z pliku: ${orderFile.name} (W REALIZACJI — oczekuje na list przewozowy i doręczenie)`
        : 'Wystawiono fakturę KSeF XML (W REALIZACJI — oczekuje na list przewozowy i doręczenie)';
    } else if (mode === 'complete_later') {
      documentType = 'ZAM';
      invoiceStatus = 'awaiting_invoice';
      resolvedInvoiceNumber = cleanOrdNo ? `ZAM: ${cleanOrdNo}` : 'ZAMÓWIENIE DO UZUPEŁNIENIA';
      finalXmlContent = '';
      defaultNote =
        'Zapisano do późniejszego uzupełnienia — pakowanie, zdjęcia opakowań (LOT/MHD), dane do FV i wystawienie FV odbędą się później (wróć do karty zamówienia z poziomu W REALIZACJI)';
    } else {
      // mode === 'without_fv'
      documentType = 'ZAM';
      invoiceStatus = 'external_billing';
      externalInvoiceNumber =
        existingOrder?.externalInvoiceNumber || (hasCustomMetaInv ? cleanMetaInv : '');
      resolvedInvoiceNumber =
        externalInvoiceNumber ||
        (cleanOrdNo ? `BEZ FV (ZAM ${cleanOrdNo})` : 'WPISZ NR DOKUMENTU');
      finalXmlContent = '';
      defaultNote =
        'Zapisano bez wystawiania FV XML — wpisz ręcznie numer dokumentu na karcie zamówienia w folderze W REALIZACJI';
    }

    const allItemsHaveLotAndExp =
      items.length > 0 &&
      items.every(
        (it) =>
          Boolean(String(it.batchNumber || '').trim()) &&
          Boolean(String(it.expiryDate || '').trim())
      );

    // Po zapisaniu informacji o dacie ważności (MHD/EXP) i serii (LOT) lub wystawieniu FV XML
    // usuwamy zdjęcia opakowań produktów (w historii zostają wyłącznie zdjęcia gotowych przesyłek parcelPhotos)
    const shouldPurgeProductPhotos = mode === 'with_fv_xml' || allItemsHaveLotAndExp;

    const mergedPackagingPhotos = shouldPurgeProductPhotos
      ? []
      : currentOrderPackagingPhotos.length > 0
      ? currentOrderPackagingPhotos
      : existingOrder?.packagingPhotos || [];


    const nowIso = new Date().toISOString();
    const savedOrder: ArchivedOrder = {
      ...(existingOrder || {}),
      id: existingOrder?.id || `ord-${Date.now()}`,
      chain: resolvedChain,
      documentType,
      invoiceStatus,
      invoiceNumber: resolvedInvoiceNumber,
      externalInvoiceNumber,
      orderNumber: cleanOrdNo || existingOrder?.orderNumber,
      orderDate: meta.orderDate || existingOrder?.orderDate,
      issueDate: meta.issueDate,
      avisoDate: meta.deliveryDate || existingOrder?.avisoDate,
      deliveryDate: meta.deliveryDate || existingOrder?.deliveryDate,
      dueDate: meta.dueDate || existingOrder?.dueDate,
      seller,
      buyer,
      thirdParty,
      items: [...items],
      itemsCount: items.length,
      totalNet,
      totalVat,
      totalGross,
      currency: meta.currency || 'PLN',
      xmlContent: finalXmlContent,
      // Każde nowe zamówienie trafia do folderu W REALIZACJI
      // (dopiero po zaznaczeniu "Towar dotarł do klienta" przechodzi do ZAKOŃCZONE)
      isDelivered: false,
      deliveredAt: null,
      shippingStatus: preservedShippingStatus,
      trackingNumber: existingOrder?.trackingNumber,
      courierName: existingOrder?.courierName,
      notes: existingOrder?.notes || defaultNote,
      originalFileName: orderFile?.name || existingOrder?.originalFileName,
      createdAt: existingOrder?.createdAt || nowIso,
      updatedAt: nowIso,
      parcelPhotos: existingOrder?.parcelPhotos || [],
      packagingPhotos: mergedPackagingPhotos,
      warehouseProductTaskStatus: existingOrder?.warehouseProductTaskStatus || 'none',
      warehouseProductTaskAssignedAt: existingOrder?.warehouseProductTaskAssignedAt || null,
      warehouseProductTaskCompletedAt: existingOrder?.warehouseProductTaskCompletedAt || null,
      warehouseProductTaskNote: existingOrder?.warehouseProductTaskNote || null,
      warehouseParcelTaskStatus: existingOrder?.warehouseParcelTaskStatus || 'none',
      warehouseParcelTaskAssignedAt: existingOrder?.warehouseParcelTaskAssignedAt || null,
      warehouseParcelTaskCompletedAt: existingOrder?.warehouseParcelTaskCompletedAt || null,
      warehouseParcelTaskNote: existingOrder?.warehouseParcelTaskNote || null,
      warehouseTaskStatus: existingOrder?.warehouseTaskStatus || 'none',
      warehouseTaskNote: existingOrder?.warehouseTaskNote,
    };

    const saved = await saveArchivedOrder(savedOrder);
    setArchivedOrders((prev) => [saved, ...prev.filter((o) => o.id !== saved.id)]);
    setPendingOrderSourceId(saved.id);
    setCurrentOrderPackagingPhotos(saved.packagingPhotos || []);
    clearSharedPackagingPhotos();

    if (mode === 'with_fv_xml') {
      setPriceNotice(
        `🧾 Zapisano zamówienie z wystawioną fakturą XML (${saved.invoiceNumber}) w folderze „W REALIZACJI”! Pobierz plik XML lub przejdź do W REALIZACJI, aby uzupełnić list przewozowy.`
      );
      setTimeout(() => setPriceNotice(null), 7000);
      if (navigateToInProgress === true) {
        setIsXmlModalOpen(false);
        setOrderHistoryTab('in_progress');
        setActiveModule('history');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setIsXmlModalOpen(true);
      }
    } else if (mode === 'complete_later') {
      setPriceNotice(
        `⏳ Zapisano zamówienie ${saved.orderNumber || saved.invoiceNumber} w folderze „W REALIZACJI” do późniejszego uzupełnienia (pakowanie, zdjęcia opakowań, dane do FV).`
      );
      setTimeout(() => setPriceNotice(null), 7000);
      setOrderHistoryTab('in_progress');
      setActiveModule('history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPriceNotice(
        `📝 Zapisano zamówienie ${saved.orderNumber || saved.invoiceNumber} bez wystawiania FV w folderze „W REALIZACJI” — możesz tam wpisać numer dokumentu ręcznie.`
      );
      setTimeout(() => setPriceNotice(null), 7000);
      setOrderHistoryTab('in_progress');
      setActiveModule('history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveInvoiceToHistory = async (navigateToInProgress?: boolean) => {
    await handleSaveOrderFromCard('with_fv_xml', navigateToInProgress);
  };

  // --- AUTOMATYCZNY DOBÓR CENNIKA Z CENTRUM WIEDZY WG PRZYPISANEGO ODBIORCY ---
  const {
    effectivePriceList,
    effectivePriceListName,
    activeKnowledgePriceListType,
    matchedRecipientLabel,
  } = useMemo(() => {
    const cleanNip = (buyer.nip || '').replace(/\D/g, '');
    const combinedText = `${selectedChain} ${buyer.name || ''} ${thirdParty?.name || ''}`.toLowerCase();

    const matchedClient = (knowledgeClients || []).find((kc) => {
      const kcNip = (kc.nip || '').replace(/\D/g, '');
      if (cleanNip && kcNip && cleanNip === kcNip) return true;
      if (selectedChain === 'DOZ' && kc.id === 'client-doz') return true;
      if (selectedChain === 'Dr. Max' && kc.id === 'client-drmax') return true;
      if (selectedChain === 'Super-Pharm' && kc.id === 'client-superpharm') return true;
      if (selectedChain === 'Gemini' && kc.id === 'client-gemini') return true;
      if (combinedText.includes('doz') && kc.id === 'client-doz') return true;
      if (
        (combinedText.includes('dr. max') ||
          combinedText.includes('drmax') ||
          combinedText.includes('lekomat')) &&
        kc.id === 'client-drmax'
      )
        return true;
      if (
        (combinedText.includes('super-pharm') ||
          combinedText.includes('super pharm') ||
          combinedText.includes('superpharm')) &&
        kc.id === 'client-superpharm'
      )
        return true;
      if (combinedText.includes('gemini') && kc.id === 'client-gemini') return true;
      if (combinedText.includes('modum') && kc.id === 'client-modumpharma') return true;
      const shortLower = (kc.shortName || '').toLowerCase();
      return shortLower.length > 2 && combinedText.includes(shortLower);
    });

    const isDozRecipient =
      matchedClient?.priceListType === 'DOZ_SPECIAL' ||
      matchedClient?.id === 'client-doz' ||
      selectedChain === 'DOZ' ||
      cleanNip === '8271807718' ||
      combinedText.includes('doz');

    const resolvedKnowledgeType: 'DOZ_SPECIAL' | 'Q3_STANDARD' =
      knowledgePriceListOverride || (isDozRecipient ? 'DOZ_SPECIAL' : 'Q3_STANDARD');

    const recipientLabel =
      matchedClient?.shortName ||
      (selectedChain !== 'Custom' ? selectedChain : buyer.name?.trim() || 'Wszystkie sieci (Domyślny Q3)');

    if (priceListSource === 'manual_xlsx' && manualPriceList && manualPriceList.length > 0) {
      return {
        effectivePriceList: manualPriceList,
        effectivePriceListName: manualPriceListFileName || 'Wgrany cennik XLSX',
        activeKnowledgePriceListType: resolvedKnowledgeType,
        matchedRecipientLabel: recipientLabel,
      };
    }

    const knowledgeList =
      resolvedKnowledgeType === 'DOZ_SPECIAL'
        ? convertKnowledgePriceListToItems(DOZ_SPECIAL_PRICE_LIST)
        : convertKnowledgePriceListToItems(STANDARD_Q3_PRICE_LIST);

    const knowledgeName =
      resolvedKnowledgeType === 'DOZ_SPECIAL'
        ? 'Cennik Centrum Wiedzy: DOZ Direct od 08.2026 (Kolumna O — rabat 12% netto na FV)'
        : `Cennik Centrum Wiedzy (${recipientLabel}): Cennik Standardowy Q3 2026 (rabat 5% netto na FV)`;

    return {
      effectivePriceList: knowledgeList,
      effectivePriceListName: knowledgeName,
      activeKnowledgePriceListType: resolvedKnowledgeType,
      matchedRecipientLabel: recipientLabel,
    };
  }, [
    buyer.name,
    buyer.nip,
    thirdParty?.name,
    selectedChain,
    knowledgeClients,
    knowledgePriceListOverride,
    priceListSource,
    manualPriceList,
    manualPriceListFileName,
  ]);

  // Wyliczanie porównania cen i kodów EAN z aktywnym cennikiem
  const { comparisons, auditSummary } = useMemo(() => {
    if (!effectivePriceList || effectivePriceList.length === 0) {
      return { comparisons: new Map<string, PriceComparisonItem>(), auditSummary: null };
    }
    const result = comparePricesWithInvoice(items, effectivePriceList);
    return { comparisons: result.comparisons, auditSummary: result.summary };
  }, [items, effectivePriceList]);

  // --- Resetowanie Wszystkiego do Czystego Stanu (Od Zera) ---
  const handleResetEverything = () => {
    const cleanOrdNo = (meta.orderNumber || '').trim().toLowerCase();
    const orderToReset =
      activeMatchedArchivedOrder ||
      (cleanOrdNo
        ? archivedOrders.find(
            (o) => !o.isDelivered && (o.orderNumber || '').trim().toLowerCase() === cleanOrdNo
          )
        : null);

    if (orderToReset) {
      const nextParcelStatus = orderToReset.warehouseParcelTaskStatus || 'none';
      const nextCombinedStatus = nextParcelStatus !== 'none' ? nextParcelStatus : 'none';
      updateArchivedOrderFields(orderToReset.id, {
        warehouseProductTaskStatus: 'none',
        warehouseProductTaskAssignedAt: null,
        warehouseProductTaskCompletedAt: null,
        warehouseProductTaskNote: null,
        warehouseTaskStatus: nextCombinedStatus,
      }).catch(() => {});
      setArchivedOrders((prev) =>
        prev.map((o) =>
          o.id === orderToReset.id
            ? {
                ...o,
                warehouseProductTaskStatus: 'none',
                warehouseProductTaskAssignedAt: null,
                warehouseProductTaskCompletedAt: null,
                warehouseProductTaskNote: null,
                warehouseTaskStatus: nextCombinedStatus,
              }
            : o
        )
      );
    }

    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setItems([]);
    setOrderFile(null);
    setManualPriceList(null);
    setManualPriceListFileName(null);
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setThirdParty(null);
    setBuyer(EMPTY_BUYER);
    setSelectedChain('Custom');
    setMeta(getFreshInvoiceMeta());
    setPriceNotice(
      '🧹 Wyczyszczono kartę zamówienia i widoczne na niej zdjęcia oraz przywrócono możliwość wysłania zadania do Magazynu: „Uzupełnij zdjęcia produktów”.'
    );
    setTimeout(() => setPriceNotice(null), 5000);
  };

  // --- Handlery Cennika (Centrum Wiedzy & XLSX) ---
  const handlePriceListLoaded = (fileName: string, parsedItems: PriceListItem[]) => {
    setManualPriceList(parsedItems);
    setManualPriceListFileName(fileName);
    setPriceListSource('manual_xlsx');
    setIsVerificationEnabled(true);
    setPriceNotice(`Pomyślnie załadowano własny cennik ${fileName} (${parsedItems.length} pozycji).`);
    setTimeout(() => setPriceNotice(null), 4000);
  };

  const handleClearPriceList = () => {
    setManualPriceList(null);
    setManualPriceListFileName(null);
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setPriceNotice('Przywrócono automatyczny cennik przypisany do odbiorcy w Centrum Wiedzy.');
    setTimeout(() => setPriceNotice(null), 4000);
  };

  const handleSwitchKnowledgePriceList = (type: 'DOZ_SPECIAL' | 'Q3_STANDARD' | 'AUTO') => {
    setPriceListSource('knowledge_auto');
    if (type === 'AUTO') {
      setKnowledgePriceListOverride(null);
    } else {
      setKnowledgePriceListOverride(type);
    }
    setIsVerificationEnabled(true);
  };

  // Krok 4: Zastosowanie WSZYSTKICH danych z cennika (zarówno cen netto po rabacie, jak i kodów EAN)
  const handleApplyAllFromPriceList = () => {
    if (!effectivePriceList) return;

    let updatedPriceCount = 0;
    let updatedGtinCount = 0;

    const newItems = items.map((item) => {
      const comp = comparisons.get(item.id);
      if (!comp) return item;

      let nextPrice = item.netPrice;
      let nextGtin = item.gtin;

      if (comp.status === 'discrepancy' && comp.priceListPrice !== null) {
        nextPrice = comp.priceListPrice;
        updatedPriceCount++;
      }

      if (
        comp.priceListGtin &&
        (comp.gtinStatus === 'discrepancy' || comp.gtinStatus === 'missing_in_order')
      ) {
        nextGtin = comp.priceListGtin;
        updatedGtinCount++;
      }

      if (nextPrice !== item.netPrice || nextGtin !== item.gtin) {
        return {
          ...item,
          netPrice: nextPrice,
          gtin: nextGtin,
        };
      }
      return item;
    });

    setItems(newItems);
    setPriceNotice(
      `⚡ Automatycznie uzupełniono z cennika: ${updatedPriceCount} ${
        updatedPriceCount === 1 ? 'cenę netto po rabacie' : 'cen netto po rabacie'
      } oraz ${updatedGtinCount} ${
        updatedGtinCount === 1 ? 'kod EAN/GTIN' : 'kodów EAN/GTIN'
      }!`
    );
    setTimeout(() => setPriceNotice(null), 5000);
  };

  // Krok 4 Opcja 2: Użycie cen z cennika dla pozycji z rozbieżnościami
  const handleApplyPriceListDiscrepancies = () => {
    if (!effectivePriceList) return;

    let updatedCount = 0;
    const newItems = items.map((item) => {
      const comp = comparisons.get(item.id);
      if (comp && comp.status === 'discrepancy' && comp.priceListPrice !== null) {
        updatedCount++;
        return {
          ...item,
          netPrice: comp.priceListPrice,
        };
      }
      return item;
    });

    setItems(newItems);
    setPriceNotice(
      `Zaktualizowano ${updatedCount} ${
        updatedCount === 1 ? 'cenę' : 'ceny'
      } na podstawie cennika netto po rabacie.`
    );
    setTimeout(() => setPriceNotice(null), 5000);
  };

  const handleApplySinglePrice = (itemId: string, newPrice: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, netPrice: newPrice } : item))
    );
  };

  // Zastosowanie kodów EAN/GTIN z cennika dla pozycji z rozbieżnościami lub brakującymi
  const handleApplyPriceListGtins = () => {
    if (!effectivePriceList) return;

    let updatedCount = 0;
    const newItems = items.map((item) => {
      const comp = comparisons.get(item.id);
      if (comp && comp.priceListGtin && (comp.gtinStatus === 'discrepancy' || comp.gtinStatus === 'missing_in_order')) {
        updatedCount++;
        return {
          ...item,
          gtin: comp.priceListGtin,
        };
      }
      return item;
    });

    setItems(newItems);
    setPriceNotice(
      `Zaktualizowano ${updatedCount} ${
        updatedCount === 1 ? 'kod EAN/GTIN' : 'kody EAN/GTIN'
      } na podstawie cennika.`
    );
    setTimeout(() => setPriceNotice(null), 5000);
  };

  const handleApplySingleGtin = (itemId: string, newGtin: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, gtin: newGtin } : item))
    );
  };

  const handleApplySingleBoth = (
    itemId: string,
    newPrice?: number | null,
    newGtin?: string | null
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          netPrice: typeof newPrice === 'number' && newPrice > 0 ? newPrice : item.netPrice,
          gtin: newGtin ? newGtin : item.gtin,
        };
      })
    );
  };

  // --- Handlery Sieci i Presety Faktur ---
  const handleSelectChain = (chain: PharmacyChain) => {
    setSelectedChain(chain);
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    const profile = PHARMACY_CHAINS[chain];
    if (profile && chain !== 'Custom') {
      setBuyer({ ...profile.buyer });
      setThirdParty(profile.thirdParty ? { ...profile.thirdParty } : null);
      if (profile.preferredLogisticsFormat) {
        setLogisticsFormat(profile.preferredLogisticsFormat);
      }
      if (profile.standardPaymentDays) {
        const baseDateStr = meta.deliveryDate || meta.issueDate || meta.orderDate;
        const base = baseDateStr ? new Date(baseDateStr) : new Date();
        base.setDate(base.getDate() + profile.standardPaymentDays);
        setMeta((prev) => ({
          ...prev,
          paymentDays: profile.standardPaymentDays,
          dueDate: base.toISOString().slice(0, 10),
        }));
      }
    } else {
      setBuyer(EMPTY_BUYER);
      setThirdParty(null);
    }
  };

  const handleLoadPresetSuperPharm = () => {
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setSelectedChain('Super-Pharm');
    setBuyer({ ...PHARMACY_CHAINS['Super-Pharm'].buyer });
    setThirdParty(
      PHARMACY_CHAINS['Super-Pharm'].thirdParty
        ? { ...PHARMACY_CHAINS['Super-Pharm'].thirdParty }
        : null
    );
    setSeller({ ...DEFAULT_SELLER });
    setMeta({ ...PRESET_SUPER_PHARM_META });
    setItems([...PRESET_SUPER_PHARM_ITEMS]);
    setLogisticsFormat('separate_fields');
    setOrderFile({ name: 'zamowienie_C008848894_SuperPharm.txt', size: '2.8 KB' });
    setPriceNotice('Załadowano oficjalny wzorzec faktury 35/2026/KSEF (Super-Pharm, 10 pozycji).');
    setTimeout(() => setPriceNotice(null), 5000);
  };

  const handleLoadPresetDrMax = () => {
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setSelectedChain('Dr. Max');
    setBuyer({ ...PHARMACY_CHAINS['Dr. Max'].buyer });
    setThirdParty(null);
    setSeller({ ...DEFAULT_SELLER });
    setMeta({ ...PRESET_DR_MAX_META });
    setItems([...PRESET_DR_MAX_ITEMS]);
    setLogisticsFormat('gs1_composite');
    setOrderFile({ name: 'zamowienie_ZZ_1009_09_26.txt', size: '1.9 KB' });
  };

  const handleLoadPresetDoz = () => {
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setSelectedChain('DOZ');
    setBuyer({ ...PHARMACY_CHAINS['DOZ'].buyer });
    setThirdParty(null);
    setSeller({ ...DEFAULT_SELLER });
    setMeta({ ...PRESET_DOZ_META });
    setItems([...PRESET_DOZ_ITEMS]);
    setLogisticsFormat('gs1_composite');
    setOrderFile({ name: 'zamowienie_22122_2026_KPD.txt', size: '2.4 KB' });
  };

  const handleLoadEdiOrderToApp = (ediOrder: DozEdiOrderSample) => {
    const today = new Date().toISOString().slice(0, 10);
    const deliv = ediOrder.expectedDeliveryDate || today;
    const dueObj = new Date(deliv);
    dueObj.setDate(dueObj.getDate() + 60);
    const dueDateStr = dueObj.toISOString().slice(0, 10);

    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setSelectedChain('DOZ');
    setBuyer({ ...PHARMACY_CHAINS['DOZ'].buyer });
    setThirdParty(null);
    setSeller({ ...DEFAULT_SELLER });
    setMeta((prev) => ({
      ...prev,
      invoiceNumber: prev.invoiceNumber || `FV/2026/10/DOZ-${ediOrder.orderNumber.slice(0, 5)}`,
      issueDate: today,
      deliveryDate: deliv,
      orderNumber: ediOrder.orderNumber,
      orderDate: ediOrder.orderDate,
      paymentDays: 60,
      dueDate: dueDateStr,
    }));
    setItems(ediOrder.items.map((it) => ({ ...it })));
    setLogisticsFormat('gs1_composite');
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride('DOZ_SPECIAL');
    setOrderFile({
      name: `EDI_ORDERS_${ediOrder.orderNumber.replace(/\//g, '_')}.xml`,
      size: 'Bramka EDI DOZ Direct',
    });
    setActiveModule('invoice');
    setPriceNotice(
      `📡 Wczytano zamówienie EDI ORDERS nr ${ediOrder.orderNumber} z bramki DOZ Direct (${ediOrder.items.length} pozycji · Cennik Kolumna O -12% · Termin 60 dni · Brak Podmiot3).`
    );
    setTimeout(() => setPriceNotice(null), 7000);
  };

  const handleUpdateItem = (id: string, updatedFields: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      name: 'Nowa pozycja farmaceutyczna',
      gtin: '9120117' + Math.floor(100000 + Math.random() * 900000),
      quantity: 10,
      unit: 'SZT.',
      netPrice: 95.0,
      vatRate: '8%',
      batchNumber: '25E' + Math.floor(1000 + Math.random() * 9000),
      expiryDate: '2028-06-30',
      quantityInBatch: 10,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleQuickFillBatches = () => {
    setItems((prev) =>
      prev.map((item, index) => {
        const needsBatch = !item.batchNumber || item.batchNumber.trim() === '';
        const needsExp = !item.expiryDate || item.expiryDate.trim() === '';
        return {
          ...item,
          batchNumber: needsBatch ? `25E${3000 + index}` : item.batchNumber,
          expiryDate: needsExp ? '2028-06-30' : item.expiryDate,
          quantityInBatch: item.quantityInBatch || item.quantity,
        };
      })
    );
  };

  const handleLoadPresetNoBatches = () => {
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setSelectedChain('Dr. Max');
    setBuyer({ ...PHARMACY_CHAINS['Dr. Max'].buyer });
    setThirdParty(null);
    setSeller({ ...DEFAULT_SELLER });
    setMeta({ ...PRESET_DR_MAX_META });
    setItems([...PRESET_NO_BATCHES_ITEMS]);
    setLogisticsFormat('none');
    setOrderFile({ name: 'zamowienie_bez_serii_i_dat.txt', size: '1.4 KB' });
    setPriceNotice('Załadowano wzorzec zamówienia bez serii i dat ważności (tryb standardowej faktury KSeF).');
    setTimeout(() => setPriceNotice(null), 5000);
  };

  const handleClearBatches = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        batchNumber: '',
        expiryDate: '',
        ocrMatched: false,
      }))
    );
    setLogisticsFormat('none');
    setPriceNotice('Wyczyszczono serie i daty ważności ze wszystkich pozycji (faktura standardowa).');
    setTimeout(() => setPriceNotice(null), 4000);
  };

  // Krok 1: Parsowanie specyfikacji zamówienia na karcie wprowadzania zamówienia
  const handleOrderTextParsed = (
    parsedItems: Partial<InvoiceItem>[],
    _rawText: string,
    parsedHeader?: ParsedOrderData,
    hasBatchesOrExpiry?: boolean
  ) => {
    const newItems: InvoiceItem[] = parsedItems.map((pi, idx) => ({
      id: `parsed-${Date.now()}-${idx}`,
      name: pi.name || 'Produkt leczniczy',
      gtin: pi.gtin || '9120000000000',
      bloz7: pi.bloz7,
      quantity: pi.quantity || 1,
      unit: pi.unit || 'SZT.',
      netPrice: pi.netPrice || 100.0,
      vatRate: pi.vatRate || '8%',
      batchNumber: pi.batchNumber || '',
      expiryDate: pi.expiryDate || '',
      quantityInBatch: pi.quantity || 1,
    }));
    setItems(newItems);
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setIsVerificationEnabled(true);

    if (parsedHeader) {
      const match = matchOrBuildBuyerFromOrder(parsedHeader, selectedChain);

      setSelectedChain(match.chain);
      setBuyer(match.buyer);
      setThirdParty(match.thirdParty);

      // Automatycznie ustaw wymagany przez sieć format dat ważności i serii w KSeF
      if (match.chain === 'Super-Pharm' || match.chain === 'Gemini') {
        setLogisticsFormat('separate_fields');
      } else if (match.chain === 'DOZ') {
        setLogisticsFormat('gs1_composite');
      } else if (PHARMACY_CHAINS[match.chain]?.preferredLogisticsFormat && match.chain !== 'Dr. Max') {
        setLogisticsFormat(PHARMACY_CHAINS[match.chain].preferredLogisticsFormat);
      } else {
        setLogisticsFormat(hasBatchesOrExpiry ? 'gs1_composite' : 'none');
      }

      setMeta((prev) => ({
        ...prev,
        orderNumber: match.metaUpdates.orderNumber || prev.orderNumber,
        orderDate: match.metaUpdates.orderDate || prev.orderDate,
        dueDate: match.metaUpdates.dueDate || prev.dueDate,
        deliveryDate: match.metaUpdates.deliveryDate || prev.deliveryDate,
        paymentDays: match.metaUpdates.paymentDays ?? prev.paymentDays,
        paymentMethod: match.metaUpdates.paymentMethod || prev.paymentMethod,
      }));

      const chainLabel = match.isRecognizedChain
        ? `rozpoznano profil: ${match.chainProfileName}`
        : 'kontrahent bezpośrednio z zamówienia';
      setPriceNotice(
        `📥 Wczytano zamówienie na karcie: Nabywca ${match.buyer.name} (NIP: ${match.buyer.nip}) · ${chainLabel} · ${parsedItems.length} pozycji. Na dole karty wybierz jedną z 3 opcji zapisu (1. Z wystawieniem FV XML, 2. Uzupełnij później, 3. Bez wystawiania FV).`
      );
      setTimeout(() => setPriceNotice(null), 8000);
    } else {
      if (selectedChain === 'Super-Pharm' || selectedChain === 'Gemini') {
        setLogisticsFormat('separate_fields');
      } else if (selectedChain === 'DOZ') {
        setLogisticsFormat('gs1_composite');
      } else {
        setLogisticsFormat(hasBatchesOrExpiry ? 'gs1_composite' : 'none');
      }
      setPriceNotice(
        `📥 Zaczytano ${parsedItems.length} pozycji ${
          hasBatchesOrExpiry ? 'z seriami i datami' : 'bez serii i dat ważności'
        }. Na dole karty wybierz jedną z 3 opcji zapisu do folderu „W REALIZACJI”.`
      );
      setTimeout(() => setPriceNotice(null), 7000);
    }

    // Każde nowo wczytane z pliku zamówienie na karcie startuje z czystym statusem Zadania 1 (możliwość wysłania "Uzupełnij zdjęcia produktów")
    setPendingOrderSourceId(null);
    setCurrentOrderPackagingPhotos([]);
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
  };

  // Wczytanie zamówienia z Historii Zamówień Sieciowych bezpośrednio do formularza FV
  const handleLoadArchivedOrderToInvoice = (order: ArchivedOrder) => {
    setPendingOrderSourceId(order.id);
    setCurrentOrderPackagingPhotos(
      Array.isArray(order.packagingPhotos) ? [...order.packagingPhotos] : []
    );
    setPhotoSectionResetKey((prev) => prev + 1);
    clearSharedPackagingPhotos();
    setPriceListSource('knowledge_auto');
    setKnowledgePriceListOverride(null);
    setIsVerificationEnabled(true);
    if (order.chain) {
      setSelectedChain(order.chain);
      if (order.chain === 'Super-Pharm' || order.chain === 'Gemini') {
        setLogisticsFormat('separate_fields');
      } else if (order.chain === 'DOZ') {
        setLogisticsFormat('gs1_composite');
      }
    }
    if (order.buyer) {
      setBuyer(order.buyer);
    }
    if (order.seller) {
      setSeller(order.seller);
    }
    if (order.thirdParty !== undefined) {
      setThirdParty(order.thirdParty);
    }
    setMeta((prev) => ({
      ...prev,
      invoiceNumber: order.invoiceNumber || prev.invoiceNumber,
      issueDate: order.issueDate || prev.issueDate,
      orderNumber: order.orderNumber || prev.orderNumber,
      orderDate: order.orderDate || order.issueDate || prev.orderDate,
      deliveryDate: order.avisoDate || order.deliveryDate || prev.deliveryDate,
      dueDate: order.dueDate || prev.dueDate,
    }));
    if (order.items && order.items.length > 0) {
      setItems(order.items);
    }
    if (order.originalFileName) {
      setOrderFile({ name: order.originalFileName, size: 'z historii' });
    } else {
      setOrderFile({ name: `Zamówienie_${order.orderNumber || order.invoiceNumber}.pdf`, size: 'z historii' });
    }
    setPriceNotice(
      `📥 Wczytano zamówienie/fakturę ${order.orderNumber || order.invoiceNumber} dla: ${order.buyer?.name || 'Nabywcy'} (${order.items?.length || 0} pozycji · ${order.packagingPhotos?.length || 0} zdjęć opakowań).`
    );
    setTimeout(() => setPriceNotice(null), 6000);
  };

  // Krok 3: Wyniki OCR ze zdjęć opakowań
  const handleOcrCompleted = (ocrResults: OcrExtractionResult[]) => {
    setItems((prevItems) => {
      return prevItems.map((item, index) => {
        const match =
          ocrResults.find((r) => r.gtin && r.gtin === item.gtin) ||
          ocrResults.find(
            (r) =>
              r.productSuggestion &&
              item.name.toLowerCase().includes(r.productSuggestion.slice(0, 8).toLowerCase())
          ) ||
          (ocrResults.length === prevItems.length ? ocrResults[index] : null);

        if (match && match.batchNumber) {
          return {
            ...item,
            batchNumber: match.batchNumber,
            expiryDate: match.expiryDate || item.expiryDate,
            quantityInBatch: item.quantity,
            ocrMatched: true,
            ocrConfidence: match.confidence,
          };
        }
        return item;
      });
    });
  };

  // Generowanie XML KSeF
  const xmlPayload = generateKSeFXML({
    seller,
    buyer,
    thirdParty,
    meta,
    items,
    logisticsFormat,
    schemaVersion,
  });

  const validationIssues = validateKSeFInvoice({
    seller,
    buyer,
    meta,
    items,
    logisticsFormat,
    schemaVersion,
  });

  const renderOrderAndInvoiceSteps = (viewMode: 'new_order' | 'invoice_only') => (
    <div className="space-y-6">
      {/* Powiadomienie systemowe */}
      {priceNotice && (
        <div className="p-3.5 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-xs text-fuchsia-900 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-fuchsia-600 shrink-0" />
          <span className="font-medium">{priceNotice}</span>
        </div>
      )}

      {/* KROK 1 & 2: PANEL ZAMÓWIENIA & DANYCH FAKTURY KSEF */}
      <CombinedOrderInvoiceStep
        viewMode={viewMode}
        onOrderTextParsed={handleOrderTextParsed}
        orderFile={orderFile}
        onOrderFileChange={setOrderFile}
        itemsCount={items.length}
        selectedChain={selectedChain}
        onSelectChain={handleSelectChain}
        seller={seller}
        onUpdateSeller={setSeller}
        buyer={buyer}
        onUpdateBuyer={setBuyer}
        thirdParty={thirdParty}
        onUpdateThirdParty={setThirdParty}
        meta={meta}
        onUpdateMeta={setMeta}
        logisticsFormat={logisticsFormat}
        onToggleLogisticsFormat={setLogisticsFormat}
        archivedOrders={archivedOrders}
        onLoadArchivedOrder={handleLoadArchivedOrderToInvoice}
        onResetEverything={handleResetEverything}
        onLoadPresetDrMax={handleLoadPresetDrMax}
        onLoadPresetDoz={handleLoadPresetDoz}
        onLoadPresetSuperPharm={handleLoadPresetSuperPharm}
        onLoadPresetNoBatches={handleLoadPresetNoBatches}
        onSendTaskToWarehouse={handleSendCurrentOrderToWarehouse}
        warehouseTaskStatus={
          activeMatchedArchivedOrder?.warehouseProductTaskStatus ||
          activeMatchedArchivedOrder?.warehouseTaskStatus ||
          'none'
        }
        warehouseTaskNote={
          activeMatchedArchivedOrder?.warehouseProductTaskNote ||
          activeMatchedArchivedOrder?.warehouseTaskNote ||
          ''
        }
      />

      {/* KROK 3: Zdjęcia – Serie / Daty (OCR) */}
      <Step3PhotosAndBatches
        key={photoSectionResetKey}
        logisticsFormat={logisticsFormat}
        onToggleLogisticsFormat={setLogisticsFormat}
        onOcrCompleted={handleOcrCompleted}
        onOpenAiGuide={() => setIsAiGuideOpen(true)}
        items={items}
        selectedChain={selectedChain}
        buyerName={buyer.name}
        buyerNip={buyer.nip}
        onUpdateItem={handleUpdateItem}
        orderPackagingPhotos={currentOrderPackagingPhotos}
        onOrderPackagingPhotosChange={handleUpdateCurrentOrderPackagingPhotos}
        onSendTaskToWarehouse={() => handleSendCurrentOrderToWarehouse()}
        warehouseTaskStatus={
          activeMatchedArchivedOrder?.warehouseProductTaskStatus ||
          activeMatchedArchivedOrder?.warehouseTaskStatus ||
          'none'
        }
      />

      {/* KROK 4: Automatyczna Weryfikacja Ceny Netto i Kodu EAN wg Cennika z Centrum Wiedzy (lub XLSX) */}
      <PriceListSection
        priceList={effectivePriceList}
        priceListFileName={effectivePriceListName}
        onPriceListLoaded={handlePriceListLoaded}
        onClearPriceList={handleClearPriceList}
        auditSummary={auditSummary}
        comparisons={comparisons}
        isVerificationEnabled={isVerificationEnabled}
        onToggleVerification={setIsVerificationEnabled}
        onApplyPriceListDiscrepancies={handleApplyPriceListDiscrepancies}
        onApplyPriceListGtins={handleApplyPriceListGtins}
        onApplyAllFromPriceList={handleApplyAllFromPriceList}
        onApplySinglePrice={handleApplySinglePrice}
        onApplySingleGtin={handleApplySingleGtin}
        onApplySingleBoth={handleApplySingleBoth}
        priceListSource={priceListSource}
        activeKnowledgePriceListType={activeKnowledgePriceListType}
        matchedRecipientLabel={matchedRecipientLabel}
        onSwitchKnowledgePriceList={handleSwitchKnowledgePriceList}
      />

      {/* KROK 5: Pozycje Towarowe i Podsumowanie */}
      <ItemsPreviewTable
        viewMode={viewMode}
        items={items}
        logisticsFormat={logisticsFormat}
        selectedChain={selectedChain}
        buyerName={buyer.name}
        buyerNip={buyer.nip}
        onToggleLogisticsFormat={setLogisticsFormat}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
        onAddItem={handleAddItem}
        onQuickFillBatches={handleQuickFillBatches}
        onClearBatches={handleClearBatches}
        priceComparisons={comparisons}
        isVerificationEnabled={isVerificationEnabled && !!effectivePriceList}
        onApplySinglePrice={handleApplySinglePrice}
        onApplySingleGtin={handleApplySingleGtin}
        onOpenXmlModal={() => setIsXmlModalOpen(true)}
        onOpenWzModal={() => setIsWzModalOpen(true)}
        onDownloadOrderCsv={() =>
          downloadOrderCSVFile({
            seller,
            buyer,
            thirdParty,
            meta,
            items,
            selectedChain,
          })
        }
        onSaveToHistory={handleSaveInvoiceToHistory}
        onSaveOrderWithMode={handleSaveOrderFromCard}
      />
    </div>
  );

  // Ekran logowania dla nieautoryzowanych użytkowników
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Nagłówek */}
      <Header
        onOpenXmlModal={() => setIsXmlModalOpen(true)}
        onOpenWzModal={() => setIsWzModalOpen(true)}
        onDownloadOrderCsv={() =>
          downloadOrderCSVFile({
            seller,
            buyer,
            thirdParty,
            meta,
            items,
            selectedChain,
          })
        }
        onOpenAiGuide={() => setIsAiGuideOpen(true)}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        activeUsersCount={activeUsersCount}
        sharedDraftsCount={sharedDraftsCount}
        onNavigateHome={() => setActiveModule('home')}
        itemCount={items.length}
        username="Eubiosis"
        onLogout={handleLogout}
        workstationRole={workstationRole}
        onSwitchWorkstationRole={handleSwitchWorkstationRole}
        warehouseTasksCount={activeWarehouseTasksCount}
      />

      {/* Główny obszar roboczy */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {workstationRole === 'warehouse' ? (
          /* ==================================================================== */
          /* STANOWISKO 2: MAGAZYN — WYŁĄCZNIE PRZYPISANE ZADANIA OD KOORDYNATORA */
          /* ==================================================================== */
          <WarehouseWorkstationView
            orders={archivedOrders}
            onRefreshOrders={refreshArchivedOrders}
            onSwitchToCoordinator={() => handleSwitchWorkstationRole('coordinator')}
          />
        ) : (
          <>
            {/* ==================================================================== */}
            {/* STRONA 1: WYBÓR Z TRZECH KAFELKÓW (CENTRUM FAKTUR / ZAMÓWIEŃ / CRM)  */}
            {/* ==================================================================== */}
            {activeModule === 'home' ? (
              <HomePortalView
                onSelectModule={setActiveModule}
                ordersCount={archivedOrders.length}
                onOpenEdiPrototype={() => setIsEdiModalOpen(true)}
                onSelectOrderTab={setOrderHistoryTab}
              />
            ) : (
              /* ==================================================================== */
              /* PODSTRONY: PASEK POWROTU ORAZ PRZEŁĄCZANIA PODMODUŁÓW               */
              /* ==================================================================== */
              <SubpageHeaderBar
                activeModule={activeModule}
                onSelectModule={setActiveModule}
                onNavigateHome={() => setActiveModule('home')}
                ordersCount={archivedOrders.length}
                onOpenEdiPrototype={() => setIsEdiModalOpen(true)}
                orderHistoryTab={orderHistoryTab}
              />
            )}

            {/* ==================================================================== */}
            {/* MODUŁ 1: 1. WYGENERUJ FAKTURĘ XML (SAMO WYSTAWIENIE FV XML)          */}
            {/* ==================================================================== */}
            {activeModule === 'invoice' && renderOrderAndInvoiceSteps('invoice_only')}

            {/* ==================================================================== */}
            {/* MODUŁ 2: 2. WYGENERUJ KOREKTĘ FAKTURY XML                             */}
            {/* ==================================================================== */}
            {activeModule === 'correction' && (
              <InvoiceCorrectionView
                archivedOrders={archivedOrders}
                preloadedOrder={preloadedOrderForCorrection}
                onClearPreloadedOrder={() => setPreloadedOrderForCorrection(null)}
                onSavedToHistory={handleOrderSaved}
              />
            )}

            {/* ==================================================================== */}
            {/* MODUŁ 3: 3. CENTRUM ZAMÓWIEŃ (NOWE ZAMÓWIENIE / W REALIZACJI / ZAKOŃCZONE) */}
            {/* ==================================================================== */}
            {activeModule === 'history' && (
              <OrderHistoryView
                orders={archivedOrders}
                onRefreshOrders={refreshArchivedOrders}
                onCreateCorrectionForOrder={(order) => {
                  setPreloadedOrderForCorrection(order);
                  setActiveModule('correction');
                }}
                onNavigateToInvoiceCreation={() => setActiveModule('invoice')}
                onStartNewOrder={handleStartNewOrderOnCard}
                onLoadOrderForInvoiceCreation={handleLoadOrderForInvoiceCreation}
                activeLifecycleTab={orderHistoryTab}
                onChangeLifecycleTab={setOrderHistoryTab}
                newOrderCardContent={renderOrderAndInvoiceSteps('new_order')}
              />
            )}

            {/* ==================================================================== */}
            {/* MODUŁ 4: 4. CENTRUM WIEDZY (CRM KLIENTÓW KLUCZOWYCH)                 */}
            {/* ==================================================================== */}
            {activeModule === 'knowledge' && <KnowledgeCenterView />}
          </>
        )}
      </main>

      {/* Modal weryfikacji i pobrania XML */}
      <KSeFXMLModal
        isOpen={isXmlModalOpen}
        onClose={() => setIsXmlModalOpen(false)}
        xmlContent={xmlPayload}
        invoiceNumber={meta.invoiceNumber || 'FAKTURA'}
        issues={validationIssues}
        logisticsFormat={logisticsFormat}
        schemaVersion={schemaVersion}
        onSchemaVersionChange={setSchemaVersion}
        onSaveToHistory={handleSaveInvoiceToHistory}
        onOpenWzModal={() => setIsWzModalOpen(true)}
        onDownloadOrderCsv={() =>
          downloadOrderCSVFile({
            seller,
            buyer,
            thirdParty,
            meta,
            items,
            selectedChain,
          })
        }
        onOpenEdiModal={() => setIsEdiModalOpen(true)}
      />

      {/* Modal generowania i wydruku dokumentu WZ */}
      <WZDocumentModal
        isOpen={isWzModalOpen}
        onClose={() => setIsWzModalOpen(false)}
        seller={seller}
        buyer={buyer}
        thirdParty={thirdParty}
        meta={meta}
        items={items}
        selectedChain={selectedChain}
      />

      {/* Modal konfiguracji Vision LLM */}
      <VisionLLMGuideModal
        isOpen={isAiGuideOpen}
        onClose={() => setIsAiGuideOpen(false)}
      />

      {/* Interaktywny Prototyp Komunikacji EDI DOZ Direct (ORDERS, ORDRSP, DESADV, INVOIC) */}
      <EdiDozPrototypeModal
        isOpen={isEdiModalOpen}
        onClose={() => setIsEdiModalOpen(false)}
        seller={seller}
        buyer={buyer}
        meta={meta}
        items={items}
        ksefXmlContent={xmlPayload}
        onLoadEdiOrderToApp={handleLoadEdiOrderToApp}
      />

      {/* Modal Współdzielonej Bazy Danych w Chmurze (Multi-User Sync + Wspólny Stół Roboczy) */}
      <CloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentChain={selectedChain}
        currentLogisticsFormat={logisticsFormat}
        seller={seller}
        buyer={buyer}
        thirdParty={thirdParty}
        meta={meta}
        items={items}
        archivedOrders={archivedOrders}
        knowledgeClients={knowledgeClients}
        onLoadSharedDraft={handleLoadSharedDraft}
        onManualSyncComplete={refreshAllCloudData}
      />

      {/* Pływające powiadomienie Real-Time Multi-User Sync */}
      {liveSyncToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span>{liveSyncToast}</span>
        </div>
      )}

      {/* Dyskretna kwiecista stopka */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-rose-100 py-6 text-xs text-slate-500 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-800 font-bold">Centrum Obsługi Zamówień Sieciowych</span>
            <span>·</span>
            <span>Wariant FA(3) wersja 1-0E</span>
            <span>·</span>
            <span className="text-slate-500 font-medium">Obsługa zamówień i e-faktur KSeF FA(3)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Eubiosis Sp. z o.o. · BDO: 000585744</span>
            <span>·</span>
            <span>Zgodność z Ministerstwem Finansów RP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
