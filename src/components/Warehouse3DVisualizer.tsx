import React, { useState } from 'react';
import {
  SpatialWarehouse,
  WarehouseRack,
  WarehouseLocationSlot,
  ProductCatalogItem,
} from '../types/wms';
import { getMonthsUntilExpiry, isEligibleForPartner12Months } from '../utils/wfirmaParser';
import { getBatchCartonBreakdown } from '../utils/wmsEngine';
import { Compass, ArrowRight, GripVertical } from 'lucide-react';

interface Warehouse3DVisualizerProps {
  warehouse: SpatialWarehouse;
  racks: WarehouseRack[];
  slots: WarehouseLocationSlot[];
  productMap: Map<string, ProductCatalogItem>;
  selectedSlotId: string | null;
  draggedSlotId?: string | null;
  onDragStartSlot?: (slotId: string) => void;
  onDragEndSlot?: () => void;
  onDropSlot?: (fromSlotId: string, toSlotId: string) => void;
  slotMatchesSearch: (slot: WarehouseLocationSlot) => boolean;
  filterZone: 'ALL' | 'picking' | 'pallet' | 'floor_pallet' | 'short_mhd' | 'custom_items';
  onSelectSlot: (slot: WarehouseLocationSlot) => void;
}

export const Warehouse3DVisualizer: React.FC<Warehouse3DVisualizerProps> = ({
  warehouse,
  racks,
  slots,
  productMap,
  selectedSlotId,
  draggedSlotId,
  onDragStartSlot,
  onDragEndSlot,
  onDropSlot,
  slotMatchesSearch,
  filterZone,
  onSelectSlot,
}) => {
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [activeColorFilter, setActiveColorFilter] = useState<
    'ALL' | 'partner_pink' | 'first_yellow' | 'red_short_6m' | 'product_green' | 'sf' | 'materials'
  >('ALL');

  /**
   * 6-kolorowy system oznaczeń palet:
   * 1. 🟪 Fioletowy — SF (Sample Folders / Próbki)
   * 2. 🟦 Niebieski — Kartony / Torby / Pozostałe materiały
   * 3. 🟥 Czerwony — Palety z datą ważności poniżej 6 miesięcy (< 6 msc)
   * 4. 🩷 Różowy — Palety z etykietą PARTNER (nigdy poniżej 12 msc: >= 12 msc)
   * 5. 🟨 Żółty — Palety pierwsze do wyjścia (firstToExit)
   * 6. 🟩 Zielony — Pozostałe miejsca na produkty
   */
  const getSlotColorAndBadge = (slot: WarehouseLocationSlot) => {
    const activeAllocs = slot.allocations.filter((a) => a.quantity > 0);
    const hasDescOnly =
      activeAllocs.length === 0 && Boolean(slot.customDescription && slot.customDescription.trim());

    // 1. SF (Sample Folders / Próbki) -> FIOLETOWY
    const isSfPallet =
      activeAllocs.some((a) => {
        const prod = productMap.get(a.productId);
        if (prod?.category === 'sample') return true;
        const text = `${a.customName || ''} ${a.palletLabel || ''} ${a.notes || ''} ${prod?.shortName || ''} ${prod?.name || ''}`;
        return /\bsf\b|sample\s*folder|próbk/i.test(text);
      }) || /\bsf\b|sample\s*folder|próbk/i.test(slot.customDescription || '');

    if (isSfPallet) {
      return {
        category: 'sf' as const,
        tileClass:
          'bg-violet-600/50 border-violet-300 text-violet-50 hover:bg-violet-600/65 shadow-sm',
        barClass: 'bg-violet-300',
        badgeText: '🟪 SF',
        badgeClass: 'bg-violet-950/80 text-violet-200 border border-violet-400/60',
      };
    }

    // 2. Kartony / Torby / Pozostałe materiały -> NIEBIESKI
    const isMaterialsPallet =
      hasDescOnly ||
      (activeAllocs.length > 0 &&
        activeAllocs.every((a) => {
          const prod = productMap.get(a.productId);
          return a.isCustomItem || a.productId === 'CUSTOM' || prod?.category === 'accessory';
        }));

    if (isMaterialsPallet) {
      return {
        category: 'materials' as const,
        tileClass:
          'bg-blue-600/50 border-blue-300 text-blue-50 hover:bg-blue-600/65 shadow-sm',
        barClass: 'bg-blue-300',
        badgeText: '🟦 MATERIAŁY',
        badgeClass: 'bg-blue-950/80 text-blue-200 border border-blue-400/60',
      };
    }

    // 3. Palety z datą ważności poniżej 6 miesięcy (< 6 msc) -> CZERWONY
    const hasBelow6Months = activeAllocs.some(
      (a) =>
        !a.isCustomItem &&
        a.productId !== 'CUSTOM' &&
        Boolean(a.expiryDate) &&
        getMonthsUntilExpiry(a.expiryDate) < 6
    );

    if (hasBelow6Months) {
      return {
        category: 'red_short_6m' as const,
        tileClass:
          'bg-red-600/55 border-red-300 text-red-50 hover:bg-red-600/70 shadow-sm',
        barClass: 'bg-red-300',
        badgeText: '🟥 <6 MSC',
        badgeClass: 'bg-red-950/85 text-red-200 border border-red-400/70',
      };
    }

    // 4. Etykieta PARTNER (miejsca PARTNER nie są poniżej 12 msc: >= 12 msc) -> RÓŻOWY
    const hasPartnerLabel = activeAllocs.some(
      (a) =>
        !a.isCustomItem &&
        a.productId !== 'CUSTOM' &&
        Boolean(a.dedicatedForPartnerOnly) &&
        isEligibleForPartner12Months(a.expiryDate)
    );

    if (hasPartnerLabel) {
      return {
        category: 'partner_pink' as const,
        tileClass:
          'bg-pink-500/50 border-pink-300 text-pink-50 hover:bg-pink-500/65 shadow-sm',
        barClass: 'bg-pink-300',
        badgeText: '🩷 PARTNER',
        badgeClass: 'bg-pink-950/80 text-pink-200 border border-pink-300/70',
      };
    }

    // 5. Palety pierwsze do wyjścia -> ŻÓŁTY
    const isFirstToExit = activeAllocs.some(
      (a) =>
        Boolean(a.firstToExit) ||
        /1\.?\s*do\s*wyj[śs]cia|pierwsz[ae]\s*do\s*wyj[śs]cia/i.test(a.palletLabel || '') ||
        /1\.?\s*do\s*wyj[śs]cia|pierwsz[ae]\s*do\s*wyj[śs]cia/i.test(a.notes || '')
    );

    if (isFirstToExit) {
      return {
        category: 'first_yellow' as const,
        tileClass:
          'bg-yellow-400/40 border-yellow-300 text-yellow-50 hover:bg-yellow-400/55 shadow-sm',
        barClass: 'bg-yellow-300',
        badgeText: '🟨 1. DO WYJŚCIA',
        badgeClass: 'bg-yellow-950/85 text-yellow-200 border border-yellow-300/70',
      };
    }

    // 6. Pozostałe miejsca na produkty -> ZIELONY
    return {
      category: 'product_green' as const,
      tileClass:
        'bg-emerald-600/45 border-emerald-400 text-emerald-50 hover:bg-emerald-600/60 shadow-sm',
      barClass: 'bg-emerald-400',
      badgeText: '',
      badgeClass: '',
    };
  };

  const allWhRacks = racks.filter((r) => r.warehouseId === warehouse.id);

  const whRacks = allWhRacks.filter((r) => {
    if (filterZone === 'picking') return r.zoneType === 'picking';
    if (filterZone === 'pallet') return r.zoneType === 'pallet';
    if (filterZone === 'floor_pallet')
      return r.zoneType === 'floor_pallet' || r.hallPlacement === 'floor_zone';
    return true;
  });

  // Podział regałów i stref w prostokątnej hali:
  // 1) Bok Górny (od lewej strony od bramy: Regał 1, Regał 2, Regał 3)
  // 2) Środek hali: Strefa przemieszczania się + Miejsca paletowe na podłodze (P0)
  // 3) Bok Dolny (od lewej strony od bramy: Regał 4, Regał 5, Regał 6)
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

  // Liczniki palet w każdym z 6 kolorów w aktualnie wybranym magazynie
  const colorCounts = occupiedWhSlots.reduce(
    (acc, slot) => {
      const info = getSlotColorAndBadge(slot);
      acc[info.category] = (acc[info.category] || 0) + 1;
      return acc;
    },
    {
      partner_pink: 0,
      first_yellow: 0,
      red_short_6m: 0,
      product_green: 0,
      sf: 0,
      materials: 0,
    }
  );

  // Obsługa Drag & Drop kafelka
  const handleSlotDragStart = (e: React.DragEvent, slot: WarehouseLocationSlot) => {
    e.dataTransfer.setData('text/plain', slot.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartSlot?.(slot.id);
  };

  const handleSlotDragOver = (e: React.DragEvent, slot: WarehouseLocationSlot) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlotId !== slot.id) {
      setDragOverSlotId(slot.id);
    }
  };

  const handleSlotDragLeave = (slot: WarehouseLocationSlot) => {
    if (dragOverSlotId === slot.id) {
      setDragOverSlotId(null);
    }
  };

  const handleSlotDrop = (e: React.DragEvent, targetSlot: WarehouseLocationSlot) => {
    e.preventDefault();
    setDragOverSlotId(null);
    const sourceId = e.dataTransfer.getData('text/plain') || draggedSlotId;
    if (sourceId && sourceId !== targetSlot.id) {
      onDropSlot?.(sourceId, targetSlot.id);
    }
    onDragEndSlot?.();
  };

  // Renderuje pojedynczy regał na planie prostokątnej hali
  const renderRackOnFloorplan = (rack: WarehouseRack) => {
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
              {rack.name.split('(')[0].trim().toUpperCase()}
            </span>
            <span className="text-[11px] font-bold text-slate-200 truncate">
              {rack.name.includes('(') ? rack.name.slice(rack.name.indexOf('(')) : rack.code}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-teal-300 text-[10px] font-mono border border-slate-700">
              {rack.levelsCount * rack.slotsPerLevel} palet ({rack.levelsCount}×{rack.slotsPerLevel})
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
                <span className="w-14 shrink-0 text-[10px] font-mono font-bold text-slate-300 bg-slate-900 px-1.5 py-1.5 rounded text-center border border-slate-700">
                  {lvl === 2 ? 'POZ. II' : lvl === 1 ? 'POZ. I' : lvl === 0 ? 'POZ. 0' : `POZ. ${lvl}`}
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
                    const isBeingDragged = draggedSlotId === slot.id;
                    const isDropTarget =
                      dragOverSlotId === slot.id && draggedSlotId && draggedSlotId !== slot.id;

                    const hasCustom =
                      Boolean(slot.customDescription && slot.customDescription.trim()) ||
                      activeAllocs.some((a) => a.isCustomItem || a.productId === 'CUSTOM');
                    const hasShort = activeAllocs.some(
                      (a) =>
                        !a.isCustomItem &&
                        a.productId !== 'CUSTOM' &&
                        !isEligibleForPartner12Months(a.expiryDate)
                    );

                    if (filterZone === 'short_mhd' && !hasShort) {
                      return (
                        <div
                          key={slot.id}
                          className="rounded-lg border border-slate-800 bg-slate-900/30 opacity-25 p-2"
                        />
                      );
                    }
                    if (filterZone === 'custom_items' && !hasCustom) {
                      return (
                        <div
                          key={slot.id}
                          className="rounded-lg border border-slate-800 bg-slate-900/30 opacity-25 p-2"
                        />
                      );
                    }

                    const firstAlloc = activeAllocs[0];
                    const firstProd = firstAlloc ? productMap.get(firstAlloc.productId) : undefined;
                    const cartonInfo = firstAlloc ? getBatchCartonBreakdown(firstAlloc) : null;
                    const visualInfo = !isEmpty ? getSlotColorAndBadge(slot) : null;
                    const rawShortLabel =
                      firstAlloc?.isCustomItem || firstAlloc?.productId === 'CUSTOM'
                        ? firstAlloc?.customName || slot.customDescription || 'Opis ręczny'
                        : (firstProd?.shortName || slot.customDescription || 'Wolne')
                            .replace(/omni[\s-]*biotic®?\s*/gi, '')
                            .replace(/omni[\s-]*logic®?\s*/gi, '');

                    const parts = rawShortLabel.split('•').map((s) => s.trim());
                    const primaryType = parts[0] || rawShortLabel;
                    const variantLabel = parts[1] || '';
                    const isCombinedPallet = activeAllocs.length > 1;
                    const mhdShort =
                      firstAlloc?.expiryDate && firstAlloc.expiryDate.length >= 7
                        ? `${firstAlloc.expiryDate.slice(5, 7)}_${firstAlloc.expiryDate.slice(2, 4)}`
                        : '';

                    const allItemsTooltip = activeAllocs
                      .map((a) => {
                        const p = productMap.get(a.productId);
                        const lbl = a.isCustomItem ? a.customName : p?.shortName || a.productId;
                        const exp =
                          a.expiryDate && a.expiryDate.length >= 7
                            ? ` (${a.expiryDate.slice(5, 7)}_${a.expiryDate.slice(2, 4)})`
                            : '';
                        return `${lbl}: ${a.quantity} ${a.customUnit || 'szt.'}${exp}`;
                      })
                      .join(' + ');

                    const matchesColorFilter =
                      activeColorFilter === 'ALL' ||
                      (!isEmpty && visualInfo?.category === activeColorFilter);

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        draggable={!isEmpty}
                        onDragStart={(e) => handleSlotDragStart(e, slot)}
                        onDragEnd={() => {
                          setDragOverSlotId(null);
                          onDragEndSlot?.();
                        }}
                        onDragOver={(e) => handleSlotDragOver(e, slot)}
                        onDragLeave={() => handleSlotDragLeave(slot)}
                        onDrop={(e) => handleSlotDrop(e, slot)}
                        onClick={() => onSelectSlot(slot)}
                        title={
                          isEmpty
                            ? `${slot.code}: Wolne miejsce (Upuść tutaj paletę lub kliknij, aby dodać)`
                            : `${slot.code}: ${allItemsTooltip}${
                                cartonInfo?.hasCartons ? ` | ${cartonInfo.fullDescription}` : ''
                              } — Kliknij aby zmienić etykietę PARTNER / 1. do wyjścia lub przeciągnij myszką!`
                        }
                        className={`group rounded-lg p-2 border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[76px] select-none ${
                          !isEmpty ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        } ${!matchesColorFilter ? 'opacity-20 scale-95' : ''} ${
                          isDropTarget
                            ? 'bg-cyan-400 text-slate-950 border-white ring-4 ring-cyan-300 scale-105 z-20 shadow-xl'
                            : isBeingDragged
                            ? 'opacity-45 border-dashed border-amber-400 ring-2 ring-amber-400 scale-95'
                            : isMatched
                            ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-300 scale-105 z-10'
                            : isSelected
                            ? 'bg-teal-500 text-slate-950 border-white ring-2 ring-teal-300 z-10'
                            : isEmpty
                            ? 'bg-slate-900/60 border-dashed border-slate-600 text-slate-500 hover:border-slate-400'
                            : visualInfo?.tileClass || 'bg-emerald-600/45 border-emerald-400 text-emerald-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[9px] font-mono font-extrabold">
                          <span className="flex items-center gap-0.5 opacity-90">
                            {!isEmpty && (
                              <GripVertical className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                            )}
                            <span>{slot.position} PAL.</span>
                          </span>
                          {!isEmpty && (
                            <span className="font-black">
                              {isCombinedPallet
                                ? `${firstAlloc.quantity.toLocaleString('pl-PL')} (${totalQty.toLocaleString('pl-PL')})`
                                : totalQty.toLocaleString('pl-PL')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 leading-tight">
                          {isDropTarget ? (
                            <div className="text-[10px] font-black uppercase tracking-tight text-slate-950">
                              {isEmpty ? '📥 UPUŚĆ TUTAJ' : '⇄ UPUŚĆ (ZAMIEŃ / POŁĄCZ)'}
                            </div>
                          ) : isEmpty ? (
                            <div className="text-[10px] font-semibold opacity-60">Wolne</div>
                          ) : (
                            <>
                              {visualInfo?.badgeText && (
                                <div className="mb-0.5">
                                  <span
                                    className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase tracking-tight ${visualInfo.badgeClass}`}
                                  >
                                    {visualInfo.badgeText}
                                  </span>
                                </div>
                              )}
                              <div className="text-[11px] font-extrabold leading-tight break-words">
                                {primaryType}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {variantLabel && (
                                  <span className="text-[10px] font-mono font-bold opacity-95 leading-tight">
                                    {variantLabel}
                                  </span>
                                )}
                                {mhdShort && (
                                  <span className="text-[9px] font-mono font-bold bg-slate-950/45 px-1 rounded">
                                    {mhdShort}
                                  </span>
                                )}
                              </div>
                              {isCombinedPallet && (
                                <div className="mt-0.5 pt-0.5 border-t border-white/20 space-y-0.5">
                                  {activeAllocs.slice(1).map((extra) => {
                                    const ep = productMap.get(extra.productId);
                                    const elbl = extra.isCustomItem
                                      ? extra.customName || 'Inne'
                                      : ep?.shortName || extra.productId;
                                    const emhd =
                                      extra.expiryDate && extra.expiryDate.length >= 7
                                        ? ` (${extra.expiryDate.slice(5, 7)}_${extra.expiryDate.slice(2, 4)})`
                                        : '';
                                    return (
                                      <div
                                        key={extra.id}
                                        className="text-[9px] font-mono font-bold leading-tight opacity-95 truncate"
                                      >
                                        + {elbl}: {extra.quantity}
                                        {emhd}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {cartonInfo?.hasCartons && (
                                <div className="text-[9px] font-mono font-extrabold opacity-95 mt-0.5 bg-slate-950/40 px-1 py-0.5 rounded inline-block">
                                  {cartonInfo.shortBadge}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {!isEmpty && (
                          <div
                            className={`h-1 w-full rounded-full mt-1 ${
                              visualInfo?.barClass || 'bg-emerald-300'
                            }`}
                          />
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
    <div className="space-y-5">
      {/* Pasek nagłówka wybranego Magazynu */}
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
            <p className="text-xs text-slate-300 max-w-4xl">{warehouse.description}</p>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/70 border border-teal-500/40 text-xs text-teal-200 font-bold flex items-center gap-2">
            <span>🖐️</span>
            <span>Kliknij paletę aby dodać etykietę PARTNER (różowy) / 1. do wyjścia (żółty) lub przeciągnij myszką</span>
          </div>
        </div>

        {/* Szybkie liczniki dla tej hali + Interaktywna Legenda 6 kolorów na karcie */}
        <div className="mt-4 pt-3 border-t border-slate-700/80 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5">
              <span>
                Miejsca na regałach (Regał 1–6):{' '}
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

            {activeColorFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setActiveColorFilter('ALL')}
                className="px-3 py-1 rounded-lg bg-teal-500 text-slate-950 font-extrabold text-[11px] hover:bg-teal-400 cursor-pointer"
              >
                ✕ Pokaż wszystkie kolory ({occupiedWhSlots.length} palet)
              </button>
            )}
          </div>

          {/* KARTA LEGENDY KOLORÓW PALET W TYM MAGAZYNIE (KLIKNIJ ABY PODŚWIETLIĆ) */}
          <div className="bg-slate-950/75 rounded-2xl p-3 border border-slate-700/90">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-teal-300">
                🎨 Legenda Kolorów Palet — {warehouse.name} (Kliknij wybrany kolor, aby podświetlić palety na planie):
              </span>
              <span className="text-[11px] text-slate-400">
                 puste = szara przerywana ramka
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveColorFilter((prev) =>
                    prev === 'partner_pink' ? 'ALL' : 'partner_pink'
                  )
                }
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  activeColorFilter === 'partner_pink'
                    ? 'bg-pink-500/40 border-white ring-2 ring-pink-300 scale-[1.02]'
                    : 'bg-pink-500/20 border-pink-400/60 hover:bg-pink-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-pink-500 border border-pink-200 shrink-0" />
                  <div className="leading-tight">
                    <div className="font-extrabold text-pink-200 text-[11px]">🩷 PARTNER</div>
                    <div className="text-[10px] text-pink-100/80">Data &ge; 12 msc</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-pink-950/90 text-pink-200 font-mono text-[11px] font-black border border-pink-400/50">
                  {colorCounts.partner_pink}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveColorFilter((prev) =>
                    prev === 'first_yellow' ? 'ALL' : 'first_yellow'
                  )
                }
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  activeColorFilter === 'first_yellow'
                    ? 'bg-yellow-400/40 border-white ring-2 ring-yellow-300 scale-[1.02]'
                    : 'bg-yellow-400/20 border-yellow-300/60 hover:bg-yellow-400/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-yellow-400 border border-yellow-100 shrink-0" />
                  <div className="leading-tight">
                    <div className="font-extrabold text-yellow-200 text-[11px]">🟨 1. do wyjścia</div>
                    <div className="text-[10px] text-yellow-100/80">Pierwsze do wydania</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-yellow-950/90 text-yellow-200 font-mono text-[11px] font-black border border-yellow-400/50">
                  {colorCounts.first_yellow}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveColorFilter((prev) =>
                    prev === 'red_short_6m' ? 'ALL' : 'red_short_6m'
                  )
                }
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  activeColorFilter === 'red_short_6m'
                    ? 'bg-red-600/45 border-white ring-2 ring-red-300 scale-[1.02]'
                    : 'bg-red-600/25 border-red-400/60 hover:bg-red-600/35'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-red-600 border border-red-200 shrink-0" />
                  <div className="leading-tight">
                    <div className="font-extrabold text-red-200 text-[11px]">🟥 Data &lt; 6 msc</div>
                    <div className="text-[10px] text-red-100/80">Krótka data ważności</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-950/90 text-red-200 font-mono text-[11px] font-black border border-red-400/50">
                  {colorCounts.red_short_6m}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveColorFilter((prev) =>
                    prev === 'product_green' ? 'ALL' : 'product_green'
                  )
                }
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  activeColorFilter === 'product_green'
                    ? 'bg-emerald-600/45 border-white ring-2 ring-emerald-300 scale-[1.02]'
                    : 'bg-emerald-600/25 border-emerald-400/60 hover:bg-emerald-600/35'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500 border border-emerald-200 shrink-0" />
                  <div className="leading-tight">
                    <div className="font-extrabold text-emerald-200 text-[11px]">🟩 Produkty</div>
                    <div className="text-[10px] text-emerald-100/80">Pozostałe miejsca</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-200 font-mono text-[11px] font-black border border-emerald-400/50">
                  {colorCounts.product_green}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveColorFilter((prev) => (prev === 'sf' ? 'ALL' : 'sf'))
                }
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  activeColorFilter === 'sf'
                    ? 'bg-violet-600/45 border-white ring-2 ring-violet-300 scale-[1.02]'
                    : 'bg-violet-600/25 border-violet-400/60 hover:bg-violet-600/35'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-violet-500 border border-violet-200 shrink-0" />
                  <div className="leading-tight">
                    <div className="font-extrabold text-violet-200 text-[11px]">🟪 SF (Próbki)</div>
                    <div className="text-[10px] text-violet-100/80">Sample Folders</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-violet-950/90 text-violet-200 font-mono text-[11px] font-black border border-violet-400/50">
                  {colorCounts.sf}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveColorFilter((prev) =>
                    prev === 'materials' ? 'ALL' : 'materials'
                  )
                }
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  activeColorFilter === 'materials'
                    ? 'bg-blue-600/45 border-white ring-2 ring-blue-300 scale-[1.02]'
                    : 'bg-blue-600/25 border-blue-400/60 hover:bg-blue-600/35'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-blue-500 border border-blue-200 shrink-0" />
                  <div className="leading-tight">
                    <div className="font-extrabold text-blue-200 text-[11px]">🟦 Materiały</div>
                    <div className="text-[10px] text-blue-100/80">Kartony / Torby / Inne</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-950/90 text-blue-200 font-mono text-[11px] font-black border border-blue-400/50">
                  {colorCounts.materials}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PROSTOKĄTNY RZUT PRZESTRZENNY HALI (Brama po lewej, Korytarz na środku, Regały 1-3 oraz 4-6 po bokach + Palety na podłodze) */}
      <div className="bg-slate-900 rounded-3xl p-5 border-2 border-slate-700 shadow-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 text-white">
            <Compass className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-300">
              Wizualizacja Hali — {warehouse.name} (Łap i puszczaj palety myszką pomiędzy miejscami lub kliknij, aby edytować)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Brama po lewej • Strefa przemieszczania na środku • Regały 1, 2, 3 (góra) oraz 4, 5, 6 (dół)
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
              <div className="text-[10px] font-mono text-slate-400 text-center py-2 border-b border-slate-800">
                ŚCIANA LEWA
              </div>

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

              <div className="text-[10px] font-mono text-slate-400 text-center py-2 border-t border-slate-800">
                ŚCIANA LEWA
              </div>
            </div>

            {/* WNĘTRZE PROSTOKĄTNEJ HALI: 3 PASY POZIOME */}
            <div className="flex-1 flex flex-col justify-between gap-4">
              {/* 1. BOK GÓRNY HALI (1–4 REGAŁ OD LEWEJ STRONY) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-teal-300">
                    ⬆️ BOK GÓRNY OD LEWEJ STRONY ({topWallRacks.map((r) => r.name.split('(')[0].trim()).join(', ')})
                  </span>
                </div>
                {topWallRacks.length > 0 ? (
                  <div
                    className="grid gap-3.5"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, topWallRacks.length)}, minmax(0, 1fr))`,
                    }}
                  >
                    {topWallRacks.map((rack) => renderRackOnFloorplan(rack))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
                    Brak regałów dla wybranego filtra.
                  </div>
                )}
              </div>

              {/* 2. ŚRODEK HALI: STREFA PRZEMIESZCZANIA SIĘ + MIEJSCA PALETOWE NA PODŁODZE */}
              <div className="rounded-2xl border-y-4 border-dashed border-amber-400/90 bg-slate-950/75 px-4 py-3.5 space-y-3 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono text-xs font-black">
                      ⇄ STREFA PRZEMIESZCZANIA SIĘ (ŚRODEK HALI)
                    </span>
                    <span className="text-xs font-bold text-amber-200">
                      Główny ciąg komunikacyjny od Bramy po lewej stronie przez środek magazynu ({warehouse.code})
                    </span>
                  </div>

                  {warehouse.hasPickingZone && (
                    <div className="px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 text-xs font-bold">
                      📦 Strefa Kompletacji i Pakowania Zamówień (WZ / RW)
                    </div>
                  )}
                </div>

                {/* WYDZIELONE MIEJSCA PALETOWE NA PODŁODZE */}
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
                            PODŁOGA ({floorRack.code})
                          </span>
                          <span className="text-xs font-extrabold text-amber-200">
                            {floorRack.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-300 font-bold">
                          {floorSlots.length} miejsc paletowych na podłodze (1–12 PALETA)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                        {floorSlots.map((slot) => {
                          const activeAllocs = slot.allocations.filter((a) => a.quantity > 0);
                          const totalQty = activeAllocs.reduce((acc, a) => acc + a.quantity, 0);
                          const isEmpty =
                            activeAllocs.length === 0 &&
                            !(slot.customDescription && slot.customDescription.trim());
                          const isMatched = slotMatchesSearch(slot);
                          const isSelected = selectedSlotId === slot.id;
                          const isBeingDragged = draggedSlotId === slot.id;
                          const isDropTarget =
                            dragOverSlotId === slot.id &&
                            draggedSlotId &&
                            draggedSlotId !== slot.id;

                          const hasCustom =
                            Boolean(slot.customDescription && slot.customDescription.trim()) ||
                            activeAllocs.some((a) => a.isCustomItem || a.productId === 'CUSTOM');

                          const firstAlloc = activeAllocs[0];
                          const firstProd = firstAlloc
                            ? productMap.get(firstAlloc.productId)
                            : undefined;
                          const cartonInfo = firstAlloc ? getBatchCartonBreakdown(firstAlloc) : null;
                          const visualInfo = !isEmpty ? getSlotColorAndBadge(slot) : null;
                          const rawShortLabel = hasCustom
                            ? firstAlloc?.customName || slot.customDescription || 'Opis ręczny'
                            : (firstProd?.shortName || 'Wolne pole na podłodze')
                                .replace(/omni[\s-]*biotic®?\s*/gi, '')
                                .replace(/omni[\s-]*logic®?\s*/gi, '');

                          const parts = rawShortLabel.split('•').map((s) => s.trim());
                          const primaryType = parts[0] || rawShortLabel;
                          const variantLabel = parts[1] || '';
                          const mhdShort =
                            firstAlloc?.expiryDate && firstAlloc.expiryDate.length >= 7
                              ? `${firstAlloc.expiryDate.slice(5, 7)}_${firstAlloc.expiryDate.slice(2, 4)}`
                              : '';

                          const matchesColorFilter =
                            activeColorFilter === 'ALL' ||
                            (!isEmpty && visualInfo?.category === activeColorFilter);

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              draggable={!isEmpty}
                              onDragStart={(e) => handleSlotDragStart(e, slot)}
                              onDragEnd={() => {
                                setDragOverSlotId(null);
                                onDragEndSlot?.();
                              }}
                              onDragOver={(e) => handleSlotDragOver(e, slot)}
                              onDragLeave={() => handleSlotDragLeave(slot)}
                              onDrop={(e) => handleSlotDrop(e, slot)}
                              onClick={() => onSelectSlot(slot)}
                              title={
                                isEmpty
                                  ? `${slot.code}: Wolne miejsce na podłodze`
                                  : `${slot.code}: ${rawShortLabel} (${totalQty} ${
                                      firstAlloc?.customUnit || 'szt.'
                                    })${cartonInfo?.hasCartons ? ` | ${cartonInfo.fullDescription}` : ''}`
                              }
                              className={`rounded-xl p-2 border-2 text-left transition-all select-none ${
                                !isEmpty ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                              } ${!matchesColorFilter ? 'opacity-20 scale-95' : ''} ${
                                isDropTarget
                                  ? 'bg-cyan-400 text-slate-950 border-white ring-4 ring-cyan-300 scale-105 z-20 shadow-xl'
                                  : isBeingDragged
                                  ? 'opacity-45 border-dashed border-amber-400 ring-2 ring-amber-400 scale-95'
                                  : isMatched
                                  ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-200 scale-105'
                                  : isSelected
                                  ? 'bg-teal-500 text-slate-950 border-white ring-2 ring-teal-300'
                                  : isEmpty
                                  ? 'bg-slate-900/75 border-dashed border-amber-400/50 text-amber-200/70 hover:border-amber-300'
                                  : visualInfo?.tileClass || 'bg-emerald-600/45 border-emerald-400 text-emerald-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-black">
                                <span className="flex items-center gap-0.5">
                                  {!isEmpty && <GripVertical className="w-3 h-3 opacity-70" />}
                                  <span>{slot.position} PALETA</span>
                                </span>
                                {mhdShort && (
                                  <span className="bg-slate-950/50 px-1 rounded text-white">
                                    {mhdShort}
                                  </span>
                                )}
                              </div>
                              {isDropTarget ? (
                                <div className="text-xs font-black uppercase mt-1 text-slate-950">
                                  {isEmpty ? '📥 UPUŚĆ PALETĘ TUTAJ' : '⇄ UPUŚĆ (ZAMIEŃ / POŁĄCZ)'}
                                </div>
                              ) : isEmpty ? (
                                <div className="text-xs font-extrabold mt-1 opacity-75">
                                  ➕ Wolne miejsce podłogowe
                                </div>
                              ) : (
                                <div className="mt-1 leading-tight">
                                  {visualInfo?.badgeText && (
                                    <div className="mb-0.5">
                                      <span
                                        className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase tracking-tight ${visualInfo.badgeClass}`}
                                      >
                                        {visualInfo.badgeText}
                                      </span>
                                    </div>
                                  )}
                                  <div className="text-xs font-extrabold break-words">
                                    {primaryType}
                                  </div>
                                  {variantLabel && (
                                    <div className="text-[10px] font-mono font-bold opacity-90">
                                      {variantLabel}
                                    </div>
                                  )}
                                  {cartonInfo?.hasCartons && (
                                    <div className="text-[10px] font-mono font-extrabold text-white mt-0.5 bg-slate-950/45 px-1.5 py-0.5 rounded inline-block">
                                      {cartonInfo.shortBadge}
                                    </div>
                                  )}
                                </div>
                              )}
                              {!isEmpty && !isDropTarget && (
                                <div className="flex items-center justify-between text-[10px] font-mono mt-1 opacity-95 font-bold">
                                  <span>
                                    {totalQty.toLocaleString('pl-PL')}{' '}
                                    {firstAlloc?.customUnit || 'szt.'}
                                  </span>
                                  <span>🟫 {firstAlloc?.palletLabel || 'Paleta EURO'}</span>
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

              {/* 3. BOK DOLNY HALI (5–7 / 5–8 REGAŁ OD LEWEJ STRONY) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-teal-300">
                    ⬇️ BOK DOLNY OD LEWEJ STRONY ({bottomWallRacks.map((r) => r.name.split('(')[0].trim()).join(', ')})
                  </span>
                </div>
                {bottomWallRacks.length > 0 ? (
                  <div
                    className="grid gap-3.5"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, bottomWallRacks.length)}, minmax(0, 1fr))`,
                    }}
                  >
                    {bottomWallRacks.map((rack) => renderRackOnFloorplan(rack))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
                    Brak regałów dla wybranego filtra.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
