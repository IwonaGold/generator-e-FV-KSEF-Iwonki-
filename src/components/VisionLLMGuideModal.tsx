import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, Code, KeyRound, Cpu, Layers } from 'lucide-react';

interface VisionLLMGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisionLLMGuideModal: React.FC<VisionLLMGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'gemini' | 'openai' | 'claude'>('gemini');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const geminiCode = `import { GoogleGenAI, Type } from '@google/genai';
import { OcrExtractionResult } from '../types/ksef';
import { fileToBase64 } from './aiVisionOCR';

// Inicjalizacja z oficjalnym SDK @google/genai
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function processImagesWithAI(images: File[]): Promise<OcrExtractionResult[]> {
  const results: OcrExtractionResult[] = [];

  for (const image of images) {
    const base64Data = await fileToBase64(image);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: "Przeanalizuj etykietę leku farmaceutycznego. Wyodrębnij:\\n" +
                    "- batchNumber (Numer serii / LOT / Seria)\\n" +
                    "- expiryDate (Data ważności w formacie RRRR-MM-DD)\\n" +
                    "- gtin (kod EAN/GTIN 13-14 cyfr)\\n" +
                    "Zwróć wynik jako JSON.",
            },
            {
              inlineData: {
                mimeType: image.type,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    results.push({
      fileName: image.name,
      batchNumber: parsed.batchNumber || '',
      expiryDate: parsed.expiryDate || '',
      gtin: parsed.gtin || '',
      confidence: 0.96,
      rawText: response.text || '',
    });
  }

  return results;
}`;

  const openaiCode = `import { OcrExtractionResult } from '../types/ksef';
import { fileToBase64 } from './aiVisionOCR';

export async function processImagesWithAI(images: File[]): Promise<OcrExtractionResult[]> {
  const results: OcrExtractionResult[] = [];

  for (const image of images) {
    const base64 = await fileToBase64(image);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem OCR w farmacji. Zwracaj JSON: { batchNumber, expiryDate, gtin }',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Odczytaj numer serii i datę ważności z tego zdjęcia opakowania leku.' },
              {
                type: 'image_url',
                image_url: { url: \`data:\${image.type};base64,\${base64}\` },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    results.push({
      fileName: image.name,
      batchNumber: content.batchNumber,
      expiryDate: content.expiryDate,
      gtin: content.gtin,
      confidence: 0.95,
    });
  }

  return results;
}`;

  const currentSnippet = activeTab === 'gemini' ? geminiCode : openaiCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Podłączenie Vision LLM do funkcji processImagesWithAI()
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Lokalizacja pliku: /src/utils/aiVisionOCR.ts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="px-6 pt-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('gemini')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'gemini'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Google Gemini 2.5 Flash (Zainstalowany SDK)
            </button>
            <button
              onClick={() => setActiveTab('openai')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'openai'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              OpenAI GPT-4o Vision REST API
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer mb-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Skopiowano kod' : 'Kopiuj kod'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <p className="font-semibold text-slate-900 mb-1">Jak działa OCR w tej aplikacji:</p>
            <p>
              W pliku <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">src/utils/aiVisionOCR.ts</code> przygotowaliśmy
              funkcję <code className="text-emerald-700 font-bold">processImagesWithAI(images: File[])</code>. Obecnie działa tam inteligentna
              symulacja, która natychmiast przypisuje numery serii i terminy ważności do pozycji leków. Aby podpiąć swój klucz produkcyjny, wystarczy wkleić poniższy kod do tego pliku.
            </p>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto">
            <pre>{currentSnippet}</pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Rozumiem, wróć do aplikacji
          </button>
        </div>
      </div>
    </div>
  );
};
