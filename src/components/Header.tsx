import React from 'react';
import { LogOut } from 'lucide-react';
import appLogo from '../assets/app-logo.png';
import { WorkstationRole } from '../utils/cloudSyncService';

interface HeaderProps {
  onOpenXmlModal?: () => void;
  onOpenWzModal?: () => void;
  onDownloadOrderCsv?: () => void;
  onOpenAiGuide?: () => void;
  onOpenCloudModal?: () => void;
  activeUsersCount?: number;
  sharedDraftsCount?: number;
  onNavigateHome?: () => void;
  itemCount?: number;
  username?: string;
  onLogout?: () => void;
  workstationRole?: WorkstationRole;
  onSwitchWorkstationRole?: (role: WorkstationRole) => void;
  warehouseTasksCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCloudModal,
  activeUsersCount = 1,
  sharedDraftsCount = 0,
  onNavigateHome,
  username = 'Eubiosis',
  onLogout,
  workstationRole = 'coordinator',
  onSwitchWorkstationRole,
  warehouseTasksCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-200/80 shadow-xs">
      <div className="h-1 bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Zone 1: Wordmark & Logo */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 text-left hover:opacity-85 transition-opacity cursor-pointer focus:outline-none min-w-0"
          title={
            workstationRole === 'warehouse'
              ? 'Stanowisko 2: Magazyn — Zadania od Koordynatora'
              : 'Przejdź do strony głównej (Wybór Centrum)'
          }
        >
          <img
            src={appLogo}
            alt="Centrum Obsługi Zamówień Sieciowych"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-xs object-contain shrink-0"
          />
          <span className="text-base sm:text-xl font-black tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 bg-clip-text text-transparent leading-tight truncate">
            {workstationRole === 'warehouse'
              ? 'Stanowisko Magazyn — Zadania'
              : 'Centrum Obsługi Zamówień Sieciowych'}
          </span>
        </button>

        {/* Zone 2: Przełącznik Stanowiska (1. Koordynator / 2. Magazyn) + Chmura Live */}
        <nav className="hidden lg:flex items-center gap-2.5 text-xs font-medium text-slate-600">
          {onSwitchWorkstationRole && (
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-0.5 gap-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => onSwitchWorkstationRole('coordinator')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  workstationRole === 'coordinator'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Stanowisko 1: Koordynator (Pełny dostęp do zamówień, faktur i zlecania zadań do magazynu)"
              >
                <span>👩‍💼 1. Koordynator</span>
              </button>
              <button
                type="button"
                onClick={() => onSwitchWorkstationRole('warehouse')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  workstationRole === 'warehouse'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Stanowisko 2: Magazyn (Wyłącznie przypisane zadania od Koordynatora: zdjęcia opakowań i spakowanych zamówień)"
              >
                <span>📦 2. Magazyn</span>
                {warehouseTasksCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      workstationRole === 'warehouse'
                        ? 'bg-white text-amber-900'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {warehouseTasksCount}
                  </span>
                )}
              </button>
            </div>
          )}

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
              {sharedDraftsCount > 0 && workstationRole === 'coordinator' && (
                <span className="px-1.5 py-0.5 text-[10px] font-black bg-indigo-600 text-white rounded-md">
                  Stół: {sharedDraftsCount}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Zone 3: Mobile controls & Logout */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onSwitchWorkstationRole && (
            <button
              type="button"
              onClick={() =>
                onSwitchWorkstationRole(
                  workstationRole === 'warehouse' ? 'coordinator' : 'warehouse'
                )
              }
              className={`lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border ${
                workstationRole === 'warehouse'
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}
              title="Przełącz stanowisko: 1. Koordynator / 2. Magazyn"
            >
              <span>{workstationRole === 'warehouse' ? '📦 Magazyn' : '👩‍💼 Koordynator'}</span>
              {warehouseTasksCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {warehouseTasksCount}
                </span>
              )}
            </button>
          )}

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
