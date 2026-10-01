import {
  KSeFGenerationInput,
  KSeFValidationIssue,
  InvoiceItem,
  EntityDetails,
  ThirdPartyEntity,
} from '../types/ksef';

/**
 * Czyści numer z wszelkich znaków niebędących cyframi
 */
export function cleanNumeric(val?: string): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

/**
 * Bezpieczne zabezpieczenie znaków specjalnych w XML
 */
export function escapeXml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * OFICJALNA DEKLARACJA WĘZŁA GŁÓWNEGO FAKTURA FA(3)
 * Obowiązująca oficjalna przestrzeń nazw Ministerstwa Finansów dla KSeF:
 * http://crd.gov.pl/wzor/2025/06/25/13775/
 */
export const NAGLOWEK_KSEF =
  '<Faktura xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">';
export const ROOT_FAKTURA_DECLARATION = NAGLOWEK_KSEF;

/**
 * Oczyszcza nazwę produktu ze zbędnych przyrostków (Seria, Ważność, GTIN, LOT, EXP, kodów GS1),
 * aby w elemencie <P_7> znajdowała się wyłącznie czysta nazwa towaru lub usługi.
 */
export function cleanProductName(name?: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\/\s*(?:Seria|Ważność|Waznosc|Data ważności|GTIN|EAN|Kod|LOT|MHD|EXP)[:\s].*$/i, '')
    .replace(/\s*\/\s*(?:Seria|Ważność|Waznosc|GTIN|EAN|Kod|LOT|MHD|EXP)$/i, '')
    .replace(/\s*\(10\)[A-Za-z0-9]+(?:\(17\)\d+)?(?:\(37\)\d+)?.*$/i, '')
    .replace(/\s*\|\s*(?:Seria|Ważność|Waznosc|GTIN|EAN|LOT|MHD|EXP):?.*$/i, '')
    .trim();
}

/**
 * Formatuje numer IBAN/konta (usuwa PL i spacje)
 */
export function formatBankAccount(account?: string): string {
  if (!account) return '';
  return account.replace(/^PL/i, '').replace(/\s+/g, '');
}

/**
 * Formatuje pełny jednolity adres dla węzła <AdresL1> zgodnie ze standardem KSeF FA(3) i FA(2).
 * Łączy ulicę, numer domu/lokalu z kodem pocztowym i miejscowością.
 */
export function formatAdresL1(entity: {
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  apartmentNumber?: string;
}): string {
  if (entity.street && entity.houseNumber) {
    const apt = entity.apartmentNumber ? `/${entity.apartmentNumber}` : '';
    const cityZip = [entity.postalCode, entity.city].filter(Boolean).join(' ').trim();
    return `${entity.street} ${entity.houseNumber}${apt}${cityZip ? `, ${cityZip}` : ''}`;
  }

  const parts: string[] = [];
  if (entity.addressLine1?.trim()) {
    parts.push(entity.addressLine1.trim());
  }

  const cityZip = [entity.postalCode, entity.city].filter(Boolean).join(' ').trim();
  if (cityZip) {
    const hasCity = entity.city && entity.addressLine1?.toLowerCase().includes(entity.city.toLowerCase());
    const hasZip = entity.postalCode && entity.addressLine1?.includes(entity.postalCode);
    if (!hasCity || !hasZip) {
      parts.push(cityZip);
    }
  }

  return parts.join(', ') || 'Polska';
}

/**
 * Pomocnicze parsowanie adresu (dla kompatybilności wstecznej)
 */
