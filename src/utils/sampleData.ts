import { ChainProfile, EntityDetails, InvoiceItem, InvoiceMeta } from '../types/ksef';

/**
 * Dane rzeczywistego sprzedawcy z wystawionych faktur KSeF (Eubiosis Sp. z o.o.)
 */
export const DEFAULT_SELLER: EntityDetails = {
  nip: '9571106742',
  name: 'EUBIOSIS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  countryCode: 'PL',
  addressLine1: 'ul. Nowatorów 31 lok. 4',
  postalCode: '80-298',
  city: 'Gdańsk',
  bdoNumber: '000585744',
  bankAccount: '96 1090 1098 0000 0001 6398 3525',
  bankName: 'ERSTE BANK POLSKA S.A.',
  email: 'kontakt@eubiosis.pl',
  phone: '+48 58 712 34 56',
};

/**
 * Rzeczywiste profile sieci aptecznych i hurtowni z faktur KSeF
 */
export const PHARMACY_CHAINS: Record<string, ChainProfile> = {
  'Dr. Max': {
    id: 'Dr. Max',
    name: 'Dr. Max (Dr. Max Lekomat Sp. z o.o.)',
    standardPaymentDays: 30,
    description: 'Nabywca z faktury 41/2026/KSEF · Format GS1 z kluczem NumerSeriiDataPrzydatnosciIlosc',
    defaultPriceMultiplier: 1.0,
    preferredLogisticsFormat: 'gs1_composite',
    defaultOrderNumber: 'ZZ-1009/09/26',
    buyer: {
      nip: '8943149010',
      name: 'DR. MAX LEKOMAT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      countryCode: 'PL',
      addressLine1: 'ul. Krzemieniecka 60A',
      postalCode: '54-613',
      city: 'Wrocław',
      email: 'faktury@drmax.pl',
    },
  },
  DOZ: {
    id: 'DOZ',
    name: 'DOZ S.A. Direct Sp. k. (Apteki Dbam o Zdrowie)',
    standardPaymentDays: 60,
    description: 'Nabywca z faktury 40/2026/KSEF · Format GS1 z kluczem NumerSeriiDataPrzydatnosciIlosc · Brak Podmiot3 (brak ID-Wew)',
    defaultPriceMultiplier: 1.0,
    preferredLogisticsFormat: 'gs1_composite',
    defaultOrderNumber: '22882/2026/KPD',
    buyer: {
      nip: '8271807718',
      name: 'DOZ SPÓŁKA AKCYJNA DIRECT SPÓŁKA KOMANDYTOWA - HURTOWNIA FARMACEUTYCZNA',
      countryCode: 'PL',
      addressLine1: 'UL. KINGA C. GILLETTE 11',
      postalCode: '94-406',
      city: 'Łódź',
      email: 'rozliczenia@doz.pl',
      gln: '5909000828476',
    },
  },
  Gemini: {
    id: 'Gemini',
    name: 'Apteki Gemini (Gemini Apps Sp. z o.o. / Gemini Polska)',
    standardPaymentDays: 45,
    description: 'Cennik Gemini · Obsługa formatu osobnych pól w DodatkowyOpis',
    defaultPriceMultiplier: 0.95,
    preferredLogisticsFormat: 'separate_fields',
    defaultOrderNumber: 'ZAM/GEM/2026/09',
    buyer: {
      nip: '5252801825',
      name: 'GEMINI APPS SP. Z O.O.',
      countryCode: 'PL',
      addressLine1: 'Al. Grunwaldzka 411',
      postalCode: '80-309',
      city: 'Gdańsk',
      email: 'faktury@gemini.pl',
    },
  },
  'Super-Pharm': {
    id: 'Super-Pharm',
    name: 'Super-Pharm (Super -Pharm Holding Sp. z o.o.)',
    standardPaymentDays: 45,
    description: 'Nabywca z faktury 35/2026/KSEF · Format Osobne Wiersze (Data ważności + Seria) · Podmiot3 Magazyn Centralny',
    defaultPriceMultiplier: 1.0,
    preferredLogisticsFormat: 'separate_fields',
    defaultOrderNumber: 'C008848894',
    buyer: {
      nip: '5213842837',
      name: 'SUPER -PHARM HOLDING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      countryCode: 'PL',
      addressLine1: 'ul. Domaniewska 48',
      postalCode: '02-672',
      city: 'Warszawa',
      email: 'faktury@superpharm.pl',
    },
    thirdParty: {
      idWew: '5213842837-54936',
      name: 'Magazyn Centralny Super Pharm Holding',
      countryCode: 'PL',
      addressLine1: 'Aleja 20-lecia 23, 96-515 Teresin',
      postalCode: '96-515',
      city: 'Teresin',
      role: '2',
      roleDescription: 'Odbiorca (jednostka wewnętrzna/oddział nabywcy)',
    },
  },
  Custom: {
    id: 'Custom',
    name: 'Inna Apteka / Nabywca Indywidualny',
    standardPaymentDays: 14,
    description: 'Dowolne dane nabywcy i własny format serii',
    defaultPriceMultiplier: 1.0,
    preferredLogisticsFormat: 'separate_fields',
    buyer: {
      nip: '5250000000',
      name: 'APTEKA PRYWATNA POD ORŁEM',
      countryCode: 'PL',
      addressLine1: 'Rynek Główny 14',
      postalCode: '31-042',
      city: 'Kraków',
    },
  },
};

