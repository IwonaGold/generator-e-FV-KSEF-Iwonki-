/**
 * Logika statusów dwuetapowego procesu weryfikacji zdjęcia i odczytu LOT / MHD
 */
export type VerificationFlowStatus =
  | 'PRODUCT_PENDING'              // 1. produkt nierozpoznany / oczekuje na wybór ręczny
  | 'PRODUCT_MATCHED'              // 2. AI znalazło dopasowanie produktu do pozycji faktury
  | 'PRODUCT_CONFIRMED'            // 3. użytkownik zatwierdził dopasowanie produktu
  | 'LOT_MHD_PENDING'              // 4. produkt zatwierdzony, ale OCR LOT/MHD jeszcze nieuruchomiony
  | 'LOT_MHD_READ'                 // 5. OCR LOT/MHD wykonany
  | 'MANUAL_VERIFICATION_REQUIRED' // 6. wynik wymaga sprawdzenia przez użytkownika
  | 'CONFIRMED';                   // 7. użytkownik zatwierdził LOT/MHD do faktury

export interface BatchRecord {
  id: string;
  lot: string;
  mhd: string; // YYYY-MM-DD
  quantity: number;
  lotConfidence: boolean; // true = pewny (✓), false = do weryfikacji (⚠️)
  mhdConfidence: boolean; // true = pewny (✓), false = do weryfikacji (⚠️)
  status: 'PEWNY' | 'DO WERYFIKACJI';
  isEditing?: boolean;
}

export interface PhotoVerificationItem {
  id: string;
  file: File;
  fileName: string;
  photoUrl: string;
  status: VerificationFlowStatus;

  // ETAP 1: Rozpoznanie WYŁĄCZNIE produktu
  recognizedProductName?: string;
  recognizedGtin?: string;
  recognizedFeatures?: string;
  matchedInvoiceItemId?: string; // id pozycji z faktury
  matchedInvoiceItemIndex?: number; // numer pozycji na fakturze (np. 1, 2, 3...)
  isConfidentProductMatch: boolean; // czy AI ma wystarczającą pewność
  isAnalyzingProduct?: boolean;

  // ETAP 2: Odczyt LOT i MHD (wyłącznie po ręcznym kliknięciu „🔍 Odczytaj LOT i MHD”)
  batches: BatchRecord[];
  isAnalyzingLotMhd?: boolean;
  isManualEntry?: boolean;
  rawOcrText?: string;
}
