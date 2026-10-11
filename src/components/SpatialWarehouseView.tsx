import React, { useState, useMemo, useEffect } from 'react';
import {
  WMSFullState,
  WarehouseLocationSlot,
  WarehouseRack,
  SpatialWarehouse,
  StockAllocationBatch,
} from '../types/wms';
import { getMonthsUntilExpiry, isEligibleForPartner12Months } from '../utils/wfirmaParser';
import { executeStockTransfer } from '../utils/wmsEngine';
import { Warehouse3DVisualizer } from './Warehouse3DVisualizer';
import {
  MapPin,
  Search,
  Plus,
  ArrowRightLeft,
  Package,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  Building2,
  Sparkles,
} from 'lucide-react';

interface SpatialWarehouseViewProps {
  state: WMSFullState;
  activeWarehouseId?: string;
  onSwitchWarehouseTab?: (whId: string) => void;
  workstationName: string;
  onUpdateState: (nextState: WMSFullState, summary: string) => void;
}

export const SpatialWarehouseView: React.FC<SpatialWarehouseViewProps> = ({
  state,
  activeWarehouseId,
  onSwitchWarehouseTab,
  workstationName,
  onUpdateState,
}) => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    activeWarehouseId || state.warehouses[0]?.id || 'wh-mag-4'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterZone, setFilterZone] = useState<'ALL' | 'picking' | 'pallet' | 'short_mhd' | 'custom_items'>('ALL');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (activeWarehouseId) {
      setSelectedWarehouseId(activeWarehouseId);
      setNewRackWhId(activeWarehouseId);
    }
  }, [activeWarehouseId]);

  // Modale kreatora przestrzeni (Dodaj Magazyn / Dodaj Regał)
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [newWhCode, setNewWhCode] = useState('');
  const [newWhDesc, setNewWhDesc] = useState('');
  const [newWhHasPicking, setNewWhHasPicking] = useState(true);

  const [showAddRackModal, setShowAddRackModal] = useState(false);
  const [newRackWhId, setNewRackWhId] = useState(activeWarehouseId || state.warehouses[0]?.id || 'wh-mag-4');
  const [newRackCode, setNewRackCode] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const [newRackZoneType, setNewRackZoneType] = useState<'picking' | 'pallet' | 'samples_kits'>('pallet');
  const [newRackSlotType, setNewRackSlotType] = useState<WarehouseLocationSlot['slotType']>('pallet_storage');
  const [newRackLevels, setNewRackLevels] = useState(3);
  const [newRackSlotsPerLevel, setNewRackSlotsPerLevel] = useState(5);
  const [newRackMaxCap, setNewRackMaxCap] = useState(1500);

  // Formularz alokacji nowej partii lub ręcznego opisu na wybranym miejscu
  const [showAddBatchForm, setShowAddBatchForm] = useState(false);
  const [allocMode, setAllocMode] = useState<'catalog' | 'custom'>('catalog');
  const [allocProductId, setAllocProductId] = useState(state.products[0]?.id || '');
  const [allocCustomName, setAllocCustomName] = useState<string>('');
  const [allocCustomUnit, setAllocCustomUnit] = useState<string>('szt.');
  const [allocCustomNotes, setAllocCustomNotes] = useState<string>('');
  const [allocQty, setAllocQty] = useState<number>(50);
  const [allocLot, setAllocLot] = useState<string>('LOT-2026');
  const [allocExpiry, setAllocExpiry] = useState<string>('2028-06-30');
  const [allocPalletLabel, setAllocPalletLabel] = useState<string>('Paleta #1');

  // Edycja ręcznego opisu samego miejsca paletowego (slot.customDescription)
  const [editingSlotDesc, setEditingSlotDesc] = useState(false);
  const [slotDescInput, setSlotDescInput] = useState('');

  // Formularz przesunięcia partii z wybranego miejsca na inne
  const [transferBatch, setTransferBatch] = useState<StockAllocationBatch | null>(null);
  const [transferTargetSlotId, setTransferTargetSlotId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(10);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Edycja istniejącej partii / pozycji ręcznej na miejscu
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editCustomName, setEditCustomName] = useState<string>('');
  const [editCustomUnit, setEditCustomUnit] = useState<string>('szt.');
  const [editQty, setEditQty] = useState<number>(0);
  const [editLot, setEditLot] = useState<string>('');
  const [editExpiry, setEditExpiry] = useState<string>('');
  const [editPalletLabel, setEditPalletLabel] = useState<string>('');

  const productMap = useMemo(
    () => new Map(state.products.map((p) => [p.id, p])),
    [state.products]
  );

  const selectedSlot = useMemo(
    () => state.slots.find((s) => s.id === selectedSlotId) || null,
    [state.slots, selectedSlotId]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  // Sprawdź czy dane gniazdo zawiera szukany produkt / ręczny opis / serię LOT / kod
  const slotMatchesSearch = (slot: WarehouseLocationSlot): boolean => {
    if (!normalizedSearch) return false;
    if (
      slot.code.toLowerCase().includes(normalizedSearch) ||
      slot.name.toLowerCase().includes(normalizedSearch) ||
      (slot.customDescription || '').toLowerCase().includes(normalizedSearch)
    ) {
      return true;
    }
    return slot.allocations.some((batch) => {
      if (batch.quantity <= 0) return false;
      const customMatch =
        (batch.customName || '').toLowerCase().includes(normalizedSearch) ||
        (batch.notes || '').toLowerCase().includes(normalizedSearch);
      const prod = productMap.get(batch.productId);
      const lotMatch = (batch.lotNumber || '').toLowerCase().includes(normalizedSearch);
      const labelMatch = (batch.palletLabel || '').toLowerCase().includes(normalizedSearch);
      const prodMatch =
        prod &&
        (prod.name.toLowerCase().includes(normalizedSearch) ||
          prod.shortName.toLowerCase().includes(normalizedSearch) ||
          prod.baseEan.toLowerCase().includes(normalizedSearch) ||
          prod.skuRegular.toLowerCase().includes(normalizedSearch));
      return Boolean(customMatch || lotMatch || labelMatch || prodMatch);
    });
  };

  const visibleWarehouses = useMemo(() => {
    if (selectedWarehouseId === 'ALL') return state.warehouses;
    return state.warehouses.filter((w) => w.id === selectedWarehouseId);
  }, [state.warehouses, selectedWarehouseId]);

  // Statystyki przestrzeni
  const spatialStats = useMemo(() => {
    let totalSlots = state.slots.length;
    let occupiedSlots = 0;
    let pickingUnits = 0;
    let pickingPartner12mUnits = 0;
    let palletUnits = 0;
    let shortDateBatchesCount = 0;
    let customItemsCount = 0;

    for (const s of state.slots) {
      const activeAllocs = s.allocations.filter((a) => a.quantity > 0);
      if (activeAllocs.length > 0 || (s.customDescription && s.customDescription.trim())) {
        occupiedSlots++;
      }
      for (const a of activeAllocs) {
        const isCustom = Boolean(a.isCustomItem || a.productId === 'CUSTOM');
        if (isCustom) {
          customItemsCount++;
          continue;
        }
        if (s.slotType === 'picking_standard') pickingUnits += a.quantity;
        else if (s.slotType === 'picking_partner_12m') pickingPartner12mUnits += a.quantity;
        else palletUnits += a.quantity;

        if (!isEligibleForPartner12Months(a.expiryDate)) {
          shortDateBatchesCount++;
        }
      }
    }

    return {
      totalSlots,
      occupiedSlots,
      freeSlots: totalSlots - occupiedSlots,
      pickingUnits,
      pickingPartner12mUnits,
      palletUnits,
      shortDateBatchesCount,
      customItemsCount,
    };
  }, [state.slots]);

  // Dodawanie nowego magazynu
  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim()) return;
    const id = `wh-${Date.now()}`;
    const code = (newWhCode.trim() || `MAG-${state.warehouses.length + 1}`).toUpperCase();
    const newWh: SpatialWarehouse = {
      id,
      code,
      name: newWhName.trim(),
      description: newWhDesc.trim() || 'Magazyn utworzony w kreatorze przestrzennym.',
      hasPickingZone: newWhHasPicking,
    };
    const nextState: WMSFullState = {
      ...state,
      revision: state.revision + 1,
      updatedAt: new Date().toISOString(),
      warehouses: [...state.warehouses, newWh],
    };
    onUpdateState(nextState, `Dodano nowy magazyn: ${newWh.name}`);
    setNewWhName('');
    setNewWhCode('');
    setNewWhDesc('');
    setShowAddWarehouseModal(false);
    setSelectedWarehouseId(id);
  };

  // Dodawanie nowego regału wraz z automatycznym wygenerowaniem miejsc paletowych / półek
  const handleCreateRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackCode.trim() || !newRackName.trim()) return;
    const rackId = `rack-${Date.now()}`;
    const code = newRackCode.trim().toUpperCase();
    const levels = Math.max(1, Math.min(10, Number(newRackLevels) || 1));
    const slotsPerLvl = Math.max(1, Math.min(20, Number(newRackSlotsPerLevel) || 1));

    const newRack: WarehouseRack = {
      id: rackId,
      warehouseId: newRackWhId,
      code,
      name: newRackName.trim(),
      zoneType: newRackZoneType,
      levelsCount: levels,
      slotsPerLevel: slotsPerLvl,
      colorTheme:
        newRackSlotType === 'picking_partner_12m'
          ? 'violet'
          : newRackSlotType === 'picking_standard'
          ? 'emerald'
          : 'blue',
    };

    const generatedSlots: WarehouseLocationSlot[] = [];
    for (let lvl = 0; lvl < levels; lvl++) {
      for (let pos = 1; pos <= slotsPerLvl; pos++) {
        const posStr = String(pos).padStart(2, '0');
        generatedSlots.push({
          id: `slot-${rackId}-${lvl}-${pos}`,
          warehouseId: newRackWhId,
          rackId,
          code: `${code}-P${lvl}-${posStr}`,
          name: `${newRackName.trim()} (Poz. ${lvl}, M.${posStr})`,
          level: lvl,
          position: pos,
          slotType: newRackSlotType,
          maxCapacityUnits: Number(newRackMaxCap) || 1000,
          allocations: [],
        });
      }
    }

    const nextState: WMSFullState = {
      ...state,
      revision: state.revision + 1,
      updatedAt: new Date().toISOString(),
      racks: [...state.racks, newRack],
      slots: [...state.slots, ...generatedSlots],
    };

    onUpdateState(
      nextState,
      `Utworzono regał ${code} (${levels} poz. × ${slotsPerLvl} miejsc = ${generatedSlots.length} gniazd)`
    );
    setNewRackCode('');
    setNewRackName('');
    setShowAddRackModal(false);
  };

  // Zapis ręcznego opisu samego miejsca paletowego (slot.customDescription)
  const handleSaveSlotDescription = () => {
    if (!selectedSlot) return;
    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) =>
      s.id === selectedSlot.id ? { ...s, customDescription: slotDescInput.trim() } : s
    );
    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
      },
      `Zapisano opis miejsca ${selectedSlot.code}`
    );
    setEditingSlotDesc(false);
  };

  // Bezpośrednia alokacja produktu z katalogu LUB pozycji z ręcznym opisem na wybranym miejscu
  const handleAddAllocationToSelectedSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || allocQty <= 0) return;

    const nowIso = new Date().toISOString();

    if (allocMode === 'custom') {
      if (!allocCustomName.trim()) {
        alert('Wpisz ręczny opis pozycji (np. co przechowujesz na tym miejscu).');
        return;
      }

      const customDesc = allocCustomName.trim();
      const unit = allocCustomUnit.trim() || 'szt.';

      const nextSlots = state.slots.map((s) => {
        if (s.id !== selectedSlot.id) return s;
        return {
          ...s,
          allocations: [
            ...s.allocations,
            {
              id: `batch-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              productId: 'CUSTOM',
              isCustomItem: true,
              customName: customDesc,
              customUnit: unit,
              quantity: allocQty,
              lotNumber: '-',
              expiryDate: '',
              palletLabel: allocPalletLabel.trim() || 'Inne rzeczy / Opis ręczny',
              notes: allocCustomNotes.trim() || undefined,
              updatedAt: nowIso,
            },
          ],
        };
      });

      const historyEntry = {
        id: `mov-${Date.now()}`,
        timestamp: nowIso,
        type: 'MANUAL_ALLOC' as const,
        productId: 'CUSTOM',
        productName: `[Opis ręczny] ${customDesc}`,
        quantity: allocQty,
        lotNumber: '-',
        expiryDate: '-',
        toSlotCode: selectedSlot.code,
        performedBy: workstationName,
        notes: allocCustomNotes.trim() || `Dodano pozycję z opisem ręcznym na miejsce ${selectedSlot.code}`,
      };

      onUpdateState(
        {
          ...state,
          revision: state.revision + 1,
          updatedAt: nowIso,
          slots: nextSlots,
          movementsHistory: [historyEntry, ...state.movementsHistory],
        },
        `Dodano pozycję "${customDesc}" (${allocQty} ${unit}) na miejscu ${selectedSlot.code}`
      );
      setAllocCustomName('');
      setAllocCustomNotes('');
      setShowAddBatchForm(false);
      return;
    }

    if (!allocProductId) return;

    if (
      selectedSlot.slotType === 'picking_partner_12m' &&
      !isEligibleForPartner12Months(allocExpiry)
    ) {
      alert(
        `Zablokowano! Gniazdo ${selectedSlot.code} jest przeznaczone dla produktów PARTNER, które muszą mieć zawsze powyżej 12 miesięcy daty ważności (podano: ${allocExpiry}).`
      );
      return;
    }

    const prod = productMap.get(allocProductId);

    const nextSlots = state.slots.map((s) => {
      if (s.id !== selectedSlot.id) return s;
      const existingIdx = s.allocations.findIndex(
        (b) =>
          !b.isCustomItem &&
          b.productId === allocProductId &&
          b.lotNumber === allocLot.trim() &&
          b.expiryDate === allocExpiry
      );
      const nextAllocs = [...s.allocations];
      if (existingIdx !== -1) {
        nextAllocs[existingIdx] = {
          ...nextAllocs[existingIdx],
          quantity: nextAllocs[existingIdx].quantity + allocQty,
          updatedAt: nowIso,
        };
      } else {
        nextAllocs.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: allocProductId,
          quantity: allocQty,
          lotNumber: allocLot.trim() || 'LOT-2026',
          expiryDate: allocExpiry || '2028-06-30',
          dedicatedForPartnerOnly: s.slotType === 'picking_partner_12m',
          palletLabel: allocPalletLabel.trim() || 'Alokacja ręczna',
          updatedAt: nowIso,
        });
      }
      return { ...s, allocations: nextAllocs };
    });

    const historyEntry = {
      id: `mov-${Date.now()}`,
      timestamp: nowIso,
      type: 'MANUAL_ALLOC' as const,
      productId: allocProductId,
      productName: prod?.shortName || prod?.name || allocProductId,
      quantity: allocQty,
      lotNumber: allocLot.trim(),
      expiryDate: allocExpiry,
      toSlotCode: selectedSlot.code,
      performedBy: workstationName,
      notes: `Alokacja towaru na miejscu ${selectedSlot.code} (${allocPalletLabel})`,
    };

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
        movementsHistory: [historyEntry, ...state.movementsHistory],
      },
      `Zaalokowano ${allocQty} szt. ${prod?.shortName || ''} na miejscu ${selectedSlot.code}`
    );
    setShowAddBatchForm(false);
  };

  // Przesunięcie wybranej partii z bieżącego gniazda na inne gniazdo
  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !transferBatch || !transferTargetSlotId) return;

    const result = executeStockTransfer(state, {
      fromSlotId: selectedSlot.id,
      batchId: transferBatch.id,
      toSlotId: transferTargetSlotId,
      quantity: transferQty,
      performedBy: workstationName,
    });

    if (result.error) {
      setTransferError(result.error);
      return;
    }

    const targetSlot = state.slots.find((s) => s.id === transferTargetSlotId);
    const prod = productMap.get(transferBatch.productId);
    const itemLabel = transferBatch.isCustomItem
      ? transferBatch.customName || 'Pozycja własna'
      : prod?.shortName || '';
    onUpdateState(
      result.nextState,
      `Przesunięto ${transferQty} ${transferBatch.customUnit || 'szt.'} ${itemLabel} (${selectedSlot.code} ➔ ${targetSlot?.code || ''})`
    );
    setTransferBatch(null);
    setTransferError(null);
  };

  // Zapis edycji ilości / LOT / MHD / opisu ręcznego na gnieździe
  const handleSaveBatchEdit = (batch: StockAllocationBatch) => {
    if (!selectedSlot) return;
    const isCustom = Boolean(batch.isCustomItem || batch.productId === 'CUSTOM');

    if (
      !isCustom &&
      selectedSlot.slotType === 'picking_partner_12m' &&
      !isEligibleForPartner12Months(editExpiry)
    ) {
      alert(
        'Na gnieździe PARTNER (>12 msc) nie można zapisać partii z datą ważności poniżej 12 miesięcy!'
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) => {
      if (s.id !== selectedSlot.id) return s;
      return {
        ...s,
        allocations: s.allocations
          .map((b) =>
            b.id === batch.id
              ? {
                  ...b,
                  customName: isCustom ? editCustomName.trim() || b.customName : b.customName,
                  customUnit: isCustom ? editCustomUnit.trim() || 'szt.' : b.customUnit,
                  quantity: Math.max(0, Number(editQty) || 0),
                  lotNumber: isCustom ? '-' : editLot.trim(),
                  expiryDate: isCustom ? '' : editExpiry,
                  palletLabel: editPalletLabel.trim(),
                  updatedAt: nowIso,
                }
              : b
          )
          .filter((b) => b.quantity > 0),
      };
    });

    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
      },
      `Zaktualizowano pozycję na miejscu ${selectedSlot.code}`
    );
    setEditingBatchId(null);
  };

  const handleDeleteBatchFromSlot = (batch: StockAllocationBatch) => {
    if (!selectedSlot) return;
    const prod = productMap.get(batch.productId);
    const label = batch.isCustomItem ? batch.customName : prod?.shortName || batch.productId;
    if (
      !window.confirm(
        `Czy na pewno chcesz usunąć pozycję "${label}" (${batch.quantity} ${batch.customUnit || 'szt.'}) z miejsca ${selectedSlot.code}?`
      )
    ) {
      return;
    }
    const nowIso = new Date().toISOString();
    const nextSlots = state.slots.map((s) =>
      s.id === selectedSlot.id
        ? { ...s, allocations: s.allocations.filter((b) => b.id !== batch.id) }
        : s
    );
    onUpdateState(
      {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
      },
      `Usunięto pozycję "${label}" z miejsca ${selectedSlot.code}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Pasek podsumowania przestrzennego */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>Miejsca Magazynowe</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {spatialStats.occupiedSlots} / {spatialStats.totalSlots}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {spatialStats.freeSlots} wolnych
            </span>
          </div>
        </div>

        <div className="bg-emerald-50/90 rounded-2xl p-4 border border-emerald-200 shadow-xs">
          <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Strefa Kompletacji (Główna)</span>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-950 font-mono">
            {spatialStats.pickingUnits.toLocaleString('pl-PL')} <span className="text-sm font-normal">szt.</span>
          </div>
          <p className="text-[11px] text-emerald-800 mt-0.5">
            Wspólna dla PL i PARTNER (gdy MHD &gt; 12 msc)
          </p>
        </div>

        <div className="bg-violet-50/90 rounded-2xl p-4 border border-violet-200 shadow-xs">
          <div className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
            <span>Gniazda PARTNER (&gt;12 msc)</span>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-violet-950 font-mono">
            {spatialStats.pickingPartner12mUnits.toLocaleString('pl-PL')}{' '}
            <span className="text-sm font-normal">szt.</span>
          </div>
          <p className="text-[11px] text-violet-800 mt-0.5">
            Osobne miejsce, gdy główna partia ma &lt; 12 msc
          </p>
        </div>

        <div className="bg-blue-50/90 rounded-2xl p-4 border border-blue-200 shadow-xs">
          <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Zapas na Paletach i Półkach</span>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-blue-950 font-mono">
            {spatialStats.palletUnits.toLocaleString('pl-PL')} <span className="text-sm font-normal">szt.</span>
          </div>
          <p className="text-[11px] text-blue-800 mt-0.5">
            Miejsca paletowe dostaw PZ oraz regały próbek
          </p>
        </div>

        <div className="bg-amber-50/90 rounded-2xl p-4 border border-amber-200 shadow-xs">
          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Partie z datą &lt; 12 msc</span>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-amber-950 font-mono">
            {spatialStats.shortDateBatchesCount} <span className="text-sm font-normal">partii</span>
          </div>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Blokowane dla Partnerów (do sprzedaży zwykłej / promo)
          </p>
        </div>
      </div>

      {/* Pasek wyboru Magazynu (Osobne zakładki dla Magazynu 4, 5, 6), wyszukiwarki i Kreatora Przestrzennego */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {state.warehouses.map((wh) => {
              const whSlotsCount = state.slots.filter((s) => s.warehouseId === wh.id).length;
              const whOccupiedCount = state.slots.filter(
                (s) =>
                  s.warehouseId === wh.id &&
                  (s.allocations.some((a) => a.quantity > 0) ||
                    Boolean(s.customDescription && s.customDescription.trim()))
              ).length;
              const isSelected = selectedWarehouseId === wh.id;

              return (
                <button
                  key={wh.id}
                  type="button"
                  onClick={() => {
                    setSelectedWarehouseId(wh.id);
                    onSwitchWarehouseTab?.(wh.id);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-500/40'
                      : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-900'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>{wh.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-slate-950/30 text-teal-100' : 'bg-white text-slate-600'
                    }`}
                  >
                    {whOccupiedCount}/{whSlotsCount} miejsc
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedWarehouseId('ALL')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedWarehouseId === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pokaż wszystkie 3 naraz
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddWarehouseModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dodaj Magazyn</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedWarehouseId !== 'ALL') {
                  setNewRackWhId(selectedWarehouseId);
                }
                setShowAddRackModal(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dodaj Regał / Miejsca Paletowe</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj w Magazynie 4, 5, 6: wpisz nazwę produktu, ręczny opis rzeczy (np. kartony, roll-up), kod EAN lub LOT..."
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'Wszystkie strefy' },
              { id: 'picking', label: '🎯 Tylko Kompletacja' },
              { id: 'pallet', label: '📦 Tylko Palety' },
              { id: 'custom_items', label: `📝 Opis ręczny (${spatialStats.customItemsCount})` },
              { id: 'short_mhd', label: '⚠️ Krótka data (<12 msc)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterZone(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterZone === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Podpowiedź podczas wyszukiwania: w którym z 3 magazynów (Magazyn 4, 5, 6) znajduje się szukany towar */}
        {normalizedSearch && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-amber-950">
              🔍 Wyniki wyszukiwania dla „{searchQuery}” we wszystkich magazynach:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {state.warehouses.map((wh) => {
                const matchCount = state.slots.filter(
                  (s) => s.warehouseId === wh.id && slotMatchesSearch(s)
                ).length;
                return (
                  <button
                    key={wh.id}
                    type="button"
                    onClick={() => {
                      setSelectedWarehouseId(wh.id);
                      onSwitchWarehouseTab?.(wh.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-all ${
                      matchCount > 0
                        ? 'bg-amber-400 text-slate-950 border-amber-600 shadow-2xs'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    {wh.name}: {matchCount} miejsc
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* WIZUALIZACJA PRZESTRZENNA 3D HALI ORAZ KONSTRUKCJI REGAŁÓW Z PALETAMI EURO */}
      <div className="space-y-10">
        {visibleWarehouses.map((warehouse) => (
          <Warehouse3DVisualizer
            key={warehouse.id}
            warehouse={warehouse}
            racks={state.racks}
            slots={state.slots}
            productMap={productMap}
            selectedSlotId={selectedSlotId}
            slotMatchesSearch={slotMatchesSearch}
            filterZone={filterZone}
            onSelectSlot={(slot) => {
              setSelectedSlotId(slot.id);
              setSlotDescInput(slot.customDescription || '');
              setEditingSlotDesc(false);
              setShowAddBatchForm(false);
              setTransferBatch(null);
              setEditingBatchId(null);
            }}
          />
        ))}
      </div>

      {/* MODAL SZCZEGÓŁÓW WYBRANEGO MIEJSCA PALETOWEGO / GNIAZDA KOMPLETACJI */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300 font-mono text-sm font-extrabold">
                  {selectedSlot.code}
                </span>
                <div>
                  <h3 className="text-base font-extrabold">{selectedSlot.name}</h3>
                  <p className="text-xs text-slate-300">
                    Typ miejsca:{' '}
                    {selectedSlot.slotType === 'picking_standard'
                      ? '🎯 Magazyn 4 — Strefa Kompletacji Główna (Wspólna gdy MHD > 12 msc)'
                      : selectedSlot.slotType === 'picking_partner_12m'
                      ? '🟣 Magazyn 4 — Strefa Kompletacji PARTNER (Wymóg daty ważności > 12 miesięcy)'
                      : '📦 Miejsce Paletowe / Składowanie (Produkty lub Inne rzeczy opisywane ręcznie)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlotId(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Ręczny opis samego miejsca paletowego (notatka gniazda) */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    < MapPin className="w-4 h-4 text-amber-600" />
                    <span>Ręczny opis miejsca / notatka na gnieździe {selectedSlot.code}:</span>
                  </div>
                  {!editingSlotDesc && (
                    <button
                      type="button"
                      onClick={() => {
                        setSlotDescInput(selectedSlot.customDescription || '');
                        setEditingSlotDesc(true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{selectedSlot.customDescription ? 'Zmień opis miejsca' : 'Dodaj ręczny opis miejsca'}</span>
                    </button>
                  )}
                </div>

                {editingSlotDesc ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={slotDescInput}
                      onChange={(e) => setSlotDescInput(e.target.value)}
                      placeholder="Wpisz dowolny opis, np. Paleta z materiałami targowymi, Kartony zbiorcze, Zapas ulotek..."
                      className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-none focus:border-amber-600"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveSlotDescription}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                      >
                        Zapisz opis
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSlotDesc(false)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-600 cursor-pointer"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-700">
                    {selectedSlot.customDescription ? (
                      <span className="font-bold text-amber-950">📌 {selectedSlot.customDescription}</span>
                    ) : (
                      <span className="text-slate-400 italic">
                        Brak stałej notatki na tym miejscu (możesz opisać całe miejsce albo dodać poniżej konkretne pozycje ręczne lub produkty).
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Przyciski szybkich akcji na miejscu */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-slate-800">
                  Pozycje zaalokowane na tym miejscu ({selectedSlot.allocations.length})
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAllocMode('catalog');
                      setShowAddBatchForm(true);
                      setTransferBatch(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>📦 Alokuj produkt z katalogu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllocMode('custom');
                      setAllocQty(1);
                      setAllocCustomUnit('paleta');
                      setShowAddBatchForm(true);
                      setTransferBatch(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>✍️ Dodaj inną rzecz (Ręczny opis pozycji)</span>
                  </button>
                </div>
              </div>

              {/* Formularz alokacji nowego produktu LUB pozycji z ręcznym opisem na to miejsce */}
              {showAddBatchForm && (
                <form
                  onSubmit={handleAddAllocationToSelectedSlot}
                  className={`border-2 rounded-2xl p-4 space-y-3 ${
                    allocMode === 'custom'
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-teal-50/80 border-teal-300'
                  }`}
                >
                  {/* Przełącznik trybu: Produkt z katalogu vs Ręczny opis pozycji */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span>Dodaj pozycję na miejsce {selectedSlot.code}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setAllocMode('catalog');
                          setAllocQty(50);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          allocMode === 'catalog'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📦 Produkt z katalogu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAllocMode('custom');
                          setAllocQty(1);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          allocMode === 'custom'
                            ? 'bg-amber-500 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ✍️ Inna rzecz (Ręczny opis)
                      </button>
                    </div>
                  </div>

                  {allocMode === 'custom' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">
                          Ręczny opis pozycji (co przechowujesz na tym miejscu):
                        </label>
                        <input
                          type="text"
                          value={allocCustomName}
                          onChange={(e) => setAllocCustomName(e.target.value)}
                          placeholder="np. Kartony wysyłkowe duże, Standy drewniane, Roll-upy konferencyjne, Ulotki..."
                          className="w-full px-3 py-2 text-xs font-bold bg-white border border-amber-300 rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Ilość:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={allocQty}
                          onChange={(e) => setAllocQty(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Jednostka (np. paleta, szt., karton):
                        </label>
                        <select
                          value={allocCustomUnit}
                          onChange={(e) => setAllocCustomUnit(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                        >
                          <option value="paleta">paleta</option>
                          <option value="szt.">szt.</option>
                          <option value="karton">karton</option>
                          <option value="op.">op.</option>
                          <option value="kpl.">kpl.</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Dodatkowa notatka (opcjonalnie):
                        </label>
                        <input
                          type="text"
                          value={allocCustomNotes}
                          onChange={(e) => setAllocCustomNotes(e.target.value)}
                          placeholder="np. Dla działu marketingu"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Produkt z katalogu Eubiosis:
                        </label>
                        <select
                          value={allocProductId}
                          onChange={(e) => setAllocProductId(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                        >
                          {state.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.shortName} — {p.name} ({p.baseEan || p.skuRegular})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Ilość (szt.):
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={allocQty}
                          onChange={(e) => setAllocQty(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Numer serii (LOT):
                        </label>
                        <input
                          type="text"
                          value={allocLot}
                          onChange={(e) => setAllocLot(e.target.value)}
                          placeholder="np. 25E3475"
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Data ważności (MHD):
                        </label>
                        <input
                          type="date"
                          value={allocExpiry}
                          onChange={(e) => setAllocExpiry(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Oznaczenie palety / notatka:
                        </label>
                        <input
                          type="text"
                          value={allocPalletLabel}
                          onChange={(e) => setAllocPalletLabel(e.target.value)}
                          placeholder="np. Paleta #4 (Dostawa PZ)"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddBatchForm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer ${
                        allocMode === 'custom'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-teal-600 hover:bg-teal-700'
                      }`}
                    >
                      {allocMode === 'custom'
                        ? 'Zapisz ręczny opis pozycji'
                        : 'Zapisz alokację na miejscu'}
                    </button>
                  </div>
                </form>
              )}

              {/* Formularz przesunięcia wybranej partii na inne miejsce */}
              {transferBatch && (
                <form
                  onSubmit={handleConfirmTransfer}
                  className="bg-indigo-50/90 border-2 border-indigo-300 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                      <span>
                        Przesuń pozycję z miejsca {selectedSlot.code} (dostępne:{' '}
                        {transferBatch.quantity} {transferBatch.customUnit || 'szt.'})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferBatch(null);
                        setTransferError(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Zamknij
                    </button>
                  </div>

                  {transferError && (
                    <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs font-bold text-rose-900">
                      {transferError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Miejsce docelowe (gdzie przenieść):
                      </label>
                      <select
                        value={transferTargetSlotId}
                        onChange={(e) => setTransferTargetSlotId(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                        required
                      >
                        <option value="">-- Wybierz miejsce docelowe --</option>
                        {state.slots
                          .filter((s) => s.id !== selectedSlot.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name} (
                              {s.allocations.reduce((acc, a) => acc + a.quantity, 0)} jedn.)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Ilość do przesunięcia (max {transferBatch.quantity}{' '}
                        {transferBatch.customUnit || 'szt.'}):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={transferBatch.quantity}
                          value={transferQty}
                          onChange={(e) => setTransferQty(Number(e.target.value))}
                          className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setTransferQty(transferBatch.quantity)}
                          className="px-2.5 py-2 rounded-xl text-[11px] font-bold bg-indigo-100 text-indigo-900 hover:bg-indigo-200 cursor-pointer"
                        >
                          Całość ({transferBatch.quantity})
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Wykonaj przesunięcie</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Lista partii i pozycji ręcznych na tym miejscu */}
              {selectedSlot.allocations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm">
                  To miejsce jest obecnie puste. Kliknij{' '}
                  <strong>„📦 Alokuj produkt z katalogu”</strong> lub{' '}
                  <strong>„✍️ Dodaj inną rzecz (Ręczny opis pozycji)”</strong> powyżej.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedSlot.allocations.map((batch) => {
                    const isCustom = Boolean(batch.isCustomItem || batch.productId === 'CUSTOM');
                    const prod = productMap.get(batch.productId);
                    const monthsLeft = isCustom ? 99 : getMonthsUntilExpiry(batch.expiryDate);
                    const eligible12m = isCustom ? true : isEligibleForPartner12Months(batch.expiryDate);
                    const isEditing = editingBatchId === batch.id;

                    return (
                      <div
                        key={batch.id}
                        className={`p-4 rounded-2xl border flex flex-col gap-3 ${
                          isCustom
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900">
                                {isCustom
                                  ? batch.customName || 'Pozycja z ręcznym opisem'
                                  : prod?.name || batch.productId}
                              </span>
                              {isCustom ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-extrabold">
                                  📝 Inna rzecz / Ręczny opis pozycji
                                </span>
                              ) : eligible12m ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>OK dla PARTNER (&gt;12 msc: {monthsLeft} msc)</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-extrabold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Krótka data: {monthsLeft} msc (&lt;12 msc — tylko PL / Sklep)</span>
                                </span>
                              )}
                            </div>

                            {isCustom ? (
                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-1">
                                {batch.notes && (
                                  <span>
                                    Notatka: <strong className="text-slate-900">{batch.notes}</strong>
                                  </span>
                                )}
                                {batch.palletLabel && (
                                  <span className="text-amber-800 font-semibold">
                                    🏷️ {batch.palletLabel}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-1 font-mono">
                                <span>
                                  EAN: <strong>{prod?.baseEan || prod?.skuRegular}</strong>
                                </span>
                                <span>
                                  Seria LOT: <strong className="text-slate-900">{batch.lotNumber}</strong>
                                </span>
                                <span>
                                  Data MHD: <strong className="text-slate-900">{batch.expiryDate}</strong>
                                </span>
                                {batch.palletLabel && (
                                  <span className="text-indigo-700 font-sans font-semibold">
                                    🏷️ {batch.palletLabel}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-base font-extrabold text-teal-900">
                              {batch.quantity.toLocaleString('pl-PL')} {batch.customUnit || 'szt.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferBatch(batch);
                                setTransferQty(Math.min(50, batch.quantity));
                                setTransferTargetSlotId('');
                                setTransferError(null);
                                setShowAddBatchForm(false);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1"
                              title="Przesuń na inne miejsce"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Przesuń</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBatchId(isEditing ? null : batch.id);
                                setEditCustomName(batch.customName || '');
                                setEditCustomUnit(batch.customUnit || 'szt.');
                                setEditQty(batch.quantity);
                                setEditLot(batch.lotNumber);
                                setEditExpiry(batch.expiryDate);
                                setEditPalletLabel(batch.palletLabel || '');
                              }}
                              className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              title="Edytuj opis, ilość, serię LOT lub datę ważności"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBatchFromSlot(batch)}
                              className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 cursor-pointer"
                              title="Usuń tę pozycję z miejsca"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                            {isCustom ? (
                              <>
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Ręczny opis pozycji:
                                  </label>
                                  <input
                                    type="text"
                                    value={editCustomName}
                                    onChange={(e) => setEditCustomName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Ilość ({editCustomUnit}):
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editQty}
                                    onChange={(e) => setEditQty(Number(e.target.value))}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Ilość (szt.):
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editQty}
                                    onChange={(e) => setEditQty(Number(e.target.value))}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Seria LOT:
                                  </label>
                                  <input
                                    type="text"
                                    value={editLot}
                                    onChange={(e) => setEditLot(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    Data ważności MHD:
                                  </label>
                                  <input
                                    type="date"
                                    value={editExpiry}
                                    onChange={(e) => setEditExpiry(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                                  />
                                </div>
                              </>
                            )}
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveBatchEdit(batch)}
                                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                Zapisz
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBatchId(null)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-600 cursor-pointer"
                              >
                                Anuluj
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DODAJ NOWY MAGAZYN */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateWarehouse}
            className="bg-white rounded-3xl max-w-lg w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Dodaj nowy Magazyn</h3>
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nazwa magazynu:</label>
              <input
                type="text"
                value={newWhName}
                onChange={(e) => setNewWhName(e.target.value)}
                placeholder="np. Magazyn Zewnętrzny — Hala D"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kod skrócony:</label>
              <input
                type="text"
                value={newWhCode}
                onChange={(e) => setNewWhCode(e.target.value)}
                placeholder="np. MAG-HALA-D"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Opis przeznaczenia:</label>
              <input
                type="text"
                value={newWhDesc}
                onChange={(e) => setNewWhDesc(e.target.value)}
                placeholder="np. Składowanie palet z dostaw zewnętrznych"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={newWhHasPicking}
                onChange={(e) => setNewWhHasPicking(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600"
              />
              <span>Ten magazyn posiada własną Strefę Kompletacji</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
              >
                Utwórz Magazyn
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: DODAJ NOWY REGAŁ / MIEJSCA PALETOWE */}
      {showAddRackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRack}
            className="bg-white rounded-3xl max-w-lg w-full p-6 border-2 border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Kreator Regału i Miejsc Paletowych
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRackModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Wybierz magazyn:</label>
              <select
                value={newRackWhId}
                onChange={(e) => setNewRackWhId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
              >
                {state.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kod regału (np. PAL-D):
                </label>
                <input
                  type="text"
                  value={newRackCode}
                  onChange={(e) => setNewRackCode(e.target.value)}
                  placeholder="PAL-D"
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Typ miejsc na regale:
                </label>
                <select
                  value={newRackSlotType}
                  onChange={(e) => {
                    const val = e.target.value as WarehouseLocationSlot['slotType'];
                    setNewRackSlotType(val);
                    setNewRackZoneType(
                      val === 'picking_standard' || val === 'picking_partner_12m'
                        ? 'picking'
                        : 'pallet'
                    );
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                >
                  <option value="pallet_storage">📦 Miejsca Paletowe (Zapas PZ)</option>
                  <option value="picking_standard">🎯 Strefa Kompletacji (Główna)</option>
                  <option value="picking_partner_12m">🟣 Strefa Kompletacji PARTNER (&gt;12 msc)</option>
                  <option value="shelf_storage">🗄️ Regał Półkowy (Próbki / Zestawy)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nazwa regału:</label>
              <input
                type="text"
                value={newRackName}
                onChange={(e) => setNewRackName(e.target.value)}
                placeholder="np. Regał Paletowy D — Dostawy Nowe"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Liczba poziomów:
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={newRackLevels}
                  onChange={(e) => setNewRackLevels(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Miejsc na poziomie:
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newRackSlotsPerLevel}
                  onChange={(e) => setNewRackSlotsPerLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pojemność 1 miejsca:
                </label>
                <input
                  type="number"
                  min={10}
                  value={newRackMaxCap}
                  onChange={(e) => setNewRackMaxCap(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRackModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                Wygeneruj Regał ({newRackLevels * newRackSlotsPerLevel} miejsc)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
