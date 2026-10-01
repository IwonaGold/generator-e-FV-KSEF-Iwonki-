/**
 * Narzędzie do automatycznego wykrywania kodowania tekstu (UTF-8 vs Windows-1250 / CP1250 / ISO-8859-2)
 * Zapobiega powstawaniu "dziwnych znaków" (krzaków / mojibake) przy wczytywaniu polskich plików z hurtowni i aptek.
 */

export function fixPolishMojibake(text: string): string {
  if (!text) return '';
  return text
    // Typowe błędne sekwencje UTF-8 zinterpretowane jako Windows-1250 / ISO-8859-1
    .replace(/Ãł/g, 'ó')
    .replace(/Ã³|Ã/g, 'ó')
    .replace(/ÃÂ|Ãâ/g, 'ł')
    .replace(/ÃÂ¼|Ãâ/g, 'ż')
    .replace(/ÃÂº|ÃÂ/g, 'ź')
    .replace(/Ãâ¡|Ãâ/g, 'ć')
    .replace(/Ãâ|Ãâ/g, 'ą')
    .replace(/Ãâ¢/g, 'ę')
    .replace(/Ãâ/g, 'ń')
    .replace(/Ãâº/g, 'ś')
    .replace(/ÃÂ/g, 'Ł')
    .replace(/ÃÂ¹/g, 'Ś')
    .replace(/ÃÂ»/g, 'Ż')
    .replace(/Ãâ /g, 'Ć')
    .replace(/Ãâ/g, 'Ą')
    .replace(/ÃË/g, 'Ę')
    .replace(/ÃÆ/g, 'Ń')
    .replace(/â|â/g, '—')
    .replace(/Â®/g, '®')
    .replace(/\uFFFD/g, ''); // Usuń znak zastępczy 
}

/**
 * Bezpiecznie dekoduje bufor pliku do tekstu, automatycznie wykrywając UTF-8 lub Windows-1250
 */
export async function decodeTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  // 1. Spróbuj dekodować jako UTF-8
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  let text = utf8Decoder.decode(buffer);

  // Sprawdź, czy występuje znak błędu kodowania  lub wzorce krzaków
  const hasReplacementChar = text.includes('\uFFFD');
  const hasMojibake = /Ã[³łóźżćąęńśŁŚŻĆĄĘŃ]/.test(text) || /[\u00C2\u00C3][\u0080-\u00BF]/.test(text);

  if (hasReplacementChar || hasMojibake) {
    try {
      // 2. Jeśli UTF-8 ma błędy, spróbuj dekodować w polskim standardzie Windows-1250
      const winDecoder = new TextDecoder('windows-1250');
      const winText = winDecoder.decode(buffer);
      if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(winText)) {
        return winText;
      }
    } catch {
      // Fallback
    }
  }

  // Ostateczne oczyszczenie
  return fixPolishMojibake(text);
}
