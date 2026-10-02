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

export type CorrectionMode = 'value' | 'formal' | 'zero_nip' | 'period_bulk';

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
  orderNumber?: string;
  orderDate?: string;
}

export const COMMON_CORRECTION_REASONS = [
  'Zwrot towaru przez odbiorcę (uszkodzenie w transporcie / reklamacja)',
  'Korekta ilościowa (niedobór towaru w dostawie)',
  'Udzielenie dodatkowego rabatu / upustu cenowego',
  'Korekta błędnej ceny jednostkowej na fakturze pierwotnej',
  'Błędny NIP nabywcy – wyzerowanie do zera (procedura KSeF)',
  'Korekta formalna – błąd w danych adresowych bez wpływu na kwoty',
  'Pomyłkowe zdublowanie pozycji na fakturze pierwotnej',
  'Inna przyczyna',
] as const;
