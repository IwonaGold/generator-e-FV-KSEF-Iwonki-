import React, { useState } from 'react';
import { PharmacyChain, EntityDetails, InvoiceMeta, ThirdPartyEntity } from '../types/ksef';
import { PHARMACY_CHAINS } from '../utils/sampleData';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  CreditCard,
  FileCheck2,
  Sliders,
  Warehouse,
} from 'lucide-react';

interface Step2InvoiceDetailsProps {
  selectedChain: PharmacyChain;
  onSelectChain: (chain: PharmacyChain) => void;
  seller: EntityDetails;
  onUpdateSeller: (seller: EntityDetails) => void;
  buyer: EntityDetails;
  onUpdateBuyer: (buyer: EntityDetails) => void;
  thirdParty?: ThirdPartyEntity | null;
  onUpdateThirdParty?: (thirdParty: ThirdPartyEntity | null) => void;
  meta: InvoiceMeta;
  onUpdateMeta: (meta: InvoiceMeta) => void;
  onLoadPresetDrMax: () => void;
  onLoadPresetDoz: () => void;
  onLoadPresetSuperPharm?: () => void;
}

export const Step2InvoiceDetails: React.FC<Step2InvoiceDetailsProps> = ({
  selectedChain,
  onSelectChain,
  seller,
  onUpdateSeller,
  buyer,
  onUpdateBuyer,
  thirdParty,
  onUpdateThirdParty,
  meta,
  onUpdateMeta,
  onLoadPresetDrMax,
  onLoadPresetDoz,
  onLoadPresetSuperPharm,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const chainProfile = PHARMACY_CHAINS[selectedChain] || PHARMACY_CHAINS.Custom;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
              2
            </span>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              Krok 2: Dane na Fakturze KSeF (Nagłówek i Strony Transakcji)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Numer faktury, miejsce wystawienia, data dostawy, dane zamówienia i nabywcy
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium mr-1">Wzorce z faktur:</span>
          <button
            onClick={onLoadPresetSuperPharm}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
            title="Załaduj wzorzec z faktury 35/2026/KSEF (Super-Pharm)"
          >
            <span>FV 35/2026 (Super-Pharm)</span>
          </button>
          <button
            onClick={onLoadPresetDrMax}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <span>FV 41/2026 (Dr. Max)</span>
          </button>
          <button
            onClick={onLoadPresetDoz}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <span>FV 40/2026 (DOZ)</span>
          </button>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        {/* Nabywca / Sieć apteczna */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Nabywca / Sieć Apteczna
          </label>
          <div className="relative">
            <select
              value={selectedChain}
              onChange={(e) => onSelectChain(e.target.value as PharmacyChain)}
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 pr-8 appearance-none focus:outline-none focus:border-emerald-600"
            >
              <option value="Dr. Max">Dr. Max (Dr. Max Lekomat Sp. z o.o.)</option>
              <option value="DOZ">DOZ (DOZ S.A. Direct Sp. k.)</option>
              <option value="Gemini">Gemini (Gemini Polska Sp. z o.o.)</option>
              <option value="Super-Pharm">Super-Pharm Poland Sp. z o.o.</option>
              <option value="Custom">Inna apteka (własne dane)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>
          <span className="text-[11px] text-slate-500 truncate block mt-1">
            NIP: {buyer.nip}
          </span>
        </div>

        {/* Numer faktury */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Numer faktury (P_2) & Typ
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={meta.invoiceNumber}
              onChange={(e) => onUpdateMeta({ ...meta, invoiceNumber: e.target.value })}
              placeholder="41/2026/KSEF"
              className="w-full text-xs font-mono font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
            />
            <input
              type="text"
              readOnly
              value="Faktura podstawowa"
              className="w-full text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 cursor-not-allowed text-center"
            />
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            KSeF ID: {meta.ksefNumber ? meta.ksefNumber.slice(0, 16) + '...' : 'Generowane'}
          </span>
        </div>

        {/* Daty: P_1 & P_6 */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Data wystawienia & Dostawy
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="date"
              value={meta.issueDate}
              onChange={(e) => onUpdateMeta({ ...meta, issueDate: e.target.value })}
              className="w-full text-xs font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
              title="Data wystawienia (P_1)"
            />
            <input
              type="date"
              value={meta.deliveryDate}
              onChange={(e) => onUpdateMeta({ ...meta, deliveryDate: e.target.value })}
              className="w-full text-xs font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
              title="Data dokonania lub zakończenia dostawy (P_6)"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>P_1: Wystawienie</span>
            <span>P_6: Dostawa</span>
          </div>
        </div>

        {/* Zamówienie: Numer & Data złożenia */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Zamówienie: Numer & Data złożenia
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={meta.orderNumber || ''}
              onChange={(e) => onUpdateMeta({ ...meta, orderNumber: e.target.value })}
              placeholder="np. C008848894"
              className="w-full text-xs font-mono font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
              title="Numer zamówienia (NrZamowienia)"
            />
            <input
              type="date"
              value={meta.orderDate || ''}
              onChange={(e) => onUpdateMeta({ ...meta, orderDate: e.target.value })}
              className="w-full text-xs font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
              title="Data złożenia zamówienia (DataZamowienia)"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>Nr: {meta.orderNumber || 'Brak'}</span>
            <span>Data zam: {meta.orderDate || 'Brak'}</span>
          </div>
        </div>

        {/* Płatność: Termin & Dni */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Termin płatności & Dni
          </label>
          <div>
            <input
              type="date"
              value={meta.dueDate}
              onChange={(e) => onUpdateMeta({ ...meta, dueDate: e.target.value })}
              className="w-full text-xs font-mono font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
              title="Termin płatności (Termin)"
            />
            <div className="flex items-center justify-between mt-1 text-[10px]">
              <span className="text-slate-500">Szybki termin:</span>
              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    const baseStr = meta.deliveryDate || meta.issueDate || meta.orderDate;
                    const b = baseStr ? new Date(baseStr) : new Date();
                    b.setDate(b.getDate() + 30);
                    onUpdateMeta({ ...meta, dueDate: b.toISOString().slice(0, 10), paymentDays: 30 });
                  }}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    meta.paymentDays === 30 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="30 dni od daty dostawy"
                >
                  30d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseStr = meta.deliveryDate || meta.issueDate || meta.orderDate;
                    const b = baseStr ? new Date(baseStr) : new Date();
                    b.setDate(b.getDate() + 45);
                    onUpdateMeta({ ...meta, dueDate: b.toISOString().slice(0, 10), paymentDays: 45 });
                  }}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    meta.paymentDays === 45 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="45 dni od daty dostawy"
                >
                  45d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseStr = meta.deliveryDate || meta.issueDate || meta.orderDate;
                    const b = baseStr ? new Date(baseStr) : new Date();
                    b.setDate(b.getDate() + 60);
                    onUpdateMeta({ ...meta, dueDate: b.toISOString().slice(0, 10), paymentDays: 60 });
                  }}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    meta.paymentDays === 60 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="60 dni od daty dostawy"
                >
                  60d
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced drawer toggle */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span>Sprzedawca: <strong>{seller.name}</strong></span>
          <span>·</span>
          <span>BDO: <strong>{seller.bdoNumber || '000585744'}</strong></span>
          <span>·</span>
          <span>Bank: <strong>{seller.bankName || 'ERSTE BANK POLSKA S.A.'}</strong></span>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 py-1 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <span>Dane podmiotów, BDO i konta</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Advanced Drawer */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Sprzedawca */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                Sprzedawca (Podmiot 1 - Eubiosis)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Dostawca / Hurtownia</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">Pełna nazwa spółki</label>
                <input
                  type="text"
                  value={seller.name}
                  onChange={(e) => onUpdateSeller({ ...seller, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">NIP (10 cyfr)</label>
                  <input
                    type="text"
                    value={seller.nip}
                    maxLength={10}
                    onChange={(e) => onUpdateSeller({ ...seller, nip: e.target.value.replace(/\D/g, '') })}
                    className="w-full font-mono bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Numer BDO</label>
                  <input
                    type="text"
                    value={seller.bdoNumber || ''}
                    placeholder="000585744"
                    onChange={(e) => onUpdateSeller({ ...seller, bdoNumber: e.target.value })}
                    className="w-full font-mono bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Miejscowość</label>
                  <input
                    type="text"
                    value={seller.city}
                    onChange={(e) => onUpdateSeller({ ...seller, city: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Adres</label>
                  <input
                    type="text"
                    value={seller.addressLine1}
                    onChange={(e) => onUpdateSeller({ ...seller, addressLine1: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Kod pocztowy</label>
                  <input
                    type="text"
                    value={seller.postalCode}
                    onChange={(e) => onUpdateSeller({ ...seller, postalCode: e.target.value })}
                    className="w-full font-mono bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Nazwa Banku</label>
                  <input
                    type="text"
                    value={seller.bankName || ''}
                    placeholder="ERSTE BANK POLSKA S.A."
                    onChange={(e) => onUpdateSeller({ ...seller, bankName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Numer konta (NrRB)</label>
                  <input
                    type="text"
                    value={seller.bankAccount || ''}
                    placeholder="96 1090 1098..."
                    onChange={(e) => onUpdateSeller({ ...seller, bankAccount: e.target.value })}
                    className="w-full font-mono text-[11px] bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Nabywca */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Nabywca (Podmiot 2 - Apteka / Sieć)
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">{chainProfile.name}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">Nazwa spółki nabywcy</label>
                <input
                  type="text"
                  value={buyer.name}
                  onChange={(e) => onUpdateBuyer({ ...buyer, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">NIP Nabywcy (10 cyfr)</label>
                  <input
                    type="text"
                    value={buyer.nip}
                    maxLength={10}
                    onChange={(e) => onUpdateBuyer({ ...buyer, nip: e.target.value.replace(/\D/g, '') })}
                    className="w-full font-mono bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Miejscowość</label>
                  <input
                    type="text"
                    value={buyer.city}
                    onChange={(e) => onUpdateBuyer({ ...buyer, city: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Adres</label>
                  <input
                    type="text"
                    value={buyer.addressLine1}
                    onChange={(e) => onUpdateBuyer({ ...buyer, addressLine1: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Kod pocztowy</label>
                  <input
                    type="text"
                    value={buyer.postalCode}
                    onChange={(e) => onUpdateBuyer({ ...buyer, postalCode: e.target.value })}
                    className="w-full font-mono bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Termin płatności</label>
                  <input
                    type="date"
                    value={meta.dueDate}
                    onChange={(e) => onUpdateMeta({ ...meta, dueDate: e.target.value })}
                    className="w-full font-mono text-[11px] bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Forma płatności</label>
                  <select
                    value={meta.paymentMethod}
                    onChange={(e) => onUpdateMeta({ ...meta, paymentMethod: e.target.value as any })}
                    className="w-full text-[11px] bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  >
                    <option value="przelew">Przelew bankowy (kod 6)</option>
                    <option value="gotowka">Gotówka (kod 1)</option>
                    <option value="karta">Karta płatnicza (kod 2)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Podmiot 3 - Odbiorca / Oddział wewnętrzny (np. Magazyn Centralny Super Pharm) */}
          <div className="md:col-span-2 bg-purple-50/60 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-200">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-purple-700" />
                Podmiot inny 1 (Podmiot 3 w KSeF – Odbiorca / Magazyn Centralny)
              </span>
              <span className="text-[11px] text-purple-700 font-medium">
                {thirdParty ? 'Aktywny (zgodnie z wzorcem faktury 35/2026)' : 'Opcjonalny (brak)'}
              </span>
            </div>

            {thirdParty ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-purple-800 block mb-0.5 font-medium">Nazwa odbiorcy / oddziału</label>
                  <input
                    type="text"
                    value={thirdParty.name}
                    onChange={(e) =>
                      onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, name: e.target.value })
                    }
                    className="w-full bg-white border border-purple-300 rounded px-2.5 py-1 text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-purple-800 block mb-0.5 font-medium">ID wewnętrzny (ID-Wew)</label>
                  <input
                    type="text"
                    value={thirdParty.idWew || ''}
                    onChange={(e) =>
                      onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, idWew: e.target.value })
                    }
                    placeholder="np. 5213842837-54936"
                    className="w-full font-mono bg-white border border-purple-300 rounded px-2.5 py-1 text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-purple-800 block mb-0.5 font-medium">Adres magazynu / dostawy</label>
                  <input
                    type="text"
                    value={thirdParty.addressLine1}
                    onChange={(e) =>
                      onUpdateThirdParty && onUpdateThirdParty({ ...thirdParty, addressLine1: e.target.value })
                    }
                    placeholder="np. Aleja 20-lecia 23, 96-515 Teresin"
                    className="w-full bg-white border border-purple-300 rounded px-2.5 py-1 text-slate-800 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Faktury dla Super-Pharm zawierają jednostkę wewnętrzną: <strong>Magazyn Centralny Teresin (ID-Wew: 5213842837-54936)</strong>.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateThirdParty &&
                    onUpdateThirdParty({
                      idWew: '5213842837-54936',
                      name: 'Magazyn Centralny Super Pharm Holding',
                      countryCode: 'PL',
                      addressLine1: 'Aleja 20-lecia 23, 96-515 Teresin',
                      role: '2',
                      roleDescription: 'Odbiorca (jednostka wewnętrzna/oddział nabywcy)',
                    })
                  }
                  className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-white border border-purple-300 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                >
                  Dodaj dane Magazynu Centralnego
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
