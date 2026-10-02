import React from 'react';
import { ArrowLeft, FileText, FileEdit, History, Sparkles, Building2 } from 'lucide-react';
import { AppModule } from '../types/navigation';

interface SubpageHeaderBarProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  onNavigateHome: () => void;
  ordersCount: number;
}

export const SubpageHeaderBar: React.FC<SubpageHeaderBarProps> = ({
  activeModule,
  onSelectModule,
  onNavigateHome,
  ordersCount,
}) => {
  const isInvoiceCenter = activeModule === 'invoice' || activeModule === 'correction';

  return (
    <div className="mb-6 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-150">
      {/* PRZYCISK POWROTU DO STRONY GŁÓWNEJ Z 2 KAFELKAMI */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs group shrink-0"
          title="Wróć do strony startowej z dwoma kafelkami"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:-translate-x-0.5 transition-all" />
          <span>← Wróć do wyboru centrum</span>
        </button>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700">
          <span>{isInvoiceCenter ? '🏛️ Centrum Faktur' : '📦 Centrum Zamówień'}</span>
          <span className="text-slate-300">/</span>
          <span className={isInvoiceCenter ? 'text-fuchsia-700' : 'text-rose-700'}>
            {activeModule === 'invoice'
              ? '1. Wygeneruj FV'
              : activeModule === 'correction'
              ? '2. Korekta FV'
              : 'Historia zamówień'}
          </span>
        </span>
      </div>

      {/* PRAWA STRONA: PRZEŁĄCZNIK W CENTRUM FAKTUR LUB INFO W CENTRUM ZAMÓWIEŃ */}
      {isInvoiceCenter ? (
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => onSelectModule('invoice')}
            className={`flex-1 md:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeModule === 'invoice'
                ? 'bg-fuchsia-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Wygeneruj FV</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('correction')}
            className={`flex-1 md:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeModule === 'correction'
                ? 'bg-fuchsia-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>2. Wygeneruj korektę FV</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-500 self-end md:self-auto">
          <span>Zamówień w rejestrze:</span>
          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
            {ordersCount}
          </span>
        </div>
      )}
    </div>
  );
};
