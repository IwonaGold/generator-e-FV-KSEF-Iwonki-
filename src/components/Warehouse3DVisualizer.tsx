import React, { useState } from 'react';
import {
  SpatialWarehouse,
  WarehouseRack,
  WarehouseLocationSlot,
  ProductCatalogItem,
} from '../types/wms';
import { isEligibleForPartner12Months } from '../utils/wfirmaParser';
import { Layers, Compass, Sparkles, ArrowRight } from 'lucide-react';

interface Warehouse3DVisualizerProps {
  warehouse: SpatialWarehouse;
  racks: WarehouseRack[];
  slots: WarehouseLocationSlot[];
  productMap: Map<string, ProductCatalogItem>;
  selectedSlotId: string | null;
  slotMatchesSearch: (slot: WarehouseLocationSlot) => boolean;
  filterZone: 'ALL' | 'picking' | 'pallet' | 'floor_pallet' | 'short_mhd' | 'custom_items';
  onSelectSlot: (slot: WarehouseLocationSlot) => void;
}

/**
 * Rysuje realistyczną paletę EURO 3D wraz z ułożonymi na niej kartonami 3D (lub skrzynią dla rzeczy opisanych ręcznie).
 * Obsługuje zarówno wnęki regałowe (z kratownicą w tle), jak i miejsca paletowe na podłodze (z żółtymi pasami na betonie).
 */
