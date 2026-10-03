import { KSeFCorrectionData, CorrectionItem } from '../types/correction';
import { cleanNumeric, escapeXml, cleanProductName, formatAdresL1 } from './ksefGenerator';

/**
 * Generuje oficjalny plik XML faktury korygującej KSeF FA(3)
 * Wzór 13775, wersja 1-0E (Ministerstwo Finansów)
 * <RodzajFaktury>KOR</RodzajFaktury>
 */
export function generateKSeFCorrectionXML(data: KSeFCorrectionData): string {
  const {
    correctionNumber,
    issueDate,
    issuePlace,
    originalInvoiceNumber,
    originalInvoiceDate,
    hasOriginalKsefNumber,
    originalKsefNumber,
    reasonCategory,
    reasonDescription,
    typKorekty = '2',
    seller,
    buyer,
    thirdParty,
    items,
    currency = 'PLN',
    paymentMethod = 'przelew',
    dueDate,
    orderNumber,
    orderDate,
    correctionMode,
  } = data;

  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const isCustomOrClientCode =
    !reasonCategory ||
    reasonCategory.startsWith('Wg kodu') ||
    reasonCategory === 'Inna przyczyna' ||
    (reasonDescription && reasonDescription.toLowerCase().includes(reasonCategory.toLowerCase()));
  const fullReason = isCustomOrClientCode
    ? (reasonDescription || reasonCategory || 'Korekta pozycji faktury').trim()
    : [reasonCategory, reasonDescription].filter(Boolean).join(': ').trim() || 'Korekta pozycji faktury';

  // Wyliczanie delty (różnicy) podatku VAT i kwot netto dla poszczególnych stawek
  let deltaNet23 = 0, deltaVat23 = 0;
  let deltaNet8 = 0, deltaVat8 = 0;
  let deltaNet5 = 0, deltaVat5 = 0;
  let deltaNet0 = 0;
  let deltaNetZw = 0;

  // Filtrujemy tylko pozycje, które uległy zmianie
  const modifiedItems = items.filter((it) => it.isModified);
  const itemsToProcess = modifiedItems.length > 0 ? modifiedItems : items;

  // Typ korekty
  const isFormalCorrection = typKorekty === '2' || correctionMode === 'formal';
  const isBulkCorrection = typKorekty === '3' || correctionMode === 'period_bulk';

  if (!isFormalCorrection && !isBulkCorrection) {
    itemsToProcess.forEach((item) => {
      const origVat = item.vatRate;
      const corrVat = item.correctedVatRate || item.vatRate;

      if (origVat === corrVat) {
        const dNet = Math.round((item.correctedNetTotal - item.originalNetTotal) * 100) / 100;
        const dVat = Math.round((item.correctedVatTotal - item.originalVatTotal) * 100) / 100;

        if (origVat === '23%') {
          deltaNet23 += dNet;
          deltaVat23 += dVat;
        } else if (origVat === '8%') {
          deltaNet8 += dNet;
          deltaVat8 += dVat;
        } else if (origVat === '5%') {
          deltaNet5 += dNet;
          deltaVat5 += dVat;
        } else if (origVat === '0%') {
          deltaNet0 += dNet;
        } else if (origVat === 'zw') {
          deltaNetZw += dNet;
        }
      } else {
        // Zmiana stawki VAT na pozycji: odejmujemy stan pierwotny z poprzedniej stawki, dodajemy skorygowany stan do nowej stawki
        if (origVat === '23%') {
          deltaNet23 -= item.originalNetTotal;
          deltaVat23 -= item.originalVatTotal;
        } else if (origVat === '8%') {
          deltaNet8 -= item.originalNetTotal;
          deltaVat8 -= item.originalVatTotal;
        } else if (origVat === '5%') {
          deltaNet5 -= item.originalNetTotal;
          deltaVat5 -= item.originalVatTotal;
        } else if (origVat === '0%') {
          deltaNet0 -= item.originalNetTotal;
        } else if (origVat === 'zw') {
          deltaNetZw -= item.originalNetTotal;
        }

        if (corrVat === '23%') {
          deltaNet23 += item.correctedNetTotal;
          deltaVat23 += item.correctedVatTotal;
        } else if (corrVat === '8%') {
          deltaNet8 += item.correctedNetTotal;
          deltaVat8 += item.correctedVatTotal;
        } else if (corrVat === '5%') {
          deltaNet5 += item.correctedNetTotal;
          deltaVat5 += item.correctedVatTotal;
        } else if (corrVat === '0%') {
          deltaNet0 += item.correctedNetTotal;
        } else if (corrVat === 'zw') {
          deltaNetZw += item.correctedNetTotal;
        }
      }
    });

    deltaNet23 = Math.round(deltaNet23 * 100) / 100;
    deltaVat23 = Math.round(deltaVat23 * 100) / 100;
    deltaNet8 = Math.round(deltaNet8 * 100) / 100;
    deltaVat8 = Math.round(deltaVat8 * 100) / 100;
    deltaNet5 = Math.round(deltaNet5 * 100) / 100;
    deltaVat5 = Math.round(deltaVat5 * 100) / 100;
    deltaNet0 = Math.round(deltaNet0 * 100) / 100;
    deltaNetZw = Math.round(deltaNetZw * 100) / 100;
  }

  // W przypadku korekty formalnej sumy różnicowe wynoszą ściśle 0.00 PLN
  // W przypadku korekty zbiorczej z rabatem używamy wartości rabatu
  let totalDeltaNet = 0;
  let totalDeltaVat = 0;
  let totalDeltaGross = 0;
  let vatSummaryXml = '';
  let faWierszeXml = '';

  if (isFormalCorrection) {
    totalDeltaNet = 0;
    totalDeltaVat = 0;
    totalDeltaGross = 0;
    vatSummaryXml = '';
    faWierszeXml = ''; // W FA(3) FaWiersz minOccurs="0" - przy korekcie formalnej pozycje są pomijane
  } else if (isBulkCorrection && data.bulkDiscount) {
    const bd = data.bulkDiscount;
    totalDeltaNet = bd.calculatedNetDelta;
    totalDeltaVat = bd.calculatedVatDelta;
    totalDeltaGross = bd.calculatedGrossDelta;

    const rateClean = bd.vatRate.replace('%', '');
    if (rateClean === '23') {
      vatSummaryXml = `\n        <P_13_1>${bd.calculatedNetDelta.toFixed(2)}</P_13_1>\n        <P_14_1>${bd.calculatedVatDelta.toFixed(2)}</P_14_1>`;
    } else {
      vatSummaryXml = `\n        <P_13_2>${bd.calculatedNetDelta.toFixed(2)}</P_13_2>\n        <P_14_2>${bd.calculatedVatDelta.toFixed(2)}</P_14_2>`;
    }

    const discountDesc = bd.discountDescription || `Rabat potransakcyjny za okres ${data.okresFaKorygowanej || ''}`;
    faWierszeXml = `        <FaWiersz>
            <NrWierszaFa>1</NrWierszaFa>
            <P_7>${escapeXml(discountDesc)}</P_7>
            <P_8A>usł.</P_8A>
            <P_8B>1</P_8B>
            <P_9A>${bd.calculatedNetDelta.toFixed(2)}</P_9A>
            <P_11>${bd.calculatedNetDelta.toFixed(2)}</P_11>
            <P_12>${rateClean}</P_12>
        </FaWiersz>`;
  } else {
    totalDeltaNet = Math.round((deltaNet23 + deltaNet8 + deltaNet5 + deltaNet0 + deltaNetZw) * 100) / 100;
    totalDeltaVat = Math.round((deltaVat23 + deltaVat8 + deltaVat5) * 100) / 100;
    totalDeltaGross = Math.round((totalDeltaNet + totalDeltaVat) * 100) / 100;

    if (deltaNet23 !== 0 || deltaVat23 !== 0) {
      vatSummaryXml += `\n        <P_13_1>${deltaNet23.toFixed(2)}</P_13_1>\n        <P_14_1>${deltaVat23.toFixed(2)}</P_14_1>`;
    }
    if (deltaNet8 !== 0 || deltaVat8 !== 0) {
      vatSummaryXml += `\n        <P_13_2>${deltaNet8.toFixed(2)}</P_13_2>\n        <P_14_2>${deltaVat8.toFixed(2)}</P_14_2>`;
    }
    if (deltaNet5 !== 0 || deltaVat5 !== 0) {
      vatSummaryXml += `\n        <P_13_3>${deltaNet5.toFixed(2)}</P_13_3>\n        <P_14_3>${deltaVat5.toFixed(2)}</P_14_3>`;
    }
    if (deltaNet0 !== 0) {
      vatSummaryXml += `\n        <P_13_6_1>${deltaNet0.toFixed(2)}</P_13_6_1>`;
    }
    if (deltaNetZw !== 0) {
      vatSummaryXml += `\n        <P_13_7>${deltaNetZw.toFixed(2)}</P_13_7>`;
    }

    let rowCounter = 1;
    const faWierszeXmlParts: string[] = [];
    itemsToProcess.forEach((item) => {
      let origVatVal = item.vatRate.replace('%', '');
      if (origVatVal === '0') origVatVal = '0 KR';

      let corrVatVal = (item.correctedVatRate || item.vatRate).replace('%', '');
      if (corrVatVal === '0') corrVatVal = '0 KR';

      const cleanName = cleanProductName(item.name) || item.name.trim();
      const gtinTag = item.gtin ? `\n            <GTIN>${cleanNumeric(item.gtin)}</GTIN>` : '';
      const unitStr = (item.unit || 'szt.').trim();

      // 1. Wiersz StanPrzed (stan przed korektą)
      faWierszeXmlParts.push(`        <FaWiersz>
            <NrWierszaFa>${rowCounter++}</NrWierszaFa>
            <P_7>${escapeXml(cleanName)}</P_7>${gtinTag}
            <P_8A>${escapeXml(unitStr)}</P_8A>
            <P_8B>${item.originalQuantity}</P_8B>
            <P_9A>${item.originalNetPrice.toFixed(2)}</P_9A>
            <P_11>${item.originalNetTotal.toFixed(2)}</P_11>
            <P_12>${origVatVal}</P_12>
            <StanPrzed>1</StanPrzed>
        </FaWiersz>`);

      // 2. Wiersz StanPo (nowy stan po korekcie)
      faWierszeXmlParts.push(`        <FaWiersz>
            <NrWierszaFa>${rowCounter++}</NrWierszaFa>
            <P_7>${escapeXml(cleanName)}</P_7>${gtinTag}
            <P_8A>${escapeXml(unitStr)}</P_8A>
            <P_8B>${item.correctedQuantity}</P_8B>
            <P_9A>${item.correctedNetPrice.toFixed(2)}</P_9A>
            <P_11>${item.correctedNetTotal.toFixed(2)}</P_11>
            <P_12>${corrVatVal}</P_12>
        </FaWiersz>`);
    });
    faWierszeXml = faWierszeXmlParts.join('\n');
  }

  // Węzeł DaneFaKorygowanej (obsługa pojedynczej lub wielu faktur korygowanych)
  const okresXml = data.okresFaKorygowanej?.trim()
    ? `\n        <OkresFaKorygowanej>${escapeXml(data.okresFaKorygowanej.trim())}</OkresFaKorygowanej>`
    : '';

  const invoicesToCorrect = (data.correctedInvoices && data.correctedInvoices.length > 0)
    ? data.correctedInvoices
    : [{
        id: 'orig',
        invoiceNumber: originalInvoiceNumber,
        invoiceDate: originalInvoiceDate,
        hasKsefNumber: hasOriginalKsefNumber,
        ksefNumber: originalKsefNumber,
        netTotal: 0,
        grossTotal: 0,
      }];

  const daneFaKorygowanejXml = invoicesToCorrect.map((inv) => {
    const cleanKsef = (inv.ksefNumber || '').trim().replace(/\s+/g, '');
    const kTag = (inv.hasKsefNumber && cleanKsef)
      ? `<NrKSeF>1</NrKSeF>\n                <NrKSeFFaKorygowanej>${escapeXml(cleanKsef)}</NrKSeFFaKorygowanej>`
      : '<NrKSeFN>1</NrKSeFN>';

    return `        <DaneFaKorygowanej>
            <DataWystFaKorygowanej>${inv.invoiceDate || issueDate}</DataWystFaKorygowanej>
            <NrFaKorygowanej>${escapeXml(inv.invoiceNumber)}</NrFaKorygowanej>
            ${kTag}
        </DaneFaKorygowanej>`;
  }).join('\n') + okresXml;

  // Podmiot 3 (Odbiorca / Apteka — wyłącznie dla jednostek z ID-Wew lub odrębnym NIP, nigdy dla DOZ)
  let podmiot3Xml = '';
  const isDozBuyer = cleanNumeric(buyer.nip) === '8271807718' || (buyer.name || '').toLowerCase().includes('doz');
  if (!isDozBuyer && thirdParty && thirdParty.name && thirdParty.name.trim()) {
    const cleanNip = thirdParty.nip ? cleanNumeric(thirdParty.nip) : '';
    const rawIdWew = (thirdParty.idWew || '').trim();
    const isValidIdWew = /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(rawIdWew);

    if (cleanNip.length === 10 || isValidIdWew) {
      const idSection =
        cleanNip.length === 10
          ? `\n            <NIP>${cleanNip}</NIP>`
          : `\n            <IDWew>${escapeXml(rawIdWew)}</IDWew>`;

      const rawGln = (thirdParty.gln || '').trim();
      const glnXml = rawGln && /^\d{1,13}$/.test(rawGln) ? `\n            <GLN>${escapeXml(rawGln)}</GLN>` : '';

      podmiot3Xml = `\n    <Podmiot3>
        <DaneIdentyfikacyjne>${idSection}
            <Nazwa>${escapeXml(thirdParty.name.trim())}</Nazwa>
        </DaneIdentyfikacyjne>
        <Adres>
            <KodKraju>${thirdParty.countryCode || 'PL'}</KodKraju>
            <AdresL1>${escapeXml(formatAdresL1(thirdParty))}</AdresL1>${glnXml}
        </Adres>
        <Rola>${thirdParty.role || '2'}</Rola>
    </Podmiot3>`;
    }
  }

  // Warunki transakcji
  let warunkiTransakcjiXml = '';
  if (orderNumber || orderDate) {
    warunkiTransakcjiXml = `\n        <WarunkiTransakcji>
            <Zamowienia>
                ${orderDate ? `<DataZamowienia>${orderDate}</DataZamowienia>` : ''}
                ${orderNumber ? `<NrZamowienia>${escapeXml(orderNumber)}</NrZamowienia>` : ''}
            </Zamowienia>
        </WarunkiTransakcji>`;
  }

  // Płatność
  const formaPlatnosciCode = paymentMethod === 'gotowka' ? '1' : paymentMethod === 'karta' ? '2' : '6';
  const bankAccountXml = seller.bankAccount?.trim()
    ? `\n            <RachunekBankowy>
                <NrRB>${cleanNumeric(seller.bankAccount)}</NrRB>
            </RachunekBankowy>`
    : '';

  const platnoscXml = `        <Platnosc>
            <TerminPlatnosci>
                <Termin>${dueDate || issueDate}</Termin>
            </TerminPlatnosci>
            <FormaPlatnosci>${formaPlatnosciCode}</FormaPlatnosci>${bankAccountXml}
        </Platnosc>`;

  // Stopka z BDO
  let stopkaXml = '';
  if (seller.bdoNumber && cleanNumeric(seller.bdoNumber)) {
    stopkaXml = `\n    <Stopka>
        <Rejestry>
            <BDO>${cleanNumeric(seller.bdoNumber)}</BDO>
        </Rejestry>
    </Stopka>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
    <Naglowek>
        <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
        <WariantFormularza>3</WariantFormularza>
        <DataWytworzeniaFa>${nowIso}</DataWytworzeniaFa>
    </Naglowek>
    <Podmiot1>
        <PrefiksPodatnika>${seller.countryCode || 'PL'}</PrefiksPodatnika>
        <DaneIdentyfikacyjne>
            <NIP>${cleanNumeric(seller.nip)}</NIP>
            <Nazwa>${escapeXml(seller.name)}</Nazwa>
        </DaneIdentyfikacyjne>
        <Adres>
            <KodKraju>${seller.countryCode || 'PL'}</KodKraju>
            <AdresL1>${escapeXml(formatAdresL1(seller))}</AdresL1>
        </Adres>${
          seller.email
            ? `\n        <DaneKontaktowe><Email>${escapeXml(seller.email)}</Email></DaneKontaktowe>`
            : ''
        }
    </Podmiot1>
    <Podmiot2>
        <DaneIdentyfikacyjne>
            <NIP>${cleanNumeric(buyer.nip)}</NIP>
            <Nazwa>${escapeXml(buyer.name)}</Nazwa>
        </DaneIdentyfikacyjne>
        <Adres>
            <KodKraju>${buyer.countryCode || 'PL'}</KodKraju>
            <AdresL1>${escapeXml(formatAdresL1(buyer))}</AdresL1>${
              buyer.gln && /^\d{1,13}$/.test(buyer.gln.trim()) ? `\n            <GLN>${escapeXml(buyer.gln.trim())}</GLN>` : ''
            }
        </Adres>${
          buyer.email
            ? `\n        <DaneKontaktowe><Email>${escapeXml(buyer.email)}</Email></DaneKontaktowe>`
            : ''
        }
        <JST>2</JST>
        <GV>2</GV>
    </Podmiot2>${podmiot3Xml}
    <Fa>
        <KodWaluty>${currency}</KodWaluty>
        <P_1>${issueDate}</P_1>${
          issuePlace ? `\n        <P_1M>${escapeXml(issuePlace)}</P_1M>` : ''
        }
        <P_2>${escapeXml(correctionNumber)}</P_2>${vatSummaryXml}
        <P_15>${totalDeltaGross.toFixed(2)}</P_15>
        <Adnotacje>
            <P_16>2</P_16>
            <P_17>2</P_17>
            <P_18>2</P_18>
            <P_18A>2</P_18A>
            <Zwolnienie>
                <P_19N>1</P_19N>
            </Zwolnienie>
            <NoweSrodkiTransportu>
                <P_22N>1</P_22N>
            </NoweSrodkiTransportu>
            <P_23>2</P_23>
            <PMarzy>
                <P_PMarzyN>1</P_PMarzyN>
            </PMarzy>
        </Adnotacje>
        <RodzajFaktury>KOR</RodzajFaktury>
        <PrzyczynaKorekty>${escapeXml(fullReason)}</PrzyczynaKorekty>
        <TypKorekty>${typKorekty}</TypKorekty>
${daneFaKorygowanejXml}
${faWierszeXml}
${platnoscXml}${warunkiTransakcjiXml}
    </Fa>${stopkaXml}
</Faktura>`;
}