export function parsePolishAddress(
  addressLine1?: string,
  city?: string,
  postalCode?: string,
  streetProp?: string,
  houseProp?: string,
  apartmentProp?: string
) {
  if (streetProp && houseProp) {
    return {
      street: streetProp,
      houseNumber: houseProp,
      apartmentNumber: apartmentProp || '',
      city: city || 'Warszawa',
      postalCode: postalCode || '00-001',
    };
  }

  let clean = (addressLine1 || '').replace(/^ul\.\s*/i, '').replace(/^al\.\s*/i, 'Aleja ').trim();
  let street = clean || 'Główna';
  let houseNumber = '1';
  let apartmentNumber = '';

  const lokMatch =
    clean.match(/(.*?)\s+(?:lok\.|lokal|m\.)\s*([0-9a-zA-Z]+)$/i) ||
    clean.match(/(.*?)\/([0-9a-zA-Z]+)$/);
  if (lokMatch) {
    street = lokMatch[1].trim();
    apartmentNumber = lokMatch[2].trim();
  }

  const houseMatch = street.match(/^(.*?)\s+([0-9]+[a-zA-Z]?)$/);
  if (houseMatch) {
    street = houseMatch[1].trim();
    houseNumber = houseMatch[2].trim();
  }

  return {
    street: street || 'Główna',
    houseNumber: houseNumber || '1',
    apartmentNumber: apartmentNumber || '',
    city: city || 'Warszawa',
    postalCode: postalCode || '00-001',
  };
}

export function formatAdresPol(entity: {
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  street?: string;
  houseNumber?: string;
  apartmentNumber?: string;
}): string {
  return formatAdresL1(entity);
}

/**
 * Buduje znormalizowany ciąg GS1 AI dla farmacji w KSeF:
 * AI(10) Numer serii, AI(17) Data ważności YYMMDD, AI(37) Ilość sztuk
 */
export function formatGS1CompositeString(
  batch?: string,
  expiryDate?: string,
  quantity?: number
): string {
  const cleanBatch = (batch || '').trim().replace(/^(LOT|SERIA|BATCH)[:\s-]*/i, '');

  let expiryYYMMDD = '';
  if (expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
    const [year, month, day] = expiryDate.trim().split('-');
    expiryYYMMDD = `${year.slice(2)}${month}${day}`;
  } else if (expiryDate && /^\d{2}[./-]\d{2}[./-]\d{4}$/.test(expiryDate.trim())) {
    const [day, month, year] = expiryDate.trim().split(/[./-]/);
    expiryYYMMDD = `${year.slice(2)}${month}${day}`;
  } else if (expiryDate && /^\d{2}\/\d{4}$/.test(expiryDate.trim())) {
    const [month, year] = expiryDate.trim().split('/');
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    expiryYYMMDD = `${year.slice(2)}${month}${String(lastDay).padStart(2, '0')}`;
  }

  const cleanQty = quantity && quantity > 0 ? Math.floor(quantity) : 1;

  if (!cleanBatch && !expiryYYMMDD) return '';

  let result = '';
  if (cleanBatch) {
    result += `(10)${cleanBatch}`;
  }
  if (expiryYYMMDD) {
    result += `(17)${expiryYYMMDD}`;
  }
  if (cleanQty) {
    result += `(37)${cleanQty}`;
  }

  return result;
}

/**
 * Waliduje poprawność danych przed wygenerowaniem XML
 */
