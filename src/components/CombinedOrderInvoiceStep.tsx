import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  Trash2,
  Sparkles,
  Calendar,
  CreditCard,
  Hash,
  Truck,
  Building2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ShieldCheck,
  CheckSquare,
  Square,
  Warehouse,
  Check,
  RotateCcw,
  Clock,
  Tag,
  Info,
} from 'lucide-react';
import { PHARMACY_CHAINS } from '../utils/sampleData';
import {
  PharmacyChain,
  LogisticsFormat,
  EntityDetails,
  InvoiceMeta,
  ThirdPartyEntity,
  InvoiceItem,
  ParsedOrderData,
} from '../types/ksef';
import { ArchivedOrder } from '../types/ordersHistory';
import { KeyClientProfile, INITIAL_KEY_CLIENTS } from '../types/knowledgeBase';
import { getKeyClients } from '../utils/knowledgeStorage';
import {
  parseOrderFromFile,
  parseOrderText,
  matchOrBuildBuyerFromOrder,
  OrderIngestionMatch,
} from '../utils/orderParser';

export interface VerificationChecks {
  buyer: boolean;
  thirdParty: boolean;
  invoiceNumber: boolean;
  dates: boolean;
  orderNumber: boolean;
  orderDate: boolean;
  dueDate: boolean;
  seller: boolean;
}

interface CombinedOrderInvoiceStepProps {
  // Parsowanie zamówienia
  onOrderTextParsed: (
    parsedItems: Partial<InvoiceItem>[],
    rawText: string,
    parsedHeader?: ParsedOrderData,
    hasBatchesOrExpiry?: boolean
  ) => void;
  orderFile: { name: string; size: string } | null;
  onOrderFileChange: (fileInfo: { name: string; size: string } | null) => void;
  itemsCount: number;

  // Dane faktury
  selectedChain: PharmacyChain;
  onSelectChain: (chain: PharmacyChain) => void;
  seller: EntityDetails;
  onUpdateSeller: (seller: EntityDetails) => void;
  buyer: EntityDetails;
  onUpdateBuyer: (buyer: EntityDetails) => void;
  thirdParty?: ThirdPartyEntity | null;
  onUpdateThirdParty?: (thirdParty: ThirdPartyEntity | null) => void;
  meta: InvoiceMeta;
  onUpdateMeta: (meta: InvoiceMeta) => void;
  logisticsFormat?: LogisticsFormat;
  onToggleLogisticsFormat?: (format: LogisticsFormat) => void;

  // Wzorce i historia
  archivedOrders?: ArchivedOrder[];
  onLoadArchivedOrder?: (order: ArchivedOrder) => void;
  onResetEverything?: () => void;
  onLoadPresetDrMax?: () => void;
  onLoadPresetDoz?: () => void;
  onLoadPresetSuperPharm?: () => void;
  onLoadPresetNoBatches?: () => void;
}

