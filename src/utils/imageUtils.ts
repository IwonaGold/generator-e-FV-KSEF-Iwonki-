/**
 * Narzędzia do obsługi, kompresji i pobierania zdjęć przesyłek / paczek
 */

/**
 * Kompresuje zdjęcie (domyślnie max 1080px, jakość JPEG 0.72) i zwraca jako dataURL (base64).
 * Automatycznie pilnuje budżetu pamięci dla darmowego planu serwera (docelowo ~70-140 KB na zdjęcie),
 * zachowując wysoką ostrość numerów serii LOT, dat ważności MHD i etykiet kurierskich.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDimension = 1080,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Jeśli plik nie jest obrazem, odrzuć
    if (!file.type.startsWith('image/')) {
      reject(new Error('Wybrany plik nie jest prawidłowym obrazem.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Nie udało się odczytać zawartości pliku.'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const effectiveMaxDim = Math.min(maxDimension, 1150);
          const effectiveQuality = Math.min(quality, 0.74);
          let { width, height } = img;

          // Skalowanie proporcjonalne
          if (width > effectiveMaxDim || height > effectiveMaxDim) {
            if (width > height) {
              height = Math.round((height * effectiveMaxDim) / width);
              width = effectiveMaxDim;
            } else {
              width = Math.round((width * effectiveMaxDim) / height);
              height = effectiveMaxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let compressedDataUrl = canvas.toDataURL('image/jpeg', effectiveQuality);

          // Jeśli zdjęcie nadal przekracza ~160 KB (220 000 znaków base64), wykonaj drugi przebieg oszczędzający RAM
          if (compressedDataUrl.length > 220000) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.58);
          }

          resolve(compressedDataUrl);
        } catch {
          resolve(result);
        }
      };

      img.onerror = () => {
        reject(new Error('Nie udało się załadować podglądu zdjęcia.'));
      };

      img.src = result;
    };

    reader.onerror = () => {
      reject(new Error('Błąd odczytu pliku z dysku.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Rekompresuje istniejący dataURL (np. ze starszej sesji IndexedDB), jeśli przekracza limit znaków base64
 */
export async function recompressDataUrlIfOversized(
  dataUrl: string,
  maxBase64Length = 240000
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.length <= maxBase64Length) {
    return dataUrl;
  }
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const out = canvas.toDataURL('image/jpeg', 0.65);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Pobiera dataURL lub URL obrazu na dysk użytkownika jako plik
 */
export function downloadImageDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