export const EuroPallet3DSvg: React.FC<{
  isEmpty: boolean;
  fillPercent: number;
  boxColor: 'emerald' | 'violet' | 'blue' | 'amber' | 'rose';
  isCustomItem: boolean;
  hasShortDate: boolean;
  isFloorPallet?: boolean;
}> = ({ isEmpty, fillPercent, boxColor, isCustomItem, hasShortDate, isFloorPallet }) => {
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

  const renderIsoBox = (cx: number, cy: number, w = 24, h = 15, key: string) => {
    const dx = w / 2;
    const dy = 5;
    const topPts = `${cx},${cy - dy * 2} ${cx + dx},${cy - dy} ${cx},${cy} ${cx - dx},${cy - dy}`;
    const leftPts = `${cx - dx},${cy - dy} ${cx},${cy} ${cx},${cy + h} ${cx - dx},${cy - dy + h}`;
    const rightPts = `${cx},${cy} ${cx + dx},${cy - dy} ${cx + dx},${cy - dy + h} ${cx},${cy + h}`;

    return (
      <g key={key}>
        <polygon points={leftPts} fill={c.left} stroke={c.stroke} strokeWidth="0.9" />
        <polygon points={rightPts} fill={c.right} stroke={c.stroke} strokeWidth="0.9" />
        <polygon points={topPts} fill={c.top} stroke={c.stroke} strokeWidth="0.9" />
        <line
          x1={cx - dx * 0.45}
          y1={cy - dy * 1.45}
          x2={cx + dx * 0.45}
          y2={cy - dy * 0.55}
          stroke={c.tape}
          strokeWidth="2"
        />
        <rect x={cx + 3} y={cy + 2} width={5} height={4} fill="#ffffff" opacity="0.85" rx="0.5" />
      </g>
    );
  };

  const layersCount = isEmpty ? 0 : fillPercent > 60 ? 3 : fillPercent > 25 ? 2 : 1;

  return (
    <svg viewBox="0 0 120 78" className="w-full h-16 overflow-visible select-none">
      {/* Tło: Jeśli to miejsce na podłodze -> namalowany żółty obrys pola na posadzce betonowej; jeśli regał -> kratownica */}
      {isFloorPallet ? (
        <polygon
          points="8,64 60,46 112,64 60,76"
          fill="rgba(251, 191, 36, 0.08)"
          stroke="#fbbf24"
          strokeWidth="1.6"
          strokeDasharray="5 3"
        />
      ) : (
        <>
          <line x1="15" y1="6" x2="105" y2="62" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
          <line x1="105" y1="6" x2="15" y2="62" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
        </>
      )}

      {isEmpty ? (
        <g opacity="0.65">
          <polygon
            points="22,62 60,50 98,62 60,70"
            fill="none"
            stroke={isFloorPallet ? '#fbbf24' : '#94a3b8'}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x="60"
            y="40"
            textAnchor="middle"
            fill={isFloorPallet ? '#fcd34d' : '#64748b'}
            fontSize="8.5"
            fontWeight="800"
          >
            {isFloorPallet ? 'WOLNE POLE PODŁOGOWE' : 'WOLNE MIEJSCE'}
          </text>
        </g>
      ) : (
        <g>
          {/* DREWNIANA PALETA EURO */}
          <g>
            <polygon
              points="14,62 60,49 106,62 60,71"
              fill="#d97706"
              stroke="#78350f"
              strokeWidth="1"
            />
            <rect x="16" y="63" width="88" height="4" fill="#f59e0b" stroke="#78350f" strokeWidth="0.8" rx="0.5" />
            <rect x="18" y="67" width="12" height="5" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <rect x="54" y="67" width="12" height="5" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <rect x="90" y="67" width="12" height="5" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <text x="60" y="71.2" textAnchor="middle" fill="#fef3c7" fontSize="4.2" fontWeight="900">
              EUR
            </text>
            <rect x="16" y="72" width="88" height="2.2" fill="#d97706" stroke="#78350f" strokeWidth="0.6" />
          </g>

          {/* ŁADUNEK NA PALECIE */}
          {isCustomItem ? (
            <g>
              <polygon points="28,36 60,26 92,36 60,46" fill="#fde68a" stroke="#92400e" strokeWidth="1.2" />
              <polygon points="28,36 60,46 60,64 28,54" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
              <polygon points="60,46 92,36 92,54 60,64" fill="#d97706" stroke="#92400e" strokeWidth="1.2" />
              <line x1="44" y1="31" x2="44" y2="59" stroke="#78350f" strokeWidth="1.8" strokeDasharray="2 1" />
              <line x1="76" y1="31" x2="76" y2="59" stroke="#78350f" strokeWidth="1.8" strokeDasharray="2 1" />
              <rect x="46" y="32" width="28" height="9" rx="2" fill="#fffbeb" stroke="#b45309" strokeWidth="0.9" />
              <text x="60" y="38.5" textAnchor="middle" fill="#92400e" fontSize="6" fontWeight="900">
                OPIS RĘCZNY
              </text>
            </g>
          ) : (
            <g>
              {renderIsoBox(44, 48, 28, 14, 'L1-A')}
              {renderIsoBox(76, 48, 28, 14, 'L1-B')}
              {layersCount >= 2 && (
                <>
                  {renderIsoBox(44, 34, 28, 14, 'L2-A')}
                  {renderIsoBox(76, 34, 28, 14, 'L2-B')}
                </>
              )}
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

  const allWhRacks = racks.filter((r) => r.warehouseId === warehouse.id);

  const whRacks = allWhRacks.filter((r) => {
    if (filterZone === 'picking') return r.zoneType === 'picking';
    if (filterZone === 'pallet') return r.zoneType === 'pallet';
    if (filterZone === 'floor_pallet')
      return r.zoneType === 'floor_pallet' || r.hallPlacement === 'floor_zone';
    return true;
  });

  // Podział regałów i stref w prostokątnej hali:
  // 1) Bok Górny (Lewa ściana patrząc od bramy po lewej stronie)
  // 2) Strefa Podłogowa (Miejsca paletowe na podłodze P0)
  // 3) Bok Dolny (Prawa ściana patrząc od bramy po lewej stronie)
  const sideRacks = whRacks.filter(
    (r) => r.hallPlacement !== 'floor_zone' && r.zoneType !== 'floor_pallet'
  );
  const topWallRacks = sideRacks.filter((r, idx) =>
    r.hallPlacement ? r.hallPlacement === 'top_wall' : idx % 2 === 0
  );
  const bottomWallRacks = sideRacks.filter((r, idx) =>
    r.hallPlacement ? r.hallPlacement === 'bottom_wall' : idx % 2 === 1
  );
  const floorZoneRacks = whRacks.filter(
    (r) => r.hallPlacement === 'floor_zone' || r.zoneType === 'floor_pallet'
  );

  // Statystyki dla aktualnie otwartego magazynu
  const whSlots = slots.filter((s) => s.warehouseId === warehouse.id);
  const floorSlotsCount = whSlots.filter((s) => s.slotType === 'floor_pallet').length;
  const rackSlotsCount = whSlots.length - floorSlotsCount;
  const occupiedWhSlots = whSlots.filter(
    (s) =>
      s.allocations.some((a) => a.quantity > 0) ||
      Boolean(s.customDescription && s.customDescription.trim())
  );
  const totalUnitsInWh = whSlots.reduce(
    (acc, s) => acc + s.allocations.reduce((sum, a) => sum + a.quantity, 0),
    0
  );

  // Funkcja pomocnicza renderująca pojedynczy regał boczny na rzucie prostokątnej hali
  const renderRackOnFloorplan = (rack: WarehouseRack, sideLabel: string) => {
    const rackSlots = slots.filter((s) => s.rackId === rack.id);
    const levels = Array.from(new Set(rackSlots.map((s) => s.level))).sort((a, b) => b - a);
    const isHovered = hoveredRackId === rack.id;

    return (
      <div
        key={rack.id}
        onMouseEnter={() => setHoveredRackId(rack.id)}
        onMouseLeave={() => setHoveredRackId(null)}
        className={`rounded-2xl p-3.5 transition-all border-2 relative ${
          isHovered
            ? 'bg-slate-800/95 border-teal-400 shadow-lg'
            : 'bg-slate-800/85 border-slate-600'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b-2 border-orange-500/80">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-orange-500 text-slate-950 font-mono text-xs font-black">
              REGAŁ {rack.code}
            </span>
            <span className="text-xs font-extrabold text-white">{rack.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-teal-300 text-[10px] font-mono border border-slate-700">
              {sideLabel}
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              {rack.levelsCount} poz. × {rack.slotsPerLevel} miejsc
            </span>
          </div>
        </div>

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
                    gridTemplateColumns: `repeat(${Math.max(1, lvlSlots.length)}, minmax(0, 1fr))`,
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
                    const firstProd = firstAlloc ? productMap.get(firstAlloc.productId) : undefined;
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
      </div>
    );
  };

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
              <span>Rzut Prostokątnej Hali + Widok 3D Palet</span>
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
              <span>Tylko Rzut Hali (Brama po lewej / Korytarz na środku)</span>
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
              <span>Tylko Regały 3D i Palety na Podłodze</span>
            </button>
          </div>
        </div>

        {/* Szybkie liczniki dla tej hali */}
        <div className="mt-4 pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-5">
            <span>
              Miejsca na regałach bocznych:{' '}
              <strong className="text-teal-300 font-mono">{rackSlotsCount}</strong>
            </span>
            <span>
              Miejsca paletowe na podłodze:{' '}
              <strong className="text-amber-300 font-mono">{floorSlotsCount}</strong>
            </span>
            <span>
              Zajęte łącznie:{' '}
              <strong className="text-emerald-300 font-mono">
                {occupiedWhSlots.length} / {whSlots.length}
              </strong>{' '}
              ({whSlots.length - occupiedWhSlots.length} wolnych)
            </span>
            <span>
              Suma jednostek w hali:{' '}
              <strong className="text-amber-300 font-mono">
                {totalUnitsInWh.toLocaleString('pl-PL')} jedn.
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block border border-white/40" />
              <span>Kompletacja Główna</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-violet-500 inline-block border border-white/40" />
              <span>Gniazdo PARTNER (&gt;12m)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block border border-white/40" />
              <span>Regał Paletowy</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block border border-white/40" />
              <span>Paleta na Podłodze / Opis ręczny</span>
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================================== */}
      {/* CZĘŚĆ 1: PROSTOKĄTNY RZUT PRZESTRZENNY HALI (Brama po lewej, Korytarz na środku, Regały po bokach + Palety na podłodze) */}
      {/* ===================================================================================== */}
      {(viewMode === 'both' || viewMode === 'hall_plan') && (
        <div className="bg-slate-900 rounded-3xl p-5 border-2 border-slate-700 shadow-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-white">
              <Compass className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-300">
                Rzut Prostokątnej Hali — {warehouse.name} (Brama po lewej • Strefa przemieszczania na środku • Regały po bokach • Palety na podłodze)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Kliknij dowolne miejsce na regale bocznym lub pole paletowe na podłodze, aby podejrzeć lub edytować paletę
            </span>
          </div>

          {/* PROSTOKĄTNY OBRYS MURÓW HALI MAGAZYNOWEJ */}
          <div
            className="relative rounded-2xl border-[6px] border-slate-500 p-4 overflow-x-auto shadow-2xl"
            style={{
              backgroundColor: '#1e293b',
              backgroundImage:
                'radial-gradient(#334155 1px, transparent 1px), linear-gradient(to right, rgba(51,65,85,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,65,85,0.28) 1px, transparent 1px)',
              backgroundSize: '20px 20px, 80px 80px, 80px 80px',
            }}
          >
            <div className="min-w-[920px] flex items-stretch gap-4">
              {/* LEWA ŚCIANA PROSTOKĄTNEJ HALI: BRAMA WJAZDOWA / WYDAŃ PO LEWEJ STRONIE */}
              <div className="w-44 shrink-0 flex flex-col justify-between rounded-xl border-2 border-slate-600 bg-slate-950/80 p-2.5 relative">
                {/* Górny narożnik lewej ściany */}
                <div className="text-[10px] font-mono text-slate-400 text-center py-2 border-b border-slate-800">
                  ŚCIANA LEWA (NAROŻNIK)
                </div>

                {/* CENTRALNA BRAMA MAGAZYNOWA PO LEWEJ STRONIE (Otwiera się prosto na środkową strefę przemieszczania się!) */}
                <div className="my-2 py-5 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/30 via-amber-500/15 to-transparent border-l-8 border-y-2 border-r border-amber-400 flex flex-col items-center justify-center text-center shadow-lg">
                  <div className="text-2xl mb-1">🚛</div>
                  <div className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px] font-black uppercase tracking-wider">
                    BRAMA PO LEWEJ
                  </div>
                  <div className="text-xs font-extrabold text-amber-200 mt-1.5 leading-snug">
                    {warehouse.hasPickingZone
                      ? 'Brama Wydań WZ / Kurierzy & Przyjęcia'
                      : 'Brama Wjazdowa Dostaw Paletowych (PZ)'}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300">
                    <span>WJAZD NA ŚRODEK</span>
                    <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                </div>

                {/* Dolny narożnik lewej ściany */}
                <div className="text-[10px] font-mono text-slate-400 text-center py-2 border-t border-slate-800">
                  ŚCIANA LEWA (NAROŻNIK)
                </div>
              </div>

              {/* WNĘTRZE PROSTOKĄTNEJ HALI: 3 PASY POZIOME (1. BOK GÓRNY -> 2. ŚRODEK: STREFA PRZEMIESZCZANIA + PODŁOGA -> 3. BOK DOLNY) */}
              <div className="flex-1 flex flex-col justify-between gap-4">
                {/* 1. BOK GÓRNY HALI (REGAŁY PO LEWEJ STRONIE OD WJAZDU BRAMĄ) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <span>⬆️ BOK GÓRNY HALI (Regały pod lewą ścianą patrząc od bramy)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Front regałów skierowany do środkowej strefy przemieszczania się ↓
                    </span>
                  </div>
                  {topWallRacks.length > 0 ? (
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(1, topWallRacks.length)}, minmax(0, 1fr))`,
                      }}
                    >
                      {topWallRacks.map((rack) => renderRackOnFloorplan(rack, 'BOK GÓRNY'))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
                      Brak regałów przypisanych do górnej ściany dla wybranego filtra.
                    </div>
                  )}
                </div>

                {/* 2. ŚRODEK HALI: STREFA PRZEMIESZCZANIA SIĘ (GŁÓWNA ALEJKA) + MIEJSCA PALETOWE NA PODŁODZE */}
                <div className="rounded-2xl border-y-4 border-dashed border-amber-400/90 bg-slate-950/75 px-4 py-3.5 space-y-3 shadow-inner">
                  {/* Pas ruchu wózków i kompletacji biegnący od bramy po lewej stronie */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono text-xs font-black">
                        ⇄ STREFA PRZEMIESZCZANIA SIĘ (ŚRODEK HALI)
                      </span>
                      <span className="text-xs font-bold text-amber-200">
                        Główny ciąg komunikacyjny od Bramy po lewej stronie wzdłuż całej hali ({warehouse.code})
                      </span>
                    </div>

                    {warehouse.hasPickingZone && (
                      <div className="px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 text-xs font-bold">
                        📦 Strefa Kompletacji i Pakowania Zamówień (WZ / RW)
                      </div>
                    )}
                  </div>

                  {/* WYDZIELONE MIEJSCA PALETOWE NA PODŁODZE (POSADZKA P0) */}
                  {floorZoneRacks.map((floorRack) => {
                    const floorSlots = slots
                      .filter((s) => s.rackId === floorRack.id)
                      .sort((a, b) => a.position - b.position);

                    return (
                      <div
                        key={floorRack.id}
                        className="rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-500/10 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[11px] font-black">
                              PODŁOGA: {floorRack.code}
                            </span>
                            <span className="text-xs font-extrabold text-amber-200">
                              {floorRack.name} (Miejsca paletowe bezpośrednio na posadzce hali)
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-amber-300 font-bold">
                            {floorSlots.length} miejsc paletowych na podłodze (P0)
                          </span>
                        </div>

                        <div
                          className="grid gap-2.5"
                          style={{
                            gridTemplateColumns: `repeat(${Math.max(1, floorSlots.length)}, minmax(120px, 1fr))`,
                          }}
                        >
                          {floorSlots.map((slot) => {
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

                            const firstAlloc = activeAllocs[0];
                            const firstProd = firstAlloc
                              ? productMap.get(firstAlloc.productId)
                              : undefined;
                            const shortLabel = hasCustom
                              ? firstAlloc?.customName || slot.customDescription || 'Opis ręczny'
                              : firstProd?.shortName || 'Wolne pole na podłodze';

                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => onSelectSlot(slot)}
                                className={`rounded-xl p-2 border-2 text-left transition-all cursor-pointer ${
                                  isMatched
                                    ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-200 scale-105'
                                    : isSelected
                                    ? 'bg-teal-500 text-slate-950 border-white ring-2 ring-teal-300'
                                    : isEmpty
                                    ? 'bg-slate-900/75 border-dashed border-amber-400/50 text-amber-200/70 hover:border-amber-300'
                                    : 'bg-amber-500/25 border-amber-400 text-white hover:bg-amber-500/35'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-black">
                                  <span>POLE #{String(slot.position).padStart(2, '0')}</span>
                                  <span className="opacity-85">{slot.code}</span>
                                </div>
                                <div className="text-xs font-extrabold truncate mt-1">
                                  {isEmpty ? '➕ Wolne miejsce podłogowe' : shortLabel}
                                </div>
                                {!isEmpty && (
                                  <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-amber-200 font-bold">
                                    <span>
                                      {totalQty.toLocaleString('pl-PL')}{' '}
                                      {firstAlloc?.customUnit || 'szt.'}
                                    </span>
                                    <span>🟫 Paleta EURO</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. BOK DOLNY HALI (REGAŁY PO PRAWEJ STRONIE OD WJAZDU BRAMĄ) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <span>⬇️ BOK DOLNY HALI (Regały pod prawą ścianą patrząc od bramy)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Front regałów skierowany do środkowej strefy przemieszczania się ↑
                    </span>
                  </div>
                  {bottomWallRacks.length > 0 ? (
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(1, bottomWallRacks.length)}, minmax(0, 1fr))`,
                      }}
                    >
                      {bottomWallRacks.map((rack) => renderRackOnFloorplan(rack, 'BOK DOLNY'))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
                      Brak regałów przypisanych do dolnej ściany dla wybranego filtra.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================================== */}
      {/* CZĘŚĆ 2: WIDOK PRZESTRZENNY 3D REGAŁÓW BOCZNYCH ORAZ STREFY PALETOWEJ NA PODŁODZE */}
      {/* ===================================================================================== */}
      {(viewMode === 'both' || viewMode === 'racks_3d') && (
        <div className="space-y-8">
          {whRacks.map((rack) => {
            const rackSlots = slots.filter((s) => s.rackId === rack.id);
            const levels = Array.from(new Set(rackSlots.map((s) => s.level))).sort(
              (a, b) => b - a
            );

            const isFloorZone =
              rack.zoneType === 'floor_pallet' || rack.hallPlacement === 'floor_zone';
            const isPartnerRack =
              rack.id === 'rack-picking-partner' || rack.colorTheme === 'violet';
            const isPickingRack = rack.zoneType === 'picking';

            const placementBadge =
              rack.hallPlacement === 'top_wall'
                ? '⬆️ Bok Górny Hali (Lewa strona od bramy)'
                : rack.hallPlacement === 'bottom_wall'
                ? '⬇️ Bok Dolny Hali (Prawa strona od bramy)'
                : isFloorZone
                ? '🟨 Strefa Paletowa na Podłodze (Posadzka P0)'
                : 'Regał Magazynowy';

            return (
              <div
                key={rack.id}
                className={`rounded-3xl border-4 shadow-xl overflow-hidden ${
                  isFloorZone
                    ? 'bg-slate-900 border-amber-500/80'
                    : 'bg-slate-900 border-slate-700'
                }`}
              >
                {/* Górna belka znamionowa regału lub strefy podłogowej */}
                <div
                  className={`px-6 py-4 border-b-4 flex flex-wrap items-center justify-between gap-4 ${
                    isFloorZone
                      ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-amber-400'
                      : 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-orange-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`px-3.5 py-1.5 rounded-xl font-mono text-sm font-black tracking-wide shadow-sm ${
                        isFloorZone
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-orange-500 text-slate-950'
                      }`}
                    >
                      {isFloorZone ? `PODŁOGA ${rack.code}` : `REGAŁ ${rack.code}`}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-white">{rack.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[11px] font-bold text-teal-300">
                          {placementBadge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isFloorZone
                          ? '🟨 Wydzielone miejsca paletowe bezpośrednio na posadzce hali (obok środkowej strefy przemieszczania się)'
                          : isPartnerRack
                          ? '🟣 Regał Kompletacji PARTNER (> 12 msc) — wydzielone palety i kartony z długą datą ważności'
                          : isPickingRack
                          ? '🎯 Regał Kompletacji Głównej (Magazyn 4) — stąd schodzą bieżące wydania WZ i RW'
                          : '🏭 Regał Paletowy Boczny — kliknij na dowolną paletę EURO, aby przesunąć lub edytować towar'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs font-mono text-amber-300 font-bold">
                      {isFloorZone
                        ? `Posadzka P0: ${rack.slotsPerLevel} miejsc paletowych na podłodze`
                        : `Konstrukcja: ${rack.levelsCount} poziomy × ${rack.slotsPerLevel} gniazd`}
                    </span>
                  </div>
                </div>

                {/* Wizualizacja 3D: Stalowy regał boczny LUB Betonowa Posadzka z polami paletowymi */}
                <div className="p-4 sm:p-6 bg-slate-950/90 overflow-x-auto">
                  <div
                    className={`min-w-[820px] px-3 pt-4 pb-2 relative ${
                      isFloorZone
                        ? 'border-x-4 border-dashed border-amber-400/70 bg-slate-900/75 rounded-2xl'
                        : 'border-x-[12px] border-blue-800 bg-slate-900/90'
                    }`}
                  >
                    <div className="space-y-4">
                      {levels.map((lvl) => {
                        const levelSlots = rackSlots
                          .filter((s) => s.level === lvl)
                          .sort((a, b) => a.position - b.position);

                        return (
                          <div key={lvl} className="relative">
                            <div className="flex items-stretch gap-2">
                              {/* Tabliczka poziomu */}
                              <div
                                className={`w-28 shrink-0 rounded-xl flex flex-col items-center justify-center p-2 text-center shadow-inner border-2 ${
                                  isFloorZone
                                    ? 'bg-amber-950/70 border-amber-400'
                                    : 'bg-blue-950 border-blue-600'
                                }`}
                              >
                                <span
                                  className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                                    isFloorZone ? 'text-amber-300' : 'text-blue-300'
                                  }`}
                                >
                                  {isFloorZone ? 'STREFA P0' : `POZIOM ${lvl}`}
                                </span>
                                <span className="text-xs font-extrabold text-white mt-0.5">
                                  {isFloorZone
                                    ? 'Na Podłodze'
                                    : lvl === 0
                                    ? 'Posadzka P0'
                                    : `Belka P${lvl}`}
                                </span>
                                <span className="mt-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[9px] font-mono">
                                  {lvl === 0 ? 'Poziom 0.0m' : `Wys. ${lvl * 1.4}m`}
                                </span>
                              </div>

                              {/* Poszczególne gniazda paletowe */}
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
                                          : isFloorZone
                                          ? isEmpty
                                            ? 'bg-slate-900/60 border-dashed border-amber-400/50 hover:border-amber-300'
                                            : 'bg-amber-950/30 border-amber-400/80 hover:border-amber-300'
                                          : isEmpty
                                          ? 'bg-slate-900/50 border-slate-800 hover:border-slate-500 hover:bg-slate-800/60'
                                          : 'bg-slate-800/90 border-slate-700 hover:border-teal-400 hover:bg-slate-800'
                                      }`}
                                    >
                                      {/* Górny pasek wnęki / pola podłogowego */}
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 font-mono text-[10px] font-black tracking-tight shadow-2xs">
                                          {slot.code}
                                        </span>
                                        {hasCustomItem ? (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black">
                                            📝 RĘCZNY
                                          </span>
                                        ) : isFloorZone ? (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[9px] font-bold">
                                            PODŁOGA
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

                                      {/* WIZUALIZACJA 3D PALETY EURO I KARTONÓW */}
                                      <div className="my-1">
                                        <EuroPallet3DSvg
                                          isEmpty={isEmpty}
                                          fillPercent={fillPercent}
                                          boxColor={rack.colorTheme}
                                          isCustomItem={hasCustomItem}
                                          hasShortDate={hasShortDate}
                                          isFloorPallet={isFloorZone}
                                        />
                                      </div>

                                      {/* Tabliczka zawartości palety */}
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
                                              : isFloorZone
                                              ? '+ Postaw paletę na podłodze'
                                              : '+ Postaw paletę na regale'}
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

                            {/* Belka dolna: Posadzka z żółtą linią BHP dla podłogi LUB Pomarańczowy trawers regału */}
                            <div
                              className={`h-3.5 w-full rounded-xs shadow-md flex items-center justify-between px-4 ${
                                isFloorZone
                                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-t-2 border-slate-950'
                                  : lvl === 0
                                  ? 'bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 border-t-2 border-yellow-400'
                                  : 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 border-y border-orange-300/50'
                              }`}
                            >
                              <span className="text-[8px] font-mono font-black text-slate-950 uppercase tracking-widest">
                                {isFloorZone
                                  ? `ŻÓŁTA LINIA WYZNACZAJĄCA MIEJSCA PALETOWE NA PODŁODZE (${rack.code})`
                                  : lvl === 0
                                  ? `POSADZKA MAGAZYNOWA (${rack.code} — POZIOM P0)`
                                  : `BELKA NOŚNA TRAWERS (${rack.code} — POZIOM P${lvl})`}
                              </span>
                              <span className="text-[8px] font-mono font-black text-slate-950">
                                {isFloorZone ? 'STREFA PODŁOGOWA P0' : 'MAX UDŹWIG PALETY: 1000 KG'}
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
