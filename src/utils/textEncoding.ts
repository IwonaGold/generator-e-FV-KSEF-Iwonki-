/**
 * Narzędzie do automatycznego wykrywania kodowania tekstu (UTF-8 vs Windows-1250 / CP1250 / ISO-8859-2)
 * Zapobiega powstawaniu "dziwnych znaków" (krzaków / mojibake) przy wczytywaniu polskich plików z hurtowni i aptek.
 */

export function fixPolishMojibake(text: string): string {
  if (!text) return '';
  return text
    // Typowe błędne sekwencje UTF-8 zinterpretowane jako Windows-1250 / ISO-8859-1 / ISO-8859-2
    .replace(/ďż˝/g, '\uFFFD')
    .replace(/Ãł/g, 'ó')
    .replace(/Ã³|Ã“/g, 'ó')
    .replace(/Ã…Â‚|Ã…â€š/g, 'ł')
    .replace(/Ã…Â¼|Ã…â€ /g, 'ż')
    .replace(/Ã…Âº|Ã…Â/g, 'ź')
    .replace(/Ã„â€¡|Ã„â€/g, 'ć')
    .replace(/Ã„â€˜|Ã„â€/g, 'ą')
    .replace(/Ã„â„¢/g, 'ę')
    .replace(/Ã…â€ž/g, 'ń')
    .replace(/Ã…â€º/g, 'ś')
    .replace(/Ã…Â /g, 'Ł')
    .replace(/Ã…Â¹/g, 'Ś')
    .replace(/Ã…Â»/g, 'Ż')
    .replace(/Ã„â€ /g, 'Ć')
    .replace(/Ã„â€/g, 'Ą')
    .replace(/Ã„Ëœ/g, 'Ę')
    .replace(/Ã…Æ’/g, 'Ń')
    .replace(/â€“|â€”/g, '—')
    .replace(/Â®/g, '®')
    // Naprawa słów kluczowych zamówień po uszkodzeniu kodowania ISO-8859-2 / CP1250 (\uFFFD lub krzaki)
    .replace(/zam(?:\uFFFD|³|\?)+wie/gi, (m) => (m[0] === 'Z' ? 'Zamówie' : 'zamówie'))
    .replace(/zamawiaj(?:\uFFFD|¹|\?)+c/gi, (m) => (m[0] === 'Z' ? 'Zamawiając' : 'zamawiając'))
    .replace(/ilo(?:\uFFFD|±|œ|æ|\?){1,2}/gi, (m) => (m[0] === 'I' ? 'Ilość' : 'ilość'))
    .replace(/warto(?:\uFFFD|±|œ|æ|\?){1,2}/gi, (m) => (m[0] === 'W' ? 'Wartość' : 'wartość'))
    .replace(/p(?:\uFFFD|³|\?)+atno(?:\uFFFD|±|œ|æ|\?){0,2}/gi, (m) => (m[0] === 'P' ? 'Płatność' : 'płatność'))
    .replace(/p(?:\uFFFD|³|\?)+at\./gi, (m) => (m[0] === 'P' ? 'Płat.' : 'płat.'))
    .replace(/s(?:\uFFFD|³|\?)+oik/gi, (m) => (m[0] === 'S' ? 'Słoik' : 'słoik'))
    .replace(/(?:\uFFFD|³|Ł)(?:\uFFFD|¹|ą)czn/g, 'Łączn')
    .replace(/obj(?:\uFFFD|ê|\?)+to(?:\uFFFD|±|œ|æ|\?){1,2}/gi, (m) => (m[0] === 'O' ? 'Objętość' : 'objętość'))
    .replace(/\uFFFD/g, ''); // Usuń pozostałe znaki zastępcze
}

/**
 * Bezpiecznie dekoduje bufor ArrayBuffer do tekstu, automatycznie wykrywając UTF-8, Windows-1250 lub ISO-8859-2
 */
export function decodeArrayBufferText(buffer: ArrayBuffer): string {
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const text = utf8Decoder.decode(buffer);

  // Jeśli w pliku występują sekwencje bajtów UTF-8 dla znaku zastępczego (0xEF 0xBF 0xBD),
  // plik został już wcześniej zapisany jako UTF-8 — napraw słowa bezpośrednio przez fixPolishMojibake
  const bytes = new Uint8Array(buffer);
  let hasUtf8ReplacementSequence = false;
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0xef && bytes[i + 1] === 0xbf && bytes[i + 2] === 0xbd) {
      hasUtf8ReplacementSequence = true;
      break;
    }
  }
  if (hasUtf8ReplacementSequence) {
    return fixPolishMojibake(text);
  }

  const hasReplacementChar = text.includes('\uFFFD');
  const hasMojibake = /Ã[³łóźżćąęńśŁŚŻĆĄĘŃ]/.test(text) || /[\u00C2\u00C3][\u0080-\u00BF]/.test(text);

  if (hasReplacementChar || hasMojibake) {
    if (/charset\s*=\s*["']?iso-8859-2/i.test(text)) {
      try {
        const isoDecoder = new TextDecoder('iso-8859-2');
        return fixPolishMojibake(isoDecoder.decode(buffer));
      } catch {}
    }

    let winText = '';
    let isoText = '';
    try {
      winText = new TextDecoder('windows-1250').decode(buffer);
    } catch {}
    try {
      isoText = new TextDecoder('iso-8859-2').decode(buffer);
    } catch {}

    const winArtifacts = (winText.match(/[±¶¼¡¦¬]/g) || []).length;
    const isoPolish = (isoText.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
    const winPolish = (winText.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;

    if (isoText && (winArtifacts > 0 || isoPolish > winPolish)) {
      return fixPolishMojibake(isoText);
    }
    if (winText && winPolish > 0) {
      return fixPolishMojibake(winText);
    }
  }

  return fixPolishMojibake(text);
}

/**
 * Bezpiecznie dekoduje bufor pliku do tekstu, automatycznie wykrywając UTF-8, Windows-1250 lub ISO-8859-2
 */
export async function decodeTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return decodeArrayBufferText(buffer);
}
