import {
  WMSFullState,
  ProductCatalogItem,
  WarehouseLocationSlot,
  StockAllocationBatch,
  AllocatedMovementRecord,
  WarehouseDocument,
  WarehouseDocumentItem,
  PutAwayRecommendationOption,
} from '../types/wms';
import { getMonthsUntilExpiry, isEligibleForPartner12Months } from './wfirmaParser';

/**
 * Automatycznie przelicza liczbę pełnych kartonów i ilość w otwartym kartonie na podstawie łącznej ilości (quantity)
 * oraz zdefiniowanego pakowania (unitsPerCarton), jeśli pakowanie w kartonie zostało określone (> 0).
 */
export function syncBatchCartonBreakdown(batch: StockAllocationBatch): StockAllocationBatch {
  const upc = Number(batch.unitsPerCarton) || 0;
  if (upc > 0) {
    const qty = Math.max(0, Number(batch.quantity) || 0);
    batch.fullCartonsCount = Math.floor(qty / upc);
    batch.looseUnitsInOpenCarton = qty % upc;
  }
  return batch;
}

/**
 * Zwraca czytelne podsumowanie kartonów i sztuk w otwartym kartonie dla partii towaru (do weryfikacji na kafelku i w modalu).
 */
export function getBatchCartonBreakdown(batch: StockAllocationBatch): {
  hasCartons: boolean;
  fullCartons: number;
  unitsPerCarton: number;
  openCartonUnits: number;
  totalCartonBoxes: number;
  shortBadge: string;
  fullDescription: string;
} {
  const upc = Number(batch.unitsPerCarton) || 0;
  if (upc <= 0 && (batch.fullCartonsCount === undefined || batch.fullCartonsCount === 0)) {
    return {
      hasCartons: false,
      fullCartons: 0,
      unitsPerCarton: 0,
      openCartonUnits: 0,
      totalCartonBoxes: 0,
      shortBadge: '',
      fullDescription: '',
    };
  }

  const effectiveUpc = upc > 0 ? upc : 1;
  const fullCartons =
    batch.fullCartonsCount !== undefined
      ? batch.fullCartonsCount
      : Math.floor(batch.quantity / effectiveUpc);
  const openCartonUnits =
    batch.looseUnitsInOpenCarton !== undefined
      ? batch.looseUnitsInOpenCarton
      : batch.quantity % effectiveUpc;
  const totalCartonBoxes = fullCartons + (openCartonUnits > 0 ? 1 : 0);

  const shortBadge =
    openCartonUnits > 0
      ? `📦 ${fullCartons}×${effectiveUpc} + ${openCartonUnits} otw.`
      : `📦 ${fullCartons} kart.×${effectiveUpc}`;

  const fullDescription =
    openCartonUnits > 0
      ? `${fullCartons} pełnych kart. (po ${effectiveUpc} szt.) + ${openCartonUnits} szt. w kartonie otwartym = ${batch.quantity} szt. (fizycznie ${totalCartonBoxes} kart.)`
      : `${fullCartons} pełnych kart. (po ${effectiveUpc} szt.) = ${batch.quantity} szt. (brak otwartego kartonu)`;

  return {
    hasCartons: true,
    fullCartons,
    unitsPerCarton: effectiveUpc,
    openCartonUnits,
    totalCartonBoxes,
    shortBadge,
    fullDescription,
  };
}

export interface ProductSlotLocationInfo {
  slotId: string;
  slotCode: string;
  slotName: string;
  slotType: WarehouseLocationSlot['slotType'];
  rackId: string;
  rackCode: string;
  warehouseId: string;
  warehouseName: string;
  batchId: string;
  quantity: number;
  lotNumber: string;
  expiryDate: string;
  monthsLeft: number;
  isPartnerEligible12m: boolean;
  dedicatedForPartnerOnly?: boolean;
  palletLabel?: string;
}

export interface SuspendedBreakdownEntry {
  recordId: string;
  subItemId: string;
  quantity: number;
  reason: string;
  eventName: string;
  takenBy: string;
  issuedAt: string;
}

export interface ProductSummaryMetrics {
  product: ProductCatalogItem;
  pickingStandardQty: number;
  pickingPartnerQty: number;
  totalPickingQty: number;
  palletReserveQty: number;
  totalPhysicalOnRacks: number;
  eligibleForPartnerQty: number;      // Sztuki na magazynie z datą >= 12 msc
  shortExpiryUnder12mQty: number;     // Sztuki na magazynie z datą < 12 msc
  hasShortBatchOnMainPicking: boolean;// Czy na głównym miejscu kompletacji leży partia < 12 msc
  suspendedQty: number;               // Sztuki wydane bez dokumentu (np. konferencje, zam. pracownicze, niewystawione RW)
  suspendedBreakdown: SuspendedBreakdownEntry[]; // Rozbicie na poszczególne uzasadnienia
  totalControlledStock: number;       // Fizycznie na regałach + W zawieszeniu
  wfirmaTotal: number;                // Suma wFirma (PL + PARTNER)
  inventoryDiff: number;              // Bilans: (Na regałach + W zawieszeniu) - wFirma
  partnerCoverageDiff: number;        // Czy sztuk >= 12 msc wystarcza na stan PARTNER w wFirma
  needsPickingReplenishment: boolean; // Czy stan na Strefie Kompletacji < minPickingStock
  suggestedFefoPallet: ProductSlotLocationInfo | null;
  locations: ProductSlotLocationInfo[];
}

