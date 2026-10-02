import React from 'react';
import { FileText, FileEdit, History, CheckCircle2, ChevronRight, Sparkles, Building2, PackageCheck } from 'lucide-react';

export type AppModule = 'invoice' | 'correction' | 'history';

interface ModuleTilesNavProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  ordersCount: number;
}

export const ModuleTilesNav: React.FC<ModuleTilesNavProps> = ({
  activeModule,
  onSelectModule,
  ordersCount,
}) => {
  const isInvoiceCenterActive = activeModule === 'invoice' || activeModule === 'correction';
  const isOrdersCenterActive = activeModule === 'history';

  return (
    <div className="mb-7">
      {/* ==================================================================== */}
      {/* 2 GŁÓWNE OPCJE STARTOWE: CENTRUM FAKTUR / CENTRUM ZAMÓWIEŃ          */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4">
        {/* OPCJA 1: CENTRUM FAKTUR */}
        <div
          onClick={() => {
            if (!isInvoiceCenterActive) {
              onSelectModule('invoice');
            }
          }}
          className={`relative text-left p-5 sm:p-6 rounded-3xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between ${
            isInvoiceCenterActive
              ? 'bg-gradient-to-br from-rose-50/90 via-fuchsia-50/60 to-white border-fuchsia-500 ring-2 ring-fuchsia-400/25 shadow-fuchsia-100/60 scale-[1.01]'
              : 'bg-white hover:bg-fuchsia-50/30 border-slate-200 hover:border-fuchsia-300'
          }`}
        >
          {isInvoiceCenterActive && (
            <span className="absolute top-4 right-4 flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100/90 px-2.5 py-0.5 rounded-full border border-fuchsia-300 shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-fuchsia-600" /> Aktywne Centrum
            </span>
          )}

          <div>
            <div className="flex items-start gap-3.5 mb-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-colors shadow-xs ${
                  isInvoiceCenterActive
                    ? 'bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white shadow-fuchsia-300'
                    : 'bg-fuchsia-100 text-fuchsia-600'
                }`}
              >
                🧾
              </div>
              <div className="pr-16 sm:pr-24">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-600">
                    Moduł Fakturowy
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[10px] font-semibold text-slate-500">2 opcje</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                  CENTRUM FAKTUR
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Wystawiaj nowe faktury XML FA(3) z weryfikacją zamówień i OCR serii, lub twórz oficjalne korekty faktur KSeF.
                </p>
              </div>
            </div>
          </div>

          {/* Dwie opcje w Centrum Faktur: 1. Wygeneruj FV | 2. Wygeneruj korektę FV */}
          <div className="mt-4 pt-3.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectModule('invoice');
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeModule === 'invoice'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-sm shadow-fuchsia-200 ring-1 ring-fuchsia-500 scale-[1.01]'
                  : 'bg-white hover:bg-fuchsia-50 text-slate-700 hover:text-fuchsia-900 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Wygeneruj FV</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectModule('correction');
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeModule === 'correction'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-sm shadow-fuchsia-200 ring-1 ring-fuchsia-500 scale-[1.01]'
                  : 'bg-white hover:bg-fuchsia-50 text-slate-700 hover:text-fuchsia-900 border border-slate-200'
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>2. Wygeneruj korektę FV</span>
            </button>
          </div>
        </div>

        {/* OPCJA 2: CENTRUM ZAMÓWIEŃ */}
        <div
          onClick={() => {
            if (!isOrdersCenterActive) {
              onSelectModule('history');
            }
          }}
          className={`relative text-left p-5 sm:p-6 rounded-3xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between ${
            isOrdersCenterActive
              ? 'bg-gradient-to-br from-rose-50/90 via-pink-50/50 to-white border-rose-500 ring-2 ring-rose-400/25 shadow-rose-100/60 scale-[1.01]'
              : 'bg-white hover:bg-rose-50/30 border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-rose-800 bg-rose-100/90 px-2.5 py-0.5 rounded-full border border-rose-200 shadow-2xs">
              {ordersCount} {ordersCount === 1 ? 'zamówienie' : ordersCount < 5 ? 'zamówienia' : 'zamówień'}
            </span>
            {isOrdersCenterActive && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/90 px-2.5 py-0.5 rounded-full border border-rose-300 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-rose-600" /> Aktywne Centrum
              </span>
            )}
          </div>

          <div>
            <div className="flex items-start gap-3.5 mb-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-colors shadow-xs ${
                  isOrdersCenterActive
                    ? 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-rose-300'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                📦
              </div>
              <div className="pr-16 sm:pr-24">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    Moduł Logistyczny
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[10px] font-semibold text-slate-500">Rejestr & Historia</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                  CENTRUM ZAMÓWIEŃ
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Historia zamówień sieciowych DOZ, Dr. Max, Super-Pharm, Gemini. Listy przewozowe, kurierzy, statusy doręczeń i eksporty.
                </p>
              </div>
            </div>
          </div>

          {/* Opcja w Centrum Zamówień: Historia zamówień */}
          <div className="mt-4 pt-3.5 border-t border-slate-200/80">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectModule('history');
              }}
              className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                activeModule === 'history'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm shadow-rose-200 ring-1 ring-rose-500 scale-[1.01]'
                  : 'bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-900 border border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5" />
                <span>Historia zamówień (jak dotąd)</span>
              </div>
              <span className="text-[11px] font-semibold opacity-90">
                {ordersCount} w bazie ➔
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BELKA PODRZĘDNA / WSKAŹNIK KONTEKSTU AKTYWNEGO CENTRUM              */}
      {/* ==================================================================== */}
      {isInvoiceCenterActive ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>🧾 Centrum Faktur</span>
              <span className="text-slate-300">/</span>
              <span className="text-fuchsia-700 font-extrabold">
                {activeModule === 'invoice' ? '1. Wygeneruj Fakturę XML' : '2. Wygeneruj Korektę Faktury XML'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectModule('invoice')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeModule === 'invoice'
                  ? 'bg-fuchsia-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Wygeneruj Fakturę XML</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectModule('correction')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeModule === 'correction'
                  ? 'bg-fuchsia-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>2. Wygeneruj Korektę Faktury XML</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 px-4 py-2.5 shadow-2xs flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>📦 Centrum Zamówień</span>
              <span className="text-slate-300">/</span>
              <span className="text-rose-700 font-extrabold">Historia i Rejestr Zamówień Sieciowych</span>
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Zarejestrowanych zamówień: <strong className="text-slate-900 font-bold">{ordersCount}</strong>
          </span>
        </div>
      )}
    </div>
  );
};
