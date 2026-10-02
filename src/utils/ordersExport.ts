import { ArchivedOrder } from '../types/ordersHistory';
import { extractInvoiceNumberFromXml } from './ksefXmlParser';
import { detectPharmacyChain } from './orderParser';

/**
 * Eksportuje zestawienie zamówień i faktur do pliku CSV zgodnego z polskim MS Excel (UTF-8 z BOM, separator ;)
 * Gotowe do przekazania do biura rachunkowego / księgowości.
 */
export function exportOrdersToCsv(
  orders: ArchivedOrder[],
  fileNamePrefix: string = 'Zestawienie_Faktur_KSeF'
): void {
  if (!orders || orders.length === 0) {
    alert('Brak zamówień do wyeksportowania.');
    return;
  }

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Jeśli zawiera średnik, cudzysłów lub znak nowej linii, obejmij cudzysłowem
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatAmount = (num: number): string => {
    // Polski format z przecinkiem, np. 1234,56
    return num.toFixed(2).replace('.', ',');
  };

  const headers = [
    'Lp.',
    'Numer faktury',
    'Numer zamówienia',
    'Typ dokumentu',
    'Sieć apteczna',
    'Nabywca',
    'NIP Nabywcy',
    'Odbiorca (Apteka / Magazyn)',
    'Data wystawienia',
    'Data złożenia zamówienia',
    'Data awizacji',
    'Termin płatności',
    'Status rozliczenia',
    'Data opłacenia',
    'Nr listu przewozowego',
    'Firma kurierska',
    'Status doręczenia',
    'Data doręczenia',
    'Wartość Netto (PLN)',
    'Kwota VAT (PLN)',
    'Wartość Brutto (PLN)',
    'Liczba pozycji',
    'Uwagi / Notatka',
  ];

  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;

  const rows = orders.map((ord, idx) => {
    const xmlInv = extractInvoiceNumberFromXml(ord.xmlContent);
    const invoiceNum =
      ord.invoiceNumber && ord.invoiceNumber !== 'FAKTURA'
        ? ord.invoiceNumber
        : xmlInv || ord.invoiceNumber || 'Brak numeru';

    const chain = detectPharmacyChain(ord.buyer, ord.thirdParty, ord.chain);
    const docType = ord.documentType === 'KOR' ? 'Korekta (KOR)' : 'Faktura VAT FA(3)';

    totalNet += ord.totalNet || 0;
    totalVat += ord.totalVat || 0;
    totalGross += ord.totalGross || 0;

    let paymentStatusLabel = 'Oczekuje na płatność';
    if (ord.paymentStatus === 'paid') paymentStatusLabel = 'Opłacona';
    else if (ord.paymentStatus === 'overdue') paymentStatusLabel = 'Po terminie (Przeterminowana)';

    const deliveryStatusLabel = ord.isDelivered ? 'Doręczono' : 'W doręczeniu';

    return [
      idx + 1,
      invoiceNum,
      ord.orderNumber || '—',
      docType,
      chain,
      ord.buyer?.name || '',
      ord.buyer?.nip || '',
      ord.thirdParty ? `${ord.thirdParty.name}${ord.thirdParty.city ? ` (${ord.thirdParty.city})` : ''}` : '—',
      ord.issueDate || '',
      ord.orderDate || '—',
      ord.avisoDate || ord.deliveryDate || '—',
      ord.paymentDueDate || ord.dueDate || '',
      paymentStatusLabel,
      ord.paidAt || (ord.paymentStatus === 'paid' ? 'Tak' : '—'),
      ord.trackingNumber || '—',
      ord.courierName || '—',
      deliveryStatusLabel,
      ord.deliveredAt || '—',
      formatAmount(ord.totalNet || 0),
      formatAmount(ord.totalVat || 0),
      formatAmount(ord.totalGross || 0),
      ord.itemsCount || (ord.items ? ord.items.length : 0),
      ord.notes || '',
    ]
      .map(escapeCsv)
      .join(';');
  });

  // Wiersz podsumowania (SUMA)
  const summaryRow = [
    '',
    'SUMA:',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    formatAmount(totalNet),
    formatAmount(totalVat),
    formatAmount(totalGross),
    '',
    `Liczba faktur: ${orders.length}`,
  ]
    .map(escapeCsv)
    .join(';');

  // BOM dla UTF-8 (\uFEFF) gwarantuje poprawne wyświetlanie polskich znaków w Excelu
  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows, summaryRow].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileNamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
