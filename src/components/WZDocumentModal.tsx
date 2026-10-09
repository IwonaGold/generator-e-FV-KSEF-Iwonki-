import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  FileText,
  Building2,
  Calendar,
  Package,
  Truck,
  Warehouse,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import { EntityDetails, ThirdPartyEntity, InvoiceMeta, InvoiceItem, PharmacyChain } from '../types/ksef';
import { downloadOrderCSVFile } from '../utils/orderCsvGenerator';

interface WZDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;
  meta: InvoiceMeta;
  items: InvoiceItem[];
  selectedChain?: PharmacyChain;
}

export const WZDocumentModal: React.FC<WZDocumentModalProps> = ({
  isOpen,
  onClose,
  seller,
  buyer,
  thirdParty,
  meta,
  items,
  selectedChain,
}) => {
  const [copied, setCopied] = useState(false);
  const [wzNumber, setWzNumber] = useState<string>(() => {
    const rawInv = meta.invoiceNumber || meta.orderNumber || '1';
    const cleanInv = rawInv.replace(/^FA\/?/i, '').replace(/\/KSEF$/i, '');
    const currentYear = new Date().getFullYear();
    return `WZ/${cleanInv}/${currentYear}`;
  });
  const [issueDate, setIssueDate] = useState<string>(meta.issueDate || new Date().toISOString().slice(0, 10));
  const [releaseDate, setReleaseDate] = useState<string>(meta.deliveryDate || meta.issueDate || new Date().toISOString().slice(0, 10));
  const [remarks] = useState<string>(
    'Towar zabezpieczony, w nienaruszonych opakowaniach fabrycznych.'
  );

  // Synchronizacja numeru WZ i dat przy otwarciu lub zmianie metadanych
  useEffect(() => {
    if (isOpen) {
      const rawInv = meta.invoiceNumber || meta.orderNumber || '1';
      const cleanInv = rawInv.replace(/^FA\/?/i, '').replace(/\/KSEF$/i, '');
      const currentYear = new Date().getFullYear();
      setWzNumber(`WZ/${cleanInv}/${currentYear}`);
      setIssueDate(meta.issueDate || new Date().toISOString().slice(0, 10));
      setReleaseDate(meta.deliveryDate || meta.issueDate || new Date().toISOString().slice(0, 10));
    }
  }, [isOpen, meta.invoiceNumber, meta.orderNumber, meta.issueDate, meta.deliveryDate]);

  if (!isOpen) return null;

  // Bezpieczne pobieranie ceny jednostkowej i ilości z obiektu pozycji
  const getItemPrice = (it: any): number => {
    return Number(it.netPrice ?? it.unitPriceNet ?? it.originalNetPrice ?? it.correctedNetPrice ?? 0);
  };
  const getItemQty = (it: any): number => {
    return Number(it.quantity ?? it.correctedQuantity ?? 0);
  };

  // Obliczenia podsumowań
  const totalQuantity = items.reduce((sum, it) => sum + getItemQty(it), 0);
  const totalNet = items.reduce((sum, it) => sum + Math.round(getItemQty(it) * getItemPrice(it) * 100) / 100, 0);

  // Obsługa drukowania (A4)
  const handlePrint = () => {
    window.print();
  };

  // Kopiowanie zestawienia pozycji WZ do schowka
  const handleCopyText = () => {
    let txt = `DOKUMENT WZ: ${wzNumber}\nData wystawienia: ${issueDate} | Data wydania: ${releaseDate}\n`;
    txt += `Wystawca: ${seller.name} (NIP: ${seller.nip})\n`;
    txt += `Odbiorca: ${buyer.name} (NIP: ${buyer.nip})\n`;
    if (thirdParty) {
      txt += `Miejsce dostawy: ${thirdParty.name}, ${thirdParty.city}\n`;
    }
    txt += `\nPOZYCJE:\n`;
    items.forEach((it, idx) => {
      const price = getItemPrice(it);
      const qty = getItemQty(it);
      const lineNet = Math.round(qty * price * 100) / 100;
      txt += `${idx + 1}. ${it.name} | EAN: ${it.gtin || '—'} | LOT: ${it.batchNumber || '—'} | EXP: ${it.expiryDate || '—'} | Ilość: ${qty} ${it.unit || 'szt.'} | Cena netto: ${price.toFixed(2)} zł | Wartość netto: ${lineNet.toFixed(2)} zł\n`;
    });
    txt += `\nŁącznie sztuk: ${totalQuantity}\nWartość netto: ${totalNet.toFixed(2)} PLN\n`;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pobieranie jako plik HTML gotowy do otwarcia
  const handleDownloadHtml = () => {
    const printArea = document.getElementById('wz-printable-content');
    if (!printArea) return;

    const fullHtml = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <title>Dokument_${wzNumber.replace(/[\/\\]/g, '_')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 25px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: monospace; }
  </style>
</head>
<body>
  ${printArea.innerHTML}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dokument_${wzNumber.replace(/[\/\\]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      {/* Style do wydruku czystego A4 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #wz-printable-content, #wz-printable-content * {
            visibility: visible !important;
          }
          #wz-printable-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Nagłówek modalu */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-fuchsia-50/60 via-pink-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>DOKUMENT WZ – WYDANIE ZEWNĘTRZNE</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-fuchsia-100 text-fuchsia-800 font-bold border border-fuchsia-200">
                  Magazyn Farmaceutyczny
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Oficjalny dokument wydania magazynowego towaru dla kierowcy / do paczki aptecznej.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Drukuj lub zapisz jako PDF za pomocą okna drukowania przeglądarki"
            >
              <Printer className="w-4 h-4" />
              <span>Drukuj / Zapisz PDF</span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadOrderCSVFile({
                  seller,
                  buyer,
                  thirdParty,
                  meta,
                  items,
                  selectedChain,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Pobierz płaski plik CSV z zamówieniem gotowy do importu do systemu e-commerce / ERP (Sellrocket)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Pobierz CSV zamówienia</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Pobierz plik HTML dokumentu"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pobierz HTML</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Kopiuj tekst specyfikacji WZ"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Skopiowano!' : 'Kopiuj'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              title="Zamknij"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pasek szybkiej konfiguracji parametrów WZ */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Numer WZ:</span>
            <input
              type="text"
              value={wzNumber}
              onChange={(e) => setWzNumber(e.target.value)}
              className="px-2 py-0.5 font-mono text-xs font-bold bg-white border border-slate-300 rounded focus:border-fuchsia-500 text-slate-900 w-44"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Data wystawienia:</span>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="px-2 py-0.5 font-mono text-xs bg-white border border-slate-300 rounded focus:border-fuchsia-500 text-slate-900 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Data wydania towaru:</span>
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className="px-2 py-0.5 font-mono text-xs bg-white border border-slate-300 rounded focus:border-fuchsia-500 text-slate-900 cursor-pointer"
            />
          </div>
        </div>

        {/* Treść dokumentu WZ (gotowa do podglądu i druku) */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
          <div
            id="wz-printable-content"
            className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 text-slate-900 max-w-3xl mx-auto"
          >
            {/* Nagłówek WZ */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                    DOKUMENT WZ
                  </h1>
                  <div className="text-sm font-bold text-slate-600 tracking-wide uppercase mt-0.5">
                    Wydanie Zewnętrzne towaru z magazynu
                  </div>
                  <div className="text-xs font-mono font-bold text-fuchsia-800 mt-1">
                    Nr: {wzNumber}
                  </div>
                </div>

                <div className="text-right text-xs space-y-1">
                  <div>
                    <span className="text-slate-500">Data wystawienia: </span>
                    <span className="font-bold font-mono">{issueDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Data wydania towaru: </span>
                    <span className="font-bold font-mono">{releaseDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Miejsce: </span>
                    <span className="font-medium">{meta.issuePlace || 'Gdańsk'}</span>
                  </div>
                  {meta.invoiceNumber && (
                    <div className="pt-1 text-[11px] text-slate-600 font-mono">
                      Do Faktury VAT: <span className="font-bold">{meta.invoiceNumber}</span>
                    </div>
                  )}
                  {meta.orderNumber && (
                    <div className="text-[11px] text-slate-600 font-mono">
                      Do Zamówienia: <span className="font-bold">{meta.orderNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dwie kolumny: Wystawca i Odbiorca */}
            <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
              {/* WYSTAWCA */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Wydający (Wystawca):
                </div>
                <div className="font-bold text-sm text-slate-900">{seller.name}</div>
                <div className="text-slate-700 mt-1">{seller.street}</div>
                <div className="text-slate-700">{seller.postalCode} {seller.city}</div>
                <div className="font-mono mt-1 text-slate-800">
                  <span className="text-slate-500">NIP: </span>
                  <span className="font-bold">{seller.nip}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Magazyn: Magazyn Główny Eubiosis · BDO: 000585744
                </div>
              </div>

              {/* ODBIORCA */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Odbiorca (Nabywca):
                </div>
                <div className="font-bold text-sm text-slate-900">{buyer.name}</div>
                <div className="text-slate-700 mt-1">{buyer.street}</div>
                <div className="text-slate-700">{buyer.postalCode} {buyer.city}</div>
                <div className="font-mono mt-1 text-slate-800">
                  <span className="text-slate-500">NIP: </span>
                  <span className="font-bold">{buyer.nip}</span>
                </div>

                {thirdParty && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-600">Miejsce dostawy: </span>
                    <span>{thirdParty.name}, {thirdParty.city}</span>
                    {thirdParty.gln && (
                      <span className="font-mono block text-slate-500">GLN: {thirdParty.gln}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabela pozycji towarowych WZ z seriami i datami ważności */}
            <div className="mb-6">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-y border-slate-300">
                    <th className="py-2 px-2 text-center w-8 font-bold">Lp.</th>
                    <th className="py-2 px-2 text-left font-bold">Nazwa towaru / leku</th>
                    <th className="py-2 px-2 text-left font-bold font-mono">Kod EAN (GTIN)</th>
                    <th className="py-2 px-2 text-center font-bold font-mono">Seria (LOT)</th>
                    <th className="py-2 px-2 text-center font-bold font-mono">Ważność (EXP)</th>
                    <th className="py-2 px-2 text-right font-bold w-16">Ilość</th>
                    <th className="py-2 px-2 text-center font-bold w-12">J.m.</th>
                    <th className="py-2 px-2 text-right font-bold font-mono w-24">Cena netto</th>
                    <th className="py-2 px-2 text-right font-bold font-mono w-24">Wartość netto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {items.map((it, idx) => {
                    const price = getItemPrice(it);
                    const qty = getItemQty(it);
                    const lineNet = Math.round(qty * price * 100) / 100;
                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-2 text-left font-sans font-medium text-slate-900">{it.name}</td>
                        <td className="py-2 px-2 text-left text-slate-700">{it.gtin || '—'}</td>
                        <td className="py-2 px-2 text-center font-bold text-slate-900 bg-slate-50/50">
                          {it.batchNumber || '—'}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-800">{it.expiryDate || '—'}</td>
                        <td className="py-2 px-2 text-right font-bold text-slate-900">{qty}</td>
                        <td className="py-2 px-2 text-center text-slate-600 font-sans">{it.unit || 'szt.'}</td>
                        <td className="py-2 px-2 text-right text-slate-700 font-bold">{price.toFixed(2)} zł</td>
                        <td className="py-2 px-2 text-right font-bold text-slate-900">{lineNet.toFixed(2)} zł</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold text-xs">
                    <td colSpan={5} className="py-2 px-2 text-right uppercase">
                      Razem:
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-900">
                      {totalQuantity}
                    </td>
                    <td className="py-2 px-2 text-center">szt.</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-500"></td>
                    <td className="py-2 px-2 text-right font-mono text-slate-900">
                      {totalNet.toFixed(2)} PLN
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Uwagi magazynowe */}
            <div className="mb-8 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-700">Uwagi / Warunki transportu: </span>
              <span className="text-slate-600">{remarks}</span>
            </div>

            {/* Podpisy (Wydający i Odbierający) */}
            <div className="grid grid-cols-2 gap-10 pt-6 border-t border-slate-300 text-xs">
              <div className="text-center">
                <div className="border-b border-dashed border-slate-400 pb-8 mb-2"></div>
                <div className="font-bold text-slate-800 uppercase text-[11px]">Towar wydał (Magazynier)</div>
                <div className="text-[10px] text-slate-500">Podpis i pieczęć wystawcy</div>
              </div>

              <div className="text-center">
                <div className="border-b border-dashed border-slate-400 pb-8 mb-2"></div>
                <div className="font-bold text-slate-800 uppercase text-[11px]">Towar odebrał (Kierowca / Odbiorca)</div>
                <div className="text-[10px] text-slate-500">Data, czytelny podpis i pieczęć odbiorcy</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stopka modalu */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Pozycji towarowych: <strong className="text-slate-800">{items.length}</strong></span>
            <span>·</span>
            <span>Łącznie sztuk: <strong className="text-slate-800">{totalQuantity}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
