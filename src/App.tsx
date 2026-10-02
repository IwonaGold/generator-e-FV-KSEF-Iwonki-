import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { CombinedOrderInvoiceStep } from './components/CombinedOrderInvoiceStep';
import { Step3PhotosAndBatches } from './components/Step3PhotosAndBatches';
import { PriceListSection } from './components/PriceListSection';
import { ItemsPreviewTable } from './components/ItemsPreviewTable';
import { KSeFXMLModal } from './components/KSeFXMLModal';
import { VisionLLMGuideModal } from './components/VisionLLMGuideModal';
import { KSeFDirectApiModal } from './components/KSeFDirectApiModal';
import {
  PharmacyChain,
  LogisticsFormat,
  EntityDetails,
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
import { comparePricesWithInvoice } from './utils/priceListParser';
import { matchOrBuildBuyerFromOrder } from './utils/orderParser';
import { FileCode, CheckCircle2, RotateCcw, Server, BookmarkPlus } from 'lucide-react';
import { ModuleTilesNav, AppModule } from './components/ModuleTilesNav';
import { InvoiceCorrectionView } from './components/InvoiceCorrectionView';
import { OrderHistoryView } from './components/OrderHistoryView';
import { ArchivedOrder } from './types/ordersHistory';
import { getArchivedOrders, saveArchivedOrder } from './utils/ordersStorage';

/**
 * Generator świeżych metadanych faktury
 */
const getFreshInvoiceMeta = (): InvoiceMeta => {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const dueDate = future.toISOString().slice(0, 10);

  return {
    invoiceNumber: '41/2026/KSEF',
    invoiceType: 'VAT',
    issueDate: today,
    issuePlace: 'Gdańsk',
    deliveryDate: today,
    orderNumber: 'ZZ-1009/09/26',
    orderDate: today,
    dueDate: dueDate,
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
  const [selectedChain, setSelectedChain] = useState<PharmacyChain>('Dr. Max');
  const [logisticsFormat, setLogisticsFormat] = useState<LogisticsFormat>('gs1_composite');
  const [schemaVersion, setSchemaVersion] = useState<KSeFSchemaVersion>('FA3');

  const [seller, setSeller] = useState<EntityDetails>(DEFAULT_SELLER);
  const [buyer, setBuyer] = useState<EntityDetails>(PHARMACY_CHAINS['Dr. Max'].buyer);
  const [thirdParty, setThirdParty] = useState<ThirdPartyEntity | null>(null);
  const [meta, setMeta] = useState<InvoiceMeta>(getFreshInvoiceMeta());

  // Czysta lista pozycji (od zera)
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Plik zamówienia z kroku 1 (od zera)
  const [orderFile, setOrderFile] = useState<{ name: string; size: string } | null>(null);

  // Stan Cennika XLSX & Weryfikacji Cen z kroku 4 (od zera)
  const [priceList, setPriceList] = useState<PriceListItem[] | null>(null);
  const [priceListFileName, setPriceListFileName] = useState<string | null>(null);
  const [isVerificationEnabled, setIsVerificationEnabled] = useState<boolean>(true);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

  // Modale
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isAiGuideOpen, setIsAiGuideOpen] = useState(false);
  const [isDirectApiModalOpen, setIsDirectApiModalOpen] = useState(false);

  // --- Moduł Aplikacji (3 Kafelki: Faktura XML | Korekta Faktury XML | Historia Zamówień) ---
  const [activeModule, setActiveModule] = useState<AppModule>('invoice');
  const [archivedOrders, setArchivedOrders] = useState<ArchivedOrder[]>([]);
  const [preloadedOrderForCorrection, setPreloadedOrderForCorrection] = useState<ArchivedOrder | null>(null);

  // Pobranie historii przy starcie
  useEffect(() => {
    getArchivedOrders().then((data) => {
      if (data && Array.isArray(data)) {
        setArchivedOrders(data);
      }
    });
  }, []);

  const refreshArchivedOrders = async () => {
    const data = await getArchivedOrders();
    if (data && Array.isArray(data)) {
      setArchivedOrders(data);
    }
  };

  const handleOrderSaved = (savedOrder: ArchivedOrder) => {
    setArchivedOrders((prev) => [savedOrder, ...prev.filter((o) => o.id !== savedOrder.id)]);
  };

  const handleSaveInvoiceToHistory = async () => {
    if (items.length === 0) {
      alert('Brak pozycji towarowych na fakturze do zapisania w historii.');
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

    const newOrder: ArchivedOrder = {
      id: `ord-${Date.now()}`,
      chain: selectedChain,
      documentType: 'FV',
      invoiceNumber: meta.invoiceNumber || 'FAKTURA',
      orderNumber: meta.orderNumber,
      issueDate: meta.issueDate,
      deliveryDate: meta.deliveryDate,
      dueDate: meta.dueDate,
      seller,
      buyer,
      thirdParty,
      items: [...items],
      itemsCount: items.length,
      totalNet,
      totalVat,
      totalGross,
      currency: meta.currency || 'PLN',
      xmlContent: xmlPayload,
      isDelivered: false,
      deliveredAt: null,
      notes: orderFile ? `Z pliku zamówienia: ${orderFile.name}` : '',
      originalFileName: orderFile?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveArchivedOrder(newOrder);
    setArchivedOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    setPriceNotice(`💾 Pomyślnie zapisano fakturę ${newOrder.invoiceNumber} (${newOrder.chain}) w Historii Zamówień Sieciowych!`);
    setTimeout(() => setPriceNotice(null), 6000);
  };

  // Wyliczanie porównania cen z cennikiem
  const { comparisons, auditSummary } = useMemo(() => {
    if (!priceList || priceList.length === 0) {
      return { comparisons: new Map<string, PriceComparisonItem>(), auditSummary: null };
    }
    const result = comparePricesWithInvoice(items, priceList);
    return { comparisons: result.comparisons, auditSummary: result.summary };
  }, [items, priceList]);

  // --- Resetowanie Wszystkiego do Czystego Stanu (Od Zera) ---
  const handleResetEverything = () => {
    setItems([]);
    setOrderFile(null);
    setPriceList(null);
    setPriceListFileName(null);
    setThirdParty(null);
    setMeta(getFreshInvoiceMeta());
    setPriceNotice('Wyczyszczono formularz. Możesz rozpocząć nowe zamówienie od zera.');
    setTimeout(() => setPriceNotice(null), 4000);
  };

  // --- Handlery Cennika XLSX ---
  const handlePriceListLoaded = (fileName: string, parsedItems: PriceListItem[]) => {
    setPriceList(parsedItems);
    setPriceListFileName(fileName);
    setIsVerificationEnabled(true);
    setPriceNotice(`Pomyślnie załadowano cennik ${fileName} (${parsedItems.length} pozycji).`);
    setTimeout(() => setPriceNotice(null), 4000);
  };

  const handleClearPriceList = () => {
    setPriceList(null);
    setPriceListFileName(null);
    setPriceNotice(null);
  };

  // Krok 4 Opcja 2: Użycie cen z cennika dla pozycji z rozbieżnościami
  const handleApplyPriceListDiscrepancies = () => {
    if (!priceList) return;

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

  // --- Handlery Sieci i Presety Faktur ---
  const handleSelectChain = (chain: PharmacyChain) => {
    setSelectedChain(chain);
    const profile = PHARMACY_CHAINS[chain];
    if (profile) {
      setBuyer({ ...profile.buyer });
      setThirdParty(profile.thirdParty ? { ...profile.thirdParty } : null);
      if (profile.preferredLogisticsFormat) {
        setLogisticsFormat(profile.preferredLogisticsFormat);
      }
      if (profile.defaultOrderNumber) {
        setMeta((prev) => ({
          ...prev,
          orderNumber: profile.defaultOrderNumber,
        }));
      }
    }
  };

  const handleLoadPresetSuperPharm = () => {
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
    setSelectedChain('DOZ');
    setBuyer({ ...PHARMACY_CHAINS['DOZ'].buyer });
    setThirdParty(null);
    setSeller({ ...DEFAULT_SELLER });
    setMeta({ ...PRESET_DOZ_META });
    setItems([...PRESET_DOZ_ITEMS]);
    setLogisticsFormat('gs1_composite');
    setOrderFile({ name: 'zamowienie_22122_2026_KPD.txt', size: '2.4 KB' });
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

  // Krok 1: Parsowanie specyfikacji zamówienia
  const handleOrderTextParsed = (
    parsedItems: Partial<InvoiceItem>[],
    rawText: string,
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

    if (hasBatchesOrExpiry) {
      setLogisticsFormat('gs1_composite');
    } else {
      setLogisticsFormat('none');
    }

    if (parsedHeader) {
      const match = matchOrBuildBuyerFromOrder(parsedHeader);
      setSelectedChain(match.chain);
      setBuyer(match.buyer);
      setThirdParty(match.thirdParty);
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
        `📥 Pomyślnie zaczytano zamówienie: Nabywca ${match.buyer.name} (NIP: ${match.buyer.nip}) · ${chainLabel} · ${parsedItems.length} pozycji towarowych.`
      );
      setTimeout(() => setPriceNotice(null), 7000);
    } else {
      setPriceNotice(
        `Zaczytano ${parsedItems.length} pozycji ${
          hasBatchesOrExpiry ? 'z seriami i datami' : 'bez serii i dat ważności'
        }.`
      );
      setTimeout(() => setPriceNotice(null), 6000);
    }
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

  // Ekran logowania dla nieautoryzowanych użytkowników
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Nagłówek */}
      <Header
        onOpenXmlModal={() => setIsXmlModalOpen(true)}
        onOpenAiGuide={() => setIsAiGuideOpen(true)}
        onOpenDirectApiModal={() => setIsDirectApiModalOpen(true)}
        itemCount={items.length}
        username="Eubiosis"
        onLogout={handleLogout}
      />

      {/* Główny obszar roboczy */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ==================================================================== */}
        {/* 3 GŁÓWNE KAFELKI NAWIGACJI MODUŁOWEJ (WYSTAW FV / KOREKTA / HISTORIA) */}
        {/* ==================================================================== */}
        <ModuleTilesNav
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          ordersCount={archivedOrders.length}
        />

        {/* ==================================================================== */}
        {/* MODUŁ 1: 1. WYSTAW FAKTURĘ XML                                       */}
        {/* ==================================================================== */}
        {activeModule === 'invoice' && (
          <div className="space-y-6">
            {/* Tytuł i pasek akcji */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-rose-500 mb-1 font-medium">
                  <span>🌸 Farmacja</span>
                  <span>·</span>
                  <span>Krajowy System e-Faktur</span>
                  <span>·</span>
                  <span>Nowe Zamówienie ✨</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600">
                    🌸 generator-e-FV-KSEF-Iwonki-
                  </span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-full">
                    FA(3) ✨
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
                  Wczytaj zamówienie, uzupełnij dane faktury, zweryfikuj ceny z zamówienia z aktualnym cennikiem, odczytaj serie ze zdjęć
                  i wygeneruj oficjalny kod XML do KSeF Ministerstwa Finansów.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleResetEverything}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="Wyczyść wszystkie pola i rozpocznij od nowa"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Wyczyść wszystko</span>
                </button>

                <button
                  onClick={handleSaveInvoiceToHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="Zapisz to zamówienie i wygenerowaną fakturę w Historii Zamówień Sieciowych"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-rose-600" />
                  <span>💾 Zapisz w historii</span>
                </button>

                <button
                  onClick={() => setIsDirectApiModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="Wytyczne wgrania bezpośrednio do KSeF (API / Portal)"
                >
                  <Server className="w-3.5 h-3.5 text-pink-500" />
                  <span>🌷 Wgraj do KSeF</span>
                </button>

                <button
                  onClick={() => setIsXmlModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs shadow-pink-200 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileCode className="w-4 h-4" />
                  <span>🌸 Podgląd i Pobranie XML</span>
                </button>
              </div>
            </div>

            {/* Powiadomienie systemowe */}
            {priceNotice && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2 shadow-2xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{priceNotice}</span>
              </div>
            )}

            {/* KROK 1 & 2 POŁĄCZONE: PANEL ZAMÓWIENIA & DANYCH FAKTURY KSEF */}
            <CombinedOrderInvoiceStep
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
              onLoadPresetDrMax={handleLoadPresetDrMax}
              onLoadPresetDoz={handleLoadPresetDoz}
              onLoadPresetSuperPharm={handleLoadPresetSuperPharm}
              onLoadPresetNoBatches={handleLoadPresetNoBatches}
            />

            {/* KROK 3: Zdjęcia – Serie / Daty (OCR) */}
            <Step3PhotosAndBatches
              logisticsFormat={logisticsFormat}
              onToggleLogisticsFormat={setLogisticsFormat}
              onOcrCompleted={handleOcrCompleted}
              onOpenAiGuide={() => setIsAiGuideOpen(true)}
              items={items}
              onUpdateItem={handleUpdateItem}
            />

            {/* KROK 4: Weryfikacja z Cennikiem (XLSX) */}
            <PriceListSection
              priceList={priceList}
              priceListFileName={priceListFileName}
              onPriceListLoaded={handlePriceListLoaded}
              onClearPriceList={handleClearPriceList}
              auditSummary={auditSummary}
              isVerificationEnabled={isVerificationEnabled}
              onToggleVerification={setIsVerificationEnabled}
              onApplyPriceListDiscrepancies={handleApplyPriceListDiscrepancies}
            />

            {/* TABELA POZYCJI: Zestawienie końcowe z podglądem XML */}
            <ItemsPreviewTable
              items={items}
              logisticsFormat={logisticsFormat}
              onToggleLogisticsFormat={setLogisticsFormat}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItem}
              onQuickFillBatches={handleQuickFillBatches}
              onClearBatches={handleClearBatches}
              priceComparisons={comparisons}
              isVerificationEnabled={isVerificationEnabled && !!priceList}
              onApplySinglePrice={handleApplySinglePrice}
            />
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODUŁ 2: 2. WYSTAW KOREKTĘ FAKTURY XML                               */}
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
        {/* MODUŁ 3: 3. HISTORIA ZAMÓWIEŃ SIECIOWYCH                             */}
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
          />
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
      />

      {/* Modal konfiguracji Vision LLM */}
      <VisionLLMGuideModal
        isOpen={isAiGuideOpen}
        onClose={() => setIsAiGuideOpen(false)}
      />

      {/* Modal bezpośredniej integracji z KSeF (API / Portal) */}
      <KSeFDirectApiModal
        isOpen={isDirectApiModalOpen}
        onClose={() => setIsDirectApiModalOpen(false)}
        xmlContent={xmlPayload}
        invoiceNumber={meta.invoiceNumber || 'FAKTURA'}
        sellerNip={seller.nip}
        schemaVersion={schemaVersion}
      />

      {/* Dyskretna kwiecista stopka */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-rose-100 py-6 text-xs text-slate-500 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-pink-600 font-bold">🌸 GENERATOR Iwonki E-faktur KSEF</span>
            <span>·</span>
            <span>Wariant FA(3) wersja 1-0E</span>
            <span>·</span>
            <span className="text-rose-500 font-medium">Wystawiaj faktury z uśmiechem ✨</span>
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
