import { EntityDetails, InvoiceItem, InvoiceMeta } from '../types/ksef';

export type EdiMessageType = 'ORDERS' | 'ORDRSP' | 'DESADV' | 'INVOIC';
export type EdiSyntaxFormat = 'XML_EDI' | 'EDIFACT_D96A';

export interface DozEdiOrderSample {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate: string;
  receivedAt: string;
  buyerGln: string;
  deliveryPointGln: string;
  deliveryAddress: string;
  supplierGln: string;
  buyerName: string;
  buyerNip: string;
  status: 'NOWE_EDI' | 'POTWIERDZONE_ORDRSP' | 'AWIZOWANE_DESADV' | 'ZAFKTUROWANE_INVOIC';
  items: InvoiceItem[];
  notes?: string;
}

export const DOZ_EDI_CONSTANTS = {
  SUPPLIER_NAME: 'Eubiosis Sp. z o.o.',
  SUPPLIER_NIP: '9571106742',
  SUPPLIER_GLN: '5904277710002', // GLN Dostawcy Eubiosis (wzorzec GS1 Polska)
  BUYER_NAME: 'DOZ S.A. - DOZ Direct',
  BUYER_NIP: '8271807718',
  BUYER_GLN: '5907693954328', // GLN Nabywcy / Płatnika DOZ Direct
  DELIVERY_WAREHOUSE_NAME: 'Magazyn Centralny DOZ Direct Łódź',
  DELIVERY_ADDRESS: 'ul. Kinga C. Gillette 1, 9 i 11, 94-406 Łódź',
  DELIVERY_GLN: '5907693900981', // GLN Miejsca Dostawy (Magazyn Łódź)
  PAYMENT_DAYS: 60,
};

export const SAMPLE_DOZ_EDI_ORDERS: DozEdiOrderSample[] = [
  {
    id: 'edi-doz-1',
    orderNumber: '22485/2026/KPD',
    orderDate: '2026-10-03',
    expectedDeliveryDate: '2026-10-06',
    receivedAt: 'Dzisiaj, 08:42 (Bramka EDI DOZ Direct)',
    buyerGln: DOZ_EDI_CONSTANTS.BUYER_GLN,
    deliveryPointGln: DOZ_EDI_CONSTANTS.DELIVERY_GLN,
    deliveryAddress: DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS,
    supplierGln: DOZ_EDI_CONSTANTS.SUPPLIER_GLN,
    buyerName: DOZ_EDI_CONSTANTS.BUYER_NAME,
    buyerNip: DOZ_EDI_CONSTANTS.BUYER_NIP,
    status: 'NOWE_EDI',
    notes: 'Zamówienie magazynowe DOZ Direct Łódź · Cennik Kolumna O (-12% netto) · Termin 60 dni',
    items: [
      {
        id: 'edi-item-1',
        name: 'OMNI-BIOTIC Stress Repair 28 sasz.',
        gtin: '9120004440284',
        bloz7: '3428402',
        quantity: 60,
        unit: 'OP.',
        netPrice: 121.37,
        vatRate: '8%',
        batchNumber: '25E2140',
        expiryDate: '2028-05-31',
        quantityInBatch: 60,
      },
      {
        id: 'edi-item-2',
        name: 'OMNI-BIOTIC 6 60 g (proszek)',
        gtin: '9120004440017',
        bloz7: '3275101',
        quantity: 45,
        unit: 'OP.',
        netPrice: 82.06,
        vatRate: '8%',
        batchNumber: '25E1892',
        expiryDate: '2028-04-30',
        quantityInBatch: 45,
      },
      {
        id: 'edi-item-3',
        name: 'OMNI-BIOTIC AAD 10 10 sasz.',
        gtin: '9120004440062',
        bloz7: '3275301',
        quantity: 80,
        unit: 'OP.',
        netPrice: 54.45,
        vatRate: '8%',
        batchNumber: '25E3011',
        expiryDate: '2028-08-31',
        quantityInBatch: 80,
      },
      {
        id: 'edi-item-4',
        name: 'OMNI-BIOTIC Panda 30 sasz.',
        gtin: '9120004440048',
        bloz7: '3275201',
        quantity: 35,
        unit: 'OP.',
        netPrice: 135.42,
        vatRate: '8%',
        batchNumber: '25E2705',
        expiryDate: '2028-06-30',
        quantityInBatch: 35,
      },
      {
        id: 'edi-item-5',
        name: 'OMNI-BIOTIC HETOX 30 sasz.',
        gtin: '9120004440079',
        bloz7: '3428301',
        quantity: 25,
        unit: 'OP.',
        netPrice: 162.40,
        vatRate: '8%',
        batchNumber: '25E1990',
        expiryDate: '2028-03-31',
        quantityInBatch: 25,
      },
    ],
  },
  {
    id: 'edi-doz-2',
    orderNumber: '22510/2026/KPD',
    orderDate: '2026-10-03',
    expectedDeliveryDate: '2026-10-07',
    receivedAt: 'Dzisiaj, 11:15 (Bramka EDI DOZ Direct)',
    buyerGln: DOZ_EDI_CONSTANTS.BUYER_GLN,
    deliveryPointGln: DOZ_EDI_CONSTANTS.DELIVERY_GLN,
    deliveryAddress: DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS,
    supplierGln: DOZ_EDI_CONSTANTS.SUPPLIER_GLN,
    buyerName: DOZ_EDI_CONSTANTS.BUYER_NAME,
    buyerNip: DOZ_EDI_CONSTANTS.BUYER_NIP,
    status: 'NOWE_EDI',
    notes: 'Domówienie ekspresowe DOZ Direct Łódź · Cennik Kolumna O (-12% netto)',
    items: [
      {
        id: 'edi-item-201',
        name: 'OMNI-BIOTIC 10 AAD 20 sasz.',
        gtin: '9120004440055',
        bloz7: '3275302',
        quantity: 50,
        unit: 'OP.',
        netPrice: 97.62,
        vatRate: '8%',
        batchNumber: '25E3120',
        expiryDate: '2028-07-31',
        quantityInBatch: 50,
      },
      {
        id: 'edi-item-202',
        name: 'OMNI-BIOTIC Migraene 30 sasz.',
        gtin: '9120004440192',
        bloz7: '3428501',
        quantity: 30,
        unit: 'OP.',
        netPrice: 121.37,
        vatRate: '8%',
        batchNumber: '25E2401',
        expiryDate: '2028-05-31',
        quantityInBatch: 30,
      },
      {
        id: 'edi-item-203',
        name: 'OMNI-LOGIC Immunkraft (Odporność) 135 g',
        gtin: '9120117910216',
        bloz7: '3512901',
        quantity: 40,
        unit: 'OP.',
        netPrice: 82.06,
        vatRate: '8%',
        batchNumber: '25E2908',
        expiryDate: '2028-09-30',
        quantityInBatch: 40,
      },
    ],
  },
];

