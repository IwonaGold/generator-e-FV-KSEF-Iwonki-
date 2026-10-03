import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  X,
  Calendar,
  Building2,
  Sparkles,
  Clock,
  Globe,
  Package,
  AlertCircle,
  Truck,
  FileSpreadsheet,
} from 'lucide-react';
import { ArchivedOrder, OrderInvoiceStatus } from '../types/ordersHistory';
import { PharmacyChain, EntityDetails, ThirdPartyEntity, InvoiceItem } from '../types/ksef';
import { DEFAULT_SELLER, PHARMACY_CHAINS } from '../utils/sampleData';
import { parseOrderFromFile, detectPharmacyChain, matchOrBuildBuyerFromOrder } from '../utils/orderParser';
import { saveArchivedOrder } from '../utils/ordersStorage';

interface ImportOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSaved: (newOrder: ArchivedOrder) => void;
}

export const ImportOrderModal: React.FC<ImportOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderSaved,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Odczytane dane zamówienia
  const [chain, setChain] = useState<PharmacyChain>('Inne');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [avisoDate, setAvisoDate] = useState('');
  const [buyer, setBuyer] = useState<EntityDetails | null>(null);
  const [thirdParty, setThirdParty] = useState<ThirdPartyEntity | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [totalNet, setTotalNet] = useState(0);
  const [totalVat, setTotalVat] = useState(0);
  const [totalGross, setTotalGross] = useState(0);

  // Wybór trybu
  const [invoiceMode, setInvoiceMode] = useState<OrderInvoiceStatus>('awaiting_invoice');
  const [externalInvoiceNumber, setExternalInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('DPD');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setParseError(null);

    try {
      const parsed = await parseOrderFromFile(selectedFile);
      if (!parsed.items || parsed.items.length === 0) {
        throw new Error('Nie udało się wyodrębnić pozycji towarowych z pliku.');
      }

      // Wykrycie sieci i nabywcy
      const matched = matchOrBuildBuyerFromOrder(parsed.headerData, parsed.rawText);
      const detectedChain = matched.chain || detectPharmacyChain(matched.buyer, matched.thirdParty);
      setChain(detectedChain);

      const buyerData: EntityDetails = matched.buyer?.nip
        ? matched.buyer
        : detectedChain !== 'Inne' && PHARMACY_CHAINS[detectedChain as keyof typeof PHARMACY_CHAINS]
        ? PHARMACY_CHAINS[detectedChain as keyof typeof PHARMACY_CHAINS].buyer
        : {
            nip: parsed.headerData?.buyerNip || '',
            name: parsed.headerData?.buyerName || 'NABYWCA',
            countryCode: 'PL',
            addressLine1: parsed.headerData?.buyerAddress || '',
            city: '',
            postalCode: '',
          };
      setBuyer(buyerData);

      const thirdPartyData = matched.thirdParty || (
        detectedChain !== 'Inne' && PHARMACY_CHAINS[detectedChain as keyof typeof PHARMACY_CHAINS]?.thirdParty
          ? PHARMACY_CHAINS[detectedChain as keyof typeof PHARMACY_CHAINS].thirdParty
          : null
      );
      setThirdParty(thirdPartyData || null);

      // Daty i numer
      const ordNum = parsed.headerData?.orderNumber || selectedFile.name.replace(/\.[^/.]+$/, '');
      setOrderNumber(ordNum);

      const ordDate = parsed.headerData?.orderDate || new Date().toISOString().slice(0, 10);
      setOrderDate(ordDate);

      const delivDate = parsed.headerData?.deliveryDate || ordDate;
      setAvisoDate(delivDate);

      // Pozycje towarowe
      const completeItems: InvoiceItem[] = parsed.items.map((it, idx) => ({
        id: `ord-it-${Date.now()}-${idx}`,
        name: it.name || `Pozycja ${idx + 1}`,
        gtin: it.gtin || '9120000000000',
        quantity: it.quantity || 1,
        unit: it.unit || 'SZT.',
        netPrice: it.netPrice || 0,
        vatRate: it.vatRate || '8%',
        batchNumber: it.batchNumber || '',
        expiryDate: it.expiryDate || '',
        quantityInBatch: it.quantity || 1,
      }));
      setItems(completeItems);

      const net = completeItems.reduce((acc, it) => acc + it.quantity * it.netPrice, 0);
      const gross = Math.round(net * 1.08 * 100) / 100;
      const vat = Math.round((gross - net) * 100) / 100;
      setTotalNet(Math.round(net * 100) / 100);
      setTotalVat(vat);
      setTotalGross(gross);
    } catch (err: any) {
      console.error('Błąd parsowania pliku zamówienia:', err);
      setParseError(err.message || 'Wystąpił błąd podczas analizy pliku.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!buyer) {
      alert('Proszę najpierw wczytać poprawny plik zamówienia.');
      return;
    }

    const effectiveInvoiceNumber =
      invoiceMode === 'external_billing'
        ? externalInvoiceNumber.trim() || 'FV ZEWNĘTRZNA'
        : orderNumber
        ? `ZAM: ${orderNumber}`
        : 'ZAMÓWIENIE';

    const newOrder: ArchivedOrder = {
      id: `ord-${Date.now()}`,
      chain,
      documentType: 'ZAM',
      invoiceStatus: invoiceMode,
      externalInvoiceNumber: invoiceMode === 'external_billing' ? externalInvoiceNumber.trim() : undefined,
      invoiceNumber: effectiveInvoiceNumber,
      orderNumber: orderNumber || undefined,
      orderDate: orderDate || undefined,
      issueDate: new Date().toISOString().slice(0, 10),
      avisoDate: avisoDate || undefined,
      deliveryDate: avisoDate || undefined,
      seller: DEFAULT_SELLER,
      buyer,
      thirdParty,
      items,
      itemsCount: items.length,
      totalNet,
      totalVat,
      totalGross,
      currency: 'PLN',
      xmlContent: '',
      isDelivered: false,
      deliveredAt: null,
      shippingStatus: 'registered', // 📦 Nowe zamówienie trafia jako "Do wysyłki"
      trackingNumber: trackingNumber.trim() || undefined,
      courierName: trackingNumber.trim() ? courierName : undefined,
      notes:
        (invoiceMode === 'external_billing'
          ? 'Faktura w systemie zewnętrznym. '
          : 'Zamówienie w realizacji (e-Faktura KSeF do wystawienia przed awizacją). ') +
        (notes ? `Notatki: ${notes}` : ''),
      originalFileName: file?.name || 'zamowienie',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentStatus: 'pending',
      parcelPhotos: [],
    };

    try {
      await saveArchivedOrder(newOrder);
      onOrderSaved(newOrder);
      onClose();
    } catch (e) {
      console.error('Błąd zapisu zamówienia:', e);
      alert('Wystąpił błąd podczas zapisywania zamówienia.');
    }
  };

  const handleResetForm = () => {
    setFile(null);
    setBuyer(null);
    setItems([]);
    setParseError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* NAGŁÓWEK MODALU */}
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl">
              📥
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Wczytaj Nowe Zamówienie do Realizacji
              </h2>
              <p className="text-xs text-white/90">
                Wprowadź zamówienie z wyprzedzeniem (przed awizacją) lub dla sieci fakturowanej w osobnym systemie
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* KROK 1: UPUSZCZENIE PLIKU ZAMÓWIENIA */}
          {!buyer ? (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/40 hover:bg-rose-50/80 rounded-2xl p-8 text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileProcess(e.target.files[0])}
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-xs border border-rose-200 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform mb-3">
                  📄
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isParsing ? 'Trwa odczytywanie pliku...' : 'Przeciągnij i upuść plik zamówienia lub kliknij'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Obsługuje zamówienia PDF, TXT oraz Excel (XLSX/CSV) dla DOZ, Dr. Max, Super-Pharm, Gemini i innych.
                </p>
                {isParsing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-rose-700">
                    <span className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    <span>Rozpoznaję pozycje towarowe, aptekę docelową i awizację...</span>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : (
            /* KROK 2: PODGLĄD ODCZYTANYCH DANYCH I WYBÓR TRYBU */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* BELKA POTWIERDZENIA WCZYTANIA */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-900">
                      Pomyślnie wczytano plik: <strong>{file?.name}</strong>
                    </span>
                    <p className="text-[11px] text-emerald-700">
                      Rozpoznano: {items.length} pozycji towarowych · Wartość brutto: {totalGross.toFixed(2)} PLN
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-700 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                >
                  Zmień plik
                </button>
              </div>

              {/* PODSTAWOWE DANE IDENTYFIKACYJNE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Sieć apteczna:
                  </label>
                  <select
                    value={chain}
                    onChange={(e) => setChain(e.target.value as PharmacyChain)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:outline-rose-500"
                  >
                    <option value="DOZ">DOZ</option>
                    <option value="Dr. Max">Dr. Max</option>
                    <option value="Super-Pharm">Super-Pharm</option>
                    <option value="Gemini">Gemini</option>
                    <option value="Inne">Inna sieć / apteka</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Numer zamówienia:
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:outline-rose-500"
                    placeholder="np. ZZ-1009/09/26"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Data zamówienia:
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:outline-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-700 uppercase mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Planowana data awizacji / dostawy:</span>
                  </label>
                  <input
                    type="date"
                    value={avisoDate}
                    onChange={(e) => setAvisoDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl font-mono font-bold text-amber-950 text-xs focus:outline-amber-500"
                    title="Jeśli zamówienie wpływa z dużym wyprzedzeniem (np. za miesiąc), podaj tutaj planowany termin awizacji"
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-800">{buyer.name}</span>
                      <p className="text-[11px] text-slate-500">
                        NIP: {buyer.nip} · {buyer.addressLine1}, {buyer.city}
                      </p>
                      {thirdParty && (
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          📍 Odbiorca / Apteka: <strong>{thirdParty.name}</strong> (GLN: {thirdParty.gln || 'brak'})
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {items.length} pozycji
                    </span>
                  </div>
                </div>
              </div>

              {/* SEKCJA: WYBÓR PRZEZNACZENIA / TRYBU FAKTUROWANIA */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Wybierz tryb obsługi zamówienia:
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* OPCJA 1: ZAPISZ NA PÓŹNIEJ (FV WYSTAWIĘ PRZED AWIZACJĄ) */}
                  <label
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      invoiceMode === 'awaiting_invoice'
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invoiceMode"
                      checked={invoiceMode === 'awaiting_invoice'}
                      onChange={() => setInvoiceMode('awaiting_invoice')}
                      className="hidden"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-black text-slate-900">
                          1. Zapisz do realizacji (FV wystawię później)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Zamówienie wpada na listę <strong>„W REALIZACJI”</strong> do spakowania i wysyłki. Przed awizacją jednym kliknięciem wygenerujesz oficjalną e-Fakturę KSeF XML.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-amber-200/60 font-semibold text-amber-900">
                      <span>Status: Oczekuje na FV</span>
                      <span className="bg-amber-200/80 px-2 py-0.5 rounded">Rekomendowane</span>
                    </div>
                  </label>

                  {/* OPCJA 2: SIEĆ FAKTUROWANA W SYSTEMIE ZEWNĘTRZNYM */}
                  <label
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      invoiceMode === 'external_billing'
                        ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-400/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invoiceMode"
                      checked={invoiceMode === 'external_billing'}
                      onChange={() => setInvoiceMode('external_billing')}
                      className="hidden"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-black text-slate-900">
                          2. Faktura w systemie zewnętrznym
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Dla sieci rozliczanych poza KSeF (w osobnym portalu lub ERP). Zamówienie zyskuje pełne śledzenie kurierskie, zdjęcia paczki i statusy doręczeń bez XML KSeF.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-blue-200/60 font-semibold text-blue-900">
                      <span>Status: Fakturowanie zewn.</span>
                      <span className="bg-blue-200/80 px-2 py-0.5 rounded">Bez XML KSeF</span>
                    </div>
                  </label>
                </div>

                {/* OPCJONALNE POLE NUMERU DLA FAKTURY ZEWNĘTRZNEJ */}
                {invoiceMode === 'external_billing' && (
                  <div className="bg-blue-50/90 border border-blue-200 p-3 rounded-xl animate-in fade-in duration-150">
                    <label className="block text-[11px] font-bold text-blue-900 uppercase mb-1">
                      Numer faktury z zewnętrznego systemu (opcjonalnie):
                    </label>
                    <input
                      type="text"
                      value={externalInvoiceNumber}
                      onChange={(e) => setExternalInvoiceNumber(e.target.value)}
                      placeholder="np. FV/2026/09/8812 lub pozostaw puste (oznaczone jako FV Zewnętrzna)"
                      className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* DODATKOWE INFORMACJE LOGISTYCZNE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Numer listu przewozowego (opcjonalnie):</span>
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Wpisz numer przesyłki jeśli już znasz..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Kurier:
                  </label>
                  <select
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-rose-500 font-semibold"
                  >
                    <option value="DPD">DPD</option>
                    <option value="InPost">InPost</option>
                    <option value="Globkurier">Globkurier</option>
                    <option value="DHL">DHL</option>
                    <option value="GLS">GLS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="Pocztex">Pocztex</option>
                    <option value="Schenker">Schenker</option>
                    <option value="Inny">Inny przewoźnik</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Notatka do realizacji (np. uwagi do magazynu / pakowania):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="np. Awizacja na magazyn centralny, przygotować 2 palety, spakować partię..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-rose-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STOPKA MODALU */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Anuluj
          </button>

          {buyer && (
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 hover:from-amber-700 hover:to-pink-700 rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Package className="w-4 h-4" />
              <span>💾 Zapisz zamówienie w realizacji</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
