import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, ShieldCheck, AlertCircle, FileCode, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { downloadKSeFXMLFile, ValidationIssue } from '../utils/ksefGenerator';
import { LogisticsFormat, KSeFSchemaVersion } from '../types/ksef';
import { validateXmlAgainstKSeFXsd, XsdValidationResult } from '../utils/ksefXsdValidator';

interface KSeFXMLModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlContent: string;
  invoiceNumber: string;
  issues: ValidationIssue[];
  logisticsFormat: LogisticsFormat;
  schemaVersion: KSeFSchemaVersion;
  onSchemaVersionChange: (ver: KSeFSchemaVersion) => void;
}

export const KSeFXMLModal: React.FC<KSeFXMLModalProps> = ({
  isOpen,
  onClose,
  xmlContent,
  invoiceNumber,
  issues,
  logisticsFormat,
  schemaVersion,
  onSchemaVersionChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [isValidatingXsd, setIsValidatingXsd] = useState(false);
  const [xsdResult, setXsdResult] = useState<XsdValidationResult | null>(null);

  // Automatyczne uruchomienie walidacji XSD FA(3) przy otwarciu lub zmianie XML
  useEffect(() => {
    if (isOpen && xmlContent) {
      runXsdValidation();
    }
  }, [isOpen, xmlContent]);

  const runXsdValidation = async () => {
    setIsValidatingXsd(true);
    try {
      const res = await validateXmlAgainstKSeFXsd(xmlContent);
      setXsdResult(res);
    } catch (err: any) {
      setXsdResult({
        valid: false,
        schema: 'FA(3) wzór 13775, wersja 1-0E (Ministerstwo Finansów / KSeF)',
        checkedAt: new Date().toLocaleTimeString('pl-PL'),
        errors: [{ message: err.message || 'Błąd wykonania walidacji XSD', rawMessage: String(err) }],
        summary: 'Błąd podczas uruchamiania silnika walidacji.',
      });
    } finally {
      setIsValidatingXsd(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadKSeFXMLFile(xmlContent, invoiceNumber, schemaVersion);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Plik E-Faktury KSeF XML</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-bold">
                  FA(3) – Oficjalna bramka KSeF MF
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Struktura FA(3) (wzór 13775, wersja 1-0E, Ministerstwo Finansów)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runXsdValidation}
              disabled={isValidatingXsd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Ponownie uruchom oficjalny silnik walidacji XSD FA(3)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidatingXsd ? 'animate-spin text-pink-600' : 'text-slate-600'}`} />
              <span>{isValidatingXsd ? 'Walidacja XSD...' : 'Waliduj XSD FA(3)'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-rose-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Skopiowano' : 'Kopiuj XML'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pobierz KSeF XML (FA3)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Informacja o schemacie KSeF FA(3) */}
        <div className="px-6 py-2.5 bg-rose-50/50 border-b border-rose-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>🏛️</span> Obowiązujący schemat:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              FA (3) wersja 1-0E
            </span>
          </div>

          <div className="text-[11px] text-slate-600 font-medium">
            <span>Oficjalny identyfikator CRWDE: <strong className="font-mono text-slate-800">http://crd.gov.pl/wzor/2025/06/25/13775/</strong></span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SEKCJA PRAWDZIWEJ WALIDACJI XSD FA(3)                                 */}
        {/* ===================================================================== */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
          {isValidatingXsd ? (
            <div className="flex items-center gap-2.5 text-xs text-blue-800 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Trwa rzeczywista walidacja XML w silniku libxml2 przeciwko oficjalnemu schematowi XSD FA(3)...</span>
            </div>
          ) : xsdResult ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {xsdResult.valid ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-2xs">
                      <span className="text-base leading-none">🟢</span>
                      <span>XML POPRAWNY — zgodny z XSD FA(3)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-100 border border-red-300 text-red-900 font-bold text-xs shadow-2xs">
                      <span className="text-base leading-none">🔴</span>
                      <span>XML NIEPOPRAWNY — niezgodny z XSD FA(3)</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                  <span>Schemat: FA(3) 13775 / 1-0E</span>
                  <span>·</span>
                  <span>Sprawdzono: {xsdResult.checkedAt}</span>
                  {xsdResult.durationMs !== undefined && (
                    <>
                      <span>·</span>
                      <span>{xsdResult.durationMs} ms</span>
                    </>
                  )}
                </div>
              </div>

              {/* Informacja przy wyniku poprawnym */}
              {xsdResult.valid && (
                <div className="mt-2 text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Plik pomyślnie przeszedł pełną walidację strukturalną i typologiczną oficjalnego schematu FA(3).</span>
                </div>
              )}

              {/* Szczegółowa lista błędów przy wyniku niepoprawnym */}
              {!xsdResult.valid && xsdResult.errors.length > 0 && (
                <div className="mt-3 bg-red-50/80 border border-red-200 rounded-xl p-3 max-h-44 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-red-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                      Wykryto {xsdResult.errors.length} błędów walidacji XSD FA(3):
                    </span>
                  </div>

                  <div className="space-y-2">
                    {xsdResult.errors.map((err, idx) => (
                      <div key={idx} className="bg-white/90 border border-red-200 rounded-lg p-2.5 text-xs font-mono text-slate-800 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] text-red-700 font-semibold mb-1">
                          <span>Błąd #{idx + 1} {err.lineNumber ? `· Linia XML: ${err.lineNumber}` : ''}</span>
                          {err.element && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                              Tag: &lt;{err.element}&gt;
                            </span>
                          )}
                        </div>
                        <p className="text-red-900 font-medium text-[11px] mb-1">
                          {err.message}
                        </p>
                        {err.expected && (
                          <p className="text-slate-600 text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200">
                            <strong>Oczekiwano wg schematu:</strong> {err.expected}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>Kliknij &quot;Waliduj XSD FA(3)&quot;, aby uruchomić weryfikację libxml2.</span>
            </div>
          )}
        </div>

        {/* XML Viewer Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200 select-text">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed">
            <code>{xmlContent}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Silnik walidacji: <strong>libxml2 (xmllint-wasm)</strong> · Schemat XSD: <strong>FA(3) wzór 13775 wersja 1-0E</strong>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