export function computeAllProductsSummary(state: WMSFullState): ProductSummaryMetrics[] {
  const whMap = new Map(state.warehouses.map((w) => [w.id, w]));
  const rackMap = new Map(state.racks.map((r) => [r.id, r]));

  // Oblicz ilości w zawieszeniu i listę uzasadnień dla każdego produktu
  const suspendedByProd = new Map<string, number>();
  const suspendedBreakdownByProd = new Map<string, SuspendedBreakdownEntry[]>();

  for (const rec of state.suspendedRecords) {
    if (rec.status === 'returned' || rec.status === 'settled_by_doc') continue;
    for (const it of rec.items) {
      const activeSuspended = Math.max(0, it.quantityIssued - it.quantityReturned - it.quantitySettled);
      if (activeSuspended > 0) {
        suspendedByProd.set(it.productId, (suspendedByProd.get(it.productId) || 0) + activeSuspended);
        const list = suspendedBreakdownByProd.get(it.productId) || [];
        list.push({
          recordId: rec.id,
          subItemId: it.id,
          quantity: activeSuspended,
          reason: it.reason || rec.eventName || 'W zawieszeniu (bez dok.)',
          eventName: rec.eventName,
          takenBy: rec.takenBy,
          issuedAt: rec.issuedAt,
        });
        suspendedBreakdownByProd.set(it.productId, list);
      }
    }
  }

  // Zbierz alokacje ze wszystkich miejsc magazynowych
  const locationsByProd = new Map<string, ProductSlotLocationInfo[]>();

  for (const slot of state.slots) {
    const wh = whMap.get(slot.warehouseId);
    const rack = rackMap.get(slot.rackId);
    for (const batch of slot.allocations) {
      if (batch.quantity <= 0 || batch.isCustomItem || batch.productId === 'CUSTOM') continue;
      const monthsLeft = getMonthsUntilExpiry(batch.expiryDate);
      const isPartnerEligible12m = isEligibleForPartner12Months(batch.expiryDate);

      const info: ProductSlotLocationInfo = {
        slotId: slot.id,
        slotCode: slot.code,
        slotName: slot.name,
        slotType: slot.slotType,
        rackId: slot.rackId,
        rackCode: rack?.code || '',
        warehouseId: slot.warehouseId,
        warehouseName: wh?.name || 'Magazyn',
        batchId: batch.id,
        quantity: batch.quantity,
        lotNumber: batch.lotNumber || 'BRAK-LOT',
        expiryDate: batch.expiryDate || '2028-12-31',
        monthsLeft,
        isPartnerEligible12m,
        dedicatedForPartnerOnly: batch.dedicatedForPartnerOnly,
        palletLabel: batch.palletLabel,
      };

      const arr = locationsByProd.get(batch.productId) || [];
      arr.push(info);
      locationsByProd.set(batch.productId, arr);
    }
  }

  return state.products.map((product) => {
    const locs = (locationsByProd.get(product.id) || []).sort((a, b) =>
      a.expiryDate.localeCompare(b.expiryDate)
    );

    let pickingStandardQty = 0;
    let pickingPartnerQty = 0;
    let palletReserveQty = 0;
    let eligibleForPartnerQty = 0;
    let shortExpiryUnder12mQty = 0;
    let hasShortBatchOnMainPicking = false;

    for (const l of locs) {
      if (l.dedicatedForPartnerOnly || l.slotType === 'picking_partner_12m') {
        pickingPartnerQty += l.quantity;
      } else if (l.slotType === 'picking_standard') {
        pickingStandardQty += l.quantity;
        if (!l.isPartnerEligible12m) {
          hasShortBatchOnMainPicking = true;
        }
      } else {
        palletReserveQty += l.quantity;
      }

      if (l.isPartnerEligible12m) {
        eligibleForPartnerQty += l.quantity;
      } else {
        shortExpiryUnder12mQty += l.quantity;
      }
    }

    const totalPickingQty = pickingStandardQty + pickingPartnerQty;
    const totalPhysicalOnRacks = totalPickingQty + palletReserveQty;
    const suspendedQty = suspendedByProd.get(product.id) || 0;
    const suspendedBreakdown = suspendedBreakdownByProd.get(product.id) || [];
    const totalControlledStock = totalPhysicalOnRacks + suspendedQty;
    const wfirmaTotal = product.wfirmaStockRegular + product.wfirmaStockPartner;
    const inventoryDiff = totalControlledStock - wfirmaTotal;
    const partnerCoverageDiff = eligibleForPartnerQty - product.wfirmaStockPartner;

    const palletLocs = locs.filter(
      (l) => l.slotType === 'pallet_storage' || l.slotType === 'floor_pallet'
    );
    const suggestedFefoPallet = palletLocs.length > 0 ? palletLocs[0] : null;
    const needsPickingReplenishment =
      palletReserveQty > 0 && totalPickingQty < product.minPickingStock;

    return {
      product,
      pickingStandardQty,
      pickingPartnerQty,
      totalPickingQty,
      palletReserveQty,
      totalPhysicalOnRacks,
      eligibleForPartnerQty,
      shortExpiryUnder12mQty,
      hasShortBatchOnMainPicking,
      suspendedQty,
      suspendedBreakdown,
      totalControlledStock,
      wfirmaTotal,
      inventoryDiff,
      partnerCoverageDiff,
      needsPickingReplenishment,
      suggestedFefoPallet,
      locations: locs,
    };
  });
}

/**
 * Przesunięcie towaru z jednego miejsca (np. Palety w Magazynie 5/6) na drugie miejsce (np. Magazyn 4 Kompletacja lub inne miejsce)
 */
