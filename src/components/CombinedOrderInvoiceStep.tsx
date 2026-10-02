import React, { useRef, useState, useEffect } from 'react';
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
} from 'lucide-react';
import { PHARMACY_CHAINS } from '../utils/sampleData';
import { PharmacyChain, EntityDetails, InvoiceMeta, ThirdPartyEntity, InvoiceItem, ParsedOrderData } from '../types/ksef';
import { ArchivedOrder } from '../types/ordersHistory';
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
  const orderInputRef = useRef<HTMLInputElement>(null);

  // Automatyczna sanitacja: Jeśli w thirdParty.idWew znajduje się numer GLN (np. 13 cyfr 5909000848054 z DOZ),
  // natychmiast przenosimy go do thirdParty.gln i czyścimy pole idWew, by nie psuło schematu KSeF.
  useEffect(() => {
    if (thirdParty && thirdParty.idWew) {
      const cleanId = thirdParty.idWew.trim();
      const isValidKSeFIdWew = /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(cleanId);
      if (!isValidKSeFIdWew) {
        const isGln = /^\d{1,13}$/.test(cleanId);
        onUpdateThirdParty && onUpdateThirdParty({
          ...thirdParty,
          idWew: undefined,
          gln: thirdParty.gln || (isGln ? cleanId : undefined),
        });
      }
    }
  }, [thirdParty, onUpdateThirdParty]);

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
            accept=".xlsx,.xls,.pdf,.txt,.csv,.xml"
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

          {/* Szybkie przyciski dni: 30, 45, 60 dni OD DATY DOSTAWY (P_6) */}
          <div className="bg-fuchsia-50/50 p-2.5 rounded-xl border border-fuchsia-200/80 mt-1">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <span>🚚</span> Termin od daty dostawy (P_6: <strong className="font-mono text-fuchsia-700">{meta.deliveryDate || meta.issueDate}</strong>):
              </span>
              {meta.paymentDays ? (
                <span className="text-[10px] font-bold text-fuchsia-700 bg-fuchsia-100/80 px-2 py-0.5 rounded-full border border-fuchsia-200">
                  Wybrano: {meta.paymentDays} dni ✨
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setPaymentDaysFromDelivery(30)}
                className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  meta.paymentDays === 30
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-fuchsia-500 shadow-xs'
                    : 'bg-white hover:bg-fuchsia-50/70 text-slate-800 border-slate-200 hover:border-fuchsia-300'
                }`}
                title="30 dni od daty dostawy"
              >
                30 dni
              </button>
              <button
                type="button"
                onClick={() => setPaymentDaysFromDelivery(45)}
                className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  meta.paymentDays === 45
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-fuchsia-500 shadow-xs'
                    : 'bg-white hover:bg-fuchsia-50/70 text-slate-800 border-slate-200 hover:border-fuchsia-300'
                }`}
                title="45 dni od daty dostawy"
              >
                45 dni
              </button>
              <button
                type="button"
                onClick={() => setPaymentDaysFromDelivery(60)}
                className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  meta.paymentDays === 60
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-fuchsia-500 shadow-xs'
                    : 'bg-white hover:bg-fuchsia-50/70 text-slate-800 border-slate-200 hover:border-fuchsia-300'
                }`}
                title="60 dni od daty dostawy"
              >
                60 dni
              </button>
            </div>
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
              Odbiorca / Miejsce dostawy (Podmiot3)
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
              <span className="text-[10px] text-slate-400 font-medium">Brak odbiorcy</span>
            )}
          </div>

          {thirdParty?.name ? (
            showThirdPartyDetails ? (
              <div className="space-y-2 bg-white p-3 rounded-xl border border-fuchsia-200 text-xs animate-in fade-in">
                <div className="flex items-center justify-between pb-1 border-b border-fuchsia-100">
                  <span className="font-bold text-fuchsia-700 text-xs">Edycja Odbiorcy / Miejsca dostawy:</span>
                  <button
                    type="button"
                    onClick={() => setShowThirdPartyDetails(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Zwiń ▲
                  </button>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Nazwa odbiorcy / hurtowni:</span>
                  <input
                    type="text"
                    value={thirdParty.name}
                    onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, name: e.target.value })}
                    className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 focus:border-fuchsia-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">GLN / ILN miejsca dostawy:</span>
                    <input
                      type="text"
                      value={thirdParty.gln || ''}
                      onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, gln: e.target.value.trim() })}
                      placeholder="np. 5909000848054"
                      className="w-full text-xs font-mono font-bold text-fuchsia-800 bg-fuchsia-50/50 border border-fuchsia-200 rounded px-2 py-1 focus:border-fuchsia-500 focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Zgodne z FA(3) &lt;GLN&gt;</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">ID-Wew (NIP-oddział):</span>
                    <input
                      type="text"
                      value={thirdParty.idWew || ''}
                      onChange={(e) => onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, idWew: e.target.value.trim() })}
                      placeholder="np. 5213842837-54936"
                      className="w-full text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 focus:border-fuchsia-400 focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">W DOZ: puste (nie występuje)</span>
                  </div>
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
                  {thirdParty.gln ? (
                    <span className="bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded border border-fuchsia-200 font-bold">
                      GLN: {thirdParty.gln}
                    </span>
                  ) : null}
                  {thirdParty.idWew ? (
                    <span className="bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded border border-fuchsia-200 font-bold">
                      ID-Wew: {thirdParty.idWew}
                    </span>
                  ) : null}
                  {thirdParty.nip ? (
                    <span className="text-slate-600">NIP: {thirdParty.nip}</span>
                  ) : null}
                  {!thirdParty.idWew && !thirdParty.nip && (
                    <span className="text-[10px] text-slate-400">
                      ID: BrakID (KSeF)
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
                Dostawa bezpośrednio do Nabywcy (Podmiot 2).
              </p>
              <button
                type="button"
                onClick={() =>
                  onUpdateThirdParty &&
                  onUpdateThirdParty({
                    name: 'Magazyn Centralny',
                    addressLine1: 'ul. Magazynowa 1, 00-001 Warszawa',
                    countryCode: 'PL',
                    role: '2',
                  })
                }
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
              >
                + Dodaj oddzielnego Odbiorcę (Podmiot3)
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