export interface EdiOrdrspItemLine {
  item: InvoiceItem;
  confirmedQuantity: number;
  lineStatus: 'ACCEPTED' | 'CHANGED_QTY' | 'REJECTED';
}

export interface EdiDesadvConfig {
  desadvNumber: string;
  dispatchDate: string;
  expectedDeliveryDate: string;
  carrierName: string;
  waybillNumber: string;
  palletsCount: number;
  cartonsCount: number;
  ssccCode: string;
}

const escapeXml = (str: string): string =>
  (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * 1. Generator komunikatu EDI ORDERS (Zamówienie od DOZ Direct)
 */
export function generateEdiOrdersMessage(
  order: DozEdiOrderSample,
  syntax: EdiSyntaxFormat
): string {
  const totalNet = order.items.reduce((acc, it) => acc + it.quantity * it.netPrice, 0);

  if (syntax === 'EDIFACT_D96A') {
    const dtCompact = order.orderDate.replace(/-/g, '');
    const delivCompact = order.expectedDeliveryDate.replace(/-/g, '');
    const lines = [
      `UNA:+.? '`,
      `UNB+UNOC:3+${order.buyerGln}:14+${order.supplierGln}:14+${dtCompact.slice(2)}:0842+ORD${order.orderNumber.replace(/\D/g, '')}'`,
      `UNH+1+ORDERS:D:96A:UN:EAN008'`,
      `BGM+220+${order.orderNumber}+9'`,
      `DTM+137:${dtCompact}:102'`,
      `DTM+2:${delivCompact}:102'`,
      `NAD+BY+${order.buyerGln}::9++${order.buyerName}+Kinga C. Gillette 1, 9 i 11+Lodz++94-406+PL'`,
      `RFF+VA:PL${order.buyerNip}'`,
      `NAD+DP+${order.deliveryPointGln}::9++${DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME}+Kinga C. Gillette 1, 9 i 11+Lodz++94-406+PL'`,
      `NAD+SU+${order.supplierGln}::9++${DOZ_EDI_CONSTANTS.SUPPLIER_NAME}+Piecewska 31/18+Gdansk++80-288+PL'`,
      `RFF+VA:PL${DOZ_EDI_CONSTANTS.SUPPLIER_NIP}'`,
      `CUX+2:PLN:9'`,
      ...order.items.flatMap((it, idx) => [
        `LIN+${idx + 1}++${it.gtin}:EN'`,
        `PIA+1+${it.bloz7 || '0000000'}:SA'`,
        `IMD+F++:::${it.name}'`,
        `QTY+21:${it.quantity}:PCE'`,
        `PRI+AAA:${it.netPrice.toFixed(2)}:CT:NTP'`,
      ]),
      `UNS+S'`,
      `MOA+79:${totalNet.toFixed(2)}'`,
      `CNT+2:${order.items.length}'`,
      `UNT+${15 + order.items.length * 5}+1'`,
      `UNZ+1+ORD${order.orderNumber.replace(/\D/g, '')}'`,
    ];
    return lines.join('\n');
  }

  // XML_EDI (Comarch EDI / Infinite ECOD / GS1 Polska)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document-Order xmlns="http://www.gs1.pl/ecod/orders">
  <Order-Header>
    <OrderNumber>${escapeXml(order.orderNumber)}</OrderNumber>
    <OrderDate>${order.orderDate}</OrderDate>
    <ExpectedDeliveryDate>${order.expectedDeliveryDate}</ExpectedDeliveryDate>
    <DocumentFunctionCode>O</DocumentFunctionCode>
    <OrderCurrency>PLN</OrderCurrency>
    <PaymentTermsDays>${DOZ_EDI_CONSTANTS.PAYMENT_DAYS}</PaymentTermsDays>
  </Order-Header>
  <Order-Parties>
    <Buyer>
      <ILN>${order.buyerGln}</ILN>
      <TaxID>${order.buyerNip}</TaxID>
      <Name>${escapeXml(order.buyerName)}</Name>
      <StreetAndNumber>ul. Kinga C. Gillette 1, 9 i 11</StreetAndNumber>
      <CityName>Łódź</CityName>
      <PostalCode>94-406</PostalCode>
      <Country>PL</Country>
    </Buyer>
    <DeliveryPoint>
      <ILN>${order.deliveryPointGln}</ILN>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME)}</Name>
      <StreetAndNumber>${escapeXml(order.deliveryAddress)}</StreetAndNumber>
      <CityName>Łódź</CityName>
      <PostalCode>94-406</PostalCode>
      <Country>PL</Country>
    </DeliveryPoint>
    <Seller>
      <ILN>${order.supplierGln}</ILN>
      <TaxID>${DOZ_EDI_CONSTANTS.SUPPLIER_NIP}</TaxID>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.SUPPLIER_NAME)}</Name>
    </Seller>
  </Order-Parties>
  <Order-Lines>
