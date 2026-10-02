/**
 * Narzędzia do obsługi, kompresji i pobierania zdjęć przesyłek / paczek
 */

/**
 * Kompresuje zdjęcie (domyślnie max 1280px, jakość JPEG 0.82) i zwraca jako dataURL (base64).
 * Pozwala to zmniejszyć zdjęcia ze smartfona z 5-10 MB do zaledwie ~100-200 KB,
 * zachowując doskonałą ostrość etykiet kurierskich i szczegółów paczki,
 * bez ryzyka zapełnienia pamięci czy limitu localStorage.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDimension = 1280,
  quality = 0.82
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
          let { width, height } = img;

          // Skalowanie proporcjonalne
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback: zwróć oryginalny dataURL
            resolve(result);
            return;
          }

          // Wygładzanie obrazu
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Eksport do JPEG z kompresją
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch {
          // W razie wyjątku canvasu zwróć oryginalny base64
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
