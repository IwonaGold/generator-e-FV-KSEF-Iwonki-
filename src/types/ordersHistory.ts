import { EntityDetails, ThirdPartyEntity, InvoiceItem, PharmacyChain } from './ksef';

export type InvoiceDocumentType = 'FV' | 'KOR';

export interface ArchivedOrder {
  id: string;
  chain: PharmacyChain;
  documentType: InvoiceDocumentType;
  invoiceNumber: string;
  orderNumber?: string;
  issueDate: string;
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
  // Pola specyficzne dla korekt (gdy documentType === 'KOR')
  correctionReason?: string;
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
}

export type OrderChainFilter = 'Wszystkie' | 'DOZ' | 'Dr. Max' | 'Super-Pharm' | 'Gemini' | 'Inne';
export type OrderStatusFilter = 'all' | 'delivered' | 'pending';
export type OrderPaymentFilter = 'all' | 'paid' | 'pending' | 'overdue';