export function validateForKSeF(input: KSeFGenerationInput): KSeFValidationIssue[] {
  const issues: KSeFValidationIssue[] = [];

  const sellerNip = cleanNumeric(input.seller.nip);
  if (!sellerNip || sellerNip.length !== 10) {
    issues.push({
      type: 'error',
      field: 'Sprzedawca (NIP)',
      message: `NIP sprzedawcy musi zawierać dokładnie 10 cyfr (obecnie: ${sellerNip.length}).`,
    });
  }

  const buyerNip = cleanNumeric(input.buyer.nip);
  if (!buyerNip || buyerNip.length !== 10) {
    issues.push({
      type: 'error',
      field: 'Nabywca (NIP)',
      message: `NIP nabywcy musi zawierać dokładnie 10 cyfr (obecnie: ${buyerNip.length}).`,
    });
  }

  const invoiceNo = (input.meta.invoiceNumber || '').trim();
  if (!invoiceNo) {
    issues.push({
      type: 'error',
      field: 'Numer faktury (P_2)',
      message: 'Pole P_2 jest obowiązkowe – uzupełnij numer faktury (np. 35/2026/KSEF).',
    });
  }

  if (!input.meta.issueDate) {
    issues.push({
      type: 'error',
      field: 'Data wystawienia (P_1)',
      message: 'Data wystawienia faktury (P_1) jest polem obowiązkowym.',
    });
  }

  if (!input.seller.bankAccount?.trim()) {
    issues.push({
      type: 'warning',
      field: 'Rachunek bankowy',
      message: 'Brak numeru konta bankowego sprzedawcy (NrRB).',
    });
  }

  if (input.items.length === 0) {
    issues.push({
      type: 'error',
      field: 'Pozycje faktury',
      message: 'Faktura musi zawierać co najmniej jedną pozycję towarową.',
    });
  }

  input.items.forEach((item, index) => {
    const rowNum = index + 1;
    if (!item.name?.trim()) {
      issues.push({
        type: 'error',
        field: `Pozycja #${rowNum} (Nazwa)`,
        message: `Wiersz ${rowNum} nie ma podanej nazwy towaru (P_7).`,
      });
    }
    if (item.quantity <= 0) {
      issues.push({
        type: 'error',
        field: `Pozycja #${rowNum} (Ilość)`,
        message: `Ilość w pozycji ${rowNum} musi być większa od 0.`,
      });
    }
    if (item.netPrice < 0) {
      issues.push({
        type: 'error',
        field: `Pozycja #${rowNum} (Cena)`,
        message: `Cena jednostkowa w pozycji ${rowNum} nie może być ujemna.`,
      });
    }
    if (input.logisticsFormat !== 'none' && !item.batchNumber?.trim()) {
      issues.push({
        type: 'warning',
        field: `Pozycja #${rowNum} (Seria)`,
        message: `Brak numeru serii w pozycji ${rowNum} (wymagany dla wybranego formatu logistycznego).`,
      });
    }
  });

  return issues;
}

export function validateKSeFInvoice(input: KSeFGenerationInput): KSeFValidationIssue[] {
  return validateForKSeF(input);
}

/**
 * Generuje oficjalny plik XML KSeF w 100% zgodny ze specyfikacją Ministerstwa Finansów (ksef.gov.pl).
 * Domyślnie generuje obowiązujący format FA (3) (schemat wzór 13775, wersja 1-0E).
 */
