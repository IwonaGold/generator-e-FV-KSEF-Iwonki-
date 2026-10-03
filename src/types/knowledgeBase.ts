export interface ClientContactPerson {
  id: string;
  role: string; // np. "Kupiec / Zamówienia", "Magazyn / Awizacje", "Faktury / Księgowość"
  name?: string;
  email: string;
  phone?: string;
}

export interface ClientNote {
  id: string;
  createdAt: string; // ISO lub czytelna data
  author?: string;
  content: string;
  isPinned?: boolean;
  category?: 'ustalenia' | 'faktury' | 'logistyka' | 'inne';
}

export interface ClientPriceListItem {
  lp: number;
  category: string;
  name: string;
  ean: string;
  bloz: string;
  vatRate: string;
  baseNetPrice: number; // Cena hurtowa / ExFactory przed rabatem
  discountLabel: string; // np. "15%" (DOZ) lub "5%" (Q3)
  invoiceNetPrice: number; // CENA PO RABACIE NETTO — TA CENA MA BYĆ NA FV!
  grossAfterDiscount?: number; // Cena po rabacie brutto (opcjonalnie)
}

export interface KeyClientProfile {
  id: string;
  shortName: string; // np. "DOZ Direct", "Dr. Max", "Super-Pharm", "Gemini", "Nabea", "Modum Pharma"
  fullName: string;
  nip: string;
  glnBuyer?: string;
  glnDelivery?: string;
  idWew?: string;
  colorTheme: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'teal' | 'indigo' | 'slate';

  // Cennik przypisany do kontrahenta
  priceListType?: 'DOZ_SPECIAL' | 'Q3_STANDARD';
  priceListTitle?: string;
  priceListRule?: string;

  // 1. Wymagania dotyczące wystawiania FV
  invoiceSystem: 'KSeF_FA3' | 'ZEWNETRZNY_SYSTEM' | 'KSEF_I_PORTAL';
  invoiceSystemLabel: string;
  paymentDays: number;
  ksefLogisticsFormat: string;
  invoiceRequirements: string;

  // 2. Wymagana data ważności produktów (MHD)
  minExpiryRequirement: string;
  shortExpiryPolicy: string;

  // 3. Forma awizacji dostawy
  avisoMethod: string;
  avisoDetails: string;

  // 4. Adres do wysyłki (Magazyn docelowy) i adres siedziby
  headquartersAddress: string;
  shippingWarehouseName: string;
  shippingAddress: string;
  shippingRemarks?: string;

  // 5. Adresy mailowe do korespondencji
  contacts: ClientContactPerson[];

  // 6. Notatki i historia nowych ustaleń
  notes: ClientNote[];

  updatedAt: string;
}

/**
 * CENNIK SPECJALNY DLA DOZ DIRECT (NIŻSZE CENY — RABAT 15% NA FAKTURZE)
 * Na fakturze VAT zawsze obowiązuje kolumna: invoiceNetPrice (Cena zakupu DD po rabacie netto)
 */
