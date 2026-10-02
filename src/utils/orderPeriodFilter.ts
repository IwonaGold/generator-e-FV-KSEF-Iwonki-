import { ArchivedOrder, OrderDatePeriodFilter } from '../types/ordersHistory';

export interface DateRangeResult {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
  prettyRange: string;
}

export interface PeriodPresetOption {
  id: OrderDatePeriodFilter;
  label: string;
  shortLabel?: string;
  description?: string;
}

export const PERIOD_PRESETS: PeriodPresetOption[] = [
  { id: 'all', label: 'Wszystkie okresy', shortLabel: 'Wszystkie' },
  { id: 'this_month', label: 'Ten miesiąc', shortLabel: 'Ten m-c' },
  { id: 'last_month', label: 'Poprzedni miesiąc', shortLabel: 'Poprz. m-c' },
  { id: 'this_quarter', label: 'Ten kwartał', shortLabel: 'Ten kwartał' },
  { id: 'last_quarter', label: 'Poprzedni kwartał', shortLabel: 'Poprz. kwartał' },
  { id: 'this_year', label: 'Ten rok', shortLabel: 'Ten rok' },
  { id: 'custom', label: 'Własny zakres dat', shortLabel: 'Własny zakres' },
];

/**
 * Formatuje obiekt Date do YYYY-MM-DD
 */
export function formatToYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formatuje YYYY-MM-DD do czytelnego polskiego DD.MM.YYYY
 */
export function formatToPolishDate(ymd: string): string {
  if (!ymd) return '';
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }
  return ymd;
}

/**
 * Normalizuje datę zamówienia (np. issueDate) do formatu YYYY-MM-DD
 */
export function normalizeOrderDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // Jeśli YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  // Jeśli DD.MM.YYYY
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Próba parsowania
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return formatToYmd(d);
    }
  } catch {}
  return trimmed;
}

/**
 * Wyznacza granice dat (start i end w formacie YYYY-MM-DD) oraz etykiety dla wybranego okresu
 */
export function getDateRangeForPeriod(
  period: OrderDatePeriodFilter,
  customFrom: string = '',
  customTo: string = '',
  refDate: Date = new Date()
): DateRangeResult | null {
  if (period === 'all') {
    return null;
  }

  if (period === 'custom') {
    const start = customFrom ? customFrom.slice(0, 10) : '';
    const end = customTo ? customTo.slice(0, 10) : '';
    let prettyRange = 'Własny zakres';
    if (start && end) {
      prettyRange = `${formatToPolishDate(start)} – ${formatToPolishDate(end)}`;
    } else if (start) {
      prettyRange = `Od ${formatToPolishDate(start)}`;
    } else if (end) {
      prettyRange = `Do ${formatToPolishDate(end)}`;
    }
    return {
      start,
      end,
      label: 'Własny zakres',
      prettyRange,
    };
  }

  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0 - 11

  if (period === 'this_month') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const startStr = formatToYmd(start);
    const endStr = formatToYmd(end);
    return {
      start: startStr,
      end: endStr,
      label: 'Ten miesiąc',
      prettyRange: `${formatToPolishDate(startStr)} – ${formatToPolishDate(endStr)}`,
    };
  }

  if (period === 'last_month') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = formatToYmd(start);
    const endStr = formatToYmd(end);
    return {
      start: startStr,
      end: endStr,
      label: 'Poprzedni miesiąc',
      prettyRange: `${formatToPolishDate(startStr)} – ${formatToPolishDate(endStr)}`,
    };
  }

  if (period === 'this_quarter') {
    const qIndex = Math.floor(month / 3); // 0, 1, 2, 3
    const startMonth = qIndex * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    const startStr = formatToYmd(start);
    const endStr = formatToYmd(end);
    const romanQ = ['I', 'II', 'III', 'IV'][qIndex];
    return {
      start: startStr,
      end: endStr,
      label: `Ten kwartał (${romanQ} kw. ${year})`,
      prettyRange: `${formatToPolishDate(startStr)} – ${formatToPolishDate(endStr)}`,
    };
  }

  if (period === 'last_quarter') {
    const qIndex = Math.floor(month / 3);
    const prevQYear = qIndex === 0 ? year - 1 : year;
    const prevQMonth = qIndex === 0 ? 9 : (qIndex - 1) * 3;
    const prevQIndex = qIndex === 0 ? 3 : qIndex - 1;
    const start = new Date(prevQYear, prevQMonth, 1);
    const end = new Date(prevQYear, prevQMonth + 3, 0);
    const startStr = formatToYmd(start);
    const endStr = formatToYmd(end);
    const romanQ = ['I', 'II', 'III', 'IV'][prevQIndex];
    return {
      start: startStr,
      end: endStr,
      label: `Poprzedni kwartał (${romanQ} kw. ${prevQYear})`,
      prettyRange: `${formatToPolishDate(startStr)} – ${formatToPolishDate(endStr)}`,
    };
  }

  if (period === 'this_year') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const startStr = formatToYmd(start);
    const endStr = formatToYmd(end);
    return {
      start: startStr,
      end: endStr,
      label: `Ten rok (${year})`,
      prettyRange: `${formatToPolishDate(startStr)} – ${formatToPolishDate(endStr)}`,
    };
  }

  return null;
}

/**
 * Sprawdza czy data danego zamówienia wpisuje się w wybrany okres
 */
export function isOrderInPeriod(
  orderDateRaw: string | undefined | null,
  period: OrderDatePeriodFilter,
  customFrom: string = '',
  customTo: string = '',
  refDate: Date = new Date()
): boolean {
  if (period === 'all') return true;

  const range = getDateRangeForPeriod(period, customFrom, customTo, refDate);
  if (!range) return true;

  const orderDate = normalizeOrderDate(orderDateRaw);
  if (!orderDate) return false;

  if (range.start && orderDate < range.start) {
    return false;
  }
  if (range.end && orderDate > range.end) {
    return false;
  }
  return true;
}

/**
 * Oblicza liczbę zamówień dla poszczególnych presetów okresów (do wyświetlania w badge'ach)
 */
export function calculatePeriodCounts(
  orders: ArchivedOrder[],
  refDate: Date = new Date()
): Record<OrderDatePeriodFilter, number> {
  const counts: Record<OrderDatePeriodFilter, number> = {
    all: orders.length,
    this_month: 0,
    last_month: 0,
    this_quarter: 0,
    last_quarter: 0,
    this_year: 0,
    custom: 0,
  };

  orders.forEach((ord) => {
    const dateStr = ord.issueDate || ord.createdAt;
    if (isOrderInPeriod(dateStr, 'this_month', '', '', refDate)) {
      counts.this_month++;
    }
    if (isOrderInPeriod(dateStr, 'last_month', '', '', refDate)) {
      counts.last_month++;
    }
    if (isOrderInPeriod(dateStr, 'this_quarter', '', '', refDate)) {
      counts.this_quarter++;
    }
    if (isOrderInPeriod(dateStr, 'last_quarter', '', '', refDate)) {
      counts.last_quarter++;
    }
    if (isOrderInPeriod(dateStr, 'this_year', '', '', refDate)) {
      counts.this_year++;
    }
  });

  return counts;
}