export function generateKSeFXML(input: KSeFGenerationInput): string {
  const { seller, buyer, thirdParty, meta, items, schemaVersion } = input;

  const schemaVer = schemaVersion || 'FA3';
  const invoiceNo = (meta.invoiceNumber || '35/2026/KSEF').trim();
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Obliczenia sum i stawek VAT metodą "od sumy wartości netto" (art. 106e ust. 1 pkt 14 ustawy o VAT)
  let net23 = 0, vat23 = 0;
  let net8 = 0, vat8 = 0;
  let net5 = 0, vat5 = 0;
  let net0 = 0;
  let netZw = 0;

  items.forEach((item) => {
    const lineNet = Math.round(item.quantity * item.netPrice * 100) / 100;
    if (item.vatRate === '23%') {
      net23 += lineNet;
    } else if (item.vatRate === '8%') {
      net8 += lineNet;
    } else if (item.vatRate === '5%') {
      net5 += lineNet;
    } else if (item.vatRate === '0%') {
      net0 += lineNet;
    } else if (item.vatRate === 'zw') {
      netZw += lineNet;
    }
  });

  // Zaokrąglenie sum netto do 2 miejsc po przecinku
  net23 = Math.round(net23 * 100) / 100;
  net8 = Math.round(net8 * 100) / 100;
  net5 = Math.round(net5 * 100) / 100;
  net0 = Math.round(net0 * 100) / 100;
  netZw = Math.round(netZw * 100) / 100;

  // Wyliczenie kwot podatku od sumy netto poszczególnych stawek
  vat23 = Math.round(net23 * 0.23 * 100) / 100;
  vat8 = Math.round(net8 * 0.08 * 100) / 100;
  vat5 = Math.round(net5 * 0.05 * 100) / 100;

  const totalNet = Math.round((net23 + net8 + net5 + net0 + netZw) * 100) / 100;
  const totalVat = Math.round((vat23 + vat8 + vat5) * 100) / 100;
  const totalGross = Math.round((totalNet + totalVat) * 100) / 100;

  const formaPlatnosciCode =
    meta.paymentMethod === 'gotowka' ? '1' : meta.paymentMethod === 'karta' ? '2' : '6';

  // =========================================================================
  // STANDARD FA (3) – OBOWIĄZUJĄCY W KSEF OD 2026 ROKU (WZÓR 13775, WERSJA 1-0E)
  // =========================================================================
  if (schemaVer === 'FA3') {
    // 1. Pozycje <FaWiersz>
    const faWierszeXml = items
      .map((item, idx) => {
        const rowNum = idx + 1;
        const rowNet = (Math.round(item.quantity * item.netPrice * 100) / 100).toFixed(2);
        let vatVal = item.vatRate.replace('%', '');
        if (vatVal === '0') vatVal = '0 KR';

        const cleanName = cleanProductName(item.name);
        const itemP7 = cleanName || item.name.trim();

        const gtinTag = item.gtin ? `\n            <GTIN>${cleanNumeric(item.gtin)}</GTIN>` : '';
        const unitStr = (item.unit || 'szt.').trim();

        return `        <FaWiersz>
            <NrWierszaFa>${rowNum}</NrWierszaFa>
            <P_7>${escapeXml(itemP7)}</P_7>${gtinTag}
            <P_8A>${escapeXml(unitStr)}</P_8A>
            <P_8B>${item.quantity}</P_8B>
            <P_9A>${item.netPrice.toFixed(2)}</P_9A>
            <P_11>${rowNet}</P_11>
            <P_12>${vatVal}</P_12>
        </FaWiersz>`;
      })
      .join('\n');

    // 1b. Opcjonalne rozszerzone cechy logistyczne w <DodatkowyOpis> (Seria, Data ważności / format GS1)
    // ZGODNIE Z FA(3): Węzeł DodatkowyOpis musi znajdować się PRZED <FaWiersz>!
    // Jeśli wybrano tryb 'none' (faktura standardowa bez serii/dat), sekcja ta jest całkowicie pomijana.
    const dodatkowyOpisLines: string[] = [];
    if (input.logisticsFormat !== 'none') {
      items.forEach((item, idx) => {
        const rowNum = idx + 1;
        if (input.logisticsFormat === 'gs1_composite') {
          const gs1String = formatGS1CompositeString(item.batchNumber, item.expiryDate, item.quantity);
          if (gs1String) {
            dodatkowyOpisLines.push(`        <DodatkowyOpis>
            <NrWiersza>${rowNum}</NrWiersza>
            <Klucz>NumerSeriiDataPrzydatnosciIlosc</Klucz>
            <Wartosc>${escapeXml(gs1String)}</Wartosc>
        </DodatkowyOpis>`);
          }
        } else if (input.logisticsFormat === 'separate_fields') {
          if (item.batchNumber) {
            dodatkowyOpisLines.push(`        <DodatkowyOpis>
            <NrWiersza>${rowNum}</NrWiersza>
            <Klucz>Seria</Klucz>
            <Wartosc>${escapeXml(item.batchNumber)}</Wartosc>
        </DodatkowyOpis>`);
          }
          if (item.expiryDate) {
            dodatkowyOpisLines.push(`        <DodatkowyOpis>
            <NrWiersza>${rowNum}</NrWiersza>
            <Klucz>Data ważności</Klucz>
            <Wartosc>${escapeXml(item.expiryDate)}</Wartosc>
        </DodatkowyOpis>`);
          }
        }
      });
    }

    const dodatkowyOpisXml = dodatkowyOpisLines.length > 0 ? dodatkowyOpisLines.join('\n') + '\n' : '';

    // 2. Podsumowanie stawek podatku
    let vatSummaryXml = '';
    if (net23 > 0 || vat23 > 0) {
      vatSummaryXml += `\n        <P_13_1>${net23.toFixed(2)}</P_13_1>\n        <P_14_1>${vat23.toFixed(2)}</P_14_1>`;
    }
    if (net8 > 0 || vat8 > 0) {
      vatSummaryXml += `\n        <P_13_2>${net8.toFixed(2)}</P_13_2>\n        <P_14_2>${vat8.toFixed(2)}</P_14_2>`;
    }
    if (net5 > 0 || vat5 > 0) {
      vatSummaryXml += `\n        <P_13_3>${net5.toFixed(2)}</P_13_3>\n        <P_14_3>${vat5.toFixed(2)}</P_14_3>`;
    }
    if (net0 > 0) {
      vatSummaryXml += `\n        <P_13_6_1>${net0.toFixed(2)}</P_13_6_1>`;
    }
    if (netZw > 0) {
      vatSummaryXml += `\n        <P_13_7>${netZw.toFixed(2)}</P_13_7>`;
    }

    // 3. Podmiot 3 (kolejność w FA3: DaneIdentyfikacyjne, Adres, Rola)
    let podmiot3Xml = '';
    if (thirdParty && thirdParty.name && thirdParty.name.trim()) {
      let idSection = '';
      const cleanNip = thirdParty.nip ? cleanNumeric(thirdParty.nip) : '';
      const rawIdWew = (thirdParty.idWew || '').trim();

      // Oficjalny wzorzec KSeF dla IDWew (TNIPIdWew): 10 cyfr NIP - 5 cyfr identyfikatora wewnętrznego
      const isValidIdWew = /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(rawIdWew);

      if (cleanNip.length === 10) {
        idSection = `\n            <NIP>${cleanNip}</NIP>`;
      } else if (isValidIdWew) {
        idSection = `\n            <IDWew>${escapeXml(rawIdWew)}</IDWew>`;
      } else {
        idSection = `\n            <BrakID>1</BrakID>`;
      }

      // Jeśli podano GLN (1-13 cyfr, np. z zamówienia 5909000848054) lub idWew jest w formacie GLN
      const rawGln = (thirdParty.gln || (!isValidIdWew && /^\d{1,13}$/.test(rawIdWew) ? rawIdWew : '')).trim();
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

    // 4. Warunki transakcji / Zamówienie
    let warunkiTransakcjiXml = '';
    if (meta.orderNumber || meta.orderDate) {
      warunkiTransakcjiXml = `\n        <WarunkiTransakcji>
            <Zamowienia>
                ${meta.orderDate ? `<DataZamowienia>${meta.orderDate}</DataZamowienia>` : ''}
                ${meta.orderNumber ? `<NrZamowienia>${escapeXml(meta.orderNumber)}</NrZamowienia>` : ''}
            </Zamowienia>
        </WarunkiTransakcji>`;
    }

    // 5. Płatność
    const bankAccountXml = seller.bankAccount?.trim()
      ? `\n            <RachunekBankowy>
                <NrRB>${cleanNumeric(seller.bankAccount)}</NrRB>
            </RachunekBankowy>`
      : '';

    const platnoscXml = `        <Platnosc>
            <TerminPlatnosci>
                <Termin>${meta.dueDate}</Termin>
            </TerminPlatnosci>
            <FormaPlatnosci>${formaPlatnosciCode}</FormaPlatnosci>${bankAccountXml}
        </Platnosc>`;

    // 6. Stopka z numerem BDO (jeśli podano)
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
            <AdresL1>${escapeXml(formatAdresL1(buyer))}</AdresL1>
        </Adres>${
          buyer.email
            ? `\n        <DaneKontaktowe><Email>${escapeXml(buyer.email)}</Email></DaneKontaktowe>`
            : ''
        }
        <JST>2</JST>
        <GV>2</GV>
    </Podmiot2>${podmiot3Xml}
    <Fa>
        <KodWaluty>${meta.currency || 'PLN'}</KodWaluty>
        <P_1>${meta.issueDate}</P_1>${
          meta.issuePlace ? `\n        <P_1M>${escapeXml(meta.issuePlace)}</P_1M>` : ''
        }
        <P_2>${escapeXml(invoiceNo)}</P_2>${
          meta.deliveryDate && meta.deliveryDate !== meta.issueDate
            ? `\n        <P_6>${meta.deliveryDate}</P_6>`
            : ''
        }${vatSummaryXml}
        <P_15>${totalGross.toFixed(2)}</P_15>
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
        <RodzajFaktury>VAT</RodzajFaktury>
${dodatkowyOpisXml}${faWierszeXml}
${platnoscXml}${warunkiTransakcjiXml}
    </Fa>${stopkaXml}
</Faktura>`;
  }

  // =========================================================================
  // STANDARD FA (2) – OPCJONALNY STARSZY FORMAT (WZÓR 12648)
  // =========================================================================
  const sellerAdresL1 = formatAdresL1(seller);
  const buyerAdresL1 = formatAdresL1(buyer);

  const rowsXml = items
    .map((item, idx) => {
      const rowNum = idx + 1;
      const rowNet = (Math.round(item.quantity * item.netPrice * 100) / 100).toFixed(2);
      const vatRateNum = item.vatRate.replace('%', '');

      const cleanName = item.name
        .replace(/\s*\/\s*(?:Seria|Ważność|Waznosc|GTIN|EAN|Kod):.*$/i, '')
        .replace(/\s*\/\s*GTIN:.*$/i, '')
        .trim();

      const p7Parts = [cleanName];
      if (item.batchNumber) p7Parts.push(`Seria: ${item.batchNumber}`);
      if (item.expiryDate) p7Parts.push(`Ważność: ${item.expiryDate}`);
      if (item.gtin) p7Parts.push(`GTIN: ${item.gtin}`);
      const itemP7 = p7Parts.join(' / ');

      return `    <FaWiersz>
      <NrWierszaFa>${rowNum}</NrWierszaFa>
      <P_7>${escapeXml(itemP7)}</P_7>
      <P_8A>${escapeXml(item.unit || 'szt.')}</P_8A>
      <P_8B>${item.quantity}</P_8B>
      <P_9A>${item.netPrice.toFixed(2)}</P_9A>
      <P_11>${rowNet}</P_11>
      <P_12>${vatRateNum}</P_12>
    </FaWiersz>`;
    })
    .join('\n');

  let vatSummaryXmlFa2 = '';
  if (net23 > 0 || vat23 > 0) {
    vatSummaryXmlFa2 += `\n    <P_13_1>${net23.toFixed(2)}</P_13_1>\n    <P_14_1>${vat23.toFixed(2)}</P_14_1>`;
  }
  if (net8 > 0 || vat8 > 0) {
    vatSummaryXmlFa2 += `\n    <P_13_2>${net8.toFixed(2)}</P_13_2>\n    <P_14_2>${vat8.toFixed(2)}</P_14_2>`;
  }
  if (net5 > 0 || vat5 > 0) {
    vatSummaryXmlFa2 += `\n    <P_13_3>${net5.toFixed(2)}</P_13_3>\n    <P_14_3>${vat5.toFixed(2)}</P_14_3>`;
  }

  let warunkiTransakcjiXmlFa2 = '';
  if (meta.orderNumber || meta.orderDate) {
    warunkiTransakcjiXmlFa2 = `\n    <WarunkiTransakcji>
      <Zamowienia>
        <Zamowienie>
          ${meta.orderDate ? `<DataZamowienia>${meta.orderDate}</DataZamowienia>` : ''}
          ${meta.orderNumber ? `<NrZamowienia>${escapeXml(meta.orderNumber)}</NrZamowienia>` : ''}
        </Zamowienie>
      </Zamowienia>
    </WarunkiTransakcji>`;
  }

  let podmiot3XmlFa2 = '';
  if (thirdParty && thirdParty.name) {
    const tp = thirdParty;
    const tpAdres = formatAdresL1(tp);
    const cleanNip = tp.nip ? cleanNumeric(tp.nip) : '';
    const rawIdWew = (tp.idWew || '').trim();
    const isValidIdWew = /^[1-9]((\d[1-9])|([1-9]\d))\d{7}-\d{5}$/.test(rawIdWew);

    const idTag = cleanNip.length === 10
      ? `<NIP>${cleanNip}</NIP>`
      : isValidIdWew
      ? `<IDWew>${escapeXml(rawIdWew)}</IDWew>`
      : `<BrakID>1</BrakID>`;

    const rawGln = (tp.gln || (!isValidIdWew && /^\d{1,13}$/.test(rawIdWew) ? rawIdWew : '')).trim();
    const glnXml = rawGln && /^\d{1,13}$/.test(rawGln) ? `\n      <GLN>${escapeXml(rawGln)}</GLN>` : '';

    podmiot3XmlFa2 = `\n  <Podmiot3>
    <DaneIdentyfikacyjne>
      ${idTag}
      <Nazwa>${escapeXml(tp.name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>${tp.countryCode || 'PL'}</KodKraju>
      <AdresL1>${escapeXml(tpAdres)}</AdresL1>${glnXml}
    </Adres>
    <Rola>${tp.role || '2'}</Rola>
  </Podmiot3>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (2)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
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
      <AdresL1>${escapeXml(sellerAdresL1)}</AdresL1>
    </Adres>
    ${seller.email ? `<DaneKontaktowe><Email>${escapeXml(seller.email)}</Email></DaneKontaktowe>` : ''}
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${cleanNumeric(buyer.nip)}</NIP>
      <Nazwa>${escapeXml(buyer.name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>${buyer.countryCode || 'PL'}</KodKraju>
      <AdresL1>${escapeXml(buyerAdresL1)}</AdresL1>
    </Adres>
    ${buyer.email ? `<DaneKontaktowe><Email>${escapeXml(buyer.email)}</Email></DaneKontaktowe>` : ''}
  </Podmiot2>${podmiot3XmlFa2}
  <Fa>
    <KodWaluty>${meta.currency || 'PLN'}</KodWaluty>
    <P_1>${meta.issueDate}</P_1>
    ${meta.issuePlace ? `<P_1M>${escapeXml(meta.issuePlace)}</P_1M>` : ''}
    <P_2>${escapeXml(invoiceNo)}</P_2>
    <P_6>${meta.deliveryDate || meta.issueDate}</P_6>${vatSummaryXmlFa2}
    <P_15>${totalGross.toFixed(2)}</P_15>
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
    <RodzajFaktury>VAT</RodzajFaktury>
${rowsXml}
    <Platnosc>
      <TerminPlatnosci>
        <Termin>${meta.dueDate}</Termin>
      </TerminPlatnosci>
      <FormaPlatnosci>${formaPlatnosciCode}</FormaPlatnosci>
      ${
        seller.bankAccount
          ? `<RachunekBankowy>
        <NrRB>${cleanNumeric(seller.bankAccount)}</NrRB>
      </RachunekBankowy>`
          : ''
      }
    </Platnosc>${warunkiTransakcjiXmlFa2}
  </Fa>
</Faktura>`;
}

export type ValidationIssue = KSeFValidationIssue;

export function downloadKSeFXMLFile(
  xmlContent: string,
  invoiceNumber: string,
  schemaVersion: string = 'FA3'
): void {
  const safeName = (invoiceNumber || 'faktura')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const fileName = `KSeF_${safeName}_${schemaVersion}.xml`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