export function executeStockTransfer(
  state: WMSFullState,
  params: {
    fromSlotId: string;
    batchId: string;
    toSlotId: string;
    quantity: number;
    performedBy: string;
    notes?: string;
    dedicatedForPartnerOnly?: boolean;
  }
): { nextState: WMSFullState; error?: string } {
  const { fromSlotId, batchId, toSlotId, quantity, performedBy, notes, dedicatedForPartnerOnly } = params;
  if (fromSlotId === toSlotId) {
    return { nextState: state, error: 'Miejsce źródłowe i docelowe są takie same.' };
  }
  if (quantity <= 0) {
    return { nextState: state, error: 'Ilość do przesunięcia musi być większa od zera.' };
  }

  const nextSlots = state.slots.map((s) => ({
    ...s,
    allocations: s.allocations.map((a) => ({ ...a })),
  }));

  const fromSlot = nextSlots.find((s) => s.id === fromSlotId);
  const toSlot = nextSlots.find((s) => s.id === toSlotId);
  if (!fromSlot || !toSlot) {
    return { nextState: state, error: 'Nie znaleziono wybranego miejsca magazynowego.' };
  }

  const sourceBatchIdx = fromSlot.allocations.findIndex((b) => b.id === batchId);
  if (sourceBatchIdx === -1) {
    return { nextState: state, error: 'Nie znaleziono wybranej partii towaru na miejscu źródłowym.' };
  }

  const sourceBatch = fromSlot.allocations[sourceBatchIdx];
  if (sourceBatch.quantity < quantity) {
    return {
      nextState: state,
      error: `Na miejscu ${fromSlot.code} jest tylko ${sourceBatch.quantity} ${sourceBatch.customUnit || 'szt.'} (próbowano przesunąć ${quantity}).`,
    };
  }

  const isCustom = Boolean(sourceBatch.isCustomItem || sourceBatch.productId === 'CUSTOM');

  // Walidacja reguły > 12 msc dla gniazda PARTNER (tylko dla produktów z katalogu)
  if (!isCustom && toSlot.slotType === 'picking_partner_12m' && !isEligibleForPartner12Months(sourceBatch.expiryDate)) {
    return {
      nextState: state,
      error: `Zablokowano! Partia ${sourceBatch.lotNumber} ma datę ważności ${sourceBatch.expiryDate} (poniżej 12 miesięcy). Produkty na gnieździe PARTNER muszą mieć zawsze powyżej 12 miesięcy ważności!`,
    };
  }

  const nowIso = new Date().toISOString();

  // Odejmij z miejsca źródłowego
  sourceBatch.quantity -= quantity;
  sourceBatch.updatedAt = nowIso;
  syncBatchCartonBreakdown(sourceBatch);
  if (sourceBatch.quantity <= 0) {
    fromSlot.allocations.splice(sourceBatchIdx, 1);
  }

  // Dodaj na miejsce docelowe (połącz jeśli ta sama pozycja / seria LOT i data MHD już tam leży)
  const existingTargetBatch = toSlot.allocations.find((b) => {
    if (isCustom) {
      return b.isCustomItem && (b.customName || '').trim() === (sourceBatch.customName || '').trim();
    }
    return (
      b.productId === sourceBatch.productId &&
      b.lotNumber === sourceBatch.lotNumber &&
      b.expiryDate === sourceBatch.expiryDate
    );
  });

  if (existingTargetBatch) {
    existingTargetBatch.quantity += quantity;
    if (!existingTargetBatch.unitsPerCarton && sourceBatch.unitsPerCarton) {
      existingTargetBatch.unitsPerCarton = sourceBatch.unitsPerCarton;
    }
    syncBatchCartonBreakdown(existingTargetBatch);
    existingTargetBatch.updatedAt = nowIso;
    if (dedicatedForPartnerOnly !== undefined) {
      existingTargetBatch.dedicatedForPartnerOnly = dedicatedForPartnerOnly;
    }
  } else {
    const newBatch: StockAllocationBatch = syncBatchCartonBreakdown({
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: sourceBatch.productId,
      isCustomItem: sourceBatch.isCustomItem,
      customName: sourceBatch.customName,
      customUnit: sourceBatch.customUnit,
      quantity,
      unitsPerCarton: sourceBatch.unitsPerCarton,
      lotNumber: sourceBatch.lotNumber,
      expiryDate: sourceBatch.expiryDate,
      dedicatedForPartnerOnly:
        dedicatedForPartnerOnly ??
        (toSlot.slotType === 'picking_partner_12m' ? true : sourceBatch.dedicatedForPartnerOnly),
      firstToExit: sourceBatch.firstToExit,
      palletLabel:
        toSlot.slotType === 'picking_standard'
          ? 'Magazyn 4 — Kompletacja'
          : toSlot.slotType === 'picking_partner_12m'
          ? 'Gniazdo PARTNER (>12 msc)'
          : sourceBatch.palletLabel,
      notes: notes || sourceBatch.notes,
      updatedAt: nowIso,
    });
    toSlot.allocations.push(newBatch);
  }

  const prod = state.products.find((p) => p.id === sourceBatch.productId);
  const displayName = isCustom
    ? sourceBatch.customName || 'Pozycja opisana ręcznie'
    : prod?.shortName || prod?.name || sourceBatch.productId;

  const historyEntry = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowIso,
    type: 'MOVE' as const,
    productId: sourceBatch.productId,
    productName: displayName,
    quantity,
    lotNumber: sourceBatch.lotNumber || '-',
    expiryDate: sourceBatch.expiryDate || '-',
    fromSlotCode: fromSlot.code,
    toSlotCode: toSlot.code,
    performedBy,
    notes: notes || `Przesunięcie wewnętrzne (${fromSlot.code} ➔ ${toSlot.code})`,
  };

  return {
    nextState: {
      ...state,
      revision: state.revision + 1,
      updatedAt: nowIso,
      slots: nextSlots,
      movementsHistory: [historyEntry, ...state.movementsHistory],
    },
  };
}

/**
 * Zatwierdzenie i realizacja dokumentu magazynowego:
 * - WZ i RW: ściągają ilości ze Strefy Kompletacji (z zachowaniem reguły > 12 msc dla PARTNER oraz FEFO!)
 * - PW: dodaje ilości bezpośrednio na Strefę Kompletacji
 * - PZ: alokuje dostawę paletową na wskazane miejsca paletowe / kompletacji
 */
