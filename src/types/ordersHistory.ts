import { EntityDetails, ThirdPartyEntity, InvoiceItem, PharmacyChain } from './ksef';

export type InvoiceDocumentType = 'FV' | 'KOR';

export interface ArchivedOrder {
  id: string;
  chain: PharmacyChain;
  documentType: InvoiceDocumentType;
  invoiceNumber: string;
  orderNumber?: string;
  orderDate?: string;
  issueDate: string;
  avisoDate?: string;
  deliveryDate?: string;
  dueDate?: string;
  seller: EntityDetails;
  buyer: EntityDetails;
  thirdParty?: ThirdPartyEntity | null;
  items: InvoiceItem[];
  itemsCount: number;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  currency: string;
  xmlContent: string;
  isDelivered: boolean;
  deliveredAt?: string | null;
  notes: string;
  originalFileName?: string;
  createdAt: string;
  updatedAt: string;
  // Śledzenie płatności i terminu rozliczenia
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  paymentDueDate?: string | null;
  paidAt?: string | null;
  paymentTermDays?: number;
  // Śledzenie przesyłki kurierskiej i list przewozowy
  trackingNumber?: string | null;
  courierName?: ShippingCourier | string | null;
  shippingStatus?: ShippingStatus | null;
  shippingStatusUpdatedAt?: string | null;
  // Zdjęcia przesyłki / dowód spakowania paczki
  parcelPhotos?: string[];
  // Pola specyficzne dla korekt (gdy documentType === 'KOR')
  correctionReason?: string;
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
}

export type ShippingCourier =
  | 'Globkurier'
  | 'DPD'
  | 'InPost'
  | 'DHL'
  | 'GLS'
  | 'FedEx'
  | 'Pocztex'
  | 'Schenker'
  | 'Inny';
export type ShippingStatus = 'registered' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';

export type OrderChainFilter = 'Wszystkie' | 'DOZ' | 'Dr. Max' | 'Super-Pharm' | 'Gemini' | 'Inne';
export type OrderStatusFilter =
  | 'all'
  | 'registered'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';
export type OrderPaymentFilter = 'all' | 'paid' | 'pending' | 'overdue';
export type OrderDatePeriodFilter =
  | 'all'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'custom';

