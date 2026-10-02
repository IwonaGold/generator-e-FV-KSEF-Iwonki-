/**
 * Narzędzie weryfikacji dat ważności (MHD / EXP) w dystrybucji farmaceutycznej
 * Wymóg sieci farmaceutycznych (DOZ, Dr. Max, Super-Pharm, Gemini):
 * Towar przyjmowany na magazyn centralny musi posiadać minimum 12 miesięcy ważności!
 */

export interface ShelfLifeEvaluation {
  status: 'valid' | 'short_warning' | 'expired' | 'missing';
  monthsRemaining: number;
  formattedMonths: string;
  isAtLeast12Months: boolean;
  warningMessage: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    icon: string;
  };
}

/**
 * Bezpiecznie parsuje datę ważności (obsługuje YYYY-MM-DD, YYYY-MM, DD.MM.YYYY, MM/YYYY, itp.)
 */
export function parseExpiryDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // 1. Format ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. Format YYYY-MM (w farmacji oznacza koniec danego miesiąca)
  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [year, month] = clean.split('-').map(Number);
    // Ostatni dzień miesiąca
    const lastDay = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, lastDay);
  }

  // 3. Format DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    const [day, month, year] = clean.split('.').map(Number);
    return new Date(year, month - 1, day);
  }

  // 4. Format MM/YYYY lub MM.YYYY
  if (/^\d{2}[/.]\d{4}$/.test(clean)) {
    const parts = clean.split(/[/.]/);
    const month = Number(parts[0]);
    const year = Number(parts[1]);
    const lastDay = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, lastDay);
  }

  // Próba ogólnego Date
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Oblicza pozostałą ważność w miesiącach i weryfikuje wymóg minimum 12 miesięcy
 */
export function evaluateShelfLife(
  expiryDateStr?: string | null,
  referenceDate: Date = new Date()
): ShelfLifeEvaluation {
  const parsed = parseExpiryDate(expiryDateStr);

  if (!parsed) {
    return {
      status: 'missing',
      monthsRemaining: 0,
      formattedMonths: 'Brak daty',
      isAtLeast12Months: false,
      warningMessage: 'Brak wprowadzonej daty ważności',
      badgeStyle: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: '—',
      },
    };
  }

  // Obliczenie różnicy w dniach i miesiącach
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const exp = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());

  const diffMs = exp.getTime() - ref.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Średnia liczba dni w miesiącu ~30.4375
  const monthsRemaining = Math.round((diffDays / 30.4375) * 10) / 10;

  if (diffDays <= 0) {
    return {
      status: 'expired',
      monthsRemaining: 0,
      formattedMonths: 'Przeterminowany!',
      isAtLeast12Months: false,
      warningMessage: '🚨 Produkt jest przeterminowany!',
      badgeStyle: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: '🚨',
      },
    };
  }

  if (monthsRemaining < 12) {
    const mRound = Math.floor(monthsRemaining);
    return {
      status: 'short_warning',
      monthsRemaining,
      formattedMonths: `${mRound} msc`,
      isAtLeast12Months: false,
      warningMessage: `⚠️ Krótka data: pozostało ok. ${mRound} msc ważności (wymóg sieci farmaceutycznych: min. 12 msc!)`,
      badgeStyle: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-300',
        icon: '⚠️',
      },
    };
  }

  const mRound = Math.floor(monthsRemaining);
  return {
    status: 'valid',
    monthsRemaining,
    formattedMonths: `${mRound} msc`,
    isAtLeast12Months: true,
    warningMessage: `Data ważności prawidłowa: ${mRound} msc (spełnia wymóg min. 12 msc)`,
    badgeStyle: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: '✓',
    },
  };
}