export function executeWarehouseDocument(
  state: WMSFullState,
  docId: string,
  performedBy: string,
  customPalletAllocations?: Record<string, AllocatedMovementRecord[]>
): { nextState: WMSFullState; error?: string; warnings: string[] } {
  const docIdx = state.documents.findIndex((d) => d.id === docId);
  if (docIdx === -1) {
    return { nextState: state, error: 'Nie znaleziono dokumentu.', warnings: [] };
  }

  const doc = state.documents[docIdx];
  if (doc.status === 'applied') {
    return { nextState: state, error: `Dokument ${doc.docNumber} został już wcześniej zrealizowany.`, warnings: [] };
  }

  const nowIso = new Date().toISOString();
  const warnings: string[] = [];

  const nextSlots = state.slots.map((s) => ({
    ...s,
    allocations: s.allocations.map((a) => ({ ...a })),
  }));
  const nextHistory = [...state.movementsHistory];
  const nextDocItems = doc.items.map((it) => ({
    ...it,
    allocatedMovements: [...(it.allocatedMovements || [])],
  }));

  for (const item of nextDocItems) {
    if (!item.matchedProductId) {
      return {
        nextState: state,
        error: `Pozycja "${item.rawName}" na dokumencie ${doc.docNumber} nie jest przypisana do produktu z katalogu. Wybierz produkt z listy przed zatwierdzeniem.`,
        warnings,
      };
    }

    const catalogProduct = state.products.find((p) => p.id === item.matchedProductId);
    if (!catalogProduct) {
      return {
        nextState: state,
        error: `Nie znaleziono produktu w katalogu dla pozycji "${item.rawName}".`,
        warnings,
      };
    }

    // Sprawdź czy to Zestaw Wirtualny rozbijany na produkty składowe
    const targetLines: { product: ProductCatalogItem; neededQty: number }[] = [];
    if (
      catalogProduct.kitHandlingMode === 'virtual_bundle' &&
      Array.isArray(catalogProduct.kitComponents) &&
      catalogProduct.kitComponents.length > 0
    ) {
      for (const comp of catalogProduct.kitComponents) {
        const compProd = state.products.find((p) => p.id === comp.productId);
        if (compProd) {
          targetLines.push({
            product: compProd,
            neededQty: item.quantity * comp.quantityPerKit,
          });
        }
      }
    } else {
      targetLines.push({
        product: catalogProduct,
        neededQty: item.quantity,
      });
    }

    if (doc.docType === 'WZ' || doc.docType === 'RW') {
      // ROZCHÓD ZE STREFY KOMPLETACJI (WZ / RW)
      item.allocatedMovements = [];

      for (const line of targetLines) {
        let remainingToDeduct = line.neededQty;

        // Zbierz wszystkie partie tego produktu we wszystkich miejscach
        interface CandidateBatch {
          slot: WarehouseLocationSlot;
          batch: StockAllocationBatch;
          priorityScore: number;
        }

        const candidates: CandidateBatch[] = [];
        for (const slot of nextSlots) {
          for (const batch of slot.allocations) {
            if (batch.productId !== line.product.id || batch.quantity <= 0) continue;
            const eligible12m = isEligibleForPartner12Months(batch.expiryDate);

            // REGUŁA PARTNER > 12 MIESIĘCY:
            // Jeśli dokument WZ jest dla PARTNERA, blokujemy partie z datą poniżej 12 miesięcy!
            if (item.isPartnerChannel && !eligible12m) {
              continue;
            }

            // Jeśli to zwykłe zamówienie (nie Partner), nie ruszaj gniazda dedykowanego wyłącznie dla Partnera w pierwszej kolejności
            let priorityScore = 50;
            if (item.isPartnerChannel) {
              if (slot.slotType === 'picking_partner_12m') priorityScore = 1; // Najpierw dedykowane gniazdo Partner (>12m)
              else if (slot.slotType === 'picking_standard') priorityScore = 2; // Potem główna kompletacja (jeśli ma >12m)
              else priorityScore = 10; // W ostateczności paleta z >12m (z ostrzeżeniem o uzupełnieniu)
            } else {
              if (slot.slotType === 'picking_standard' || slot.slotType === 'shelf_storage') priorityScore = 1;
              else if (slot.slotType === 'quarantine_promo') priorityScore = 2;
              else if (slot.slotType === 'pallet_storage' || slot.slotType === 'floor_pallet') priorityScore = 10;
              else if (slot.slotType === 'picking_partner_12m') priorityScore = 20;
            }

            candidates.push({ slot, batch, priorityScore });
          }
        }

        // Sortuj wg priorytetu strefy (Kompletacja najpierw), a wewnątrz strefy wg FEFO (najkrótsza data ważności najpierw!)
        candidates.sort((a, b) => {
          if (a.priorityScore !== b.priorityScore) return a.priorityScore - b.priorityScore;
          return (a.batch.expiryDate || '').localeCompare(b.batch.expiryDate || '');
        });

        const totalAvailable = candidates.reduce((acc, c) => acc + c.batch.quantity, 0);
        if (totalAvailable < remainingToDeduct) {
          return {
            nextState: state,
            error: item.isPartnerChannel
              ? `Brak wystarczającej ilości z datą > 12 miesięcy dla produktu PARTNER "${line.product.shortName}"! Wymagane: ${remainingToDeduct} szt., dostępne z datą > 12 msc: ${totalAvailable} szt.`
              : `Brak wystarczającej ilości produktu "${line.product.shortName}" na magazynie! Wymagane: ${remainingToDeduct} szt., dostępne: ${totalAvailable} szt.`,
            warnings,
          };
        }

        for (const cand of candidates) {
          if (remainingToDeduct <= 0) break;
          const take = Math.min(cand.batch.quantity, remainingToDeduct);
          cand.batch.quantity -= take;
          syncBatchCartonBreakdown(cand.batch);
          cand.batch.updatedAt = nowIso;
          remainingToDeduct -= take;

          if (cand.slot.slotType === 'pallet_storage' || cand.slot.slotType === 'floor_pallet') {
            warnings.push(
              `Uwaga: W Strefie Kompletacji zabrakło ${take} szt. "${line.product.shortName}" — pobrano automatycznie z miejsca paletowego ${cand.slot.code} (LOT: ${cand.batch.lotNumber}).`
            );
          }

          item.allocatedMovements.push({
            slotId: cand.slot.id,
            slotCode: cand.slot.code,
            batchId: cand.batch.id,
            lotNumber: cand.batch.lotNumber,
            expiryDate: cand.batch.expiryDate,
            quantity: take,
            palletLabel: cand.batch.palletLabel,
          });

          nextHistory.unshift({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            type: doc.docType,
            productId: line.product.id,
            productName: line.product.shortName,
            quantity: take,
            lotNumber: cand.batch.lotNumber,
            expiryDate: cand.batch.expiryDate,
            fromSlotCode: cand.slot.code,
            referenceDoc: doc.docNumber,
            performedBy,
            notes: `${doc.docType} (${doc.counterparty})${item.isPartnerChannel ? ' [PARTNER >12 msc]' : ''}`,
          });
        }

        // Wyczyść puste partie (quantity === 0)
        for (const s of nextSlots) {
          s.allocations = s.allocations.filter((b) => b.quantity > 0);
        }
      }
    } else if (doc.docType === 'PW' || doc.docType === 'PZ') {
      // PRZYJĘCIE NA MAGAZYN:
      // - PW trafia domyślnie na Strefę Kompletacji
      // - PZ trafia na wybrane przez użytkownika Miejsca Paletowe (lub Kompletację)
      const customAllocs =
        customPalletAllocations?.[item.id] ||
        (item.allocatedMovements && item.allocatedMovements.length > 0
          ? item.allocatedMovements
          : null);

      if (customAllocs && customAllocs.length > 0) {
        item.allocatedMovements = [];
        for (const alloc of customAllocs) {
          const targetSlot = nextSlots.find((s) => s.id === alloc.slotId) || nextSlots[0];
          const lot = (alloc.lotNumber || `DOST-${doc.issueDate.replace(/-/g, '')}`).trim();
          const exp = (alloc.expiryDate || '2028-09-30').trim();
          const wantPartner =
            Boolean(alloc.dedicatedForPartnerOnly) ||
            Boolean(item.isPartnerChannel) ||
            targetSlot.slotType === 'picking_partner_12m';

          if (wantPartner && !isEligibleForPartner12Months(exp)) {
            return {
              nextState: state,
              error: `Zablokowano alokację na ${targetSlot.code}: miejsca z etykietą PARTNER (różowe) nie mogą mieć daty ważności poniżej 12 miesięcy (podano: ${exp}).`,
              warnings,
            };
          }

          const existingBatch = targetSlot.allocations.find(
            (b) => b.productId === catalogProduct.id && b.lotNumber === lot && b.expiryDate === exp
          );

          if (existingBatch) {
            existingBatch.quantity += alloc.quantity;
            if (alloc.unitsPerCarton && alloc.unitsPerCarton > 0) {
              existingBatch.unitsPerCarton = alloc.unitsPerCarton;
            }
            if (wantPartner) existingBatch.dedicatedForPartnerOnly = true;
            if (alloc.firstToExit) existingBatch.firstToExit = true;
            syncBatchCartonBreakdown(existingBatch);
            existingBatch.updatedAt = nowIso;
          } else {
            const upc = alloc.unitsPerCarton || catalogProduct.defaultUnitsPerCarton || undefined;
            const newBatch: StockAllocationBatch = syncBatchCartonBreakdown({
              id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              productId: catalogProduct.id,
              quantity: alloc.quantity,
              lotNumber: lot,
              expiryDate: exp,
              unitsPerCarton: upc,
              fullCartonsCount: alloc.cartonsCount,
              looseUnitsInOpenCarton: alloc.openCartonQty,
              dedicatedForPartnerOnly: wantPartner,
              firstToExit: Boolean(alloc.firstToExit),
              palletLabel:
                alloc.palletLabel ||
                (doc.docType === 'PZ' ? `Dostawa ${doc.docNumber}` : 'Przyjęcie PW'),
              updatedAt: nowIso,
            });
            targetSlot.allocations.push(newBatch);
          }

          item.allocatedMovements.push({
            slotId: targetSlot.id,
            slotCode: targetSlot.code,
            lotNumber: lot,
            expiryDate: exp,
            quantity: alloc.quantity,
            palletLabel: alloc.palletLabel,
            cartonsCount: alloc.cartonsCount,
            unitsPerCarton: alloc.unitsPerCarton,
            openCartonQty: alloc.openCartonQty,
            dedicatedForPartnerOnly: wantPartner,
            firstToExit: Boolean(alloc.firstToExit),
            recommendationReason: alloc.recommendationReason,
            recommendationBadge: alloc.recommendationBadge,
          });

          nextHistory.unshift({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            type: doc.docType,
            productId: catalogProduct.id,
            productName: catalogProduct.shortName,
            quantity: alloc.quantity,
            lotNumber: lot,
            expiryDate: exp,
            toSlotCode: targetSlot.code,
            referenceDoc: doc.docNumber,
            performedBy,
            notes: `Przyjęcie ${doc.docType} na miejsce ${targetSlot.code} (${alloc.palletLabel || doc.counterparty})`,
          });
        }
      } else {
        // Automatyczny wybór gniazda (dla PW -> Strefa Kompletacji, dla PZ -> Pierwsze miejsce paletowe lub gniazdo tego produktu)
        let targetSlot = nextSlots.find((s) =>
          doc.docType === 'PW'
            ? (item.isPartnerChannel ? s.slotType === 'picking_partner_12m' : s.slotType === 'picking_standard') &&
              s.allocations.some((a) => a.productId === catalogProduct.id)
            : (s.slotType === 'pallet_storage' || s.slotType === 'floor_pallet') &&
              s.allocations.some((a) => a.productId === catalogProduct.id)
        );

        if (!targetSlot) {
          targetSlot =
            nextSlots.find((s) =>
              doc.docType === 'PW'
                ? s.slotType === 'picking_standard'
                : s.slotType === 'pallet_storage' || s.slotType === 'floor_pallet'
            ) || nextSlots[0];
        }

        const existingProductBatch = targetSlot.allocations.find(
          (a) => a.productId === catalogProduct.id
        );
        const lot = existingProductBatch?.lotNumber || `LOT-${doc.issueDate.slice(2, 4)}X10`;
        const exp = existingProductBatch?.expiryDate || '2028-06-30';

        if (existingProductBatch) {
          existingProductBatch.quantity += item.quantity;
          existingProductBatch.updatedAt = nowIso;
        } else {
          targetSlot.allocations.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: catalogProduct.id,
            quantity: item.quantity,
            lotNumber: lot,
            expiryDate: exp,
            palletLabel: doc.docType === 'PZ' ? `Paleta (${doc.docNumber})` : `PW (${doc.docNumber})`,
            updatedAt: nowIso,
          });
        }

        item.allocatedMovements = [
          {
            slotId: targetSlot.id,
            slotCode: targetSlot.code,
            lotNumber: lot,
            expiryDate: exp,
            quantity: item.quantity,
            palletLabel: doc.docType === 'PZ' ? `Paleta (${doc.docNumber})` : 'Strefa Kompletacji (PW)',
          },
        ];

        nextHistory.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          type: doc.docType,
          productId: catalogProduct.id,
          productName: catalogProduct.shortName,
          quantity: item.quantity,
          lotNumber: lot,
          expiryDate: exp,
          toSlotCode: targetSlot.code,
          referenceDoc: doc.docNumber,
          performedBy,
          notes: `Przyjęcie ${doc.docType} (${doc.counterparty})`,
        });
      }
    }
  }

  const nextDocs: WarehouseDocument[] = state.documents.map((d, i) =>
    i === docIdx
      ? {
          ...d,
          status: 'applied',
          appliedAt: nowIso,
          appliedBy: performedBy,
          items: nextDocItems,
        }
      : d
  );

  return {
    nextState: {
      ...state,
      revision: state.revision + 1,
      updatedAt: nowIso,
      slots: nextSlots,
      documents: nextDocs,
      movementsHistory: nextHistory,
    },
    warnings,
  };
}

