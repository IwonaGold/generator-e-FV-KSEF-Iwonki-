import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileEdit,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Download,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  FileText,
  Search,
  Building,
  AlertTriangle,
  Info,
  Calendar,
  Percent,
  Layers,
  ListPlus,
  Check,
  Sliders,
} from 'lucide-react';
import { EntityDetails, ThirdPartyEntity, InvoiceItem, VatRate } from '../types/ksef';
import {
  CorrectionItem,
  KSeFCorrectionData,
  COMMON_CORRECTION_REASONS,
  CorrectionMode,
  CorrectedInvoiceReference,
  FormalCorrectionField,
} from '../types/correction';
import { ArchivedOrder } from '../types/ordersHistory';
import { DEFAULT_SELLER, PHARMACY_CHAINS } from '../utils/sampleData';
import { generateKSeFCorrectionXML } from '../utils/ksefCorrectionGenerator';
import { parseKSeFXMLString, convertInvoiceItemsToCorrectionItems } from '../utils/ksefXmlParser';
import { validateXmlAgainstKSeFXsd, XsdValidationResult } from '../utils/ksefXsdValidator';
import { downloadKSeFXMLFile } from '../utils/ksefGenerator';
import { saveArchivedOrder } from '../utils/ordersStorage';
import { parseAddressString } from '../utils/ksefPdfInvoiceParser';

interface InvoiceCorrectionViewProps {
  archivedOrders: ArchivedOrder[];
  preloadedOrder?: ArchivedOrder | null;
  onClearPreloadedOrder?: () => void;
  onSavedToHistory?: (savedOrder: ArchivedOrder) => void;
}

