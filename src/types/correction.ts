import { EntityDetails, ThirdPartyEntity } from './ksef';

export interface CorrectionItem {
  id: string;
  originalRowNumber: number;
  name: string;
  gtin?: string;
  unit: string;
  vatRate: string; // '23%', '8%', '5%', '0%', 'zw'
  
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
}

export interface KSeFCorrectionData {
  correctionNumber: string; // np. KOR-1/10/2026
  issueDate: string; // YYYY-MM-DD
  issuePlace: string;
  
  // Dane faktury korygowanej
  originalInvoiceNumber: string;
  originalInvoiceDate: string;
  hasOriginalKsefNumber: boolean;
  originalKsefNumber?: string;

  // Przyczyna korekty
  reasonCategory: string;
  reasonDescription: string;
  typKorekty: '1' | '2' | '3'; // 1=in plus, 2=in minus, 3=bez wpływu na VAT

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
  orderNumber?: string;
  orderDate?: string;
}

export const COMMON_CORRECTION_REASONS = [
  'Zwrot towaru przez odbiorcę (uszkodzenie / reklamacja)',
  'Korekta ilościowa (niedobór towaru w dostawie)',
  'Udzielenie dodatkowego rabatu / upustu cenowego',
  'Korekta błędnej ceny jednostkowej na fakturze pierwotnej',
  'Pomyłkowe zdublowanie pozycji na fakturze pierwotnej',
  'Korekta danych formalnych / pozycji',
  'Inna przyczyna',
] as const;