${order.items
  .map(
    (it, idx) => `    <Line>
      <Line-Item>
        <LineNumber>${idx + 1}</LineNumber>
        <EAN>${escapeXml(it.gtin)}</EAN>
        <BuyerItemCode>${escapeXml(it.bloz7 || '')}</BuyerItemCode>
        <ItemDescription>${escapeXml(it.name)}</ItemDescription>
        <OrderedQuantity>${it.quantity}</OrderedQuantity>
        <UnitOfMeasure>PCE</UnitOfMeasure>
        <OrderedUnitNetPrice>${it.netPrice.toFixed(2)}</OrderedUnitNetPrice>
        <TaxRate>${parseInt(it.vatRate, 10) || 8}</TaxRate>
      </Line-Item>
    </Line>`
  )
  .join('\n')}
  </Order-Lines>
  <Order-Summary>
    <TotalLines>${order.items.length}</TotalLines>
    <TotalNetAmount>${totalNet.toFixed(2)}</TotalNetAmount>
  </Order-Summary>
</Document-Order>`;
}

/**
 * 2. Generator komunikatu EDI ORDRSP (Potwierdzenie zamówienia do DOZ Direct)
 */
export function generateEdiOrdrspMessage(
  orderNumber: string,
  orderDate: string,
  deliveryDate: string,
  lines: EdiOrdrspItemLine[],
  syntax: EdiSyntaxFormat
): string {
  const today = new Date().toISOString().slice(0, 10);
  const hasChanges = lines.some((l) => l.confirmedQuantity !== l.item.quantity);
  // BGM 231: 29 = Accepted without amendment, 4 = Accepted with amendment
  const responseCode = hasChanges ? '4' : '29';
  const totalNet = lines.reduce((acc, l) => acc + l.confirmedQuantity * l.item.netPrice, 0);

  if (syntax === 'EDIFACT_D96A') {
    const dtCompact = today.replace(/-/g, '');
    const ordCompact = (orderDate || today).replace(/-/g, '');
    const delivCompact = (deliveryDate || today).replace(/-/g, '');
    const edifactLines = [
      `UNA:+.? '`,
      `UNB+UNOC:3+${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}:14+${DOZ_EDI_CONSTANTS.BUYER_GLN}:14+${dtCompact.slice(2)}:0915+RSP${orderNumber.replace(/\D/g, '')}'`,
      `UNH+1+ORDRSP:D:96A:UN:EAN005'`,
      `BGM+231+RSP/${orderNumber}+${responseCode}'`,
      `DTM+137:${dtCompact}:102'`,
      `DTM+69:${delivCompact}:102'`,
      `RFF+ON:${orderNumber}'`,
      `DTM+171:${ordCompact}:102'`,
      `NAD+SU+${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}::9++${DOZ_EDI_CONSTANTS.SUPPLIER_NAME}'`,
      `NAD+BY+${DOZ_EDI_CONSTANTS.BUYER_GLN}::9++${DOZ_EDI_CONSTANTS.BUYER_NAME}'`,
      `NAD+DP+${DOZ_EDI_CONSTANTS.DELIVERY_GLN}::9++${DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME}'`,
      ...lines.flatMap((l, idx) => {
        // 5 = Accepted without amendment, 3 = Changed, 7 = Not accepted
        const lineAction =
          l.confirmedQuantity === 0
            ? '7'
            : l.confirmedQuantity !== l.item.quantity
            ? '3'
            : '5';
        return [
          `LIN+${idx + 1}+${lineAction}+${l.item.gtin}:EN'`,
          `IMD+F++:::${l.item.name}'`,
          `QTY+21:${l.item.quantity}:PCE'`,
          `QTY+113:${l.confirmedQuantity}:PCE'`,
          `PRI+AAA:${l.item.netPrice.toFixed(2)}:CT:NTP'`,
        ];
      }),
      `UNS+S'`,
      `MOA+79:${totalNet.toFixed(2)}'`,
      `CNT+2:${lines.length}'`,
      `UNT+${14 + lines.length * 5}+1'`,
      `UNZ+1+RSP${orderNumber.replace(/\D/g, '')}'`,
    ];
    return edifactLines.join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document-OrderResponse xmlns="http://www.gs1.pl/ecod/ordrsp">
  <OrderResponse-Header>
    <OrderResponseNumber>RSP/${escapeXml(orderNumber)}</OrderResponseNumber>
    <OrderResponseDate>${today}</OrderResponseDate>
    <ResponseTypeCode>${responseCode === '29' ? 'AC' : 'CA'}</ResponseTypeCode>
    <ResponseDescription>${
      responseCode === '29'
        ? '29 - Zaakceptowano w całości bez zmian (Cennik DOZ Kolumna O -12%)'
        : '4 - Zaakceptowano ze zmianą ilości (częściowa realizacja)'
    }</ResponseDescription>
    <BuyerOrderNumber>${escapeXml(orderNumber)}</BuyerOrderNumber>
    <BuyerOrderDate>${orderDate || today}</BuyerOrderDate>
    <ConfirmedDeliveryDate>${deliveryDate || today}</ConfirmedDeliveryDate>
    <Currency>PLN</Currency>
  </OrderResponse-Header>
  <OrderResponse-Parties>
    <Buyer>
      <ILN>${DOZ_EDI_CONSTANTS.BUYER_GLN}</ILN>
      <TaxID>${DOZ_EDI_CONSTANTS.BUYER_NIP}</TaxID>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.BUYER_NAME)}</Name>
    </Buyer>
    <DeliveryPoint>
      <ILN>${DOZ_EDI_CONSTANTS.DELIVERY_GLN}</ILN>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME)}</Name>
      <StreetAndNumber>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS)}</StreetAndNumber>
    </DeliveryPoint>
    <Seller>
      <ILN>${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}</ILN>
      <TaxID>${DOZ_EDI_CONSTANTS.SUPPLIER_NIP}</TaxID>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.SUPPLIER_NAME)}</Name>
    </Seller>
  </OrderResponse-Parties>
  <OrderResponse-Lines>