export const InvoiceCorrectionView: React.FC<InvoiceCorrectionViewProps> = ({
  archivedOrders,
  preloadedOrder,
  onClearPreloadedOrder,
  onSavedToHistory,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const bulkPdfInputRef = useRef<HTMLInputElement>(null);

  // Strony transakcji
  const [seller, setSeller] = useState<EntityDetails>(DEFAULT_SELLER);
  const [buyer, setBuyer] = useState<EntityDetails>(PHARMACY_CHAINS['Dr. Max'].buyer);
  const [thirdParty, setThirdParty] = useState<ThirdPartyEntity | null>(null);

  // Dane faktury korygowanej
  const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState<string>('41/2026/KSEF');
  const [originalInvoiceDate, setOriginalInvoiceDate] = useState<string>('2026-09-29');
  const [hasOriginalKsefNumber, setHasOriginalKsefNumber] = useState<boolean>(true);
  const [originalKsefNumber, setOriginalKsefNumber] = useState<string>('9571106742-20260929-4D51D9800003-0F');
  const [deliveryDate, setDeliveryDate] = useState<string>('2026-09-30');
  const [orderNumber, setOrderNumber] = useState<string>('ZZ-1009/09/26');
  const [orderDate, setOrderDate] = useState<string>('2026-09-28');
  const [bankAccount, setBankAccount] = useState<string>('96 1090 1098 0000 0001 6398 3525');

  // Tryb korekty wg wytycznych MF
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>('value');
  const [typKorekty, setTypKorekty] = useState<'1' | '2' | '3'>('1');
  const [okresFaKorygowanej, setOkresFaKorygowanej] = useState<string>('01.09.2026 - 30.09.2026');

  // Stan wielu faktur dla Korekty Zbiorczej (TypKorekty: 3)
  const [correctedInvoices, setCorrectedInvoices] = useState<CorrectedInvoiceReference[]>([
    {
      id: 'inv-init-1',
      invoiceNumber: '41/2026/KSEF',
      invoiceDate: '2026-09-29',
      hasKsefNumber: true,
      ksefNumber: '9571106742-20260929-4D51D9800003-0F',
      netTotal: 9239.92,
      grossTotal: 9979.11,
      fileName: 'faktura_41_2026_KSEF.pdf',
    },
  ]);

  // Konfiguracja rabatu dla korekty zbiorczej
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [discountAmountNet, setDiscountAmountNet] = useState<number>(500);
  const [discountVatRate, setDiscountVatRate] = useState<'8%' | '23%'>('8%');
  const [discountDescription, setDiscountDescription] = useState<string>(
    'Rabat potransakcyjny za zrealizowany obrót w okresie 01.09.2026 - 30.09.2026'
  );

  // Stan błędu formalnego (TypKorekty: 2)
  const [formalFields, setFormalFields] = useState<
    Record<
      FormalCorrectionField,
      {
        active: boolean;
        name: string;
        origValue: string;
        corrValue: string;
      }
    >
  >({
    buyer_name: {
      active: false,
      name: 'Nazwa Nabywcy (literówka / zmiana nazwy)',
      origValue: 'DR. MAX LEKOMAT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      corrValue: 'DR. MAX LEKOMAT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    },
    buyer_address: {
      active: true,
      name: 'Adres siedziby Nabywcy (ulica, nr, kod pocztowy, miasto)',
      origValue: 'ul. Krzemieniecka 60A, 54-613 Wrocław',
      corrValue: 'ul. Krzemieniecka 60A, 54-613 Wrocław',
    },
    third_party: {
      active: false,
      name: 'Dane Odbiorcy towaru / Apteki (Podmiot 3)',
      origValue: 'Brak odrębnego odbiorcy',
      corrValue: 'Brak odrębnego odbiorcy',
    },
    delivery_date: {
      active: false,
      name: 'Data dokonania / zakończenia dostawy',
      origValue: '2026-09-30',
      corrValue: '2026-09-30',
    },
    order_number: {
      active: false,
      name: 'Numer zamówienia klienta (ZZ)',
      origValue: 'ZZ-1009/09/26',
      corrValue: 'ZZ-1009/09/26',
    },
    bank_account: {
      active: false,
      name: 'Rachunek bankowy do płatności',
      origValue: '96 1090 1098 0000 0001 6398 3525',
      corrValue: '96 1090 1098 0000 0001 6398 3525',
    },
    other: {
      active: false,
      name: 'Inne dane formalne / opisowe',
      origValue: '',
      corrValue: '',
    },
  });

  // Dane bieżącej korekty
  const [correctionNumber, setCorrectionNumber] = useState<string>('KOR-01/10/2026');
  const [issueDate, setIssueDate] = useState<string>(today);
  const [issuePlace, setIssuePlace] = useState<string>('Gdańsk');
  const [dueDate, setDueDate] = useState<string>(today);
  const [reasonCategory, setReasonCategory] = useState<string>(COMMON_CORRECTION_REASONS[0]);
  const [reasonDescription, setReasonDescription] = useState<string>(
    'Zwrot 2 sztuk towaru z powodu uszkodzenia opakowania w transporcie'
  );

  // Pozycje korygowane
  const [items, setItems] = useState<CorrectionItem[]>([]);

  // Stan UI
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [generatedXml, setGeneratedXml] = useState<string>('');
  const [xsdResult, setXsdResult] = useState<XsdValidationResult | null>(null);
  const [isValidatingXsd, setIsValidatingXsd] = useState(false);
  const [copied, setCopied] = useState(false);

  // Jeśli przekazano zamówienie z historii (np. kliknięto "Wystaw korektę" w Module 3)
  useEffect(() => {
    if (preloadedOrder) {
      loadFromArchivedOrder(preloadedOrder);
      if (onClearPreloadedOrder) onClearPreloadedOrder();
    }
  }, [preloadedOrder]);

  // Załadowanie początkowych przykładowych danych, jeśli brak pozycji
  useEffect(() => {
    if (items.length === 0) {
      loadSampleCorrectionData();
    }
  }, []);

  const loadSampleCorrectionData = () => {
    const sampleItems: InvoiceItem[] = [
      {
        id: 's-1',
        name: 'OMNi-BiOTiC® 10 AAD 10x5g saszetki',
        gtin: '9120013980313',
        quantity: 10,
        unit: 'SZT.',
        netPrice: 65.0,
        vatRate: '8%',
        batchNumber: '25E1244',
        expiryDate: '2028-04-30',
      },
      {
        id: 's-2',
        name: 'OMNi-BiOTiC® STRESS Repair 28x3g',
        gtin: '9120013981884',
        quantity: 5,
        unit: 'SZT.',
        netPrice: 110.0,
        vatRate: '8%',
        batchNumber: '25E1192',
        expiryDate: '2027-11-30',
      },
    ];

    const corrItems = convertInvoiceItemsToCorrectionItems(sampleItems);
    corrItems[0].correctedQuantity = 8;
    recalculateItemDeltas(corrItems[0]);

    setItems(corrItems);
    setOriginalInvoiceNumber('41/2026/KSEF');
    setOriginalInvoiceDate('2026-09-28');
    setOriginalKsefNumber('5833446059-20260928-123456-ABCDEF-01');
    setHasOriginalKsefNumber(true);
    setBuyer(PHARMACY_CHAINS['Dr. Max'].buyer);
    setCorrectionMode('value');
    setTypKorekty('1');
  };

  const loadFromArchivedOrder = (order: ArchivedOrder) => {
    setOriginalInvoiceNumber(order.invoiceNumber);
    setOriginalInvoiceDate(order.issueDate);
    setBuyer(order.buyer);
    setThirdParty(order.thirdParty || null);
    setSeller(order.seller || DEFAULT_SELLER);
    setCorrectionNumber(`KOR-${order.invoiceNumber.replace('/KSEF', '')}`);
    setHasOriginalKsefNumber(false);
    setOriginalKsefNumber('');

    if (order.items && order.items.length > 0) {
      const corrItems = convertInvoiceItemsToCorrectionItems(order.items);
      setItems(corrItems);
    }

    setNotification(`Pomyślnie załadowano fakturę pierwotną ${order.invoiceNumber} (${order.chain}).`);
    setTimeout(() => setNotification(null), 5000);
  };

  // =========================================================================
  // OBSŁUGA WGRYWANIA FAKTURY PIERWOTNEJ W PDF (Z NUMEREM KSEF)
  // =========================================================================
  const handlePdfFile = async (file: File) => {
    if (!file) return;
    setIsParsingPdf(true);
    setNotification(`Trwa odczytywanie pliku PDF "${file.name}" (analiza numeru KSeF, kontrahenta i pozycji)...`);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const b64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(b64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const pdfBase64 = await base64Promise;

      const response = await fetch('/api/parse-invoice-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, fileName: file.name }),
      });

      if (!response.ok) {
        throw new Error(`Błąd serwera (${response.status}) podczas parsowania PDF`);
      }

      const data = await response.json();

      if (data.invoiceNumber) {
        setOriginalInvoiceNumber(data.invoiceNumber);
        setCorrectionNumber(`KOR-${data.invoiceNumber.replace('/KSEF', '')}`);
      }
      if (data.issueDate) {
        setOriginalInvoiceDate(data.issueDate);
      }
      if (data.ksefNumber) {
        setOriginalKsefNumber(data.ksefNumber);
        setHasOriginalKsefNumber(true);
      } else {
        setHasOriginalKsefNumber(false);
      }
      if (data.deliveryDate) setDeliveryDate(data.deliveryDate);
      if (data.orderNumber) setOrderNumber(data.orderNumber);
      if (data.orderDate) setOrderDate(data.orderDate);
      if (data.bankAccount) setBankAccount(data.bankAccount);
      if (data.dueDate) setDueDate(data.dueDate);

      if (data.buyer && data.buyer.name) {
        setBuyer({
          nip: data.buyer.nip || '',
          name: data.buyer.name || '',
          countryCode: data.buyer.countryCode || 'PL',
          addressLine1: data.buyer.addressLine1 || '',
          postalCode: data.buyer.postalCode || '',
          city: data.buyer.city || '',
          gln: data.buyer.gln || '',
        });
      }
      if (data.seller && data.seller.name) {
        setSeller((s) => ({
          ...s,
          nip: data.seller.nip || s.nip,
          name: data.seller.name || s.name,
          addressLine1: data.seller.addressLine1 || s.addressLine1,
          postalCode: data.seller.postalCode || s.postalCode,
          city: data.seller.city || s.city,
          bankAccount: data.seller.bankAccount || s.bankAccount,
        }));
      }
      if (data.thirdParty && data.thirdParty.name) {
        setThirdParty(data.thirdParty);
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        const corrItems = convertInvoiceItemsToCorrectionItems(data.items);
        setItems(corrItems);
      }

      // Aktualizacja wartości pól formalnych z odczytanego PDF
      const formattedBuyerAddr = `${data.buyer?.addressLine1 || ''}${
        data.buyer?.postalCode ? ', ' + data.buyer.postalCode + ' ' + (data.buyer?.city || '') : ''
      }`;

      setFormalFields((prev) => ({
        ...prev,
        buyer_name: {
          ...prev.buyer_name,
          origValue: data.buyer?.name || prev.buyer_name.origValue,
          corrValue: data.buyer?.name || prev.buyer_name.corrValue,
        },
        buyer_address: {
          ...prev.buyer_address,
          origValue: formattedBuyerAddr || prev.buyer_address.origValue,
          corrValue: formattedBuyerAddr || prev.buyer_address.corrValue,
        },
        delivery_date: {
          ...prev.delivery_date,
          origValue: data.deliveryDate || prev.delivery_date.origValue,
          corrValue: data.deliveryDate || prev.delivery_date.corrValue,
        },
        order_number: {
          ...prev.order_number,
          origValue: data.orderNumber || prev.order_number.origValue,
          corrValue: data.orderNumber || prev.order_number.corrValue,
        },
        bank_account: {
          ...prev.bank_account,
          origValue: data.bankAccount || prev.bank_account.origValue,
          corrValue: data.bankAccount || prev.bank_account.corrValue,
        },
      }));

      // Dodaj także do listy pojedynczej dla korekty zbiorczej
      setCorrectedInvoices([
        {
          id: `inv-${Date.now()}`,
          invoiceNumber: data.invoiceNumber || file.name,
          invoiceDate: data.issueDate || today,
          hasKsefNumber: Boolean(data.ksefNumber),
          ksefNumber: data.ksefNumber || '',
          netTotal: data.totalNet || 0,
          grossTotal: data.totalGross || 0,
          fileName: file.name,
        },
      ]);

      setNotification(
        `✅ Pomyślnie wczytano fakturę z PDF! ` +
          (data.ksefNumber ? `Nr KSeF: ${data.ksefNumber}` : 'Brak nr KSeF') +
          ` · Faktura: ${data.invoiceNumber || originalInvoiceNumber} · Pozycji: ${data.items?.length || 0}`
      );
      setTimeout(() => setNotification(null), 8000);
    } catch (err: any) {
      alert('Błąd podczas przetwarzania pliku PDF: ' + (err.message || 'Nieznany błąd'));
      setNotification(null);
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Obsługa wielu plików PDF jednocześnie (dla korekty zbiorczej)
  const handleMultiplePdfFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (fileArray.length === 0) return;

    if (fileArray.length === 1 && correctionMode !== 'period_bulk') {
      await handlePdfFile(fileArray[0]);
      return;
    }

    setIsParsingPdf(true);
    setNotification(`Trwa odczytywanie i analiza ${fileArray.length} plików PDF z fakturami...`);

    const loadedInvoices: CorrectedInvoiceReference[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.includes(',') ? res.split(',')[1] : res;
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const pdfBase64 = await base64Promise;

        const response = await fetch('/api/parse-invoice-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64, fileName: file.name }),
        });

        if (response.ok) {
          const data = await response.json();
          loadedInvoices.push({
            id: `inv-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            invoiceNumber: data.invoiceNumber || file.name,
            invoiceDate: data.issueDate || today,
            hasKsefNumber: Boolean(data.ksefNumber),
            ksefNumber: data.ksefNumber || '',
            netTotal: data.totalNet || 0,
            grossTotal: data.totalGross || 0,
            fileName: file.name,
          });

          if (i === 0 && data.buyer && data.buyer.name) {
            setBuyer({
              nip: data.buyer.nip || '',
              name: data.buyer.name || '',
              countryCode: data.buyer.countryCode || 'PL',
              addressLine1: data.buyer.addressLine1 || '',
              postalCode: data.buyer.postalCode || '',
              city: data.buyer.city || '',
              gln: data.buyer.gln || '',
            });
            if (data.seller && data.seller.name) setSeller(data.seller);
          }
        }
      } catch (err) {
        console.warn(`Błąd odczytu ${file.name}:`, err);
      }
    }

    if (loadedInvoices.length > 0) {
      setCorrectionMode('period_bulk');
      setTypKorekty('3');
      setCorrectedInvoices((prev) => {
        const existingNums = new Set(prev.map((p) => p.invoiceNumber));
        const newOnes = loadedInvoices.filter((n) => !existingNums.has(n.invoiceNumber));
        return [...prev, ...newOnes];
      });

      const allDates = loadedInvoices.map((i) => i.invoiceDate).filter(Boolean).sort();
      if (allDates.length > 0) {
        setOkresFaKorygowanej(`${allDates[0]} - ${allDates[allDates.length - 1]}`);
      }

      setReasonCategory('Udzielenie dodatkowego rabatu / upustu cenowego');
      setReasonDescription(
        `Udzielenie rabatu potransakcyjnego na dostawy wg załączonych ${loadedInvoices.length} faktur.`
      );

      setNotification(`✅ Pomyślnie załadowano ${loadedInvoices.length} faktur do korekty zbiorczej!`);
      setTimeout(() => setNotification(null), 6000);
    } else {
      setNotification(`Nie udało się odczytać plików PDF.`);
      setTimeout(() => setNotification(null), 5000);
    }

    setIsParsingPdf(false);
  };

  const handleRemoveCorrectedInvoice = (id: string) => {
    setCorrectedInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const updateFormalField = (key: FormalCorrectionField, newCorrValue: string) => {
    setFormalFields((prev) => {
      const updated = {
        ...prev,
        [key]: { ...prev[key], corrValue: newCorrValue },
      };

      if (key === 'buyer_name') {
        setBuyer((b) => ({ ...b, name: newCorrValue }));
      } else if (key === 'buyer_address') {
        const addr = parseAddressString(newCorrValue);
        setBuyer((b) => ({
          ...b,
          addressLine1: addr.addressLine1 || newCorrValue,
          postalCode: addr.postalCode || b.postalCode,
          city: addr.city || b.city,
        }));
      }

      // Automatyczna przyczyna korekty
      const activeDifferent = Object.entries(updated).filter(
        ([_, v]) => v.active && v.corrValue.trim() !== v.origValue.trim()
      );
      if (activeDifferent.length > 0) {
        const descParts = activeDifferent.map(
          ([_, v]) => `${v.name}: Było "${v.origValue}", Powinno być "${v.corrValue}"`
        );
        setReasonDescription(`Korekta formalna: ${descParts.join('; ')}. Bez wpływu na podstawę opodatkowania.`);
      }

      return updated;
    });
  };

  const toggleFormalFieldActive = (key: FormalCorrectionField) => {
    setFormalFields((prev) => {
      const isNowActive = !prev[key].active;
      const updated = {
        ...prev,
        [key]: { ...prev[key], active: isNowActive },
      };

      const activeDifferent = Object.entries(updated).filter(
        ([_, v]) => v.active && v.corrValue.trim() !== v.origValue.trim()
      );
      if (activeDifferent.length > 0) {
        const descParts = activeDifferent.map(
          ([_, v]) => `${v.name}: Było "${v.origValue}", Powinno być "${v.corrValue}"`
        );
        setReasonDescription(`Korekta formalna: ${descParts.join('; ')}. Bez wpływu na podstawę opodatkowania.`);
      }

      return updated;
    });
  };

  const handleXmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseKSeFXMLString(text);

        setOriginalInvoiceNumber(parsed.invoiceNumber);
        setOriginalInvoiceDate(parsed.issueDate);
        setBuyer(parsed.buyer);
        setSeller(parsed.seller);
        setThirdParty(parsed.thirdParty || null);
        setCorrectionNumber(`KOR-${parsed.invoiceNumber.replace('/KSEF', '')}`);

        const corrItems = convertInvoiceItemsToCorrectionItems(parsed.items);
        setItems(corrItems);

        setNotification(`Pomyślnie wczytano plik XML faktury ${parsed.invoiceNumber} (${corrItems.length} pozycji).`);
        setTimeout(() => setNotification(null), 5000);
      } catch (err: any) {
        alert('Błąd odczytu pliku XML: ' + (err.message || 'Niepoprawny format XML'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // =========================================================================
  // WYBÓR TRYBU KOREKTY WG WYTYCZNYCH MF
  // =========================================================================
  const handleSelectCorrectionMode = (mode: CorrectionMode) => {
    setCorrectionMode(mode);

    if (mode === 'value') {
      setTypKorekty('1');
      setReasonCategory('Zwrot towaru przez odbiorcę (uszkodzenie w transporcie / reklamacja)');
      setReasonDescription('Zwrot części towaru przez odbiorcę');
    } else if (mode === 'formal') {
      setTypKorekty('2');
      setReasonCategory('Korekta formalna – błąd w danych adresowych bez wpływu na kwoty');
      setReasonDescription('Korekta danych adresowych nabywcy na fakturze pierwotnej');
    } else if (mode === 'zero_nip') {
      setTypKorekty('1');
      setReasonCategory('Błędny NIP nabywcy – wyzerowanie do zera (procedura KSeF)');
      setReasonDescription(
        'Wyzerowanie transakcji do 0 z powodu błędnego NIP nabywcy. Nowa faktura z poprawnym NIP zostanie wystawiona odrębnie.'
      );
      // Zerujemy wszystkie pozycje
      setItems((prev) =>
        prev.map((it) => {
          const updated = { ...it, correctedQuantity: 0 };
          recalculateItemDeltas(updated);
          return updated;
        })
      );
    } else if (mode === 'period_bulk') {
      setTypKorekty('3');
      setReasonCategory('Udzielenie dodatkowego rabatu / upustu cenowego');
      setReasonDescription('Udzielenie rabatu okresowego za zrealizowany wolumen zakupowy');
      if (!okresFaKorygowanej) {
        setOkresFaKorygowanej('01.01.2026 - 31.03.2026');
      }
    }
  };

  const recalculateItemDeltas = (item: CorrectionItem) => {
    const origNet = Math.round(item.originalQuantity * item.originalNetPrice * 100) / 100;
    const vatPct =
      item.vatRate === '23%'
        ? 0.23
        : item.vatRate === '8%'
        ? 0.08
        : item.vatRate === '5%'
        ? 0.05
        : 0;
    const origVat = Math.round(origNet * vatPct * 100) / 100;
    const origGross = Math.round((origNet + origVat) * 100) / 100;

    const corrNet = Math.round(item.correctedQuantity * item.correctedNetPrice * 100) / 100;
    const corrVat = Math.round(corrNet * vatPct * 100) / 100;
    const corrGross = Math.round((corrNet + corrVat) * 100) / 100;

    item.originalNetTotal = origNet;
    item.originalVatTotal = origVat;
    item.originalGrossTotal = origGross;

    item.correctedNetTotal = corrNet;
    item.correctedVatTotal = corrVat;
    item.correctedGrossTotal = corrGross;

    item.quantityDelta = Math.round((item.correctedQuantity - item.originalQuantity) * 1000) / 1000;
    item.netDelta = Math.round((corrNet - origNet) * 100) / 100;
    item.vatDelta = Math.round((corrVat - origVat) * 100) / 100;
    item.grossDelta = Math.round((corrGross - origGross) * 100) / 100;

    item.isModified =
      item.quantityDelta !== 0 || item.originalNetPrice !== item.correctedNetPrice;
  };

  const handleUpdateItemQuantity = (id: string, newQty: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, correctedQuantity: Math.max(0, newQty) };
          recalculateItemDeltas(updated);
          return updated;
        }
        return it;
      })
    );
  };

  const handleUpdateItemPrice = (id: string, newPrice: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, correctedNetPrice: Math.max(0, newPrice) };
          recalculateItemDeltas(updated);
          return updated;
        }
        return it;
      })
    );
  };

  const handleApplyQuickReturn = (id: string, unitsToReturn: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const newQty = Math.max(0, it.originalQuantity - unitsToReturn);
          const updated = { ...it, correctedQuantity: newQty };
          recalculateItemDeltas(updated);
          return updated;
        }
        return it;
      })
    );
  };

  const handleZeroOutAllItems = () => {
    handleSelectCorrectionMode('zero_nip');
  };

  const handleResetItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = {
            ...it,
            correctedQuantity: it.originalQuantity,
            correctedNetPrice: it.originalNetPrice,
          };
          recalculateItemDeltas(updated);
          return updated;
        }
        return it;
      })
    );
  };

  // Łączne sumy różnic (delty)
  const totals = useMemo(() => {
    // W korekcie formalnej (TypKorekty: 2) podsumowania kwotowe wykazują wartość 0
    if (typKorekty === '2') {
      return {
        deltaNet: 0,
        deltaVat: 0,
        deltaGross: 0,
        modifiedCount: 0,
        sumOrigNet: 0,
        sumOrigGross: 0,
      };
    }

    // W korekcie zbiorczej (TypKorekty: 3) z rabatem
    if (typKorekty === '3') {
      const sumOrigNet = Math.round(correctedInvoices.reduce((acc, i) => acc + (i.netTotal || 0), 0) * 100) / 100;
      const sumOrigGross = Math.round(correctedInvoices.reduce((acc, i) => acc + (i.grossTotal || 0), 0) * 100) / 100;

      let deltaNet = 0;
      if (discountType === 'percentage') {
        deltaNet = -Math.round(sumOrigNet * (discountPercent / 100) * 100) / 100;
      } else {
        deltaNet = -Math.round(discountAmountNet * 100) / 100;
      }

      const vatPct = discountVatRate === '23%' ? 0.23 : 0.08;
      const deltaVat = Math.round(deltaNet * vatPct * 100) / 100;
      const deltaGross = Math.round((deltaNet + deltaVat) * 100) / 100;

      return {
        deltaNet,
        deltaVat,
        deltaGross,
        modifiedCount: correctedInvoices.length,
        sumOrigNet,
        sumOrigGross,
      };
    }

    // W korekcie wartościowej (TypKorekty: 1)
    let deltaNet = 0;
    let deltaVat = 0;
    let deltaGross = 0;
    let modifiedCount = 0;

    items.forEach((it) => {
      if (it.isModified) {
        deltaNet += it.netDelta;
        deltaVat += it.vatDelta;
        deltaGross += it.grossDelta;
        modifiedCount++;
      }
    });

    return {
      deltaNet: Math.round(deltaNet * 100) / 100,
      deltaVat: Math.round(deltaVat * 100) / 100,
      deltaGross: Math.round(deltaGross * 100) / 100,
      modifiedCount,
      sumOrigNet: 0,
      sumOrigGross: 0,
    };
  }, [items, typKorekty, correctedInvoices, discountType, discountPercent, discountAmountNet, discountVatRate]);

  // Walidacja formatu numeru KSeF (35-36 znaków z myślnikami)
  const isKsefNumberValid = useMemo(() => {
    if (!hasOriginalKsefNumber) return true;
    const clean = originalKsefNumber.trim();
    return clean.length >= 30 && clean.length <= 38;
  }, [hasOriginalKsefNumber, originalKsefNumber]);

  // Generowanie XML korekty
  const handleGenerateCorrectionXml = async () => {
    const bulkDiscountConfig =
      typKorekty === '3'
        ? {
            discountType,
            percentageValue: discountPercent,
            amountNetValue: discountAmountNet,
            vatRate: discountVatRate,
            calculatedNetDelta: totals.deltaNet,
            calculatedVatDelta: totals.deltaVat,
            calculatedGrossDelta: totals.deltaGross,
            discountDescription:
              discountDescription ||
              `Rabat potransakcyjny ${discountType === 'percentage' ? discountPercent + '%' : ''} za okres ${okresFaKorygowanej}`,
          }
        : undefined;

    const correctionData: KSeFCorrectionData = {
      correctionNumber,
      issueDate,
      issuePlace,
      originalInvoiceNumber,
      originalInvoiceDate,
      hasOriginalKsefNumber,
      originalKsefNumber: hasOriginalKsefNumber ? originalKsefNumber : undefined,
      correctedInvoices: typKorekty === '3' ? correctedInvoices : undefined,
      bulkDiscount: bulkDiscountConfig,
      reasonCategory,
      reasonDescription,
      typKorekty,
      correctionMode,
      okresFaKorygowanej: typKorekty === '3' ? okresFaKorygowanej : undefined,
      seller,
      buyer,
      thirdParty,
      items,
      currency: 'PLN',
      paymentMethod: 'przelew',
      dueDate,
      deliveryDate,
      orderNumber,
      orderDate,
    };

    const xml = generateKSeFCorrectionXML(correctionData);
    setGeneratedXml(xml);
    setXmlModalOpen(true);

    // Walidacja XSD FA(3)
    setIsValidatingXsd(true);
    try {
      const res = await validateXmlAgainstKSeFXsd(xml);
      setXsdResult(res);
    } catch (err: any) {
      setXsdResult({
        valid: false,
        schema: 'FA(3) wzór 13775, wersja 1-0E',
        checkedAt: new Date().toLocaleTimeString('pl-PL'),
        errors: [{ message: err.message || 'Błąd walidacji XSD', rawMessage: String(err) }],
        summary: 'Błąd podczas walidacji XSD.',
      });
    } finally {
      setIsValidatingXsd(false);
    }
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(generatedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadXml = () => {
    downloadKSeFXMLFile(generatedXml, correctionNumber, 'FA3');
  };

  // Zapisz korektę w historii
  const handleSaveCorrectionToHistory = async () => {
    let xml = generatedXml;
    if (!xml) {
      const bulkDiscountConfig =
        typKorekty === '3'
          ? {
              discountType,
              percentageValue: discountPercent,
              amountNetValue: discountAmountNet,
              vatRate: discountVatRate,
              calculatedNetDelta: totals.deltaNet,
              calculatedVatDelta: totals.deltaVat,
              calculatedGrossDelta: totals.deltaGross,
              discountDescription:
                discountDescription ||
                `Rabat potransakcyjny ${discountType === 'percentage' ? discountPercent + '%' : ''} za okres ${okresFaKorygowanej}`,
            }
          : undefined;

      xml = generateKSeFCorrectionXML({
        correctionNumber,
        issueDate,
        issuePlace,
        originalInvoiceNumber,
        originalInvoiceDate,
        hasOriginalKsefNumber,
        originalKsefNumber: hasOriginalKsefNumber ? originalKsefNumber : undefined,
        correctedInvoices: typKorekty === '3' ? correctedInvoices : undefined,
        bulkDiscount: bulkDiscountConfig,
        reasonCategory,
        reasonDescription,
        typKorekty,
        correctionMode,
        okresFaKorygowanej: typKorekty === '3' ? okresFaKorygowanej : undefined,
        seller,
        buyer,
        thirdParty,
        items,
        currency: 'PLN',
        paymentMethod: 'przelew',
        dueDate,
        deliveryDate,
        orderNumber,
        orderDate,
      });
    }

    const archivedOrder: ArchivedOrder = {
      id: `kor-${Date.now()}`,
      chain: (buyer.name?.includes('DR.MAX') || buyer.name?.includes('Dr. Max'))
        ? 'Dr. Max'
        : buyer.name?.includes('DOZ')
        ? 'DOZ'
        : buyer.name?.includes('SUPER-PHARM')
        ? 'Super-Pharm'
        : buyer.name?.includes('GEMINI')
        ? 'Gemini'
        : 'Inne',
      documentType: 'KOR',
      invoiceNumber: correctionNumber,
      orderNumber: `KOR DO ${originalInvoiceNumber}`,
      issueDate: issueDate,
      deliveryDate: issueDate,
      dueDate: dueDate,
      seller,
      buyer,
      thirdParty,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        gtin: it.gtin || '',
        unit: it.unit,
        quantity: it.correctedQuantity,
        netPrice: it.correctedNetPrice,
        vatRate: (it.vatRate as any) || '8%',
        batchNumber: it.batchNumber || '',
        expiryDate: it.expiryDate || '',
      })),
      itemsCount: items.length,
      totalNet: totals.deltaNet,
      totalVat: totals.deltaVat,
      totalGross: totals.deltaGross,
      currency: 'PLN',
      xmlContent: xml,
      isDelivered: true,
      deliveredAt: `${issueDate} (Korekta)`,
      notes: `Przyczyna korekty (${typKorekty === '1' ? 'Wartościowa' : typKorekty === '2' ? 'Formalna' : 'Zbiorcza'}): ${reasonCategory}. ${reasonDescription}. Korekta faktury ${originalInvoiceNumber}` +
        (hasOriginalKsefNumber && originalKsefNumber ? ` [KSeF: ${originalKsefNumber}]` : ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      correctionReason: `${reasonCategory}: ${reasonDescription}`,
      originalInvoiceNumber,
      originalInvoiceDate,
    };

    await saveArchivedOrder(archivedOrder);
    if (onSavedToHistory) onSavedToHistory(archivedOrder);

    setNotification(`💾 Korekta ${correctionNumber} została pomyślnie zapisana w Historii Zamówień Sieciowych!`);
    setTimeout(() => setNotification(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Powiadomienie systemowe */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-xs text-fuchsia-900 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-fuchsia-600 shrink-0" />
          <span className="font-medium">{notification}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* KROK 1: ŹRÓDŁO FAKTURY PIERWOTNEJ (PDF Z NUMEREM KSEF / XML / ARCHIWUM)*/}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Wczytaj Fakturę Pierwotną w PDF (z numerem KSeF) lub z Archiwum
              </h3>
              <p className="text-xs text-slate-500">
                Wgraj plik PDF otrzymany z KSeF/ERP – system automatycznie wyodrębni 35-znakowy numer KSeF, numer faktury, kontrahenta i pozycje.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Wgraj XML faktury</span>
              <input type="file" accept=".xml" className="hidden" onChange={handleXmlFileUpload} />
            </label>

            <button
              onClick={loadSampleCorrectionData}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Wzorzec testowy</span>
            </button>
          </div>
        </div>

        {/* PROMINENTNY BOKS DROPZONE DLA PLIKU PDF Z NUMEREM KSEF */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingPdf(true);
          }}
          onDragLeave={() => setIsDraggingPdf(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingPdf(false);
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
              handleMultiplePdfFiles(files);
            }
          }}
          onClick={() => pdfInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer mb-5 ${
            isDraggingPdf
              ? 'border-fuchsia-500 bg-fuchsia-50/80 scale-[1.01]'
              : 'border-fuchsia-200 hover:border-fuchsia-400 bg-gradient-to-b from-fuchsia-50/30 via-white to-pink-50/20 hover:bg-fuchsia-50/40'
          }`}
        >
          <input
            ref={pdfInputRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) handleMultiplePdfFiles(files);
              e.target.value = '';
            }}
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white flex items-center justify-center text-xl shadow-sm shadow-fuchsia-200">
              {isParsingPdf ? <RefreshCw className="w-6 h-6 animate-spin" /> : '📄'}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
                <span>Wgraj Fakturę Pierwotną w PDF (lub wiele faktur dla korekty zbiorczej)</span>
                <span className="text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-full border border-fuchsia-200">
                  Możesz zaznaczyć wiele plików PDF ✨
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                Przeciągnij i upuść tutaj plik PDF z fakturą (lub wiele faktur jednocześnie dla korekty zbiorczej). System automatycznie sczyta 35-znakowy identyfikator KSeF, dane kontrahentów i pozycje.
              </p>
            </div>
          </div>
        </div>

        {/* Szybki wybór z historii zamówień */}
        {archivedOrders && archivedOrders.length > 0 && (
          <div className="mb-4 p-3 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
            <div className="text-xs font-semibold text-fuchsia-950 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-600" />
              <span>Lub wybierz z Historii Zamówień Sieciowych:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {archivedOrders.slice(0, 5).map((ord) => (
                <button
                  key={ord.id}
                  onClick={() => loadFromArchivedOrder(ord)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    originalInvoiceNumber === ord.invoiceNumber
                      ? 'bg-fuchsia-600 text-white border-fuchsia-600 font-bold shadow-2xs'
                      : 'bg-white hover:bg-fuchsia-50 border-fuchsia-200 text-slate-700'
                  }`}
                >
                  <span className="font-bold">{ord.chain}</span> · {ord.invoiceNumber} ({ord.totalGross.toFixed(2)} zł)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* POWIĄZANIE Z FAKTURĄ PIERWOTNĄ - POLA WYMAGANE PRZEZ KSEF */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px] font-bold">
              Nr faktury pierwotnej (&lt;NrFaKorygowanej&gt;)
            </span>
            <input
              type="text"
              value={originalInvoiceNumber}
              onChange={(e) => setOriginalInvoiceNumber(e.target.value)}
              placeholder="np. 41/2026/KSEF"
              className="w-full mt-1 px-2.5 py-1.5 font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-fuchsia-500 font-mono"
            />
          </div>

          <div>
            <span className="text-slate-500 block text-[11px] font-bold">
              Data wystawienia pierwotnej (&lt;DataWystFaKorygowanej&gt;)
            </span>
            <input
              type="date"
              value={originalInvoiceDate}
              onChange={(e) => setOriginalInvoiceDate(e.target.value)}
              className="w-full mt-1 px-2.5 py-1.5 font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-fuchsia-500"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 text-[11px] font-bold flex items-center gap-1.5">
                <span>Numer KSeF pierwotnej (&lt;NrKSeFFaKorygowanej&gt;)</span>
                {hasOriginalKsefNumber && isKsefNumberValid && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                    ✓ Format KSeF (35 znaków)
                  </span>
                )}
              </span>

              <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasOriginalKsefNumber}
                  onChange={(e) => setHasOriginalKsefNumber(e.target.checked)}
                  className="rounded text-fuchsia-600 focus:ring-fuchsia-500"
                />
                <span>Posiada numer KSeF</span>
              </label>
            </div>

            {hasOriginalKsefNumber ? (
              <input
                type="text"
                placeholder="np. 5833446059-20260928-123456-ABCDEF-01 (35 znaków)"
                value={originalKsefNumber}
                onChange={(e) => setOriginalKsefNumber(e.target.value)}
                className={`w-full px-2.5 py-1.5 font-mono text-xs bg-white border rounded-lg focus:outline-fuchsia-500 ${
                  isKsefNumberValid ? 'border-emerald-300 text-slate-900 font-bold' : 'border-amber-300 text-amber-900'
                }`}
              />
            ) : (
              <div className="p-1.5 text-[11px] bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
                Faktura wystawiona poza KSeF – w pliku XML zostanie wygenerowany znacznik <strong className="font-mono">&lt;NrKSeFN&gt;1&lt;/NrKSeFN&gt;</strong>.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* KROK 2: WYBÓR CHARAKTERU BŁĘDU / TRYBU KOREKTY WG WYTYCZNYCH MF       */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Wybierz Rodzaj Błędu / Procedurę Korekty KSeF
            </h3>
            <p className="text-xs text-slate-500">
              Zgodnie z oficjalnymi wytycznymi Ministerstwa Finansów wybierz właściwy tryb korekty w strukturze FA(3).
            </p>
          </div>
        </div>

        {/* 4 KAFELKI TRYBU KOREKTY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* TRYB 1: BŁĄD WARTOŚCIOWY */}
          <button
            type="button"
            onClick={() => handleSelectCorrectionMode('value')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
              correctionMode === 'value'
                ? 'border-fuchsia-500 bg-fuchsia-50/80 shadow-xs'
                : 'border-slate-200 hover:border-fuchsia-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>🔵</span> 1. Błąd wartościowy
              </span>
              <span className="text-[10px] font-mono font-bold bg-fuchsia-100 text-fuchsia-800 px-1.5 py-0.2 rounded">
                TypKorekty: 1
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Zwrot towaru, zmiana ilości, zmiana ceny netto lub zmiana stawki VAT. Wykazuje kwoty różnicowe.
            </p>
          </button>

          {/* TRYB 2: BŁĄD FORMALNY */}
          <button
            type="button"
            onClick={() => handleSelectCorrectionMode('formal')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
              correctionMode === 'formal'
                ? 'border-amber-500 bg-amber-50/80 shadow-xs'
                : 'border-slate-200 hover:border-amber-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>🟡</span> 2. Błąd formalny
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                TypKorekty: 2
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Literówka w nazwie, błędny adres bez wpływu na kwoty. Sekcje finansowe i podsumowania VAT wynoszą 0 PLN.
            </p>
          </button>

          {/* TRYB 3: BŁĘDNY NIP NABYWCY - PROCEDURA DO ZERA */}
          <button
            type="button"
            onClick={() => handleSelectCorrectionMode('zero_nip')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
              correctionMode === 'zero_nip'
                ? 'border-rose-500 bg-rose-50/90 shadow-xs'
                : 'border-slate-200 hover:border-rose-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                <span>🔴</span> 3. Błędny NIP (do zera)
              </span>
              <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">
                Wyzerowanie 0
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Wymóg KSeF: wyzerowanie do zera całej faktury z błędnym NIP-em, a następnie wystawienie nowej faktury pierwotnej.
            </p>
          </button>

          {/* TRYB 4: KOREKTA ZBIORCZA */}
          <button
            type="button"
            onClick={() => handleSelectCorrectionMode('period_bulk')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
              correctionMode === 'period_bulk'
                ? 'border-purple-500 bg-purple-50/80 shadow-xs'
                : 'border-slate-200 hover:border-purple-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>🟣</span> 4. Korekta zbiorcza
              </span>
              <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded">
                TypKorekty: 3
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Udzielenie rabatu okresowego (np. kwartalnego/rocznego) z oznaczeniem &lt;OkresFaKorygowanej&gt;.
            </p>
          </button>
        </div>

        {/* OSTRZEŻENIE PROCEDURY DLA BŁĘDNEGO NIP */}
        {correctionMode === 'zero_nip' && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Oficjalna procedura KSeF dla błędnego NIP nabywcy:</strong>
              <span className="text-[11px] text-rose-800 leading-relaxed block mt-0.5">
                Zgodnie z wytycznymi Ministerstwa Finansów nie wolno zmienić samego NIP-u zwykłą korektą. Wygeneruj ten plik XML, który wyzeruje całą wartość faktury pierwotnej do 0 na błędny NIP. Następnie w module &quot;1. WYSTAW FAKTURĘ XML&quot; wystaw zupełnie nową fakturę pierwotną z prawidłowym NIP-em.
              </span>
            </div>
          </div>
        )}

        {/* FORMULARZ DANYCH KOREKTY */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Numer faktury korygującej (&lt;P_2&gt;):
            </label>
            <input
              type="text"
              value={correctionNumber}
              onChange={(e) => setCorrectionNumber(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-fuchsia-900 focus:outline-fuchsia-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Data wystawienia korekty (&lt;P_1&gt;):
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-fuchsia-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Typ skutku w VAT (&lt;TypKorekty&gt;):
            </label>
            <select
              value={typKorekty}
              onChange={(e) => setTypKorekty(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-fuchsia-500"
            >
              <option value="1">1 – Korekta pozycji faktury (ilość, cena, stawka VAT)</option>
              <option value="2">2 – Korekta danych podatnika / formalna (kwoty = 0 PLN)</option>
              <option value="3">3 – Korekta zbiorcza za dany okres</option>
            </select>
          </div>
        </div>

        {/* POLA PRZYCZYNY I OKRESU */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Kategoria przyczyny korekty:
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-fuchsia-500"
            >
              {COMMON_CORRECTION_REASONS.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Uzasadnienie tekstowe (&lt;PrzyczynaKorekty&gt;):
            </label>
            <input
              type="text"
              value={reasonDescription}
              onChange={(e) => setReasonDescription(e.target.value)}
              placeholder="np. Zwrot 2 sztuk towaru z powodu uszkodzenia w transporcie"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-fuchsia-500"
            />
          </div>
        </div>

        {/* ===================================================================== */}
        {/* PANEL DEDYKOWANY: WSKAŻ ELEMENTY PODLEGAJĄCE KOREKCIE FORMALNEJ       */}
        {/* ===================================================================== */}
        {(typKorekty === '2' || correctionMode === 'formal') && (
          <div className="mt-5 p-5 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 rounded-2xl border-2 border-amber-300 shadow-xs animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🟡</span>
                <h4 className="text-sm font-bold text-amber-950">
                  Wskaż, której części faktury pierwotnej dotyczy błąd formalny:
                </h4>
              </div>
              <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                Wymóg KSeF: TypKorekty = 2
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Zaznacz pola, w których wystąpił błąd (np. literówka w nazwie, zmiana adresu lub zły numer zamówienia). Poniżej wpisz właściwą wartość – system automatycznie zaktualizuje dane Nabywcy i sformułuje uzasadnienie w XML.
            </p>

            {/* KAFELKI / CHECKBOXY WYBORU CZĘŚCI FAKTURY */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {(Object.keys(formalFields) as FormalCorrectionField[]).map((key) => {
                const item = formalFields[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFormalFieldActive(key)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between text-xs font-semibold ${
                      item.active
                        ? 'bg-amber-100/90 border-amber-400 text-amber-950 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                    }`}
                  >
                    <span className="truncate pr-1">{item.name}</span>
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold ${
                        item.active ? 'bg-amber-600 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {item.active && '✓'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* KARTY EDYCJI DLA AKTYWNYCH PÓL FORMALNYCH */}
            <div className="space-y-3">
              {(Object.keys(formalFields) as FormalCorrectionField[])
                .filter((key) => formalFields[key].active)
                .map((key) => {
                  const item = formalFields[key];
                  return (
                    <div
                      key={key}
                      className="p-3.5 bg-white rounded-xl border border-amber-200 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                      {/* LEWA KOLUMNA: STAN PIERWOTNY */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="text-[10px] font-bold text-rose-700 uppercase mb-1 flex items-center gap-1">
                          <span>🔴</span> Stan pierwotny na fakturze (Było):
                        </div>
                        <div className="font-semibold text-slate-800 break-words">
                          {item.origValue || '<brak danych w fakturze>'}
                        </div>
                      </div>

                      {/* PRAWA KOLUMNA: WŁAŚCIWA WARTOŚĆ PO KOREKCIE */}
                      <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-300 text-xs">
                        <label className="text-[10px] font-bold text-emerald-800 uppercase mb-1 flex items-center gap-1">
                          <span>🟢</span> Właściwa wartość po korekcie (Powinno być):
                        </label>
                        <input
                          type="text"
                          value={item.corrValue}
                          onChange={(e) => updateFormalField(key, e.target.value)}
                          placeholder={`Wpisz poprawną wartość dla ${item.name}...`}
                          className="w-full mt-1 px-2.5 py-1.5 font-bold text-slate-900 bg-white border border-emerald-400 rounded-lg focus:outline-emerald-600"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-3.5 p-3 rounded-xl bg-amber-100/60 text-amber-900 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Zasada KSeF dla korekt formalnych:</strong> Sekcje finansowe (<code className="font-mono">P_13</code>, <code className="font-mono">P_14</code>, <code className="font-mono">P_15</code>) wynoszą ściśle <strong>0.00 PLN</strong>, dzięki czemu korekta nie zmienia kwot w ewidencji JPK_V7. Właściwe dane opisowe zostaną umieszczone w nagłówku i sekcji Nabywcy.
              </span>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PANEL DEDYKOWANY: KOREKTA ZBIORCZA & RABAT NA WSZYSTKICH FAKTURACH     */}
        {/* ===================================================================== */}
        {(typKorekty === '3' || correctionMode === 'period_bulk') && (
          <div className="mt-5 p-5 bg-gradient-to-br from-purple-50/70 via-white to-fuchsia-50/40 rounded-2xl border-2 border-purple-300 shadow-xs animate-in fade-in space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🟣</span>
                  <h4 className="text-sm font-bold text-purple-950">
                    Korekta Zbiorcza: Lista faktur objętych rabatem & Konfiguracja upustu
                  </h4>
                  <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                    TypKorekty = 3 (art. 106j ust. 3)
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Wgraj wiele faktur PDF z danego okresu i określ wysokość rabatu, który ma zostać udzielony na wszystkich.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={bulkPdfInputRef}
                  type="file"
                  multiple
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleMultiplePdfFiles(files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => bulkPdfInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Wgraj kolejne faktury PDF</span>
                </button>
              </div>
            </div>

            {/* TABELA WGRANYCH FAKTUR W KOREKCIE ZBIORCZEJ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span>Faktury korygowane ({correctedInvoices.length}):</span>
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Wszystkie te faktury pojawią się w węzłach &lt;DaneFaKorygowanej&gt;
                </span>
              </div>

              <div className="overflow-x-auto border border-purple-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-purple-50/70 border-b border-purple-200 text-[11px] font-bold text-purple-950 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Lp.</th>
                      <th className="py-2.5 px-3">Numer Faktury (&lt;NrFaKorygowanej&gt;)</th>
                      <th className="py-2.5 px-3">Data wystawienia</th>
                      <th className="py-2.5 px-3">Identyfikator KSeF (&lt;NrKSeF&gt;)</th>
                      <th className="py-2.5 px-3 text-right">Wartość Netto</th>
                      <th className="py-2.5 px-3 text-right">Wartość Brutto</th>
                      <th className="py-2.5 px-3 text-center">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {correctedInvoices.map((inv, idx) => (
                      <tr key={inv.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{inv.invoiceDate}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {inv.hasKsefNumber && inv.ksefNumber ? (
                            <span className="text-emerald-800 font-semibold flex items-center gap-1">
                              <span>✓</span> {inv.ksefNumber}
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Brak KSeF (&lt;NrKSeFN&gt;1)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                          {inv.netTotal.toFixed(2)} zł
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {inv.grossTotal.toFixed(2)} zł
                        </td>
                        <td className="py-2 px-3 text-center">
                          {correctedInvoices.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCorrectedInvoice(inv.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                              title="Usuń z listy"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-100/50 font-bold text-xs border-t border-purple-200 text-purple-950">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-right">ŁĄCZNA WARTOŚĆ FAKTUR PIERWOTNYCH:</td>
                      <td className="py-2 px-3 text-right font-mono">{totals.sumOrigNet?.toFixed(2)} zł</td>
                      <td className="py-2 px-3 text-right font-mono">{totals.sumOrigGross?.toFixed(2)} zł</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* OKRES FAKTURY KORYGOWANEJ */}
            <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200 text-xs">
              <label className="block font-bold text-purple-900 mb-1">
                Okres faktury korygowanej (&lt;OkresFaKorygowanej&gt;):
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  value={okresFaKorygowanej}
                  onChange={(e) => setOkresFaKorygowanej(e.target.value)}
                  placeholder="np. 01.09.2026 - 30.09.2026"
                  className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg font-mono text-purple-950 focus:outline-purple-500 font-bold"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOkresFaKorygowanej('01.09.2026 - 30.09.2026')}
                    className="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-md text-[11px] font-semibold text-purple-800"
                  >
                    Wrzesień 2026
                  </button>
                  <button
                    type="button"
                    onClick={() => setOkresFaKorygowanej('01.07.2026 - 30.09.2026')}
                    className="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-md text-[11px] font-semibold text-purple-800"
                  >
                    III kwartał 2026
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-purple-700 mt-1 block">
                Zgodnie z art. 106j ust. 3 ustawy o VAT pole to określa przedział czasowy, za który udzielono rabatu.
              </span>
            </div>

            {/* SEKCJA UDZIELENIA RABATU NA WSZYSTKICH FAKTURACH */}
            <div className="p-4 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-purple-600" />
                <h5 className="text-xs font-bold text-slate-900 uppercase">
                  Wysokość rabatu udzielonego na wszystkich załączonych fakturach:
                </h5>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* WYBÓR TYPU I WARTOŚCI RABATU */}
                <div>
                  <div className="flex items-center gap-3 mb-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="radio"
                        name="discountType"
                        checked={discountType === 'percentage'}
                        onChange={() => setDiscountType('percentage')}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span>Rabat procentowy (%)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="radio"
                        name="discountType"
                        checked={discountType === 'amount'}
                        onChange={() => setDiscountType('amount')}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span>Rabat kwotowy netto (PLN)</span>
                    </label>
                  </div>

                  {discountType === 'percentage' ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {[2, 3, 5, 10, 15].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDiscountPercent(pct)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              discountPercent === pct
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 font-medium">Inny procent:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2.5 py-1 text-xs font-bold text-purple-950 bg-white border border-purple-300 rounded-lg focus:outline-purple-500"
                        />
                        <span className="text-xs font-bold text-slate-700">%</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs text-slate-600 font-medium block mb-1">Kwota upustu netto:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="10"
                          min="1"
                          value={discountAmountNet}
                          onChange={(e) => setDiscountAmountNet(parseFloat(e.target.value) || 0)}
                          className="w-36 px-2.5 py-1 text-xs font-bold text-purple-950 bg-white border border-purple-300 rounded-lg focus:outline-purple-500"
                        />
                        <span className="text-xs font-bold text-slate-700">PLN netto</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="text-slate-600 font-medium">Stawka VAT rabatu:</span>
                    <select
                      value={discountVatRate}
                      onChange={(e) => setDiscountVatRate(e.target.value as any)}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                    >
                      <option value="8%">8% (Standard dla OMNi-BiOTiC)</option>
                      <option value="23%">23%</option>
                    </select>
                  </div>
                </div>

                {/* PODSUMOWANIE KWOTOWE RABATU */}
                <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 text-xs space-y-2">
                  <div className="font-bold text-purple-950 text-xs border-b border-purple-200 pb-1.5 flex items-center justify-between">
                    <span>Podsumowanie udzielonego rabatu:</span>
                    <span className="text-[10px] bg-purple-200 px-1.5 py-0.2 rounded font-extrabold text-purple-900">
                      Różnica w XML
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Rabat Netto (&lt;P_13&gt;):</span>
                    <span className="font-mono font-bold text-rose-700">{totals.deltaNet.toFixed(2)} PLN</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">VAT od rabatu (&lt;P_14&gt;):</span>
                    <span className="font-mono font-bold text-rose-700">{totals.deltaVat.toFixed(2)} PLN</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-purple-200 font-bold text-sm">
                    <span className="text-purple-950">Łącznie Brutto do zwrotu (&lt;P_15&gt;):</span>
                    <span className="font-mono font-black text-rose-700">{totals.deltaGross.toFixed(2)} PLN</span>
                  </div>
                </div>
              </div>

              {/* OPIS POZYCJI RABATOWEJ W XML */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Opis pozycji rabatowej na korekcie (&lt;P_7&gt; w XML):
                </label>
                <input
                  type="text"
                  value={discountDescription}
                  onChange={(e) => setDiscountDescription(e.target.value)}
                  placeholder="np. Rabat potransakcyjny za zrealizowany obrót w okresie..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-purple-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* KROK 3: POZYCJE KORYGOWANE (STAN PRZED VS STAN PO KOREKCIE)           */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pozycje Towarowe: Stan Przed Korektą vs Nowy Stan Po Korekcie
              </h3>
              <p className="text-xs text-slate-500">
                {typKorekty === '3'
                  ? 'W trybie korekty zbiorczej (TypKorekty: 3) w XML generowana jest zbiorcza pozycja rabatu upustowego dla całości obrotu.'
                  : typKorekty === '2'
                  ? 'W trybie błędu formalnego pozycje są wykazywane ze statusem formalnym, a sumy podatkowe wynoszą 0 PLN.'
                  : 'Wskaż nową ilość lub cenę. W pliku KSeF zostaną wykazane wiersze ze stanem przed (<StanPrzed>1</StanPrzed>) i nowym.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {correctionMode !== 'zero_nip' && typKorekty === '1' && (
              <button
                type="button"
                onClick={handleZeroOutAllItems}
                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                title="Procedura do zera: ustawia ilość = 0 dla wszystkich pozycji"
              >
                Wyzeruj całość do 0
              </button>
            )}
            <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
              Zmodyfikowano pozycji: <strong className="text-fuchsia-900">{totals.modifiedCount}</strong> z {items.length}
            </div>
          </div>
        </div>

        {/* POZYCJE DLA KOREKTY ZBIORCZEJ */}
        {typKorekty === '3' ? (
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 mb-2 font-bold text-purple-950">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Pozycja upustowa w pliku XML (&lt;FaWiersz&gt;):</span>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-purple-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs shadow-2xs">
              <div className="md:col-span-2">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Nazwa usługi rabatowej (P_7):</span>
                <span className="font-bold text-slate-900">{discountDescription || `Rabat potransakcyjny za okres ${okresFaKorygowanej}`}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Różnica Netto (P_11):</span>
                <span className="font-mono font-bold text-rose-700">{totals.deltaNet.toFixed(2)} PLN</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Stawka VAT (P_12):</span>
                <span className="font-mono font-bold text-slate-900">{discountVatRate}</span>
              </div>
            </div>
            <p className="text-[11px] text-purple-800 mt-2">
              Zgodnie z art. 106j ust. 3 ustawy o VAT oraz schematem FA(3) w pliku XML zostanie wygenerowana pojedyncza zbiorcza pozycja rabatowa odniesiona do łącznego wolumenu załączonych faktur.
            </p>
          </div>
        ) : typKorekty === '2' ? (
          /* POZYCJE DLA KOREKTY FORMALNEJ */
          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-950 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Info className="w-4 h-4 text-amber-700" />
              <span>Brak pozycji towarowych w korekcie formalnej</span>
            </div>
            <p className="text-[11px] text-slate-600">
              W strukturze logicznej FA(3) przy korekcie danych formalnych (TypKorekty: 2) sekcja pozycji nie zawiera zmian ilości ani cen. Kwoty różnicowe w rejestrze VAT wynoszą 0.00 PLN.
            </p>
          </div>
        ) : (
          /* STANDARDOWA TABELA POZYCJI DLA TYPKOREKTY: 1 */
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Lp.</th>
                  <th className="py-2.5 px-3">Nazwa Produktu & GTIN</th>
                  <th className="py-2.5 px-3 text-center bg-slate-100/70 border-x border-slate-200">
                    Stan Przed (FV Pierwotna)
                  </th>
                  <th className="py-2.5 px-3 text-center bg-fuchsia-50/70 border-r border-fuchsia-200">
                    Nowy Stan Po Korekcie
                  </th>
                  <th className="py-2.5 px-3 text-right">Różnica (Korekta)</th>
                  <th className="py-2.5 px-3 text-center">Szybkie akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it, idx) => (
                  <tr
                    key={it.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      it.isModified ? 'bg-fuchsia-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-mono text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-bold text-slate-900">{it.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        {it.gtin && <span>GTIN: {it.gtin}</span>}
                        <span>VAT: {it.vatRate}</span>
                        {it.batchNumber && <span>Seria: {it.batchNumber}</span>}
                      </div>
                    </td>

                    {/* STAN PRZED */}
                    <td className="py-3 px-3 bg-slate-50/50 border-x border-slate-200 text-center">
                      <div className="font-semibold text-slate-800">
                        {it.originalQuantity} {it.unit} × {it.originalNetPrice.toFixed(2)} zł
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Netto: {it.originalNetTotal.toFixed(2)} zł | Brutto: {it.originalGrossTotal.toFixed(2)} zł
                      </div>
                    </td>

                    {/* NOWY STAN PO KOREKCIE */}
                    <td className="py-3 px-3 bg-fuchsia-50/30 border-r border-fuchsia-200">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500 font-medium">Ilość:</span>
                          <input
                            type="number"
                            min="0"
                            value={it.correctedQuantity}
                            onChange={(e) => handleUpdateItemQuantity(it.id, parseFloat(e.target.value) || 0)}
                            className={`w-16 px-2 py-1 text-center font-bold text-xs rounded-lg border focus:outline-fuchsia-500 ${
                              it.quantityDelta !== 0
                                ? 'border-fuchsia-400 bg-fuchsia-50/60 text-fuchsia-950 font-bold'
                                : 'border-slate-300 bg-white'
                            }`}
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500 font-medium">Cena:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.correctedNetPrice}
                            onChange={(e) => handleUpdateItemPrice(it.id, parseFloat(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border focus:outline-fuchsia-500 ${
                              it.originalNetPrice !== it.correctedNetPrice
                                ? 'border-fuchsia-400 bg-fuchsia-50/60 text-fuchsia-950 font-bold'
                                : 'border-slate-300 bg-white'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-center text-slate-600 font-mono mt-1">
                        Nowe brutto: <strong>{it.correctedGrossTotal.toFixed(2)} zł</strong>
                      </div>
                    </td>

                    {/* RÓŻNICA */}
                    <td className="py-3 px-3 text-right">
                      {it.isModified ? (
                        <div>
                          <div
                            className={`font-black text-xs ${
                              it.grossDelta < 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {it.grossDelta > 0 ? `+${it.grossDelta.toFixed(2)}` : it.grossDelta.toFixed(2)} zł brutto
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Δ Ilość: {it.quantityDelta > 0 ? `+${it.quantityDelta}` : it.quantityDelta} {it.unit}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Δ Netto: {it.netDelta > 0 ? `+${it.netDelta.toFixed(2)}` : it.netDelta.toFixed(2)} zł
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Bez zmian</span>
                      )}
                    </td>

                    {/* SZYBKIE AKCJE */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleApplyQuickReturn(it.id, 1)}
                          className="px-2 py-1 text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                          title="Zwróć 1 sztukę"
                        >
                          -1 szt.
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyQuickReturn(it.id, 2)}
                          className="px-2 py-1 text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                          title="Zwróć 2 sztuki"
                        >
                          -2 szt.
                        </button>
                        {it.isModified && (
                          <button
                            type="button"
                            onClick={() => handleResetItem(it.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Cofnij zmiany w tej pozycji"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FINANSOWE PODSUMOWANIE KOREKTY */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-fuchsia-50/80 via-pink-50/60 to-rose-50/40 border border-fuchsia-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-fuchsia-950 flex items-center gap-1.5">
              <span>📊 ŁĄCZNA KWOTA ROZLICZENIA KOREKTY:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-fuchsia-200 text-fuchsia-900">
                FA(3) KOR
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {typKorekty === '2'
                ? 'Korekta formalna – podsumowania finansowe wynoszą 0 PLN zgodnie z wymogami KSeF.'
                : 'Wartość różnicowa do zwrotu nabywcy lub skorygowania salda rozrachunków.'}
            </p>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                Różnica Netto (Δ P_13):
              </span>
              <span
                className={`text-sm font-bold font-mono ${
                  totals.deltaNet < 0 ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {totals.deltaNet.toFixed(2)} PLN
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                Różnica VAT (Δ P_14):
              </span>
              <span
                className={`text-sm font-bold font-mono ${
                  totals.deltaVat < 0 ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {totals.deltaVat.toFixed(2)} PLN
              </span>
            </div>

            <div className="pl-4 border-l border-fuchsia-200">
              <span className="text-[10px] text-fuchsia-900 uppercase block font-extrabold">
                Do zwrotu / Brutto (P_15):
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  totals.deltaGross < 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {totals.deltaGross.toFixed(2)} PLN
              </span>
            </div>
          </div>
        </div>

        {/* Pasek akcji głównych */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={handleSaveCorrectionToHistory}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fuchsia-800 bg-fuchsia-100 hover:bg-fuchsia-200 border border-fuchsia-300 rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.01]"
          >
            <span>💾 Zapisz w Historii Zamówień</span>
          </button>

          <button
            onClick={handleGenerateCorrectionXml}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-700 hover:to-pink-700 rounded-xl shadow-sm shadow-fuchsia-300 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileCode className="w-4 h-4" />
            <span>🌸 Generuj KSeF XML Korekty (FA3 UTF-8)</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL PODGLĄDU I POBRANIA XML KOREKTY                                 */}
      {/* ===================================================================== */}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Nagłówek modala */}
            <div className="px-6 py-4 border-b border-fuchsia-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-fuchsia-50/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>E-Korekta Faktury KSeF XML: {correctionNumber}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 font-bold">
                      FA(3) Rodzaj: KOR
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Korekta faktury: {originalInvoiceNumber} z dnia {originalInvoiceDate}
                    {hasOriginalKsefNumber && originalKsefNumber ? ` · Nr KSeF: ${originalKsefNumber}` : ' (brak nr KSeF)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyXml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Skopiowano' : 'Kopiuj XML'}</span>
                </button>
                <button
                  onClick={handleDownloadXml}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-700 hover:to-pink-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz KSeF KOR XML (UTF-8)</span>
                </button>
                <button
                  onClick={() => setXmlModalOpen(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Wynik walidacji XSD */}
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
              {isValidatingXsd ? (
                <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Trwa walidacja XML korekty w silniku xmllint-wasm (schemat FA(3) 13775)...</span>
                </div>
              ) : xsdResult ? (
                <div className="flex items-center justify-between">
                  {xsdResult.valid ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-lg">
                      <span>🟢 XML KOREKTY W 100% POPRAWNY</span>
                      <span className="font-normal text-emerald-700">· Zgodny ze schematem FA(3) KOR</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-800 bg-red-100 border border-red-300 px-3 py-1 rounded-lg">
                      <span>🔴 Błędy walidacji XSD ({xsdResult.errors.length})</span>
                    </div>
                  )}
                  <span className="text-[11px] text-slate-500 font-mono">
                    Wzór 13775 wersja 1-0E · MF KSeF
                  </span>
                </div>
              ) : null}
            </div>

            {/* Treść XML */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200 select-text">
              <pre className="whitespace-pre overflow-x-auto leading-relaxed">
                <code>{generatedXml}</code>
              </pre>
            </div>

            {/* Stopka modala */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <button
                onClick={handleSaveCorrectionToHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-fuchsia-800 bg-fuchsia-100 hover:bg-fuchsia-200 border border-fuchsia-300 rounded-lg cursor-pointer"
              >
                <span>💾 Zapisz również w Historii Zamówień</span>
              </button>
              <button
                onClick={() => setXmlModalOpen(false)}
                className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
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