/**
 * Obsługa przeciągania i upuszczania (Drag & Drop) całego kafelka palety pomiędzy dwoma miejscami:
 * - mode === 'move_all': przenosi całą zawartość z fromSlot na toSlot (łącząc partie tego samego produktu/LOT)
 * - mode === 'swap_slots': zamienia palety miejscami (fromSlot ⇄ toSlot)
 */
export function executeSlotDragAndDrop(
  state: WMSFullState,
  params: {
    fromSlotId: string;
    toSlotId: string;
    mode: 'move_all' | 'swap_slots';
    performedBy: string;
  }
): { nextState: WMSFullState; error?: string; summary?: string } {
  const { fromSlotId, toSlotId, mode, performedBy } = params;
  if (fromSlotId === toSlotId) {
    return { nextState: state };
  }

  const nextSlots = state.slots.map((s) => ({
    ...s,
    allocations: s.allocations.map((a) => ({ ...a })),
  }));

  const fromSlot = nextSlots.find((s) => s.id === fromSlotId);
  const toSlot = nextSlots.find((s) => s.id === toSlotId);
  if (!fromSlot || !toSlot) {
    return { nextState: state, error: 'Nie znaleziono wybranego miejsca magazynowego.' };
  }

  const fromHasContent =
    fromSlot.allocations.some((a) => a.quantity > 0) ||
    Boolean(fromSlot.customDescription && fromSlot.customDescription.trim());
  if (!fromHasContent) {
    return { nextState: state, error: 'Wybrane miejsce źródłowe jest puste.' };
  }

  // Walidacja reguły > 12 msc dla gniazda PARTNER
  if (toSlot.slotType === 'picking_partner_12m') {
    const invalidBatch = fromSlot.allocations.find(
      (b) =>
        b.quantity > 0 &&
        !b.isCustomItem &&
        b.productId !== 'CUSTOM' &&
        !isEligibleForPartner12Months(b.expiryDate)
    );
    if (invalidBatch) {
      return {
        nextState: state,
        error: `Zablokowano! Na miejscu ${fromSlot.code} znajduje się partia ${invalidBatch.lotNumber} z datą ważności ${invalidBatch.expiryDate} (< 12 miesięcy). Gniazda PARTNER przyjmują wyłącznie towar z datą > 12 msc!`,
      };
    }
  }

  if (mode === 'swap_slots' && fromSlot.slotType === 'picking_partner_12m') {
    const invalidSwapBatch = toSlot.allocations.find(
      (b) =>
        b.quantity > 0 &&
        !b.isCustomItem &&
        b.productId !== 'CUSTOM' &&
        !isEligibleForPartner12Months(b.expiryDate)
    );
    if (invalidSwapBatch) {
      return {
        nextState: state,
        error: `Zablokowano zamianę! Na miejscu ${toSlot.code} znajduje się partia ${invalidSwapBatch.lotNumber} z datą ważności ${invalidSwapBatch.expiryDate} (< 12 miesięcy), której nie można przenieść na gniazdo PARTNER (${fromSlot.code}).`,
      };
    }
  }

  const nowIso = new Date().toISOString();
  const nextHistory = [...state.movementsHistory];

  if (mode === 'swap_slots') {
    const tempAllocs = fromSlot.allocations;
    const tempDesc = fromSlot.customDescription;

    fromSlot.allocations = toSlot.allocations.map((a) => ({
      ...a,
      dedicatedForPartnerOnly:
        fromSlot.slotType === 'picking_partner_12m' ? true : a.dedicatedForPartnerOnly,
      updatedAt: nowIso,
    }));
    fromSlot.customDescription = toSlot.customDescription;

    toSlot.allocations = tempAllocs.map((a) => ({
      ...a,
      dedicatedForPartnerOnly:
        toSlot.slotType === 'picking_partner_12m' ? true : a.dedicatedForPartnerOnly,
      updatedAt: nowIso,
    }));
    toSlot.customDescription = tempDesc;

    const totalSwapped =
      fromSlot.allocations.reduce((s, a) => s + a.quantity, 0) +
      toSlot.allocations.reduce((s, a) => s + a.quantity, 0);

    nextHistory.unshift({
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowIso,
      type: 'MOVE',
      productId: 'SWAP',
      productName: `Zamiana palet miejscami (${fromSlot.code} ⇄ ${toSlot.code})`,
      quantity: totalSwapped,
      lotNumber: '-',
      expiryDate: '-',
      fromSlotCode: fromSlot.code,
      toSlotCode: toSlot.code,
      performedBy,
      notes: `Przeciągnij i upuść (Zamiana palet: ${fromSlot.code} ⇄ ${toSlot.code})`,
    });

    return {
      nextState: {
        ...state,
        revision: state.revision + 1,
        updatedAt: nowIso,
        slots: nextSlots,
        movementsHistory: nextHistory,
      },
      summary: `Zamieniono palety miejscami: ${fromSlot.code} ⇄ ${toSlot.code}`,
    };
  }

  // mode === 'move_all'
  let movedTotalQty = 0;
  const movedNames: string[] = [];

  for (const sourceBatch of fromSlot.allocations) {
    if (sourceBatch.quantity <= 0) continue;
    movedTotalQty += sourceBatch.quantity;
    const isCustom = Boolean(sourceBatch.isCustomItem || sourceBatch.productId === 'CUSTOM');
    const prod = state.products.find((p) => p.id === sourceBatch.productId);
    movedNames.push(
      isCustom
        ? sourceBatch.customName || 'Pozycja ręczna'
        : prod?.shortName || sourceBatch.productId
    );

    const existingTarget = toSlot.allocations.find((b) => {
      if (isCustom) {
        return b.isCustomItem && (b.customName || '').trim() === (sourceBatch.customName || '').trim();
      }
      return (
        b.productId === sourceBatch.productId &&
        b.lotNumber === sourceBatch.lotNumber &&
        b.expiryDate === sourceBatch.expiryDate
      );
    });

    if (existingTarget) {
      existingTarget.quantity += sourceBatch.quantity;
      if (!existingTarget.unitsPerCarton && sourceBatch.unitsPerCarton) {
        existingTarget.unitsPerCarton = sourceBatch.unitsPerCarton;
      }
      syncBatchCartonBreakdown(existingTarget);
      existingTarget.updatedAt = nowIso;
    } else {
      toSlot.allocations.push(
        syncBatchCartonBreakdown({
          ...sourceBatch,
          id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dedicatedForPartnerOnly:
            toSlot.slotType === 'picking_partner_12m' ? true : sourceBatch.dedicatedForPartnerOnly,
          updatedAt: nowIso,
        })
      );
    }
  }

  if (fromSlot.customDescription && !toSlot.customDescription) {
    toSlot.customDescription = fromSlot.customDescription;
  } else if (fromSlot.customDescription && toSlot.customDescription) {
    toSlot.customDescription = `${toSlot.customDescription} | ${fromSlot.customDescription}`;
  }

  fromSlot.allocations = [];
  fromSlot.customDescription = undefined;

  const labelSummary = movedNames.length > 0 ? movedNames.join(', ') : 'Opis miejsca';

  nextHistory.unshift({
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowIso,
    type: 'MOVE',
    productId: 'DRAG_MOVE',
    productName: labelSummary,
    quantity: movedTotalQty,
    lotNumber: '-',
    expiryDate: '-',
    fromSlotCode: fromSlot.code,
    toSlotCode: toSlot.code,
    performedBy,
    notes: `Przeciągnij i upuść (${fromSlot.code} ➔ ${toSlot.code})`,
  });

  return {
    nextState: {
      ...state,
      revision: state.revision + 1,
      updatedAt: nowIso,
      slots: nextSlots,
      movementsHistory: nextHistory,
    },
    summary: `Przesunięto paletę (${labelSummary}) z ${fromSlot.code} na ${toSlot.code}`,
  };
}

