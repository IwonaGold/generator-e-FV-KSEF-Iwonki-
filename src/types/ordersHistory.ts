import { EntityDetails, ThirdPartyEntity, InvoiceItem, PharmacyChain } from './ksef';

export type InvoiceDocumentType = 'FV' | 'KOR' | 'ZAM';

export type OrderInvoiceStatus = 'issued' | 'awaiting_invoice' | 'external_billing';

export type WarehouseTaskStatus = 'none' | 'assigned' | 'in_progress' | 'completed';

export interface OrderPackagingPhoto {
  id: string;
  fileName: string;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  orderId?: string;
  orderNumber?: string;
}

export interface ArchivedOrder {
  id: string;
  chain: PharmacyChain;
  documentType: InvoiceDocumentType;
  invoiceNumber: string;
  invoiceStatus?: OrderInvoiceStatus;
  externalInvoiceNumber?: string;
  sourceOrderId?: string;
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
  preparationStatus?: string | null;
  // Zdjęcia przesyłki / dowód spakowania paczki
  parcelPhotos?: string[];
  // Zdjęcia opakowań (LOT / MHD) przypisane do danego zamówienia
  packagingPhotos?: OrderPackagingPhoto[];
  // Zadania zlecone do Magazynu przez Koordynatora (podzielone na 2 oddzielne etapy):
  // 1. Z karty zamówienia: Uzupełnij zdjęcia produktów (LOT / MHD)
  warehouseProductTaskStatus?: WarehouseTaskStatus;
  warehouseProductTaskAssignedAt?: string | null;
  warehouseProductTaskCompletedAt?: string | null;
  warehouseProductTaskNote?: string | null;
  // 2. Z folderu W REALIZACJI: Uzupełnij zdjęcia gotowej przesyłki (Paczki / Palety)
  warehouseParcelTaskStatus?: WarehouseTaskStatus;
  warehouseParcelTaskAssignedAt?: string | null;
  warehouseParcelTaskCompletedAt?: string | null;
  warehouseParcelTaskNote?: string | null;
  // Pole zbiorcze / kompatybilność wsteczna
  warehouseTaskStatus?: WarehouseTaskStatus;
  warehouseTaskAssignedAt?: string | null;
  warehouseTaskCompletedAt?: string | null;
  warehouseTaskAssignedBy?: string | null;
  warehouseTaskNote?: string | null;
  // Osoby odpowiedzialne na karcie zamówienia (Koordynator / Pakowanie / Weryfikacja)
  coordinatorName?: 'Iwona' | 'Virdzinia' | string | null;
  packedBy?: 'Mateusz' | 'Valerii' | 'Agnieszka' | 'Iwona' | string | null;
  verifiedBy?: 'Mateusz' | 'Valerii' | 'Agnieszka' | 'Iwona' | string | null;
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

