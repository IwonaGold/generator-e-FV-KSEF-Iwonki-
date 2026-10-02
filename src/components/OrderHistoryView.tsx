import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import {
  ArchivedOrder,
  OrderChainFilter,
  OrderStatusFilter,
  OrderPaymentFilter,
  OrderDatePeriodFilter,
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

  // Stan lokalny edycji numeru faktury (i generowania z XML)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceNumberState, setInvoiceNumberState] = useState<Record<string, string>>({});
  const [savingInvoiceId, setSavingInvoiceId] = useState<string | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);

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
      const resolved = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);
      if (counts[resolved] !== undefined) {
        counts[resolved]++;
      } else {
        counts.Inne++;
      }
    });

    return counts;
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

  // Obliczenia liczników dla okresów
  const periodCounts = useMemo(() => {
    return calculatePeriodCounts(orders);
  }, [orders]);

  // Informacja o aktualnie wybranym zakresie dat
  const activePeriodInfo = useMemo(() => {
    return getDateRangeForPeriod(periodFilter, customDateFrom, customDateTo);
  }, [periodFilter, customDateFrom, customDateTo]);

  // Filtrowanie listy zamówień
  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return orders.filter((ord) => {
      const resolvedChain = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);

      // 1. Filtr sieci
      if (chainFilter !== 'Wszystkie' && resolvedChain !== chainFilter) {
        return false;
      }

      // 2. Filtr statusu dostawy
      if (statusFilter === 'delivered' && !ord.isDelivered) return false;
      if (statusFilter === 'pending' && ord.isDelivered) return false;

      // 2b. Filtr statusu płatności
      if (paymentFilter !== 'all') {
        const isPaid = ord.paymentStatus === 'paid';
        const dueDate = ord.paymentDueDate || ord.dueDate;
        const isOverdue = !isPaid && Boolean(dueDate && dueDate < todayStr);

        if (paymentFilter === 'paid' && !isPaid) return false;
        if (paymentFilter === 'pending' && (isPaid || isOverdue)) return false;
        if (paymentFilter === 'overdue' && !isOverdue) return false;
      }

      // 2c. Filtr okresu / daty wystawienia
      if (periodFilter !== 'all') {
        const orderDate = ord.issueDate || ord.createdAt;
        if (!isOrderInPeriod(orderDate, periodFilter, customDateFrom, customDateTo)) {
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

        if (!matchesInv && !matchesOrd && !matchesBuyer && !matchesRecipient && !matchesNotes && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [orders, chainFilter, statusFilter, paymentFilter, periodFilter, customDateFrom, customDateTo, searchQuery]);

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
        const extracted = extractInvoiceNumberFromXml(text);
        const effectiveNum = extracted || (order.invoiceNumber && order.invoiceNumber !== 'FAKTURA' ? order.invoiceNumber : 'FAKTURA');

        await updateArchivedOrderFields(order.id, {
          xmlContent: text,
          invoiceNumber: effectiveNum,
        });

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
              onClick={onNavigateToInvoiceCreation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nowe Zamówienie</span>
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
            {/* Filtr dostawy */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium text-[11px]">Dostawa:</span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => setStatusFilter('delivered')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'delivered'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ✅ Doręczone
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🚚 W drodze
                </button>
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

        {/* FILTR OKRESU (DATA WYSTAWIENIA FAKTURY / ZAMÓWIENIA) */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center text-xl mb-3">
            🌸
          </div>
          <h3 className="text-sm font-bold text-slate-800">Brak zamówień spełniających kryteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Zmień filtry lub wygeneruj nowe zamówienie za pomocą kafelka &quot;1. WYGENERUJ FAKTURĘ XML&quot;.
          </p>
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
                            displayChain
                          )}`}
                        >
                          {displayChain === 'Inne' ? 'Inne (Klient)' : displayChain}
                        </span>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            ord.documentType === 'KOR'
                              ? 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {ord.documentType === 'KOR' ? '📝 Korekta KOR' : '📄 Faktura VAT FA(3)'}
                        </span>

                        {/* DEDYKOWANE MIEJSCE NA NUMER FAKTURY (Z GENEROWANIEM Z XML) */}
                        {isEditingThisInvoice ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50/90 border border-rose-300 rounded-xl px-2.5 py-1 shadow-2xs">
                            <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="text-[11px] font-bold text-rose-800">Nr faktury:</span>
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
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nr faktury:</span>
                            <span className="text-sm font-black text-slate-900 font-mono tracking-tight select-all">
                              {effectiveInvoiceNumber}
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
                      {/* WYGENERUJ KOREKTĘ */}
                      <button
                        type="button"
                        onClick={() => onCreateCorrectionForOrder(ord)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-xl transition-colors cursor-pointer"
                        title="Wygeneruj oficjalną fakturę korygującą (KOR) do tej faktury"
                      >
                        <FileEdit className="w-3.5 h-3.5 text-fuchsia-600" />
                        <span>Wygeneruj Korektę</span>
                      </button>

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
    </div>
  );
};
