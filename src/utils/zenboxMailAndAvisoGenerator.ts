import * as XLSX from 'xlsx';
import { EntityDetails, InvoiceItem, InvoiceMeta } from '../types/ksef';
import { KeyClientProfile } from '../types/knowledgeBase';

export type BuyerData = EntityDetails;
export type InvoiceMetadata = InvoiceMeta;

/**
 * 11 kolumn oficjalnej Tabeli Awizacyjnej wymaganej przez Poradnik Dostawcy Dr. Max (Załącznik nr 1, rozdz. V)
 * oraz Magazyn Centralny DOZ Direct
 */
export interface AvisoFormFields {
  supplierName: string;
  orderNumber: string;
  invoiceNumber: string;
  cartonsCount: number;
  euroPalletsCount: number;
  totalPiecesCount: number;
  plannedDeliveryDate: string;
  plannedDeliveryTimeWindow: string;
  carrierName: string;
  driverName: string;
  driverPhone: string;
  truckPlates: string;
  unloadingWarehouse: string;
  notes?: string;
}

export interface EmailAttachmentItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeKb: number;
  kind: 'ORDER_PDF' | 'ORDER_XLSX' | 'AVISO_XLSX' | 'INVOICE_XML' | 'WZ_PDF';
  base64Content?: string;
}

export interface ZenboxEmailMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  fromName: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails?: string[];
  subject: string;
  bodyText: string;
  sentAt: string;
  attachments?: EmailAttachmentItem[];
}

export interface ZenboxOrderThread {
  id: string;
  chain: 'DR_MAX' | 'DOZ';
  orderNumber: string;
  buyerName: string;
  warehouseLocation: string;
  receivedAt: string;
  requestedDeliveryDate: string;
  // 4-etapowy cykl życia wątku:
  orderLoadedToGenerator: boolean;
  avisoSent: boolean;
  fvSent: boolean;
  isOrderDelivered: boolean;
  // Wątek przechodzi do Archiwum DOPIERO po wysłaniu FV ORAZ doręczeniu przesyłki:
  isArchived: boolean;
  linkedOrderId?: string;
  avisoData: AvisoFormFields;
  parsedOrderPayload?: {
    orderNumber: string;
    orderDate: string;
    deliveryDate: string;
    buyer: EntityDetails;
    items: InvoiceItem[];
  };
  messages: ZenboxEmailMessage[];
}

export interface ZenboxMailConfig {
  emailAddress: string;
  password?: string;
  hasPassword?: boolean;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  signatureFooter: string;
  autoBccSelf: boolean;
  connected?: boolean;
  lastCheckedAt?: string | null;
}

export interface SuggestedEmailRecipient {
  email: string;
  label: string;
  role: string;
  chain: string;
  category: 'AWIZACJA' | 'FAKTURY' | 'ZAMOWIENIA';
}

export const DEFAULT_EUBIOSIS_EMAIL_FOOTER = `-- 
Z poważaniem / Pozdrawiam serdecznie,
Iwona — Koordynator Obsługi Zamówień Sieciowych
Eubiosis Sp. z o.o.
ul. Warszawska 58C/60, 81-305 Gdynia
NIP: 5833446059 | BDO: 000585744
E-mail: zamowienia@eubiosis.pl`;

/**
 * Zwraca listę sugerowanych adresów korespondencyjnych z Centrum Wiedzy (CRM) + oficjalnych magazynów awizacyjnych
 */