${lines
  .map(
    (l, idx) => `    <Line>
      <Line-Item>
        <LineNumber>${idx + 1}</LineNumber>
        <EAN>${escapeXml(l.item.gtin)}</EAN>
        <ItemDescription>${escapeXml(l.item.name)}</ItemDescription>
        <LineStatus>${
          l.confirmedQuantity === 0
            ? 'REJECTED'
            : l.confirmedQuantity !== l.item.quantity
            ? 'ACCEPTED_WITH_CHANGE'
            : 'ACCEPTED'
        }</LineStatus>
        <OrderedQuantity>${l.item.quantity}</OrderedQuantity>
        <ConfirmedQuantity>${l.confirmedQuantity}</ConfirmedQuantity>
        <UnitOfMeasure>PCE</UnitOfMeasure>
        <ConfirmedUnitNetPrice>${l.item.netPrice.toFixed(2)}</ConfirmedUnitNetPrice>
        <TaxRate>${parseInt(l.item.vatRate, 10) || 8}</TaxRate>
      </Line-Item>
    </Line>`
  )
  .join('\n')}
  </OrderResponse-Lines>
  <OrderResponse-Summary>
    <TotalLines>${lines.length}</TotalLines>
    <TotalConfirmedNetAmount>${totalNet.toFixed(2)}</TotalConfirmedNetAmount>
  </OrderResponse-Summary>
