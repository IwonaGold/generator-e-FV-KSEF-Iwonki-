import { VatRate } from './ksef';

export interface PriceListItem {
  gtin: string; // Kod EAN/GTIN
  name: string; // Nazwa towaru w cenniku
  baseNetPrice: number; // Cena bazowa netto (katalogowa)
  discountPercent: number; // Procent rabatu np. 5.0 (5%)
  discountedNetPrice: number; // Cena netto po rabacie (KLUCZOWA CENA DO ROZLICZEŃ)
  vatRate?: VatRate;
  producer?: string;
  notes?: string;
}

export type PriceMatchStatus = 'match' | 'discrepancy' | 'not_found';
export type GtinMatchStatus = 'match' | 'discrepancy' | 'missing_in_order' | 'missing_in_pricelist' | 'not_found';

export interface PriceComparisonItem {
  invoiceItemId: string;
  invoiceItemName: string;
  invoiceGtin: string;
  invoiceNetPrice: number;
  priceListPrice: number | null;
  difference: number | null; // invoiceNetPrice - priceListPrice
  differencePercent: number | null;
  status: PriceMatchStatus;
  matchedBy: 'gtin' | 'name' | 'none';
  matchedPriceListItem?: PriceListItem;
  // Weryfikacja kodów GTIN / EAN (zamówienie vs cennik)
  gtinStatus: GtinMatchStatus;
  priceListGtin: string | null;
  gtinNotice?: string;
}

export interface PriceListAuditSummary {
  totalItems: number;
  matchedCount: number;
  discrepanciesCount: number;
  notFoundCount: number;
  totalInvoiceNet: number;
  totalPriceListNet: number;
  totalPotentialDiff: number; // Sumaryczna różnica kwotowa
  // Statystyki weryfikacji EAN/GTIN
  gtinMatchedCount: number;
  gtinDiscrepanciesCount: number;
  gtinMissingCount: number;
}

export interface ColumnMapping {
  gtinColIndex: number; // Index kolumny GTIN/EAN (-1 jeśli brak)
  nameColIndex: number; // Index kolumny Nazwa
  discountedNetColIndex: number; // Index kolumny Cena netto po rabacie
  baseNetColIndex: number; // Index kolumny Cena bazowa netto
  discountPercentColIndex: number; // Index kolumny Rabat %
}

export interface RawSheetInfo {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  rawGrid: any[][];
  headerRowIndex: number;
  availableColumns: { index: number; label: string; preview: string }[];
  detectedMapping: ColumnMapping;
}