export const DOZ_SPECIAL_PRICE_LIST: ClientPriceListItem[] = [
  { lp: 1, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 7 sasz. x 3 g', ean: '9120001434725', bloz: '4017421', vatRate: '8%', baseNetPrice: 63.89, discountLabel: '15%', invoiceNetPrice: 54.31, grossAfterDiscount: 58.65 },
  { lp: 2, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 30 sasz. x 3 g', ean: '9120117912704', bloz: '3756191', vatRate: '8%', baseNetPrice: 258.33, discountLabel: '15%', invoiceNetPrice: 219.58, grossAfterDiscount: 237.15 },
  { lp: 3, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 60 sasz. x 3 g', ean: '9120001432868', bloz: '3756181', vatRate: '8%', baseNetPrice: 462.04, discountLabel: '15%', invoiceNetPrice: 392.73, grossAfterDiscount: 424.15 },
  { lp: 4, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 60 g słoik', ean: '9120117912681', bloz: '3756141', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
  { lp: 5, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 300 g słoik', ean: '9120001434718', bloz: '3756171', vatRate: '8%', baseNetPrice: 693.52, discountLabel: '15%', invoiceNetPrice: 589.49, grossAfterDiscount: 636.65 },
  { lp: 6, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 7 sasz. x 3 g', ean: '9120001432776', bloz: '3759571', vatRate: '8%', baseNetPrice: 50.93, discountLabel: '15%', invoiceNetPrice: 43.29, grossAfterDiscount: 46.75 },
  { lp: 7, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 28 sasz. x 3 g', ean: '9120001435685', bloz: '3759561', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
  { lp: 8, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 56 sasz. x 3 g', ean: '9120001432639', bloz: '3759581', vatRate: '8%', baseNetPrice: 341.67, discountLabel: '15%', invoiceNetPrice: 290.42, grossAfterDiscount: 313.65 },
  { lp: 9, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 kids 28 sasz. x 1,2 g', ean: '9120117915651', bloz: '4411200', vatRate: '8%', baseNetPrice: 125.00, discountLabel: '15%', invoiceNetPrice: 106.25, grossAfterDiscount: 114.75 },
  { lp: 10, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® PANDA 7 sasz. x 3 g', ean: '9120001432813', bloz: '4017361', vatRate: '8%', baseNetPrice: 45.37, discountLabel: '15%', invoiceNetPrice: 38.56, grossAfterDiscount: 41.64 },
  { lp: 11, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® PANDA 30 sasz. x 3 g', ean: '9120001435661', bloz: '4018461', vatRate: '8%', baseNetPrice: 175.00, discountLabel: '15%', invoiceNetPrice: 148.75, grossAfterDiscount: 160.65 },
  { lp: 12, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 10 AAD 10 sasz. x 5 g', ean: '9120001435586', bloz: '3761471', vatRate: '8%', baseNetPrice: 73.15, discountLabel: '15%', invoiceNetPrice: 62.18, grossAfterDiscount: 67.15 },
  { lp: 13, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 10 AAD 30 sasz. x 5 g', ean: '9120001435593', bloz: '3761441', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
  { lp: 14, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 10 AAD Kids 20 sasz. x 2,5 g', ean: '9120117911370', bloz: '4149561', vatRate: '8%', baseNetPrice: 78.70, discountLabel: '15%', invoiceNetPrice: 66.90, grossAfterDiscount: 72.25 },
  { lp: 15, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® Pro-Vi 5 14 sasz. x 2 g', ean: '9120117912797', bloz: '3812961', vatRate: '8%', baseNetPrice: 91.67, discountLabel: '15%', invoiceNetPrice: 77.92, grossAfterDiscount: 84.15 },
  { lp: 16, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® Pro-Vi 5 30 sasz. x 2 g', ean: '9120001433971', bloz: '3812971', vatRate: '8%', baseNetPrice: 175.00, discountLabel: '15%', invoiceNetPrice: 148.75, grossAfterDiscount: 160.65 },
  { lp: 17, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® FLORA plus 14 sasz. x 2 g', ean: '9120117912858', bloz: '4169241', vatRate: '8%', baseNetPrice: 91.67, discountLabel: '15%', invoiceNetPrice: 77.92, grossAfterDiscount: 84.15 },
  { lp: 18, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® FLORA plus 28 sasz. x 2 g', ean: '9120117912025', bloz: '4169271', vatRate: '8%', baseNetPrice: 175.00, discountLabel: '15%', invoiceNetPrice: 148.75, grossAfterDiscount: 160.65 },
  { lp: 19, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® Active 60 g słoik', ean: '9120001435623', bloz: '3756161', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
  { lp: 20, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® TRAVEL 14 sasz. x 5 g', ean: '9120001434978', bloz: '3761481', vatRate: '8%', baseNetPrice: 91.67, discountLabel: '15%', invoiceNetPrice: 77.92, grossAfterDiscount: 84.15 },
  { lp: 21, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® TRAVEL 28 sasz. x 5 g', ean: '9120001435692', bloz: '4183221', vatRate: '8%', baseNetPrice: 175.00, discountLabel: '15%', invoiceNetPrice: 148.75, grossAfterDiscount: 160.65 },
  { lp: 22, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® COLONIZE 28 sasz. x 3 g', ean: '9120117914906', bloz: '4085441', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
  { lp: 23, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® metabolic 30 sasz. x 3 g', ean: '9120001435005', bloz: '3756221', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
  { lp: 24, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® CAT & DOG 60 g słoik', ean: '9120001436088', bloz: '3760261', vatRate: '8%', baseNetPrice: 137.96, discountLabel: '15%', invoiceNetPrice: 117.27, grossAfterDiscount: 126.65 },
  { lp: 25, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® CAT & DOG 28 sasz. x 2 g', ean: '9120117916795', bloz: '-', vatRate: '8%', baseNetPrice: 137.96, discountLabel: '15%', invoiceNetPrice: 117.27, grossAfterDiscount: 126.65 },
  { lp: 26, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® POWER 28 sasz. x 4 g', ean: '9120001435678', bloz: '4171661', vatRate: '8%', baseNetPrice: 175.00, discountLabel: '15%', invoiceNetPrice: 148.75, grossAfterDiscount: 160.65 },
  { lp: 27, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® HETOX 30 sasz. x 6 g', ean: '9120117912827', bloz: '4168241', vatRate: '8%', baseNetPrice: 360.19, discountLabel: '15%', invoiceNetPrice: 306.16, grossAfterDiscount: 330.65 },
  { lp: 28, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® METAtox 30 sasz. x 3 g', ean: '9120117912834', bloz: '4170921', vatRate: '8%', baseNetPrice: 193.52, discountLabel: '15%', invoiceNetPrice: 164.49, grossAfterDiscount: 177.65 },
  { lp: 29, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® FIBRE 250 g słoik', ean: '9120117912889', bloz: '3755661', vatRate: '8%', baseNetPrice: 91.67, discountLabel: '15%', invoiceNetPrice: 77.92, grossAfterDiscount: 84.15 },
  { lp: 30, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® APPLE PECTIN 84 kaps.', ean: '9120117912926', bloz: '3755742', vatRate: '8%', baseNetPrice: 100.93, discountLabel: '15%', invoiceNetPrice: 85.79, grossAfterDiscount: 92.65 },
  { lp: 31, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® APPLE PECTIN 180 kaps.', ean: '9120001433933', bloz: '3755741', vatRate: '8%', baseNetPrice: 165.74, discountLabel: '15%', invoiceNetPrice: 140.88, grossAfterDiscount: 152.15 },
  { lp: 32, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® IMMUNE 450 g słoik', ean: '9120117912896', bloz: '3755721', vatRate: '8%', baseNetPrice: 202.78, discountLabel: '15%', invoiceNetPrice: 172.36, grossAfterDiscount: 186.15 },
  { lp: 33, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® PLUS 450 g słoik', ean: '9120117912902', bloz: '3761361', vatRate: '8%', baseNetPrice: 202.78, discountLabel: '15%', invoiceNetPrice: 172.36, grossAfterDiscount: 186.15 },
  { lp: 34, category: 'Postbiotyk', name: 'MikroSan 1000 ml', ean: '9120117912933', bloz: '3792341', vatRate: '8%', baseNetPrice: 184.26, discountLabel: '15%', invoiceNetPrice: 156.62, grossAfterDiscount: 169.15 },
];

/**
 * CENNIK Q3 / OFERTA HANDLOWA DLA POZOSTAŁYCH KLIENTÓW (DR. MAX, GEMINI, SUPER-PHARM, NABEA, MODUM PHARMA)
 * Na fakturze VAT zawsze obowiązuje kolumna: invoiceNetPrice (Cena po rabacie 5% netto)
 */
export const STANDARD_Q3_PRICE_LIST: ClientPriceListItem[] = [
  { lp: 1, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 (7 sasz. x 3 g)', ean: '9120117912728', bloz: '3993975', vatRate: '8%', baseNetPrice: 60.69, discountLabel: '5%', invoiceNetPrice: 57.66, grossAfterDiscount: 62.27 },
  { lp: 2, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 (30 sasz. x 3 g)', ean: '9120117912704', bloz: '3093654', vatRate: '8%', baseNetPrice: 245.42, discountLabel: '5%', invoiceNetPrice: 233.15, grossAfterDiscount: 251.80 },
  { lp: 3, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 (60 sasz. x 3 g)', ean: '9120117912711', bloz: '5926094', vatRate: '8%', baseNetPrice: 438.94, discountLabel: '5%', invoiceNetPrice: 416.99, grossAfterDiscount: 450.35 },
  { lp: 4, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 (60 g słoik)', ean: '9120117912681', bloz: '7995511', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
  { lp: 5, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 6 (300 g słoik)', ean: '9120117914692', bloz: '9216538', vatRate: '8%', baseNetPrice: 658.84, discountLabel: '5%', invoiceNetPrice: 625.90, grossAfterDiscount: 675.97 },
  { lp: 6, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 (7 sasz. x 3 g)', ean: '9120117913138', bloz: '6415175', vatRate: '8%', baseNetPrice: 48.38, discountLabel: '5%', invoiceNetPrice: 45.96, grossAfterDiscount: 49.64 },
  { lp: 7, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 (28 sasz. x 3 g)', ean: '9120117912759', bloz: '4180061', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
  { lp: 8, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair 9 (56 sasz. x 3 g)', ean: '9120117912766', bloz: '7162854', vatRate: '8%', baseNetPrice: 324.58, discountLabel: '5%', invoiceNetPrice: 308.35, grossAfterDiscount: 333.02 },
  { lp: 9, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® STRESS Repair Kids 9 (28 sasz. x 1,2 g)', ean: '9120117915651', bloz: '4411200', vatRate: '8%', baseNetPrice: 118.75, discountLabel: '5%', invoiceNetPrice: 112.81, grossAfterDiscount: 121.83 },
  { lp: 10, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® PANDA (7 sasz. x 3 g)', ean: '9120117912735', bloz: '3289242', vatRate: '8%', baseNetPrice: 43.10, discountLabel: '5%', invoiceNetPrice: 40.95, grossAfterDiscount: 44.23 },
  { lp: 11, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® PANDA (30 sasz. x 3 g)', ean: '9120117912742', bloz: '4057829', vatRate: '8%', baseNetPrice: 166.25, discountLabel: '5%', invoiceNetPrice: 157.94, grossAfterDiscount: 170.58 },
  { lp: 12, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 10 AAD (10 sasz. x 5 g)', ean: '9120117912667', bloz: '4365172', vatRate: '8%', baseNetPrice: 69.49, discountLabel: '5%', invoiceNetPrice: 66.02, grossAfterDiscount: 71.30 },
  { lp: 13, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 10 AAD (30 sasz. x 5 g)', ean: '9120117912674', bloz: '6711948', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
  { lp: 14, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® 10 AAD Kids (20 sasz. x 2,5 g)', ean: '9120117911370', bloz: '4149561', vatRate: '8%', baseNetPrice: 74.77, discountLabel: '5%', invoiceNetPrice: 71.03, grossAfterDiscount: 76.71 },
  { lp: 15, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® Pro-Vi 5 (14 sasz. x 2 g)', ean: '9120117912797', bloz: '6849137', vatRate: '8%', baseNetPrice: 87.08, discountLabel: '5%', invoiceNetPrice: 82.73, grossAfterDiscount: 89.35 },
  { lp: 16, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® Pro-Vi 5 (30 sasz. x 2 g)', ean: '9120117912803', bloz: '5825231', vatRate: '8%', baseNetPrice: 166.25, discountLabel: '5%', invoiceNetPrice: 157.94, grossAfterDiscount: 170.58 },
  { lp: 17, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® FLORA plus (14 sasz. x 2 g)', ean: '9120117912858', bloz: '4169241', vatRate: '8%', baseNetPrice: 87.08, discountLabel: '5%', invoiceNetPrice: 82.73, grossAfterDiscount: 89.35 },
  { lp: 18, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® FLORA plus (28 sasz. x 2 g)', ean: '9120117912865', bloz: '4169271', vatRate: '8%', baseNetPrice: 166.25, discountLabel: '5%', invoiceNetPrice: 157.94, grossAfterDiscount: 170.58 },
  { lp: 19, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® Active (60 g słoik)', ean: '9120117912773', bloz: '8660507', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
  { lp: 20, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® TRAVEL (14 sasz. x 5 g)', ean: '9120117914470', bloz: '6415175', vatRate: '8%', baseNetPrice: 87.08, discountLabel: '5%', invoiceNetPrice: 82.73, grossAfterDiscount: 89.35 },
  { lp: 21, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® TRAVEL (28 sasz. x 5 g)', ean: '9120001435692', bloz: '4183221', vatRate: '8%', baseNetPrice: 166.25, discountLabel: '5%', invoiceNetPrice: 157.94, grossAfterDiscount: 170.58 },
  { lp: 22, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® COLONIZE (28 sasz. x 3 g)', ean: '9120117914906', bloz: '4742739', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
  { lp: 23, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® metabolic (30 sasz. x 3 g)', ean: '9120117912810', bloz: '5894337', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
  { lp: 24, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® POWER (28 sasz. x 4 g)', ean: '9120117912841', bloz: '6032278', vatRate: '8%', baseNetPrice: 166.25, discountLabel: '5%', invoiceNetPrice: 157.94, grossAfterDiscount: 170.58 },
  { lp: 25, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® HETOX (30 sasz. x 6 g)', ean: '9120117912827', bloz: '3637671', vatRate: '8%', baseNetPrice: 342.18, discountLabel: '5%', invoiceNetPrice: 325.07, grossAfterDiscount: 351.08 },
  { lp: 26, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® METAtox (30 sasz. x 3 g)', ean: '9120117912834', bloz: '9637262', vatRate: '8%', baseNetPrice: 183.84, discountLabel: '5%', invoiceNetPrice: 174.65, grossAfterDiscount: 188.62 },
  { lp: 27, category: 'Synbiotyk OMNi-BiOTiC®', name: 'OMNi-BiOTiC® CAT & DOG (28 sasz. x 2 g)', ean: '9120117916795', bloz: '-', vatRate: '8%', baseNetPrice: 131.06, discountLabel: '5%', invoiceNetPrice: 124.51, grossAfterDiscount: 134.47 },
  { lp: 28, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® FIBRE (250 g słoik)', ean: '9120117912889', bloz: '7102257', vatRate: '8%', baseNetPrice: 87.08, discountLabel: '5%', invoiceNetPrice: 82.73, grossAfterDiscount: 89.35 },
  { lp: 29, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® APPLE PECTIN (84 kaps.)', ean: '9120117912926', bloz: '8541296', vatRate: '8%', baseNetPrice: 95.88, discountLabel: '5%', invoiceNetPrice: 91.09, grossAfterDiscount: 98.38 },
  { lp: 30, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® APPLE PECTIN (180 kaps.)', ean: '9120117912919', bloz: '9317975', vatRate: '8%', baseNetPrice: 157.45, discountLabel: '5%', invoiceNetPrice: 149.58, grossAfterDiscount: 161.55 },
  { lp: 31, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® IMMUNE (450 g słoik)', ean: '9120117912896', bloz: '6835976', vatRate: '8%', baseNetPrice: 192.64, discountLabel: '5%', invoiceNetPrice: 183.01, grossAfterDiscount: 197.65 },
  { lp: 32, category: 'Prebiotyk OMNi-LOGiC®', name: 'OMNi-LOGiC® PLUS (450 g słoik)', ean: '9120117912902', bloz: '9019325', vatRate: '8%', baseNetPrice: 192.64, discountLabel: '5%', invoiceNetPrice: 183.01, grossAfterDiscount: 197.65 },
  { lp: 33, category: 'Postbiotyk', name: 'MikroSan (1000 ml)', ean: '9120117912933', bloz: '4816633', vatRate: '8%', baseNetPrice: 175.05, discountLabel: '5%', invoiceNetPrice: 166.30, grossAfterDiscount: 179.60 },
];

export const INITIAL_KEY_CLIENTS: KeyClientProfile[] = [
  // ==========================================================================
  // 1. DOZ DIRECT
  // ==========================================================================
  {
    id: 'client-doz',
    shortName: 'DOZ Direct',
    fullName: 'DOZ Spółka Akcyjna Direct Sp. k. – Hurtownia Farmaceutyczna',
    nip: '8271807718',
    glnBuyer: '5909000828476',
    glnDelivery: '5909000848054',
    colorTheme: 'amber',
    priceListType: 'DOZ_SPECIAL',
    priceListTitle: 'Cennik Specjalny DOZ Direct (niższe ceny – rabat 15% na fakturze)',
    priceListRule: 'WAŻNE: Na fakturze VAT (FV) zawsze musi być CENA PO RABACIE NETTO (kolumna „Cena po rabacie netto na FV” – niższe ceny dedykowane dla DOZ Direct)!',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'FV KSeF (+ MHD, seria GS1) – bez osobnej tabeli specyfikacji (dane są już na FV)',
    paymentDays: 60,
    ksefLogisticsFormat: 'GS1 (NumerSeriiDataPrzydatnosciIlosc) + kod GTIN/EAN',
    invoiceRequirements:
      '• 💰 CENNIK DOZ DIRECT: Obowiązuje dedykowany cennik DOZ (niższe ceny). Na FV zawsze wpisujemy CENĘ PO RABACIE NETTO!\n' +
      '• Termin płatności: 60 dni.\n' +
      '• Wystawiamy: FV KSeF (+ MHD, seria w standardzie GS1). Nie trzeba już wysyłać osobnej tabeli specyfikacji, ponieważ wszystkie wymagane dane znajdują się bezpośrednio na FV.\n' +
      '• Po wystawieniu wysłać FV na adresy: kpd_dd@doz.pl oraz dwd_dd@doz.pl.\n' +
      '• Na fakturze obowiązkowe: numer i data zamówienia, nazwa i postać produktu, kod EAN, numer serii/partii, data ważności, ilość, termin płatności oraz dane Nabywcy (ILN: 5909000828476) i Miejsca dostawy: ul. Kinga C. Gillette 1, 9 i 11 (ILN: 5909000848054, Nr zezwolenia: GIF-N-411/820/MSH/14).\n' +
      '• Dokumenty przy dostawie umieścić NA BOKU palety/kartonu (zakaz wkładania do środka zaklejonego kartonu!).',
    minExpiryRequirement:
      'Produkty o całkowitym okresie > 12 msc: min. 75% całkowitego okresu przydatności i NIE MNIEJ NIŻ 12 MIESIĘCY. (Produkty < 12 msc: min. 75% okresu i nie mniej niż 6 miesięcy).',
    shortExpiryPolicy:
      'Jeśli termin przydatności jest krótszy, DOZ Direct ma prawo zwrotu towaru. Wyjątki (krótsza data ważności) dopuszczalne WYŁĄCZNIE po każdorazowym pisemnym potwierdzeniu przez Dział Zaopatrzenia DOZ.',
    avisoMethod: 'Potwierdzenie przyjęcia zamówienia, awizacja i ustalenie formy wysyłki: aswinoga@doz.pl',
    avisoDetails:
      '• Nadrzędna zasada pakowania: JEDEN KARTON = JEDEN TERMIN WAŻNOŚCI = JEDNA SERIA = JEDEN NUMER PARTII.\n' +
      '• Kartony niepełne / palety MIX: każdy produkt w oddzielny kartonik/zgrzewkę, okleić inną taśmą (preferowana taśma z napisem „MIX”), a paletę wyraźnie oznaczyć słowem „MIX” z dodatkową etykietą z ilościami i rodzajami produktów.\n' +
      '• Standard palet: wyłącznie palety EUR, EPAL lub CHEP (1200x800 mm), MAKSYMALNA WYSOKOŚĆ: 160 cm, MAKSYMALNA WAGA: 900 kg.\n' +
      '• Paleta musi być owinięta PRZEZROCZYSTYM STRETCHEM (razem z podstawą palety), a kartony ustawione tak, aby etykieta każdego kartonu była widoczna z zewnątrz.',
    headquartersAddress: 'ul. Kinga C. Gillette 11, 94-406 Łódź (ILN: 5909000828476)',
    shippingWarehouseName: 'DOZ S.A. Direct Sp. k. – Hurtownia Farmaceutyczna',
    shippingAddress: 'ul. Kinga C. Gillette 1, 9 i 11 (rampa 17-21), 94-406 Łódź',
    shippingRemarks:
      'ZMIANA ADRESU DOSTAWY: ul. Kinga C. Gillette 1, 9 i 11 (dodano nr 1!) · ILN dostawy: 5909000848054 · Max wys. palety 160 cm, max waga 900 kg, przezroczysty stretch.',
    contacts: [
      {
        id: 'doz-c1',
        role: 'Potwierdzenie przyjęcia, awizacja, forma wysyłki',
        name: 'A. Świnoga (DOZ)',
        email: 'aswinoga@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c2',
        role: 'Wysyłka Faktury (FV)',
        name: 'KPD DOZ Direct',
        email: 'kpd_dd@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c3',
        role: 'Wysyłka Faktury (FV)',
        name: 'DWD DOZ Direct',
        email: 'dwd_dd@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c4',
        role: 'Windykacja / Gdy zalegają z płatnością',
        name: 'Dział Płatności BSSCE',
        email: 'fk_platnosci@bssce.com',
        phone: '',
      },
      {
        id: 'doz-c5',
        role: 'Dokumenty EDI (FV, WZ, potwierdzenia)',
        name: 'Bramka EDI DOZ',
        email: 'edidokumenty@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c6',
        role: 'Konfiguracja EDI',
        name: 'Małgorzata Matyja',
        email: 'mmatyja@doz.pl',
        phone: '+48 532 792 038',
      },
    ],
    notes: [
      {
        id: 'doz-n1',
        createdAt: '2026-10-03 15:45',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA DOZ DIRECT:\n• Adres dostawy po zmianie: ul. Kinga C. Gillette 1, 9 i 11 (rampa 17-21), 94-406 Łódź.\n• Obowiązuje dedykowany Cennik DOZ Direct (niższe ceny) — na FV zawsze CENA PO RABACIE NETTO!\n• Termin płatności: 60 dni, FV KSeF (+ MHD, seria GS1) — bez osobnej tabeli specyfikacji (wszystkie dane są już na FV).\n• aswinoga@doz.pl – potwierdzenie przyjęcia, awizacja, forma wysyłki\n• kpd_dd@doz.pl , dwd_dd@doz.pl – wysyłka FV\n• fk_platnosci@bssce.com – pisać tutaj, gdy zalegają z płatnością!',
      },
      {
        id: 'doz-n2',
        createdAt: '2026-10-03 15:21',
        category: 'logistyka',
        isPinned: true,
        content:
          'WYMOGI MAGAZYNOWE DOZ:\n• Jeden karton = Jeden termin ważności = Jedna seria.\n• Kartony niepełne oklejać taśmą „MIX”.\n• Paleta EUR/EPAL max 160 cm wysokości i max 900 kg wagi, owinięta przezroczystym stretchem (etykiety kartonów widoczne na zewnątrz).\n• Zmiany EAN, gramatury, VAT lub wymiarów zgłaszać min. 30 dni wcześniej do Opiekuna Dostawcy.',
      },
    ],
    updatedAt: '2026-10-03T15:50:00.000Z',
  },

  // ==========================================================================
  // 2. DR. MAX (HURTOWNIA DROGERYJNA LEKOMAT)
  // ==========================================================================
  {
    id: 'client-drmax',
    shortName: 'Dr. Max (Lekomat)',
    fullName: 'Dr. Max Hurtownia Drogeryjna Lekomat (Dr. Max Lekomat Sp. z o.o.)',
    nip: '8943149010',
    colorTheme: 'emerald',
    priceListType: 'Q3_STANDARD',
    priceListTitle: 'Cennik Q3 (Oferta Handlowa – rabat 5% na fakturze)',
    priceListRule: 'WAŻNE: Na fakturze VAT (FV) zawsze musi być CENA PO RABACIE NETTO (kolumna „Cena po rabacie 5% netto na FV”)!',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'FV KSeF (Hurtownia Drogeryjna Lekomat: bez MHD/serii lub wg wytycznych GS1)',
    paymentDays: 30,
    ksefLogisticsFormat:
      'Hurtownia Drogeryjna Lekomat: bez MHD/serii | Pozostałe spółki Dr. Max: GS1 (NumerSeryjny / DataPrzydatnosci lub SerialNumberExpiratonDateQuantity: (10)SERIA(17)RRMMDD(37)ILOSC)',
    invoiceRequirements:
      '• 💰 CENNIK Q3: Na fakturze (FV) obowiązuje CENA PO RABACIE NETTO (rabat 5% netto z cennika Q3)!\n' +
      '• Termin płatności: 30 dni.\n' +
      '• Dla Dr. Max Hurtownia Drogeryjna Lekomat: FV KSeF (bez MHD/serii), wysyłka FV na dostawyecom@ / zamowieniaecom@.\n' +
      '• Wytyczne KSeF Grupy Dr. Max:\n' +
      '  – Numer zamówienia na poziomie pozycji w <DodatkowyOpis>: <Klucz>NrZamowieniaZew</Klucz> (numer zamówienia Dr. Max, max 30 znaków) lub <Klucz>NrZamowieniaWew</Klucz>.\n' +
      '  – Dla spółek aptecznych w nagłówku <DodatkowyOpis>: <Klucz>NrApteki</Klucz> lub <Klucz>KamsoftID</Klucz>.\n' +
      '  – Kody przyczyn korekt w KSeF (<PrzyczynaKorekty>): „Korekta - program lekowy”, „Korekta – rabat” (lub „Rabat za okres”), „Korekta – gazetka” (rozliczenia z tytułu gazetki Lekomat).',
    minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy (zgodnie z umową handlową)',
    shortExpiryPolicy:
      'Krótsza data ważności wymaga wcześniejszej akceptacji przed wysłaniem formularza awizacji.',
    avisoMethod:
      'lekomat.dostawy@drmax.com.pl – potwierdzenie zamówienia, FORMULARZ awizacji oraz ustalenie formy wysyłki',
    avisoDetails:
      '• Przed dostawą wysłać wypełniony FORMULARZ awizacji oraz potwierdzenie i formę wysyłki na adres: lekomat.dostawy@drmax.com.pl.\n' +
      '• Dokument logistyczny (WZ) powinien zawierać: NIP Dostawcy, NIP Odbiorcy, numer faktury dostawcy, KSeF ID (jeśli już nadany), numer zamówienia Dr. Max oraz pozycje (EAN, BLOZ, nazwa, ilość, cena netto, stawka VAT, seria i data ważności).',
    headquartersAddress: 'ul. Krzemieniecka 60A, 54-613 Wrocław (NIP: 8943149010)',
    shippingWarehouseName: 'Magazyn Dr. Max Lekomat (FM Logistic Łubna)',
    shippingAddress: 'ul. Łubińska 1a, 05-532 Łubna (lub ul. Krzemieniecka 60A, 54-613 Wrocław wg zamówienia)',
    shippingRemarks:
      'Sprawdzić na zamówieniu lokalizację magazynu docelowego (Łubna: ul. Łubińska 1a, 05-532 Łubna). Awizacja przez formularz na lekomat.dostawy@drmax.com.pl.',
    contacts: [
      {
        id: 'drmax-c1',
        role: 'Potwierdzenie, FORMULARZ awizacji, forma wysyłki',
        name: 'Magazyn Dostawy Lekomat',
        email: 'lekomat.dostawy@drmax.com.pl',
        phone: '',
      },
      {
        id: 'drmax-c2',
        role: 'Wysyłka FV (E-commerce / Dostawy)',
        name: 'Dostawy E-com Dr. Max',
        email: 'dostawyecom@drmax.com.pl',
        phone: '',
      },
      {
        id: 'drmax-c3',
        role: 'Wysyłka FV (Zamówienia E-com)',
        name: 'Zamówienia E-com Dr. Max',
        email: 'zamowieniaecom@drmax.com.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'drmax-n1',
        createdAt: '2026-10-03 15:45',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA DR. MAX HURTOWNIA DROGERYJNA LEKOMAT:\n• Obowiązuje Cennik Q3 — na FV musi być CENA PO RABACIE NETTO (rabat 5%)!\n• Termin płatności: 30 dni, FV KSeF (bez MHD/serii)\n• lekomat.dostawy@drmax.com.pl – potwierdzenie, FORMULARZ awizacji, forma wysyłki\n• dostawyecom@ , zamowieniaecom@ – wysyłka FV\n• Lokalizacja magazynu: ul. Łubińska 1a, 05-532 Łubna.',
      },
      {
        id: 'drmax-n2',
        createdAt: '2026-10-03 15:22',
        category: 'faktury',
        isPinned: false,
        content:
          'WYTYCZNE KOREKT KSeF DR. MAX (<PrzyczynaKorekty>):\n• Program lekowy: „Korekta - program lekowy”\n• Rabaty: „Korekta – rabat” lub „Rabat za okres”\n• Rozliczenia z tytułu gazetki Lekomat: „Korekta – gazetka”',
      },
    ],
    updatedAt: '2026-10-03T15:50:00.000Z',
  },

  // ==========================================================================
  // 3. GEMINI (GEMINI APPS / GEMINI POLSKA)
  // ==========================================================================
  {
    id: 'client-gemini',
    shortName: 'Gemini',
    fullName: 'Gemini Apps Sp. z o.o. (NIP: 5252801825) / Gemini Polska Sp. z o.o.',
    nip: '5252801825',
    colorTheme: 'purple',
    priceListType: 'Q3_STANDARD',
    priceListTitle: 'Cennik Q3 (Oferta Handlowa – rabat 5% na fakturze)',
    priceListRule: 'WAŻNE: Na fakturze VAT (FV) zawsze musi być CENA PO RABACIE NETTO (kolumna „Cena po rabacie 5% netto na FV”)!',
    invoiceSystem: 'ZEWNETRZNY_SYSTEM',
    invoiceSystemLabel: 'FV w-Firma + specyfikacja (oraz kopia XML/PDF + papierowa FV do dostawy)',
    paymentDays: 45,
    ksefLogisticsFormat: 'FV wystawiana w w-Firma + osobna specyfikacja (tabela) + kody GTIN na FV/WZ',
    invoiceRequirements:
      '• 💰 CENNIK Q3: Na fakturze (FV) obowiązuje CENA PO RABACIE NETTO (rabat 5% netto z cennika Q3)!\n' +
      '• Termin płatności: 45 dni.\n' +
      '• Nabywca/Płatnik (wg Standardu Dostaw Gemini Apps): Gemini Apps Sp. z o.o., Al. Grunwaldzka 411, 80-309 Gdańsk, NIP: 525-280-18-25.\n' +
      '• Wystawianie: FV w-Firma + specyfikacja (tabela).\n' +
      '• Po potwierdzeniu awizacji wysłać informację (kiedy wysyłamy, jak, fakturę oraz tabelę/specyfikację) na: ri@gemini.pl oraz aleksandra.teclaw@gemini.pl (oraz kopię XML/PDF na faktury@gemini.pl).\n' +
      '• OBOWIĄZKOWE PRZY DOSTAWIE FIZYCZNEJ (Standard Dostaw str. 3): Do każdej dostawy MUSI być dołączona PAPIEROWA wersja faktury VAT (pomimo wysłania elektronicznej!) oraz dokument WZ z indywidualnymi kodami GTIN produktów.\n' +
      '• Papierową fakturę umieścić na OZNACZONYM kartonie lub na górze/boku OZNACZONEJ palety (zakaz wkładania papierowej FV w środek opakowania zbiorczego na palecie!).\n' +
      '• Kody przyczyn korekt Gemini: GEM.K01 (ilościowa), GEM.K02 (błąd ceny), GEM.K03 (stawka VAT), GEM.K04 (błędy w danych niewartościowych np. seria/data), GEM.K05 (ustalenia stron/FUS), GEM.K06 (programy specjalne), GEM.K07 (akcja sprzedażowa), GEM.K08 (rabat).',
    minExpiryRequirement:
      'Zgodnie z umową handlową. Każdy produkt musi posiadać serię i datę ważności na opakowaniu oraz na etykiecie kartonu zbiorczego (*data ważności nieobowiązkowa dla kosmetyków).',
    shortExpiryPolicy:
      'Jeżeli data ważności lub numer serii są zakodowane, dostawca ma obowiązek wysłać instrukcję ich odkodowania na adres: awizacje@gemini.pl (brak instrukcji jest traktowany jak brak daty ważności!).',
    avisoMethod:
      'Obowiązkowa awizacja mailowa na awizacje@gemini.pl min. 48h przed planowaną dostawą (awizacja telefoniczna nie jest brana pod uwagę!)',
    avisoDetails:
      '• KROK 1 (Propozycja awizacji min. 48h przed dostawą na awizacje@gemini.pl):\n' +
      '  – W tytule maila: nazwa dostawcy + data planowanej dostawy.\n' +
      '  – W treści maila: liczba palet/kartonów, forma dostarczenia faktury, nazwa firmy transportowej.\n' +
      '• KROK 2 (Po potwierdzeniu awizacji przez Gemini): wysłać maila na ri@gemini.pl oraz aleksandra.teclaw@gemini.pl z informacją: kiedy wysyłamy, jak (kurier/paleta), załączyć fakturę oraz tabelę (specyfikację).\n' +
      '• ZASADY PAKOWANIA GEMINI:\n' +
      '  – Na etykiecie kartonu zbiorczego: nazwa produktu, liczba sztuk w kartonie, seria i data ważności.\n' +
      '  – Kartony niepełne NIE MOGĄ być uzupełniane innym produktem ani inną serią/datą — muszą mieć wyraźny napis „karton niepełny” lub przekreślenie.\n' +
      '  – Maksymalnie 1 paleta MIX w dostawie (produkty na palecie MIX wyraźnie oddzielone). Palety licencjonowane EUR EPAL 1200x800 mm.',
    headquartersAddress: 'Al. Grunwaldzka 411, 80-309 Gdańsk (NIP: 525-280-18-25)',
    shippingWarehouseName: 'Magazyn Logistyki Gemini (MB)',
    shippingAddress: 'ul. Azymutalna 15, 80-298 Gdańsk (przyjęcia pn–pt w godz. 7:00–17:00)',
    shippingRemarks:
      'Przyjęcia dostaw pn–pt 7:00–17:00 wyłącznie po potwierdzonej awizacji · Dołączyć papierową FV i WZ z kodami GTIN na oznaczonym kartonie/palecie!',
    contacts: [
      {
        id: 'gem-c1',
        role: '1. Propozycja terminu awizacji (min. 48h przed), ile palet/kartonów',
        name: 'Awizacje Magazyn Gemini',
        email: 'awizacje@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c2',
        role: '2. Po potwierdzeniu awizacji (kiedy wysyłamy, jak, FV, tabela)',
        name: 'Dział RI Gemini',
        email: 'ri@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c3',
        role: '2. Po potwierdzeniu awizacji (kiedy wysyłamy, jak, FV, tabela)',
        name: 'Aleksandra Tecław',
        email: 'aleksandra.teclaw@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c4',
        role: 'Kopia faktury VAT (format XML oraz PDF)',
        name: 'Księgowość / Faktury Gemini',
        email: 'faktury@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c5',
        role: 'Adres z którego spływają zamówienia Gemini',
        name: 'System zamówień PMS Gemini',
        email: 'pms-no-reply_k1@gemini.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'gem-n1',
        createdAt: '2026-10-03 15:45',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA GEMINI (zamówienia z: pms-no-reply_k1@gemini.pl):\n• Obowiązuje Cennik Q3 — na FV musi być CENA PO RABACIE NETTO (rabat 5%)!\n• Termin płatności: 45 dni, FV w-Firma + specyfikacja\n• 1) awizacje@gemini.pl – propozycja terminu awizacji (min. 48h wcześniej), podać na ilu paletach/kartonach\n• 2) ri@gemini.pl oraz aleksandra.teclaw@gemini.pl – po potwierdzeniu awizacji: napisać kiedy wysyłamy, jak, załączyć fakturę i tabelę!',
      },
      {
        id: 'gem-n2',
        createdAt: '2026-10-03 15:22',
        category: 'faktury',
        isPinned: true,
        content:
          'TABELA KODÓW PRZYCZYN KOREKTY GEMINI:\n• GEM.K01 – Korekta ilościowa (zmiana ilości towaru)\n• GEM.K02 – Korekta cenowa (błąd wystawiającego fakturę)\n• GEM.K03 – Korekta cenowa (zmiana stawki VAT)\n• GEM.K04 – Korekta danych niewartościowych (błędy w serii, dacie ważności, opisie, adresie)\n• GEM.K05 – Korekta wartościowa z ustaleń stron (np. FUS)\n• GEM.K06 – Korekta cenowa dla produktów specjalnych\n• GEM.K07 – Korekta cenowa z umowy / akcji sprzedażowej\n• GEM.K08 – Korekta wartościowa z umowy – rabat',
      },
    ],
    updatedAt: '2026-10-03T15:50:00.000Z',
  },

  // ==========================================================================
  // 4. SUPER-PHARM
  // ==========================================================================
  {
    id: 'client-superpharm',
    shortName: 'Super-Pharm',
    fullName: 'Super-Pharm Holding Sp. z o.o.',
    nip: '5213842837',
    idWew: '5213842837-54936',
    colorTheme: 'blue',
    priceListType: 'Q3_STANDARD',
    priceListTitle: 'Cennik Q3 (Oferta Handlowa – rabat 5% na fakturze)',
    priceListRule: 'WAŻNE: Na fakturze VAT (FV) zawsze musi być CENA PO RABACIE NETTO (kolumna „Cena po rabacie 5% netto na FV”)!',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'FV KSeF (+ MHD, seria w osobnych wierszach) + wysyłka na dsiwinski@superpharm.pl',
    paymentDays: 45,
    ksefLogisticsFormat: 'Osobne wiersze w <DodatkowyOpis>: "Data ważności" oraz "Seria" + Podmiot3 IDWew: 5213842837-54936',
    invoiceRequirements:
      '• 💰 CENNIK Q3: Na fakturze (FV) obowiązuje CENA PO RABACIE NETTO (rabat 5% netto z cennika Q3)!\n' +
      '• Termin płatności: 45 dni.\n' +
      '• Wystawiamy: FV KSeF (+ MHD i seria w osobnych wierszach).\n' +
      '• Nabywca: SUPER-PHARM HOLDING SP. Z O.O. (ul. Domaniewska 48, 02-672 Warszawa, NIP: 5213842837).\n' +
      '• Obowiązkowy <Podmiot3> (Rola 2 – Odbiorca): Magazyn Centralny Super-Pharm Holding, Aleja 20-lecia 23, 96-515 Teresin, <IDWew>5213842837-54936</IDWew>.\n' +
      '• Potwierdzenie realizacji zamówienia oraz fakturę wysyłać na adres: dsiwinski@superpharm.pl.',
    minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy',
    shortExpiryPolicy: 'Krótsza data ważności wymaga wcześniejszej zgody kupca przed awizacją w systemie DMS.',
    avisoMethod: 'Awizacja w systemie DMS + potwierdzenie realizacji zamówienia na dsiwinski@superpharm.pl',
    avisoDetails:
      '• Awizacja dokonywana w systemie DMS.\n' +
      '• Potwierdzenie realizacji zamówienia oraz faktura na maila: dsiwinski@superpharm.pl.\n' +
      '• WYMÓG OZNACZENIA PALETY I KARTONÓW:\n' +
      '  – Na palecie MUSI być widoczna NAZWA FIRMY oraz NUMER ZAMÓWIENIA!\n' +
      '  – MIX: każdy produkt pakowany w OSOBNE KARTONY.',
    headquartersAddress: 'ul. Domaniewska 48, 02-672 Warszawa (NIP: 5213842837)',
    shippingWarehouseName: 'Magazyn Centralny Super-Pharm Holding',
    shippingAddress: 'Aleja 20-lecia 23, 96-515 Teresin',
    shippingRemarks:
      'Na palecie MUSI być nazwa firmy oraz nr zamówienia! · MIX pakować w osobne kartony · Wysyłka zawsze do magazynu w Teresinie (96-515 Teresin).',
    contacts: [
      {
        id: 'sp-c1',
        role: 'Potwierdzenie realizacji zamówienia oraz wysyłka faktury',
        name: 'Damian Siwiński (Super-Pharm)',
        email: 'dsiwinski@superpharm.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'sp-n1',
        createdAt: '2026-10-03 15:45',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA SUPER-PHARM:\n• Obowiązuje Cennik Q3 — na FV musi być CENA PO RABACIE NETTO (rabat 5%)!\n• Termin płatności: 45 dni, FV KSeF (+ MHD, seria w osobnych wierszach)\n• Awizacja w systemie DMS\n• dsiwinski@superpharm.pl – potwierdzenie realizacji zamówienia oraz faktura\n• Na palecie MUSI być nazwa firmy oraz nr zamówienia!\n• MIX – osobne kartony.',
      },
    ],
    updatedAt: '2026-10-03T15:50:00.000Z',
  },

  // ==========================================================================
  // 5. MODUM PHARMA
  // ==========================================================================
  {
    id: 'client-modumpharma',
    shortName: 'Modum Pharma',
    fullName: 'Modum Pharma',
    nip: 'Brak / wg zamówienia',
    colorTheme: 'teal',
    priceListType: 'Q3_STANDARD',
    priceListTitle: 'Cennik Q3 (Oferta Handlowa – rabat 5% na fakturze)',
    priceListRule: 'WAŻNE: Na fakturze VAT (FV) zawsze musi być CENA PO RABACIE NETTO (kolumna „Cena po rabacie 5% netto na FV”)!',
    invoiceSystem: 'ZEWNETRZNY_SYSTEM',
    invoiceSystemLabel: 'FV w-Firma + specyfikacja (wysyłka na zakupy.sprzedaz@modumpharma.pl)',
    paymentDays: 60,
    ksefLogisticsFormat: 'FV w-Firma + osobna specyfikacja towarowa',
    invoiceRequirements:
      '• 💰 CENNIK Q3: Na fakturze (FV) obowiązuje CENA PO RABACIE NETTO (rabat 5% netto z cennika Q3)!\n' +
      '• Termin płatności: 60 dni.\n' +
      '• Wystawianie: FV w-Firma + specyfikacja.\n' +
      '• Fakturę (FV) wraz ze specyfikacją wysłać na adres: zakupy.sprzedaz@modumpharma.pl.',
    minExpiryRequirement: 'PRODUKTY MINIMUM 13 MIESIĘCY WAŻNOŚCI!',
    shortExpiryPolicy:
      'Uwaga: Modum Pharma wymaga minimum 13 miesięcy daty ważności (dłużej niż standardowe 12 miesięcy!). Krótsza data wyłącznie po wcześniejszej zgodzie.',
    avisoMethod:
      'Proponowany termin awizacji wysłać mailowo na: dzialhandlowy@modumpharma.pl oraz logistyka@modumpharma.pl',
    avisoDetails:
      '• Przed wysyłką zgłosić proponowany termin awizacji na dwa adresy: dzialhandlowy@modumpharma.pl oraz logistyka@modumpharma.pl.\n' +
      '• Po przygotowaniu dostawy przesłać FV oraz specyfikację na: zakupy.sprzedaz@modumpharma.pl.',
    headquartersAddress: 'Zgodnie z zamówieniem Modum Pharma',
    shippingWarehouseName: 'Magazyn Modum Pharma',
    shippingAddress: 'Zgodnie z adresem dostawy na zamówieniu Modum Pharma',
    shippingRemarks:
      'PAMIĘTAĆ: Produkty dla Modum Pharma muszą mieć MINIMUM 13 MIESIĘCY daty ważności!',
    contacts: [
      {
        id: 'mod-c1',
        role: 'Proponowany termin awizacji',
        name: 'Dział Handlowy Modum Pharma',
        email: 'dzialhandlowy@modumpharma.pl',
        phone: '',
      },
      {
        id: 'mod-c2',
        role: 'Proponowany termin awizacji',
        name: 'Logistyka Modum Pharma',
        email: 'logistyka@modumpharma.pl',
        phone: '',
      },
      {
        id: 'mod-c3',
        role: 'Faktura (FV) oraz specyfikacja',
        name: 'Zakupy i Sprzedaż Modum Pharma',
        email: 'zakupy.sprzedaz@modumpharma.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'mod-n1',
        createdAt: '2026-10-03 15:45',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA MODUM PHARMA:\n• Obowiązuje Cennik Q3 — na FV musi być CENA PO RABACIE NETTO (rabat 5%)!\n• Termin płatności: 60 dni, FV w-Firma + specyfikacja\n• Produkty MINIMUM 13 MIESIĘCY ważności!\n• Proponowany termin awizacji -> dzialhandlowy@modumpharma.pl , logistyka@modumpharma.pl\n• FV i specyfikacja -> zakupy.sprzedaz@modumpharma.pl',
      },
    ],
    updatedAt: '2026-10-03T15:50:00.000Z',
  },
];
