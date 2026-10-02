import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, Sparkles, ShieldCheck } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (username: string, remember: boolean) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const cleanLogin = login.trim();
      const cleanPassword = password;

      // Sprawdzenie danych logowania:
      // LOGIN: Eubiosis (dowolna wielkość liter)
      // HASŁO: OMNi-BiOTiC152900!
      if (
        cleanLogin.toLowerCase() === 'eubiosis' &&
        cleanPassword === 'OMNi-BiOTiC152900!'
      ) {
        onLoginSuccess('Eubiosis', rememberMe);
      } else {
        setErrorMessage('Nieprawidłowy login lub hasło. Sprawdź wielkość liter w haśle i spróbuj ponownie.');
        setIsLoading(false);
      }
    }, 250);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#fff5f8] via-[#fff0f5] to-[#faf5ff] relative overflow-hidden">
      {/* Tło z motywami kwiatowymi */}
      <div className="absolute top-10 left-10 text-5xl opacity-20 pointer-events-none select-none">🌸</div>
      <div className="absolute top-20 right-16 text-6xl opacity-20 pointer-events-none select-none">🌷</div>
      <div className="absolute bottom-12 left-16 text-6xl opacity-20 pointer-events-none select-none">💐</div>
      <div className="absolute bottom-10 right-12 text-5xl opacity-20 pointer-events-none select-none">✨</div>

      {/* Główna karta logowania */}
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl border border-rose-200/90 shadow-xl shadow-pink-100/60 p-7 sm:p-8 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Logo & Nagłówek */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-400 flex items-center justify-center text-white text-2xl shadow-md shadow-pink-200 mb-3">
            🌸
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 bg-clip-text text-transparent">
            Centrum Obsługi Zamówień Sieciowych
          </h1>
          <p className="text-xs font-semibold text-rose-500 mt-0.5">
            E-faktury KSEF · Dostęp autoryzowany ✨
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
            <Lock className="w-3 h-3 text-rose-500" />
            <span>Panel chroniony hasłem firmowym</span>
          </div>
        </div>

        {/* Komunikat o błędzie */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2 shadow-2xs animate-in fade-in">
            <span className="text-base leading-none">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formularz */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Login:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-rose-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="np. Eubiosis"
                className="w-full pl-9 pr-3 py-2.5 text-xs text-slate-900 bg-white border border-rose-200 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Hasło:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-rose-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wpisz hasło dostępu"
                className="w-full pl-9 pr-10 py-2.5 text-xs text-slate-900 bg-white border border-rose-200 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-rose-300 text-pink-600 focus:ring-pink-500 w-3.5 h-3.5"
              />
              <span>Zapamiętaj mnie na tym urządzeniu</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !login || !password}
            className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-700 shadow-md shadow-pink-200 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'Logowanie...' : 'Zaloguj się do generatora 🌸'}</span>
          </button>
        </form>

        {/* Bezpieczeństwo i informacja */}
        <div className="mt-6 pt-4 border-t border-rose-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
          <span>Bezpieczne połączenie · KSeF FA(3) wersja 1-0E</span>
        </div>
      </div>
    </div>
  );
};
