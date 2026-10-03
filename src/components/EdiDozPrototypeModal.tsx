import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Truck,
  FileCode,
  ArrowRight,
  Sparkles,
  Send,
  Inbox,
  ShieldCheck,
  PackageCheck,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { EntityDetails, InvoiceItem, InvoiceMeta } from '../types/ksef';
import {
  DOZ_EDI_CONSTANTS,
  SAMPLE_DOZ_EDI_ORDERS,
  DozEdiOrderSample,
  EdiMessageType,
  EdiSyntaxFormat,
  EdiOrdrspItemLine,
  EdiDesadvConfig,
  generateEdiOrdersMessage,
  generateEdiOrdrspMessage,
  generateEdiDesadvMessage,
  generateEdiInvoicMessage,
  downloadEdiFile,
} from '../utils/ediGenerator';
import { downloadKSeFXMLFile } from '../utils/ksefGenerator';

interface EdiDozPrototypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: EntityDetails;
  buyer: EntityDetails;
  meta: InvoiceMeta;
  items: InvoiceItem[];
  ksefXmlContent: string;
  onLoadEdiOrderToApp: (order: DozEdiOrderSample) => void;
}

export const EdiDozPrototypeModal: React.FC<EdiDozPrototypeModalProps> = ({
  isOpen,
  onClose,
  seller,
  buyer,
  meta,
  items,
  ksefXmlContent,
  onLoadEdiOrderToApp,
}) => {
  const [activeStep, setActiveStep] = useState<EdiMessageType>('ORDERS');
  const [syntax, setSyntax] = useState<EdiSyntaxFormat>('XML_EDI');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(SAMPLE_DOZ_EDI_ORDERS[0].id);
  const [copied, setCopied] = useState(false);

  // Statusy symulowanej transmisji EDI do DOZ Direct
  const [sentSteps, setSentSteps] = useState<Record<EdiMessageType, boolean>>({
    ORDERS: true,
    ORDRSP: false,
    DESADV: false,
    INVOIC: false,
  });
  const [transmissionBanner, setTransmissionBanner] = useState<string | null>(null);

  const selectedSampleOrder = useMemo(
    () =>
      SAMPLE_DOZ_EDI_ORDERS.find((o) => o.id === selectedOrderId) || SAMPLE_DOZ_EDI_ORDERS[0],
    [selectedOrderId]
  );

  // Pozycje robocze: jeśli w głównym kalkulatorze są już wczytane pozycje, możemy z nich korzystać lub z wybranego zamówienia EDI
  const [useAppItems, setUseAppItems] = useState<boolean>(items.length > 0);
  useEffect(() => {
    if (items.length > 0) {
      setUseAppItems(true);
    }
  }, [items.length]);

  const activeItems = useMemo(() => {
    if (useAppItems && items.length > 0) return items;
    return selectedSampleOrder.items;
  }, [useAppItems, items, selectedSampleOrder]);

  const activeOrderNumber =
    (useAppItems && meta.orderNumber) || selectedSampleOrder.orderNumber;
  const activeOrderDate =
    (useAppItems && meta.orderDate) || selectedSampleOrder.orderDate;
  const activeDeliveryDate =
    (useAppItems && meta.deliveryDate) || selectedSampleOrder.expectedDeliveryDate;

  // Stan potwierdzonych ilości w kroku 2 (ORDRSP)
  const [confirmedQtyMap, setConfirmedQtyMap] = useState<Record<string, number>>({});

  const ordrspLines: EdiOrdrspItemLine[] = useMemo(() => {
    return activeItems.map((it) => {
      const confirmed =
        confirmedQtyMap[it.id] !== undefined ? confirmedQtyMap[it.id] : it.quantity;
      const lineStatus =
        confirmed === 0
          ? 'REJECTED'
          : confirmed !== it.quantity
          ? 'CHANGED_QTY'
          : 'ACCEPTED';
      return {
        item: it,
        confirmedQuantity: confirmed,
        lineStatus,
      };
    });
  }, [activeItems, confirmedQtyMap]);

  // Konfiguracja kroku 3 (DESADV / e-WZ)
  const [desadvConfig, setDesadvConfig] = useState<EdiDesadvConfig>({
    desadvNumber: `WZ/${new Date().getFullYear()}/10/DOZ-01`,
    dispatchDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: activeDeliveryDate || '2026-10-06',
    carrierName: 'DPD Polska / Transport Farmaceutyczny Kontrolowany 15-25°C',
    waybillNumber: '00004829104928PL',
    palletsCount: 1,
    cartonsCount: 12,
    ssccCode: '035904277700000184',
  });

  // Konfiguracja kroku 4 (INVOIC + KSeF)
  const [ksefRefNumber, setKsefRefNumber] = useState<string>(
    `9571106742-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-A8F4E2-9C1B04-42`
  );
  const [invoicPreviewTab, setInvoicPreviewTab] = useState<'EDI_INVOIC' | 'KSEF_FA3'>('EDI_INVOIC');

  // Wygenerowany komunikat EDI dla aktualnego kroku
  const generatedEdiPayload = useMemo(() => {
    switch (activeStep) {
      case 'ORDERS':
        return generateEdiOrdersMessage(selectedSampleOrder, syntax);
      case 'ORDRSP':
        return generateEdiOrdrspMessage(
          activeOrderNumber,
          activeOrderDate,
          activeDeliveryDate,
          ordrspLines,
          syntax
        );
      case 'DESADV':
        return generateEdiDesadvMessage(
          activeOrderNumber,
          activeOrderDate,
          activeItems,
          desadvConfig,
          syntax
        );
      case 'INVOIC':
        return generateEdiInvoicMessage(
          seller,
          buyer,
          meta,
          activeItems,
          desadvConfig.desadvNumber,
          ksefRefNumber,
          syntax
        );
    }
  }, [
    activeStep,
    syntax,
    selectedSampleOrder,
    activeOrderNumber,
    activeOrderDate,
    activeDeliveryDate,
    ordrspLines,
    activeItems,
    desadvConfig,
    seller,
    buyer,
    meta,
    ksefRefNumber,
  ]);

  if (!isOpen) return null;

  const displayedCode =
    activeStep === 'INVOIC' && invoicPreviewTab === 'KSEF_FA3'
      ? ksefXmlContent
      : generatedEdiPayload;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateSend = (step: EdiMessageType) => {
    setSentSteps((prev) => ({ ...prev, [step]: true }));
    const labels: Record<EdiMessageType, string> = {
      ORDERS: 'Odebrano zamówienie EDI ORDERS z bramki DOZ Direct.',
      ORDRSP: `Wysłano potwierdzenie EDI ORDRSP dla zamówienia ${activeOrderNumber} do DOZ Direct (GLN: ${DOZ_EDI_CONSTANTS.BUYER_GLN}).`,
      DESADV: `Wysłano awizację dostawy EDI DESADV (${desadvConfig.desadvNumber}) z seriami LOT i datami MHD do magazynu DOZ Łódź (GLN: ${DOZ_EDI_CONSTANTS.DELIVERY_GLN}).`,
      INVOIC: `Wysłano pakiet: Faktura EDI INVOIC do DOZ Direct + Faktura FA(3) XML do bramki KSeF MF (Nr ref: ${ksefRefNumber}).`,
    };
    setTransmissionBanner(`📡 [SYMULACJA BRAMKI EDI]: ${labels[step]}`);
    setTimeout(() => setTransmissionBanner(null), 7000);
  };

  const handleLoadOrderAndClose = (order: DozEdiOrderSample) => {
    onLoadEdiOrderToApp(order);
    setUseAppItems(true);
    setTransmissionBanner(
      `⚡ Załadowano zamówienie EDI ${order.orderNumber} (${order.items.length} poz., cennik DOZ Kolumna O -12%, termin 60 dni) do głównego formularza faktury!`
    );
  };

  const totalNet = activeItems.reduce((acc, it) => acc + it.quantity * it.netPrice, 0);
  const totalGross = activeItems.reduce((acc, it) => {
    const rate = parseFloat(it.vatRate) || 8;
    return acc + it.quantity * it.netPrice * (1 + rate / 100);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl border border-indigo-200 shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ==================================================================== */}
        {/* GÓRNY PASEK NAGŁÓWKA PROTOTYPU EDI DOZ DIRECT                        */}
        {/* ==================================================================== */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-indigo-900 to-fuchsia-950 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-800">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center text-2xl shadow-lg shrink-0 border border-white/20">
              📡
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Centrum Komunikacji EDI – DOZ Direct
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 rounded-full shadow-xs">
                  Interaktywny Prototyp Wdrożeniowy
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-800/90 text-indigo-200 border border-indigo-600 rounded-full">
                  GS1 Polska / Comarch EDI / Infinite ECOD
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Dostawca: <strong className="text-white">Eubiosis (GLN: {DOZ_EDI_CONSTANTS.SUPPLIER_GLN})</strong>
                </span>
                <span>·</span>
                <span>
                  Nabywca: <strong className="text-white">DOZ Direct (GLN: {DOZ_EDI_CONSTANTS.BUYER_GLN})</strong>
                </span>
                <span>·</span>
                <span>
                  Magazyn Łódź: <strong className="text-emerald-300">GLN: {DOZ_EDI_CONSTANTS.DELIVERY_GLN}</strong>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            {/* Przełącznik formatu pliku EDI: XML-EDI vs UN/EDIFACT */}
            <div className="inline-flex items-center bg-indigo-950/90 p-1 rounded-xl border border-indigo-700 text-xs">
              <button
                type="button"
                onClick={() => setSyntax('XML_EDI')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  syntax === 'XML_EDI'
                    ? 'bg-fuchsia-500 text-white shadow-xs'
                    : 'text-indigo-300 hover:text-white'
                }`}
              >
                XML-EDI (ECOD/GS1)
              </button>
              <button
                type="button"
                onClick={() => setSyntax('EDIFACT_D96A')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  syntax === 'EDIFACT_D96A'
                    ? 'bg-fuchsia-500 text-white shadow-xs'
                    : 'text-indigo-300 hover:text-white'
                }`}
              >
                UN/EDIFACT D.96A
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Zamknij prototyp EDI"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* PASEK 4 KROKÓW PROCESU EDI (ORDERS -> ORDRSP -> DESADV -> INVOIC)    */}
        {/* ==================================================================== */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              {
                id: 'ORDERS' as EdiMessageType,
                stepNum: 'Krok 1',
                title: 'EDI ORDERS',
                subtitle: 'Odbiór zamówienia z DOZ',
                icon: '📥',
              },
              {
                id: 'ORDRSP' as EdiMessageType,
                stepNum: 'Krok 2',
                title: 'EDI ORDRSP',
                subtitle: 'Potwierdzenie realizacji',
                icon: '✅',
              },
              {
                id: 'DESADV' as EdiMessageType,
                stepNum: 'Krok 3',
                title: 'EDI DESADV (e-WZ)',
                subtitle: 'Awizacja + Serie LOT i MHD',
                icon: '🚚',
              },
              {
                id: 'INVOIC' as EdiMessageType,
                stepNum: 'Krok 4',
                title: 'EDI INVOIC + KSeF',
                subtitle: 'E-Faktura dla DOZ i MF',
                icon: '🧾',
              },
            ].map((tab) => {
              const isActive = activeStep === tab.id;
              const isDone = sentSteps[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStep(tab.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-white/70 hover:bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{tab.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                          {tab.stepNum}
                        </span>
                        <span className="text-xs font-black text-slate-900">{tab.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{tab.subtitle}</p>
                    </div>
                  </div>
                  {isDone && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full shrink-0">
                      ✓ Gotowe
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Powiadomienie o transmisji EDI */}
          {transmissionBanner && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{transmissionBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setTransmissionBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold text-[11px] cursor-pointer"
              >
                Ukryj
              </button>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* GŁÓWNA ZAWARTOŚĆ: LEWA KOLUMNA (OPERACJE) | PRAWA KOLUMNA (KOD EDI)  */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LEWA STRONA: PANEL INTERAKTYWNY (7 KOLUMN) */}
          <div className="lg:col-span-7 p-5 overflow-y-auto space-y-5 bg-white">
            {/* ================================================================ */}
            {/* WIDOK KROKU 1: ODBIÓR ZAMÓWIENIA (EDI ORDERS)                    */}
            {/* ================================================================ */}
            {activeStep === 'ORDERS' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-200/80 p-3.5 rounded-2xl">
                  <div>
                    <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                      <Inbox className="w-4 h-4 text-indigo-600" />
                      <span>Skrzynka odbiorcza zamówień EDI z DOZ Direct</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Zamiast ręcznie przepisywać PDF z maila, zamówienia z DOZ pojawiają się tutaj automatycznie.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full">
                    ● Połączenie aktywne (Tryb Demo)
                  </span>
                </div>

                {/* Lista przychodzących zamówień EDI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_DOZ_EDI_ORDERS.map((ord) => {
                    const isSelected = ord.id === selectedSampleOrder.id;
                    const ordNet = ord.items.reduce((s, i) => s + i.quantity * i.netPrice, 0);
                    return (
                      <div
                        key={ord.id}
                        onClick={() => {
                          setSelectedOrderId(ord.id);
                          setUseAppItems(false);
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/50 border-indigo-600 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-indigo-900 font-mono bg-indigo-100 px-2 py-0.5 rounded-md">
                            {ord.orderNumber}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            EDI ORDERS
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">{ord.buyerName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{ord.receivedAt}</p>
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            Pozycji: <strong>{ord.items.length}</strong>
                          </span>
                          <span className="font-black text-slate-900">
                            {ordNet.toFixed(2)} PLN netto
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Szczegóły wybranego zamówienia EDI */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900">
                        Specyfikacja zamówienia EDI: {selectedSampleOrder.orderNumber}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Miejsce dostawy: <strong>{selectedSampleOrder.deliveryAddress}</strong> (GLN:{' '}
                        <code className="font-mono text-indigo-700">
                          {selectedSampleOrder.deliveryPointGln}
                        </code>
                        )
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLoadOrderAndClose(selectedSampleOrder)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Wczytaj to zamówienie do Generatora Faktury</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-left font-bold">Lp.</th>
                          <th className="py-2 px-3 text-left font-bold">Produkt / EAN (GTIN)</th>
                          <th className="py-2 px-3 text-right font-bold">Ilość</th>
                          <th className="py-2 px-3 text-right font-bold">Cena DOZ (-12%)</th>
                          <th className="py-2 px-3 text-center font-bold">Weryfikacja Cennika</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSampleOrder.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                EAN: {item.gtin} · BLOZ: {item.bloz7}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                              {item.netPrice.toFixed(2)} zł
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                ✓ Zgodna (Kol. O)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveStep('ORDRSP')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Przejdź do Kroku 2: Potwierdzenie Zamówienia (ORDRSP)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* WIDOK KROKU 2: POTWIERDZENIE REALIZACJI (EDI ORDRSP)             */}
            {/* ================================================================ */}
            {activeStep === 'ORDRSP' && (
              <div className="space-y-4">
                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-emerald-950">
                      Krok 2: Potwierdzenie realizacji zamówienia (EDI ORDRSP)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Zatwierdź ilości, które wyślesz do DOZ Direct. Jeśli zmniejszysz ilość, system automatycznie ustawi kod EDI <code>4 (Zmiana ilości)</code>.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmedQtyMap({})}
                      className="px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg cursor-pointer"
                    >
                      ✓ Potwierdź 100% ilości
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeItems[0]) {
                          setConfirmedQtyMap({
                            [activeItems[0].id]: Math.max(1, activeItems[0].quantity - 10),
                          });
                        }
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg cursor-pointer"
                    >
                      ⚡ Symuluj brak części towaru
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-bold">Produkt / GTIN</th>
                        <th className="py-2.5 px-3 text-right font-bold">Zamówiono</th>
                        <th className="py-2.5 px-3 text-center font-bold">Potwierdzona ilość</th>
                        <th className="py-2.5 px-3 text-right font-bold">Cena netto</th>
                        <th className="py-2.5 px-3 text-center font-bold">Status linii EDI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ordrspLines.map((line) => (
                        <tr key={line.item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{line.item.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              EAN: {line.item.gtin}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-600">
                            {line.item.quantity} {line.item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={line.item.quantity}
                              value={line.confirmedQuantity}
                              onChange={(e) =>
                                setConfirmedQtyMap((prev) => ({
                                  ...prev,
                                  [line.item.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }))
                              }
                              className="w-20 px-2 py-1 text-center font-mono font-bold border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {line.item.netPrice.toFixed(2)} zł
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {line.lineStatus === 'ACCEPTED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                                Kod 5: Bez zmian
                              </span>
                            )}
                            {line.lineStatus === 'CHANGED_QTY' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                                Kod 3: Zmiana ilości
                              </span>
                            )}
                            {line.lineStatus === 'REJECTED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded-full">
                                Kod 7: Brak towaru
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSimulateSend('ORDRSP')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Symuluj wysyłkę EDI ORDRSP do DOZ Direct</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep('DESADV')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Krok 3: Awizacja Wysyłki (DESADV / e-WZ)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* WIDOK KROKU 3: AWIZACJA DOSTAWY / E-WZ (EDI DESADV)              */}
            {/* ================================================================ */}
            {activeStep === 'DESADV' && (
              <div className="space-y-4">
                <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl">
                  <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span>Krok 3: Awizacja dostawy z seriami LOT i datami ważności MHD (EDI DESADV)</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Komunikat <strong>DESADV</strong> to elektroniczny dokument WZ wysyłany do magazynu DOZ w Łodzi (<code>ul. Kinga C. Gillette 1, 9 i 11</code>) przed przyjazdem kuriera/palety. Automatycznie pobiera serie i daty ważności z Kroku 3 (OCR)!
                  </p>
                </div>

                {/* Parametry logistyczne wysyłki */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Numer dokumentu WZ / DESADV
                    </label>
                    <input
                      type="text"
                      value={desadvConfig.desadvNumber}
                      onChange={(e) =>
                        setDesadvConfig((prev) => ({ ...prev, desadvNumber: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Planowana data dostawy do Łodzi
                    </label>
                    <input
                      type="date"
                      value={desadvConfig.expectedDeliveryDate}
                      onChange={(e) =>
                        setDesadvConfig((prev) => ({
                          ...prev,
                          expectedDeliveryDate: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Kod paletowy GS1 SSCC (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      value={desadvConfig.ssccCode}
                      onChange={(e) =>
                        setDesadvConfig((prev) => ({ ...prev, ssccCode: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Przewoźnik / Spedycja
                    </label>
                    <input
                      type="text"
                      value={desadvConfig.carrierName}
                      onChange={(e) =>
                        setDesadvConfig((prev) => ({ ...prev, carrierName: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nr listu przewozowego
                    </label>
                    <input
                      type="text"
                      value={desadvConfig.waybillNumber}
                      onChange={(e) =>
                        setDesadvConfig((prev) => ({ ...prev, waybillNumber: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Palety EUR
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={desadvConfig.palletsCount}
                        onChange={(e) =>
                          setDesadvConfig((prev) => ({
                            ...prev,
                            palletsCount: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Kartony
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={desadvConfig.cartonsCount}
                        onChange={(e) =>
                          setDesadvConfig((prev) => ({
                            ...prev,
                            cartonsCount: parseInt(e.target.value, 10) || 1,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabela partii i dat ważności wysyłanych w DESADV */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 text-left font-bold">Produkt / GTIN</th>
                        <th className="py-2 px-3 text-right font-bold">Ilość wysłana</th>
                        <th className="py-2 px-3 text-center font-bold">Nr Serii (LOT / Batch)</th>
                        <th className="py-2 px-3 text-center font-bold">Data ważności (MHD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeItems.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900">{it.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">EAN: {it.gtin}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md">
                              {it.batchNumber || '25E2140'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                              {it.expiryDate || '2028-06-30'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSimulateSend('DESADV')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Symuluj wysyłkę awizacji DESADV do magazynu DOZ Łódź</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep('INVOIC')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Krok 4: Faktura Elektroniczna (EDI INVOIC + KSeF)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* WIDOK KROKU 4: PODWÓJNA FAKTURA (EDI INVOIC + KSEF FA(3))        */}
            {/* ================================================================ */}
            {activeStep === 'INVOIC' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-fuchsia-50 via-rose-50 to-indigo-50 border border-fuchsia-200 p-4 rounded-2xl">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-fuchsia-600" />
                    <span>Krok 4: Synchronizacja KSeF FA(3) oraz EDI INVOIC jednym kliknięciem</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Zgodnie z pismem od DOZ Direct: <strong>KSeF służy do raportowania faktury do Ministerstwa Finansów</strong>, natomiast <strong>komunikat EDI INVOIC trafia bezpośrednio do systemu magazynowo-księgowego DOZ Direct</strong> (parując fakturę z zamówieniem <code>{activeOrderNumber}</code> i awizacją <code>{desadvConfig.desadvNumber}</code>).
                  </p>
                </div>

                {/* Dwie karty porównujące oba dokumenty generowane naraz */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setInvoicPreviewTab('EDI_INVOIC')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      invoicPreviewTab === 'EDI_INVOIC'
                        ? 'bg-indigo-50/60 border-indigo-600 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-indigo-950">
                        1. Komunikat EDI INVOIC (dla DOZ)
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-full">
                        Bramka EDI DOZ
                      </span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-1 mt-2">
                      <li>• Zawiera GLN Nabywcy (<code>{DOZ_EDI_CONSTANTS.BUYER_GLN}</code>) i Magazynu Łódź (<code>{DOZ_EDI_CONSTANTS.DELIVERY_GLN}</code>)</li>
                      <li>• Zawiera serie <code>LOT</code>, daty <code>MHD</code>, kody <code>EAN/BLOZ</code></li>
                      <li>• Zawiera ceny netto z Kolumny O (<code>-12%</code>) i termin <code>60 dni</code></li>
                    </ul>
                  </div>

                  <div
                    onClick={() => setInvoicPreviewTab('KSEF_FA3')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      invoicPreviewTab === 'KSEF_FA3'
                        ? 'bg-fuchsia-50/60 border-fuchsia-600 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-fuchsia-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-fuchsia-950">
                        2. E-Faktura KSeF FA(3) (dla MF)
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-fuchsia-100 text-fuchsia-800 rounded-full">
                        Ministerstwo Finansów
                      </span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-1 mt-2">
                      <li>• Oficjalny schemat <code>FA(3) wzór 13775 (1-0E)</code></li>
                      <li>• <strong>Brak węzła Podmiot3</strong> (zgodnie z wytyczną DOZ Direct)</li>
                      <li>• Te same kwoty netto/VAT/brutto co w EDI INVOIC</li>
                    </ul>
                  </div>
                </div>

                {/* Numer referencyjny KSeF przekazywany do EDI INVOIC */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Numer referencyjny KSeF (wpisywany automatycznie do nagłówka EDI INVOIC dla DOZ):
                    </label>
                    <input
                      type="text"
                      value={ksefRefNumber}
                      onChange={(e) => setKsefRefNumber(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-indigo-900"
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-500">Suma Netto / Brutto</div>
                    <div className="text-sm font-black text-slate-900">
                      {totalNet.toFixed(2)} zł /{' '}
                      <span className="text-fuchsia-700">{totalGross.toFixed(2)} zł</span>
                    </div>
                  </div>
                </div>

                {/* Przyciski wysyłki i pobrania obu plików */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSimulateSend('INVOIC')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black text-white bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Symuluj wysyłkę pakietu (KSeF FA(3) + EDI INVOIC)</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadEdiFile(
                          generatedEdiPayload,
                          'INVOIC',
                          meta.invoiceNumber || activeOrderNumber,
                          syntax
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pobierz EDI INVOIC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadKSeFXMLFile(
                          ksefXmlContent,
                          meta.invoiceNumber || 'FAKTURA_DOZ',
                          'FA3'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pobierz KSeF FA(3) XML</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PRAWA STRONA: PODGLĄD KODU KOMUNIKATU EDI NA ŻYWO (5 KOLUMN) */}
          <div className="lg:col-span-5 bg-slate-950 text-slate-100 flex flex-col max-h-[600px] lg:max-h-none">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-fuchsia-400" />
                <div>
                  <span className="text-xs font-bold text-white block">
                    {activeStep === 'INVOIC' && invoicPreviewTab === 'KSEF_FA3'
                      ? 'Podgląd: KSeF FA(3) XML (Ministerstwo Finansów)'
                      : `Podgląd na żywo: EDI ${activeStep} (${
                          syntax === 'XML_EDI' ? 'XML-EDI GS1/ECOD' : 'UN/EDIFACT D.96A'
                        })`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Zamówienie: {activeOrderNumber} · Pozycji: {activeItems.length}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Skopiowano</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopiuj</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadEdiFile(generatedEdiPayload, activeStep, activeOrderNumber, syntax)
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pobierz .{syntax === 'XML_EDI' ? 'xml' : 'edi'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-[11px] leading-relaxed text-indigo-100 select-text">
              <pre className="whitespace-pre">{displayedCode}</pre>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* STOPKA PROTOTYPU                                                     */}
        {/* ==================================================================== */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Gotowość architektoniczna:</strong> Po otrzymaniu od DOZ Direct specyfikacji technicznej (Operator EDI + numery GLN), ten moduł zostanie podpięty pod produkcyjną bramkę DOZ.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
          >
            Zamknij podgląd prototypu EDI
          </button>
        </div>
      </div>
    </div>
  );
};
