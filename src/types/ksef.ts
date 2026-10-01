export type PharmacyChain = 'DOZ' | 'Dr. Max' | 'Gemini' | 'Super-Pharm' | 'Custom';

/**
 * Trzy wersje zapisu/obsługi cech logistycznych w strukturze KSeF FA(3):
 * 1. 'gs1_composite' - Ciąg GS1 w polu 'NumerSeriiDataPrzydatnosciIlosc': (10)[Seria](17)[DataYYMMDD](37)[Ilość]
 *    (format stosowany w KSeF dla hurtowni farmaceutycznych i sieci aptek)
 * 2. 'separate_fields' - Osobne węzły <DodatkowyOpis>: 'Data ważności' oraz 'Seria' (bez ilości)
 * 3. 'none' - Zamówienie / Faktura standardowa BEZ serii i dat ważności (brak logistycznych węzłów DodatkowyOpis)
 */
export type LogisticsFormat = 'gs1_composite' | 'separate_fields' | 'none';

export type KSeFSchemaVersion = 'FA2' | 'FA3';

export type VatRate = '23%' | '8%' | '5%' | '0%' | 'zw';

export interface InvoiceItem {
  id: string;
  name: string;
  gtin: string; // Kod GTIN/EAN (np. 9120117912773) - wpisywany do elementu <GTIN> w FA(3)
  bloz7?: string; // Kod BLOZ-7 (jeśli używany)
  quantity: number;
  unit: string; // 'SZT.', 'op.', 'flak.'
  netPrice: number; // Cena jednostkowa netto
  vatRate: VatRate;
  batchNumber: string; // Numer serii (Batch / Lot) np. 24E1938
  expiryDate: string; // Data ważności (YYYY-MM-DD) np. 2027-11-30
  quantityInBatch?: number; // Ilość w danej serii (AI 37)
  ocrMatched?: boolean;
  ocrConfidence?: number;
  notes?: string;
}

export interface EntityDetails {
  nip: string; // 10 cyfr
  name: string;
  countryCode: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  street?: string; // np. Nowatorów
  houseNumber?: string; // np. 31
  apartmentNumber?: string; // np. 4
  bdoNumber?: string; // Rejestr BDO np. 000585744
  krs?: string;
  regon?: string;
  bankAccount?: string;
  bankName?: string; // np. ERSTE BANK POLSKA S.A.
  email?: string;
  phone?: string;
}

export interface InvoiceMeta {
  invoiceNumber: string; // P_2 np. 41/2026/KSEF lub 40/2026/KSEF
  invoiceType: 'VAT'; // Faktura podstawowa
  issueDate: string; // P_1 Data wystawienia
  issuePlace: string; // P_1M Miejsce wystawienia np. Gdańsk
  deliveryDate: string; // P_6 Data dokonania lub zakończenia dostawy
  orderNumber?: string; // Numer zamówienia np. C008848894
  orderDate?: string; // Data złożenia zamówienia np. 2026-09-08
  dueDate: string; // Termin płatności np. 2026-10-26
  paymentDays?: number; // Liczba dni na płatność (np. 14, 30, 46)
  paymentMethod: 'przelew' | 'gotowka' | 'karta';
  currency: 'PLN' | 'EUR';
  ksefNumber?: string; // Referencyjny numer KSeF nadany przez system
  ksefReceiptDate?: string; // Data otrzymania w KSeF
  systemSource?: string;
}

export interface ParsedOrderData {
  orderNumber?: string;
  orderDate?: string;
  dueDate?: string;
  paymentDays?: number;
  deliveryDate?: string;
  paymentMethod?: 'przelew' | 'gotowka' | 'karta';
  buyerNip?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerPostalCode?: string;
  buyerCity?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  recipientCity?: string;
  recipientIdWew?: string;
  recipientGln?: string;
  recipientNip?: string;
}

export interface OcrExtractionResult {
  fileName?: string;
  batchNumber: string;
  expiryDate: string;
  gtin?: string;
  serialNumber?: string;
  confidence: number;
  productSuggestion?: string;
  rawText?: string;
}

export interface ThirdPartyEntity {
  idWew?: string; // np. 5213842837-54936
  gln?: string; // np. 5909000848054
  nip?: string;
  name: string; // np. Magazyn Centralny Super Pharm Holding
  countryCode: string;
  addressLine1: string;
  postalCode?: string;
  city?: string;
  street?: string; // np. Aleja 20-lecia
  houseNumber?: string; // np. 23
  apartmentNumber?: string;
  role: string; // '2' = Odbiorca (jednostka wewnętrzna/oddział nabywcy)
  roleDescription?: string;
}

export interface ChainProfile {
  id: PharmacyChain;
  name: string;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity;
  standardPaymentDays: number;
  description: string;
  defaultPriceMultiplier: number;
  preferredLogisticsFormat: LogisticsFormat;
  defaultOrderNumber?: string;
}

export interface KSeFValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

export interface KSeFGenerationInput {
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;
  meta: InvoiceMeta;
  items: InvoiceItem[];
  logisticsFormat: LogisticsFormat;
  schemaVersion?: KSeFSchemaVersion;
}