</Document-OrderResponse>`;
}

/**
 * 3. Generator komunikatu EDI DESADV (Awizacja wysyłki / e-WZ z seriami LOT i datami MHD)
 */
export function generateEdiDesadvMessage(
  orderNumber: string,
  orderDate: string,
  items: InvoiceItem[],
  config: EdiDesadvConfig,
  syntax: EdiSyntaxFormat
): string {
  if (syntax === 'EDIFACT_D96A') {
    const dtCompact = config.dispatchDate.replace(/-/g, '');
    const delivCompact = config.expectedDeliveryDate.replace(/-/g, '');
    const edifactLines = [
      `UNA:+.? '`,
      `UNB+UNOC:3+${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}:14+${DOZ_EDI_CONSTANTS.BUYER_GLN}:14+${dtCompact.slice(2)}:1230+DES${config.desadvNumber.replace(/\D/g, '')}'`,
      `UNH+1+DESADV:D:96A:UN:EAN005'`,
      `BGM+351+${config.desadvNumber}+9'`,
      `DTM+137:${dtCompact}:102'`,
      `DTM+11:${dtCompact}:102'`,
      `DTM+17:${delivCompact}:102'`,
      `RFF+ON:${orderNumber}'`,
      `RFF+AAS:${config.waybillNumber}'`,
      `NAD+SU+${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}::9++${DOZ_EDI_CONSTANTS.SUPPLIER_NAME}'`,
      `NAD+BY+${DOZ_EDI_CONSTANTS.BUYER_GLN}::9++${DOZ_EDI_CONSTANTS.BUYER_NAME}'`,
      `NAD+DP+${DOZ_EDI_CONSTANTS.DELIVERY_GLN}::9++${DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME}+${DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS}'`,
      `CPS+1'`,
      `PAC+${config.palletsCount}++201'`,
      `PCI+33E'`,
      `GIN+BJ+${config.ssccCode}'`,
      ...items.flatMap((it, idx) => {
        const expCompact = (it.expiryDate || '2028-06-30').replace(/-/g, '');
        const lot = it.batchNumber || '25E2140';
        return [
          `LIN+${idx + 1}++${it.gtin}:EN'`,
          `IMD+F++:::${it.name}'`,
          `QTY+12:${it.quantity}:PCE'`,
          `PCI+17'`,
          `DTM+36:${expCompact}:102'`,
          `GIN+BX+${lot}'`,
        ];
      }),
      `CNT+2:${items.length}'`,
      `UNT+${18 + items.length * 6}+1'`,
      `UNZ+1+DES${config.desadvNumber.replace(/\D/g, '')}'`,
    ];
    return edifactLines.join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document-DespatchAdvice xmlns="http://www.gs1.pl/ecod/desadv">
  <DespatchAdvice-Header>
    <DespatchAdviceNumber>${escapeXml(config.desadvNumber)}</DespatchAdviceNumber>
    <DespatchDate>${config.dispatchDate}</DespatchDate>
    <EstimatedDeliveryDate>${config.expectedDeliveryDate}</EstimatedDeliveryDate>
    <BuyerOrderNumber>${escapeXml(orderNumber)}</BuyerOrderNumber>
    <BuyerOrderDate>${orderDate}</BuyerOrderDate>
    <CarrierName>${escapeXml(config.carrierName)}</CarrierName>
    <WaybillNumber>${escapeXml(config.waybillNumber)}</WaybillNumber>
  </DespatchAdvice-Header>
  <DespatchAdvice-Parties>
    <Buyer>
      <ILN>${DOZ_EDI_CONSTANTS.BUYER_GLN}</ILN>
      <TaxID>${DOZ_EDI_CONSTANTS.BUYER_NIP}</TaxID>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.BUYER_NAME)}</Name>
    </Buyer>
    <DeliveryPoint>
      <ILN>${DOZ_EDI_CONSTANTS.DELIVERY_GLN}</ILN>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME)}</Name>
      <StreetAndNumber>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS)}</StreetAndNumber>
      <CityName>Łódź</CityName>
      <PostalCode>94-406</PostalCode>
      <Country>PL</Country>
    </DeliveryPoint>
    <Seller>
      <ILN>${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}</ILN>
      <TaxID>${DOZ_EDI_CONSTANTS.SUPPLIER_NIP}</TaxID>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.SUPPLIER_NAME)}</Name>
    </Seller>
  </DespatchAdvice-Parties>
  <DespatchAdvice-Consignment>
    <TotalPallets>${config.palletsCount}</TotalPallets>
    <TotalCartons>${config.cartonsCount}</TotalCartons>
    <SSCC>${escapeXml(config.ssccCode)}</SSCC>
    <DespatchAdvice-Lines>