export function getSuggestedRecipientsFromKnowledge(
  chain: 'DR_MAX' | 'DOZ',
  knowledgeClients: KeyClientProfile[],
  threadSenderEmail?: string
): SuggestedEmailRecipient[] {
  const results: SuggestedEmailRecipient[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: SuggestedEmailRecipient) => {
    const key = item.email.trim().toLowerCase();
    if (!key || !key.includes('@') || seen.has(key)) return;
    seen.add(key);
    results.push({ ...item, email: item.email.trim() });
  };

  if (chain === 'DR_MAX') {
    pushUnique({
      email: 'awizacje.wroclaw@drmax.com.pl',
      label: 'Awizacja Dr. Max Wrocław',
      role: 'Magazyn Wrocław (ul. Krzemieniecka 60a) — awizacja min. 24h przed dostawą do 15:00',
      chain: 'Dr. Max',
      category: 'AWIZACJA',
    });
    pushUnique({
      email: 'awizacje.czechowice@drmax.com.pl',
      label: 'Awizacja Dr. Max Czechowice',
      role: 'Magazyn Czechowice-Dziedzice — awizacja dostawy',
      chain: 'Dr. Max',
      category: 'AWIZACJA',
    });
    pushUnique({
      email: 'awizacje.piotrkow@drmax.com.pl',
      label: 'Awizacja Dr. Max Piotrków Tryb.',
      role: 'Magazyn Piotrków Trybunalski — awizacja dostawy',
      chain: 'Dr. Max',
      category: 'AWIZACJA',
    });
  } else {
    pushUnique({
      email: 'Magazyn_awizacje@doz.pl',
      label: 'Awizacja Magazyn DOZ Direct',
      role: 'Magazyn Centralny DOZ Direct Łódź — awizacja do godz. 14:00 dzień przed dostawą',
      chain: 'DOZ Direct',
      category: 'AWIZACJA',
    });
    pushUnique({
      email: 'dostawy_dozdirect@doz.pl',
      label: 'Potwierdzenia DOZ Direct',
      role: 'Dział Dostaw DOZ Direct — potwierdzenia zamówień i korekty',
      chain: 'DOZ Direct',
      category: 'ZAMOWIENIA',
    });
    pushUnique({
      email: 'Faktury_zakupowe@doz.pl',
      label: 'Faktury Zakupowe DOZ',
      role: 'Dział Finansowy DOZ Direct — przesyłanie faktur VAT',
      chain: 'DOZ Direct',
      category: 'FAKTURY',
    });
  }

  if (threadSenderEmail) {
    pushUnique({
      email: threadSenderEmail,
      label: 'Nadawca zamówienia',
      role: 'Bezpośredni nadawca tego zamówienia',
      chain: chain === 'DR_MAX' ? 'Dr. Max' : 'DOZ Direct',
      category: 'ZAMOWIENIA',
    });
  }

  // Dodaj wszystkie adresy e-mail zapisane w Centrum Wiedzy (CRM)
  for (const client of knowledgeClients) {
    const isMatchingChain =
      (chain === 'DR_MAX' &&
        (client.id.includes('drmax') || client.shortName.toLowerCase().includes('max'))) ||
      (chain === 'DOZ' &&
        (client.id.includes('doz') || client.shortName.toLowerCase().includes('doz')));

    if (isMatchingChain || knowledgeClients.length <= 6) {
      for (const contact of client.contacts || []) {
        if (contact.email && contact.email.includes('@')) {
          const roleLow = (contact.role || '').toLowerCase();
          const cat: 'AWIZACJA' | 'FAKTURY' | 'ZAMOWIENIA' =
            roleLow.includes('awiz') || roleLow.includes('magazyn')
              ? 'AWIZACJA'
              : roleLow.includes('faktur') || roleLow.includes('księg')
              ? 'FAKTURY'
              : 'ZAMOWIENIA';
          pushUnique({
            email: contact.email,
            label: `${client.shortName}: ${contact.name || contact.role}`,
            role: `${contact.role} (${client.shortName})`,
            chain: client.shortName,
            category: cat,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Generuje 2-arkuszowy plik Excel (.xlsx) z Tabelą Awizacyjną Dr. Max / DOZ Direct (11 oficjalnych kolumn)
 * oraz specyfikacją pozycji (EAN, LOT, MHD, ilość) i zwraca go w Base64 do załącznika mailowego
 */
export function generateAvisoExcelBase64(
  aviso: AvisoFormFields,
  items: InvoiceItem[],
  chain: 'DR_MAX' | 'DOZ' = 'DR_MAX'
): { base64: string; filename: string; sizeKb: number } {
  const wb = XLSX.utils.book_new();

  // Arkusz 1: 11 oficjalnych kolumn z Poradnika Dostawcy Dr. Max (Załącznik nr 1, rozdz. V)
  const headers11 = [
    'Nazwa Dostawcy',
    'Nr Zamówienia',
    'Nr Faktury VAT',
    'Ilość opakowań zbiorczych (kartonów)',
    'Ilość palet EUR',
    'Ilość sztuk łącznie',
    'Planowana data dostawy',
    'Przedział godzinowy dostawy',
    'Spedytor / Przewoźnik',
    'Kierowca i telefon / Nr auta',
    'Miejsce rozładunku (Magazyn)',
  ];

  const row11 = [
    aviso.supplierName || 'Eubiosis Sp. z o.o.',
    aviso.orderNumber || '',
    aviso.invoiceNumber || '',
    aviso.cartonsCount ?? 0,
    aviso.euroPalletsCount ?? 1,
    aviso.totalPiecesCount || items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    aviso.plannedDeliveryDate || '',
    aviso.plannedDeliveryTimeWindow || '08:00 - 12:00',
    aviso.carrierName || 'DPD Polska / Kurier B2B',
    `${aviso.driverName || 'Kurier'} (${aviso.driverPhone || ''}) / ${aviso.truckPlates || ''}`,
    aviso.unloadingWarehouse || '',
  ];

  const sheet1Data = [
    [
      `FORMULARZ AWIZACJI DOSTAWY — ${
        chain === 'DR_MAX' ? 'DR. MAX SP. Z O.O. (ZAŁĄCZNIK NR 1)' : 'DOZ S.A. DIRECT SP.K.'
      }`,
    ],
    [`Wygenerowano automatycznie z systemu Eubiosis KSeF: ${new Date().toLocaleString('pl-PL')}`],
    [],
    headers11,
    row11,
    [],
    [
      'Uwagi logistyczne:',
      aviso.notes ||
        (chain === 'DR_MAX'
          ? 'Wszystkie produkty posiadają datę ważności powyżej 6 miesięcy zgodnie z wymogiem zamówienia Dr. Max.'
          : 'Wszystkie produkty posiadają datę ważności powyżej 12 miesięcy (min. 75% okresu przydatności).'),
    ],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 18 },
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
    { wch: 30 },
    { wch: 42 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Awizacja Dostawy');

  // Arkusz 2: Specyfikacja pozycji z numerami serii LOT i datami ważności MHD
  const specHeaders = [
    'Lp.',
    'Nazwa produktu',
    'Kod EAN / GTIN',
    'Ilość',
    'Jedn.',
    'Numer serii (LOT)',
    'Data ważności (MHD)',
    'Nr zamówienia',
    'Nr faktury',
  ];

  const specRows = items.map((it, idx) => [
    idx + 1,
    it.name,
    it.gtin || '',
    it.quantity,
    it.unit || 'SZT.',
    it.batchNumber || 'Zgodnie z WZ',
    it.expiryDate || '',
    aviso.orderNumber || '',
    aviso.invoiceNumber || '',
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet([specHeaders, ...specRows]);
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 42 },
    { wch: 18 },
    { wch: 10 },
    { wch: 8 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Pozycje LOT i MHD');

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const safeOrder = (aviso.orderNumber || 'ZAMOWIENIE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = chain === 'DR_MAX' ? 'Awizacja_DrMax' : 'Awizacja_DOZ_Direct';
  const filename = `${prefix}_${safeOrder}.xlsx`;
  const sizeKb = Math.max(12, Math.round((base64.length * 3) / 4 / 1024));

  return { base64, filename, sizeKb };
}

/**
 * Pobiera wygenerowany plik .xlsx z Tabelą Awizacyjną bezpośrednio na komputer użytkowniczki
 */
export function downloadAvisoExcelFile(
  aviso: AvisoFormFields,
  items: InvoiceItem[],
  chain: 'DR_MAX' | 'DOZ' = 'DR_MAX'
): string {
  const { base64, filename } = generateAvisoExcelBase64(aviso, items, chain);
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

/**
 * Buduje sugerowany temat oraz pełną treść maila (wraz z zawsze doklejaną stopką firmową Eubiosis Sp. z o.o.)
 */
export function buildSuggestedEmailContent(params: {
  templateType: 'AVISO_TABLE' | 'ORDER_CONFIRMATION' | 'SEND_INVOICE_FV' | 'CUSTOM_REPLY';
  chain: 'DR_MAX' | 'DOZ';
  aviso: AvisoFormFields;
  items: InvoiceItem[];
  signatureFooter: string;
}): { subject: string; body: string } {
  const { templateType, chain, aviso, items, signatureFooter } = params;
  const footer = (signatureFooter || DEFAULT_EUBIOSIS_EMAIL_FOOTER).trim();

  const itemsText =
    items.length > 0
      ? items
          .map(
            (it, idx) =>
              `  ${idx + 1}. ${it.name} (EAN: ${it.gtin || '—'}) — ${it.quantity} ${
                it.unit || 'SZT.'
              }${it.batchNumber ? ` | Seria LOT: ${it.batchNumber}` : ''}${
                it.expiryDate ? ` | Data ważności: ${it.expiryDate}` : ''
              }`
          )
          .join('\n')
      : `  • Zgodnie ze specyfikacją zamówienia nr ${aviso.orderNumber} (${aviso.totalPiecesCount} szt.)`;

  if (templateType === 'AVISO_TABLE') {
    const subject = `Awizacja dostawy — Zamówienie nr ${aviso.orderNumber} — ${aviso.supplierName} (dostawa: ${aviso.plannedDeliveryDate})`;
    const body = `Dzień dobry,

Przesyłamy awizację dostawy do zamówienia nr ${aviso.orderNumber} z przeznaczeniem do magazynu:
${aviso.unloadingWarehouse}.

W załączeniu przesyłamy automatycznie uzupełniony plik Tabeli Awizacyjnej (.xlsx)${
      chain === 'DR_MAX'
        ? ' zgodny z Załącznikiem nr 1 do Poradnika Dostawcy Dr. Max.'
        : ' zgodny ze standardem Magazynu Centralnego DOZ Direct.'
    }

PODSUMOWANIE AWIZACJI DOSTAWY:
• Dostawca: ${aviso.supplierName}
• Numer zamówienia: ${aviso.orderNumber}
• Numer Faktury VAT: ${aviso.invoiceNumber || 'W przygotowaniu'}
• Planowana data i okno dostawy: ${aviso.plannedDeliveryDate} (${aviso.plannedDeliveryTimeWindow})
• Ilość opakowań zbiorczych: ${aviso.cartonsCount} karton(y) / ${aviso.euroPalletsCount} paleta EUR
• Łączna ilość sztuk: ${aviso.totalPiecesCount} szt.
• Przewoźnik / Spedytor: ${aviso.carrierName}
• Kierowca / Nr auta: ${aviso.driverName} (${aviso.driverPhone}) — ${aviso.truckPlates}

SPECYFIKACJA TOWAROWA (SERIE LOT I DATY WAŻNOŚCI):
${itemsText}

Prosimy o potwierdzenie awizacji oraz okna rozładunkowego.

${footer}`;
    return { subject, body };
  }

  if (templateType === 'SEND_INVOICE_FV') {
    const subject = `Faktura VAT nr ${aviso.invoiceNumber} oraz dokument WZ do zamówienia nr ${aviso.orderNumber} — ${aviso.supplierName}`;
    const body = `Dzień dobry,

W nawiązaniu do zrealizowanego zamówienia nr ${aviso.orderNumber} przesyłamy w załączeniu Fakturę VAT nr ${aviso.invoiceNumber} (wystawioną w systemie KSeF FA(3)) wraz ze specyfikacją WZ.

SZCZEGÓŁY DOSTAWY I FAKTURY:
• Numer Faktury VAT: ${aviso.invoiceNumber}
• Numer zamówienia klienta: ${aviso.orderNumber}
• Miejsce dostawy: ${aviso.unloadingWarehouse}
• Data dostawy: ${aviso.plannedDeliveryDate}
• Łączna ilość sztuk: ${aviso.totalPiecesCount} szt. (${aviso.cartonsCount} kartonów / ${aviso.euroPalletsCount} palet EUR)

ZESTAWIENIE POZYCJI Z NUMERAMI SERII (LOT) I DATAMI WAŻNOŚCI (MHD):
${itemsText}

Oryginał dokumentu WZ został również dołączony fizycznie do przesyłki.

${footer}`;
    return { subject, body };
  }

  if (templateType === 'ORDER_CONFIRMATION') {
    const minMhdInfo =
      chain === 'DR_MAX'
        ? 'powyżej 6 miesięcy (zgodnie z wymogiem zamówienia Dr. Max)'
        : 'minimum 12 miesięcy oraz min. 75% całkowitego okresu przydatności';
    const subject = `Re: Potwierdzenie przyjęcia zamówienia nr ${aviso.orderNumber} — ${aviso.supplierName}`;
    const body = `Dzień dobry,

Dziękujemy za przesłanie zamówienia nr ${aviso.orderNumber}.
Potwierdzamy przyjęcie zamówienia do realizacji w pełnym zakresie (${aviso.totalPiecesCount} szt.):

${itemsText}

• Wszystkie przygotowane partie posiadają termin ważności ${minMhdInfo}.
• Planowany termin dostawy do magazynu (${aviso.unloadingWarehouse}): ${aviso.plannedDeliveryDate}.

W kolejnej wiadomości prześlemy tabelę awizacyjną (.xlsx) oraz Fakturę VAT KSeF.

${footer}`;
    return { subject, body };
  }

  return {
    subject: `Re: Zamówienie nr ${aviso.orderNumber} — ${aviso.supplierName}`,
    body: `Dzień dobry,

W nawiązaniu do zamówienia nr ${aviso.orderNumber}:


${footer}`,
  };
}

/**
 * Preinstalowane realistyczne wątki zamówieniowe z poczty Zenbox (Dr. Max Wrocław + DOZ Direct Łódź)
 */
export const INITIAL_DEMO_ZENBOX_THREADS: ZenboxOrderThread[] = [
  {
    id: 'zenbox-thread-drmax-4812',
    chain: 'DR_MAX',
    orderNumber: 'ZO/2026/10/4812',
    buyerName: 'Dr. Max Sp. z o.o.',
    warehouseLocation: 'Magazyn Dr. Max Wrocław (ul. Krzemieniecka 60a, 54-613 Wrocław)',
    receivedAt: '2026-10-03T08:42:00.000Z',
    requestedDeliveryDate: '2026-10-06',
    orderLoadedToGenerator: false,
    avisoSent: false,
    fvSent: false,
    isOrderDelivered: false,
    isArchived: false,
    avisoData: {
      supplierName: 'Eubiosis Sp. z o.o.',
      orderNumber: 'ZO/2026/10/4812',
      invoiceNumber: '42/2026',
      cartonsCount: 3,
      euroPalletsCount: 1,
      totalPiecesCount: 45,
      plannedDeliveryDate: '2026-10-06',
      plannedDeliveryTimeWindow: '08:00 - 12:00',
      carrierName: 'DPD Polska / Przesyłka Paletowa B2B',
      driverName: 'Kierowca DPD B2B',
      driverPhone: '+48 502 410 890',
      truckPlates: 'DW 8492A / Kurier',
      unloadingWarehouse: 'Magazyn Dr. Max Wrocław (ul. Krzemieniecka 60a, 54-613 Wrocław)',
      notes: 'Wszystkie produkty posiadają datę ważności powyżej 6 miesięcy zgodnie z wymogiem zamówienia.',
    },
    parsedOrderPayload: {
      orderNumber: 'ZO/2026/10/4812',
      orderDate: '2026-10-03',
      deliveryDate: '2026-10-06',
      buyer: {
        name: 'Dr. Max Sp. z o.o.',
        nip: '8943149010',
        addressLine1: 'ul. Krzemieniecka 60a',
        postalCode: '54-613',
        city: 'Wrocław',
        countryCode: 'PL',
        gln: '5904665249994',
      },
      items: [
        {
          id: 'drmax-mail-item-1',
          name: 'OMNi-BiOTiC STRESS Repair 28 sasz. a 3g',
          gtin: '9120117912773',
          quantity: 30,
          unit: 'SZT.',
          netPrice: 121.0,
          vatRate: '8%',
          batchNumber: '25B1940',
          expiryDate: '2027-09-30',
          quantityInBatch: 30,
        },
        {
          id: 'drmax-mail-item-2',
          name: 'OMNi-BiOTiC 6 60 g (proszek w słoiczku)',
          gtin: '9120001430013',
          quantity: 15,
          unit: 'SZT.',
          netPrice: 71.9,
          vatRate: '8%',
          batchNumber: '25C0412',
          expiryDate: '2027-11-30',
          quantityInBatch: 15,
        },
      ],
    },
    messages: [
      {
        id: 'msg-in-drmax-4812',
        direction: 'INBOUND',
        fromName: 'Dział Zakupów Centralnych Dr. Max',
        fromEmail: 'zamowienia.wroclaw@drmax.com.pl',
        toEmails: ['zamowienia@eubiosis.pl'],
        subject: 'Zamówienie Dr. Max nr ZO/2026/10/4812 — Magazyn Wrocław',
        sentAt: '2026-10-03T08:42:00.000Z',
        bodyText: `Dzień dobry,

W załączeniu przesyłamy zamówienie nr ZO/2026/10/4812 z dostawą na Magazyn Dr. Max Wrocław (ul. Krzemieniecka 60a, 54-613 Wrocław).

WAŻNE WYMOGI DOSTAWY:
Prosimy o wysyłkę produktów z datą ważności powyżej 6 miesięcy.
Produkty z datą krótszą będą reklamowane.

Awizację dostawy wraz z wypełnionym plikiem tabeli awizacyjnej (.xlsx) prosimy przesłać na adres: awizacje.wroclaw@drmax.com.pl minimum 24h przed planowaną dostawą do godz. 15:00.

Pozdrawiamy,
Dział Zaopatrzenia Dr. Max Sp. z o.o.`,
        attachments: [
          {
            id: 'att-drmax-order-pdf',
            filename: 'Zamowienie_DrMax_ZO_2026_10_4812.pdf',
            mimeType: 'application/pdf',
            sizeKb: 146,
            kind: 'ORDER_PDF',
          },
        ],
      },
    ],
  },
  {
    id: 'zenbox-thread-doz-112689',
    chain: 'DOZ',
    orderNumber: 'ZD/00112689/26',
    buyerName: 'DOZ S.A. Direct Sp.k.',
    warehouseLocation: 'Magazyn Centralny DOZ Direct (ul. Kinga C. Gillette 11, 94-406 Łódź)',
    receivedAt: '2026-10-03T10:15:00.000Z',
    requestedDeliveryDate: '2026-10-07',
    orderLoadedToGenerator: false,
    avisoSent: false,
    fvSent: false,
    isOrderDelivered: false,
    isArchived: false,
    avisoData: {
      supplierName: 'Eubiosis Sp. z o.o.',
      orderNumber: 'ZD/00112689/26',
      invoiceNumber: '43/2026',
      cartonsCount: 5,
      euroPalletsCount: 1,
      totalPiecesCount: 72,
      plannedDeliveryDate: '2026-10-07',
      plannedDeliveryTimeWindow: '09:00 - 13:00',
      carrierName: 'DHL Freight / DPD Palety',
      driverName: 'Zgłoszenie kurierskie B2B',
      driverPhone: '+48 601 220 330',
      truckPlates: 'EL 5921K',
      unloadingWarehouse: 'Magazyn Centralny DOZ Direct (ul. Kinga C. Gillette 11, 94-406 Łódź)',
      notes: 'Termin ważności produktów powyżej 12 miesięcy (min. 75% całkowitego okresu przydatności).',
    },
    parsedOrderPayload: {
      orderNumber: 'ZD/00112689/26',
      orderDate: '2026-10-03',
      deliveryDate: '2026-10-07',
      buyer: {
        name: 'DOZ S.A. Direct Sp.k.',
        nip: '8271807718',
        addressLine1: 'ul. Kinga C. Gillette 11',
        postalCode: '94-406',
        city: 'Łódź',
        countryCode: 'PL',
        gln: '5907690830005',
      },
      items: [
        {
          id: 'doz-mail-item-1',
          name: 'OMNi-BiOTiC 10 AAD 20 sasz. a 5g',
          gtin: '9120001430136',
          quantity: 48,
          unit: 'SZT.',
          netPrice: 74.9,
          vatRate: '8%',
          batchNumber: '25D310A',
          expiryDate: '2027-12-31',
          quantityInBatch: 48,
        },
        {
          id: 'doz-mail-item-2',
          name: 'OMNi-BiOTiC Panda 30 sasz. a 3g',
          gtin: '9120001430037',
          quantity: 24,
          unit: 'SZT.',
          netPrice: 112.9,
          vatRate: '8%',
          batchNumber: '25E108B',
          expiryDate: '2028-02-29',
          quantityInBatch: 24,
        },
      ],
    },
    messages: [
      {
        id: 'msg-in-doz-112689',
        direction: 'INBOUND',
        fromName: 'Dział Zaopatrzenia DOZ Direct',
        fromEmail: 'dostawy_dozdirect@doz.pl',
        toEmails: ['zamowienia@eubiosis.pl'],
        subject: 'Zamówienie DOZ Direct nr ZD/00112689/26 (Magazyn Łódź)',
        sentAt: '2026-10-03T10:15:00.000Z',
        bodyText: `Szanowni Państwo,

W załączeniu przesyłamy zamówienie nr ZD/00112689/26 z dostawą na Magazyn Centralny DOZ Direct w Łodzi (ul. Kinga C. Gillette 11, 94-406 Łódź).

Przypominamy o obowiązkowej awizacji dostawy do godz. 14:00 dzień przed planowaną dostawą na adres: Magazyn_awizacje@doz.pl oraz przesłaniu faktury na adres: Faktury_zakupowe@doz.pl.

Z poważaniem,
Dział Zakupów DOZ S.A. Direct Sp.k.`,
        attachments: [
          {
            id: 'att-doz-order-pdf',
            filename: 'Zamowienie_DOZ_ZD_00112689_26.pdf',
            mimeType: 'application/pdf',
            sizeKb: 184,
            kind: 'ORDER_PDF',
          },
        ],
      },
    ],
  },
];
