import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Calendar, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { ArchivedOrder } from '../types/ordersHistory';
import { downloadAvisoPdfFile } from '../utils/avisoPdfGenerator';

interface AvisoPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ArchivedOrder | null;
  onSaveAvisoDateTime?: (orderId: string, avisoDate: string, avisoTime: string) => Promise<void> | void;
}

export const AvisoPdfModal: React.FC<AvisoPdfModalProps> = ({
  isOpen,
  onClose,
  order,
  onSaveAvisoDateTime,
}) => {
  const [avisoDate, setAvisoDate] = useState<string>('');
  const [avisoTime, setAvisoTime] = useState<string>('13:00');
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  useEffect(() => {
    if (order && isOpen) {
      const initialDate =
        order.avisoDate ||
        order.deliveryDate ||
        order.issueDate ||
        new Date().toISOString().slice(0, 10);

      // Jeśli w avisoDate lub deliveryDate była zapisana godzina
      let initialTime = order.avisoTime || '';
      if (!initialTime) {
        const timeMatch = (order.avisoDate || order.deliveryDate || '').match(/\b(\d{2}:\d{2})\b/);
        if (timeMatch) {
          initialTime = timeMatch[1];
        } else {
          initialTime = '13:00';
        }
      }

      setAvisoDate(initialDate.slice(0, 10));
      setAvisoTime(initialTime);
      setDownloadNotice(null);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleDownloadPdf = async () => {
    const effectiveDate = avisoDate || new Date().toISOString().slice(0, 10);
    const effectiveTime = avisoTime || '13:00';

    // Pobierz plik PDF
    downloadAvisoPdfFile(effectiveDate, effectiveTime, order.orderNumber || order.invoiceNumber);

    // Zapisz zaktualizowaną datę i godzinę awizacji na karcie zamówienia
    if (onSaveAvisoDateTime) {
      try {
        await onSaveAvisoDateTime(order.id, effectiveDate, effectiveTime);
      } catch (err) {
        console.warn('Błąd zapisu daty awizacji na karcie:', err);
      }
    }

    setDownloadNotice('✅ Pomyślnie pobrano plik PDF awizacji i zapisano na karcie zamówienia!');
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  const displayOrderNo = order.orderNumber || order.invoiceNumber || 'Zamówienie';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      {/* Style do bezpośredniego wydruku na drukarce (A4 poziomo) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #aviso-pdf-printable-sheet, #aviso-pdf-printable-sheet * {
            visibility: visible !important;
          }
          #aviso-pdf-printable-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95">
        {/* GÓRNY PASEK MODALU */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shrink-0 shadow-inner">
              📄
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                Plik PDF Awizacji Dostawy (Karta Zamówienia)
              </h2>
              <p className="text-xs text-amber-100 truncate">
                Zamówienie nr: <strong className="text-white font-mono">{displayOrderNo}</strong> · {order.chain} ({order.buyer?.name || ''})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PASEK KONTROLNY: EDYCJA DATY I GODZINY + PRZYCISKI AKCJI */}
        <div className="p-4 sm:p-5 bg-amber-50/70 border-b border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[11px] font-bold text-amber-950 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span>Data awizacji (dostawy):</span>
              </label>
              <input
                type="date"
                value={avisoDate}
                onChange={(e) => setAvisoDate(e.target.value)}
                className="text-xs sm:text-sm font-mono font-bold bg-white border-2 border-amber-300 focus:border-amber-600 rounded-xl px-3 py-1.5 text-slate-900 shadow-2xs focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-amber-950 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Godzina awizacji:</span>
              </label>
              <input
                type="time"
                value={avisoTime}
                onChange={(e) => setAvisoTime(e.target.value)}
                className="text-xs sm:text-sm font-mono font-bold bg-white border-2 border-amber-300 focus:border-amber-600 rounded-xl px-3 py-1.5 text-slate-900 shadow-2xs focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* PRZYCISK DRUKUJ */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Wydrukuj arkusz A4 na drukarce"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Drukuj</span>
            </button>

            {/* GŁÓWNY PRZYCISK: POBIERZ PLIK PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-md transition-all hover:scale-[1.02] cursor-pointer"
              title="Pobierz plik PDF na komputer / telefon"
            >
              <Download className="w-4 h-4" />
              <span>Pobierz plik PDF</span>
            </button>
          </div>
        </div>

        {downloadNotice && (
          <div className="bg-emerald-100 border-b border-emerald-300 text-emerald-950 px-5 py-2.5 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadNotice}</span>
          </div>
        )}

        {/* PODGLĄD ARKUSZA A4 (ODPOWIADA 100% WZORCOWI ZE ZDJĘCIA) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/80 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Podgląd arkusza A4 Poziomo (Landscape)
            </div>

            {/* KARTKA A4 POZIOMO */}
            <div
              id="aviso-pdf-printable-sheet"
              className="bg-white border-2 border-slate-300 rounded-2xl shadow-xl w-full aspect-[297/210] flex flex-col items-center justify-center p-8 select-none transition-all"
            >
              <div className="text-center">
                <div className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-950 font-sans mb-8 sm:mb-12">
                  AWIZACJA
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-950 font-sans mb-5 sm:mb-8 font-mono">
                  {avisoDate || '2026-11-09'}
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-950 font-sans font-mono">
                  {avisoTime || '13:00'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              Arkusz jest generowany jako gotowy do naklejenia lub wydruku dokument PDF w formacie A4 Poziomo.
            </p>
          </div>
        </div>

        {/* DOLNY PASEK */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Dane awizacji pobrane z karty zamówienia <strong className="font-mono text-slate-800">{displayOrderNo}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
