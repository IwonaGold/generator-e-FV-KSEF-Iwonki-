import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, Check, RotateCw, Contrast, Sparkles, Crosshair } from 'lucide-react';
import { prepareCanvasFragment } from '../utils/twoStageOcrService';

interface PhotoZoomCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  photoFile: File;
  productName: string;
  onConfirmCropOcr: (cropArea: { x: number; y: number; width: number; height: number }) => void;
}

export const PhotoZoomCropModal: React.FC<PhotoZoomCropModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  photoFile,
  productName,
  onConfirmCropOcr,
}) => {
  // Procentowe położenie i rozmiar ramki: x (0..100), y (0..100), width (10..100), height (10..100)
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 20,
    y: 50,
    width: 55,
    height: 18,
  });

  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isProcessingPreview, setIsProcessingPreview] = useState<boolean>(false);

  // Aktualizacja powiększonego podglądu Canvas po zmianie ramki
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsProcessingPreview(true);

    const timer = setTimeout(async () => {
      try {
        const { dataUrl } = await prepareCanvasFragment(photoFile, cropArea);
        if (active) {
          setPreviewDataUrl(dataUrl);
          setIsProcessingPreview(false);
        }
      } catch (err) {
        if (active) setIsProcessingPreview(false);
      }
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cropArea, photoFile, isOpen]);

  if (!isOpen) return null;

  const presets = [
    { label: 'Środkowa ścianka / Klapa (czarny nadruk LOT / BBE)', area: { x: 20, y: 50, width: 55, height: 18 } },
    { label: 'Całe zdjęcie (biała naklejka LOT / MHD / MDH)', area: { x: 0, y: 0, width: 100, height: 100 } },
    { label: 'Spód opakowania (tusz inkjet)', area: { x: 5, y: 60, width: 90, height: 35 } },
    { label: 'Okolice kodu kreskowego', area: { x: 45, y: 25, width: 50, height: 60 } },
    { label: 'Bok / Etykieta', area: { x: 5, y: 20, width: 90, height: 50 } },
    { label: 'Góra opakowania', area: { x: 5, y: 5, width: 90, height: 40 } },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Nagłówek */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <ZoomIn className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Powiększenie i Analiza Fragmentu Zdjęcia
              </h3>
              <p className="text-xs text-slate-500">
                Produkt: <span className="font-semibold text-slate-800">{productName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ciało modala */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Szybkie presety stref */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
              Szybkie strefy farmaceutyczne (kliknij strefę, w której znajduje się nadruk LOT / MHD / MDH / BBE):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCropArea(p.area)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dwa panele: Oryginał z ramką oraz Powiększony podgląd z kontrastem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Panel 1: Oryginał z zaznaczeniem */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">
                1. Oryginalne zdjęcie (obszar analizy):
              </span>
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 aspect-4/3 flex items-center justify-center">
                <img
                  src={photoUrl}
                  alt="Oryginał"
                  className="w-full h-full object-contain"
                />

                {/* Ramka zaznaczenia */}
                <div
                  className="absolute border-2 border-emerald-400 bg-emerald-500/20 shadow-lg pointer-events-none transition-all"
                  style={{
                    left: `${cropArea.x}%`,
                    top: `${cropArea.y}%`,
                    width: `${cropArea.width}%`,
                    height: `${cropArea.height}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Obszar LOT / MHD / BBE
                  </span>
                </div>
              </div>

              {/* Suwaki precyzyjnej regulacji */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <label className="text-slate-500 block">Pozycja pozioma X ({cropArea.x}%):</label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={cropArea.x}
                    onChange={(e) =>
                      setCropArea((prev) => ({ ...prev, x: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">Szerokość obszaru ({cropArea.width}%):</label>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    value={cropArea.width}
                    onChange={(e) =>
                      setCropArea((prev) => ({ ...prev, width: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">Pozycja pionowa Y ({cropArea.y}%):</label>
                  <input
                    type="range"
                    min="0"
                    max="85"
                    value={cropArea.y}
                    onChange={(e) =>
                      setCropArea((prev) => ({ ...prev, y: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">Wysokość obszaru ({cropArea.height}%):</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={cropArea.height}
                    onChange={(e) =>
                      setCropArea((prev) => ({ ...prev, height: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Panel 2: Powiększony fragment poddany obróbce kontrastowej */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                <Contrast className="w-3.5 h-3.5 text-emerald-600" />
                2. Powiększony fragment z adaptacyjnym kontrastem (wejście OCR):
              </span>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 aspect-4/3 flex items-center justify-center relative shadow-inner">
                {isProcessingPreview ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Przygotowywanie powiększenia...</span>
                  </div>
                ) : previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Powiększenie"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Brak podglądu</span>
                )}
              </div>

              <div className="text-[11px] text-slate-500 bg-emerald-50/60 border border-emerald-200/80 p-2 rounded-lg">
                💡 <strong>Wskazówka:</strong> Filtr automatycznie rozpoznaje białe naklejki (LOT / MHD / MDH) oraz wyodrębnia czarny nadruk punktowy na ciemnych/kolorowych ściankach opakowań (LOT / BBE).
              </div>
            </div>
          </div>
        </div>

        {/* Pasek akcji na dole */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Anuluj
          </button>

          <button
            onClick={() => {
              onConfirmCropOcr(cropArea);
              onClose();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Odczytaj LOT oraz MHD / BBE z tego fragmentu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
