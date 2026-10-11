import React, { useState, useMemo, useEffect } from 'react';
import {
  WMSFullState,
  WarehouseLocationSlot,
  WarehouseRack,
  SpatialWarehouse,
  StockAllocationBatch,
} from '../types/wms';
import { getMonthsUntilExpiry, isEligibleForPartner12Months } from '../utils/wfirmaParser';
import {
  executeStockTransfer,
  executeSlotDragAndDrop,
  getBatchCartonBreakdown,
  syncBatchCartonBreakdown,
} from '../utils/wmsEngine';
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
  const [filterZone, setFilterZone] = useState<
    'ALL' | 'picking' | 'pallet' | 'floor_pallet' | 'short_mhd' | 'custom_items'
  >('ALL');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Stan przeciągania kafelków palet (Drag & Drop - łapię i puszczam)
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    fromSlotId: string;
    toSlotId: string;
  } | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

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
  const [newRackZoneType, setNewRackZoneType] = useState<'picking' | 'pallet' | 'floor_pallet' | 'samples_kits'>('pallet');
  const [newRackPlacement, setNewRackPlacement] = useState<'top_wall' | 'bottom_wall' | 'floor_zone'>('top_wall');
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
  const [allocFullCartons, setAllocFullCartons] = useState<number>(2);
  const [allocUnitsPerCarton, setAllocUnitsPerCarton] = useState<number>(24);
  const [allocLooseUnits, setAllocLooseUnits] = useState<number>(2);
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
  const [transferFullCartons, setTransferFullCartons] = useState<number>(0);
  const [transferLooseUnits, setTransferLooseUnits] = useState<number>(10);
  const [transferQty, setTransferQty] = useState<number>(10);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Edycja istniejącej partii / pozycji ręcznej na miejscu
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editCustomName, setEditCustomName] = useState<string>('');
  const [editCustomUnit, setEditCustomUnit] = useState<string>('szt.');
  const [editFullCartons, setEditFullCartons] = useState<number>(0);
  const [editUnitsPerCarton, setEditUnitsPerCarton] = useState<number>(24);
  const [editLooseUnits, setEditLooseUnits] = useState<number>(0);
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

  // Dodawanie nowego regału lub strefy paletowej na podłodze
  const handleCreateRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackCode.trim() || !newRackName.trim()) return;
    const rackId = `rack-${Date.now()}`;
    const code = newRackCode.trim().toUpperCase();
    const isFloor = newRackPlacement === 'floor_zone' || newRackSlotType === 'floor_pallet';
    const levels = isFloor ? 1 : Math.max(1, Math.min(10, Number(newRackLevels) || 1));
    const slotsPerLvl = Math.max(1, Math.min(25, Number(newRackSlotsPerLevel) || 1));

    const newRack: WarehouseRack = {
      id: rackId,
      warehouseId: newRackWhId,
      code,
      name: newRackName.trim(),
      zoneType: isFloor ? 'floor_pallet' : newRackZoneType,
      hallPlacement: isFloor ? 'floor_zone' : newRackPlacement,
      levelsCount: levels,
      slotsPerLevel: slotsPerLvl,
      colorTheme: isFloor
        ? 'amber'
        : newRackSlotType === 'picking_partner_12m'
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
          name: isFloor
            ? `Miejsce Paletowe na Podłodze ${code} (Pole #${posStr})`
            : `${newRackName.trim()} (Poz. ${lvl}, M.${posStr})`,
          level: lvl,
          position: pos,
          slotType: isFloor ? 'floor_pallet' : newRackSlotType,
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
      const upcCustom = Math.max(0, Number(allocUnitsPerCarton) || 0);

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
              fullCartonsCount: upcCustom > 0 ? Math.max(0, Number(allocFullCartons) || 0) : undefined,
              unitsPerCarton: upcCustom > 0 ? upcCustom : undefined,
              looseUnitsInOpenCarton: upcCustom > 0 ? Math.max(0, Number(allocLooseUnits) || 0) : undefined,
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
    const upcCatalog = Math.max(0, Number(allocUnitsPerCarton) || 0);

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
        const merged = {
          ...nextAllocs[existingIdx],
          quantity: nextAllocs[existingIdx].quantity + allocQty,
          unitsPerCarton: upcCatalog > 0 ? upcCatalog : nextAllocs[existingIdx].unitsPerCarton,
          updatedAt: nowIso,
        };
        nextAllocs[existingIdx] = syncBatchCartonBreakdown(merged);
      } else {
        nextAllocs.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: allocProductId,
          quantity: allocQty,
          fullCartonsCount: upcCatalog > 0 ? Math.max(0, Number(allocFullCartons) || 0) : undefined,
          unitsPerCarton: upcCatalog > 0 ? upcCatalog : undefined,
          looseUnitsInOpenCarton: upcCatalog > 0 ? Math.max(0, Number(allocLooseUnits) || 0) : undefined,
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

  // Obsługa upuszczenia kafelka palety na inne miejsce (Drag & Drop - łapię i puszczam)
  const handleDropOnSlot = (fromSlotId: string, toSlotId: string) => {
    setDraggedSlotId(null);
    setDropError(null);
    if (!fromSlotId || !toSlotId || fromSlotId === toSlotId) return;

    const fromSlot = state.slots.find((s) => s.id === fromSlotId);
    const toSlot = state.slots.find((s) => s.id === toSlotId);
    if (!fromSlot || !toSlot) return;

    const toIsOccupied =
      toSlot.allocations.some((a) => a.quantity > 0) ||
      Boolean(toSlot.customDescription && toSlot.customDescription.trim());

    // Jeśli miejsce docelowe jest puste — od razu przenosimy całą paletę jednym ruchem
    if (!toIsOccupied) {
      const result = executeSlotDragAndDrop(state, {
        fromSlotId,
        toSlotId,
        mode: 'move_all',
        performedBy: workstationName,
      });
      if (result.error) {
        alert(result.error);
        return;
      }
      onUpdateState(result.nextState, result.summary || 'Przeniesiono paletę');
      return;
    }

    // Jeśli miejsce docelowe jest już zajęte — pokazujemy szybkie okienko wyboru (Zamień miejscami / Połącz / Przenieś część)
    setPendingDrop({ fromSlotId, toSlotId });
  };

  const handleExecutePendingDrop = (mode: 'move_all' | 'swap_slots') => {
    if (!pendingDrop) return;
    const result = executeSlotDragAndDrop(state, {
      fromSlotId: pendingDrop.fromSlotId,
      toSlotId: pendingDrop.toSlotId,
      mode,
      performedBy: workstationName,
    });
    if (result.error) {
      setDropError(result.error);
      return;
    }
    onUpdateState(result.nextState, result.summary || 'Przeniesiono paletę');
    setPendingDrop(null);
    setDropError(null);
  };

  const handleOpenPartialTransferFromDrop = () => {
    if (!pendingDrop) return;
    const fromSlot = state.slots.find((s) => s.id === pendingDrop.fromSlotId);
    if (!fromSlot) return;
    const firstBatch = fromSlot.allocations.find((a) => a.quantity > 0) || null;
    setSelectedSlotId(fromSlot.id);
    setSlotDescInput(fromSlot.customDescription || '');
    setEditingSlotDesc(false);
    setShowAddBatchForm(false);
    setEditingBatchId(null);
    if (firstBatch) {
      setTransferBatch(firstBatch);
      setTransferTargetSlotId(pendingDrop.toSlotId);
      const upc = Number(firstBatch.unitsPerCarton) || 0;
      setTransferFullCartons(upc > 0 ? Math.floor(firstBatch.quantity / upc) : 0);
      setTransferLooseUnits(upc > 0 ? firstBatch.quantity % upc : firstBatch.quantity);
      setTransferQty(firstBatch.quantity);
      setTransferError(null);
    }
    setPendingDrop(null);
    setDropError(null);
  };

  // Zapis edycji ilości / kartonów / LOT / MHD / opisu ręcznego na gnieździe
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
    const upcEdit = Math.max(0, Number(editUnitsPerCarton) || 0);
    const fullEdit = Math.max(0, Number(editFullCartons) || 0);
    const looseEdit = Math.max(0, Number(editLooseUnits) || 0);
    const finalQty = Math.max(0, Number(editQty) || 0);

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
                  quantity: finalQty,
                  fullCartonsCount: upcEdit > 0 ? fullEdit : undefined,
                  unitsPerCarton: upcEdit > 0 ? upcEdit : undefined,
                  looseUnitsInOpenCarton: upcEdit > 0 ? looseEdit : undefined,
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
      `Zaktualizowano pozycję i kartony na miejscu ${selectedSlot.code}`
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
                  onDragOver={(e) => {
                    if (draggedSlotId && selectedWarehouseId !== wh.id) {
                      e.preventDefault();
                      setSelectedWarehouseId(wh.id);
                      onSwitchWarehouseTab?.(wh.id);
                    }
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-500/40'
                      : draggedSlotId
                      ? 'bg-amber-50 text-amber-900 border border-dashed border-amber-400 hover:bg-amber-100'
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
              onDragOver={(e) => {
                if (draggedSlotId && selectedWarehouseId !== 'ALL') {
                  e.preventDefault();
                  setSelectedWarehouseId('ALL');
                }
              }}
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
              { id: 'picking', label: '🎯 Kompletacja' },
              { id: 'pallet', label: '📦 Regały Paletowe' },
              { id: 'floor_pallet', label: '🟨 Palety na Podłodze' },
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

        {/* Aktywny pasek podpowiedzi podczas przeciągania kafelka palety */}
        {draggedSlotId && (
          <div className="p-3 rounded-xl bg-teal-950 text-white border border-teal-500 flex flex-wrap items-center justify-between gap-2 text-xs shadow-md">
            <div className="flex items-center gap-2 font-bold">
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-extrabold">
                ✋ PRZECIĄGANIE PALETY
              </span>
              <span>
                Trzymasz kafelek miejsca{' '}
                <strong className="text-teal-300 font-mono">
                  {state.slots.find((s) => s.id === draggedSlotId)?.code}
                </strong>{' '}
                — upuść go na dowolne wolne lub zajęte miejsce na regale albo na podłodze (możesz też najechać kursorem na zakładkę innego magazynu powyżej!).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDraggedSlotId(null)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
            >
              Anuluj
            </button>
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
            draggedSlotId={draggedSlotId}
            onDragStartSlot={(slotId) => setDraggedSlotId(slotId)}
            onDragEndSlot={() => setDraggedSlotId(null)}
            onDropSlot={handleDropOnSlot}
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

      {/* SZYBKIE OKIENKO WYBORU PO UPUSZCZENIU PALETY NA ZAJĘTE MIEJSCE */}
      {pendingDrop && (() => {
        const fromSlot = state.slots.find((s) => s.id === pendingDrop.fromSlotId);
        const toSlot = state.slots.find((s) => s.id === pendingDrop.toSlotId);
        if (!fromSlot || !toSlot) return null;

        const describeSlot = (slot: WarehouseLocationSlot) => {
          const active = slot.allocations.filter((a) => a.quantity > 0);
          if (active.length > 0) {
            const b = active[0];
            const prod = productMap.get(b.productId);
            const name = b.isCustomItem ? b.customName : prod?.shortName || b.productId;
            const total = active.reduce((sum, item) => sum + item.quantity, 0);
            return `${name} (${total} ${b.customUnit || 'szt.'})`;
          }
          if (slot.customDescription) return `📝 ${slot.customDescription}`;
          return 'Puste miejsce';
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full border-2 border-teal-500 shadow-2xl overflow-hidden">
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ArrowRightLeft className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-extrabold">
                    Upuszczono paletę na zajęte miejsce
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDrop(null);
                    setDropError(null);
                  }}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200">
                    <div className="text-[10px] font-bold uppercase text-teal-700">
                      Z miejsca (Przeciągana):
                    </div>
                    <div className="font-mono font-extrabold text-sm text-slate-900 mt-0.5">
                      {fromSlot.code}
                    </div>
                    <div className="text-slate-700 font-semibold mt-1">
                      {describeSlot(fromSlot)}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <div className="text-[10px] font-bold uppercase text-amber-800">
                      Na miejsce (Docelowe):
                    </div>
                    <div className="font-mono font-extrabold text-sm text-slate-900 mt-0.5">
                      {toSlot.code}
                    </div>
                    <div className="text-slate-700 font-semibold mt-1">
                      {describeSlot(toSlot)}
                    </div>
                  </div>
                </div>

                {dropError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-900">
                    ⚠️ {dropError}
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleExecutePendingDrop('swap_slots')}
                    className="w-full p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-left transition-colors cursor-pointer flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <div className="text-sm font-extrabold">
                        ⇄ Zamień palety miejscami ({fromSlot.code} ↔ {toSlot.code})
                      </div>
                      <div className="text-[11px] text-indigo-100 mt-0.5">
                        Paleta z {fromSlot.code} trafi na {toSlot.code}, a paleta z {toSlot.code} na {fromSlot.code}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecutePendingDrop('move_all')}
                    className="w-full p-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-left transition-colors cursor-pointer flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <div className="text-sm font-extrabold">
                        📥 Przenieś wszystko i połącz na miejscu {toSlot.code}
                      </div>
                      <div className="text-[11px] text-teal-100 mt-0.5">
                        Miejsce {fromSlot.code} zostanie opróżnione, a towar dołączy do {toSlot.code}
                      </div>
                    </div>
                  </button>

                  {fromSlot.allocations.some((a) => a.quantity > 0) && (
                    <button
                      type="button"
                      onClick={handleOpenPartialTransferFromDrop}
                      className="w-full p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-left transition-colors cursor-pointer flex items-center justify-between border border-slate-300"
                    >
                      <div>
                        <div className="text-xs font-extrabold">
                          🔢 Przenieś tylko wybraną ilość sztuk...
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Otwórz okienko z wyborem dokładnej liczby sztuk do przeniesienia
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                      setAllocFullCartons(2);
                      setAllocUnitsPerCarton(24);
                      setAllocLooseUnits(2);
                      setAllocQty(2 * 24 + 2);
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
                      setAllocFullCartons(0);
                      setAllocUnitsPerCarton(0);
                      setAllocLooseUnits(0);
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
                          setAllocFullCartons(2);
                          setAllocUnitsPerCarton(24);
                          setAllocLooseUnits(2);
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
                          setAllocFullCartons(0);
                          setAllocUnitsPerCarton(0);
                          setAllocLooseUnits(0);
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

                  {/* NARZĘDZIE DLA MAGAZYNIERA: SZYBKI KALKULATOR KARTONÓW + OTWARTEGO KARTONU */}
                  <div className="bg-white/95 border-2 border-teal-400/80 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-teal-600" />
                        <span>
                          Kalkulator Kartonów i Sztuk (wpisz kartony, a system sam wyliczy łączną ilość):
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500 mr-1">
                          Szybkie pakowanie:
                        </span>
                        {[9, 12, 27, 45, 51, 54, 63, 72, 80, 81, 135].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setAllocUnitsPerCarton(preset);
                              const nextTotal =
                                Math.max(0, allocFullCartons) * preset +
                                Math.max(0, allocLooseUnits);
                              if (nextTotal > 0) setAllocQty(nextTotal);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer border ${
                              allocUnitsPerCarton === preset
                                ? 'bg-teal-600 text-white border-teal-700'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-teal-50'
                            }`}
                          >
                            po {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          1. Ilość pełnych kartonów:
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const fc = Math.max(0, allocFullCartons - 1);
                              setAllocFullCartons(fc);
                              if (allocUnitsPerCarton > 0) {
                                setAllocQty(fc * allocUnitsPerCarton + allocLooseUnits);
                              }
                            }}
                            className="px-2 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-black cursor-pointer border border-slate-300"
                            title="Odejmij 1 pełny karton"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={allocFullCartons === 0 ? '' : allocFullCartons}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const fc = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                              setAllocFullCartons(fc);
                              if (allocUnitsPerCarton > 0) {
                                setAllocQty(fc * allocUnitsPerCarton + allocLooseUnits);
                              }
                            }}
                            className="w-full px-2.5 py-2 text-xs font-mono font-extrabold bg-teal-50/50 border border-teal-300 rounded-xl text-center"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const fc = allocFullCartons + 1;
                              setAllocFullCartons(fc);
                              if (allocUnitsPerCarton > 0) {
                                setAllocQty(fc * allocUnitsPerCarton + allocLooseUnits);
                              }
                            }}
                            className="px-2 py-2 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 font-mono text-xs font-black cursor-pointer border border-teal-300"
                            title="Dodaj 1 pełny karton"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          2. Ilość w każdym kartonie:
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="np. 51"
                          value={allocUnitsPerCarton === 0 ? '' : allocUnitsPerCarton}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const upc = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                            setAllocUnitsPerCarton(upc);
                            if (upc > 0) {
                              setAllocQty(allocFullCartons * upc + allocLooseUnits);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-mono font-extrabold bg-teal-50/50 border border-teal-300 rounded-xl"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold text-slate-700">
                            3. W otwartym kartonie:
                          </label>
                          {allocLooseUnits > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setAllocLooseUnits(0);
                                if (allocUnitsPerCarton > 0) {
                                  setAllocQty(allocFullCartons * allocUnitsPerCarton);
                                }
                              }}
                              className="text-[9px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                            >
                              ✕ Brak otw.
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const loose = Math.max(0, allocLooseUnits - 1);
                              setAllocLooseUnits(loose);
                              if (allocUnitsPerCarton > 0) {
                                setAllocQty(allocFullCartons * allocUnitsPerCarton + loose);
                              }
                            }}
                            className="px-2 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-black cursor-pointer border border-slate-300"
                            title="Odejmij 1 szt. z otwartego kartonu"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            placeholder="Brak (0)"
                            value={allocLooseUnits === 0 ? '' : allocLooseUnits}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const loose = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                              setAllocLooseUnits(loose);
                              if (allocUnitsPerCarton > 0) {
                                setAllocQty(allocFullCartons * allocUnitsPerCarton + loose);
                              }
                            }}
                            className="w-full px-2.5 py-2 text-xs font-mono font-extrabold bg-amber-50/70 border border-amber-300 rounded-xl text-center placeholder:text-slate-400 placeholder:font-normal"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const loose = allocLooseUnits + 1;
                              setAllocLooseUnits(loose);
                              if (allocUnitsPerCarton > 0) {
                                setAllocQty(allocFullCartons * allocUnitsPerCarton + loose);
                              }
                            }}
                            className="px-2 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono text-xs font-black cursor-pointer border border-amber-300"
                            title="Dodaj 1 szt. w otwartym kartonie"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-teal-900 mb-1">
                          = Łączna ilość ({allocMode === 'custom' ? allocCustomUnit : 'szt.'}):
                        </label>
                        <input
                          type="number"
                          min={1}
                          placeholder="0"
                          value={allocQty === 0 ? '' : allocQty}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const total = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                            setAllocQty(total);
                            if (allocUnitsPerCarton > 0) {
                              setAllocFullCartons(Math.floor(total / allocUnitsPerCarton));
                              setAllocLooseUnits(total % allocUnitsPerCarton);
                            }
                          }}
                          className="w-full px-3 py-2 text-sm font-mono font-black bg-emerald-50 border-2 border-emerald-500 text-emerald-950 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    {allocUnitsPerCarton > 0 && (
                      <div className="text-[11px] font-mono font-bold text-teal-900 bg-teal-50 px-3 py-1.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
                        <span>
                          🧮 Równanie magazyniera:{' '}
                          <strong>
                            {allocFullCartons} pełnych kart. × {allocUnitsPerCarton} szt.
                          </strong>{' '}
                          ({allocFullCartons * allocUnitsPerCarton} szt.) +{' '}
                          <strong>{allocLooseUnits} szt. w otwartym</strong> ={' '}
                          <strong className="text-emerald-700 underline">{allocQty} szt.</strong>
                        </span>
                        <span className="text-slate-600">
                          Fizycznie na miejscu:{' '}
                          <strong>
                            {allocFullCartons + (allocLooseUnits > 0 ? 1 : 0)} kart.
                          </strong>{' '}
                          ({allocFullCartons} zamkn.
                          {allocLooseUnits > 0 ? ' + 1 otwarty' : ''})
                        </span>
                      </div>
                    )}
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
                      <div className="sm:col-span-2">
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Produkt z katalogu Eubiosis:
                        </label>
                        <select
                          value={allocProductId}
                          onChange={(e) => {
                            const pid = e.target.value;
                            setAllocProductId(pid);
                            const selProd = productMap.get(pid);
                            if (selProd?.defaultUnitsPerCarton) {
                              const upc = selProd.defaultUnitsPerCarton;
                              setAllocUnitsPerCarton(upc);
                              setAllocQty(allocFullCartons * upc + allocLooseUnits);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                        >
                          {state.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.shortName} — {p.name}
                              {p.defaultUnitsPerCarton ? ` [Karton: ${p.defaultUnitsPerCarton} szt.]` : ''}
                            </option>
                          ))}
                        </select>
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

                  {/* Jeśli partia ma zdefiniowane pakowanie w kartonie, ułatwiamy przeliczenie ile kartonów przesunąć */}
                  {(transferBatch.unitsPerCarton || 0) > 0 && (
                    <div className="bg-white/90 border border-indigo-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 mb-1">
                          Przesuń pełnych kartonów (po {transferBatch.unitsPerCarton} szt.):
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const fc = Math.max(0, transferFullCartons - 1);
                              const upc = Number(transferBatch.unitsPerCarton) || 1;
                              setTransferFullCartons(fc);
                              setTransferQty(
                                Math.min(transferBatch.quantity, fc * upc + transferLooseUnits)
                              );
                            }}
                            className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-black cursor-pointer border border-slate-300"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={transferFullCartons === 0 ? '' : transferFullCartons}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const fc = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                              const upc = Number(transferBatch.unitsPerCarton) || 1;
                              setTransferFullCartons(fc);
                              setTransferQty(
                                Math.min(transferBatch.quantity, fc * upc + transferLooseUnits)
                              );
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-indigo-50/50 border border-indigo-300 rounded-lg text-center"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const fc = transferFullCartons + 1;
                              const upc = Number(transferBatch.unitsPerCarton) || 1;
                              setTransferFullCartons(fc);
                              setTransferQty(
                                Math.min(transferBatch.quantity, fc * upc + transferLooseUnits)
                              );
                            }}
                            className="px-2 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-mono text-xs font-black cursor-pointer border border-indigo-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold text-indigo-900">
                            + Sztuk z otwartego kartonu:
                          </label>
                          {transferLooseUnits > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const upc = Number(transferBatch.unitsPerCarton) || 1;
                                setTransferLooseUnits(0);
                                setTransferQty(Math.min(transferBatch.quantity, transferFullCartons * upc));
                              }}
                              className="text-[9px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                            >
                              ✕ Brak otw.
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const loose = Math.max(0, transferLooseUnits - 1);
                              const upc = Number(transferBatch.unitsPerCarton) || 1;
                              setTransferLooseUnits(loose);
                              setTransferQty(
                                Math.min(transferBatch.quantity, transferFullCartons * upc + loose)
                              );
                            }}
                            className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-black cursor-pointer border border-slate-300"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            placeholder="Brak (0)"
                            value={transferLooseUnits === 0 ? '' : transferLooseUnits}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const loose = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                              const upc = Number(transferBatch.unitsPerCarton) || 1;
                              setTransferLooseUnits(loose);
                              setTransferQty(
                                Math.min(transferBatch.quantity, transferFullCartons * upc + loose)
                              );
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-amber-50/50 border border-amber-300 rounded-lg text-center placeholder:text-slate-400 placeholder:font-normal"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const loose = transferLooseUnits + 1;
                              const upc = Number(transferBatch.unitsPerCarton) || 1;
                              setTransferLooseUnits(loose);
                              setTransferQty(
                                Math.min(transferBatch.quantity, transferFullCartons * upc + loose)
                              );
                            }}
                            className="px-2 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono text-xs font-black cursor-pointer border border-amber-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-indigo-950 font-bold pb-1">
                        = Wyliczona ilość: <strong>{transferQty} szt.</strong>
                      </div>
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
                        Łączna ilość do przesunięcia (max {transferBatch.quantity}{' '}
                        {transferBatch.customUnit || 'szt.'}):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={transferBatch.quantity}
                          value={transferQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setTransferQty(val);
                            const upc = Number(transferBatch.unitsPerCarton) || 0;
                            if (upc > 0) {
                              setTransferFullCartons(Math.floor(val / upc));
                              setTransferLooseUnits(val % upc);
                            }
                          }}
                          className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setTransferQty(transferBatch.quantity);
                            const upc = Number(transferBatch.unitsPerCarton) || 0;
                            if (upc > 0) {
                              setTransferFullCartons(Math.floor(transferBatch.quantity / upc));
                              setTransferLooseUnits(transferBatch.quantity % upc);
                            }
                          }}
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
                    const cartonBreakdown = getBatchCartonBreakdown(batch);

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
                          <div className="flex-1 min-w-[240px]">
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

                            {/* PASEK WERYFIKACJI PO LICZBIE KARTONÓW I ILOŚCI W KARTONIE OTWARTYM */}
                            {cartonBreakdown.hasCartons && (
                              <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-950 font-mono font-extrabold">
                                    📦 Pełne kartony: {cartonBreakdown.fullCartons} szt. ×{' '}
                                    {cartonBreakdown.unitsPerCarton} (=
                                    {cartonBreakdown.fullCartons * cartonBreakdown.unitsPerCarton})
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-mono font-extrabold ${
                                      cartonBreakdown.openCartonUnits > 0
                                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    📂 Karton otwarty: {cartonBreakdown.openCartonUnits} szt.
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono font-bold text-slate-700">
                                  Fizycznie na miejscu:{' '}
                                  <strong className="text-teal-900">
                                    {cartonBreakdown.totalCartonBoxes} kart.
                                  </strong>{' '}
                                  ({cartonBreakdown.fullCartons} pełnych
                                  {cartonBreakdown.openCartonUnits > 0 ? ' + 1 otwarty' : ''})
                                </div>
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
                                const defaultMove = Math.min(
                                  batch.unitsPerCarton || 50,
                                  batch.quantity
                                );
                                const upc = Number(batch.unitsPerCarton) || 0;
                                setTransferFullCartons(
                                  upc > 0 ? Math.floor(defaultMove / upc) : 0
                                );
                                setTransferLooseUnits(
                                  upc > 0 ? defaultMove % upc : defaultMove
                                );
                                setTransferQty(defaultMove);
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
                                const upc =
                                  batch.unitsPerCarton !== undefined
                                    ? batch.unitsPerCarton
                                    : isCustom
                                    ? 0
                                    : 24;
                                const fc =
                                  batch.fullCartonsCount !== undefined
                                    ? batch.fullCartonsCount
                                    : upc > 0
                                    ? Math.floor(batch.quantity / upc)
                                    : 0;
                                const loose =
                                  batch.looseUnitsInOpenCarton !== undefined
                                    ? batch.looseUnitsInOpenCarton
                                    : upc > 0
                                    ? batch.quantity % upc
                                    : 0;
                                setEditingBatchId(isEditing ? null : batch.id);
                                setEditCustomName(batch.customName || '');
                                setEditCustomUnit(batch.customUnit || 'szt.');
                                setEditUnitsPerCarton(upc);
                                setEditFullCartons(fc);
                                setEditLooseUnits(loose);
                                setEditQty(batch.quantity);
                                setEditLot(batch.lotNumber);
                                setEditExpiry(batch.expiryDate);
                                setEditPalletLabel(batch.palletLabel || '');
                              }}
                              className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              title="Edytuj kartony, ilość w otwartym kartonie, serię LOT lub datę ważności"
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
                          <div className="pt-3 border-t border-slate-200 space-y-3">
                            {/* Sekcja szybkiego przeliczania kartonów w edycji */}
                            <div className="bg-white border-2 border-teal-400 rounded-xl p-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-extrabold text-teal-950">
                                  📦 Weryfikacja i przelicznik kartonów na miejscu:
                                </span>
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    Szybkie pakowanie:
                                  </span>
                                  {[9, 12, 27, 45, 51, 54, 63, 72, 80, 81, 135].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => {
                                        setEditUnitsPerCarton(preset);
                                        setEditQty(editFullCartons * preset + editLooseUnits);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer border ${
                                        editUnitsPerCarton === preset
                                          ? 'bg-teal-600 text-white border-teal-700'
                                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-teal-50'
                                      }`}
                                    >
                                      po {preset}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                    Ilość pełnych kartonów:
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fc = Math.max(0, editFullCartons - 1);
                                        setEditFullCartons(fc);
                                        if (editUnitsPerCarton > 0) {
                                          setEditQty(fc * editUnitsPerCarton + editLooseUnits);
                                        }
                                      }}
                                      className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-black cursor-pointer border border-slate-300"
                                      title="Odejmij 1 pełny karton"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      placeholder="0"
                                      value={editFullCartons === 0 ? '' : editFullCartons}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const fc = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                        setEditFullCartons(fc);
                                        if (editUnitsPerCarton > 0) {
                                          setEditQty(fc * editUnitsPerCarton + editLooseUnits);
                                        }
                                      }}
                                      className="w-full px-2 py-1.5 text-xs font-mono font-extrabold bg-teal-50/60 border border-teal-300 rounded-lg text-center"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fc = editFullCartons + 1;
                                        setEditFullCartons(fc);
                                        if (editUnitsPerCarton > 0) {
                                          setEditQty(fc * editUnitsPerCarton + editLooseUnits);
                                        }
                                      }}
                                      className="px-2 py-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 font-mono text-xs font-black cursor-pointer border border-teal-300"
                                      title="Dodaj 1 pełny karton"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                    Ilość w każdym kartonie:
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="np. 51"
                                    value={editUnitsPerCarton === 0 ? '' : editUnitsPerCarton}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const upc = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                      setEditUnitsPerCarton(upc);
                                      if (upc > 0) {
                                        setEditQty(editFullCartons * upc + editLooseUnits);
                                      }
                                    }}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono font-extrabold bg-teal-50/60 border border-teal-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="block text-[10px] font-bold text-slate-700">
                                      W kartonie otwartym:
                                    </label>
                                    {editLooseUnits > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditLooseUnits(0);
                                          if (editUnitsPerCarton > 0) {
                                            setEditQty(editFullCartons * editUnitsPerCarton);
                                          }
                                        }}
                                        className="text-[9px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                                      >
                                        ✕ Brak otw.
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const loose = Math.max(0, editLooseUnits - 1);
                                        setEditLooseUnits(loose);
                                        if (editUnitsPerCarton > 0) {
                                          setEditQty(editFullCartons * editUnitsPerCarton + loose);
                                        }
                                      }}
                                      className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-black cursor-pointer border border-slate-300"
                                      title="Odejmij 1 szt. z otwartego kartonu"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      placeholder="Brak (0)"
                                      value={editLooseUnits === 0 ? '' : editLooseUnits}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const loose = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                        setEditLooseUnits(loose);
                                        if (editUnitsPerCarton > 0) {
                                          setEditQty(editFullCartons * editUnitsPerCarton + loose);
                                        }
                                      }}
                                      className="w-full px-2 py-1.5 text-xs font-mono font-extrabold bg-amber-50/70 border border-amber-300 rounded-lg text-center placeholder:text-slate-400 placeholder:font-normal"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const loose = editLooseUnits + 1;
                                        setEditLooseUnits(loose);
                                        if (editUnitsPerCarton > 0) {
                                          setEditQty(editFullCartons * editUnitsPerCarton + loose);
                                        }
                                      }}
                                      className="px-2 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-mono text-xs font-black cursor-pointer border border-amber-300"
                                      title="Dodaj 1 szt. w otwartym kartonie"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-extrabold text-emerald-900 mb-0.5">
                                    = Łączna ilość ({isCustom ? editCustomUnit : 'szt.'}):
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={editQty === 0 ? '' : editQty}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const total = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                      setEditQty(total);
                                      if (editUnitsPerCarton > 0) {
                                        setEditFullCartons(Math.floor(total / editUnitsPerCarton));
                                        setEditLooseUnits(total % editUnitsPerCarton);
                                      }
                                    }}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono font-black bg-emerald-50 border-2 border-emerald-500 text-emerald-950 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                              {isCustom ? (
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
                              ) : (
                                <>
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
                                  Zapisz zmiany
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
                  Kod regału / strefy (np. M5-PAL-C):
                </label>
                <input
                  type="text"
                  value={newRackCode}
                  onChange={(e) => setNewRackCode(e.target.value)}
                  placeholder="np. M5-PAL-C lub M5-PODLOGA"
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Typ miejsc:
                </label>
                <select
                  value={newRackSlotType}
                  onChange={(e) => {
                    const val = e.target.value as WarehouseLocationSlot['slotType'];
                    setNewRackSlotType(val);
                    if (val === 'floor_pallet') {
                      setNewRackZoneType('floor_pallet');
                      setNewRackPlacement('floor_zone');
                      setNewRackLevels(1);
                    } else if (val === 'picking_standard' || val === 'picking_partner_12m') {
                      setNewRackZoneType('picking');
                    } else {
                      setNewRackZoneType('pallet');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                >
                  <option value="pallet_storage">📦 Regał Paletowy Boczny (Zapas PZ)</option>
                  <option value="floor_pallet">🟨 Miejsca Paletowe na Podłodze (Posadzka P0)</option>
                  <option value="picking_standard">🎯 Regał Kompletacji (Główny)</option>
                  <option value="picking_partner_12m">🟣 Regał Kompletacji PARTNER (&gt;12 msc)</option>
                  <option value="shelf_storage">🗄️ Regał Półkowy (Próbki / Zestawy)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Położenie w prostokątnej hali (względem bramy po lewej stronie):
              </label>
              <select
                value={newRackPlacement}
                onChange={(e) => {
                  const p = e.target.value as 'top_wall' | 'bottom_wall' | 'floor_zone';
                  setNewRackPlacement(p);
                  if (p === 'floor_zone') {
                    setNewRackSlotType('floor_pallet');
                    setNewRackZoneType('floor_pallet');
                    setNewRackLevels(1);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50"
              >
                <option value="top_wall">⬆️ Bok Górny Hali (Lewa ściana patrząc od bramy)</option>
                <option value="bottom_wall">⬇️ Bok Dolny Hali (Prawa ściana patrząc od bramy)</option>
                <option value="floor_zone">🟨 Strefa na Podłodze (Miejsca paletowe na posadzce P0)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nazwa regału / strefy:</label>
              <input
                type="text"
                value={newRackName}
                onChange={(e) => setNewRackName(e.target.value)}
                placeholder="np. Lewy Bok — Regał Paletowy C lub Miejsca Paletowe na Podłodze"
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
                  disabled={newRackPlacement === 'floor_zone' || newRackSlotType === 'floor_pallet'}
                  value={newRackPlacement === 'floor_zone' || newRackSlotType === 'floor_pallet' ? 1 : newRackLevels}
                  onChange={(e) => setNewRackLevels(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Miejsc paletowych:
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
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
                Wygeneruj ({(newRackPlacement === 'floor_zone' || newRackSlotType === 'floor_pallet' ? 1 : newRackLevels) * newRackSlotsPerLevel} miejsc)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
