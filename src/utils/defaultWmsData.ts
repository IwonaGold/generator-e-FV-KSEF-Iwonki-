import {
  ProductCatalogItem,
  SpatialWarehouse,
  WarehouseRack,
  WarehouseLocationSlot,
  WarehouseDocument,
  SuspendedItemRecord,
  StockMovementHistoryEntry,
  WMSFullState,
  StockAllocationBatch,
} from '../types/wms';

export const DEFAULT_PRODUCTS_CATALOG: ProductCatalogItem[] = [
  // === 1. MIKROSAN ===
  {
    id: 'prod-9120117912933',
    baseEan: '9120117912933',
    skuRegular: '9120117912933',
    skuPartner: 'EAN9120117912933',
    name: 'MikroSan — 1000ml butelka PET',
    shortName: 'MikroSan • 1000ml',
    category: 'mikrosan',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1066, // 689 + 377 w zestawach promocyjnych (Suma wFirma w Inwentaryzacji Października = 1379)
    wfirmaStockPartner: 313,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 12,
    cartonDimensions: '28x37x27',
    cartonsPerPallet: 48,
  },

  // === 2. PROBIOTYKI GŁÓWNE (Od razu Rodzaj i Wariant + pakowanie zbiorcze z Cennika) ===
  {
    id: 'prod-9120117912797',
    baseEan: '9120117912797',
    skuRegular: '9120117912797',
    skuPartner: 'EAN9120117912797',
    name: 'Pro-Vi 5 — 14 sasz. × 2g',
    shortName: 'Pro-Vi 5 • 14 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 77.92,
    minPickingStock: 81,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4396, // 4250 + 2×73 w zestawie (Suma wFirma = 5860)
    wfirmaStockPartner: 1464,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 81,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912803',
    baseEan: '9120117912803',
    skuRegular: '9120117912803',
    skuPartner: 'EAN9120117912803',
    name: 'Pro-Vi 5 — 30 sasz. × 2g',
    shortName: 'Pro-Vi 5 • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 148.75,
    minPickingStock: 108,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 13235,
    wfirmaStockPartner: 660,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 54,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912766',
    baseEan: '9120117912766',
    skuRegular: '9120117912766',
    skuPartner: 'EAN9120117912766',
    name: 'Stress Repair — 56 sasz. × 3g',
    shortName: 'Stress Repair • 56 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 290.42,
    minPickingStock: 54,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4748,
    wfirmaStockPartner: 1877,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 27,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912759',
    baseEan: '9120117912759',
    skuRegular: '9120117912759',
    skuPartner: 'EAN9120117912759',
    name: 'Stress Repair — 28 sasz. × 3g',
    shortName: 'Stress Repair • 28 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 102,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 12023,
    wfirmaStockPartner: 205,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117913138',
    baseEan: '9120117913138',
    skuRegular: '9120117913138',
    skuPartner: 'EAN9120117913138',
    name: 'Stress Repair — 7 sasz. × 3g',
    shortName: 'Stress Repair • 7 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 43.29,
    minPickingStock: 80,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4859,
    wfirmaStockPartner: 51,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 80,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117915651',
    baseEan: '9120117915651',
    skuRegular: '9120117915651',
    skuPartner: 'EAN9120117915651',
    name: 'Stress Repair Kids — 28 sasz. × 1,2g',
    shortName: 'Stress Kids • 28 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 106.25,
    minPickingStock: 72,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 6829,
    wfirmaStockPartner: 208,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 72,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120001435692',
    baseEan: '9120001435692',
    skuRegular: '9120001435692',
    skuPartner: 'EAN9120001435692',
    name: 'Travel — 28 sasz. × 5g',
    shortName: 'Travel • 28 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 148.75,
    minPickingStock: 51,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 3742,
    wfirmaStockPartner: 71,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117914470',
    baseEan: '9120117914470',
    skuRegular: '9120117914470',
    skuPartner: 'EAN9120117914470',
    name: 'Travel — 14 sasz. × 5g',
    shortName: 'Travel • 14 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 77.92,
    minPickingStock: 81,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1708,
    wfirmaStockPartner: 482,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 81,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117914692',
    baseEan: '9120117914692',
    skuRegular: '9120117914692',
    skuPartner: 'EAN9120117914692',
    name: '6 — 300g słoik',
    shortName: '6 • 300g słoik',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 589.49,
    minPickingStock: 32,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 802,
    wfirmaStockPartner: 184,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 16,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912681',
    baseEan: '9120117912681',
    skuRegular: '9120117912681',
    skuPartner: 'EAN9120117912681',
    name: '6 — 60g słoik',
    shortName: '6 • 60g słoik',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 72,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 7080,
    wfirmaStockPartner: 603,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 72,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912704',
    baseEan: '9120117912704',
    skuRegular: '9120117912704',
    skuPartner: 'EAN9120117912704',
    name: '6 — 30 sasz. × 3g',
    shortName: '6 • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 219.58,
    minPickingStock: 51,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4715,
    wfirmaStockPartner: 228,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912711',
    baseEan: '9120117912711',
    skuRegular: '9120117912711',
    skuPartner: 'EAN9120117912711',
    name: '6 — 60 sasz. × 3g',
    shortName: '6 • 60 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 392.73,
    minPickingStock: 54,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2661,
    wfirmaStockPartner: 236,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 27,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912728',
    baseEan: '9120117912728',
    skuRegular: '9120117912728',
    skuPartner: 'EAN9120117912728',
    name: '6 — 7 sasz. × 3g',
    shortName: '6 • 7 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 54.31,
    minPickingStock: 80,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4200,
    wfirmaStockPartner: 1949,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 80,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912667',
    baseEan: '9120117912667',
    skuRegular: '9120117912667',
    skuPartner: 'EAN9120117912667',
    name: 'AAD10 — 10 sasz. × 5g',
    shortName: 'AAD10 • 10 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 62.18,
    minPickingStock: 135,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4370,
    wfirmaStockPartner: 2453,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 135,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912674',
    baseEan: '9120117912674',
    skuRegular: '9120117912674',
    skuPartner: 'EAN9120117912674',
    name: 'AAD10 — 30 sasz. × 5g',
    shortName: 'AAD10 • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 90,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 13788,
    wfirmaStockPartner: 902,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 45,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117911370',
    baseEan: '9120117911370',
    skuRegular: '9120117911370',
    skuPartner: 'EAN9120117911370',
    name: 'AAD10 Kids — 20 sasz. × 2,5g',
    shortName: 'AAD10 Kids • 20 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 66.90,
    minPickingStock: 63,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 9667,
    wfirmaStockPartner: 1741,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 63,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912773',
    baseEan: '9120117912773',
    skuRegular: '9120117912773',
    skuPartner: 'EAN9120117912773',
    name: 'Active — 60g słoik',
    shortName: 'Active • 60g słoik',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 72,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1332,
    wfirmaStockPartner: 357,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 72,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912872',
    baseEan: '9120117912872',
    skuRegular: '9120117912872',
    skuPartner: 'EAN9120117912872',
    name: 'Cat&Dog — 60g słoik',
    shortName: 'Cat&Dog • 60g słoik',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 117.27,
    minPickingStock: 36,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 107,
    wfirmaStockPartner: 55,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 72,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117914906',
    baseEan: '9120117914906',
    skuRegular: '9120117914906',
    skuPartner: 'EAN9120117914906',
    name: 'Colonize — 28 sasz. × 3g',
    shortName: 'Colonize • 28 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 51,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 629,
    wfirmaStockPartner: 486,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912858',
    baseEan: '9120117912858',
    skuRegular: '9120117912858',
    skuPartner: 'EAN9120117912858',
    name: 'FLORA plus+ — 14 sasz. × 2g',
    shortName: 'FLORA plus+ • 14 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 77.92,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 3010, // 2630 + 2×190 w zestawie Flora B2C (Suma wFirma = 3052)
    wfirmaStockPartner: 42,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 50,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912865',
    baseEan: '9120117912865',
    skuRegular: '9120117912865',
    skuPartner: 'EAN9120117912865',
    name: 'FLORA plus+ — 28 sasz. × 2g',
    shortName: 'FLORA plus+ • 28 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 148.75,
    minPickingStock: 54,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4310,
    wfirmaStockPartner: 434,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 27,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912827',
    baseEan: '9120117912827',
    skuRegular: '9120117912827',
    skuPartner: 'EAN9120117912827',
    name: 'Hetox — 30 sasz. × 6g',
    shortName: 'Hetox • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 306.16,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2476,
    wfirmaStockPartner: 220,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 40,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912810',
    baseEan: '9120117912810',
    skuRegular: '9120117912810',
    skuPartner: 'EAN9120117912810',
    name: 'Metabolic — 30 sasz. × 3g',
    shortName: 'Metabolic • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 156.62,
    minPickingStock: 51,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2274, // 2256 + 18 Promocja -30% (Suma wFirma = 3670)
    wfirmaStockPartner: 1396,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912834',
    baseEan: '9120117912834',
    skuRegular: '9120117912834',
    skuPartner: 'EAN9120117912834',
    name: 'METAtox — 30 sasz. × 3g',
    shortName: 'METAtox • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 164.49,
    minPickingStock: 51,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1535,
    wfirmaStockPartner: 1565,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912742',
    baseEan: '9120117912742',
    skuRegular: '9120117912742',
    skuPartner: 'EAN9120117912742',
    name: 'Panda — 30 sasz. × 3g',
    shortName: 'Panda • 30 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 148.75,
    minPickingStock: 102,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 15542,
    wfirmaStockPartner: 731,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 51,
    cartonDimensions: '40x40x30',
    cartonsPerPallet: 30,
  },
  {
    id: 'prod-9120117912735',
    baseEan: '9120117912735',
    skuRegular: '9120117912735',
    skuPartner: 'EAN9120117912735',
    name: 'Panda — 7 sasz. × 3g',
    shortName: 'Panda • 7 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 38.56,
    minPickingStock: 80,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2810,
    wfirmaStockPartner: 280,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 80,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912841',
    baseEan: '9120117912841',
    skuRegular: '9120117912841',
    skuPartner: 'EAN9120117912841',
    name: 'POWER — 28 sasz. × 4g',
    shortName: 'POWER • 28 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 148.75,
    minPickingStock: 54,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1205,
    wfirmaStockPartner: 409,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 27,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },

  // === 3. PREBIOTYKI ===
  {
    id: 'prod-9120117912926',
    baseEan: '9120117912926',
    skuRegular: '9120117912926',
    skuPartner: 'EAN9120117912926',
    name: 'ApplePectin — 84 kaps.',
    shortName: 'ApplePectin • 84 kaps.',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 85.79,
    minPickingStock: 45,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 749,
    wfirmaStockPartner: 263,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 45,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912919',
    baseEan: '9120117912919',
    skuRegular: '9120117912919',
    skuPartner: 'EAN9120117912919',
    name: 'ApplePectin — 180 kaps.',
    shortName: 'ApplePectin • 180 kaps.',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 140.88,
    minPickingStock: 36,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1026,
    wfirmaStockPartner: 122,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 36,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912889',
    baseEan: '9120117912889',
    skuRegular: '9120117912889',
    skuPartner: 'EAN9120117912889',
    name: 'Fibre — 250g słoik PET',
    shortName: 'Fibre • 250g słoik',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 77.92,
    minPickingStock: 24,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 857,
    wfirmaStockPartner: 38,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 12,
    cartonDimensions: '35x35x22',
    cartonsPerPallet: 42,
  },
  {
    id: 'prod-9120117912896',
    baseEan: '9120117912896',
    skuRegular: '9120117912896',
    skuPartner: 'EAN9120117912896',
    name: 'Immune — 450g słoik PET',
    shortName: 'Immune • 450g słoik',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 172.36,
    minPickingStock: 27,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1079,
    wfirmaStockPartner: 169,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 9,
    cartonDimensions: '33x33x20',
    cartonsPerPallet: 48,
  },
  {
    id: 'prod-9120117912902',
    baseEan: '9120117912902',
    skuRegular: 'EANPL9120117912902',
    skuPartner: 'EAN9120117912902',
    name: 'Plus — 450g słoik PET',
    shortName: 'Plus • 450g słoik',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 172.36,
    minPickingStock: 27,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 622, // 608 + 14 w promocjach/zestawach (Suma wFirma = 723)
    wfirmaStockPartner: 101,
    wfirmaLastUpdated: '2026-10-11',
    defaultUnitsPerCarton: 9,
    cartonDimensions: '33x33x20',
    cartonsPerPallet: 48,
  },
];

