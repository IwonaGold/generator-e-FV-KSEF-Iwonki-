import React, { useState } from 'react';
import {
  SpatialWarehouse,
  WarehouseRack,
  WarehouseLocationSlot,
  ProductCatalogItem,
} from '../types/wms';
import { isEligibleForPartner12Months } from '../utils/wfirmaParser';
import { Eye, Box, Layers, Compass, Sparkles } from 'lucide-react';

interface Warehouse3DVisualizerProps {
  warehouse: SpatialWarehouse;
  racks: WarehouseRack[];
  slots: WarehouseLocationSlot[];
  productMap: Map<string, ProductCatalogItem>;
  selectedSlotId: string | null;
  slotMatchesSearch: (slot: WarehouseLocationSlot) => boolean;
  filterZone: 'ALL' | 'picking' | 'pallet' | 'short_mhd' | 'custom_items';
  onSelectSlot: (slot: WarehouseLocationSlot) => void;
}

/**
 * Rysuje realistyczną paletę EURO 3D wraz z ułożonymi na niej kartonami 3D (lub skrzynią dla rzeczy opisanych ręcznie).
 * Im większe zapełnienie miejsca, tym więcej kartonów stoi na drewnianej palecie!
 */
export const EuroPallet3DSvg: React.FC<{
  isEmpty: boolean;
  fillPercent: number;
  boxColor: 'emerald' | 'violet' | 'blue' | 'amber' | 'rose';
  isCustomItem: boolean;
  hasShortDate: boolean;
}> = ({ isEmpty, fillPercent, boxColor, isCustomItem, hasShortDate }) => {
  const paletteColors = {
    emerald: { top: '#34d399', left: '#10b981', right: '#059669', stroke: '#047857', tape: '#a7f3d0' },
    violet: { top: '#a78bfa', left: '#8b5cf6', right: '#6d28d9', stroke: '#5b21b6', tape: '#ddd6fe' },
    blue: { top: '#60a5fa', left: '#3b82f6', right: '#1d4ed8', stroke: '#1e40af', tape: '#bfdbfe' },
    amber: { top: '#fbbf24', left: '#f59e0b', right: '#b45309', stroke: '#92400e', tape: '#fde68a' },
    rose: { top: '#fb7185', left: '#f43f5e', right: '#be123c', stroke: '#9f1239', tape: '#fecdd3' },
  };

  const c = hasShortDate
    ? paletteColors.amber
    : isCustomItem
    ? paletteColors.amber
    : paletteColors[boxColor];

  // Funkcja rysująca pojedynczy izometryczny karton 3D w punkcie (cx, cy)
  const renderIsoBox = (cx: number, cy: number, w = 24, h = 15, key: string) => {
    const dx = w / 2;
    const dy = 5;
    // Ścianka górna
    const topPts = `${cx},${cy - dy * 2} ${cx + dx},${cy - dy} ${cx},${cy} ${cx - dx},${cy - dy}`;
    // Ścianka lewa
    const leftPts = `${cx - dx},${cy - dy} ${cx},${cy} ${cx},${cy + h} ${cx - dx},${cy - dy + h}`;
    // Ścianka prawa
    const rightPts = `${cx},${cy} ${cx + dx},${cy - dy} ${cx + dx},${cy - dy + h} ${cx},${cy + h}`;
    // Taśma pakowa na górze
    const tapePts = `${cx - dx * 0.5},${cy - dy * 1.5} ${cx + dx * 0.5},${cy - dy * 0.5}`;

    return (
      <g key={key}>
        <polygon points={leftPts} fill={c.left} stroke={c.stroke} strokeWidth="0.9" />
        <polygon points={rightPts} fill={c.right} stroke={c.stroke} strokeWidth="0.9" />
        <polygon points={topPts} fill={c.top} stroke={c.stroke} strokeWidth="0.9" />
        <line x1={cx - dx * 0.45} y1={cy - dy * 1.45} x2={cx + dx * 0.45} y2={cy - dy * 0.55} stroke={c.tape} strokeWidth="2" />
        {/* Etykieta logistyczna na boku kartonu */}
        <rect x={cx + 3} y={cy + 2} width={5} height={4} fill="#ffffff" opacity="0.85" rx="0.5" />
      </g>
    );
  };

  const layersCount = isEmpty ? 0 : fillPercent > 60 ? 3 : fillPercent > 25 ? 2 : 1;

  return (
    <svg viewBox="0 0 120 76" className="w-full h-16 overflow-visible select-none">
      {/* Tło wnęki regału — stalowe kratownice (X-bracing) z tyłu */}
      <line x1="15" y1="6" x2="105" y2="62" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      <line x1="105" y1="6" x2="15" y2="62" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />

      {isEmpty ? (
        /* Puste miejsce paletowe — zarys miejsca pod paletę EURO */
        <g opacity="0.55">
          <polygon
            points="22,62 60,50 98,62 60,70"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text x="60" y="42" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="700">
            WOLNE MIEJSCE
          </text>
        </g>
      ) : (
        <g>
          {/* DREWNIANA PALETA EURO (Podstawa na trawersie regału) */}
          <g>
            {/* Deski górne palety w perspektywie */}
            <polygon
              points="14,62 60,49 106,62 60,71"
              fill="#d97706"
              stroke="#78350f"
              strokeWidth="1"
            />
            {/* Bok przedni palety EURO z klockami drewnianymi */}
            <rect x="16" y="63" width="88" height="4" fill="#f59e0b" stroke="#78350f" strokeWidth="0.8" rx="0.5" />
            {/* 3 wsporniki (klocki) palety EURO */}
            <rect x="18" y="67" width="12" height="5" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <rect x="54" y="67" width="12" height="5" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <rect x="90" y="67" width="12" height="5" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <text x="60" y="71.2" textAnchor="middle" fill="#fef3c7" fontSize="4.2" fontWeight="900">
              EUR
            </text>
            {/* Dolna deska palety */}
            <rect x="16" y="72" width="88" height="2.2" fill="#d97706" stroke="#78350f" strokeWidth="0.6" />
          </g>

          {/* ŁADUNEK NA PALECIE: Rzeczy opisane ręcznie (Skrzynia / Paczka specjalna) vs Kartony Produktów 3D */}
          {isCustomItem ? (
            <g>
              {/* Duża skrzynia / pakiet z opisem ręcznym */}
              <polygon points="28,36 60,26 92,36 60,46" fill="#fde68a" stroke="#92400e" strokeWidth="1.2" />
              <polygon points="28,36 60,46 60,64 28,54" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
              <polygon points="60,46 92,36 92,54 60,64" fill="#d97706" stroke="#92400e" strokeWidth="1.2" />
              {/* Pasy spinające ładunek */}
              <line x1="44" y1="31" x2="44" y2="59" stroke="#78350f" strokeWidth="1.8" strokeDasharray="2 1" />
              <line x1="76" y1="31" x2="76" y2="59" stroke="#78350f" strokeWidth="1.8" strokeDasharray="2 1" />
              <rect x="46" y="32" width="28" height="9" rx="2" fill="#fffbeb" stroke="#b45309" strokeWidth="0.9" />
              <text x="60" y="38.5" textAnchor="middle" fill="#92400e" fontSize="6" fontWeight="900">
                OPIS RĘCZNY
              </text>
            </g>
          ) : (
            <g>
              {/* Warstwa 1 (Dolna na palecie) — 2 kartony obok siebie */}
              {renderIsoBox(44, 48, 28, 14, 'L1-A')}
              {renderIsoBox(76, 48, 28, 14, 'L1-B')}

              {/* Warstwa 2 (Środkowa) */}
              {layersCount >= 2 && (
                <>
                  {renderIsoBox(44, 34, 28, 14, 'L2-A')}
                  {renderIsoBox(76, 34, 28, 14, 'L2-B')}
                </>
              )}

              {/* Warstwa 3 (Wysoka pełna paleta) */}
              {layersCount >= 3 && (
                <>
                  {renderIsoBox(44, 20, 28, 13, 'L3-A')}
                  {renderIsoBox(76, 20, 28, 13, 'L3-B')}
                </>
              )}
            </g>
          )}
        </g>
      )}
    </svg>
  );
};

