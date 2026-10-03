import React from 'react';
import { ArrowLeft, FileText, FileEdit, CheckCircle2 } from 'lucide-react';
import { AppModule } from '../types/navigation';

interface SubpageHeaderBarProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  onNavigateHome: () => void;
  ordersCount: number;
  onOpenEdiPrototype?: () => void;
  onOpenZenboxModal?: () => void;
}

export const SubpageHeaderBar: React.FC<SubpageHeaderBarProps> = ({
  activeModule,
  onSelectModule,
  onNavigateHome,
  ordersCount,
  onOpenEdiPrototype,
  onOpenZenboxModal,
}) => {
  const isInvoiceCenter = activeModule === 'invoice' || activeModule === 'correction';
  const isKnowledgeCenter = activeModule === 'knowledge';

  return (
    <div className="mb-7 animate-in fade-in duration-150">
      {/* GÓRNY PASEK POWROTU DO MENU GŁÓWNEGO I SZYBKIEGO PRZEŁĄCZANIA CENTRÓW */}
      <div className="mb-4 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs group shrink-0"
          title="Wróć do strony startowej"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:-translate-x-0.5 transition-all" />
          <span>Wróć do menu głównego</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Szybki przełącznik między trzema Centrami */}
          <div className="hidden md:inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onSelectModule('invoice')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isInvoiceCenter
                  ? 'bg-white text-fuchsia-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🧾 Centrum Faktur
            </button>
            <button
              type="button"
              onClick={() => onSelectModule('history')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeModule === 'history'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Centrum Zamówień ({ordersCount})
            </button>
            <button
              type="button"
              onClick={() => onSelectModule('knowledge')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isKnowledgeCenter
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📚 Centrum Wiedzy (CRM)
            </button>
          </div>

          {onOpenZenboxModal && (
            <button
              type="button"
              onClick={onOpenZenboxModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl shadow-2xs transition-all cursor-pointer"
              title="Otwórz Skrzynkę Zamówień i Awizacji Zenbox"
            >
              <span>📬</span>
              <span>Skrzynka Zenbox</span>
            </button>
          )}

          {onOpenEdiPrototype && (
            <button
              type="button"
              onClick={onOpenEdiPrototype}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 rounded-xl shadow-xs transition-all cursor-pointer"
              title="Otwórz interaktywny prototyp komunikacji EDI DOZ Direct (ORDERS, ORDRSP, DESADV, INVOIC)"
            >
              <span>📡</span>
              <span>EDI DOZ (Prototyp)</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700">
            <span>
              {isInvoiceCenter
                ? '🏛️ Centrum Faktur'
                : isKnowledgeCenter
                ? '📚 Centrum Wiedzy'
                : '📦 Centrum Zamówień'}
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={
                isInvoiceCenter
                  ? 'text-fuchsia-700 font-black'
                  : isKnowledgeCenter
                  ? 'text-indigo-700 font-black'
                  : 'text-rose-700 font-black'
              }
            >
              {activeModule === 'invoice'
                ? '1. Wygeneruj Fakturę XML'
                : activeModule === 'correction'
                ? '2. Wygeneruj Korektę Faktury XML'
                : isKnowledgeCenter
                ? 'CRM Klientów Kluczowych'
                : 'Historia Zamówień'}
            </span>
          </span>
        </div>
      </div>

      {/* DLA CENTRUM FAKTUR: DWA DUŻE, BARDZO WIDOCZNE KAFELKI NA SAMEJ GÓRZE */}
      {isInvoiceCenter && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* KAFELEK 1: 1. WYGENERUJ FAKTURĘ XML */}
          <button
            type="button"
            onClick={() => onSelectModule('invoice')}
            className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
              activeModule === 'invoice'
                ? 'bg-gradient-to-br from-rose-50/90 via-fuchsia-50/60 to-white border-fuchsia-500 ring-2 ring-fuchsia-400/30 shadow-fuchsia-100 scale-[1.01]'
                : 'bg-white hover:bg-fuchsia-50/40 border-slate-200 hover:border-fuchsia-300'
            }`}
          >
            {activeModule === 'invoice' && (
              <span className="absolute top-3.5 right-3.5 flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100/90 px-2.5 py-0.5 rounded-full border border-fuchsia-300 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-fuchsia-600" /> Aktywny
              </span>
            )}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors shadow-xs ${
                  activeModule === 'invoice'
                    ? 'bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white shadow-fuchsia-300'
                    : 'bg-fuchsia-100 text-fuchsia-600'
                }`}
              >
                🧾
              </div>
              <div className="pr-12">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  1. WYGENERUJ FAKTURĘ XML
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Wczytaj zamówienie sieciowe, odczytaj serie i daty OCR, zweryfikuj z cennikiem XLSX i wygeneruj oficjalny XML FA(3) oraz WZ.
                </p>
              </div>
            </div>
          </button>

          {/* KAFELEK 2: 2. WYGENERUJ KOREKTĘ FAKTURY XML */}
          <button
            type="button"
            onClick={() => onSelectModule('correction')}
            className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
              activeModule === 'correction'
                ? 'bg-gradient-to-br from-rose-50/90 via-fuchsia-50/60 to-white border-fuchsia-500 ring-2 ring-fuchsia-400/30 shadow-fuchsia-100 scale-[1.01]'
                : 'bg-white hover:bg-fuchsia-50/40 border-slate-200 hover:border-fuchsia-300'
            }`}
          >
            {activeModule === 'correction' && (
              <span className="absolute top-3.5 right-3.5 flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100/90 px-2.5 py-0.5 rounded-full border border-fuchsia-300 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-fuchsia-600" /> Aktywny
              </span>
            )}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors shadow-xs ${
                  activeModule === 'correction'
                    ? 'bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white shadow-fuchsia-300'
                    : 'bg-fuchsia-100 text-fuchsia-600'
                }`}
              >
                📝
              </div>
              <div className="pr-12">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  2. WYGENERUJ KOREKTĘ FAKTURY XML
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Zaczytaj fakturę pierwotną z pliku PDF, XML lub z historii, podaj przyczynę korekty i wygeneruj oficjalną e-korektę KSeF.
                </p>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
