import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Download,
  FileCode,
  FileEdit,
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
} from 'lucide-react';
import { ArchivedOrder, OrderChainFilter, OrderStatusFilter } from '../types/ordersHistory';
import { downloadKSeFXMLFile } from '../utils/ksefGenerator';
import { updateArchivedOrderFields, deleteArchivedOrder, saveArchivedOrder } from '../utils/ordersStorage';
import { parseKSeFXMLString } from '../utils/ksefXmlParser';

interface OrderHistoryViewProps {
  orders: ArchivedOrder[];
  onRefreshOrders: () => void;
  onCreateCorrectionForOrder: (order: ArchivedOrder) => void;
  onNavigateToInvoiceCreation: () => void;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders,
  onRefreshOrders,
  onCreateCorrectionForOrder,
  onNavigateToInvoiceCreation,
}) => {
  const [chainFilter, setChainFilter] = useState<OrderChainFilter>('Wszystkie');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Modal podglądu XML
  const [viewXmlOrder, setViewXmlOrder] = useState<ArchivedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  // Stan lokalny edycji notatek i statusu dostawy
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [notesState, setNotesState] = useState<Record<string, string>>({});

  // Obliczenia liczników dla sieci
  const chainCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Wszystkie: orders.length,
      DOZ: 0,
      'Dr. Max': 0,
      'Super-Pharm': 0,
      Gemini: 0,
      Inne: 0,
    };

    orders.forEach((ord) => {
      if (counts[ord.chain] !== undefined) {
        counts[ord.chain]++;
      } else {
        counts.Inne++;
      }
    });

    return counts;
  }, [orders]);

  // Filtrowanie listy zamówień
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Filtr sieci
      if (chainFilter !== 'Wszystkie' && ord.chain !== chainFilter) {
        return false;
      }

      // 2. Filtr statusu dostawy
      if (statusFilter === 'delivered' && !ord.isDelivered) return false;
      if (statusFilter === 'pending' && ord.isDelivered) return false;

      // 3. Wyszukiwarka
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesInv = ord.invoiceNumber?.toLowerCase().includes(query);
        const matchesOrd = ord.orderNumber?.toLowerCase().includes(query);
        const matchesBuyer = ord.buyer?.name?.toLowerCase().includes(query);
        const matchesRecipient = ord.thirdParty?.name?.toLowerCase().includes(query);
        const matchesNotes = ord.notes?.toLowerCase().includes(query);
        const matchesItems = ord.items?.some((it) => it.name?.toLowerCase().includes(query));

        if (!matchesInv && !matchesOrd && !matchesBuyer && !matchesRecipient && !matchesNotes && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [orders, chainFilter, statusFilter, searchQuery]);

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

    await updateArchivedOrderFields(order.id, {
      isDelivered: newStatus,
      deliveredAt: newStatus ? nowStr : null,
    });

    onRefreshOrders();
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

  // Usuwanie zamówienia
  const handleDeleteOrder = async (order: ArchivedOrder) => {
    if (window.confirm(`Czy na pewno chcesz usunąć z historii zamówienie ${order.invoiceNumber}?`)) {
      await deleteArchivedOrder(order.id);
      onRefreshOrders();
    }
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

        const chain = (parsed.buyer.name?.includes('DR.MAX') || parsed.buyer.name?.includes('Dr. Max'))
          ? 'Dr. Max'
          : parsed.buyer.name?.includes('DOZ')
          ? 'DOZ'
          : parsed.buyer.name?.includes('SUPER-PHARM')
          ? 'Super-Pharm'
          : parsed.buyer.name?.includes('GEMINI')
          ? 'Gemini'
          : 'Inne';

        const newOrder: ArchivedOrder = {
          id: `imported-${Date.now()}`,
          chain,
          documentType: 'FV',
          invoiceNumber: parsed.invoiceNumber,
          orderNumber: parsed.orderNumber || 'ZAM-IMPORT',
          issueDate: parsed.issueDate,
          deliveryDate: parsed.issueDate,
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
      {/* NAGŁÓWEK MODUŁU I FILTRY SIECIOWE */}
      <div className="bg-white rounded-2xl border border-rose-200/80 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                HISTORIA ZAMÓWIEŃ SIECIOWYCH
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rejestr wszystkich zamówień i wygenerowanych faktur KSeF dla sieci farmaceutycznych: DOZ, Dr. Max, Super-Pharm, Gemini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer transition-colors shadow-2xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Importuj plik XML</span>
              <input type="file" accept=".xml" className="hidden" onChange={handleImportXmlFile} />
            </label>

            <button
              onClick={onNavigateToInvoiceCreation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nowe Zamówienie 🌸</span>
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

        {/* FILTRY STATUSU DOSTAWY I WYSZUKIWARKA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Szukaj po nr faktury, zamówienia, leku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-slate-500 font-medium">Status dostawy:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setStatusFilter('delivered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'delivered'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ✅ Doręczone
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🚚 W doręczeniu
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA ZAMÓWIEŃ */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center text-xl mb-3">
            🌸
          </div>
          <h3 className="text-sm font-bold text-slate-800">Brak zamówień spełniających kryteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Zmień filtry lub wystaw nowe zamówienie za pomocą kafelka &quot;1. WYSTAW FAKTURĘ XML&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const isExpanded = expandedOrderId === ord.id;
            const currentNote = notesState[ord.id] !== undefined ? notesState[ord.id] : ord.notes || '';
            const isNoteSaving = savingNoteId === ord.id;

            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-rose-300 shadow-xs hover:shadow-md transition-all overflow-hidden"
              >
                {/* GŁÓWNA KARTA ZAMÓWIENIA */}
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* LEWA STRONA: BADGE SIECI, NUMERY, DATY, NABYWCA */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${getChainBadgeStyle(
                            ord.chain
                          )}`}
                        >
                          {ord.chain}
                        </span>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            ord.documentType === 'KOR'
                              ? 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {ord.documentType === 'KOR' ? '📝 Korekta KOR' : '🌸 Faktura VAT FA(3)'}
                        </span>

                        <span className="text-sm font-black text-slate-900 font-mono tracking-tight">
                          {ord.invoiceNumber}
                        </span>

                        {ord.orderNumber && (
                          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                            Zamówienie: {ord.orderNumber}
                          </span>
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

                        <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Wystawiono: {ord.issueDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* PRAWA STRONA: FINANSE & GŁÓWNY STATUS DORĘCZENIA */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                      {/* KWOTY */}
                      <div className="text-left lg:text-right">
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

                      {/* CHECKBOX: TOWAR DOTARŁ DO ODBIORCY */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
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

                  {/* POLE NOTATKI (Z AUTOMATYCZNYM ZAPISEM) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
                      <span>📝 Notatka:</span>
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Wpisz notatkę (np. nr listu przewozowego, uwagi kierowcy, stan przesyłki)..."
                        value={currentNote}
                        onChange={(e) => handleNoteChange(ord.id, e.target.value)}
                        onBlur={() => handleSaveNote(ord.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveNote(ord.id)}
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
                      {/* WYSTAW KOREKTĘ */}
                      <button
                        type="button"
                        onClick={() => onCreateCorrectionForOrder(ord)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl transition-colors cursor-pointer"
                        title="Wystaw oficjalną fakturę korygującą (KOR) do tej faktury"
                      >
                        <FileEdit className="w-3.5 h-3.5 text-fuchsia-600" />
                        <span>Wystaw Korektę</span>
                      </button>

                      {/* PODGLĄD XML */}
                      <button
                        type="button"
                        onClick={() => setViewXmlOrder(ord)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5 text-slate-500" />
                        <span>Podgląd XML</span>
                      </button>

                      {/* POBIERZ XML */}
                      <button
                        type="button"
                        onClick={() => handleDownloadXml(ord)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pobierz XML</span>
                      </button>

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
                    <div className="text-xs font-bold text-slate-700 mb-2">
                      Pozycje na fakturze {ord.invoiceNumber}:
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
                  <h3 className="text-sm font-bold text-slate-900">
                    Podgląd Archiwalnego XML: {viewXmlOrder.invoiceNumber}
                  </h3>
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
    </div>
  );
};
