import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { EntityDetails, ThirdPartyEntity, InvoiceItem } from '../types/ksef';
import { CorrectionItem, KSeFCorrectionData, COMMON_CORRECTION_REASONS } from '../types/correction';
import { ArchivedOrder } from '../types/ordersHistory';
import { DEFAULT_SELLER, PHARMACY_CHAINS } from '../utils/sampleData';
import { generateKSeFCorrectionXML } from '../utils/ksefCorrectionGenerator';
import { parseKSeFXMLString, convertInvoiceItemsToCorrectionItems } from '../utils/ksefXmlParser';
import { validateXmlAgainstKSeFXsd, XsdValidationResult } from '../utils/ksefXsdValidator';
import { downloadKSeFXMLFile } from '../utils/ksefGenerator';
import { saveArchivedOrder } from '../utils/ordersStorage';

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

  // Strony transakcji
  const [seller, setSeller] = useState<EntityDetails>(DEFAULT_SELLER);
  const [buyer, setBuyer] = useState<EntityDetails>(PHARMACY_CHAINS['Dr. Max'].buyer);
  const [thirdParty, setThirdParty] = useState<ThirdPartyEntity | null>(null);

  // Dane faktury korygowanej
  const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState<string>('41/2026/KSEF');
  const [originalInvoiceDate, setOriginalInvoiceDate] = useState<string>('2026-09-28');
  const [hasOriginalKsefNumber, setHasOriginalKsefNumber] = useState<boolean>(false);
  const [originalKsefNumber, setOriginalKsefNumber] = useState<string>('');

  // Dane bieżącej korekty
  const [correctionNumber, setCorrectionNumber] = useState<string>('KOR-01/10/2026');
  const [issueDate, setIssueDate] = useState<string>(today);
  const [issuePlace, setIssuePlace] = useState<string>('Gdańsk');
  const [dueDate, setDueDate] = useState<string>(today);
  const [reasonCategory, setReasonCategory] = useState<string>(COMMON_CORRECTION_REASONS[0]);
  const [reasonDescription, setReasonDescription] = useState<string>(
    'Zwrot 2 sztuk towaru z powodu uszkodzenia opakowania w transporcie'
  );
  const [typKorekty, setTypKorekty] = useState<'1' | '2' | '3'>('2'); // domyślnie in minus

  // Pozycje korygowane
  const [items, setItems] = useState<CorrectionItem[]>([]);

  // Stan UI
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
    // Domyślnie zróbmy drobną modyfikację w pierwszej pozycji (np. zwrot 2 sztuk: z 10 na 8)
    corrItems[0].correctedQuantity = 8;
    recalculateItemDeltas(corrItems[0]);

    setItems(corrItems);
    setOriginalInvoiceNumber('41/2026/KSEF');
    setOriginalInvoiceDate('2026-09-28');
    setBuyer(PHARMACY_CHAINS['Dr. Max'].buyer);
  };

  const loadFromArchivedOrder = (order: ArchivedOrder) => {
    setOriginalInvoiceNumber(order.invoiceNumber);
    setOriginalInvoiceDate(order.issueDate);
    setBuyer(order.buyer);
    setThirdParty(order.thirdParty || null);
    setSeller(order.seller || DEFAULT_SELLER);
    setCorrectionNumber(`KOR-${order.invoiceNumber.replace('/KSEF', '')}`);

    if (order.items && order.items.length > 0) {
      const corrItems = convertInvoiceItemsToCorrectionItems(order.items);
      setItems(corrItems);
    }

    setNotification(`Pomyślnie załadowano fakturę pierwotną ${order.invoiceNumber} (${order.chain}).`);
    setTimeout(() => setNotification(null), 5000);
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
    };
  }, [items]);

  // Generowanie XML korekty
  const handleGenerateCorrectionXml = async () => {
    const correctionData: KSeFCorrectionData = {
      correctionNumber,
      issueDate,
      issuePlace,
      originalInvoiceNumber,
      originalInvoiceDate,
      hasOriginalKsefNumber,
      originalKsefNumber,
      reasonCategory,
      reasonDescription,
      typKorekty,
      seller,
      buyer,
      thirdParty,
      items,
      currency: 'PLN',
      paymentMethod: 'przelew',
      dueDate,
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
      xml = generateKSeFCorrectionXML({
        correctionNumber,
        issueDate,
        issuePlace,
        originalInvoiceNumber,
        originalInvoiceDate,
        hasOriginalKsefNumber,
        originalKsefNumber,
        reasonCategory,
        reasonDescription,
        typKorekty,
        seller,
        buyer,
        thirdParty,
        items,
        currency: 'PLN',
        paymentMethod: 'przelew',
        dueDate,
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
      notes: `Przyczyna korekty: ${reasonCategory}. ${reasonDescription}. Korekta faktury ${originalInvoiceNumber}.`,
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
      {/* Powiadomienie */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-xs text-fuchsia-900 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-fuchsia-600 shrink-0" />
          <span className="font-medium">{notification}</span>
        </div>
      )}

      {/* KROK A: ŹRÓDŁO FAKTURY PIERWOTNEJ */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Wybór Faktury Pierwotnej do Skorygowania
              </h3>
              <p className="text-xs text-slate-500">
                Możesz wybrać wystawioną wcześniej fakturę z archiwum, wgrać jej plik XML lub wpisać dane ręcznie.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Wgraj XML faktury pierwotnej</span>
              <input
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleXmlFileUpload}
              />
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

        {/* Szybki wybór z historii zamówień */}
        {archivedOrders && archivedOrders.length > 0 && (
          <div className="mb-4 p-3 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
            <div className="text-xs font-semibold text-fuchsia-950 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-600" />
              <span>Szybki wybór z Historii Zamówień Sieciowych:</span>
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
                  <span className="font-bold">{ord.chain}</span> · {ord.invoiceNumber} (
                  {ord.totalGross.toFixed(2)} zł)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Podsumowanie powiązania korygowanej faktury */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Nr faktury pierwotnej (P_2)</span>
            <input
              type="text"
              value={originalInvoiceNumber}
              onChange={(e) => setOriginalInvoiceNumber(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1 font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-fuchsia-500"
            />
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Data wystawienia pierwotnej (P_1)</span>
            <input
              type="date"
              value={originalInvoiceDate}
              onChange={(e) => setOriginalInvoiceDate(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1 font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-fuchsia-500"
            />
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Nabywca (Podmiot2)</span>
            <div className="mt-1 font-semibold text-slate-800 truncate" title={buyer.name}>
              {buyer.name}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">NIP: {buyer.nip}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Numer KSeF pierwotnej</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="checkbox"
                id="hasKsef"
                checked={hasOriginalKsefNumber}
                onChange={(e) => setHasOriginalKsefNumber(e.target.checked)}
                className="rounded text-fuchsia-600 focus:ring-fuchsia-500"
              />
              <label htmlFor="hasKsef" className="text-[11px] text-slate-700 cursor-pointer">
                Posiada nr KSeF
              </label>
            </div>
            {hasOriginalKsefNumber && (
              <input
                type="text"
                placeholder="np. 5833446059-20260928-..."
                value={originalKsefNumber}
                onChange={(e) => setOriginalKsefNumber(e.target.value)}
                className="w-full mt-1 px-2 py-0.5 font-mono text-[11px] bg-white border border-slate-300 rounded-lg focus:outline-fuchsia-500"
              />
            )}
          </div>
        </div>
      </div>

      {/* KROK B: METADANE KOREKTY & PRZYCZYNA */}
      <div className="bg-white rounded-2xl border border-fuchsia-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Dane Faktury Korygującej & Przyczyna Korekty (KSeF)
            </h3>
            <p className="text-xs text-slate-500">
              Wskaż oficjalny numer korekty, datę wystawienia oraz uzasadnienie dla Urzędu Skarbowego i kontrahenta.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Numer faktury korygującej:
            </label>
            <input
              type="text"
              value={correctionNumber}
              onChange={(e) => setCorrectionNumber(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-fuchsia-900 focus:outline-fuchsia-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Data wystawienia korekty:
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
              Typ skutku w VAT (KSeF TypKorekty):
            </label>
            <select
              value={typKorekty}
              onChange={(e) => setTypKorekty(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-fuchsia-500"
            >
              <option value="2">2 – Korekta in minus (zwrot / rabat / obniżka)</option>
              <option value="1">1 – Korekta in plus (dopłata / podwyższenie)</option>
              <option value="3">3 – Bez wpływu na podatek VAT</option>
            </select>
          </div>
        </div>

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
              Szczegółowe uzasadnienie korekty (&lt;PrzyczynaKorekty&gt;):
            </label>
            <input
              type="text"
              value={reasonDescription}
              onChange={(e) => setReasonDescription(e.target.value)}
              placeholder="np. Zwrot 2 sztuk towaru z powodu reklamacji jakościowej"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-fuchsia-500"
            />
          </div>
        </div>
      </div>

      {/* KROK C: POZYCJE KORYGOWANE (TABELA PRZED / PO / RÓŻNICA) */}
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
                Wskaż nową ilość lub cenę dla pozycji podlegających zmianie. Zmiany zostaną wykazane w KSeF w wierszach &lt;StanPrzed&gt; i nowym.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Zmodyfikowano pozycji: <strong className="text-fuchsia-900">{totals.modifiedCount}</strong> z {items.length}
          </div>
        </div>

        {/* Tabela pozycji */}
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
              Wartość do zwrotu nabywcy lub skorygowania salda rozrachunków.
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
            <span>🌸 Podgląd i Pobranie XML Korekty (FA3)</span>
          </button>
        </div>
      </div>

      {/* MODAL PODGLĄDU I POBRANIA XML KOREKTY */}
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
                    Korekta faktury pierwotnej: {originalInvoiceNumber} z dnia {originalInvoiceDate}
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
                  <span>Pobierz KSeF KOR XML</span>
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
