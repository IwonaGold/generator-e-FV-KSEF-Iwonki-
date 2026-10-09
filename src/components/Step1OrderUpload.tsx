import React, { useRef, useState } from 'react';
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
} from 'lucide-react';
import { SAMPLE_ORDER_DOCUMENT_TEXT, SAMPLE_ORDER_SUPER_PHARM_TEXT } from '../utils/sampleData';
import { InvoiceItem, InvoiceMeta, ParsedOrderData } from '../types/ksef';
import { fixPolishMojibake } from '../utils/textEncoding';
import { parseOrderFromFile, parseOrderText as parseOrderTextUtil } from '../utils/orderParser';

interface Step1OrderUploadProps {
  onOrderTextParsed: (
    parsedItems: Partial<InvoiceItem>[],
    rawText: string,
    parsedHeader?: ParsedOrderData
  ) => void;
  orderFile: { name: string; size: string } | null;
  onOrderFileChange: (fileInfo: { name: string; size: string } | null) => void;
  itemsCount: number;
  meta: InvoiceMeta;
  onUpdateMeta: (meta: InvoiceMeta) => void;
}

export const Step1OrderUpload: React.FC<Step1OrderUploadProps> = ({
  onOrderTextParsed,
  orderFile,
  onOrderFileChange,
  itemsCount,
  meta,
  onUpdateMeta,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const orderInputRef = useRef<HTMLInputElement>(null);

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

  const applyParsedResult = (
    items: Partial<InvoiceItem>[],
    rawText: string,
    headerData?: ParsedOrderData
  ) => {
    if (headerData) {
      onUpdateMeta({
        ...meta,
        orderNumber: headerData.orderNumber || meta.orderNumber,
        orderDate: headerData.orderDate || meta.orderDate,
        dueDate: headerData.dueDate || meta.dueDate,
        deliveryDate: headerData.deliveryDate || meta.deliveryDate,
        paymentDays: headerData.paymentDays || meta.paymentDays,
      });
    }
    if (items.length > 0) {
      onOrderTextParsed(items, rawText, headerData);
    }
  };

  const processOrderFile = async (file: File) => {
    setIsParsing(true);
    const sizeKb = (file.size / 1024).toFixed(1) + ' KB';
    const fileInfo = { name: file.name, size: sizeKb };
    onOrderFileChange(fileInfo);

    try {
      const result = await parseOrderFromFile(file);
      applyParsedResult(result.items, result.rawText || '', result.headerData);
    } catch (err) {
      console.error('Błąd odczytu pliku zamówienia:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const loadSampleOrderDrMax = () => {
    const fileInfo = {
      name: 'zamowienie_ZZ_1009_09_26_DrMax.txt',
      size: '2.1 KB',
    };
    onOrderFileChange(fileInfo);
    const res = parseOrderTextUtil(SAMPLE_ORDER_DOCUMENT_TEXT);
    applyParsedResult(res.items, res.rawText || '', res.headerData);
  };

  const loadSampleOrderSuperPharm = () => {
    const fileInfo = {
      name: 'zamowienie_C008848894_SuperPharm.txt',
      size: '2.8 KB',
    };
    onOrderFileChange(fileInfo);
    const res = parseOrderTextUtil(SAMPLE_ORDER_SUPER_PHARM_TEXT);
    applyParsedResult(res.items, res.rawText || '', res.headerData);
  };

  /**
   * Wyciąga metadane nagłówka zamówienia: numer zamówienia, datę złożenia, termin płatności, datę dostawy
   */
  const extractOrderHeader = (text: string): ParsedOrderData => {
    const result: ParsedOrderData = {};

    // 1. Numer zamówienia
    const orderNumMatch =
      text.match(
        /(?:Numer zamówienia|Nr zamówienia|Zamówienie nr|Zamówienie|Order No|PO Number|PO)[:\s]+([A-Za-z0-9\-\_\/]+)/i
      ) || text.match(/Zamówienie:\s*([A-Za-z0-9\-\_\/]+)/i);
    if (orderNumMatch) {
      result.orderNumber = orderNumMatch[1].trim();
    }

    // 2. Data złożenia zamówienia
    const orderDateMatch = text.match(
      /(?:Data złożenia zamówienia|Data zamówienia|Data zam|Data wystawienia zamówienia|Order Date)[:\s]+(\d{4}[-./]\d{2}[-./]\d{2})/i
    );
    if (orderDateMatch) {
      result.orderDate = orderDateMatch[1].replace(/\./g, '-').replace(/\//g, '-').trim();
    }

    // 3. Termin płatności (data)
    const dueDateMatch = text.match(
      /(?:Termin płatności|Termin platnosci|Płatność do|Platnosc do|Termin zapłaty|Termin)[:\s]+(\d{4}[-./]\d{2}[-./]\d{2})/i
    );
    if (dueDateMatch) {
      result.dueDate = dueDateMatch[1].replace(/\./g, '-').replace(/\//g, '-').trim();
    }

    // 4. Termin płatności (dni)
    const paymentDaysMatch = text.match(
      /(?:Termin płatności|Termin platnosci|Płatność|Platnosc)[:\s]+(\d+)\s*(?:dni|days)/i
    );
    if (paymentDaysMatch) {
      result.paymentDays = parseInt(paymentDaysMatch[1], 10);
      if (!result.dueDate) {
        const baseDate = result.orderDate ? new Date(result.orderDate) : new Date();
        baseDate.setDate(baseDate.getDate() + result.paymentDays);
        result.dueDate = baseDate.toISOString().slice(0, 10);
      }
    }

    // 5. Data dostawy
    const deliveryDateMatch = text.match(
      /(?:Data dostawy|Termin dostawy|Data realizacji|Dostawa)[:\s]+(\d{4}[-./]\d{2}[-./]\d{2})/i
    );
    if (deliveryDateMatch) {
      result.deliveryDate = deliveryDateMatch[1].replace(/\./g, '-').replace(/\//g, '-').trim();
    }

    // 6. NIP Nabywcy
    const nipMatch = text.match(/(?:Nabywca|Kupujący)[^\n]*?(?:NIP:?\s*(\d{10}))/i);
    if (nipMatch) {
      result.buyerNip = nipMatch[1];
    }

    // 7. Odbiorca / ID-Wew
    const idWewMatch = text.match(/(?:ID-Wew|Identyfikator wewnętrzny)[:\s]+([0-9\-]+)/i);
    if (idWewMatch) {
      result.recipientIdWew = idWewMatch[1].trim();
    }

    return result;
  };

  /**
   * Sprawdza, czy linia lub fragment tekstu to metadane nagłówka (termin płatności, data, dostawca, itp.),
   * aby NIGDY nie zostały błędnie wczytane jako pozycja towarowa.
   */
  const isHeaderMetadataLine = (lineStr: string): boolean => {
    const lower = lineStr.toLowerCase().trim();
    if (!lower) return true;

    const headerPrefixes = [
      'dokument',
      'zamówienie',
      'zamowienie',
      'termin',
      'płatność',
      'platnosc',
      'dostawca',
      'sprzedawca',
      'nabywca',
      'kupujący',
      'kupujacy',
      'odbiorca',
      'magazyn',
      'dostawa',
      'pozycje',
      'pozycja',
      'data',
      'wartość',
      'wartosc',
      'razem',
      'suma',
      'podsumowanie',
      'nagłówek',
      'naglowek',
      'uwagi',
      'numer zamówienia',
      'nr zamówienia',
      'lp.',
      'lp ',
      'l.p.',
    ];

    if (headerPrefixes.some((p) => lower.startsWith(p))) {
      return true;
    }

    if (
      lower.includes('termin płatności') ||
      lower.includes('termin platnosci') ||
      lower.includes('data zamówienia') ||
      lower.includes('data zam') ||
      lower.includes('data złożenia') ||
      lower.includes('data dostawy') ||
      lower.includes('numer zamówienia') ||
      lower.includes('nr zamówienia') ||
      lower.includes('forma płatności') ||
      lower.includes('forma platnosci')
    ) {
      return true;
    }

    return false;
  };

  const parseOrderText = (text: string) => {
    const cleanedText = fixPolishMojibake(text);
    const headerData = extractOrderHeader(cleanedText);

    // Automatycznie zaktualizuj stan metadanych faktury danymi wyciągniętymi z zamówienia
    onUpdateMeta({
      ...meta,
      orderNumber: headerData.orderNumber || meta.orderNumber,
      orderDate: headerData.orderDate || meta.orderDate,
      dueDate: headerData.dueDate || meta.dueDate,
      deliveryDate: headerData.deliveryDate || meta.deliveryDate,
      paymentDays: headerData.paymentDays || meta.paymentDays,
    });

    const lines = cleanedText.split(/\r?\n/);
    const items: Partial<InvoiceItem>[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isHeaderMetadataLine(trimmed)) return;

      // Obsługa różnych formatów linii zamówienia
      if (trimmed.includes('|') || trimmed.match(/^\s*\d+[\.\)]/)) {
        const parts = trimmed.split('|').map((p) => p.trim());
        const namePart = parts[0]?.replace(/^\s*\d+[\.\)]\s*/, '').trim();

        if (
          namePart &&
          namePart.length > 2 &&
          !isHeaderMetadataLine(namePart)
        ) {
          const eanMatch =
            trimmed.match(/(?:EAN|GTIN|Kod):\s*(\d{8,14})/i) || trimmed.match(/(\d{13,14})/);
          const blozMatch = trimmed.match(/BLOZ(?:-7)?:\s*(\d{7})/i);
          const qtyMatch =
            trimmed.match(/(?:Ilość|Ilosc|Qty|Szt):\s*(\d+)/i) ||
            trimmed.match(/(\d+)\s*(?:szt|op|opak)/i);
          const priceMatch =
            trimmed.match(/(?:Cena|Netto|PLN):\s*([\d\s]+[\.,]\d{2})/i) ||
            trimmed.match(/([\d]+[\.,]\d{2})\s*(?:zł|pln)/i);
          const vatMatch = trimmed.match(/VAT:\s*(\d{1,2}%|zw)/i) || trimmed.match(/(\d{1,2}%)/);

          const rawPrice = priceMatch
            ? priceMatch[1].replace(/\s/g, '').replace(',', '.')
            : '100.00';

          items.push({
            name: fixPolishMojibake(namePart),
            gtin: eanMatch ? eanMatch[1] : '9120000000000',
            bloz7: blozMatch ? blozMatch[1] : undefined,
            quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
            unit: 'SZT.',
            netPrice: parseFloat(rawPrice) || 100.0,
            vatRate: (vatMatch ? vatMatch[1] : '8%') as any,
          });
        }
      }
    });

    if (items.length > 0) {
      onOrderTextParsed(items, cleanedText, headerData);
    }
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Krok 1: Dokument Zamówienia (Wczytaj asortyment i nagłówek)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Wgraj specyfikację zamówienia hurtowego lub aptecznego. Automatyczne zaczytywanie numeru zamówienia, daty złożenia, terminu płatności i dostawy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadSampleOrderSuperPharm}
            className="text-[11px] font-medium text-purple-800 hover:text-purple-950 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            title="Załaduj 10 pozycji asortymentowych z zamówienia C008848894 (Super-Pharm)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Wzorzec Super-Pharm (FV 35/2026)</span>
          </button>
          <button
            onClick={loadSampleOrderDrMax}
            className="text-[11px] font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Wzorzec Dr. Max (FV 41/2026)</span>
          </button>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleOrderDrop}
        onClick={() => orderInputRef.current?.click()}
        className={`mt-4 border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50/60'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={orderInputRef}
          type="file"
          accept=".xlsx,.xls,.pdf,.txt,.csv,.xml,.html,.htm"
          onChange={handleOrderChange}
          className="hidden"
        />
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-blue-600">
          <Upload className="w-4 h-4" />
        </div>
        <p className="text-xs font-semibold text-slate-800">
          Przeciągnij plik PDF / HTML / Excel / TXT / CSV lub kliknij, aby wybrać dokument zamówienia
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Obsługa formatów Kamsoft, OSOZ, hurtowni Neuca, Farmacol, PGF z automatycznym wykrywaniem kodowania Windows-1250 i UTF-8
        </p>
      </div>

      {/* Active File Feedback */}
      {orderFile && (
        <div className="mt-3.5 p-3 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-medium text-slate-900 truncate">{orderFile.name}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                {orderFile.size} · Wyodrębniono {itemsCount} pozycji towarowych
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOrderFileChange(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
            title="Wyczyść plik"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SEKCJA ZACZYTANYCH DANYCH Z ZAMÓWIENIA (Data złożenia, Termin płatności, Numer zamówienia, Dostawa) */}
      <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Dane zamówienia i płatności (zaczytane z dokumentu do faktury)
          </span>
          <span className="text-[11px] text-slate-500">
            Synchronizowane bezpośrednio z nagłówkiem faktury KSeF
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Numer zamówienia */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <Hash className="w-3 h-3 text-slate-500" />
              Numer zamówienia (NrZamowienia)
            </label>
            <input
              type="text"
              value={meta.orderNumber || ''}
              onChange={(e) => onUpdateMeta({ ...meta, orderNumber: e.target.value })}
              placeholder="np. C008848894"
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Data złożenia zamówienia */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              Data złożenia zamówienia (DataZamowienia)
            </label>
            <input
              type="date"
              value={meta.orderDate || ''}
              onChange={(e) => onUpdateMeta({ ...meta, orderDate: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Termin płatności */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-emerald-600" />
                Termin płatności (Termin)
              </label>
            </div>
            <input
              type="date"
              value={meta.dueDate || ''}
              onChange={(e) => onUpdateMeta({ ...meta, dueDate: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
            />
            {/* Szybkie przyciski dni płatności (od daty dostawy) */}
            <div className="flex items-center gap-1 mt-1 text-[10px]">
              <span className="text-slate-400">Od dostawy:</span>
              <button
                type="button"
                onClick={() => setPaymentDaysFromDelivery(30)}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
                  meta.paymentDays === 30
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                30d
              </button>
              <button
                type="button"
                onClick={() => setPaymentDaysFromDelivery(45)}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
                  meta.paymentDays === 45
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                45d
              </button>
              <button
                type="button"
                onClick={() => setPaymentDaysFromDelivery(60)}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
                  meta.paymentDays === 60
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                60d
              </button>
            </div>
          </div>

          {/* Data dostawy */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <Truck className="w-3 h-3 text-slate-500" />
              Data dostawy (P_6)
            </label>
            <input
              type="date"
              value={meta.deliveryDate || ''}
              onChange={(e) => onUpdateMeta({ ...meta, deliveryDate: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