/**
 * Realne pozycje z faktury 41/2026/KSEF (DR. MAX LEKOMAT SP. Z O.O.)
 */
export const PRESET_DR_MAX_ITEMS: InvoiceItem[] = [
  {
    id: 'drmax-1',
    name: 'OMNi-BiOTiC® Active 60 g słoik',
    gtin: '9120117912773',
    quantity: 4,
    unit: 'SZT.',
    netPrice: 166.3,
    vatRate: '8%',
    batchNumber: 'FP11',
    expiryDate: '2026-10-30',
    quantityInBatch: 4,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'drmax-2',
    name: 'OMNi-BiOTiC® TRAVEL 28 sasz. x 5 g',
    gtin: '9120001435692',
    quantity: 3,
    unit: 'SZT.',
    netPrice: 157.94,
    vatRate: '8%',
    batchNumber: 'FP112',
    expiryDate: '2026-10-30',
    quantityInBatch: 3,
    ocrMatched: true,
    ocrConfidence: 0.98,
  },
  {
    id: 'drmax-3',
    name: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    gtin: '9120117912742',
    quantity: 51,
    unit: 'SZT.',
    netPrice: 157.94,
    vatRate: '8%',
    batchNumber: 'FR',
    expiryDate: '2026-11-07',
    quantityInBatch: 51,
    ocrMatched: true,
    ocrConfidence: 0.97,
  },
  {
    id: 'drmax-4',
    name: 'OMNi-BiOTiC® STRESS Repair 9 7 sasz. x 3 g',
    gtin: '9120117913138',
    quantity: 1,
    unit: 'SZT.',
    netPrice: 45.96,
    vatRate: '8%',
    batchNumber: 'R',
    expiryDate: '2026-10-23',
    quantityInBatch: 1,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
];

export const PRESET_DR_MAX_META: InvoiceMeta = {
  invoiceNumber: '41/2026/KSEF',
  invoiceType: 'VAT',
  issueDate: '2026-10-01',
  issuePlace: 'Gdańsk',
  deliveryDate: '2026-09-30',
  orderNumber: 'ZZ-1009/09/26',
  orderDate: '2026-09-28',
  dueDate: '2026-10-30',
  paymentDays: 30,
  paymentMethod: 'przelew',
  currency: 'PLN',
  ksefNumber: '9571106742-20261001-4D51D9800003-0F',
  ksefReceiptDate: '2026-10-01',
  systemSource: 'KSeF Pharmacy Suite (FA3 crd.gov.pl)',
};

/**
 * Realne pozycje z faktury 40/2026/KSEF (DOZ S.A. DIRECT SP. K.)
 * z dokładnymi seriami i datami z DodatkowyOpis (Strona 4)
 */
export const PRESET_DOZ_ITEMS: InvoiceItem[] = [
  {
    id: 'doz-1',
    name: 'Omni Biotic Colonize, prosz., 3 g, 28 sasz.',
    gtin: '9120117914906',
    quantity: 1,
    unit: 'SZT.',
    netPrice: 162.15,
    vatRate: '8%',
    batchNumber: '24E1938',
    expiryDate: '2027-11-30',
    quantityInBatch: 1,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'doz-2',
    name: 'Omni Biotic Flora Plus, prosz., 2 g, 28 sasz.',
    gtin: '9120117912865',
    quantity: 51,
    unit: 'SZT.',
    netPrice: 154.0,
    vatRate: '8%',
    batchNumber: '6355',
    expiryDate: '2027-11-30',
    quantityInBatch: 51,
    ocrMatched: true,
    ocrConfidence: 0.98,
  },
  {
    id: 'doz-3',
    name: 'Omni Biotic Pro-Vi 5, prosz., 2 g, 14sasz.',
    gtin: '9120117912797',
    quantity: 3,
    unit: 'SZT.',
    netPrice: 80.67,
    vatRate: '8%',
    batchNumber: 'G6B117',
    expiryDate: '2028-02-29',
    quantityInBatch: 3,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'doz-4',
    name: 'Omni Biotic Stress Repair 9 Kids, prosz., 1,2 g, 28 sasz.',
    gtin: '9120117915651',
    quantity: 72,
    unit: 'SZT.',
    netPrice: 110.0,
    vatRate: '8%',
    batchNumber: '25E4291',
    expiryDate: '2028-03-31',
    quantityInBatch: 72,
    ocrMatched: true,
    ocrConfidence: 0.97,
  },
  {
    id: 'doz-5',
    name: 'Omni Biotic Stress Repair 9, prosz., 3 g, 7 sasz.',
    gtin: '9120117913138',
    quantity: 3,
    unit: 'SZT.',
    netPrice: 44.82,
    vatRate: '8%',
    batchNumber: '25E1356',
    expiryDate: '2028-02-29',
    quantityInBatch: 3,
    ocrMatched: true,
    ocrConfidence: 0.98,
  },
  {
    id: 'doz-6',
    name: 'Omni Biotic Travel, prosz., 5 g, 28 sasz.',
    gtin: '9120001435692',
    quantity: 51,
    unit: 'SZT.',
    netPrice: 154.0,
    vatRate: '8%',
    batchNumber: '25E3484',
    expiryDate: '2027-09-30',
    quantityInBatch: 51,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
];

export const PRESET_DOZ_META: InvoiceMeta = {
  invoiceNumber: '40/2026/KSEF',
  invoiceType: 'VAT',
  issueDate: '2026-09-25',
  issuePlace: 'Gdańsk',
  deliveryDate: '2026-09-28',
  orderNumber: '22122/2026/KPD',
  orderDate: '2026-09-23',
  dueDate: '2026-11-27',
  paymentDays: 60,
  paymentMethod: 'przelew',
  currency: 'PLN',
  ksefNumber: '9571106742-20260925-42B36A800003-42',
  ksefReceiptDate: '2026-09-25',
  systemSource: 'KSeF Pharmacy Suite (FA3 crd.gov.pl)',
};

/**
 * Realne 10 pozycji z oficjalnej faktury 35/2026/KSEF (SUPER -PHARM HOLDING SP. Z O.O.)
 * z dokładnymi kodami GTIN, cenami, ilościami, seriami i datami ważności
 */
export const PRESET_SUPER_PHARM_ITEMS: InvoiceItem[] = [
  {
    id: 'sp-1',
    name: 'OMNI-BIOTIC 6 60 SASZ. X 3 G',
    gtin: '9120117912711',
    quantity: 6,
    unit: 'SZT.',
    netPrice: 416.99,
    vatRate: '8%',
    batchNumber: '25E1417',
    expiryDate: '2028-03-31',
    quantityInBatch: 6,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-2',
    name: 'OMNI-BIOTIC FLORA PLUS 28 SASZ. X 2 G',
    gtin: '9120117912865',
    quantity: 12,
    unit: 'SZT.',
    netPrice: 157.94,
    vatRate: '8%',
    batchNumber: '6355',
    expiryDate: '2027-11-30',
    quantityInBatch: 12,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-3',
    name: 'OMNI-BIOTIC HETOX 30 SASZ. X 6 G',
    gtin: '9120117912827',
    quantity: 10,
    unit: 'SZT.',
    netPrice: 325.07,
    vatRate: '8%',
    batchNumber: '25E1351',
    expiryDate: '2028-01-31',
    quantityInBatch: 10,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-4',
    name: 'OMNI-BIOTIC METABOLIC 30 SASZ. X 3 G',
    gtin: '9120117912810',
    quantity: 3,
    unit: 'SZT.',
    netPrice: 166.3,
    vatRate: '8%',
    batchNumber: '25E0304',
    expiryDate: '2028-02-29',
    quantityInBatch: 3,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-5',
    name: 'OMNI-BIOTIC PRO-VI 5 14 SASZ. X 2 G',
    gtin: '9120117912797',
    quantity: 2,
    unit: 'SZT.',
    netPrice: 82.73,
    vatRate: '8%',
    batchNumber: 'G6B117',
    expiryDate: '2028-02-29',
    quantityInBatch: 2,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-6',
    name: 'OMNI-BIOTIC PRO-VI 5 30 SASZ. X 2 G',
    gtin: '9120117912803',
    quantity: 6,
    unit: 'SZT.',
    netPrice: 157.94,
    vatRate: '8%',
    batchNumber: 'G5N026',
    expiryDate: '2027-12-31',
    quantityInBatch: 6,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-7',
    name: 'OMNI-BIOTIC STRESS REPAIR 9 56 SASZ. X 3 G',
    gtin: '9120117912766',
    quantity: 40,
    unit: 'SZT.',
    netPrice: 308.35,
    vatRate: '8%',
    batchNumber: '25E3473',
    expiryDate: '2028-08-31',
    quantityInBatch: 40,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-8',
    name: 'OMNI-BIOTIC STRESS REPAIR 9 7 SASZ. X 3 G',
    gtin: '9120117913138',
    quantity: 2,
    unit: 'SZT.',
    netPrice: 45.96,
    vatRate: '8%',
    batchNumber: '25E1356',
    expiryDate: '2028-02-29',
    quantityInBatch: 2,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-9',
    name: 'OMNI-BIOTIC STRESS REPAIR 9 KIDS 28 SASZ. X 1,2 G',
    gtin: '9120117915651',
    quantity: 20,
    unit: 'SZT.',
    netPrice: 112.81,
    vatRate: '8%',
    batchNumber: '25E4291',
    expiryDate: '2028-03-31',
    quantityInBatch: 20,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
  {
    id: 'sp-10',
    name: 'OMNI-LOGIC PLUS 450 G SŁOIK',
    gtin: '9120117912902',
    quantity: 5,
    unit: 'SZT.',
    netPrice: 183.01,
    vatRate: '8%',
    batchNumber: 'FP02529',
    expiryDate: '2028-01-31',
    quantityInBatch: 5,
    ocrMatched: true,
    ocrConfidence: 0.99,
  },
];

export const PRESET_SUPER_PHARM_META: InvoiceMeta = {
  invoiceNumber: '35/2026/KSEF',
  invoiceType: 'VAT',
  issueDate: '2026-09-10',
  issuePlace: 'Gdańsk',
  deliveryDate: '2026-09-11',
  orderNumber: 'C008848894',
  orderDate: '2026-09-08',
  dueDate: '2026-10-26',
  paymentDays: 45,
  paymentMethod: 'przelew',
  currency: 'PLN',
  ksefNumber: '9571106742-20260910-4BFAF5400004-D7',
  ksefReceiptDate: '2026-09-10',
  systemSource: 'KSeF Pharmacy Suite (FA3 crd.gov.pl)',
};

export const INITIAL_PHARMACY_ITEMS: InvoiceItem[] = PRESET_DR_MAX_ITEMS;
export const INITIAL_INVOICE_META: InvoiceMeta = PRESET_DR_MAX_META;

export const SAMPLE_ORDER_DOCUMENT_TEXT = `DOKUMENT ZAMÓWIENIA HURTOWEGO
Data zamówienia: 2026-09-28 | Numer zamówienia: ZZ-1009/09/26
Termin płatności: 2026-10-31 | Data dostawy: 2026-09-30
Dostawca: EUBIOSIS SP. Z O.O. (NIP: 9571106742)
Nabywca: DR. MAX LEKOMAT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ (NIP: 8943149010)
Adres: ul. Krzemieniecka 60A, 54-613 Wrocław
E-mail: faktury@drmax.pl

POZYCJE:
1. OMNi-BiOTiC® Active 60 g słoik | GTIN: 9120117912773 | Ilość: 4 SZT. | Cena: 166.30 PLN | VAT: 8%
2. OMNi-BiOTiC® TRAVEL 28 sasz. x 5 g | GTIN: 9120001435692 | Ilość: 3 SZT. | Cena: 157.94 PLN | VAT: 8%
3. OMNi-BiOTiC® PANDA 30 sasz. x 3 g | GTIN: 9120117912742 | Ilość: 51 SZT. | Cena: 157.94 PLN | VAT: 8%
4. OMNi-BiOTiC® STRESS Repair 9 7 sasz. x 3 g | GTIN: 9120117913138 | Ilość: 1 SZT. | Cena: 45.96 PLN | VAT: 8%
`;

export const SAMPLE_ORDER_SUPER_PHARM_TEXT = `DOKUMENT ZAMÓWIENIA HURTOWEGO
Data złożenia zamówienia: 2026-09-08 | Numer zamówienia: C008848894
Termin płatności: 2026-10-26 | Data dostawy: 2026-09-11
Dostawca: EUBIOSIS SP. Z O.O. (NIP: 9571106742)
Nabywca: SUPER -PHARM HOLDING SPÓŁKA Z O.O. (NIP: 5213842837)
Adres: ul. Domaniewska 48, 02-672 Warszawa | E-mail: faktury@superpharm.pl
Odbiorca: Magazyn Centralny Super Pharm Holding, Aleja 20-lecia 23, 96-515 Teresin (ID-Wew: 5213842837-54936)

POZYCJE ZAMÓWIENIA:
1. OMNI-BIOTIC 6 60 SASZ. X 3 G | GTIN: 9120117912711 | Ilość: 6 SZT. | Cena: 416.99 PLN | VAT: 8%
2. OMNI-BIOTIC FLORA PLUS 28 SASZ. X 2 G | GTIN: 9120117912865 | Ilość: 12 SZT. | Cena: 157.94 PLN | VAT: 8%
3. OMNI-BIOTIC HETOX 30 SASZ. X 6 G | GTIN: 9120117912827 | Ilość: 10 SZT. | Cena: 325.07 PLN | VAT: 8%
4. OMNI-BIOTIC METABOLIC 30 SASZ. X 3 G | GTIN: 9120117912810 | Ilość: 3 SZT. | Cena: 166.30 PLN | VAT: 8%
5. OMNI-BIOTIC PRO-VI 5 14 SASZ. X 2 G | GTIN: 9120117912797 | Ilość: 2 SZT. | Cena: 82.73 PLN | VAT: 8%
6. OMNI-BIOTIC PRO-VI 5 30 SASZ. X 2 G | GTIN: 9120117912803 | Ilość: 6 SZT. | Cena: 157.94 PLN | VAT: 8%
7. OMNI-BIOTIC STRESS REPAIR 9 56 SASZ. X 3 G | GTIN: 9120117912766 | Ilość: 40 SZT. | Cena: 308.35 PLN | VAT: 8%
8. OMNI-BIOTIC STRESS REPAIR 9 7 SASZ. X 3 G | GTIN: 9120117913138 | Ilość: 2 SZT. | Cena: 45.96 PLN | VAT: 8%
9. OMNI-BIOTIC STRESS REPAIR 9 KIDS 28 SASZ. X 1,2 G | GTIN: 9120117915651 | Ilość: 20 SZT. | Cena: 112.81 PLN | VAT: 8%
10. OMNI-LOGIC PLUS 450 G SŁOIK | GTIN: 9120117912902 | Ilość: 5 SZT. | Cena: 183.01 PLN | VAT: 8%
`;

/**
 * Wzorzec zamówienia bez serii i dat ważności (standardowe zamówienie handlowe)
 */
export const SAMPLE_ORDER_NO_BATCHES_TEXT = `DOKUMENT ZAMÓWIENIA HURTOWEGO (BEZ SERII I DAT)
Data zamówienia: 2026-10-01 | Numer zamówienia: ZAM-41/2026/KSEF
Termin płatności: 2026-11-15 | Data dostawy: 2026-09-30
Dostawca: EUBIOSIS SP. Z O.O. (NIP: 9571106742)
Nabywca: DR. MAX LEKOMAT SPÓŁKA Z O.O. (NIP: 8943149010)
Adres: ul. Krzemieniecka 60A, 54-613 Wrocław | E-mail: faktury@drmax.pl

POZYCJE TOWAROWE:
1. OMNi-BiOTiC® Active 60 g słoik | GTIN: 9120117912773 | Ilość: 4 SZT. | Cena: 166.30 PLN | VAT: 8%
2. OMNi-BiOTiC® TRAVEL 28 sasz. x 5 g | GTIN: 9120001435692 | Ilość: 3 SZT. | Cena: 157.94 PLN | VAT: 8%
3. OMNi-BiOTiC® PANDA 30 sasz. x 3 g | GTIN: 9120117912742 | Ilość: 51 SZT. | Cena: 157.94 PLN | VAT: 8%
4. OMNi-BiOTiC® STRESS Repair 28 sasz. x 3 g | GTIN: 9120117912759 | Ilość: 2 SZT. | Cena: 22.98 PLN | VAT: 8%
`;

export const PRESET_NO_BATCHES_ITEMS: InvoiceItem[] = [
  {
    id: 'nobatch-1',
    name: 'OMNi-BiOTiC® Active 60 g słoik',
    gtin: '9120117912773',
    quantity: 4,
    unit: 'SZT.',
    netPrice: 166.3,
    vatRate: '8%',
    batchNumber: '',
    expiryDate: '',
    quantityInBatch: 4,
  },
  {
    id: 'nobatch-2',
    name: 'OMNi-BiOTiC® TRAVEL 28 sasz. x 5 g',
    gtin: '9120001435692',
    quantity: 3,
    unit: 'SZT.',
    netPrice: 157.94,
    vatRate: '8%',
    batchNumber: '',
    expiryDate: '',
    quantityInBatch: 3,
  },
  {
    id: 'nobatch-3',
    name: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g',
    gtin: '9120117912742',
    quantity: 51,
    unit: 'SZT.',
    netPrice: 157.94,
    vatRate: '8%',
    batchNumber: '',
    expiryDate: '',
    quantityInBatch: 51,
  },
  {
    id: 'nobatch-4',
    name: 'OMNi-BiOTiC® STRESS Repair 28 sasz. x 3 g',
    gtin: '9120117912759',
    quantity: 2,
    unit: 'SZT.',
    netPrice: 22.98,
    vatRate: '8%',
    batchNumber: '',
    expiryDate: '',
    quantityInBatch: 2,
  },
];