export const DEFAULT_WAREHOUSES: SpatialWarehouse[] = [
  {
    id: 'wh-mag-4',
    code: 'MAG-4',
    name: 'Magazyn 4 — Lokal nr 4 (Kompletacja)',
    description:
      'Lokal nr 4 (Inwentaryzacja Października): po lewej stronie Brama, po bokach 7 regałów (Góra: 1–4 REGAŁ, Dół: 5–7 REGAŁ), 3 poziomy (POZIOM II, I, 0). Brak miejsc paletowych na podłodze.',
    hasPickingZone: true,
  },
  {
    id: 'wh-mag-5',
    code: 'MAG-5',
    name: 'Magazyn 5 — Lokal nr 5 (Składowanie)',
    description:
      'Lokal nr 5 (Inwentaryzacja Października): po lewej stronie Brama, po bokach 8 regałów (Góra: 1–4 REGAŁ, Dół: 5–8 REGAŁ) oraz 12 miejsc paletowych na podłodze (1–12 PALETA).',
    hasPickingZone: false,
  },
  {
    id: 'wh-mag-6',
    code: 'MAG-6',
    name: 'Magazyn 6 — Lokal nr 6 (Składowanie)',
    description:
      'Lokal nr 6 (Inwentaryzacja Października): po lewej stronie Brama, po bokach 8 regałów (Góra: 1–4 REGAŁ, Dół: 5–8 REGAŁ) oraz 12 miejsc paletowych na podłodze (1–12 PALETA).',
    hasPickingZone: false,
  },
];