/**
 * Zwraca standardową ilość sztuk w 1 kartonie zbiorczym dla danego produktu
 * (na podstawie istniejących palet w magazynie lub katalogu produktów).
 */
export function getDefaultUnitsPerCarton(state: WMSFullState, productId: string | null): number {
  if (!productId) return 54;
  for (const s of state.slots) {
    for (const a of s.allocations) {
      if (a.productId === productId && a.unitsPerCarton && a.unitsPerCarton > 0) {
        return a.unitsPerCarton;
      }
    }
  }
  const prod = state.products.find((p) => p.id === productId);
  if (prod?.defaultUnitsPerCarton && prod.defaultUnitsPerCarton > 0) return prod.defaultUnitsPerCarton;
  const name = `${prod?.shortName || ''} ${prod?.name || ''}`.toLowerCase();
  if (name.includes('1000ml') || name.includes('mikrosan')) return 12;
  if (name.includes('logic') || name.includes('300g') || name.includes('450g') || name.includes('500g')) return 24;
  if (name.includes('60g')) return 72;
  if (name.includes('10 sasz')) return 108;
  if (name.includes('20 sasz') || name.includes('panda')) return 72;
  if (name.includes('14 sasz') || name.includes('flora') || name.includes('travel')) return 50;
  if (name.includes('7 sasz')) return 80;
  return 54;
}

