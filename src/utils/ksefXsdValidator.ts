/**
 * Moduł rzeczywistej walidacji dokumentów XML względem oficjalnego schematu XSD FA(3)
 * Schemat referencyjny: FA(3) wzór 13775, wersja 1-0E (Ministerstwo Finansów / KSeF)
 */

export interface XsdValidationError {
  lineNumber?: number;
  element?: string;
  message: string;
  rawMessage: string;
  expected?: string;
}

export interface XsdValidationResult {
  valid: boolean;
  schema: string;
  checkedAt: string;
  errors: XsdValidationError[];
  summary: string;
  durationMs?: number;
}

/**
 * Parsuje surowe komunikaty błędów z libxml2 na czytelne pola
 */
export function parseLibxmlError(rawMsg: string, line?: number): XsdValidationError {
  let element = '';
  const elemMatch = rawMsg.match(/Element '(?:\S+?:)?(?:\{[^}]+\})?([^']+)'/);
  if (elemMatch) {
    element = elemMatch[1];
  }

  let expected = '';
  const expMatch = rawMsg.match(/Expected is (?:one of )?\(([^)]+)\)/i);
  if (expMatch) {
    expected = expMatch[1]
      .replace(/\{http:\/\/[^}]+\}/g, '')
      .split(',')
      .map((s) => s.trim())
      .join(', ');
  }

  // Wyczyść prefiksy techniczne
  let cleanMsg = rawMsg
    .replace(/^faktura\.xml:\d+:\s*/, '')
    .replace(/^Schemas validity error\s*:\s*/i, '')
    .trim();

  return {
    lineNumber: line,
    element: element || undefined,
    message: cleanMsg,
    rawMessage: rawMsg,
    expected: expected || undefined,
  };
}

/**
 * Wysyła XML do endpointu serwera wykonującego rzeczywistą walidację XSD libxml2
 */
export async function validateXmlAgainstKSeFXsd(xmlContent: string): Promise<XsdValidationResult> {
  const startTime = Date.now();
  try {
    const response = await fetch('/api/validate-ksef-xsd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml: xmlContent }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `Błąd serwera walidacji HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      valid: Boolean(data.valid),
      schema: data.schema || 'FA(3) wzór 13775, wersja 1-0E (Ministerstwo Finansów / KSeF)',
      checkedAt: new Date().toLocaleTimeString('pl-PL'),
      errors: Array.isArray(data.errors) ? data.errors : [],
      summary: data.valid
        ? 'Plik jest w 100% zgodny z oficjalnym schematem XSD FA(3) Ministerstwa Finansów.'
        : `Wykryto ${data.errors?.length || 0} niezgodności ze schematem XSD FA(3).`,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      valid: false,
      schema: 'FA(3) wzór 13775 (Ministerstwo Finansów / KSeF)',
      checkedAt: new Date().toLocaleTimeString('pl-PL'),
      errors: [
        {
          message: err.message || 'Nie udało się połączyć z usługą walidacji XSD',
          rawMessage: String(err),
        },
      ],
      summary: 'Błąd połączenia z walidatorem XSD.',
      durationMs: Date.now() - startTime,
    };
  }
}