export const CombinedOrderInvoiceStep: React.FC<CombinedOrderInvoiceStepProps> = ({
  onOrderTextParsed,
  orderFile,
  onOrderFileChange,
  itemsCount,
  selectedChain,
  onSelectChain,
  seller,
  onUpdateSeller,
  buyer,
  onUpdateBuyer,
  thirdParty,
  onUpdateThirdParty,
  meta,
  onUpdateMeta,
  logisticsFormat = 'none',
  onToggleLogisticsFormat,
  archivedOrders,
  onLoadArchivedOrder,
  onResetEverything,
  onLoadPresetDrMax,
  onLoadPresetDoz,
  onLoadPresetSuperPharm,
  onLoadPresetNoBatches,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showAddressDetails, setShowAddressDetails] = useState(false);
  const [showThirdPartyDetails, setShowThirdPartyDetails] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [lastExtractedInfo, setLastExtractedInfo] = useState<OrderIngestionMatch | null>(null);
  const [isEditingBuyer, setIsEditingBuyer] = useState(false);
  const [knowledgeClients, setKnowledgeClients] = useState<KeyClientProfile[]>(INITIAL_KEY_CLIENTS);
  const orderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getKeyClients()
      .then((loaded) => {
        if (Array.isArray(loaded) && loaded.length > 0) {
          setKnowledgeClients(loaded);
        }
      })
      .catch(() => {});
  }, []);

  // Automatyczna sanitacja Podmiot3:
  // Podmiot3 w KSeF służy wyłącznie dla odbiorców posiadających ID-Wew (np. Super-Pharm 5213842837-54936).
  // W DOZ nie występuje Podmiot3 (brak ID-Wew) — jeśli w stanie znajduje się Podmiot3 dla DOZ lub błędny GLN zamiast ID-Wew, czyścimy go.
  useEffect(() => {
    if (!thirdParty || !onUpdateThirdParty) return;
    const cleanBuyerNip = (buyer?.nip || '').replace(/\D/g, '');
    const isDoz =
      selectedChain === 'DOZ' ||
      cleanBuyerNip === '8271807718' ||
      (thirdParty.name || '').toLowerCase().includes('doz') ||
      thirdParty.gln === '5909000848054';

    if (isDoz) {
      onUpdateThirdParty(null);
      return;
    }

    if (thirdParty.idWew) {
      const cleanId = thirdParty.idWew.trim();
      const isValidKSeFIdWew = /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanId);
      if (!isValidKSeFIdWew) {
        onUpdateThirdParty(null);
      }
    }
  }, [thirdParty, selectedChain, buyer?.nip, onUpdateThirdParty]);

  // Szablon pustych (niezatwierdzonych) kafelków weryfikacji
  const EMPTY_VERIFICATION_CHECKS: VerificationChecks = {
    buyer: false,
    thirdParty: false,
    invoiceNumber: false,
    dates: false,
    orderNumber: false,
    orderDate: false,
    dueDate: false,
    seller: false,
  };

  // Stan weryfikacji i zatwierdzenia poszczególnych informacji (domyślnie niezatwierdzone)
  const [verified, setVerified] = useState<VerificationChecks>(EMPTY_VERIFICATION_CHECKS);

  // Gdy wyczyszczono formularz (brak pliku zamówienia i brak pozycji) -> natychmiast odznacz wszystkie kafelki
  useEffect(() => {
    if (!orderFile && itemsCount === 0) {
      setVerified(EMPTY_VERIFICATION_CHECKS);
      setLastExtractedInfo(null);
    }
  }, [orderFile, itemsCount]);

  const toggleVerification = (key: keyof VerificationChecks) => {
    setVerified((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleVerifyAll = () => {
    const allTrue = Object.values(verified).every(Boolean);
    const targetState = !allTrue;
    setVerified({
      buyer: targetState,
      thirdParty: targetState,
      invoiceNumber: targetState,
      dates: targetState,
      orderNumber: targetState,
      orderDate: targetState,
      dueDate: targetState,
      seller: targetState,
    });
  };

  const verifiedCount = Object.entries(verified).filter(([k, v]) => {
    if (k === 'thirdParty' && !thirdParty?.name) return false;
    return v === true;
  }).length;

  const totalRequired = thirdParty?.name ? 8 : 7;
  const allVerified = verifiedCount >= totalRequired;

  const handleOrderDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processOrderFile(e.dataTransfer.files[0]);
    }
  };

  const handleOrderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processOrderFile(e.target.files[0]);
    }
  };

  const processOrderFile = async (file: File) => {
    setVerified(EMPTY_VERIFICATION_CHECKS);
    const sizeKb = (file.size / 1024).toFixed(1) + ' KB';
    const fileInfo = { name: file.name, size: sizeKb };
    onOrderFileChange(fileInfo);

    try {
      const parsed = await parseOrderFromFile(file);
      if (parsed.headerData) {
        const match = matchOrBuildBuyerFromOrder(parsed.headerData, selectedChain);
        setLastExtractedInfo(match);
        onSelectChain(match.chain);
        onUpdateBuyer(match.buyer);
        if (onUpdateThirdParty) onUpdateThirdParty(match.thirdParty);
        onUpdateMeta({
          ...meta,
          orderNumber: match.metaUpdates.orderNumber || meta.orderNumber,
          orderDate: match.metaUpdates.orderDate || meta.orderDate,
          dueDate: match.metaUpdates.dueDate || meta.dueDate,
          deliveryDate: match.metaUpdates.deliveryDate || meta.deliveryDate,
          paymentDays: match.metaUpdates.paymentDays ?? meta.paymentDays,
          paymentMethod: match.metaUpdates.paymentMethod || meta.paymentMethod,
        });
      }
      onOrderTextParsed(parsed.items, parsed.rawText || '', parsed.headerData, parsed.hasBatchesOrExpiry);
    } catch (err: any) {
      console.error('Błąd odczytu pliku zamówienia:', err);
      alert(`Błąd odczytu pliku zamówienia: ${err.message || String(err)}`);
    }
  };

  const handleApplyPastedText = () => {
    if (!pastedText.trim()) return;
    setVerified(EMPTY_VERIFICATION_CHECKS);
    const fileInfo = {
      name: 'wklejone_zamowienie.txt',
      size: `${(pastedText.length / 1024).toFixed(1)} KB`,
    };
    onOrderFileChange(fileInfo);
    const parsed = parseOrderText(pastedText);
    if (parsed.headerData) {
      const match = matchOrBuildBuyerFromOrder(parsed.headerData);
      setLastExtractedInfo(match);
      onSelectChain(match.chain);
      onUpdateBuyer(match.buyer);
      if (onUpdateThirdParty) onUpdateThirdParty(match.thirdParty);
      onUpdateMeta({
        ...meta,
        orderNumber: match.metaUpdates.orderNumber || meta.orderNumber,
        orderDate: match.metaUpdates.orderDate || meta.orderDate,
        dueDate: match.metaUpdates.dueDate || meta.dueDate,
        deliveryDate: match.metaUpdates.deliveryDate || meta.deliveryDate,
        paymentDays: match.metaUpdates.paymentDays ?? meta.paymentDays,
        paymentMethod: match.metaUpdates.paymentMethod || meta.paymentMethod,
      });
    }
    onOrderTextParsed(parsed.items, pastedText, parsed.headerData, parsed.hasBatchesOrExpiry);
    setIsPasteOpen(false);
    setPastedText('');
  };

  const setPaymentDaysFromDelivery = (days: number) => {
    // Uwaga: termin płatności liczony od daty dostawy (P_6)
    const baseDateStr = meta.deliveryDate || meta.issueDate || meta.orderDate;
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    base.setDate(base.getDate() + days);
    onUpdateMeta({
      ...meta,
      paymentDays: days,
      dueDate: base.toISOString().slice(0, 10),
    });
  };

  const handleDeliveryDateChange = (newDeliveryDate: string) => {
    const updates: Partial<InvoiceMeta> = { deliveryDate: newDeliveryDate };
    if (meta.paymentDays && newDeliveryDate) {
      const base = new Date(newDeliveryDate);
      base.setDate(base.getDate() + meta.paymentDays);
      updates.dueDate = base.toISOString().slice(0, 10);
    }
    onUpdateMeta({ ...meta, ...updates });
  };

  // --- MINI-NOTATKA DLA WYSTAWIAJĄCEGO FV (PO PRZYPISANIU ODBIORCY) ---
  const recipientCheatSheet = useMemo(() => {
    const hasBuyerOrRecipient = Boolean(
      buyer.name?.trim() ||
        buyer.nip?.trim() ||
        thirdParty?.name?.trim() ||
        (selectedChain && selectedChain !== 'Custom')
    );

    if (!hasBuyerOrRecipient) return null;

    const cleanNip = (buyer.nip || '').replace(/\D/g, '');
    const combinedText = `${selectedChain} ${buyer.name || ''} ${thirdParty?.name || ''}`.toLowerCase();

    // Dopasowanie klienta z Centrum Wiedzy
    const matchedKnowledgeClient = knowledgeClients.find((kc) => {
      const kcNip = (kc.nip || '').replace(/\D/g, '');
      if (cleanNip && kcNip && cleanNip === kcNip) return true;
      if (selectedChain === 'DOZ' && kc.id === 'client-doz') return true;
      if (selectedChain === 'Dr. Max' && kc.id === 'client-drmax') return true;
      if (selectedChain === 'Super-Pharm' && kc.id === 'client-superpharm') return true;
      if (selectedChain === 'Gemini' && kc.id === 'client-gemini') return true;
      if (combinedText.includes('doz') && kc.id === 'client-doz') return true;
      if ((combinedText.includes('dr. max') || combinedText.includes('drmax') || combinedText.includes('lekomat')) && kc.id === 'client-drmax') return true;
      if ((combinedText.includes('super-pharm') || combinedText.includes('super pharm') || combinedText.includes('superpharm')) && kc.id === 'client-superpharm') return true;
      if (combinedText.includes('gemini') && kc.id === 'client-gemini') return true;
      if (combinedText.includes('modum') && kc.id === 'client-modumpharma') return true;
      const shortLower = kc.shortName.toLowerCase();
      return shortLower.length > 2 && combinedText.includes(shortLower);
    });

    // 1. DOZ DIRECT
    if (
      matchedKnowledgeClient?.id === 'client-doz' ||
      selectedChain === 'DOZ' ||
      cleanNip === '8271807718' ||
      combinedText.includes('doz')
    ) {
      return {
        id: 'doz',
        recipientName: matchedKnowledgeClient?.shortName || 'DOZ Direct (Hurtownia Farmaceutyczna)',
        theme: 'amber' as const,
        paymentDays: matchedKnowledgeClient?.paymentDays || 60,
        paymentDescription: `${matchedKnowledgeClient?.paymentDays || 60} dni od daty dostawy (P_6)`,
        idWewStatus: 'NIE — brak Podmiot3 / brak ID-Wew',
        idWewRequired: false,
        idWewDescription:
          'W DOZ nie występuje Podmiot3 (ID-Wew) — pole Odbiorca (Podmiot3) pozostaje puste (Brak odbiorcy). Faktura wystawiana wyłącznie na Nabywcę (Podmiot2: DOZ S.A. Direct Sp. k.).',
        addBatchAndExpiryStatus: 'TAK — OBOWIĄZKOWO na FV KSeF',
        addBatchAndExpiryRequired: true,
        addBatchAndExpiryDescription:
          'Dodać datę przydatności (MHD) oraz numer serii (LOT) bezpośrednio na FV KSeF (dzięki temu nie wysyłamy już osobnej tabeli specyfikacji).',
        formatStatus: 'Klucz łączony GS1 (NumerSeriiDataPrzydatnosciIlosc)',
        formatDescription:
          'Węzeł <DodatkowyOpis>: <Klucz>NumerSeriiDataPrzydatnosciIlosc</Klucz> i <Wartosc>(10)SERIA(17)DATA(37)ILOSC</Wartosc> + kod GTIN.',
        recommendedLogisticsFormat: 'gs1_composite' as LogisticsFormat,
        priceRule: '💰 Nowy Cennik DOZ od 08.2026 (Kolumna O, -12%): Na FV cena po rabacie netto!',
        extraTip: 'Wysyłka FV po wystawieniu na: kpd_dd@doz.pl oraz dwd_dd@doz.pl',
      };
    }

    // 2. SUPER-PHARM
    if (
      matchedKnowledgeClient?.id === 'client-superpharm' ||
      selectedChain === 'Super-Pharm' ||
      cleanNip === '5213842837' ||
      combinedText.includes('super-pharm') ||
      combinedText.includes('super pharm')
    ) {
      const expectedIdWew = matchedKnowledgeClient?.idWew || '5213842837-54936';
      return {
        id: 'superpharm',
        recipientName: matchedKnowledgeClient?.shortName || 'Super-Pharm Holding Sp. z o.o.',
        theme: 'blue' as const,
        paymentDays: matchedKnowledgeClient?.paymentDays || 45,
        paymentDescription: `${matchedKnowledgeClient?.paymentDays || 45} dni od daty dostawy (P_6)`,
        idWewStatus: `TAK — WYMAGANY (${expectedIdWew})`,
        idWewRequired: true,
        expectedIdWew,
        idWewDescription: `Obowiązkowy <Podmiot3> (Rola 2 – Odbiorca: Magazyn Centralny Teresin) z wpisanym <IDWew>${expectedIdWew}</IDWew>.`,
        addBatchAndExpiryStatus: 'TAK — OBOWIĄZKOWO na FV KSeF',
        addBatchAndExpiryRequired: true,
        addBatchAndExpiryDescription:
          'Obowiązkowo dodać datę przydatności (MHD) oraz numer serii (LOT) przy każdej pozycji na fakturze KSeF.',
        formatStatus: 'Osobne pola ("Data ważności" + "Seria")',
        formatDescription:
          'Osobne wiersze w <DodatkowyOpis> dla każdej pozycji: osobny wiersz z kluczem "Data ważności" oraz osobny wiersz z kluczem "Seria".',
        recommendedLogisticsFormat: 'separate_fields' as LogisticsFormat,
        priceRule: '💰 Cennik Q3 (-5%): Na FV cena po rabacie netto!',
        extraTip: 'Potwierdzenie realizacji i FV wysłać na: dsiwinski@superpharm.pl',
      };
    }

    // 3. DR. MAX (LEKOMAT)
    if (
      matchedKnowledgeClient?.id === 'client-drmax' ||
      selectedChain === 'Dr. Max' ||
      cleanNip === '8943149010' ||
      combinedText.includes('dr. max') ||
      combinedText.includes('drmax') ||
      combinedText.includes('lekomat')
    ) {
      return {
        id: 'drmax',
        recipientName: matchedKnowledgeClient?.shortName || 'Dr. Max (Hurtownia Drogeryjna Lekomat)',
        theme: 'emerald' as const,
        paymentDays: matchedKnowledgeClient?.paymentDays || 30,
        paymentDescription: `${matchedKnowledgeClient?.paymentDays || 30} dni (Hurtownia Drogeryjna Lekomat)`,
        idWewStatus: 'NIE — brak wymogu ID-Wew',
        idWewRequired: false,
        idWewDescription:
          'Brak wymogu ID-Wew oraz brak Podmiot3 — faktura wystawiana bezpośrednio na Nabywcę (Podmiot2: Dr. Max Lekomat Sp. z o.o.).',
        addBatchAndExpiryStatus: 'Lekomat: NIE (bez MHD/serii) | Spółki apteczne: TAK',
        addBatchAndExpiryRequired: false,
        addBatchAndExpiryDescription:
          'Dla Dr. Max Hurtownia Drogeryjna Lekomat: FV KSeF BEZ daty ważności i serii. (Dla pozostałych spółek aptecznych Dr. Max: TAK – z serią i datą).',
        formatStatus: 'Bez serii i dat (Lekomat) / Klucz łączony GS1 (Apteki)',
        formatDescription:
          'Hurtownia Drogeryjna Lekomat: tryb "Bez serii i dat (none)". Spółki apteczne Dr. Max: Klucz łączony GS1 (NumerSeriiDataPrzydatnosciIlosc).',
        recommendedLogisticsFormat: 'none' as LogisticsFormat,
        priceRule: '💰 Cennik Q3 (-5%): Na FV cena po rabacie netto!',
        extraTip: 'Wysyłka FV na: dostawyecom@drmax.com.pl oraz zamowieniaecom@drmax.com.pl',
      };
    }

    // 4. GEMINI
    if (
      matchedKnowledgeClient?.id === 'client-gemini' ||
      selectedChain === 'Gemini' ||
      cleanNip === '5252801825' ||
      cleanNip === '5862276537' ||
      combinedText.includes('gemini')
    ) {
      return {
        id: 'gemini',
        recipientName: matchedKnowledgeClient?.shortName || 'Gemini (Gemini Apps Sp. z o.o.)',
        theme: 'purple' as const,
        paymentDays: matchedKnowledgeClient?.paymentDays || 45,
        paymentDescription: `${matchedKnowledgeClient?.paymentDays || 45} dni`,
        idWewStatus: 'NIE — brak wymogu ID-Wew',
        idWewRequired: false,
        idWewDescription:
          'Brak wymogu ID-Wew. Pamiętaj o dołączeniu papierowej FV i dokumentu WZ z kodami GTIN na oznaczonym kartonie/palecie!',
        addBatchAndExpiryStatus: 'TAK — FV w-Firma + osobna tabela (specyfikacja)',
        addBatchAndExpiryRequired: true,
        addBatchAndExpiryDescription:
          'Wystawiana FV w-Firma + osobna tabela (specyfikacja) z serią i datą przydatności (MHD).',
        formatStatus: 'FV w-Firma + Tabela (w KSeF XML: Osobne pola)',
        formatDescription:
          'FV w-Firma + osobna tabela specyfikacji (w przypadku generowania KSeF XML: Osobne pola "Data ważności" i "Seria").',
        recommendedLogisticsFormat: 'separate_fields' as LogisticsFormat,
        priceRule: '💰 Cennik Q3 (-5%): Na FV cena po rabacie netto!',
        extraTip: 'Po potwierdzeniu awizacji wysłać FV i tabelę na: ri@gemini.pl oraz aleksandra.teclaw@gemini.pl',
      };
    }

    // 5. Pozostali klienci z Centrum Wiedzy (np. Modum Pharma lub nowo dodani)
    if (matchedKnowledgeClient) {
      const hasIdWew = Boolean(matchedKnowledgeClient.idWew?.trim());
      const isExternal = matchedKnowledgeClient.invoiceSystem === 'ZEWNETRZNY_SYSTEM';
      const fmtLower = (matchedKnowledgeClient.ksefLogisticsFormat || '').toLowerCase();
      const recFmt: LogisticsFormat = fmtLower.includes('osobne')
        ? 'separate_fields'
        : fmtLower.includes('bez')
        ? 'none'
        : 'gs1_composite';

      return {
        id: matchedKnowledgeClient.id,
        recipientName: matchedKnowledgeClient.shortName || 'Kontrahent',
        theme: 'rose' as const,
        paymentDays: matchedKnowledgeClient.paymentDays || 30,
        paymentDescription: `${matchedKnowledgeClient.paymentDays || 30} dni`,
        idWewStatus: hasIdWew ? `TAK (${matchedKnowledgeClient.idWew})` : 'NIE — brak wymogu ID-Wew',
        idWewRequired: hasIdWew,
        expectedIdWew: matchedKnowledgeClient.idWew,
        idWewDescription: hasIdWew
          ? `Wymagany identyfikator wewnętrzny w Podmiot3: ${matchedKnowledgeClient.idWew}.`
          : 'Brak wymogu podawania ID-Wew w Podmiot3.',
        addBatchAndExpiryStatus: isExternal
          ? matchedKnowledgeClient.invoiceSystemLabel || 'Zewnętrzny system'
          : fmtLower.includes('bez')
          ? 'NIE — bez serii i daty ważności na FV'
          : 'TAK — dodać datę przydatności i serię na FV',
        addBatchAndExpiryRequired: !fmtLower.includes('bez'),
        addBatchAndExpiryDescription: `Wymóg MHD: ${matchedKnowledgeClient.minExpiryRequirement || 'zgodnie z umową'}.`,
        formatStatus: matchedKnowledgeClient.ksefLogisticsFormat || 'Standard KSeF',
        formatDescription: matchedKnowledgeClient.invoiceSystemLabel || 'KSeF XML',
        recommendedLogisticsFormat: recFmt,
        priceRule:
          matchedKnowledgeClient.priceListType === 'DOZ_SPECIAL'
            ? '💰 Nowy Cennik DOZ od 08.2026 (Kolumna O, -12%): Na FV cena po rabacie netto!'
            : '💰 Cennik Q3 (-5%): Na FV cena po rabacie netto!',
        extraTip:
          Array.isArray(matchedKnowledgeClient.contacts) && matchedKnowledgeClient.contacts.length > 0
            ? `Kontakt / wysyłka: ${matchedKnowledgeClient.contacts.map((c) => c.email).join(', ')}`
            : '',
      };
    }

    // 6. Dowolny inny / nowy odbiorca z zamówienia spoza predefiniowanej listy
    return {
      id: 'custom',
      recipientName: buyer.name || thirdParty?.name || 'Przypisany Odbiorca',
      theme: 'rose' as const,
      paymentDays: meta.paymentDays || 14,
      paymentDescription: `${meta.paymentDays || 14} dni (zgodnie z zamówieniem)`,
      idWewStatus: thirdParty?.idWew ? `TAK (${thirdParty.idWew})` : 'NIE (chyba że wskazano na zamówieniu)',
      idWewRequired: Boolean(thirdParty?.idWew),
      expectedIdWew: thirdParty?.idWew,
      idWewDescription: thirdParty?.idWew
        ? `Wpisany ID-Wew w Podmiot3: ${thirdParty.idWew}.`
        : 'Standardowo brak wymogu ID-Wew (wymagany głównie dla Super-Pharm: 5213842837-54936).',
      addBatchAndExpiryStatus:
        logisticsFormat === 'none'
          ? 'NIE (tryb standardowy bez serii/dat)'
          : 'TAK — seria i data przydatności włączone',
      addBatchAndExpiryRequired: logisticsFormat !== 'none',
      addBatchAndExpiryDescription:
        'Sprawdź na zamówieniu, czy odbiorca wymaga serii (LOT) i daty ważności (MHD) na fakturze KSeF.',
      formatStatus:
        logisticsFormat === 'gs1_composite'
          ? 'Klucz łączony GS1 (NumerSeriiDataPrzydatnosciIlosc)'
          : logisticsFormat === 'separate_fields'
          ? 'Osobne pola ("Data ważności" + "Seria")'
          : 'Bez serii i dat ważności (Standardowa FV)',
      formatDescription:
        'Możesz przełączyć format zapisu serii i daty ważności w KSeF przyciskami poniżej.',
      recommendedLogisticsFormat: logisticsFormat,
      priceRule: '💰 Cennik Q3 (-5%): Pamiętaj, że na FV ma być cena po rabacie netto!',
      extraTip: '',
    };
  }, [buyer.name, buyer.nip, thirdParty?.name, thirdParty?.idWew, selectedChain, knowledgeClients, meta.paymentDays, logisticsFormat]);

  // Automatyczne zaznaczanie terminu płatności (np. 30 / 45 / 60 dni) oraz wyliczanie daty płatności wg Centrum Wiedzy
  const lastAutoPaymentKeyRef = useRef<string>('');
  useEffect(() => {
    if (!recipientCheatSheet || recipientCheatSheet.id === 'custom') {
      lastAutoPaymentKeyRef.current = '';
      return;
    }

    const targetDays = recipientCheatSheet.paymentDays;
    if (!targetDays) return;

    const baseDateStr = meta.deliveryDate || meta.issueDate || meta.orderDate || '';
    const currentKey = `${recipientCheatSheet.id}|${targetDays}|${buyer.nip || ''}|${orderFile?.name || ''}|${meta.orderNumber || ''}|${baseDateStr}`;

    if (lastAutoPaymentKeyRef.current !== currentKey || !meta.paymentDays) {
      lastAutoPaymentKeyRef.current = currentKey;
      const base = baseDateStr ? new Date(baseDateStr) : new Date();
      base.setDate(base.getDate() + targetDays);
      const calculatedDueDate = base.toISOString().slice(0, 10);

      if (meta.paymentDays !== targetDays || meta.dueDate !== calculatedDueDate) {
        onUpdateMeta({
          ...meta,
          paymentDays: targetDays,
          dueDate: calculatedDueDate,
        });
      }
    }
  }, [
    recipientCheatSheet,
    buyer.nip,
    orderFile?.name,
    meta.orderNumber,
    meta.deliveryDate,
    meta.issueDate,
    meta.orderDate,
    meta.paymentDays,
    meta.dueDate,
    onUpdateMeta,
  ]);

  return (
    <div className="space-y-6 mb-6">
      {/* ===================================================================== */}
      {/* KROK 1: WCZYTAJ ZAMÓWIENIE SIECIOWE (DROPZONE + WYBÓR Z HISTORII)     */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-3 mb-4">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
              1
            </div>
            <div className="min-w-0 pr-2">
              <h3 className="text-sm font-bold text-slate-900">
                Wczytaj Zamówienie w PDF (z pozycjami) lub z Archiwum
              </h3>
              <p className="text-xs text-slate-500 max-w-xl">
                Wgraj plik PDF/Excel/TXT otrzymany od klienta – system automatycznie wyodrębni dane kontrahenta, odbiorcę, daty i pozycje.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 shrink-0 sm:ml-auto">
            <button
              type="button"
              onClick={() => setIsPasteOpen(!isPasteOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors shadow-2xs shrink-0"
              title="Wklej treść zamówienia ze schowka (np. z maila)"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Wklej ze schowka</span>
            </button>

            {onLoadPresetDrMax && (
              <button
                type="button"
                onClick={() => {
                  setVerified(EMPTY_VERIFICATION_CHECKS);
                  onLoadPresetDrMax();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Wczytaj przykładowe zamówienie Dr. Max"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Wzorzec testowy</span>
              </button>
            )}

            {onResetEverything && (
              <button
                type="button"
                onClick={() => {
                  setVerified(EMPTY_VERIFICATION_CHECKS);
                  setLastExtractedInfo(null);
                  setPastedText('');
                  setIsPasteOpen(false);
                  if (orderInputRef.current) orderInputRef.current.value = '';
                  onResetEverything();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 sm:px-4.5 sm:py-2 text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border-2 border-rose-300 hover:border-rose-400 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer shrink-0"
                title="Wyczyść wszystkie wprowadzone dane i zresetuj weryfikację"
              >
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Wyczyść wszystko</span>
              </button>
            )}
          </div>
        </div>

        {/* PROMINENTNY BOKS DROPZONE IDENTYCZNY JAK W KAFELCE 2 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleOrderDrop}
          onClick={() => orderInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer mb-4 ${
            isDragging
              ? 'border-fuchsia-500 bg-fuchsia-50/80 scale-[1.01]'
              : 'border-fuchsia-200 hover:border-fuchsia-400 bg-gradient-to-b from-fuchsia-50/30 via-white to-pink-50/20 hover:bg-fuchsia-50/40'
          }`}
        >
          <input
            ref={orderInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf,.txt,.csv,.xml,.html,.htm"
            onChange={handleOrderChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white flex items-center justify-center text-xl shadow-sm shadow-fuchsia-200">
              📄
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
                <span>Wgraj Zamówienie w PDF (lub Excel, TXT, CSV)</span>
                <span className="text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-full border border-fuchsia-200">
                  Możesz przeciągnąć plik tutaj ✨
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                Przeciągnij i upuść tutaj plik z zamówieniem (PDF, Excel .XLSX, TXT lub CSV). System automatycznie sczyta dane kontrahenta, odbiorcę (aptekę), daty, termin płatności i pozycje.
              </p>
            </div>
          </div>
        </div>

        {/* Szybki wybór z historii zamówień sieciowych (identycznie jak na zrzucie ekranu z Kafelka 2!) */}
        {archivedOrders && archivedOrders.length > 0 && (
          <div className="mb-4 p-3 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
            <div className="text-xs font-semibold text-fuchsia-950 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-600" />
              <span>Lub wybierz z Historii Zamówień Sieciowych:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {archivedOrders.slice(0, 6).map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => {
                    setVerified(EMPTY_VERIFICATION_CHECKS);
                    if (onLoadArchivedOrder) onLoadArchivedOrder(ord);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer bg-white hover:bg-fuchsia-100/70 border-fuchsia-200 text-slate-700 shadow-2xs hover:border-fuchsia-400"
                >
                  <span className="font-bold text-fuchsia-700">{ord.chain}</span> · {ord.invoiceNumber || ord.orderNumber} ({ord.totalGross.toFixed(2)} zł)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rozwijany panel wklejania treści zamówienia ze schowka */}
        {isPasteOpen && (
          <div className="mb-4 p-4 rounded-xl bg-fuchsia-50/70 border border-fuchsia-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>📋</span> Wklej tekst lub tabelę zamówienia (z maila, komunikatora lub pliku):
              </span>
              <button
                onClick={() => setIsPasteOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕ Zamknij
              </button>
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={5}
              placeholder={`Wklej tutaj treść zamówienia, np.:
Numer zamówienia: ZAM/2026/10/01
1. OMNi-BiOTiC Active 60 g | EAN: 9120117912773 | Ilość: 4 szt. | Cena: 166.30 | VAT: 8%
2. OMNi-BiOTiC TRAVEL | EAN: 9120001435692 | Ilość: 3 szt. | Cena: 157.94 | VAT: 8%`}
              className="w-full text-xs font-mono text-slate-900 bg-white border border-fuchsia-200 rounded-lg p-2.5 focus:border-fuchsia-500 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                System automatycznie rozpozna nazwy, kody EAN, ilości, ceny netto oraz stawkę VAT.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPasteOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleApplyPastedText}
                  disabled={!pastedText.trim()}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Zaczytaj zamówienie
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wczytany plik */}
        {orderFile && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-fuchsia-50/40 to-white border border-emerald-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0">
                ✓
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {orderFile.name}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                    {orderFile.size}
                  </span>
                  <span className="text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-full border border-fuchsia-200">
                    Zaczytano {itemsCount} {itemsCount === 1 ? 'pozycję' : itemsCount < 5 ? 'pozycje' : 'pozycji'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dane zamówienia zostały przetworzone. Sprawdź poniżej dane faktury i zatwierdź nagłówek.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => orderInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                Wgraj inny plik
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerified(EMPTY_VERIFICATION_CHECKS);
                  setLastExtractedInfo(null);
                  onOrderFileChange(null);
                }}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                title="Wyczyść plik"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Baner potwierdzenia danych odczytanych z zamówienia */}
        {lastExtractedInfo && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-fuchsia-50/90 via-pink-50/80 to-rose-50/90 border border-fuchsia-300 shadow-2xs animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      Pomyślnie odczytano dane z zamówienia
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200">
                      {lastExtractedInfo.isRecognizedChain
                        ? `Rozpoznano profil: ${lastExtractedInfo.chainProfileName}`
                        : 'Nabywca zdefiniowany w zamówieniu'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      🏢 <strong>Nabywca:</strong> {lastExtractedInfo.buyer.name} (NIP: <strong className="font-mono">{lastExtractedInfo.buyer.nip}</strong>)
                    </span>
                    <span>·</span>
                    <span>
                      📍 <strong>Adres:</strong> {lastExtractedInfo.buyer.addressLine1}, {lastExtractedInfo.buyer.postalCode} {lastExtractedInfo.buyer.city}
                    </span>
                    {lastExtractedInfo.thirdParty && (
                      <>
                        <span>·</span>
                        <span>
                          🏬 <strong>Odbiorca:</strong> {lastExtractedInfo.thirdParty.name}{' '}
                          {lastExtractedInfo.thirdParty.gln ? `(GLN: ${lastExtractedInfo.thirdParty.gln})` : lastExtractedInfo.thirdParty.idWew ? `(ID-Wew: ${lastExtractedInfo.thirdParty.idWew})` : ''}
                        </span>
                      </>
                    )}
                  </div>
                  {lastExtractedInfo.extractedSummary.datesFound.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-600 font-mono">
                      📅 Odczytane daty: {lastExtractedInfo.extractedSummary.datesFound.join(' | ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyAll}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Zatwierdź wszystkie dane z zamówienia</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* KROK 2: DANE E-FAKTURY KSEF I WERYFIKACJA NAGŁÓWKA                   */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-fuchsia-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm shadow-2xs">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-fuchsia-600" />
                <span>Dane E-Faktury KSeF i Weryfikacja Nagłówka</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sprawdź i zatwierdź dane kontrahenta, daty transakcji, termin płatności oraz numer faktury zgodny z ustawą o VAT.
              </p>
            </div>
          </div>

          {/* Akcja zatwierdzenia */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyAll}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                allVerified
                  ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 text-white shadow-fuchsia-200'
                  : 'bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 border border-fuchsia-200'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{allVerified ? 'Wszystko zatwierdzone ✓' : 'Zatwierdź wszystkie dane jako OK'}</span>
            </button>
          </div>
        </div>

        {/* Belka postępu zatwierdzenia danych */}
        <div className="mt-3 px-3.5 py-2 rounded-xl bg-fuchsia-50/40 border border-fuchsia-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {allVerified ? (
              <CheckCircle2 className="w-4 h-4 text-fuchsia-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-fuchsia-600" />
            )}
            <span className="font-semibold text-slate-800">
              Stan weryfikacji nagłówka:{' '}
              <strong className="text-fuchsia-700">
                {verifiedCount} z {totalRequired} zatwierdzonych
              </strong>
            </span>
            <span className="text-fuchsia-200">|</span>
            <span className="text-slate-500 text-[11px]">
              Każdy kafelek posiada niezależne pole zatwierdzenia (✓ OK)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-24 bg-fuchsia-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full transition-all duration-300 bg-gradient-to-r from-fuchsia-400 via-pink-500 to-fuchsia-600"
                style={{ width: `${(verifiedCount / totalRequired) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[11px] font-bold text-slate-700">
              {Math.round((verifiedCount / totalRequired) * 100)}%
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 📌 MINI-NOTATKA DLA WYSTAWIAJĄCEGO FV (PO PRZYPISANIU ODBIORCY)        */}
        {/* ===================================================================== */}
        {recipientCheatSheet && (
          <div
            className={`mt-4 p-4 rounded-2xl border-2 shadow-xs animate-in fade-in duration-200 ${
              recipientCheatSheet.theme === 'amber'
                ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white border-amber-300'
                : recipientCheatSheet.theme === 'blue'
                ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white border-blue-300'
                : recipientCheatSheet.theme === 'emerald'
                ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white border-emerald-300'
                : recipientCheatSheet.theme === 'purple'
                ? 'bg-gradient-to-r from-purple-50/90 via-fuchsia-50/50 to-white border-purple-300'
                : 'bg-gradient-to-r from-rose-50/90 via-pink-50/50 to-white border-rose-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-slate-900 text-white shadow-2xs">
                  <span>📌</span>
                  <span>MINI-NOTATKA DLA WYSTAWIAJĄCEGO FV</span>
                </span>
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  Odbiorca: <span className="underline decoration-fuchsia-400 decoration-2">{recipientCheatSheet.recipientName}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-600 text-white shadow-2xs">
                  {recipientCheatSheet.priceRule}
                </span>
              </div>
            </div>

            {/* 4 KLUCZOWE PUNKTY DLA WYSTAWIAJĄCEGO FV */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* 1. TERMIN PŁATNOŚCI */}
              <div className="bg-white/95 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-fuchsia-600" />
                      <span>1. Termin płatności</span>
                    </span>
                    {meta.paymentDays === recipientCheatSheet.paymentDays ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ✓ Ustawiono
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPaymentDaysFromDelivery(recipientCheatSheet.paymentDays)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-600 hover:bg-fuchsia-700 text-white cursor-pointer transition-colors"
                      >
                        Ustaw {recipientCheatSheet.paymentDays} dni
                      </button>
                    )}
                  </div>
                  <div className="text-base font-black text-slate-900">
                    {recipientCheatSheet.paymentDays} dni
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {recipientCheatSheet.paymentDescription}
                  </p>
                </div>
              </div>

              {/* 2. CZY WYMAGANY JEST ID-WEW.? */}
              <div className="bg-white/95 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Warehouse className="w-3.5 h-3.5 text-blue-600" />
                      <span>2. Czy wymagany ID-Wew. (Podmiot3)?</span>
                    </span>
                    {recipientCheatSheet.idWewRequired ? (
                      thirdParty?.idWew === recipientCheatSheet.expectedIdWew ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✓ Wpisany
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateThirdParty &&
                            onUpdateThirdParty({
                              name: thirdParty?.name || 'Magazyn Centralny Super Pharm Holding',
                              countryCode: 'PL',
                              addressLine1: thirdParty?.addressLine1 || 'Aleja 20-lecia 23, 96-515 Teresin',
                              postalCode: thirdParty?.postalCode || '96-515',
                              city: thirdParty?.city || 'Teresin',
                              role: '2',
                              idWew: recipientCheatSheet.expectedIdWew,
                            })
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
                        >
                          + Wstaw ID-Wew
                        </button>
                      )
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Brak wymogu
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs font-black ${
                      recipientCheatSheet.idWewRequired
                        ? 'text-blue-900'
                        : 'text-slate-800'
                    }`}
                  >
                    {recipientCheatSheet.idWewStatus}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {recipientCheatSheet.idWewDescription}
                  </p>
                </div>
              </div>

              {/* 3. CZY DODAĆ DATĘ PRZYDATNOŚCI I SERIĘ NA FV? */}
              <div className="bg-white/95 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>3. Data przydatności i seria na FV?</span>
                    </span>
                  </div>
                  <div
                    className={`text-xs font-black ${
                      recipientCheatSheet.addBatchAndExpiryRequired
                        ? 'text-emerald-900'
                        : 'text-amber-900'
                    }`}
                  >
                    {recipientCheatSheet.addBatchAndExpiryStatus}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {recipientCheatSheet.addBatchAndExpiryDescription}
                  </p>
                </div>
              </div>

              {/* 4. W JAKIM FORMACIE NA FV? */}
              <div className="bg-white/95 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>4. W jakim formacie na FV?</span>
                    </span>
                    {onToggleLogisticsFormat &&
                      logisticsFormat !== recipientCheatSheet.recommendedLogisticsFormat && (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleLogisticsFormat(
                              recipientCheatSheet.recommendedLogisticsFormat
                            )
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transition-colors"
                        >
                          Ustaw ten format
                        </button>
                      )}
                  </div>
                  <div className="text-xs font-black text-indigo-950">
                    {recipientCheatSheet.formatStatus}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {recipientCheatSheet.formatDescription}
                  </p>
                </div>

                {onToggleLogisticsFormat && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Aktywny w KSeF:</span>
                    <button
                      type="button"
                      onClick={() => onToggleLogisticsFormat('gs1_composite')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                        logisticsFormat === 'gs1_composite'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      GS1 łączony
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleLogisticsFormat('separate_fields')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                        logisticsFormat === 'separate_fields'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Osobne pola
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleLogisticsFormat('none')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                        logisticsFormat === 'none'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Bez serii/dat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {recipientCheatSheet.extraTip && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                <Info className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                <span>{recipientCheatSheet.extraTip}</span>
              </div>
            )}
          </div>
        )}

        {/* GŁÓWNA SIATKA DANYCH ZAMÓWIENIA & FAKTURY Z POLAMI DO ZATWIERDZENIA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
        
        {/* KARTA 1: Nabywca / Sieć apteczna */}
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            verified.buyer
              ? 'bg-fuchsia-50/30 border-fuchsia-300 ring-1 ring-fuchsia-200/60 shadow-2xs'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-fuchsia-600" />
              Nabywca / Dane Kontrahenta
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsEditingBuyer(!isEditingBuyer)}
                className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Edytuj dane nabywcy"
              >
                {isEditingBuyer ? 'Zwiń' : '✏️ Edytuj'}
              </button>
              <button
                type="button"
                onClick={() => toggleVerification('buyer')}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                  verified.buyer
                    ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                {verified.buyer ? <CheckSquare className="w-3 h-3 text-fuchsia-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                <span>{verified.buyer ? '✓ Zatwierdzony' : 'Zatwierdź'}</span>
              </button>
            </div>
          </div>

          <div className="relative mb-2">
            <select
              value={selectedChain}
              onChange={(e) => {
                onSelectChain(e.target.value as PharmacyChain);
                setVerified((prev) => ({ ...prev, buyer: false }));
              }}
              className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 pr-8 appearance-none focus:outline-none focus:border-fuchsia-400"
            >
              <option value="Custom">Wybierz sieć apteczną lub wgraj zamówienie...</option>
              <option value="Super-Pharm">Super-Pharm Poland Sp. z o.o.</option>
              <option value="Dr. Max">Dr. Max (Dr. Max Lekomat Sp. z o.o.)</option>
              <option value="DOZ">DOZ (DOZ S.A. Direct Sp. k.)</option>
              <option value="Gemini">Gemini (Gemini Polska Sp. z o.o.)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>

          {isEditingBuyer ? (
            <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Nazwa Nabywcy:</span>
                <input
                  type="text"
                  value={buyer.name}
                  onChange={(e) => onUpdateBuyer({ ...buyer, name: e.target.value })}
                  placeholder="np. DR. MAX LEKOMAT SP. Z O.O."
                  className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded px-2 py-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block">NIP:</span>
                  <input
                    type="text"
                    value={buyer.nip}
                    onChange={(e) => onUpdateBuyer({ ...buyer, nip: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10 cyfr NIP"
                    className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">E-mail:</span>
                  <input
                    type="email"
                    value={buyer.email || ''}
                    onChange={(e) => onUpdateBuyer({ ...buyer, email: e.target.value })}
                    placeholder="faktury@odbiorca.pl"
                    className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Ulica i numer:</span>
                <input
                  type="text"
                  value={buyer.addressLine1}
                  onChange={(e) => onUpdateBuyer({ ...buyer, addressLine1: e.target.value })}
                  placeholder="ul. Przykładowa 1"
                  className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded px-2 py-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block">Kod pocztowy:</span>
                  <input
                    type="text"
                    value={buyer.postalCode}
                    onChange={(e) => onUpdateBuyer({ ...buyer, postalCode: e.target.value })}
                    placeholder="00-000"
                    className="w-full text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Miejscowość:</span>
                  <input
                    type="text"
                    value={buyer.city}
                    onChange={(e) => onUpdateBuyer({ ...buyer, city: e.target.value })}
                    placeholder="Miasto"
                    className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>
          ) : !buyer.name && !buyer.nip ? (
            <div className="py-4 px-3 rounded-xl border border-dashed border-fuchsia-200 bg-fuchsia-50/30 text-center">
              <p className="text-xs font-semibold text-slate-700">Brak kontrahenta</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Wgraj plik z zamówieniem lub wybierz sieć apteczną powyżej</p>
            </div>
          ) : (
            <div className="space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900 truncate" title={buyer.name}>{buyer.name}</p>
                <span className="shrink-0 text-[10px] font-bold text-fuchsia-700 bg-fuchsia-50 px-1.5 py-0.5 rounded border border-fuchsia-200">
                  {lastExtractedInfo?.isRecognizedChain ? 'Sieć' : 'Z zamówienia'}
                </span>
              </div>
              <p className="font-mono">NIP: <strong>{buyer.nip}</strong></p>
              <p className="truncate text-slate-500">{buyer.addressLine1}, {buyer.postalCode} {buyer.city}</p>
              {buyer.email && <p className="truncate text-slate-500 font-mono text-[10px]">✉️ {buyer.email}</p>}
            </div>
          )}
        </div>

        {/* KARTA 2: Numer Faktury & Typ */}
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            verified.invoiceNumber
              ? 'bg-fuchsia-50/30 border-fuchsia-300 ring-1 ring-fuchsia-200/60 shadow-2xs'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-fuchsia-600" />
              Numer Faktury (P_2) & Typ
            </label>
            <button
              type="button"
              onClick={() => toggleVerification('invoiceNumber')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                verified.invoiceNumber
                  ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {verified.invoiceNumber ? <CheckSquare className="w-3 h-3 text-fuchsia-600" /> : <Square className="w-3 h-3 text-slate-400" />}
              <span>{verified.invoiceNumber ? '✓ Zatwierdzony' : 'Zatwierdź'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Numer faktury:</span>
              <input
                type="text"
                value={meta.invoiceNumber}
                onChange={(e) => onUpdateMeta({ ...meta, invoiceNumber: e.target.value })}
                placeholder="np. 35/2026/KSEF"
                className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-fuchsia-400"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Typ dokumentu:</span>
              <input
                type="text"
                readOnly
                value="Faktura VAT"
                className="w-full text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 cursor-not-allowed text-center"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono truncate">
            Schemat: KSeF FA(3) · P_2 unikalne w roku podatkowym
          </p>
        </div>

        {/* KARTA 3: Daty Wystawienia (P_1) & Dostawy (P_6) */}
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            verified.dates
              ? 'bg-fuchsia-50/30 border-fuchsia-300 ring-1 ring-fuchsia-200/60 shadow-2xs'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-fuchsia-600" />
              Daty: Wystawienie (P_1) & Dostawa (P_6)
            </label>
            <button
              type="button"
              onClick={() => toggleVerification('dates')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                verified.dates
                  ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {verified.dates ? <CheckSquare className="w-3 h-3 text-fuchsia-600" /> : <Square className="w-3 h-3 text-slate-400" />}
              <span>{verified.dates ? '✓ Zatwierdzone' : 'Zatwierdź'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">P_1: Wystawienie</span>
              <input
                type="date"
                value={meta.issueDate}
                onChange={(e) => onUpdateMeta({ ...meta, issueDate: e.target.value })}
                className="w-full text-xs font-mono text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-fuchsia-400"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">P_6: Dostawa</span>
              <input
                type="date"
                value={meta.deliveryDate}
                onChange={(e) => handleDeliveryDateChange(e.target.value)}
                className="w-full text-xs font-mono text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-fuchsia-400"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Data dostawy zgodna z dokumentem WZ / zleceniem zamówienia
          </p>
        </div>

        {/* KARTA 4: Dane Zamówienia (Numer & Data złożenia) */}
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            verified.orderNumber && verified.orderDate
              ? 'bg-fuchsia-50/30 border-fuchsia-300 ring-1 ring-fuchsia-200/60 shadow-2xs'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-fuchsia-600" />
              Zamówienie: Numer & Data złożenia
            </label>
            <button
              type="button"
              onClick={() => {
                const target = !(verified.orderNumber && verified.orderDate);
                setVerified((prev) => ({ ...prev, orderNumber: target, orderDate: target }));
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                verified.orderNumber && verified.orderDate
                  ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {verified.orderNumber && verified.orderDate ? <CheckSquare className="w-3 h-3 text-fuchsia-600" /> : <Square className="w-3 h-3 text-slate-400" />}
              <span>{verified.orderNumber && verified.orderDate ? '✓ Zatwierdzone' : 'Zatwierdź'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">NrZamowienia:</span>
              <input
                type="text"
                value={meta.orderNumber || ''}
                onChange={(e) => onUpdateMeta({ ...meta, orderNumber: e.target.value })}
                placeholder="np. C008848894"
                className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-fuchsia-400"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">DataZamowienia:</span>
              <input
                type="date"
                value={meta.orderDate || ''}
                onChange={(e) => onUpdateMeta({ ...meta, orderDate: e.target.value })}
                className="w-full text-xs font-mono text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-fuchsia-400"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 truncate">
            W KSeF FA(3) w węźle: &lt;WarunkiTransakcji&gt;&lt;Zamowienia&gt;&lt;Zamowienie&gt;
          </p>
        </div>

        {/* KARTA 5: Płatność & Termin płatności */}
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            verified.dueDate
              ? 'bg-fuchsia-50/30 border-fuchsia-300 ring-1 ring-fuchsia-200/60 shadow-2xs'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-fuchsia-600" />
              Termin Płatności & Dni
            </label>
            <button
              type="button"
              onClick={() => toggleVerification('dueDate')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                verified.dueDate
                  ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {verified.dueDate ? <CheckSquare className="w-3 h-3 text-fuchsia-600" /> : <Square className="w-3 h-3 text-slate-400" />}
              <span>{verified.dueDate ? '✓ Zatwierdzony' : 'Zatwierdź'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Termin płatności:</span>
              <input
                type="date"
                value={meta.dueDate}
                onChange={(e) => onUpdateMeta({ ...meta, dueDate: e.target.value })}
                className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-fuchsia-400"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">Forma płatności:</span>
              <select
                value={meta.paymentMethod}
                onChange={(e) => onUpdateMeta({ ...meta, paymentMethod: e.target.value as any })}
                className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-fuchsia-400"
              >
                <option value="przelew">Przelew (kod 6)</option>
                <option value="gotowka">Gotówka (kod 1)</option>
                <option value="karta">Karta (kod 2)</option>
              </select>
            </div>
          </div>

          {/* Szybkie przyciski dni: 30, 45, 60 dni OD DATY DOSTAWY (P_6) — automatycznie wg Centrum Wiedzy */}
          <div className="bg-fuchsia-50/50 p-2.5 rounded-xl border border-fuchsia-200/80 mt-1">
            <div className="flex items-center justify-between text-[11px] mb-1.5 gap-1 flex-wrap">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <span>🚚</span> Termin od daty dostawy (P_6: <strong className="font-mono text-fuchsia-700">{meta.deliveryDate || meta.issueDate}</strong>):
              </span>
              {meta.paymentDays ? (
                <span className="text-[10px] font-bold text-fuchsia-700 bg-fuchsia-100/80 px-2 py-0.5 rounded-full border border-fuchsia-200">
                  {recipientCheatSheet &&
                  recipientCheatSheet.id !== 'custom' &&
                  meta.paymentDays === recipientCheatSheet.paymentDays
                    ? `Wg Centrum Wiedzy: ${meta.paymentDays} dni ✨`
                    : `Wybrano: ${meta.paymentDays} dni ✨`}
                </span>
              ) : null}
            </div>
            {(() => {
              const cwDays =
                recipientCheatSheet && recipientCheatSheet.id !== 'custom'
                  ? recipientCheatSheet.paymentDays
                  : undefined;
              const dayOptions = Array.from(
                new Set([30, 45, 60, ...(cwDays ? [cwDays] : [])])
              ).sort((a, b) => a - b);
              return (
                <div
                  className={`grid gap-1.5 font-mono text-xs ${
                    dayOptions.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
                  }`}
                >
                  {dayOptions.map((days) => {
                    const isSelected = meta.paymentDays === days;
                    const isFromKnowledge = cwDays === days;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setPaymentDaysFromDelivery(days)}
                        className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-fuchsia-500 shadow-xs'
                            : isFromKnowledge
                            ? 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-300 hover:border-fuchsia-400'
                            : 'bg-white hover:bg-fuchsia-50/70 text-slate-800 border-slate-200 hover:border-fuchsia-300'
                        }`}
                        title={
                          isFromKnowledge
                            ? `${days} dni od daty dostawy (termin przypisany w Centrum Wiedzy)`
                            : `${days} dni od daty dostawy`
                        }
                      >
                        {days} dni
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* KARTA 6: Odbiorca / Miejsce dostawy (Podmiot3) - opcjonalny */}
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            thirdParty?.name
              ? verified.thirdParty
                ? 'bg-fuchsia-50/30 border-fuchsia-300 ring-1 ring-fuchsia-200/60 shadow-2xs'
                : 'bg-white border-slate-200'
              : 'bg-slate-50/50 border-dashed border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-fuchsia-600" />
              Odbiorca (Podmiot3 — ID-Wew)
            </label>
            {thirdParty?.name ? (
              <button
                type="button"
                onClick={() => toggleVerification('thirdParty')}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                  verified.thirdParty
                    ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                {verified.thirdParty ? <CheckSquare className="w-3 h-3 text-fuchsia-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                <span>{verified.thirdParty ? '✓ Zatwierdzony' : 'Zatwierdź'}</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">Brak ID-Wew (brak Podmiot3)</span>
            )}
          </div>

          {thirdParty?.name ? (
            showThirdPartyDetails ? (
              <div className="space-y-2 bg-white p-3 rounded-xl border border-fuchsia-200 text-xs animate-in fade-in">
                <div className="flex items-center justify-between pb-1 border-b border-fuchsia-100">
                  <span className="font-bold text-fuchsia-700 text-xs">Edycja Odbiorcy (Podmiot3 — ID-Wew):</span>
                  <button
                    type="button"
                    onClick={() => setShowThirdPartyDetails(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Zwiń ▲
                  </button>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Nazwa odbiorcy / oddziału:</span>
                  <input
                    type="text"
                    value={thirdParty.name}
                    onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, name: e.target.value })}
                    className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 focus:border-fuchsia-400 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">ID-Wew (NIP-oddział w KSeF):</span>
                  <input
                    type="text"
                    value={thirdParty.idWew || ''}
                    onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, idWew: e.target.value.trim() })}
                    placeholder="np. 5213842837-54936"
                    className="w-full text-xs font-mono font-bold text-fuchsia-800 bg-fuchsia-50/50 border border-fuchsia-200 rounded px-2 py-1 focus:border-fuchsia-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Wymagany format KSeF: NIP-5cyfr (np. Super-Pharm 5213842837-54936)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Ulica i numer:</span>
                  <input
                    type="text"
                    value={thirdParty.addressLine1}
                    onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, addressLine1: e.target.value })}
                    className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 focus:border-fuchsia-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Kod pocztowy:</span>
                    <input
                      type="text"
                      value={thirdParty.postalCode || ''}
                      onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, postalCode: e.target.value })}
                      className="w-full text-xs font-mono text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 focus:border-fuchsia-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Miasto:</span>
                    <input
                      type="text"
                      value={thirdParty.city || ''}
                      onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, city: e.target.value })}
                      className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 focus:border-fuchsia-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 truncate" title={thirdParty.name}>
                    {thirdParty.name}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowThirdPartyDetails(true)}
                      className="text-[10px] font-semibold text-fuchsia-700 hover:text-fuchsia-900 bg-fuchsia-50 hover:bg-fuchsia-100 px-2 py-0.5 rounded border border-fuchsia-200 cursor-pointer transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateThirdParty && onUpdateThirdParty(null)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer"
                      title="Usuń odbiorcę"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  {thirdParty.idWew ? (
                    <span className="bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded border border-fuchsia-200 font-bold">
                      ID-Wew: {thirdParty.idWew}
                    </span>
                  ) : null}
                  {thirdParty.nip ? (
                    <span className="text-slate-600">NIP: {thirdParty.nip}</span>
                  ) : null}
                  {!thirdParty.idWew && !thirdParty.nip && (
                    <span className="text-[10px] text-amber-600 font-semibold">
                      Brak ID-Wew
                    </span>
                  )}
                </div>
                <p className="truncate text-slate-500 font-sans">
                  {thirdParty.addressLine1}{thirdParty.city ? `, ${thirdParty.postalCode || ''} ${thirdParty.city}` : ''}
                </p>
              </div>
            )
          ) : (
            <div className="py-3 text-center">
              <p className="text-[11px] text-slate-500 mb-2">
                Brak Podmiot3 (ID-Wew) — dostawa bezpośrednio do Nabywcy (Podmiot 2).
              </p>
              <button
                type="button"
                onClick={() =>
                  onUpdateThirdParty &&
                  onUpdateThirdParty({
                    name: 'Magazyn Centralny Super Pharm Holding',
                    addressLine1: 'Aleja 20-lecia 23',
                    postalCode: '96-515',
                    city: 'Teresin',
                    countryCode: 'PL',
                    idWew: '5213842837-54936',
                    role: '2',
                  })
                }
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
              >
                + Dodaj Odbiorcę z ID-Wew (Podmiot3)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pasek Sprzedawcy & Przycisk szczegółów adresowych */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-600">
          <span className="font-semibold text-slate-800">Sprzedawca (Podmiot1):</span>
          <span>{seller.name}</span>
          <span>·</span>
          <span>NIP: <strong>{seller.nip}</strong></span>
          <span>·</span>
          <span>BDO: <strong>{seller.bdoNumber || '000585744'}</strong></span>
          <span>·</span>
          <span>Konto: <strong className="font-mono">{seller.bankAccount}</strong></span>
        </div>

        <button
          onClick={() => setShowAddressDetails(!showAddressDetails)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 py-1 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
        >
          <span>Szczegóły strukturalne adresu (&lt;AdresPol&gt;)</span>
          {showAddressDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Rozwijane szczegóły adresowe <AdresPol> */}
      {showAddressDetails && (
        <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sprzedawca <AdresPol> */}
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-2">
                Adres Sprzedawcy (&lt;AdresPol&gt; Podmiot1)
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="col-span-2">
                  <label className="text-slate-500 block mb-0.5">Ulica i numer:</label>
                  <input
                    type="text"
                    value={seller.addressLine1}
                    onChange={(e) => onUpdateSeller({ ...seller, addressLine1: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Kod pocztowy:</label>
                  <input
                    type="text"
                    value={seller.postalCode}
                    onChange={(e) => onUpdateSeller({ ...seller, postalCode: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Miejscowość:</label>
                  <input
                    type="text"
                    value={seller.city}
                    onChange={(e) => onUpdateSeller({ ...seller, city: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>

            {/* Nabywca <AdresPol> */}
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-2">
                Adres Nabywcy (&lt;AdresPol&gt; Podmiot2)
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="col-span-2">
                  <label className="text-slate-500 block mb-0.5">Ulica i numer:</label>
                  <input
                    type="text"
                    value={buyer.addressLine1}
                    onChange={(e) => onUpdateBuyer({ ...buyer, addressLine1: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Kod pocztowy:</label>
                  <input
                    type="text"
                    value={buyer.postalCode}
                    onChange={(e) => onUpdateBuyer({ ...buyer, postalCode: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-0.5">Miejscowość:</label>
                  <input
                    type="text"
                    value={buyer.city}
                    onChange={(e) => onUpdateBuyer({ ...buyer, city: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
