import React from 'react';
import { FileText, FileEdit, History, ArrowRight, Sparkles, Truck, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AppModule } from '../types/navigation';

interface HomePortalViewProps {
  onSelectModule: (module: AppModule) => void;
  ordersCount: number;
}

export const HomePortalView: React.FC<HomePortalViewProps> = ({
  onSelectModule,
  ordersCount,
}) => {
  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-10 animate-in fade-in zoom-in-95 duration-200">
      {/* NAGŁÓWEK POWITALNY */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-bold mb-3 shadow-2xs">
          <span>🌸</span>
          <span>Dzień dobry, Iwonko! Wybierz obszar roboczy:</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          Centrum Obsługi Zamówień Sieciowych
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-2xl mx-auto leading-relaxed">
          Wybierz jeden z trzech głównych modułów operacyjnych: Centrum Faktur, Centrum Zamówień lub Centrum Wiedzy (CRM Klientów Kluczowych).
        </p>
      </div>

      {/* TRZY GŁÓWNE KAFELKI NA STRONIE GŁÓWNEJ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==================================================================== */}
        {/* KAFELEK 1: CENTRUM FAKTUR                                           */}
        {/* ==================================================================== */}
        <div
          onClick={() => onSelectModule('invoice')}
          className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:via-fuchsia-50/30 hover:to-pink-50/40 border-2 border-slate-200 hover:border-fuchsia-400 rounded-3xl p-6 sm:p-7 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-fuchsia-100/60 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
        >
          <div className="absolute top-5 right-5">
            <span className="text-[11px] font-bold text-fuchsia-800 bg-fuchsia-50 border border-fuchsia-200 px-3 py-1 rounded-full shadow-2xs group-hover:bg-fuchsia-100 transition-colors">
              Faktury KSeF FA(3)
            </span>
          </div>

          <div>
            {/* Ikona */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white flex items-center justify-center text-3xl shadow-md shadow-fuchsia-200 mb-6 group-hover:scale-105 transition-transform">
              🧾
            </div>

            {/* Tytuł i Podtytuł */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-600">
                Moduł Fakturowy
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-500">2 procesy</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-fuchsia-900 transition-colors">
              Centrum Faktur
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Kompleksowe narzędzie do wystawiania e-faktur z zamówień sieciowych oraz tworzenia oficjalnych korekt KSeF.
            </p>

            {/* Lista zawartych opcji */}
            <div className="mt-5 space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 group-hover:bg-white/80 group-hover:border-fuchsia-200/80 transition-colors">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-lg bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  1
                </div>
                <div>
                  <strong className="text-slate-900 font-bold block">1. Wygeneruj Fakturę XML</strong>
                  <span className="text-slate-500 text-[11px]">
                    Wczytanie zamówienia (PDF/tekst), serie i daty OCR z opakowań, cennik XLSX, XML FA(3) i WZ.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 pt-2 border-t border-slate-200/60">
                <div className="w-5 h-5 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  2
                </div>
                <div>
                  <strong className="text-slate-900 font-bold block">2. Wygeneruj Korektę Faktury XML</strong>
                  <span className="text-slate-500 text-[11px]">
                    Korekty KSeF (rabaty, zwroty, błędny NIP do zera, zmiana cen i pozycji) z wyliczeniami.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dolny przycisk akcji */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-fuchsia-700 group-hover:text-fuchsia-800 transition-colors flex items-center gap-1.5">
              <span>Otwórz Centrum Faktur</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectModule('invoice');
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-fuchsia-700 hover:text-fuchsia-900 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-lg transition-colors cursor-pointer"
                title="Przejdź od razu do nowej faktury"
              >
                1. Faktura
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectModule('correction');
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-pink-700 hover:text-pink-900 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-lg transition-colors cursor-pointer"
                title="Przejdź od razu do korekty faktury"
              >
                2. Korekta
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* KAFELEK 2: CENTRUM ZAMÓWIEŃ                                          */}
        {/* ==================================================================== */}
        <div
          onClick={() => onSelectModule('history')}
          className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:via-rose-50/30 hover:to-pink-50/40 border-2 border-slate-200 hover:border-rose-400 rounded-3xl p-6 sm:p-7 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-rose-100/60 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
        >
          <div className="absolute top-5 right-5">
            <span className="text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full shadow-2xs group-hover:bg-rose-100 transition-colors">
              {ordersCount} {ordersCount === 1 ? 'zamówienie' : ordersCount < 5 ? 'zamówienia' : 'zamówień'} w bazie
            </span>
          </div>

          <div>
            {/* Ikona */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center text-3xl shadow-md shadow-rose-200 mb-6 group-hover:scale-105 transition-transform">
              📦
            </div>

            {/* Tytuł i Podtytuł */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                Moduł Logistyczny
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-500">Rejestr & Historia</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-rose-900 transition-colors">
              Centrum Zamówień
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Archiwum zamówień sieciowych, śledzenie przesyłek kurierskich, zdjęcia paczek i etapy realizacji dostaw.
            </p>

            {/* Lista zawartych opcji */}
            <div className="mt-5 space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 group-hover:bg-white/80 group-hover:border-rose-200/80 transition-colors">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  ✓
                </div>
                <div>
                  <strong className="text-slate-900 font-bold block">Historia i nowe zamówienia</strong>
                  <span className="text-slate-500 text-[11px]">
                    Zamówienia z fakturą i bez faktury dla sieci: <strong>DOZ, Dr. Max, Super-Pharm, Gemini</strong>.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 pt-2 border-t border-slate-200/60">
                <div className="w-5 h-5 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  🚚
                </div>
                <div>
                  <strong className="text-slate-900 font-bold block">Spedycja, zdjęcia paczek i awizacje</strong>
                  <span className="text-slate-500 text-[11px]">
                    Listy przewozowe DPD/InPost/DHL, dokumentacja zdjęciowa paczek i etapy dostawy.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dolny przycisk akcji */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 group-hover:text-rose-800 transition-colors flex items-center gap-1.5">
              <span>Otwórz Centrum Zamówień</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>

            <span className="px-3 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 rounded-lg">
              {ordersCount} w bazie ➔
            </span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* KAFELEK 3: CENTRUM WIEDZY (CRM KLIENTÓW KLUCZOWYCH)                 */}
        {/* ==================================================================== */}
        <div
          onClick={() => onSelectModule('knowledge')}
          className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:via-indigo-50/30 hover:to-violet-50/40 border-2 border-slate-200 hover:border-indigo-400 rounded-3xl p-6 sm:p-7 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-indigo-100/60 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
        >
          <div className="absolute top-5 right-5">
            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full shadow-2xs group-hover:bg-indigo-100 transition-colors">
              CRM & Wytyczne
            </span>
          </div>

          <div>
            {/* Ikona */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 text-white flex items-center justify-center text-3xl shadow-md shadow-indigo-200 mb-6 group-hover:scale-105 transition-transform">
              📚
            </div>

            {/* Tytuł i Podtytuł */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Baza Klientów
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-500">CRM Kluczowych Sieci</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-indigo-900 transition-colors">
              Centrum Wiedzy
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              CRM klientów kluczowych: wymagania fakturowe, minimalne daty ważności, awizacje, adresy wysyłki, maile i notatki.
            </p>

            {/* Lista zawartych opcji */}
            <div className="mt-5 space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 group-hover:bg-white/80 group-hover:border-indigo-200/80 transition-colors">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  📋
                </div>
                <div>
                  <strong className="text-slate-900 font-bold block">Wymogi FV, daty ważności i awizacje</strong>
                  <span className="text-slate-500 text-[11px]">
                    Zasady fakturowania, wymagane MHD produktów, sposób awizacji i adresy magazynów dostaw.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700 pt-2 border-t border-slate-200/60">
                <div className="w-5 h-5 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  📌
                </div>
                <div>
                  <strong className="text-slate-900 font-bold block">Kontakty e-mail i nowe ustalenia</strong>
                  <span className="text-slate-500 text-[11px]">
                    Adresy mailowe do korespondencji oraz dziennik bieżących notatek i ustaleń z kupcami.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dolny przycisk akcji */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 group-hover:text-indigo-800 transition-colors flex items-center gap-1.5">
              <span>Otwórz Centrum Wiedzy</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>

            <span className="px-3 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-lg">
              CRM Sieci ➔
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