export const Warehouse3DVisualizer: React.FC<Warehouse3DVisualizerProps> = ({
  warehouse,
  racks,
  slots,
  productMap,
  selectedSlotId,
  slotMatchesSearch,
  filterZone,
  onSelectSlot,
}) => {
  const [viewMode, setViewMode] = useState<'both' | 'hall_plan' | 'racks_3d'>('both');
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);

  const whRacks = racks.filter((r) => {
    if (r.warehouseId !== warehouse.id) return false;
    if (filterZone === 'picking') return r.zoneType === 'picking';
    if (filterZone === 'pallet') return r.zoneType === 'pallet';
    return true;
  });

  // Statystyki dla aktualnie otwartego magazynu (Magazyn 4, 5 lub 6)
  const whSlots = slots.filter((s) => s.warehouseId === warehouse.id);
  const occupiedWhSlots = whSlots.filter(
    (s) =>
      s.allocations.some((a) => a.quantity > 0) ||
      Boolean(s.customDescription && s.customDescription.trim())
  );
  const totalUnitsInWh = whSlots.reduce(
    (acc, s) => acc + s.allocations.reduce((sum, a) => sum + a.quantity, 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Pasek nagłówka wizualizacji przestrzennej wybranego Magazynu */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-5 border-2 border-slate-700 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300 font-mono text-xs font-extrabold">
                {warehouse.code}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight">{warehouse.name}</h2>
              {warehouse.hasPickingZone ? (
                <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
                  🎯 Hala Kompletacji (WZ / RW / PW)
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-bold">
                  🏭 Hala Składowania Paletowego (PZ / Zapas)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 max-w-3xl">{warehouse.description}</p>
          </div>

          {/* Przełącznik trybu wizualizacji przestrzennej */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/70 p-1.5 rounded-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all ${
                viewMode === 'both'
                  ? 'bg-teal-500 text-slate-950 font-extrabold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rzut Hali 3D + Regały z Paletami</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hall_plan')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all ${
                viewMode === 'hall_plan'
                  ? 'bg-teal-500 text-slate-950 font-extrabold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Tylko Rzut Hali 3D</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('racks_3d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all ${
                viewMode === 'racks_3d'
                  ? 'bg-teal-500 text-slate-950 font-extrabold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tylko Konstrukcje Regałów 3D</span>
            </button>
          </div>
        </div>

        {/* Szybkie liczniki dla tej hali */}
        <div className="mt-4 pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-5">
            <span>
              Regały w hali: <strong className="text-teal-300 font-mono">{whRacks.length}</strong>
            </span>
            <span>
              Zajęte miejsca paletowe:{' '}
              <strong className="text-emerald-300 font-mono">
                {occupiedWhSlots.length} / {whSlots.length}
              </strong>{' '}
              ({whSlots.length - occupiedWhSlots.length} wolnych)
            </span>
            <span>
              Suma jednostek w tym magazynie:{' '}
              <strong className="text-amber-300 font-mono">
                {totalUnitsInWh.toLocaleString('pl-PL')} jedn.
              </strong>
            </span>
          </div>

          {/* Legenda kolorów kartonów 3D na paletach */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block border border-white/40" />
              <span>Kompletacja Główna (&gt;12m)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-violet-500 inline-block border border-white/40" />
              <span>Gniazdo PARTNER (&gt;12m)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block border border-white/40" />
              <span>Paleta Zapasowa</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block border border-white/40" />
              <span>Opis ręczny / Krótka data</span>
            </span>
          </div>
        </div>
      </div>

      {/* CZĘŚĆ 1: INTERAKTYWNY RZUT PRZESTRZENNY 3D HALI MAGAZYNOWEJ (Mapa Hali z Alejkami, Bramą i Regałami) */}
      {(viewMode === 'both' || viewMode === 'hall_plan') && (
        <div className="bg-slate-900 rounded-3xl p-5 border-2 border-slate-700 shadow-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-white">
              <Compass className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-300">
                Rzut Przestrzenny Hali — {warehouse.name} (Kliknij dowolne gniazdo na planie hali, aby podejrzeć lub edytować paletę)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Żółte linie = Drogi transportowe wózków / kompletacji • Kliknij na wybrane miejsce na regale
            </span>
          </div>

          {/* Wizualna posadzka hali magazynowej */}
          <div
            className="relative rounded-2xl border-4 border-slate-600 p-5 overflow-x-auto"
            style={{
              backgroundColor: '#1e293b',
              backgroundImage:
                'radial-gradient(#334155 1px, transparent 1px), linear-gradient(to right, rgba(51,65,85,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,65,85,0.25) 1px, transparent 1px)',
              backgroundSize: '20px 20px, 80px 80px, 80px 80px',
            }}
          >
            {/* Górny pas hali: Brama Załadunkowa / Strefa Pakowania / Droga Transportowa */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b-2 border-dashed border-amber-400/70">
              <div className="flex items-center gap-3 bg-slate-800/90 border-2 border-amber-400/80 rounded-xl px-4 py-2 text-amber-300 text-xs font-extrabold shadow-md">
                <span>🚛</span>
                <span>
                  {warehouse.hasPickingZone
                    ? 'BRAMA WYDAŃ WZ / KURIERZY & STREFA PAKOWANIA'
                    : 'BRAMA PRZYJĘĆ DOSTAW PALETOWYCH (PZ) — WJAZD WÓZKÓW'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-400/40">
                <span>⚠️ GŁÓWNY KORYTARZ TRANSPORTOWY HALI ({warehouse.code})</span>
              </div>

              {warehouse.hasPickingZone && (
                <div className="flex items-center gap-2 bg-emerald-950/90 border border-emerald-400/60 rounded-xl px-4 py-2 text-emerald-200 text-xs font-bold">
                  <span>📦 Stoły Kompletacyjne (WZ / RW / PW)</span>
                </div>
              )}
            </div>

            {/* Rzędy Regałów stojących na hali (w perspektywie przestrzennej) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {whRacks.map((rack, rIdx) => {
                const rackSlots = slots.filter((s) => s.rackId === rack.id);
                const levels = Array.from(new Set(rackSlots.map((s) => s.level))).sort(
                  (a, b) => b - a
                );
                const isHovered = hoveredRackId === rack.id;

                return (
                  <div
                    key={rack.id}
                    onMouseEnter={() => setHoveredRackId(rack.id)}
                    onMouseLeave={() => setHoveredRackId(null)}
                    className={`rounded-2xl p-4 transition-all border-2 relative ${
                      isHovered
                        ? 'bg-slate-800/95 border-teal-400 shadow-lg'
                        : 'bg-slate-800/75 border-slate-600'
                    }`}
                  >
                    {/* Pomarańczowa belka konstrukcyjna regału na rzucie 3D */}
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b-2 border-orange-500/80">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-orange-500 text-slate-950 font-mono text-xs font-black shadow-2xs">
                          REGAŁ {rack.code}
                        </span>
                        <span className="text-xs font-extrabold text-white">{rack.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-300">
                        {rack.levelsCount} poz. × {rack.slotsPerLevel} palet
                      </span>
                    </div>

                    {/* Mini-siatka 3D poziomów i palet na rzucie hali */}
                    <div className="space-y-1.5">
                      {levels.map((lvl) => {
                        const lvlSlots = rackSlots
                          .filter((s) => s.level === lvl)
                          .sort((a, b) => a.position - b.position);

                        return (
                          <div key={lvl} className="flex items-center gap-2">
                            <span className="w-12 shrink-0 text-[10px] font-mono font-bold text-slate-300 bg-slate-900 px-1.5 py-1 rounded text-center border border-slate-700">
                              Poz. P{lvl}
                            </span>
                            <div
                              className="flex-1 grid gap-1.5"
                              style={{
                                gridTemplateColumns: `repeat(${Math.max(
                                  1,
                                  lvlSlots.length
                                )}, minmax(0, 1fr))`,
                              }}
                            >
                              {lvlSlots.map((slot) => {
                                const activeAllocs = slot.allocations.filter((a) => a.quantity > 0);
                                const totalQty = activeAllocs.reduce((acc, a) => acc + a.quantity, 0);
                                const isEmpty =
                                  activeAllocs.length === 0 &&
                                  !(slot.customDescription && slot.customDescription.trim());
                                const isMatched = slotMatchesSearch(slot);
                                const isSelected = selectedSlotId === slot.id;
                                const hasCustom =
                                  Boolean(slot.customDescription && slot.customDescription.trim()) ||
                                  activeAllocs.some((a) => a.isCustomItem || a.productId === 'CUSTOM');
                                const hasShort = activeAllocs.some(
                                  (a) =>
                                    !a.isCustomItem &&
                                    a.productId !== 'CUSTOM' &&
                                    !isEligibleForPartner12Months(a.expiryDate)
                                );

                                const firstAlloc = activeAllocs[0];
                                const firstProd = firstAlloc
                                  ? productMap.get(firstAlloc.productId)
                                  : undefined;
                                const shortLabel = hasCustom
                                  ? firstAlloc?.customName || slot.customDescription || 'Opis ręczny'
                                  : firstProd?.shortName || 'Wolne';

                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => onSelectSlot(slot)}
                                    title={`${slot.code}: ${shortLabel} (${totalQty} szt.)`}
                                    className={`group rounded-lg p-1.5 border text-left transition-all cursor-pointer relative overflow-hidden ${
                                      isMatched
                                        ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-300 scale-105 z-10'
                                        : isSelected
                                        ? 'bg-teal-500 text-slate-950 border-white ring-2 ring-teal-300 z-10'
                                        : isEmpty
                                        ? 'bg-slate-900/60 border-dashed border-slate-600 text-slate-500 hover:border-slate-400'
                                        : hasCustom || hasShort
                                        ? 'bg-amber-500/25 border-amber-400/80 text-amber-100 hover:bg-amber-500/40'
                                        : slot.slotType === 'picking_partner_12m'
                                        ? 'bg-violet-500/30 border-violet-400/80 text-violet-100 hover:bg-violet-500/45'
                                        : slot.slotType === 'picking_standard'
                                        ? 'bg-emerald-500/30 border-emerald-400/80 text-emerald-100 hover:bg-emerald-500/45'
                                        : 'bg-blue-500/30 border-blue-400/80 text-blue-100 hover:bg-blue-500/45'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 text-[9px] font-mono font-extrabold">
                                      <span>M.{String(slot.position).padStart(2, '0')}</span>
                                      {!isEmpty && <span>{totalQty}</span>}
                                    </div>
                                    <div className="text-[10px] font-bold truncate mt-0.5">
                                      {isEmpty ? '—' : shortLabel}
                                    </div>
                                    {/* Dolny pasek imitujący drewnianą paletę pod towarem */}
                                    {!isEmpty && (
                                      <div className="h-1 w-full bg-amber-500/90 rounded-full mt-1" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Alejka między regałami */}
                    {rIdx % 2 === 0 && (
                      <div className="mt-3 pt-1.5 border-t border-dashed border-amber-400/40 text-center text-[10px] font-mono text-amber-300/80">
                        ⇄ ALEJKA MAGAZYNOWA (DOSTĘP DO MIEJSC PALETOWYCH {rack.code}) ⇄
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CZĘŚĆ 2: WIZUALIZACJA KONSTRUKCJI REGAŁÓW MAGAZYNOWYCH Z PALETAMI EURO 3D I KARTONAMI */}
      {(viewMode === 'both' || viewMode === 'racks_3d') && (
        <div className="space-y-8">
          {whRacks.map((rack) => {
            const rackSlots = slots.filter((s) => s.rackId === rack.id);
            const levels = Array.from(new Set(rackSlots.map((s) => s.level))).sort(
              (a, b) => b - a // Od najwyższej półki w dół do Posadzki P0!
            );

            const isPartnerRack =
              rack.id === 'rack-picking-partner' || rack.colorTheme === 'violet';
            const isPickingRack = rack.zoneType === 'picking';

            return (
              <div
                key={rack.id}
                className="bg-slate-900 rounded-3xl border-4 border-slate-700 shadow-xl overflow-hidden"
              >
                {/* Górna belka znamionowa regału magazynowego */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 border-b-4 border-orange-500 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 rounded-xl bg-orange-500 text-slate-950 font-mono text-sm font-black tracking-wide shadow-sm">
                      REGAŁ {rack.code}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">{rack.name}</h3>
                      <p className="text-xs text-slate-400">
                        {isPartnerRack
                          ? '🟣 Regał Kompletacji PARTNER (> 12 msc) — wydzielone palety i kartony z długą datą ważności'
                          : isPickingRack
                          ? '🎯 Regał Kompletacji Głównej (Magazyn 4) — stąd schodzą bieżące wydania WZ i RW'
                          : '🏭 Regał Paletowy Wysokiego Składowania — kliknij na dowolną paletę EURO, aby przesunąć lub edytować towar'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs font-mono text-amber-300 font-bold">
                      Konstrukcja: {rack.levelsCount} poziomy × {rack.slotsPerLevel} gniazd
                    </span>
                  </div>
                </div>

                {/* Konstrukcja Stalowa Regału: Niebieskie słupy nośne + Pomarańczowe trawersy + Palety EURO 3D */}
                <div className="p-4 sm:p-6 bg-slate-950/90 overflow-x-auto">
                  <div className="min-w-[820px] border-x-[12px] border-blue-800 bg-slate-900/90 px-3 pt-4 pb-2 relative">
                    <div className="space-y-4">
                      {levels.map((lvl) => {
                        const levelSlots = rackSlots
                          .filter((s) => s.level === lvl)
                          .sort((a, b) => a.position - b.position);

                        return (
                          <div key={lvl} className="relative">
                            {/* Wiersz wnęk paletowych na danym poziomie */}
                            <div className="flex items-stretch gap-2">
                              {/* Tabliczka poziomu na lewym słupie nośnym */}
                              <div className="w-24 shrink-0 bg-blue-950 border-2 border-blue-600 rounded-xl flex flex-col items-center justify-center p-2 text-center shadow-inner">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-300 font-bold">
                                  POZIOM {lvl}
                                </span>
                                <span className="text-xs font-extrabold text-white mt-0.5">
                                  {lvl === 0 ? 'Posadzka P0' : `Belka P${lvl}`}
                                </span>
                                <span className="mt-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[9px] font-mono">
                                  {lvl === 0 ? '0.0m' : `${lvl * 1.4}m`}
                                </span>
                              </div>

                              {/* Poszczególne gniazda paletowe oddzielone pionowymi słupami regału */}
                              <div
                                className="flex-1 grid gap-2.5"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.max(
                                    1,
                                    levelSlots.length
                                  )}, minmax(145px, 1fr))`,
                                }}
                              >
                                {levelSlots.map((slot) => {
                                  const activeAllocs = slot.allocations.filter(
                                    (a) => a.quantity > 0
                                  );
                                  const totalQty = activeAllocs.reduce(
                                    (acc, a) => acc + a.quantity,
                                    0
                                  );
                                  const isMatched = slotMatchesSearch(slot);
                                  const hasCustomItem =
                                    Boolean(
                                      slot.customDescription && slot.customDescription.trim()
                                    ) ||
                                    activeAllocs.some((a) =>
                                      Boolean(a.isCustomItem || a.productId === 'CUSTOM')
                                    );
                                  const hasShortDate = activeAllocs.some(
                                    (a) =>
                                      !a.isCustomItem &&
                                      a.productId !== 'CUSTOM' &&
                                      !isEligibleForPartner12Months(a.expiryDate)
                                  );

                                  if (filterZone === 'short_mhd' && !hasShortDate) {
                                    return (
                                      <div
                                        key={slot.id}
                                        className="rounded-xl border border-slate-800 bg-slate-900/30 opacity-25 p-2"
                                      />
                                    );
                                  }
                                  if (filterZone === 'custom_items' && !hasCustomItem) {
                                    return (
                                      <div
                                        key={slot.id}
                                        className="rounded-xl border border-slate-800 bg-slate-900/30 opacity-25 p-2"
                                      />
                                    );
                                  }

                                  const isEmpty =
                                    activeAllocs.length === 0 &&
                                    !(slot.customDescription && slot.customDescription.trim());
                                  const isSelected = selectedSlotId === slot.id;
                                  const fillPercent = Math.min(
                                    100,
                                    Math.round(
                                      (totalQty / (slot.maxCapacityUnits || 1000)) * 100
                                    )
                                  );

                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => onSelectSlot(slot)}
                                      className={`group text-left rounded-t-xl transition-all cursor-pointer flex flex-col justify-between p-2 border-x-2 border-t-2 relative ${
                                        isMatched
                                          ? 'bg-amber-500/20 border-amber-400 ring-4 ring-amber-400 scale-[1.02] z-10'
                                          : isSelected
                                          ? 'bg-teal-500/20 border-teal-400 ring-3 ring-teal-400 z-10'
                                          : isEmpty
                                          ? 'bg-slate-900/50 border-slate-800 hover:border-slate-500 hover:bg-slate-800/60'
                                          : 'bg-slate-800/90 border-slate-700 hover:border-teal-400 hover:bg-slate-800'
                                      }`}
                                    >
                                      {/* Górny pasek wnęki: Etykieta kodu gniazda + status */}
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 font-mono text-[10px] font-black tracking-tight shadow-2xs">
                                          {slot.code}
                                        </span>
                                        {hasCustomItem ? (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black">
                                            📝 RĘCZNY
                                          </span>
                                        ) : hasShortDate ? (
                                          <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-black">
                                            &lt;12 msc
                                          </span>
                                        ) : slot.slotType === 'picking_partner_12m' ? (
                                          <span className="px-1.5 py-0.5 rounded bg-violet-500 text-white text-[9px] font-black">
                                            PARTNER
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* WIZUALIZACJA 3D PALETY EURO I KARTONÓW WE WNĘCE REGAŁU */}
                                      <div className="my-1">
                                        <EuroPallet3DSvg
                                          isEmpty={isEmpty}
                                          fillPercent={fillPercent}
                                          boxColor={rack.colorTheme}
                                          isCustomItem={hasCustomItem}
                                          hasShortDate={hasShortDate}
                                        />
                                      </div>

                                      {/* Tabliczka zawartości palety bezpośrednio nad trawersem */}
                                      <div className="bg-slate-950/90 rounded-lg p-1.5 border border-slate-700/90 space-y-0.5">
                                        {slot.customDescription && (
                                          <div className="text-[10px] font-bold text-amber-300 truncate">
                                            📌 {slot.customDescription}
                                          </div>
                                        )}
                                        {activeAllocs.length === 0 ? (
                                          <div className="text-[10px] text-slate-400 text-center font-semibold">
                                            {slot.customDescription
                                              ? 'Kliknij, aby edytować opis'
                                              : '+ Kliknij, aby postawić paletę'}
                                          </div>
                                        ) : (
                                          <>
                                            {activeAllocs.slice(0, 2).map((alloc) => {
                                              const isCustom = Boolean(
                                                alloc.isCustomItem || alloc.productId === 'CUSTOM'
                                              );
                                              const prod = productMap.get(alloc.productId);
                                              return (
                                                <div key={alloc.id} className="leading-tight">
                                                  <div className="text-[11px] font-extrabold text-white truncate">
                                                    {isCustom
                                                      ? alloc.customName || 'Pozycja własna'
                                                      : prod?.shortName || alloc.productId}
                                                  </div>
                                                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                                                    <span className="text-teal-300 font-extrabold">
                                                      {alloc.quantity.toLocaleString('pl-PL')}{' '}
                                                      {alloc.customUnit || 'szt.'}
                                                    </span>
                                                    <span>
                                                      {isCustom
                                                        ? 'Opis własny'
                                                        : (alloc.expiryDate || '').slice(0, 7)}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                            {activeAllocs.length > 2 && (
                                              <div className="text-[9px] font-bold text-amber-300">
                                                + {activeAllocs.length - 2} więcej pozycji na palecie
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* POMARAŃCZOWY TRAWERS NOŚNY REGAŁU (Belka pozioma, na której stoją palety EURO) */}
                            <div
                              className={`h-3.5 w-full rounded-xs shadow-md flex items-center justify-between px-4 ${
                                lvl === 0
                                  ? 'bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 border-t-2 border-yellow-400'
                                  : 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 border-y border-orange-300/50'
                              }`}
                            >
                              <span className="text-[8px] font-mono font-black text-slate-950 uppercase tracking-widest">
                                {lvl === 0
                                  ? `POSADZKA MAGAZYNOWA (${rack.code} — POZIOM P0)`
                                  : `BELKA NOŚNA TRAWERS (${rack.code} — POZIOM P${lvl})`}
                              </span>
                              <span className="text-[8px] font-mono font-black text-slate-950">
                                MAX UDŹWIG PALETY: 1000 KG
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