${items
  .map(
    (it, idx) => `      <Line>
        <Line-Item>
          <LineNumber>${idx + 1}</LineNumber>
          <EAN>${escapeXml(it.gtin)}</EAN>
          <BuyerItemCode>${escapeXml(it.bloz7 || '')}</BuyerItemCode>
          <ItemDescription>${escapeXml(it.name)}</ItemDescription>
          <QuantityDespatched>${it.quantity}</QuantityDespatched>
          <UnitOfMeasure>PCE</UnitOfMeasure>
          <BatchNumber>${escapeXml(it.batchNumber || '25E2140')}</BatchNumber>
          <ExpiryDate>${escapeXml(it.expiryDate || '2028-06-30')}</ExpiryDate>
        </Line-Item>
      </Line>`
  )
  .join('\n')}
    </DespatchAdvice-Lines>
  </DespatchAdvice-Consignment>
</Document-DespatchAdvice>`;
}

/**
 * 4. Generator komunikatu EDI INVOIC (Faktura elektroniczna EDI skorelowana z KSeF FA(3))
 */
export function generateEdiInvoicMessage(
  seller: EntityDetails,
  buyer: EntityDetails,
  meta: InvoiceMeta,
  items: InvoiceItem[],
  desadvNumber: string,
  ksefReferenceNumber: string,
  syntax: EdiSyntaxFormat
): string {
  const invNumber = meta.invoiceNumber || 'FV/2026/10/01';
  const issueDate = meta.issueDate || new Date().toISOString().slice(0, 10);
  const saleDate = meta.deliveryDate || issueDate;
  const dueDate = meta.dueDate || issueDate;
  const orderNumber = meta.orderNumber || '22485/2026/KPD';

  const totalNet = items.reduce((acc, it) => acc + it.quantity * it.netPrice, 0);
  const totalVat = items.reduce((acc, it) => {
    const rate = parseFloat(it.vatRate) || 8;
    return acc + (it.quantity * it.netPrice * rate) / 100;
  }, 0);
  const totalGross = totalNet + totalVat;

  if (syntax === 'EDIFACT_D96A') {
    const dtCompact = issueDate.replace(/-/g, '');
    const saleCompact = saleDate.replace(/-/g, '');
    const dueCompact = dueDate.replace(/-/g, '');
    const edifactLines = [
      `UNA:+.? '`,
      `UNB+UNOC:3+${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}:14+${DOZ_EDI_CONSTANTS.BUYER_GLN}:14+${dtCompact.slice(2)}:1410+INV${invNumber.replace(/\D/g, '')}'`,
      `UNH+1+INVOIC:D:96A:UN:EAN008'`,
      `BGM+380+${invNumber}+9'`,
      `DTM+137:${dtCompact}:102'`,
      `DTM+35:${saleCompact}:102'`,
      `RFF+ON:${orderNumber}'`,
      `RFF+DQ:${desadvNumber}'`,
      `RFF+KSEF:${ksefReferenceNumber}'`,
      `NAD+SU+${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}::9++${seller.name}+${seller.street}+${seller.city}++${seller.postalCode}+PL'`,
      `RFF+VA:PL${seller.nip}'`,
      `NAD+BY+${DOZ_EDI_CONSTANTS.BUYER_GLN}::9++${buyer.name || DOZ_EDI_CONSTANTS.BUYER_NAME}+${buyer.street || 'ul. Kinga C. Gillette 1, 9 i 11'}+${buyer.city || 'Łódź'}++${buyer.postalCode || '94-406'}+PL'`,
      `RFF+VA:PL${buyer.nip || DOZ_EDI_CONSTANTS.BUYER_NIP}'`,
      `NAD+DP+${DOZ_EDI_CONSTANTS.DELIVERY_GLN}::9++${DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME}+${DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS}'`,
      `CUX+2:PLN:4'`,
      `PAT+1++5::D:${DOZ_EDI_CONSTANTS.PAYMENT_DAYS}'`,
      `DTM+13:${dueCompact}:102'`,
      ...items.flatMap((it, idx) => {
        const lineNet = it.quantity * it.netPrice;
        const rate = parseInt(it.vatRate, 10) || 8;
        const expCompact = (it.expiryDate || '2028-06-30').replace(/-/g, '');
        return [
          `LIN+${idx + 1}++${it.gtin}:EN'`,
          `IMD+F++:::${it.name}'`,
          `QTY+47:${it.quantity}:PCE'`,
          `MOA+203:${lineNet.toFixed(2)}'`,
          `PRI+AAA:${it.netPrice.toFixed(2)}:CT:NTP'`,
          `TAX+7+VAT+++:::${rate}+S'`,
          `PCI+17+${it.batchNumber || '25E2140'}'`,
          `DTM+36:${expCompact}:102'`,
        ];
      }),
      `UNS+S'`,
      `MOA+79:${totalNet.toFixed(2)}'`,
      `MOA+124:${totalVat.toFixed(2)}'`,
      `MOA+86:${totalGross.toFixed(2)}'`,
      `TAX+7+VAT+++:::8+S'`,
      `MOA+125:${totalNet.toFixed(2)}'`,
      `UNT+${24 + items.length * 8}+1'`,
      `UNZ+1+INV${invNumber.replace(/\D/g, '')}'`,
    ];
    return edifactLines.join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document-Invoice xmlns="http://www.gs1.pl/ecod/invoic">
  <Invoice-Header>
    <InvoiceNumber>${escapeXml(invNumber)}</InvoiceNumber>
    <InvoiceDate>${issueDate}</InvoiceDate>
    <SalesDate>${saleDate}</SalesDate>
    <InvoicePaymentDueDate>${dueDate}</InvoicePaymentDueDate>
    <InvoicePaymentTerms>${DOZ_EDI_CONSTANTS.PAYMENT_DAYS}</InvoicePaymentTerms>
    <DocumentFunctionCode>O</DocumentFunctionCode>
    <InvoiceCurrency>PLN</InvoiceCurrency>
    <KSeFReferenceNumber>${escapeXml(ksefReferenceNumber)}</KSeFReferenceNumber>
    <Order>
      <BuyerOrderNumber>${escapeXml(orderNumber)}</BuyerOrderNumber>
      <BuyerOrderDate>${meta.orderDate || issueDate}</BuyerOrderDate>
    </Order>
    <DespatchAdvice>
      <DespatchAdviceNumber>${escapeXml(desadvNumber)}</DespatchAdviceNumber>
    </DespatchAdvice>
  </Invoice-Header>
  <Invoice-Parties>
    <Buyer>
      <ILN>${DOZ_EDI_CONSTANTS.BUYER_GLN}</ILN>
      <TaxID>${escapeXml(buyer.nip || DOZ_EDI_CONSTANTS.BUYER_NIP)}</TaxID>
      <Name>${escapeXml(buyer.name || DOZ_EDI_CONSTANTS.BUYER_NAME)}</Name>
      <StreetAndNumber>${escapeXml(buyer.street || 'ul. Kinga C. Gillette 1, 9 i 11')}</StreetAndNumber>
      <CityName>${escapeXml(buyer.city || 'Łódź')}</CityName>
      <PostalCode>${escapeXml(buyer.postalCode || '94-406')}</PostalCode>
      <Country>PL</Country>
    </Buyer>
    <DeliveryPoint>
      <ILN>${DOZ_EDI_CONSTANTS.DELIVERY_GLN}</ILN>
      <Name>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_WAREHOUSE_NAME)}</Name>
      <StreetAndNumber>${escapeXml(DOZ_EDI_CONSTANTS.DELIVERY_ADDRESS)}</StreetAndNumber>
      <CityName>Łódź</CityName>
      <PostalCode>94-406</PostalCode>
      <Country>PL</Country>
    </DeliveryPoint>
    <Seller>
      <ILN>${DOZ_EDI_CONSTANTS.SUPPLIER_GLN}</ILN>
      <TaxID>${escapeXml(seller.nip)}</TaxID>
      <Name>${escapeXml(seller.name)}</Name>
      <StreetAndNumber>${escapeXml(seller.street)}</StreetAndNumber>
      <CityName>${escapeXml(seller.city)}</CityName>
      <PostalCode>${escapeXml(seller.postalCode)}</PostalCode>
      <Country>PL</Country>
      <AccountNumber>${escapeXml(seller.bankAccount || 'PL61109010140000071219812874')}</AccountNumber>
    </Seller>
  </Invoice-Parties>
  <Invoice-Lines>