export const DEFAULT_RACKS: WarehouseRack[] = [
  // ============================================================================
  // MAGAZYN 4 (LOKAL NR 4) — 7 REGAŁÓW (Góra: 1–4 REGAŁ, Dół: 5–7 REGAŁ), BRAK PODŁOGI
  // ============================================================================
  {
    id: 'rack-m4-r1',
    warehouseId: 'wh-mag-4',
    code: 'M4-R1',
    name: '1 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r2',
    warehouseId: 'wh-mag-4',
    code: 'M4-R2',
    name: '2 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r3',
    warehouseId: 'wh-mag-4',
    code: 'M4-R3',
    name: '3 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 2,
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r4',
    warehouseId: 'wh-mag-4',
    code: 'M4-R4',
    name: '4 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r5',
    warehouseId: 'wh-mag-4',
    code: 'M4-R5',
    name: '5 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r6',
    warehouseId: 'wh-mag-4',
    code: 'M4-R6',
    name: '6 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r7',
    warehouseId: 'wh-mag-4',
    code: 'M4-R7',
    name: '7 REGAŁ (Lokal nr 4)',
    zoneType: 'picking',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'emerald',
  },

  // ============================================================================
  // MAGAZYN 5 (LOKAL NR 5) — 8 REGAŁÓW (Góra: 1–4, Dół: 5–8) + 12 MIEJSC NA PODŁODZE
  // ============================================================================
  {
    id: 'rack-m5-r1',
    warehouseId: 'wh-mag-5',
    code: 'M5-R1',
    name: '1 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 2,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r2',
    warehouseId: 'wh-mag-5',
    code: 'M5-R2',
    name: '2 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r3',
    warehouseId: 'wh-mag-5',
    code: 'M5-R3',
    name: '3 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r4',
    warehouseId: 'wh-mag-5',
    code: 'M5-R4',
    name: '4 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 2,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r5',
    warehouseId: 'wh-mag-5',
    code: 'M5-R5',
    name: '5 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 2,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r6',
    warehouseId: 'wh-mag-5',
    code: 'M5-R6',
    name: '6 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r7',
    warehouseId: 'wh-mag-5',
    code: 'M5-R7',
    name: '7 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 2,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r8',
    warehouseId: 'wh-mag-5',
    code: 'M5-R8',
    name: '8 REGAŁ (Lokal nr 5)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-floor',
    warehouseId: 'wh-mag-5',
    code: 'M5-PODLOGA',
    name: 'Miejsca Paletowe na Podłodze (Magazyn 5 — 12 miejsc)',
    zoneType: 'floor_pallet',
    hallPlacement: 'floor_zone',
    levelsCount: 1,
    slotsPerLevel: 12,
    colorTheme: 'amber',
  },

  // ============================================================================
  // MAGAZYN 6 (LOKAL NR 6) — 8 REGAŁÓW (Góra: 1–4, Dół: 5–8) + 12 MIEJSC NA PODŁODZE
  // ============================================================================
  {
    id: 'rack-m6-r1',
    warehouseId: 'wh-mag-6',
    code: 'M6-R1',
    name: '1 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r2',
    warehouseId: 'wh-mag-6',
    code: 'M6-R2',
    name: '2 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r3',
    warehouseId: 'wh-mag-6',
    code: 'M6-R3',
    name: '3 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r4',
    warehouseId: 'wh-mag-6',
    code: 'M6-R4',
    name: '4 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r5',
    warehouseId: 'wh-mag-6',
    code: 'M6-R5',
    name: '5 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 2,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r6',
    warehouseId: 'wh-mag-6',
    code: 'M6-R6',
    name: '6 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r7',
    warehouseId: 'wh-mag-6',
    code: 'M6-R7',
    name: '7 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r8',
    warehouseId: 'wh-mag-6',
    code: 'M6-R8',
    name: '8 REGAŁ (Lokal nr 6)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 3,
    slotsPerLevel: 3,
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-floor',
    warehouseId: 'wh-mag-6',
    code: 'M6-PODLOGA',
    name: 'Miejsca Paletowe na Podłodze (Magazyn 6 — 12 miejsc)',
    zoneType: 'floor_pallet',
    hallPlacement: 'floor_zone',
    levelsCount: 1,
    slotsPerLevel: 12,
    colorTheme: 'amber',
  },
];

function levelCodeLabel(level: number): string {
  if (level === 2) return 'POZ.II';
  if (level === 1) return 'POZ.I';
  return 'POZ.0';
}

/**
 * Odtwarza 1:1 stan fizyczny Magazynu 4, Magazynu 5 i Magazynu 6 z arkusza Inwentaryzacji Października
 * wraz z przeliczeniem na pełne kartony + karton otwarty wg Cennika.
 */
