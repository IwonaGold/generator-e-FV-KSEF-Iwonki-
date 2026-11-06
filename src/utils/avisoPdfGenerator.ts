/**
 * Generator pliku PDF Awizacji Dostawy (100% czysty kod bez zewnętrznych zależności).
 * Zgodny ze standardem ISO 32000-1 (PDF-1.4).
 * Generuje dokument A4 w orientacji poziomej (Landscape: 841.89 x 595.28 pt)
 * z wyśrodkowanym, pogrubionym napisem:
 *
 *       AWIZACJA
 *      [DATA DOSTAWY]
 *     [GODZINA AWIZACJI]
 *
 * Identyczny ze wzorcem logistycznym do wydruku / oznaczenia przesyłki.
 */

// Szerokości znaków Type 1 Helvetica-Bold (AFM / 1000)
const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, "'": 278,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611, '@': 975,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556,
  '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
  'I': 278, 'J': 556, 'K': 722, 'L': 611, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
  'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
  'Y': 667, 'Z': 611,
  'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333, 'g': 611, 'h': 611,
  'i': 278, 'j': 278, 'k': 556, 'l': 278, 'm': 889, 'n': 611, 'o': 611, 'p': 611,
  'q': 611, 'r': 389, 's': 556, 't': 333, 'u': 611, 'v': 556, 'w': 778, 'x': 556,
  'y': 556, 'z': 500,
};

function calculateStringWidth(text: string, fontSize: number): number {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    total += HELVETICA_BOLD_WIDTHS[char] ?? 600;
  }
  return (total / 1000) * fontSize;
}

function escapePdfString(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Buduje zawartość pliku PDF jako ciąg znaków w formacie PDF-1.4.
 */
export function buildAvisoPdfString(dateStr: string, timeStr: string): string {
  const pageWidth = 841.89; // A4 landscape width w punktach (pt)

  const title = 'AWIZACJA';
  const cleanDate = escapePdfString((dateStr || '').trim());
  const cleanTime = escapePdfString((timeStr || '').trim());
  const hasTime = cleanTime.length > 0;
  const hasDate = cleanDate.length > 0;

  const titleSize = 54;
  const dateSize = 50;
  const timeSize = 50;

  const wTitle = calculateStringWidth(title, titleSize);
  const wDate = hasDate ? calculateStringWidth(cleanDate, dateSize) : 0;
  const wTime = hasTime ? calculateStringWidth(cleanTime, timeSize) : 0;

  const xTitle = Number(((pageWidth - wTitle) / 2).toFixed(2));
  const xDate = Number(((pageWidth - wDate) / 2).toFixed(2));
  const xTime = Number(((pageWidth - wTime) / 2).toFixed(2));

  // Pionowe wyśrodkowanie tekstu w formacie A4 poziomo (wysokość = 595.28 pt)
  const yTitle = hasTime ? 370 : 330;
  const yDate = hasTime ? 275 : 230;
  const yTime = 185;

  let stream = `BT\n/F1 ${titleSize} Tf\n1 0 0 1 ${xTitle} ${yTitle} Tm\n(${title}) Tj\n`;
  if (hasDate) {
    stream += `/F1 ${dateSize} Tf\n1 0 0 1 ${xDate} ${yDate} Tm\n(${cleanDate}) Tj\n`;
  }
  if (hasTime) {
    stream += `/F1 ${timeSize} Tf\n1 0 0 1 ${xTime} ${yTime} Tm\n(${cleanTime}) Tj\n`;
  }
  stream += `ET\n`;

  const streamLen = stream.length;

  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const obj3 = `3 0 obj\n<<\n  /Type /Page\n  /Parent 2 0 R\n  /MediaBox [0 0 841.89 595.28]\n  /Resources <<\n    /Font << /F1 4 0 R >>\n  >>\n  /Contents 5 0 R\n>>\nendobj\n`;
  const obj4 = `4 0 obj\n<<\n  /Type /Font\n  /Subtype /Type1\n  /BaseFont /Helvetica-Bold\n  /Encoding /WinAnsiEncoding\n>>\nendobj\n`;
  const obj5 = `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}endstream\nendobj\n`;

  const header = `%PDF-1.4\n`;
  const objects = [obj1, obj2, obj3, obj4, obj5];
  const offsets: number[] = [];

  let currentOffset = header.length;
  let body = '';

  for (const obj of objects) {
    offsets.push(currentOffset);
    body += obj;
    currentOffset += obj.length;
  }

  const xrefStart = currentOffset;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return header + body + xref + trailer;
}

/**
 * Zwraca plik PDF jako binarny Blob o typie application/pdf.
 */
export function buildAvisoPdfBlob(dateStr: string, timeStr: string): Blob {
  const pdfString = buildAvisoPdfString(dateStr, timeStr);
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) {
    bytes[i] = pdfString.charCodeAt(i) & 0xff;
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Bezpośrednio pobiera plik PDF na urządzenie użytkownika.
 */
export function downloadAvisoPdfFile(dateStr: string, timeStr: string, orderNumber?: string): void {
  const blob = buildAvisoPdfBlob(dateStr, timeStr);
  const url = URL.createObjectURL(blob);

  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/[^0-9\-]/g, '');
  const cleanTime = (timeStr || '').replace(/[^0-9]/g, '');
  const cleanOrd = (orderNumber || '')
    .trim()
    .replace(/^ZAM[:\s]*/i, '')
    .replace(/^FA\/?/i, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_');

  let fileName = `Awizacja_${cleanDate}`;
  if (cleanTime) fileName += `_${cleanTime}`;
  if (cleanOrd && cleanOrd !== 'FAKTURA' && cleanOrd !== 'Brak_numeru') {
    fileName += `_${cleanOrd}`;
  }
  fileName += '.pdf';

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
