import React, { useState } from 'react';
import { FileCode, Sparkles, BookOpen, LogOut, ShieldCheck, ChevronDown, ExternalLink, FileText } from 'lucide-react';
import appLogo from '../assets/app-logo.png';

interface HeaderProps {
  onOpenXmlModal: () => void;
  onOpenWzModal?: () => void;
  onOpenAiGuide: () => void;
  onOpenCloudModal?: () => void;
  activeUsersCount?: number;
  sharedDraftsCount?: number;
  onNavigateHome?: () => void;
  itemCount: number;
  username?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenXmlModal,
  onOpenWzModal,
  onOpenAiGuide,
  onOpenCloudModal,
  activeUsersCount = 1,
  sharedDraftsCount = 0,
  onNavigateHome,
  itemCount,
  username = 'Eubiosis',
  onLogout,
}) => {
  const [isKsefMenuOpen, setIsKsefMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-200/80 shadow-xs">
      <div className="h-1 bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Wordmark & Logo (kliknięcie powraca do menu 2 kafelków) */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 text-left hover:opacity-85 transition-opacity cursor-pointer focus:outline-none"
          title="Przejdź do strony głównej (Wybór Centrum)"
        >
          <img
            src={appLogo}
            alt="Centrum Obsługi Zamówień Sieciowych"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-xs object-contain shrink-0"
          />
          <span className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 bg-clip-text text-transparent leading-tight">
            Centrum Obsługi Zamówień Sieciowych
          </span>
        </button>

        {/* Zone 2: Clean text navigation links / status */}
        <nav className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-600">
          {onOpenCloudModal && (
            <button
              type="button"
              onClick={onOpenCloudModal}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold transition-all cursor-pointer shadow-2xs"
              title="Współdzielona Baza Danych w Chmurze (Multi-User Sync + Wspólny Stół Roboczy)"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>☁️ Chmura Live ({activeUsersCount} online)</span>
              {sharedDraftsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black bg-indigo-600 text-white rounded-md">
                  Stół: {sharedDraftsCount}
                </span>
              )}
            </button>
          )}
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
          {onOpenCloudModal && (
            <button
              type="button"
              onClick={onOpenCloudModal}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer"
              title="Współdzielona Baza w Chmurze"
            >
              <span>☁️</span>
              <span>{activeUsersCount}</span>
            </button>
          )}
          <button
            onClick={onOpenAiGuide}
            className="md:hidden p-2 text-rose-600 hover:text-rose-900 rounded-lg hover:bg-rose-50 transition-colors"
            title="Integracja Vision LLM"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <div className="relative">
            <div className="inline-flex items-center rounded-xl shadow-sm shadow-pink-200 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-700 transition-all">
              <button
                type="button"
                onClick={onOpenXmlModal}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <FileCode className="w-4 h-4" />
                <span>Generuj KSeF XML</span>
              </button>
              <button
                type="button"
                onClick={() => setIsKsefMenuOpen(!isKsefMenuOpen)}
                className="p-2 border-l border-white/20 text-white hover:bg-black/10 rounded-r-xl cursor-pointer transition-colors"
                title="Wybierz: wygeneruj XML lub przejdź do logowania KSeF"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {isKsefMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsKsefMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={onOpenXmlModal}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-fuchsia-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">1. Wygeneruj i pobierz XML</div>
                    <div className="text-[11px] text-slate-500 leading-tight">Podgląd kodu, walidacja XSD FA(3) i pobranie pliku</div>
                  </div>
                </button>

                {onOpenWzModal && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={onOpenWzModal}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-fuchsia-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        2
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          <span>2. Generuj dokument WZ</span>
                          <FileText className="w-3 h-3 text-fuchsia-600" />
                        </div>
                        <div className="text-[11px] text-slate-500 leading-tight">Wydanie Zewnętrzne z seriami i datami (Drukuj / PDF)</div>
                      </div>
                    </button>
                  </>
                )}

                <div className="my-1 border-t border-slate-100" />

                <a
                  href="https://ap.ksef.mf.gov.pl/web/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    3
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-950 flex items-center gap-1">
                      <span>3. Przejdź do logowania KSeF</span>
                      <ExternalLink className="w-3 h-3 text-blue-600" />
                    </div>
                    <div className="text-[11px] text-slate-500 leading-tight">Oficjalny portal MF do wgrania pobranego pliku XML</div>
                  </div>
                </a>
              </div>
            )}
          </div>
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
