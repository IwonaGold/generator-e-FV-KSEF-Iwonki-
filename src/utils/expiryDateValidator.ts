/**
 * Narzędzie weryfikacji dat ważności (MHD / EXP) w dystrybucji farmaceutycznej
 * Wymogi sieci farmaceutycznych:
 * - Dr. Max (Lekomat): powyżej 6 miesięcy (nie krótszy niż 6 miesięcy — Załącznik nr 1 do Umowy dostawy rozdz. VII + stopka zamówień e-mail)
 * - DOZ Direct: minimum 12 miesięcy (oraz min. 75% całkowitego okresu przydatności)
 * - Super-Pharm / Gemini: minimum 12 miesięcy
 * - Modum Pharma: minimum 13 miesięcy
 */

export interface ShelfLifeEvaluation {
  status: 'valid' | 'short_warning' | 'expired' | 'missing';
  monthsRemaining: number;
  requiredMonths: number;
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

export interface RecipientShelfLifeRule {
  minMonths: number;
  chainLabel: string;
  ruleDescription: string;
}

/**
 * Zwraca wymagany minimalny termin ważności (w miesiącach) dla danego odbiorcy/sieci
 */
export function getRequiredShelfLifeRule(
  chain?: string,
  buyerName?: string,
  buyerNip?: string
): RecipientShelfLifeRule {
  const combined = `${chain || ''} ${buyerName || ''} ${buyerNip || ''}`.toLowerCase();
  const cleanNip = (buyerNip || '').replace(/[^0-9]/g, '');

  // 1. Dr. Max Sp. z o.o. / Lekomat (NIP 8943149010) -> powyżej 6 miesięcy (min. 6 msc)
  if (
    cleanNip === '8943149010' ||
    combined.includes('dr. max') ||
    combined.includes('dr max') ||
    combined.includes('drmax') ||
    combined.includes('lekomat')
  ) {
    return {
      minMonths: 6,
      chainLabel: 'Dr. Max',
      ruleDescription:
        'Dr. Max wymaga produktów z datą ważności powyżej 6 miesięcy (nie krótszą niż 6 miesięcy — zgodnie z Poradnikiem Dostawcy Dr. Max rozdz. VII oraz adnotacją w zamówieniach: „Prosimy o wysyłkę produktów z datą ważności powyżej 6 miesięcy. Produkty z datą krótszą będą reklamowane.”).',
    };
  }

  // 2. ModumUp / Modum Pharma (NIP 5213783559) -> min. 13 miesięcy
  if (cleanNip === '5213783559' || combined.includes('modum')) {
    return {
      minMonths: 13,
      chainLabel: 'Modum Pharma',
      ruleDescription:
        'Modum Pharma wymaga towaru z terminem ważności minimum 13 miesięcy w dniu dostawy.',
    };
  }

  // 3. DOZ Direct (NIP 8271807718) -> min. 12 miesięcy
  if (cleanNip === '8271807718' || combined.includes('doz')) {
    return {
      minMonths: 12,
      chainLabel: 'DOZ Direct',
      ruleDescription:
        'DOZ Direct wymaga towaru z datą ważności minimum 12 miesięcy (1 rok) oraz min. 75% całkowitego okresu przydatności.',
    };
  }

  // 4. Super-Pharm / Gemini / Pozostali -> domyślnie min. 12 miesięcy
  return {
    minMonths: 12,
    chainLabel: chain && chain !== 'Domyślny' ? chain : 'Sieci farmaceutyczne',
    ruleDescription:
      'Sieci farmaceutyczne (DOZ Direct, Super-Pharm, Gemini) wymagają terminu ważności min. 12 miesięcy (Dr. Max: > 6 msc, Modum Pharma: min. 13 msc).',
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
 * Oblicza pozostałą ważność w miesiącach i weryfikuje wymóg minimalnej daty ważności (domyślnie 12 msc, dla Dr. Max 6 msc, dla Modum 13 msc)
 */
export function evaluateShelfLife(
  expiryDateStr?: string | null,
  referenceDate: Date = new Date(),
  minMonthsRequired: number = 12
): ShelfLifeEvaluation {
  const parsed = parseExpiryDate(expiryDateStr);

  if (!parsed) {
    return {
      status: 'missing',
      monthsRemaining: 0,
      requiredMonths: minMonthsRequired,
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
      requiredMonths: minMonthsRequired,
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

  if (monthsRemaining < minMonthsRequired) {
    const mRound = Math.floor(monthsRemaining);
    return {
      status: 'short_warning',
      monthsRemaining,
      requiredMonths: minMonthsRequired,
      formattedMonths: `${mRound} msc`,
      isAtLeast12Months: monthsRemaining >= 12,
      warningMessage: `⚠️ Krótka data: pozostało ok. ${mRound} msc ważności (wymóg odbiorcy: min. ${minMonthsRequired} msc!)`,
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
    requiredMonths: minMonthsRequired,
    formattedMonths: `${mRound} msc`,
    isAtLeast12Months: monthsRemaining >= 12,
    warningMessage: `Data ważności prawidłowa: ${mRound} msc (spełnia wymóg min. ${minMonthsRequired} msc)`,
    badgeStyle: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: '✓',
    },
  };
}