/**
 * Oblicza inteligentny ranking miejsc docelowych w Magazynie 4, 5 i 6 dla przyjmowanej pozycji z Faktury / WZ / PZ.
 */
export function getPutAwayRecommendationsForItem(
  state: WMSFullState,
  productId: string | null,
  quantity: number,
  isPartnerChannel: boolean,
  claimedSlotIds: Set<string> = new Set()
): PutAwayRecommendationOption[] {
  const prod = productId ? state.products.find((p) => p.id === productId) : undefined;
  const whMap = new Map(state.warehouses.map((w) => [w.id, w]));
  const rackMap = new Map(state.racks.map((r) => [r.id, r]));

  // Znajdź wszystkie miejsca, na których już leży ten sam produkt
  const sameProdSlots = productId
    ? state.slots.filter((s) =>
        s.allocations.some((a) => a.productId === productId && a.quantity > 0)
      )
    : [];

  const sameProdRackIds = new Set(sameProdSlots.map((s) => s.rackId));
  const sameProdWhIds = new Set(sameProdSlots.map((s) => s.warehouseId));

  // Sprawdź, czy produkt jest obecny na Poziomie 0 (Kompletacja na dole regału)
  const hasLevel0Stock = sameProdSlots.some((s) => s.level === 0 && s.slotType !== 'floor_pallet');

  // Jeśli produktu nie ma obecnie nigdzie na stanie, określ domyślną halę docelową po kategorii / rodzinie
  let preferredWhId = 'wh-mag-5';
  let preferredRackHint = '';
  if (prod) {
    const n = `${prod.shortName} ${prod.name}`.toLowerCase();
    if (prod.category === 'sample' || /\bsf\b|sample/i.test(n)) {
      preferredWhId = 'wh-mag-4';
      preferredRackHint = 'rack-m4-r5';
    } else if (prod.category === 'accessory') {
      preferredWhId = 'wh-mag-4';
      preferredRackHint = 'rack-m4-r6';
    } else if (
      /stress|het|metabolic|migraene|power|active|cat|dog/i.test(n)
    ) {
      preferredWhId = 'wh-mag-4';
    } else if (/panda|travel|uro|akut|sr-9|caricol/i.test(n)) {
      preferredWhId = 'wh-mag-6';
    } else {
      preferredWhId = 'wh-mag-5';
    }
  }

  const options: PutAwayRecommendationOption[] = [];

  for (const slot of state.slots) {
    const activeAllocs = slot.allocations.filter((a) => a.quantity > 0);
    const hasCustomText = Boolean(slot.customDescription && slot.customDescription.trim());
    const isEmpty = activeAllocs.length === 0 && !hasCustomText;
    const hasSameProdHere =
      Boolean(productId) && activeAllocs.some((a) => a.productId === productId);

    // Rozważamy wszystkie wolne miejsca ORAZ miejsca, na których już leży ten sam produkt (jako opcję dokładki)
    if (!isEmpty && !hasSameProdHere) continue;

    const wh = whMap.get(slot.warehouseId);
    const rack = rackMap.get(slot.rackId);
    const whShort = wh?.name.split('—')[0].trim() || slot.warehouseId;
    const rackShort = rack?.name.split('(')[0].trim() || slot.rackId;
    const currentQtyHere = activeAllocs.reduce((sum, a) => sum + a.quantity, 0);

    let score = 0;
    let badge = '💡 Wolne miejsce';
    let reason = `Wolne miejsce w ${whShort} (${rackShort}, Poziom ${slot.level}).`;

    if (!isEmpty && hasSameProdHere) {
      // Opcja dokładki do istniejącej palety tego samego produktu
      if (quantity <= 160 && currentQtyHere <= 250) {
        score = 92;
        badge = '⚡ Dokładka do niepełnej palety';
        reason = `Na tym miejscu leży już ten sam produkt (${currentQtyHere} szt.) — przy mniejszej dostawie (${quantity} szt.) najlepiej dołożyć tutaj bez zajmowania nowego miejsca.`;
      } else if (slot.level === 0 && currentQtyHere < 100) {
        score = 88;
        badge = '⚡ Uzupełnienie Poziomu 0';
        reason = `Niski stan tego produktu na Poziomie 0 (${currentQtyHere} szt.) — warto dołożyć do bieżącego miejsca kompletacji.`;
      } else {
        score = 45;
        badge = '➕ Połącz z istniejącą paletą';
        reason = `Na tym miejscu znajduje się już ${currentQtyHere} szt. tego produktu — możliwość konsolidacji na jednej palecie.`;
      }
    } else if (isEmpty) {
      // Punktacja wolnego miejsca
      if (sameProdRackIds.has(slot.rackId)) {
        score += 75;
        badge = '⭐ Ten sam regał (Optymalne)';
        reason = `Wolne miejsce na tym samym regale (${rackShort} w ${whShort}), na którym składowane są już pozostałe palety tego produktu.`;
      } else if (sameProdWhIds.has(slot.warehouseId)) {
        score += 50;
        badge = '⭐ Ta sama hala';
        reason = `Wolne miejsce w tej samej hali (${whShort}), w której znajduje się już ten produkt.`;
      } else if (preferredRackHint && slot.rackId === preferredRackHint) {
        score += 65;
        badge = '⭐ Dedykowany regał';
        reason = `Wolne miejsce na dedykowanym regale (${rackShort} w ${whShort}) dla tej grupy asortymentowej.`;
      } else if (slot.warehouseId === preferredWhId) {
        score += 40;
        badge = '👍 Zalecana hala';
        reason = `Wolne miejsce w zalecanej hali (${whShort}) dla tej rodziny produktów.`;
      } else {
        score += 15;
      }

      // Zasada FEFO przy wyborze poziomu regału:
      if (slot.slotType === 'floor_pallet') {
        if (quantity >= 500) {
          score += 12;
          reason += ' Duża dostawa całopaletowa — wygodny rozładunek na miejsce podłogowe.';
        } else {
          score -= 8;
        }
      } else if (hasLevel0Stock) {
        // Jeśli na dole (Poziom 0) jest już zapas do bieżącego wydawania, nowa dostawa (dłuższa data) powinna trafić wyżej (Poziom 1 lub 2)
        if (slot.level >= 1) {
          score += 18;
          reason += ` Zgodnie z FEFO nowa dostawa trafia wyżej (Poziom ${slot.level}) jako zapas, a starsza partia na dole wychodzi pierwsza.`;
        } else {
          score += 6;
        }
      } else {
        // Jeśli na Poziomie 0 nie ma tego produktu, warto postawić na Poziomie 0 lub 1
        if (slot.level === 0) {
          score += 22;
          badge = '⭐ Poziom 0 (Brak na dole!)';
          reason = `Brak tego produktu na Poziomie 0 — umieść tutaj, aby zapewnić łatwy dostęp do bieżących wydań!`;
        } else if (slot.level === 1) {
          score += 14;
        }
      }

      if (isPartnerChannel) {
        reason += ' Paleta otrzyma różową etykietę 🩷 PARTNER (data ≥ 12 msc).';
      }
    }

    if (claimedSlotIds.has(slot.id)) {
      score -= 80;
    }

    options.push({
      slotId: slot.id,
      slotCode: slot.code,
      slotName: slot.name,
      warehouseId: slot.warehouseId,
      warehouseName: whShort,
      rackName: rackShort,
      level: slot.level,
      position: slot.position,
      isEmpty,
      score,
      badge,
      reason,
    });
  }

  options.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.slotCode.localeCompare(b.slotCode);
  });

  return options;
}

