import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Code2,
  Copy,
  Check,
  Send,
  ShieldAlert,
  Server,
  KeyRound,
  FileCheck,
  Layers,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { KSeFSchemaVersion } from '../types/ksef';

interface KSeFDirectApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlContent: string;
  invoiceNumber: string;
  sellerNip: string;
  schemaVersion: KSeFSchemaVersion;
}

export const KSeFDirectApiModal: React.FC<KSeFDirectApiModalProps> = ({
  isOpen,
  onClose,
  xmlContent,
  invoiceNumber,
  sellerNip,
  schemaVersion,
}) => {
  const [activeTab, setActiveTab] = useState<'portal' | 'code' | 'curl'>('portal');
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<'test' | 'demo' | 'prod'>('test');

  if (!isOpen) return null;

  const envUrls = {
    test: 'https://ksef-test.mf.gov.pl/api',
    demo: 'https://ksef-demo.mf.gov.pl/api',
    prod: 'https://ksef.mf.gov.pl/api',
  };

  const portalUrls = {
    test: 'https://ksef-test.mf.gov.pl/web/',
    demo: 'https://ksef-demo.mf.gov.pl/web/',
    prod: 'https://ksef.podatki.gov.pl/web/',
  };

  const tsCodeSnippet = `/**
 * Skrypt wysyłki faktury do Krajowego Systemu e-Faktur (KSeF API REST v2)
 * Środowisko: ${selectedEnv.toUpperCase()} (${envUrls[selectedEnv]})
 * Wersja schemy: ${schemaVersion === 'FA2' ? 'FA (2) - wzór 12648' : 'FA (3) - wzór 13775'}
 */

import crypto from 'crypto';

const KSEF_API_URL = '${envUrls[selectedEnv]}';
const SELLER_NIP = '${sellerNip || '9571106742'}';
const KSEF_TOKEN = 'TWÓJ_TOKEN_AUTORYZACYJNY_Z_APLIKACJI_PODATNIKA';

// 1. Treść faktury XML wygenerowana w generatorze
const invoiceXmlString = \`${xmlContent.slice(0, 300)}... (pełny XML faktury)\`;

async function sendInvoiceToKSeF() {
  console.log('--- 1. Pobieranie Authorization Challenge ---');
  const challengeRes = await fetch(\`\${KSEF_API_URL}/online/Session/AuthorisationChallenge\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextIdentifier: {
        type: 'onip',
        identifier: SELLER_NIP
      }
    })
  });
  const challengeData = await challengeRes.json();
  const { challenge, timestamp } = challengeData;
  console.log('Otrzymano Challenge:', challenge);

  console.log('--- 2. Inicjalizacja sesji z tokenem (InitToken) ---');
  // W KSeF token łączy się z timestampem challenge i szyfruje kluczem publicznym MF
  // format: \`\${KSEF_TOKEN}|\${timestamp}\`
  const initSessionRes = await fetch(\`\${KSEF_API_URL}/online/Session/InitToken\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      InitSessionTokenRequest: {
        context: {
          contextIdentifier: { type: 'onip', identifier: SELLER_NIP }
        },
        identifier: { type: 'onip', identifier: SELLER_NIP },
        token: Buffer.from(KSEF_TOKEN).toString('base64') // lub szyfrowany RSA
      }
    })
  });
  const sessionData = await initSessionRes.json();
  const sessionToken = sessionData.sessionToken?.token;
  console.log('Sesja KSeF aktywna:', sessionData.referenceNumber);

  console.log('--- 3. Wysyłka e-faktury (PUT /online/Invoice/Send) ---');
  const xmlBuffer = Buffer.from(invoiceXmlString, 'utf-8');
  const invoiceHash = crypto.createHash('sha256').update(xmlBuffer).digest('base64');

  const sendRes = await fetch(\`\${KSEF_API_URL}/online/Invoice/Send\`, {
    method: 'PUT',
    headers: {
      'SessionToken': sessionToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      invoiceHash: {
        fileSize: xmlBuffer.length,
        hashSHA: {
          algorithm: 'SHA-256',
          encoding: 'Base64',
          value: invoiceHash
        }
      },
      invoicePayload: {
        type: 'plain',
        invoiceBody: xmlBuffer.toString('base64')
      }
    })
  });
  const sendResult = await sendRes.json();
  const elementRef = sendResult.elementReferenceNumber;
  console.log('Faktura przesłana do kolejki KSeF! Ref:', elementRef);

  console.log('--- 4. Odpytanie o status i pobranie UPO ---');
  const statusRes = await fetch(\`\${KSEF_API_URL}/common/Status/\${elementRef}\`, {
    headers: { 'SessionToken': sessionToken }
  });
  const statusData = await statusRes.json();
  console.log('Status faktury KSeF:', statusData);
  // Kod 200 = Faktura przyjęta, otrzymano unikalny KSeF ID (35 znaków) i UPO
}

sendInvoiceToKSeF().catch(console.error);
`;

  const curlSnippet = `# 1. Pobranie Authorisation Challenge
curl -X POST "${envUrls[selectedEnv]}/online/Session/AuthorisationChallenge" \\
  -H "Content-Type: application/json" \\
  -d '{"contextIdentifier":{"type":"onip","identifier":"${sellerNip || '9571106742'}"}}'

# 2. Sprawdzenie statusu sesji i przetworzenia dokumentu
curl -X GET "${envUrls[selectedEnv]}/online/Invoice/Status/{nr_referencyjny}" \\
  -H "SessionToken: {twój_session_token}"
`;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Bezpośrednie wgranie faktury do KSeF (Ministerstwo Finansów)</span>
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Wytyczne kodu API REST v2 oraz instrukcja portalu Aplikacja Podatnika KSeF
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

        {/* Environment Selector */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Środowisko KSeF:</span>
            <div className="inline-flex bg-white rounded-lg p-0.5 border border-slate-300">
              <button
                onClick={() => setSelectedEnv('test')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedEnv === 'test'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Testowe (ksef-test)
              </button>
              <button
                onClick={() => setSelectedEnv('demo')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedEnv === 'demo'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Przedprodukcyjne (Demo)
              </button>
              <button
                onClick={() => setSelectedEnv('prod')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedEnv === 'prod'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Produkcyjne (ksef.podatki.gov.pl)
              </button>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Endpoint bazowy: <strong className="text-slate-700">{envUrls[selectedEnv]}</strong>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('portal')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'portal'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>1. Przez Aplikację Podatnika KSeF (Bez kodu)</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'code'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>2. Kod Node.js / TypeScript (API REST)</span>
          </button>
          <button
            onClick={() => setActiveTab('curl')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'curl'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>3. Polecenia cURL / Postman</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {activeTab === 'portal' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                <h4 className="font-bold text-blue-950 mb-1 text-sm">
                  Jak wgrać plik bezpośrednio do KSeF przez portal Ministerstwa Finansów:
                </h4>
                <p className="text-slate-600">
                  Ministerstwo Finansów udostępnia oficjalną bezpłatną aplikację webową (Aplikacja Podatnika KSeF).
                  Możesz załadować pobrany z naszego generatora plik XML w 3 prostych krokach:
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <h5 className="font-bold text-slate-900">
                      Zaloguj się do Aplikacji Podatnika KSeF
                    </h5>
                    <p className="text-slate-500 mt-0.5">
                      Wejdź na stronę oficjalną Ministerstwa Finansów i zaloguj się za pomocą Profilu Zaufanego, podpisu kwalifikowanego lub pieczęci elektronicznej firmy:
                    </p>
                    <a
                      href={portalUrls[selectedEnv]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                    >
                      <span>Otwórz Aplikację Podatnika KSeF ({selectedEnv.toUpperCase()})</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <h5 className="font-bold text-slate-900">
                      Przejdź do menu: Faktury → Wczytaj fakturę (lub Dodaj fakturę)
                    </h5>
                    <p className="text-slate-500 mt-0.5">
                      Wybierz opcję <strong>„Wczytaj fakturę”</strong> z dysku komputera i wskaż pobrany z naszego generatora plik <strong>KSeF_FA2_{invoiceNumber.replace(/[\/\\]/g, '_') || 'FAKTURA'}.xml</strong>.
                    </p>
                    <div className="mt-2 p-2 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-900">
                      ✓ Plik zawiera prawidłową przestrzeń <code>http://crd.gov.pl/wzor/2023/06/29/12648/</code> oraz strukturę z numerami serii i datami ważności.
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <h5 className="font-bold text-slate-900">
                      Weryfikacja podglądu i kliknięcie „Wystaw fakturę”
                    </h5>
                    <p className="text-slate-500 mt-0.5">
                      System KSeF dokona natychmiastowej walidacji semantycznej, nada 35-znakowy unikalny numer KSeF i wygeneruje pobieralne UPO (Urzędowe Poświadczenie Odbioru).
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning about NIP match */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Ważny wymóg identyfikacyjny:</strong>
                  NIP Sprzedawcy na fakturze (<code>{sellerNip || '9571106742'}</code>) musi być tożsamy z NIP-em podmiotu, w imieniu którego użytkownik zalogował się do bramki KSeF. Jeśli logujesz się jako osoba fizyczna, upewnij się, że posiadasz upoważnienie ZAW-FA dla spółki Eubiosis.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">
                    Oficjalne API REST KSeF v2 (Ministerstwo Finansów)
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Proces 4-krokowy: AuthorisationChallenge → InitToken → Invoice/Send → Status UPO
                  </p>
                </div>

                <button
                  onClick={() => handleCopyCode(tsCodeSnippet)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Skopiowano kod' : 'Kopiuj kod TypeScript'}</span>
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl overflow-x-auto font-mono text-[11px] text-slate-200 leading-relaxed max-h-[380px]">
                <pre>{tsCodeSnippet}</pre>
              </div>
            </div>
          )}

          {activeTab === 'curl' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900">
                  Wywołania terminalowe cURL
                </h4>
                <button
                  onClick={() => handleCopyCode(curlSnippet)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Kopiuj cURL</span>
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl overflow-x-auto font-mono text-[11px] text-slate-200 leading-relaxed">
                <pre>{curlSnippet}</pre>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Oficjalna dokumentacja Swagger / OpenAPI Ministerstwa Finansów:</p>
                <p>
                  Pełna specyfikacja Swaggera dla środowiska testowego dostępna jest pod adresem:{' '}
                  <a
                    href="https://ksef-test.mf.gov.pl/api/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline font-mono"
                  >
                    https://ksef-test.mf.gov.pl/api/index.html
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <span>
              Krajowy System e-Faktur · Zgodność z API REST v2 Ministerstwa Finansów RP
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
