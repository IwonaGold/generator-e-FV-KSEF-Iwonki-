import { EntityDetails, ThirdPartyEntity } from './ksef';

export interface CorrectionItem {
  id: string;
  originalRowNumber: number;
  name: string;
  gtin?: string;
  unit: string;
  vatRate: string; // '23%', '8%', '5%', '0%', 'zw' (oryginalna stawka VAT)
  correctedVatRate?: string; // Stawka VAT po korekcie

  // Stan PRZED korektą
  originalQuantity: number;
  originalNetPrice: number;
  originalNetTotal: number;
  originalVatTotal: number;
  originalGrossTotal: number;

  // Stan PO korekcie
  correctedQuantity: number;
  correctedNetPrice: number;
  correctedNetTotal: number;
  correctedVatTotal: number;
  correctedGrossTotal: number;

  // Różnica (PO - PRZED)
  quantityDelta: number;
  netDelta: number;
  vatDelta: number;
  grossDelta: number;

  // Czy pozycja uległa zmianie
  isModified: boolean;
  batchNumber?: string;
  expiryDate?: string;
  correctedBatchNumber?: string;
  correctedExpiryDate?: string;
}

export type CorrectionMode = 'value' | 'formal' | 'zero_nip' | 'period_bulk';

export interface CorrectedInvoiceReference {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  hasKsefNumber: boolean;
  ksefNumber?: string;
  netTotal: number;
  grossTotal: number;
  fileName?: string;
}

export type FormalCorrectionField =
  | 'buyer_name'
  | 'buyer_address'
  | 'third_party'
  | 'delivery_date'
  | 'expiry_date'
  | 'batch_number'
  | 'order_number'
  | 'bank_account'
  | 'other';

export interface FormalCorrectionEntry {
  field: FormalCorrectionField;
  fieldName: string;
  originalValue: string;
  correctedValue: string;
  isActive: boolean;
}

export interface BulkDiscountConfig {
  discountType: 'percentage' | 'amount';
  percentageValue: number; // np. 5 dla 5%
  amountNetValue: number; // np. 1000.00
  vatRate: '8%' | '23%';
  calculatedNetDelta: number; // ujemna wartość np. -1250.00
  calculatedVatDelta: number; // ujemna wartość np. -100.00
  calculatedGrossDelta: number; // ujemna wartość np. -1350.00
  discountDescription: string;
}

export interface KSeFCorrectionData {
  correctionNumber: string; // np. KOR-1/10/2026
  issueDate: string; // YYYY-MM-DD
  issuePlace: string;
  
  // Dane faktury korygowanej (pojedynczej)
  originalInvoiceNumber: string;
  originalInvoiceDate: string;
  hasOriginalKsefNumber: boolean;
  originalKsefNumber?: string;

  // Lista faktur korygowanych (dla korekty zbiorczej - TypKorekty: 3)
  correctedInvoices?: CorrectedInvoiceReference[];

  // Dane błędu formalnego (TypKorekty: 2)
  formalCorrections?: FormalCorrectionEntry[];

  // Konfiguracja rabatu zbiorczego (TypKorekty: 3)
  bulkDiscount?: BulkDiscountConfig;

  // Przyczyna korekty
  reasonCategory: string;
  reasonDescription: string;
  
  /**
   * TypKorekty wg wytycznych MF i schematu FA(3):
   * 1 – korekta pozycji faktury (zmiana ilości, ceny, stawek, zwrot)
   * 2 – korekta danych podatnika / formalna (np. zmiana adresu bez wpływu na kwoty)
   * 3 – korekta zbiorcza / inna data
   */
  typKorekty: '1' | '2' | '3';
  correctionMode?: CorrectionMode;

  // Opcjonalny okres dla korekty zbiorczej (art. 106j ust. 3 ustawy)
  okresFaKorygowanej?: string;

  // Strony
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;

  // Pozycje
  items: CorrectionItem[];

  // Finanse
  currency: string;
  paymentMethod: string;
  dueDate: string;
  deliveryDate?: string;
  orderNumber?: string;
  orderDate?: string;
}

export const COMMON_CORRECTION_REASONS = [
  'Wg kodu / wytycznych odbiorcy (Centrum Wiedzy)',
  'Zwrot towaru przez odbiorcę (uszkodzenie w transporcie / reklamacja)',
  'Korekta ilościowa (niedobór towaru w dostawie)',
  'Udzielenie dodatkowego rabatu / upustu cenowego',
  'Korekta błędnej ceny jednostkowej na fakturze pierwotnej',
  'Błędny NIP nabywcy – wyzerowanie do zera (procedura KSeF)',
  'Korekta formalna – błąd w danych adresowych bez wpływu na kwoty',
  'Pomyłkowe zdublowanie pozycji na fakturze pierwotnej',
  'Inna przyczyna',
] as const;