export function buildInitialSlotsWithAllocations(products: ProductCatalogItem[]): WarehouseLocationSlot[] {
  const slots: WarehouseLocationSlot[] = [];
  const nowIso = '2026-10-11T08:00:00.000Z';
  const prodById = new Map(products.map((p) => [p.id, p]));

  for (const rack of DEFAULT_RACKS) {
    for (let level = 0; level < rack.levelsCount; level++) {
      for (let pos = 1; pos <= rack.slotsPerLevel; pos++) {
        const posStr = String(pos).padStart(2, '0');
        const isFloor = rack.zoneType === 'floor_pallet' || rack.hallPlacement === 'floor_zone';
        const lvlLbl = levelCodeLabel(level);
        const slotCode = isFloor ? `${rack.code}-${posStr}` : `${rack.code}-${lvlLbl}-${pos}PAL`;
        const slotType: WarehouseLocationSlot['slotType'] = isFloor
          ? 'floor_pallet'
          : rack.warehouseId === 'wh-mag-4'
          ? 'picking_standard'
          : 'pallet_storage';

        slots.push({
          id: `slot-${rack.id}-${level}-${pos}`,
          warehouseId: rack.warehouseId,
          rackId: rack.id,
          code: slotCode,
          name: isFloor
            ? `Podłoga ${rack.code} — ${pos} PALETA`
            : `${rack.name.split('(')[0].trim()} — ${lvlLbl.replace('.', ' ')}, ${pos} PALETA`,
          level,
          position: pos,
          slotType,
          maxCapacityUnits: isFloor ? 3500 : 3500,
          allocations: [],
        });
      }
    }
  }

  const slotMap = new Map(slots.map((s) => [s.id, s]));
  let batchSeq = 1;

  const addProd = (
    rackId: string,
    level: number,
    pos: number,
    productId: string,
    quantity: number,
    expiryDate: string,
    palletLabel?: string,
    notes?: string
  ) => {
    const slot = slotMap.get(`slot-${rackId}-${level}-${pos}`);
    if (!slot) return;
    const p = prodById.get(productId);
    const upc = p?.defaultUnitsPerCarton || 24;
    const batch: StockAllocationBatch = {
      id: `oct-batch-${batchSeq++}`,
      productId,
      quantity,
      unitsPerCarton: upc,
      fullCartonsCount: Math.floor(quantity / upc),
      looseUnitsInOpenCarton: quantity % upc,
      lotNumber: expiryDate ? `MHD-${expiryDate.slice(5, 7)}/${expiryDate.slice(2, 4)}` : '-',
      expiryDate,
      palletLabel: palletLabel || 'Inwentaryzacja Październik',
      notes,
      updatedAt: nowIso,
    };
    slot.allocations.push(batch);
  };

  const addCustom = (
    rackId: string,
    level: number,
    pos: number,
    customName: string,
    quantity: number,
    customUnit: string,
    palletLabel?: string,
    slotDesc?: string
  ) => {
    const slot = slotMap.get(`slot-${rackId}-${level}-${pos}`);
    if (!slot) return;
    if (slotDesc) slot.customDescription = slotDesc;
    slot.allocations.push({
      id: `oct-custom-${batchSeq++}`,
      productId: 'CUSTOM',
      isCustomItem: true,
      customName,
      customUnit,
      quantity,
      lotNumber: '-',
      expiryDate: '',
      palletLabel: palletLabel || 'Materiały / Opakowania',
      updatedAt: nowIso,
    });
  };

  // ==========================================================================
  // 1. LOKAL NR 4 (MAGAZYN 4) — 7 REGAŁÓW
  // ==========================================================================
  // --- 1 REGAŁ (rack-m4-r1) ---
  addCustom('rack-m4-r1', 2, 1, 'Papier Miodowy + Papier Uzupełniający', 1, 'paleta', 'Paleta łączona (Opakowania)');
  addCustom('rack-m4-r1', 2, 2, 'KARTON M', 1760, 'szt.', 'CAŁA PALETA');
  // 1 Regał Poz II Pal 3: wolne
  addProd('rack-m4-r1', 1, 1, 'prod-9120117912728', 15, '2028-03-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r1', 1, 1, 'prod-9120117912896', 153, '2028-04-30', 'Paleta łączona (2/2)');
  addProd('rack-m4-r1', 1, 2, 'prod-9120117912803', 375, '2027-12-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r1', 1, 2, 'prod-9120117913138', 211, '2028-02-29', 'Paleta łączona (2/2)');
  addProd('rack-m4-r1', 1, 3, 'prod-9120117912858', 35, '2027-05-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r1', 1, 3, 'prod-9120117912902', 86, '2028-01-31', 'Paleta łączona (2/2)');
  addProd('rack-m4-r1', 0, 1, 'prod-9120117912933', 298, '2027-03-31', 'Poziom 0 (03_27)');
  addProd('rack-m4-r1', 0, 1, 'prod-9120117912933', 275, '2026-12-31', 'CAŁA PALETA (12_26)');
  addProd('rack-m4-r1', 0, 1, 'prod-9120117912933', 32, '2026-11-30', 'Krótka data (11_26)');
  addProd('rack-m4-r1', 0, 1, 'prod-9120117912919', 10, '2028-01-31', 'Paleta łączona (Pectin 180)');
  addProd('rack-m4-r1', 0, 2, 'prod-9120117912773', 365, '2027-12-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r1', 0, 2, 'prod-9120117914692', 57, '2027-12-31', 'Paleta łączona (2/2)');
  addProd('rack-m4-r1', 0, 3, 'prod-9120117914470', 1617, '2027-11-30', 'Paleta łączona (1/2)');
  addProd('rack-m4-r1', 0, 3, 'prod-9120117912667', 96, '2027-12-31', 'Paleta łączona (2/2)');

  // --- 2 REGAŁ (rack-m4-r2) ---
  addProd('rack-m4-r2', 2, 1, 'prod-9120117912667', 3240, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m4-r2', 2, 2, 'prod-9120117912858', 946, '2027-05-31', 'CAŁA PALETA');
  // 2 Regał Poz II Pal 3: wolne
  addProd('rack-m4-r2', 1, 1, 'prod-9120117912797', 1368, '2028-02-29', 'CAŁA PALETA');
  addProd('rack-m4-r2', 1, 2, 'prod-9120117912810', 109, '2028-02-29', 'Paleta łączona (02_28)');
  addProd('rack-m4-r2', 1, 2, 'prod-9120117912810', 29, '2026-11-30', 'Paleta łączona (11_26)');
  // 2 Regał Poz I Pal 3: wolne
  addProd('rack-m4-r2', 0, 1, 'prod-9120117912865', 135, '2027-11-30', 'CAŁA PALETA');
  addProd('rack-m4-r2', 0, 2, 'prod-9120117915651', 102, '2028-08-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r2', 0, 2, 'prod-9120001435692', 73, '2027-11-30', 'Paleta łączona (2/2)');

  // --- 3 REGAŁ (rack-m4-r3, 2 kolumny) ---
  addProd('rack-m4-r3', 2, 1, 'prod-9120117912797', 1863, '2027-03-31', 'CAŁA PALETA');
  addCustom('rack-m4-r3', 2, 2, 'KARTON M LONG', 1760, 'szt.', 'CAŁA PALETA');
  addProd('rack-m4-r3', 1, 1, 'prod-9120117912834', 647, '2028-04-30', 'CAŁA PALETA');
  // 3 Regał Poz I Pal 2: wolne
  addProd('rack-m4-r3', 0, 1, 'prod-9120117912773', 837, '2027-09-30', 'Paleta łączona (09_27)');
  addProd('rack-m4-r3', 0, 1, 'prod-9120117912773', 490, '2027-05-31', 'Paleta łączona (05_27)');
  addProd('rack-m4-r3', 0, 2, 'prod-9120117912872', 157, '2027-10-31', 'CAŁA PALETA');

  // --- 4 REGAŁ (rack-m4-r4) ---
  addCustom('rack-m4-r4', 2, 1, 'KARTON 40x40x30', 200, 'szt.', 'Opakowania');
  addProd('rack-m4-r4', 2, 2, 'prod-9120117912865', 1134, '2027-05-31', 'CAŁA PALETA');
  addCustom('rack-m4-r4', 2, 3, 'Karton 60x40x30', 120, 'szt.', 'CAŁA PALETA');
  addProd('rack-m4-r4', 1, 1, 'prod-9120117912841', 826, '2027-10-31', 'CAŁA PALETA');
  addProd('rack-m4-r4', 1, 2, 'prod-9120117912902', 60, '2027-02-28', 'CAŁA PALETA');
  addProd('rack-m4-r4', 1, 3, 'prod-9120117912896', 153, '2027-02-28', 'CAŁA PALETA');
  addProd('rack-m4-r4', 0, 1, 'prod-9120117912889', 96, '2027-10-31', 'CAŁA PALETA');
  addProd('rack-m4-r4', 0, 2, 'prod-9120117914906', 143, '2027-11-30', 'CAŁA PALETA');
  addProd('rack-m4-r4', 0, 3, 'prod-9120117912919', 151, '2027-09-30', 'Paleta łączona (09_27)');
  addProd('rack-m4-r4', 0, 3, 'prod-9120117912919', 217, '2028-01-31', 'Paleta łączona (01_28)');
  addProd('rack-m4-r4', 0, 3, 'prod-9120117912926', 42, '2028-02-29', 'Paleta łączona (Pectin 84)');

  // --- 5 REGAŁ (rack-m4-r5) ---
  addProd('rack-m4-r5', 2, 1, 'prod-9120117914470', 77, '2027-09-30', 'Paleta łączona (+ Karton 60x40x40: 120 szt.)');
  addCustom('rack-m4-r5', 2, 1, 'Karton 60x40x40', 120, 'szt.', 'CAŁA PALETA (na palecie z Travel 14)');
  addCustom('rack-m4-r5', 2, 2, 'KARTON S', 3200, 'szt.', 'CAŁA PALETA');
  addCustom('rack-m4-r5', 2, 3, 'KARTON S', 3200, 'szt.', 'CAŁA PALETA');
  addProd('rack-m4-r5', 1, 1, 'prod-9120117914470', 500, '2027-03-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r5', 1, 1, 'prod-9120117912858', 228, '2027-03-31', 'Paleta łączona (2/2)');
  addProd('rack-m4-r5', 1, 2, 'prod-9120117912858', 828, '2027-04-30', 'Paleta łączona (1/2)');
  addProd('rack-m4-r5', 1, 2, 'prod-9120117912865', 169, '2027-05-31', 'Paleta łączona (2/2)');
  addProd('rack-m4-r5', 1, 3, 'prod-9120117912711', 416, '2028-03-31', 'CAŁA PALETA');
  addProd('rack-m4-r5', 0, 1, 'prod-9120001435692', 1157, '2027-08-31', 'CAŁA PALETA');
  addProd('rack-m4-r5', 0, 2, 'prod-9120117912858', 1018, '2027-01-31', 'CAŁA PALETA');
  addProd('rack-m4-r5', 0, 3, 'prod-9120117912681', 1191, '2028-03-31', 'CAŁA PALETA (+ Flora 28 i Hetox)');
  addProd('rack-m4-r5', 0, 3, 'prod-9120117912865', 15, '2027-04-30', 'Paleta łączona');
  addProd('rack-m4-r5', 0, 3, 'prod-9120117912827', 183, '2028-01-31', 'Paleta łączona');

  // --- 6 REGAŁ (rack-m4-r6) ---
  addCustom('rack-m4-r6', 2, 1, 'KARTON S', 3200, 'szt.', 'CAŁA PALETA');
  addCustom('rack-m4-r6', 2, 2, 'KARTON S', 3200, 'szt.', 'CAŁA PALETA');
  addProd('rack-m4-r6', 2, 3, 'prod-9120117912667', 1620, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m4-r6', 1, 1, 'prod-9120117912704', 475, '2028-05-31', 'CAŁA PALETA');
  addProd('rack-m4-r6', 1, 2, 'prod-9120117912667', 1871, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m4-r6', 1, 3, 'prod-9120117912728', 735, '2027-09-30', 'Paleta łączona (1/2)');
  addProd('rack-m4-r6', 1, 3, 'prod-9120117913138', 111, '2027-08-31', 'Paleta łączona (2/2)');
  addProd('rack-m4-r6', 0, 1, 'prod-9120117914692', 359, '2027-09-30', 'CAŁA PALETA');
  addProd('rack-m4-r6', 0, 2, 'prod-9120117911370', 1482, '2028-03-31', 'CAŁA PALETA');
  addProd('rack-m4-r6', 0, 3, 'prod-9120117912674', 993, '2028-07-31', 'CAŁA PALETA');

  // --- 7 REGAŁ (rack-m4-r7) ---
  addCustom('rack-m4-r7', 2, 1, 'KARTON XL', 640, 'szt.', 'CAŁA PALETA');
  addProd('rack-m4-r7', 2, 2, 'prod-9120117912797', 2154, '2027-05-31', 'CAŁA PALETA');
  addCustom('rack-m4-r7', 2, 3, 'KARTON XL', 640, 'szt.', 'CAŁA PALETA');
  addProd('rack-m4-r7', 1, 1, 'prod-9120117915651', 459, '2027-03-31', 'CAŁA PALETA');
  addProd('rack-m4-r7', 1, 2, 'prod-9120117912797', 439, '2027-01-31', 'CAŁA PALETA');
  // 7 Regał Poz I Pal 3: wolne
  addProd('rack-m4-r7', 0, 1, 'prod-9120117912759', 1049, '2028-04-30', 'CAŁA PALETA (1/2)');
  addProd('rack-m4-r7', 0, 1, 'prod-9120117912766', 302, '2028-08-31', 'CAŁA PALETA (2/2)');
  addProd('rack-m4-r7', 0, 2, 'prod-9120117912803', 332, '2027-05-31', 'CAŁA PALETA');
  addProd('rack-m4-r7', 0, 3, 'prod-9120117912742', 347, '2028-08-31', 'Paleta łączona (1/2)');
  addProd('rack-m4-r7', 0, 3, 'prod-9120117912735', 57, '2027-12-31', 'Paleta łączona (2/2)');

  // ==========================================================================
  // 2. LOKAL NR 5 (MAGAZYN 5) — 8 REGAŁÓW + 12 MIEJSC NA PODŁODZE
  // ==========================================================================
  // --- 1 REGAŁ (rack-m5-r1, 2 kolumny) ---
  addProd('rack-m5-r1', 2, 1, 'prod-9120117913138', 3240, '2028-02-29', 'CAŁA PALETA');
  addCustom('rack-m5-r1', 2, 2, 'Palety EURO (zapas)', 1, 'paleta', 'Palety');
  addProd('rack-m5-r1', 1, 1, 'prod-9120117912902', 182, '2027-04-30', 'Paleta');
  addProd('rack-m5-r1', 1, 2, 'prod-9120117912902', 393, '2027-04-30', 'CAŁA PALETA');
  addCustom('rack-m5-r1', 0, 1, 'MARKETING — materiały reklamowe', 1, 'paleta', 'Marketing');
  addProd('rack-m5-r1', 0, 2, 'prod-9120117912926', 475, '2028-03-31', 'Paleta łączona + MARKETING (03_28)');
  addProd('rack-m5-r1', 0, 2, 'prod-9120117912926', 495, '2028-02-29', 'Paleta łączona + MARKETING (02_28)');

  // --- 2 REGAŁ (rack-m5-r2, 3 kolumny) ---
  addProd('rack-m5-r2', 2, 1, 'prod-9120117912889', 436, '2028-05-31', 'CAŁA PALETA');
  addProd('rack-m5-r2', 2, 2, 'prod-9120117912834', 1224, '2028-04-30', 'CAŁA PALETA');
  addProd('rack-m5-r2', 2, 3, 'prod-9120117912834', 1224, '2028-04-30', 'CAŁA PALETA');
  addProd('rack-m5-r2', 1, 1, 'prod-9120117913138', 1350, '2028-02-29', 'Paleta łączona (1/2)');
  addProd('rack-m5-r2', 1, 1, 'prod-9120117912896', 171, '2027-03-31', 'Paleta łączona (2/2)');
  addProd('rack-m5-r2', 1, 2, 'prod-9120117912889', 360, '2028-05-31', 'CAŁA PALETA');
  addProd('rack-m5-r2', 1, 3, 'prod-9120117912735', 3037, '2028-02-29', 'CAŁA PALETA');
  addProd('rack-m5-r2', 0, 1, 'prod-9120117912919', 393, '2028-03-31', 'Paleta łączona (1/2)');
  addProd('rack-m5-r2', 0, 1, 'prod-9120117912919', 376, '2028-03-31', 'Paleta łączona (2/2)');
  addProd('rack-m5-r2', 0, 2, 'prod-9120117912896', 377, '2027-07-31', 'CAŁA PALETA');
  addProd('rack-m5-r2', 0, 3, 'prod-9120117914692', 329, '2028-05-31', 'CAŁA PALETA');

  // --- 3 REGAŁ (rack-m5-r3, 3 kolumny) ---
  addProd('rack-m5-r3', 2, 1, 'prod-9120001435692', 1360, '2027-09-30', 'CAŁA PALETA');
  addProd('rack-m5-r3', 2, 2, 'prod-9120001435692', 1224, '2027-09-30', 'CAŁA PALETA');
  addProd('rack-m5-r3', 2, 3, 'prod-9120117912841', 787, '2028-04-30', 'CAŁA PALETA');
  addProd('rack-m5-r3', 1, 1, 'prod-9120117911370', 756, '2028-09-30', 'Paleta łączona (1/2)');
  addProd('rack-m5-r3', 1, 1, 'prod-9120117912827', 497, '2028-04-30', 'Paleta łączona (2/2)');
  addProd('rack-m5-r3', 1, 2, 'prod-9120117912827', 960, '2028-04-30', 'CAŁA PALETA');
  addProd('rack-m5-r3', 1, 3, 'prod-9120117912827', 703, '2028-04-30', 'CAŁA PALETA');
  addCustom('rack-m5-r3', 0, 1, 'KARTON XL', 100, 'szt.', 'CAŁA PALETA');
  addProd('rack-m5-r3', 0, 2, 'prod-9120117912827', 353, '2028-10-31', 'Paleta');
  // 3 Regał Poz 0 Pal 3: wolne

  // --- 4 REGAŁ (rack-m5-r4, 2 kolumny) ---
  addProd('rack-m5-r4', 2, 1, 'prod-9120117912810', 1080, '2028-02-29', 'CAŁA PALETA');
  addProd('rack-m5-r4', 2, 2, 'prod-9120117912810', 1224, '2028-02-29', 'CAŁA PALETA');
  addProd('rack-m5-r4', 1, 1, 'prod-9120117912810', 1224, '2028-02-29', 'CAŁA PALETA');
  addProd('rack-m5-r4', 1, 2, 'prod-9120117912896', 395, '2027-05-31', 'CAŁA PALETA');
  addProd('rack-m5-r4', 0, 1, 'prod-9120117912933', 384, '2026-12-31', 'CAŁA PALETA');
  addProd('rack-m5-r4', 0, 2, 'prod-9120117912933', 384, '2026-12-31', 'CAŁA PALETA');

  // --- 5 REGAŁ (rack-m5-r5, 2 kolumny) ---
  addProd('rack-m5-r5', 2, 1, 'prod-9120117912711', 540, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m5-r5', 2, 2, 'prod-9120117912711', 437, '2028-05-31', 'Paleta łączona (05_28)');
  addProd('rack-m5-r5', 2, 2, 'prod-9120117912711', 209, '2028-09-30', 'Paleta łączona (09_28)');
  addProd('rack-m5-r5', 1, 1, 'prod-9120117912711', 648, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m5-r5', 1, 2, 'prod-9120117912728', 2160, '2028-03-31', 'CAŁA PALETA');
  addProd('rack-m5-r5', 0, 1, 'prod-9120117912704', 1095, '2028-08-31', 'Paleta łączona (08_28)');
  addProd('rack-m5-r5', 0, 1, 'prod-9120117912704', 129, '2028-10-31', 'Paleta łączona (10_28)');
  addProd('rack-m5-r5', 0, 2, 'prod-9120117912681', 2160, '2028-08-31', 'CAŁA PALETA');

  // --- 6 REGAŁ (rack-m5-r6, 3 kolumny) ---
  addProd('rack-m5-r6', 2, 1, 'prod-9120117912711', 648, '2028-05-31', 'CAŁA PALETA');
  addProd('rack-m5-r6', 2, 2, 'prod-9120117912704', 1080, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m5-r6', 2, 3, 'prod-9120117912704', 1080, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m5-r6', 1, 1, 'prod-9120117912728', 2277, '2028-03-31', 'Paleta łączona (03_28)');
  addProd('rack-m5-r6', 1, 1, 'prod-9120117912728', 963, '2028-05-31', 'Paleta łączona (05_28)');
  addProd('rack-m5-r6', 1, 2, 'prod-9120117912704', 1080, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m5-r6', 1, 3, 'prod-9120117914906', 972, '2027-11-30', 'CAŁA PALETA');
  addProd('rack-m5-r6', 0, 1, 'prod-9120117912681', 2160, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m5-r6', 0, 2, 'prod-9120117914692', 240, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m5-r6', 0, 3, 'prod-9120117912681', 2174, '2028-08-31', 'CAŁA PALETA');

  // --- 7 REGAŁ (rack-m5-r7, 2 kolumny) ---
  addProd('rack-m5-r7', 2, 1, 'prod-9120117911370', 1512, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m5-r7', 2, 2, 'prod-9120117911370', 1890, '2028-03-31', 'CAŁA PALETA');
  addProd('rack-m5-r7', 1, 1, 'prod-9120117911370', 1512, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m5-r7', 1, 2, 'prod-9120117911370', 1485, '2028-09-30', 'CAŁA PALETA');
  // 7 Regał Poz 0 Pal 1: wolne
  addProd('rack-m5-r7', 0, 2, 'prod-9120117911370', 1512, '2028-03-31', 'CAŁA PALETA');

  // --- 8 REGAŁ (rack-m5-r8, 3 kolumny) ---
  // Poz II Pal 1, 2: wolne
  addProd('rack-m5-r8', 2, 3, 'prod-9120117915651', 2160, '2028-03-31', 'CAŁA PALETA');
  addProd('rack-m5-r8', 1, 1, 'prod-9120117911370', 1260, '2028-09-30', 'CAŁA PALETA');
  // Poz I Pal 2: wolne
  addProd('rack-m5-r8', 1, 3, 'prod-9120117915651', 2160, '2027-03-31', 'CAŁA PALETA');
  addCustom('rack-m5-r8', 0, 1, 'SF PRO-VI (3000 szt., 12_27) + SF STRESS (3000 szt., 08_27)', 6000, 'szt.', 'Sample Folders');
  addCustom('rack-m5-r8', 0, 2, 'SF PANDA (5250 szt., 11_28) + SF AAD10 (4000 szt., 07_28)', 9250, 'szt.', 'Sample Folders');
  addProd('rack-m5-r8', 0, 3, 'prod-9120117915651', 2160, '2027-03-31', 'CAŁA PALETA');

  // --- PODŁOGA MAGAZYN 5 (rack-m5-floor, 12 miejsc) ---
  addCustom('rack-m5-floor', 0, 1, 'Torba Termiczna (2029)', 9000, 'szt.', 'CAŁA PALETA');
  addCustom(
    'rack-m5-floor',
    0,
    2,
    'SF FIBRE (600 szt. 05_28) + SF Stress Kids (250 szt. 09_27) + SF Cat&Dog (3900 szt. 07_26)',
    4750,
    'szt.',
    'Sample Folders'
  );
  // Pola 3, 4, 5: wolne
  addCustom('rack-m5-floor', 0, 6, 'KARTON M', 1000, 'szt.', 'Opakowania');
  addCustom('rack-m5-floor', 0, 7, 'KARTON S', 2000, 'szt.', 'Opakowania');
  addCustom('rack-m5-floor', 0, 8, 'KARTON M LONG (1260 + 300)', 1560, 'szt.', 'CAŁA PALETA');
  addCustom('rack-m5-floor', 0, 9, 'KARTON L', 1600, 'szt.', 'CAŁA PALETA');
  // Pola 10, 11, 12: wolne

  // ==========================================================================
  // 3. LOKAL NR 6 (MAGAZYN 6) — 8 REGAŁÓW + 12 MIEJSC NA PODŁODZE
  // ==========================================================================
  // --- 1 REGAŁ (rack-m6-r1, 3 kolumny) ---
  addProd('rack-m6-r1', 2, 1, 'prod-9120117912803', 1200, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 2, 2, 'prod-9120117912803', 1620, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 2, 3, 'prod-9120117912803', 1620, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 1, 1, 'prod-9120117912803', 1296, '2027-05-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 1, 2, 'prod-9120117912803', 1296, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 1, 3, 'prod-9120117912803', 1296, '2027-12-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 0, 1, 'prod-9120117912803', 1296, '2027-05-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 0, 2, 'prod-9120117912803', 1296, '2027-05-31', 'CAŁA PALETA');
  addProd('rack-m6-r1', 0, 3, 'prod-9120117912803', 1296, '2027-05-31', 'CAŁA PALETA');

  // --- 2 REGAŁ (rack-m6-r2, 3 kolumny) ---
  addProd('rack-m6-r2', 2, 1, 'prod-9120117912742', 1224, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r2', 2, 2, 'prod-9120117912742', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r2', 2, 3, 'prod-9120117912742', 678, '2028-09-30', 'Paleta łączona (1/3)');
  addProd('rack-m6-r2', 2, 3, 'prod-9120117912742', 357, '2028-09-30', 'Paleta łączona (2/3)');
  addProd('rack-m6-r2', 2, 3, 'prod-9120117912742', 205, '2028-11-30', 'Paleta łączona (3/3)');
  addProd('rack-m6-r2', 1, 1, 'prod-9120117912742', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r2', 1, 2, 'prod-9120117912742', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r2', 1, 3, 'prod-9120117912742', 1224, '2028-09-30', 'CAŁA PALETA');
  // 2 Regał Poz 0 Pal 1, 2, 3: wolne

  // --- 3 REGAŁ (rack-m6-r3, 3 kolumny) ---
  addProd('rack-m6-r3', 2, 1, 'prod-9120117912742', 918, '2028-08-31', 'Paleta łączona (08_28)');
  addProd('rack-m6-r3', 2, 1, 'prod-9120117912742', 306, '2028-09-30', 'Paleta łączona (09_28)');
  addProd('rack-m6-r3', 2, 2, 'prod-9120117912742', 1224, '2029-04-30', 'CAŁA PALETA');
  addProd('rack-m6-r3', 2, 3, 'prod-9120117912742', 1224, '2029-04-30', 'CAŁA PALETA');
  addProd('rack-m6-r3', 1, 1, 'prod-9120117912742', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r3', 1, 2, 'prod-9120117912742', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r3', 1, 3, 'prod-9120117912742', 643, '2029-04-30', 'Paleta łączona (04_29)');
  addProd('rack-m6-r3', 1, 3, 'prod-9120117912742', 581, '2028-11-30', 'Paleta łączona (11_28)');
  // 3 Regał Poz 0 Pal 1: wolne
  addProd('rack-m6-r3', 0, 2, 'prod-9120117912766', 648, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r3', 0, 3, 'prod-9120117912742', 1224, '2029-04-30', 'CAŁA PALETA');

  // --- 4 REGAŁ (rack-m6-r4, 3 kolumny) ---
  addProd('rack-m6-r4', 2, 1, 'prod-9120117912865', 505, '2028-01-31', 'Paleta łączona (1/2)');
  addProd('rack-m6-r4', 2, 1, 'prod-9120117912865', 356, '2028-01-31', 'Paleta łączona (2/2)');
  // 4 Regał Poz II Pal 2: wolne
  addProd('rack-m6-r4', 2, 3, 'prod-9120117912865', 810, '2027-11-30', 'CAŁA PALETA');
  // 4 Regał Poz I Pal 1, 2, 3: wolne
  addProd('rack-m6-r4', 0, 1, 'prod-9120117912865', 810, '2027-11-30', 'CAŁA PALETA');
  addProd('rack-m6-r4', 0, 2, 'prod-9120117912865', 810, '2027-11-30', 'CAŁA PALETA');
  // 4 Regał Poz 0 Pal 3: wolne

  // --- 5 REGAŁ (rack-m6-r5, 2 kolumny) ---
  addProd('rack-m6-r5', 2, 1, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r5', 2, 2, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');
  // 5 Regał Poz I Pal 1: wolne
  addProd('rack-m6-r5', 1, 2, 'prod-9120117912674', 1350, '2028-07-31', 'CAŁA PALETA');
  addProd('rack-m6-r5', 0, 1, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r5', 0, 2, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');

  // --- 6 REGAŁ (rack-m6-r6, 3 kolumny) ---
  addProd('rack-m6-r6', 2, 1, 'prod-9120117912674', 933, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r6', 2, 2, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');
  // 6 Regał Poz II Pal 3: wolne
  addProd('rack-m6-r6', 1, 1, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r6', 1, 2, 'prod-9120117912674', 987, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r6', 1, 3, 'prod-9120117912674', 519, '2028-08-31', 'Paleta łączona (1/2)');
  addProd('rack-m6-r6', 1, 3, 'prod-9120117912674', 419, '2028-08-31', 'Paleta łączona (2/2)');
  addProd('rack-m6-r6', 0, 1, 'prod-9120117912674', 556, '2028-08-31', 'Paleta łączona (1/2)');
  addProd('rack-m6-r6', 0, 1, 'prod-9120117912674', 395, '2028-08-31', 'Paleta łączona (2/2)');
  addProd('rack-m6-r6', 0, 2, 'prod-9120117912674', 966, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r6', 0, 3, 'prod-9120117912674', 1080, '2028-08-31', 'CAŁA PALETA');

  // --- 7 REGAŁ (rack-m6-r7, 3 kolumny) ---
  addProd('rack-m6-r7', 2, 1, 'prod-9120117912759', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r7', 2, 2, 'prod-9120117912759', 979, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r7', 2, 3, 'prod-9120117912759', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r7', 1, 1, 'prod-9120117912759', 915, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r7', 1, 2, 'prod-9120117912759', 1224, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r7', 1, 3, 'prod-9120117912759', 1224, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r7', 0, 1, 'prod-9120117912759', 1224, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-r7', 0, 2, 'prod-9120117912759', 1224, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r7', 0, 3, 'prod-9120117912766', 578, '2028-08-31', 'CAŁA PALETA');

  // --- 8 REGAŁ (rack-m6-r8, 3 kolumny) ---
  addProd('rack-m6-r8', 2, 1, 'prod-9120117912766', 423, '2028-08-31', 'Paleta łączona (1/2)');
  addProd('rack-m6-r8', 2, 1, 'prod-9120117912759', 360, '2028-08-31', 'Paleta łączona (2/2)');
  addProd('rack-m6-r8', 2, 2, 'prod-9120117912766', 648, '2028-09-30', 'CAŁA PALETA');
  // 8 Regał Poz II Pal 3: wolne
  addProd('rack-m6-r8', 1, 1, 'prod-9120117912766', 648, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r8', 1, 2, 'prod-9120117912766', 648, '2028-08-31', 'CAŁA PALETA');
  // 8 Regał Poz I Pal 3: wolne
  addProd('rack-m6-r8', 0, 1, 'prod-9120117912766', 349, '2028-08-31', 'Paleta łączona (1/2)');
  addProd('rack-m6-r8', 0, 1, 'prod-9120117912759', 350, '2028-08-31', 'Paleta łączona (2/2)');
  addProd('rack-m6-r8', 0, 2, 'prod-9120117912766', 648, '2028-08-31', 'CAŁA PALETA');
  addProd('rack-m6-r8', 0, 3, 'prod-9120117912766', 432, '2028-09-30', 'CAŁA PALETA');

  // --- PODŁOGA MAGAZYN 6 (rack-m6-floor, 12 miejsc) ---
  addCustom('rack-m6-floor', 0, 1, 'Mikrosan Torba', 5600, 'szt.', 'Materiały');
  // Pola 2, 3, 4, 5, 6: wolne
  addProd('rack-m6-floor', 0, 7, 'prod-9120117912766', 682, '2028-10-31', 'CAŁA PALETA');
  addProd('rack-m6-floor', 0, 8, 'prod-9120117912803', 972, '2027-05-31', 'CAŁA PALETA');
  addProd('rack-m6-floor', 0, 9, 'prod-9120117912766', 614, '2028-09-30', 'CAŁA PALETA');
  addProd('rack-m6-floor', 0, 10, 'prod-9120117912759', 1224, '2028-04-30', 'CAŁA PALETA');
  // Pola 11, 12: wolne

  return slots;
}

export const DEFAULT_SAMPLE_DOCUMENTS: WarehouseDocument[] = [
  {
    id: 'doc-pz-18-10-2026',
    docType: 'PZ',
    docNumber: 'PZ 18/10/2026',
    issueDate: '2026-10-09',
    warehouseName: 'Główny Magazyn',
    counterparty: 'JOLANTA STASZCZAK APTEKI FANTAZJA (NIP: 6790025172)',
    notes: 'Dostawa zewnętrzna z wFirma.pl — do alokacji na wybrane miejsce paletowe.',
    status: 'draft',
    createdAt: '2026-10-11T08:00:00.000Z',
    items: [
      {
        id: 'item-pz-1',
        lp: 1,
        rawSku: 'EAN9120117914470',
        rawName: 'Travel — 14 sasz. × 5g PL PARTNER',
        matchedProductId: 'prod-9120117914470',
        isPartnerChannel: true,
        quantity: 3,
        unit: 'szt.',
        unitPrice: 84.15,
        totalValue: 252.45,
        allocatedMovements: [],
      },
    ],
  },
  {
    id: 'doc-pw-30-10-2026',
    docType: 'PW',
    docNumber: 'PW 30/10/2026',
    issueDate: '2026-10-09',
    warehouseName: 'Główny Magazyn',
    counterparty: 'Eubiosis sp. z o.o.',
    notes: 'Częściowy zwrot zamówienia. Protokół anulacji e-paragonu nr 20/10/2026.',
    status: 'draft',
    createdAt: '2026-10-11T08:00:00.000Z',
    items: [
      {
        id: 'item-pw-1',
        lp: 1,
        rawSku: '9120117912674',
        rawName: 'AAD10 — 30 sasz. × 5g PL',
        matchedProductId: 'prod-9120117912674',
        isPartnerChannel: false,
        quantity: 1,
        unit: 'szt.',
        unitPrice: 68.86,
        totalValue: 68.86,
        allocatedMovements: [],
      },
    ],
  },
];

export const DEFAULT_SUSPENDED_RECORDS: SuspendedItemRecord[] = [
  {
    id: 'susp-oct-konferencje',
    issuedAt: '2026-10-11T08:00:00.000Z',
    eventName: 'Wydane na konferencje / niespisane RW (Inwentaryzacja Października)',
    takenBy: 'Zespół Konferencyjny / Targi',
    expectedReturnDate: '2026-10-25',
    status: 'suspended',
    notes: 'Pozycje z kolumny „WYDANE NA KONFERENCJE / NIESPISANE RW" w arkuszu INWENTARYZACJA.',
    items: [
      {
        id: 'susp-item-1',
        productId: 'prod-9120117912797',
        productName: 'Pro-Vi 5 — 14 sasz. × 2g',
        lotNumber: 'MHD-03/27',
        expiryDate: '2027-03-31',
        sourceSlotId: 'slot-rack-m4-r3-2-1',
        sourceSlotCode: 'M4-R3-POZ.II-1PAL',
        quantityIssued: 40,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-2',
        productId: 'prod-9120117912766',
        productName: 'Stress Repair — 56 sasz. × 3g',
        lotNumber: 'MHD-08/28',
        expiryDate: '2028-08-31',
        sourceSlotId: 'slot-rack-m4-r7-0-1',
        sourceSlotCode: 'M4-R7-POZ.0-1PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-3',
        productId: 'prod-9120117912759',
        productName: 'Stress Repair — 28 sasz. × 3g',
        lotNumber: 'MHD-04/28',
        expiryDate: '2028-04-30',
        sourceSlotId: 'slot-rack-m4-r7-0-1',
        sourceSlotCode: 'M4-R7-POZ.0-1PAL',
        quantityIssued: 2,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-4',
        productId: 'prod-9120117915651',
        productName: 'Stress Repair Kids — 28 sasz. × 1,2g',
        lotNumber: 'MHD-03/27',
        expiryDate: '2027-03-31',
        sourceSlotId: 'slot-rack-m4-r7-1-1',
        sourceSlotCode: 'M4-R7-POZ.I-1PAL',
        quantityIssued: 2,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-5',
        productId: 'prod-9120001435692',
        productName: 'Travel — 28 sasz. × 5g',
        lotNumber: 'MHD-08/27',
        expiryDate: '2027-08-31',
        sourceSlotId: 'slot-rack-m4-r5-0-1',
        sourceSlotCode: 'M4-R5-POZ.0-1PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-6',
        productId: 'prod-9120117912674',
        productName: 'AAD10 — 30 sasz. × 5g',
        lotNumber: 'MHD-07/28',
        expiryDate: '2028-07-31',
        sourceSlotId: 'slot-rack-m4-r6-0-3',
        sourceSlotCode: 'M4-R6-POZ.0-3PAL',
        quantityIssued: 2,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-7',
        productId: 'prod-9120117911370',
        productName: 'AAD10 Kids — 20 sasz. × 2,5g',
        lotNumber: 'MHD-03/28',
        expiryDate: '2028-03-31',
        sourceSlotId: 'slot-rack-m4-r6-0-2',
        sourceSlotCode: 'M4-R6-POZ.0-2PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-8',
        productId: 'prod-9120117912858',
        productName: 'FLORA plus+ — 14 sasz. × 2g',
        lotNumber: 'MHD-01/27',
        expiryDate: '2027-01-31',
        sourceSlotId: 'slot-rack-m4-r5-0-2',
        sourceSlotCode: 'M4-R5-POZ.0-2PAL',
        quantityIssued: 2,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-9',
        productId: 'prod-9120117912810',
        productName: 'Metabolic — 30 sasz. × 3g',
        lotNumber: 'MHD-02/28',
        expiryDate: '2028-02-29',
        sourceSlotId: 'slot-rack-m4-r2-1-2',
        sourceSlotCode: 'M4-R2-POZ.I-2PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-10',
        productId: 'prod-9120117912742',
        productName: 'Panda — 30 sasz. × 3g',
        lotNumber: 'MHD-08/28',
        expiryDate: '2028-08-31',
        sourceSlotId: 'slot-rack-m4-r7-0-3',
        sourceSlotCode: 'M4-R7-POZ.0-3PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-item-11',
        productId: 'prod-9120117912735',
        productName: 'Panda — 7 sasz. × 3g',
        lotNumber: 'MHD-12/27',
        expiryDate: '2027-12-31',
        sourceSlotId: 'slot-rack-m4-r7-0-3',
        sourceSlotCode: 'M4-R7-POZ.0-3PAL',
        quantityIssued: 10,
        quantityReturned: 0,
        quantitySettled: 0,
      },
    ],
  },
  {
    id: 'susp-oct-pracownicy',
    issuedAt: '2026-10-11T08:00:00.000Z',
    eventName: 'Nierozliczone zamówienia pracowników (4 zamówienia — Inwentaryzacja Października)',
    takenBy: 'Zamówienia pracownicze',
    expectedReturnDate: '2026-10-20',
    status: 'suspended',
    notes: 'Pozycje z kolumny „NIEROZLICZONE ZAMÓWIENIA PRACOWNIKÓW" w arkuszu INWENTARYZACJA.',
    items: [
      {
        id: 'susp-emp-1',
        productId: 'prod-9120117912803',
        productName: 'Pro-Vi 5 — 30 sasz. × 2g',
        lotNumber: 'MHD-05/27',
        expiryDate: '2027-05-31',
        sourceSlotId: 'slot-rack-m4-r7-0-2',
        sourceSlotCode: 'M4-R7-POZ.0-2PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-2',
        productId: 'prod-9120117912766',
        productName: 'Stress Repair — 56 sasz. × 3g',
        lotNumber: 'MHD-08/28',
        expiryDate: '2028-08-31',
        sourceSlotId: 'slot-rack-m4-r7-0-1',
        sourceSlotCode: 'M4-R7-POZ.0-1PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-3',
        productId: 'prod-9120117912759',
        productName: 'Stress Repair — 28 sasz. × 3g',
        lotNumber: 'MHD-04/28',
        expiryDate: '2028-04-30',
        sourceSlotId: 'slot-rack-m4-r7-0-1',
        sourceSlotCode: 'M4-R7-POZ.0-1PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-4',
        productId: 'prod-9120117912674',
        productName: 'AAD10 — 30 sasz. × 5g',
        lotNumber: 'MHD-07/28',
        expiryDate: '2028-07-31',
        sourceSlotId: 'slot-rack-m4-r6-0-3',
        sourceSlotCode: 'M4-R6-POZ.0-3PAL',
        quantityIssued: 3,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-5',
        productId: 'prod-9120117912872',
        productName: 'Cat&Dog — 60g słoik',
        lotNumber: 'MHD-10/27',
        expiryDate: '2027-10-31',
        sourceSlotId: 'slot-rack-m4-r3-0-2',
        sourceSlotCode: 'M4-R3-POZ.0-2PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-6',
        productId: 'prod-9120117912827',
        productName: 'Hetox — 30 sasz. × 6g',
        lotNumber: 'MHD-01/28',
        expiryDate: '2028-01-31',
        sourceSlotId: 'slot-rack-m4-r5-0-3',
        sourceSlotCode: 'M4-R5-POZ.0-3PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-7',
        productId: 'prod-9120117912841',
        productName: 'POWER — 28 sasz. × 4g',
        lotNumber: 'MHD-10/27',
        expiryDate: '2027-10-31',
        sourceSlotId: 'slot-rack-m4-r4-1-1',
        sourceSlotCode: 'M4-R4-POZ.I-1PAL',
        quantityIssued: 1,
        quantityReturned: 0,
        quantitySettled: 0,
      },
      {
        id: 'susp-emp-8',
        productId: 'prod-9120117912889',
        productName: 'Fibre — 250g słoik PET',
        lotNumber: 'MHD-10/27',
        expiryDate: '2027-10-31',
        sourceSlotId: 'slot-rack-m4-r4-0-1',
        sourceSlotCode: 'M4-R4-POZ.0-1PAL',
        quantityIssued: 3,
        quantityReturned: 0,
        quantitySettled: 0,
      },
    ],
  },
];

export const DEFAULT_MOVEMENTS_HISTORY: StockMovementHistoryEntry[] = [
  {
    id: 'mov-init-oct-1',
    timestamp: '2026-10-11T08:00:00.000Z',
    type: 'INVENTORY_ADJUST',
    productId: 'ALL',
    productName: 'Odtworzenie 1:1 Inwentaryzacji Października (Lokal nr 4, Lokal nr 5, Lokal nr 6) + Cennik Kartonów',
    quantity: 0,
    lotNumber: '-',
    expiryDate: '-',
    toSlotCode: 'MAGAZYN 4, 5, 6',
    referenceDoc: 'INWENTARYZACJA PAŹDZIERNIK',
    performedBy: 'System WMS Eubiosis',
    notes: 'Dokładne odwzorowanie regałów, poziomów (POZIOM II, I, 0), miejsc paletowych i dat ważności z pliku inwentaryzacyjnego.',
  },
];

export function createInitialWMSState(): WMSFullState {
  const products = DEFAULT_PRODUCTS_CATALOG.map((p) => ({ ...p }));
  const slots = buildInitialSlotsWithAllocations(products);

  return {
    revision: 1,
    updatedAt: new Date().toISOString(),
    warehouses: DEFAULT_WAREHOUSES.map((w) => ({ ...w })),
    racks: DEFAULT_RACKS.map((r) => ({ ...r })),
    slots,
    products,
    documents: DEFAULT_SAMPLE_DOCUMENTS.map((d) => ({ ...d })),
    suspendedRecords: DEFAULT_SUSPENDED_RECORDS.map((s) => ({ ...s })),
    movementsHistory: DEFAULT_MOVEMENTS_HISTORY.map((m) => ({ ...m })),
    wfirmaSnapshot: {
      snapshotDate: '2026-10-11',
      warehouseName: 'Inwentaryzacja Października (Magazyn 4, 5, 6)',
      totalRowsParsed: 32,
      totalValueNet: 9681955.72,
      importedAt: '2026-10-11T08:00:00.000Z',
      rows: [],
    },
  };
}