/**
 * Generuje kompletny, inteligentny plan rozmieszczenia wszystkich pozycji z dokumentu dostawy (Faktura / WZ / PZ),
 * automatycznie dzieląc duże ilości na osobne palety, przeliczając kartony i rezerwując kolejne wolne miejsca.
 */
export function buildSmartDeliveryAllocationsForDoc(
  state: WMSFullState,
  doc: WarehouseDocument,
  defaultExpiryDate: string = '2028-09-30'
): Record<string, AllocatedMovementRecord[]> {
  const claimedSlotIds = new Set<string>();
  const result: Record<string, AllocatedMovementRecord[]> = {};

  for (const item of doc.items) {
    const upc = getDefaultUnitsPerCarton(state, item.matchedProductId);
    // Pojemność pojedynczej palety (ok. 10 kartonów lub min. 600 szt., dla płynów 1000ml ok. 24 kartony = 288 szt.)
    const maxCartonsPerPallet = upc <= 15 ? 24 : upc <= 30 ? 18 : 10;
    const maxUnitsPerPallet = Math.max(240, upc * maxCartonsPerPallet);

    const numPallets =
      item.quantity > maxUnitsPerPallet ? Math.ceil(item.quantity / maxUnitsPerPallet) : 1;

    let remainingQty = item.quantity;
    const rows: AllocatedMovementRecord[] = [];

    for (let pIdx = 0; pIdx < numPallets; pIdx++) {
      const isLast = pIdx === numPallets - 1;
      let palletQty = isLast
        ? remainingQty
        : Math.min(
            remainingQty,
            upc > 0
              ? Math.round(item.quantity / numPallets / upc) * upc || Math.ceil(item.quantity / numPallets)
              : Math.ceil(item.quantity / numPallets)
          );
      if (palletQty <= 0) palletQty = remainingQty;
      remainingQty -= palletQty;

      const recommendations = getPutAwayRecommendationsForItem(
        state,
        item.matchedProductId,
        palletQty,
        item.isPartnerChannel,
        claimedSlotIds
      );

      const best = recommendations[0];
      if (best && best.isEmpty) {
        claimedSlotIds.add(best.slotId);
      }

      const fullCartons = upc > 0 ? Math.floor(palletQty / upc) : 0;
      const openUnits = upc > 0 ? palletQty % upc : 0;

      rows.push({
        slotId: best?.slotId || state.slots[0]?.id || '',
        slotCode: best?.slotCode || state.slots[0]?.code || '',
        lotNumber: `DOST-${doc.issueDate.replace(/-/g, '')}`,
        expiryDate: defaultExpiryDate,
        quantity: palletQty,
        cartonsCount: fullCartons,
        unitsPerCarton: upc,
        openCartonQty: openUnits,
        dedicatedForPartnerOnly: item.isPartnerChannel,
        firstToExit: best?.badge.includes('Poziom 0 (Brak na dole!)') || false,
        palletLabel:
          numPallets > 1
            ? `Paleta ${pIdx + 1}/${numPallets} (${doc.docNumber})`
            : `Dostawa ${doc.docNumber}`,
        recommendationBadge: best?.badge || '💡 Sugerowane miejsce',
        recommendationReason:
          best?.reason || 'Wybrano pierwsze dostępne miejsce w magazynie.',
      });
    }

    result[item.id] = rows;
  }

  return result;
}