${items
  .map((it, idx) => {
    const rate = parseInt(it.vatRate, 10) || 8;
    const netVal = it.quantity * it.netPrice;
    const vatVal = (netVal * rate) / 100;
    const grossVal = netVal + vatVal;
    return `    <Line>
      <Line-Item>
        <LineNumber>${idx + 1}</LineNumber>
        <EAN>${escapeXml(it.gtin)}</EAN>
        <BuyerItemCode>${escapeXml(it.bloz7 || '')}</BuyerItemCode>
        <ItemDescription>${escapeXml(it.name)}</ItemDescription>
        <InvoiceQuantity>${it.quantity}</InvoiceQuantity>
        <UnitOfMeasure>PCE</UnitOfMeasure>
        <InvoiceUnitNetPrice>${it.netPrice.toFixed(2)}</InvoiceUnitNetPrice>
        <TaxRate>${rate}</TaxRate>
        <TaxCategoryCode>S</TaxCategoryCode>
        <TaxAmount>${vatVal.toFixed(2)}</TaxAmount>
        <NetAmount>${netVal.toFixed(2)}</NetAmount>
        <GrossAmount>${grossVal.toFixed(2)}</GrossAmount>
        <BatchNumber>${escapeXml(it.batchNumber || '25E2140')}</BatchNumber>
        <ExpiryDate>${escapeXml(it.expiryDate || '2028-06-30')}</ExpiryDate>
      </Line-Item>
    </Line>`;
  })
  .join('\n')}
  </Invoice-Lines>
  <Invoice-Summary>
    <TotalLines>${items.length}</TotalLines>
    <TotalNetAmount>${totalNet.toFixed(2)}</TotalNetAmount>
    <TotalTaxableBasis>${totalNet.toFixed(2)}</TotalTaxableBasis>
    <TotalTaxAmount>${totalVat.toFixed(2)}</TotalTaxAmount>
    <TotalGrossAmount>${totalGross.toFixed(2)}</TotalGrossAmount>
  </Invoice-Summary>
</Document-Invoice>`;
}

/**
 * Pobranie pliku EDI na dysk (.xml lub .edi)
 */
export function downloadEdiFile(
  content: string,
  messageType: EdiMessageType,
  docNumber: string,
  syntax: EdiSyntaxFormat
) {
  const safeDoc = (docNumber || 'DOZ').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = syntax === 'XML_EDI' ? 'xml' : 'edi';
  const mime = syntax === 'XML_EDI' ? 'application/xml;charset=utf-8' : 'text/plain;charset=utf-8';
  const filename = `EDI_DOZ_${messageType}_${safeDoc}.${ext}`;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
