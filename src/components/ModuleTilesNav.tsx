import React from 'react';
import { FileText, FileEdit, History, Sparkles, CheckCircle2 } from 'lucide-react';

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
  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KAFELEK 1: WYGENERUJ FAKTURĘ XML */}
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
            <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100/90 px-2 py-0.5 rounded-full border border-fuchsia-300">
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
              <div className="text-[10px] font-bold tracking-wider text-fuchsia-600 uppercase mb-0.5">
                Krok 1 / Moduł Główny
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                1. WYGENERUJ FAKTURĘ XML
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Wczytaj zamówienie sieciowe, odczytaj serie i daty OCR, zweryfikuj z cennikiem XLSX i wygeneruj oficjalny XML FA(3).
              </p>
            </div>
          </div>
        </button>

        {/* KAFELEK 2: WYGENERUJ KOREKTĘ FAKTURY XML */}
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
            <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 bg-fuchsia-100/90 px-2 py-0.5 rounded-full border border-fuchsia-300">
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
              <div className="text-[10px] font-bold tracking-wider text-fuchsia-600 uppercase mb-0.5">
                KSeF Rodzaj: KOR
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                2. WYGENERUJ KOREKTĘ FAKTURY XML
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Zaczytaj fakturę pierwotną z historii lub XML, podaj przyczynę (zwrot, rabat, ilość) i wygeneruj oficjalną e-korektę KSeF.
              </p>
            </div>
          </div>
        </button>

        {/* KAFELEK 3: HISTORIA ZAMÓWIEŃ SIECIOWYCH */}
        <button
          type="button"
          onClick={() => onSelectModule('history')}
          className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
            activeModule === 'history'
              ? 'bg-gradient-to-br from-rose-50/90 via-rose-50/60 to-white border-rose-500 ring-2 ring-rose-400/30 shadow-rose-100 scale-[1.01]'
              : 'bg-white hover:bg-rose-50/40 border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 shadow-2xs">
              {ordersCount} {ordersCount === 1 ? 'pozycja' : ordersCount < 5 ? 'pozycje' : 'pozycji'}
            </span>
            {activeModule === 'history' && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                <CheckCircle2 className="w-3 h-3 text-rose-600" /> Aktywny
              </span>
            )}
          </div>
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors shadow-xs ${
                activeModule === 'history'
                  ? 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-rose-300'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              📚
            </div>
            <div className="pr-12">
              <div className="text-[10px] font-bold tracking-wider text-rose-600 uppercase mb-0.5">
                Centralne Archiwum
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                3. HISTORIA ZAMÓWIEŃ SIECIOWYCH
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Przeglądaj wg sieci: DOZ, Dr. Max, Super-Pharm, Gemini. Odznaczaj doręczenie towaru, prowadź notatki i pobieraj XML.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
