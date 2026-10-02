import React from 'react';
import { FileCode, Sparkles, BookOpen, LogOut, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onOpenXmlModal: () => void;
  onOpenAiGuide: () => void;
  onOpenDirectApiModal: () => void;
  itemCount: number;
  username?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenXmlModal,
  onOpenAiGuide,
  onOpenDirectApiModal,
  itemCount,
  username = 'Eubiosis',
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-200/80 shadow-xs">
      <div className="h-1 bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Wordmark & Invoice Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-400 flex items-center justify-center text-white text-base shadow-sm shadow-pink-300">
            🧾
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 bg-clip-text text-transparent leading-tight">
                Centrum Obsługi Zamówień Sieciowych
              </span>
              <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full font-bold">
                FA(3)
              </span>
            </div>
            <span className="text-xs text-rose-500/90 font-medium">
              E-faktury i Korekty KSeF · FA(3)
            </span>
          </div>
        </div>

        {/* Zone 2: Clean text navigation links / status */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            onClick={onOpenDirectApiModal}
            className="flex items-center gap-1.5 hover:text-pink-700 font-semibold transition-colors cursor-pointer text-pink-700 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-xl border border-pink-200 shadow-2xs"
          >
            <span>Wgraj do KSeF (API / Portal)</span>
          </button>
          <span className="text-rose-200">·</span>
          <span className="bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-800 text-xs">
            Pozycji: <strong className="text-rose-950 font-mono tabular-nums font-bold">{itemCount}</strong>
          </span>
          <span className="text-rose-200">·</span>
          <button
            onClick={onOpenAiGuide}
            className="flex items-center gap-1 hover:text-pink-700 transition-colors cursor-pointer text-slate-600"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            <span>Dokumentacja OCR</span>
          </button>
        </nav>

        {/* Zone 3: Primary action button & Logout */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={onOpenAiGuide}
            className="md:hidden p-2 text-rose-600 hover:text-rose-900 rounded-lg hover:bg-rose-50 transition-colors"
            title="Integracja Vision LLM"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenXmlModal}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-sm shadow-pink-200 transition-all whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileCode className="w-4 h-4" />
            <span>Generuj KSeF XML</span>
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50/90 hover:bg-rose-100 border border-rose-200/90 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-2xs"
              title="Wyloguj i zablokuj dostęp na tym urządzeniu"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Wyloguj ({username})</span>
              <span className="sm:hidden">Wyloguj</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
