import {
  ProductCatalogItem,
  SpatialWarehouse,
  WarehouseRack,
  WarehouseLocationSlot,
  WarehouseDocument,
  SuspendedItemRecord,
  StockMovementHistoryEntry,
  WMSFullState,
} from '../types/wms';

export const DEFAULT_PRODUCTS_CATALOG: ProductCatalogItem[] = [
  // === 1. MIKROSAN ===
  {
    id: 'prod-9120117912933',
    baseEan: '9120117912933',
    skuRegular: '9120117912933',
    skuPartner: 'EAN9120117912933',
    name: 'MikroSan — 1000ml butelka PET',
    shortName: 'MikroSan 1000ml',
    category: 'mikrosan',
    unit: 'szt.',
    avgPurchasePriceNet: 70.27,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 677,   // 1 + 255 + 293 + 95 + 6 + 27
    wfirmaStockPartner: 308,   // 2 + 306
    wfirmaLastUpdated: '2026-10-11',
  },

  // === 2. PROBIOTYKI GŁÓWNE (Bez przedrostka OMNi-BiOTiC — od razu Rodzaj i Wariant) ===
  {
    id: 'prod-9120117912797',
    baseEan: '9120117912797',
    skuRegular: '9120117912797',
    skuPartner: 'EAN9120117912797',
    name: 'Pro-Vi 5 — 14 sasz. × 2g',
    shortName: 'Pro-Vi 5 • 14 sasz.',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 30.89,
    minPickingStock: 60,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4085,  // 90 + 2893 + 576 + 526
    wfirmaStockPartner: 1338,  // 3 + 1335
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 64.95,
    minPickingStock: 80,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 13204, // 3 + 2760 + 4 + 4056 + 6381
    wfirmaStockPartner: 392,   // poz. 162
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 119.50,
    minPickingStock: 60,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4721,  // 183 + 2160 + 1080 + 1298
    wfirmaStockPartner: 1726,  // 1725 + 1
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 69.15,
    minPickingStock: 80,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 11002, // 1 + 3856 + 5059 + 2086
    wfirmaStockPartner: 858,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 21.15,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4356,  // 1002 + 730 + 1093 + 1458 + 73
    wfirmaStockPartner: 528,   // 28 + 500
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 57.10,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 5791,  // 2 + 1 + 1 + 1161 + 4626
    wfirmaStockPartner: 1148,  // 148 + 1000
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 64.80,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 3725,  // 27 + 1117 + 2272 + 309
    wfirmaStockPartner: 63,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 41.95,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1705,  // 11 + 315 + 1216 + 163
    wfirmaStockPartner: 466,   // 4 + 1 + 49 + 7 + 405
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 230.60,
    minPickingStock: 25,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 800,   // 3 + 440 + 157 + 200
    wfirmaStockPartner: 184,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 63.75,
    minPickingStock: 60,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 7056,  // 28 + 524 + 1215 + 1215 + 1827 + 2247
    wfirmaStockPartner: 576,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 81.05,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4709,  // 235 + 1080 + 1087 + 1083 + 1224
    wfirmaStockPartner: 190,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 147.10,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2654,  // 18 + 366 + 540 + 540 + 542 + 648
    wfirmaStockPartner: 220,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 25.42,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4197,  // 11 + 225 + 1350 + 1890 + 498 + 223
    wfirmaStockPartner: 1941,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 30.95,
    minPickingStock: 60,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4232,  // 179 + 900 + 1350 + 1803
    wfirmaStockPartner: 2410,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 68.50,
    minPickingStock: 80,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 13730, // 442 + 5100 + 4080 + 4108
    wfirmaStockPartner: 708,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 31.33,
    minPickingStock: 60,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 9653,  // 44 + 1416 + 3150 + 1260 + 3783
    wfirmaStockPartner: 1662,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 63.55,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1333,  // 2 + 1 + 12 + 1001 + 317
    wfirmaStockPartner: 350,   // 349 + 1
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 55.15,
    minPickingStock: 20,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 100,
    wfirmaStockPartner: 32,    // 20 + 11 + 1
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 67.75,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 623,   // 12 + 151 + 460
    wfirmaStockPartner: 477,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 31.61,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1995,  // 1515 + 50 + 430
    wfirmaStockPartner: 527,   // 25 + 2 + 500
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 61.71,
    minPickingStock: 60,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 4279,  // 94 + 2526 + 406 + 1 + 1 + 1251
    wfirmaStockPartner: 184,   // 2 + 182
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 117.80,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2468,  // 92 + 1320 + 1056
    wfirmaStockPartner: 202,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 67.35,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2238,  // 776 + 223 + 1 + 13 + 1 + 1224
    wfirmaStockPartner: 1367,  // 1 + 20 + 1277 + 69
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 67.00,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1531,  // 1 + 46 + 255 + 1229
    wfirmaStockPartner: 1521,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 63.93,
    minPickingStock: 100,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 15501, // 4482 + 6120 + 4899
    wfirmaStockPartner: 589,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 20.48,
    minPickingStock: 50,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 2800,  // 372 + 1012 + 1364 + 52
    wfirmaStockPartner: 271,   // 270 + 1
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 70.10,
    minPickingStock: 40,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1205,  // 10 + 183 + 225 + 337 + 450
    wfirmaStockPartner: 408,
    wfirmaLastUpdated: '2026-10-11',
  },

  // === 3. PREBIOTYKI (Bez przedrostka OMNi-LOGiC — od razu Rodzaj i Wariant) ===
  {
    id: 'prod-9120117912926',
    baseEan: '9120117912926',
    skuRegular: '9120117912926',
    skuPartner: 'EAN9120117912926',
    name: 'ApplePectin — 84 kaps.',
    shortName: 'ApplePectin • 84 kaps.',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 40.40,
    minPickingStock: 35,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 748,   // 250 + 2 + 168 + 328
    wfirmaStockPartner: 257,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 66.75,
    minPickingStock: 35,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1024,  // 1 + 101 + 250 + 120 + 9 + 168 + 225 + 52 + 90 + 8
    wfirmaStockPartner: 122,
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 36.72,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 428,   // 427 + 1
    wfirmaStockPartner: 263,   // 262 + 1
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 68.58,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1078,  // 308 + 397 + 373
    wfirmaStockPartner: 167,   // 7 + 160
    wfirmaLastUpdated: '2026-10-11',
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
    avgPurchasePriceNet: 68.98,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 607,   // 538 + 23 + 1 + 4 + 40 + 1
    wfirmaStockPartner: 101,   // 9 + 92
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-humin-20',
    baseEan: '',
    skuRegular: 'OMNI-LOGIC-HUMIN-20',
    name: 'HUMIN — 20 kaps.',
    shortName: 'HUMIN • 20 kaps.',
    category: 'prebiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 10,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 60,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-skin-fussbad',
    baseEan: '',
    skuRegular: 'OMNI-SKIN-FUSSBAD',
    name: 'SKiN — Intensiv-Fußbad',
    shortName: 'SKiN • Fußbad',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 5,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-skin-hautbad',
    baseEan: '',
    skuRegular: 'OMNI-SKIN-HAUTBAD',
    name: 'SKiN — Intensiv-Hautbad 125g',
    shortName: 'SKiN • Hautbad 125g',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 5,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-skin-pflegesalbe',
    baseEan: '',
    skuRegular: 'OMNI-SKIN-PFLEGESALBE',
    name: 'SKiN — Intensiv-Pflegesalbe 100ml',
    shortName: 'SKiN • Pflegesalbe 100ml',
    category: 'probiotic',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 5,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },

  // === 4. ZESTAWY I PROMOCJE ===
  {
    id: 'prod-9120117912934',
    baseEan: '9120117912934',
    skuRegular: '9120117912934',
    name: 'MikroSan — promocja 11/2026',
    shortName: 'MikroSan • PROMO 11/26',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 69.34,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912933', quantityPerKit: 1 }],
    wfirmaStockRegular: 5,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-9120117912935',
    baseEan: '9120117912935',
    skuRegular: '9120117912935',
    name: 'MikroSan — PROMOCJA MAGENTOWICZE',
    shortName: 'MikroSan • Magentowicze',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 69.34,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912933', quantityPerKit: 1 }],
    wfirmaStockRegular: 2,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-9120117912813',
    baseEan: '9120117912813',
    skuRegular: '9120117912813',
    name: 'Metabolic — 30 sasz. PROMOCJA -30%',
    shortName: 'Metabolic • PROMO -30%',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 66.84,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912810', quantityPerKit: 1 }],
    wfirmaStockRegular: 2,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-9120117912903',
    baseEan: '9120117912903',
    skuRegular: '9120117912903',
    name: 'Plus — promocja 10/2026',
    shortName: 'Plus • PROMO 10/26',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 69.41,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912902', quantityPerKit: 1 }],
    wfirmaStockRegular: 5,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-9120117912904',
    baseEan: '9120117912904',
    skuRegular: '9120117912904',
    name: 'Plus — PROMOCJA MAGENTOWICZE',
    shortName: 'Plus • Magentowicze',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 69.34,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912902', quantityPerKit: 1 }],
    wfirmaStockRegular: 3,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-9120117912798',
    baseEan: '9120117912798',
    skuRegular: '9120117912798',
    name: 'Zestaw 2× Pro-Vi 5 — 14 sasz.',
    shortName: 'Zestaw • 2× Pro-Vi 5 (14s)',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 61.94,
    minPickingStock: 20,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912797', quantityPerKit: 2 }],
    wfirmaStockRegular: 98,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-12365478970348',
    baseEan: '12365478970348',
    skuRegular: '12365478970348',
    name: 'Zestaw 2× Plus 10/26 + 1× MikroSan 11/26',
    shortName: 'Zestaw • 2×Plus + MikroSan',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 208.45,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    kitComponents: [
      { productId: 'prod-9120117912903', quantityPerKit: 2 },
      { productId: 'prod-9120117912934', quantityPerKit: 1 },
    ],
    wfirmaStockRegular: 4,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-12365478970347',
    baseEan: '12365478970347',
    skuRegular: '12365478970347',
    name: 'Zestaw Flora B2C',
    shortName: 'Zestaw • Flora B2C',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 63.32,
    minPickingStock: 25,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912858', quantityPerKit: 2 }],
    wfirmaStockRegular: 177,   // 176 + 1
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-1254856325414',
    baseEan: '1254856325414',
    skuRegular: '1254856325414',
    name: 'Zestaw MikroSan 2+1',
    shortName: 'Zestaw • MikroSan 2+1',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 210.45,
    minPickingStock: 20,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912933', quantityPerKit: 3 }],
    wfirmaStockRegular: 92,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-1254856325412',
    baseEan: '1254856325412',
    skuRegular: '1254856325412',
    name: 'Zestaw MikroSan B2C 12/2026',
    shortName: 'Zestaw • MikroSan B2C 12/26',
    category: 'promo_kit',
    unit: 'szt.',
    avgPurchasePriceNet: 140.30,
    minPickingStock: 15,
    kitHandlingMode: 'separate_slot',
    kitComponents: [{ productId: 'prod-9120117912933', quantityPerKit: 2 }],
    wfirmaStockRegular: 34,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },

  // === 5. PRÓBKI Z ULOTKĄ ===
  {
    id: 'prod-sample-10aad',
    baseEan: '3216549877420',
    skuRegular: '3216549877420',
    name: 'Próbka z ulotką — 10AAD',
    shortName: 'Próbka • 10AAD',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 2.58,
    minPickingStock: 200,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 3449,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-sample-catdog',
    baseEan: '9120117912875',
    skuRegular: '9120117912875',
    name: 'Próbka z ulotką — Cat&Dog',
    shortName: 'Próbka • Cat&Dog',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 200,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 3583,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-sample-olfibre',
    baseEan: '',
    skuRegular: 'PROBKA-OL-FIBRE',
    name: 'Próbka z ulotką — Fibre',
    shortName: 'Próbka • Fibre',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 2.54,
    minPickingStock: 100,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 225,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-sample-panda',
    baseEan: '7412589633697',
    skuRegular: 'PROBKA-PANDA',
    skuPartner: '7412589633697',
    name: 'Próbka z ulotką — Panda (w tym B2C)',
    shortName: 'Próbka • Panda',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 2.15,
    minPickingStock: 300,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 3400,
    wfirmaStockPartner: 657,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-sample-provi',
    baseEan: '7412589633698',
    skuRegular: 'PROBKA-PRO-VI',
    skuPartner: '7412589633698',
    name: 'Próbka z ulotką — Pro-Vi 5 (w tym B2C)',
    shortName: 'Próbka • Pro-Vi 5',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 2.15,
    minPickingStock: 300,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1500,
    wfirmaStockPartner: 281,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-sample-stress',
    baseEan: '7412589633700',
    skuRegular: '3216549877502',
    skuPartner: '7412589633700',
    name: 'Próbka z ulotką — Stress Repair (w tym B2C)',
    shortName: 'Próbka • Stress Repair',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 2.15,
    minPickingStock: 300,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1755,
    wfirmaStockPartner: 432,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-sample-stress-kids',
    baseEan: '7412589633701',
    skuRegular: '7412589633701',
    skuPartner: '7412589633703',
    name: 'Próbka z ulotką — Stress Kids (w tym B2C)',
    shortName: 'Próbka • Stress Kids',
    category: 'sample',
    unit: 'szt.',
    avgPurchasePriceNet: 2.12,
    minPickingStock: 100,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 188,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },

  // === 6. GADŻETY, TORBY I MATERIAŁY REKLAMOWE ===
  {
    id: 'prod-acc-torba-kwiaty',
    baseEan: '',
    skuRegular: 'TORBA-TERMICZNA-KWIATY',
    name: 'Torba Termiczna — motyw kwiatów',
    shortName: 'Torba Term. • Kwiaty',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 2.35,
    minPickingStock: 200,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 9379,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-acc-torba-mikrosan',
    baseEan: '',
    skuRegular: 'TORBA-TERMICZNA-MIKROSAN',
    name: 'Torba Termiczna — MikroSan',
    shortName: 'Torba Term. • MikroSan',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 2.05,
    minPickingStock: 200,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 7000,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-acc-notes',
    baseEan: '',
    skuRegular: 'OMNI-NOTES',
    name: 'Notes reklamowy',
    shortName: 'Notes reklamowy',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 200,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-acc-smycz',
    baseEan: '',
    skuRegular: 'OMNI-SMYCZ',
    name: 'Smycz reklamowa',
    shortName: 'Smycz reklamowa',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 0.01,
    minPickingStock: 30,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 200,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-acc-parasol',
    baseEan: '',
    skuRegular: 'PARASOL-ROZOWY',
    name: 'Parasol różowy',
    shortName: 'Parasol różowy',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 27.65,
    minPickingStock: 15,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 154,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-acc-termofor',
    baseEan: '24322156755',
    skuRegular: '24322156755',
    name: 'Termofor PANDA',
    shortName: 'Termofor PANDA',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 30.72,
    minPickingStock: 10,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 18,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
  {
    id: 'prod-acc-torba-sklep',
    baseEan: '9120001433922',
    skuRegular: '9120001433922',
    name: 'Torba materiałowa (Sklep)',
    shortName: 'Torba • Sklep',
    category: 'accessory',
    unit: 'szt.',
    avgPurchasePriceNet: 24.38,
    minPickingStock: 5,
    kitHandlingMode: 'separate_slot',
    wfirmaStockRegular: 1,
    wfirmaStockPartner: 0,
    wfirmaLastUpdated: '2026-10-11',
  },
];

export const DEFAULT_WAREHOUSES: SpatialWarehouse[] = [
  {
    id: 'wh-mag-4',
    code: 'MAG-4',
    name: 'Magazyn 4 — Kompletacja',
    description:
      'Prostokątna hala kompletacji: po lewej stronie Brama, na środku Strefa Przemieszczania się, po bokach regały kompletacyjne (Główne, PARTNER >12m, Próbki, Zestawy) oraz wyznaczone miejsca paletowe na podłodze.',
    hasPickingZone: true,
  },
  {
    id: 'wh-mag-5',
    code: 'MAG-5',
    name: 'Magazyn 5 — Składowanie',
    description:
      'Prostokątna hala składowania: po lewej stronie Brama wjazdowa, na środku Strefa Przemieszczania się, po obu bokach regały paletowe oraz wydzielone miejsca paletowe bezpośrednio na podłodze.',
    hasPickingZone: false,
  },
  {
    id: 'wh-mag-6',
    code: 'MAG-6',
    name: 'Magazyn 6 — Składowanie',
    description:
      'Prostokątna hala składowania: po lewej stronie Brama wjazdowa, na środku Strefa Przemieszczania się, po bokach regały paletowe + miejsca paletowe na podłodze (w tym pozycje opisywane ręcznie).',
    hasPickingZone: false,
  },
];

export const DEFAULT_RACKS: WarehouseRack[] = [
  // ============================================================================
  // MAGAZYN 4 — KOMPLETACJA (Po 3 regały 12-paletowe na stronę + miejsca na podłodze)
  // ============================================================================
  // Bok Górny (od lewej strony od bramy: Regał 1, Regał 2, Regał 3)
  {
    id: 'rack-m4-r1',
    warehouseId: 'wh-mag-4',
    code: 'M4-R1',
    name: 'Regał 1 (Kompletacja Główna)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 4 poziomy × 3 miejsca = 12 miejsc paletowych
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r2',
    warehouseId: 'wh-mag-4',
    code: 'M4-R2',
    name: 'Regał 2 (Kompletacja Główna)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'emerald',
  },
  {
    id: 'rack-m4-r3',
    warehouseId: 'wh-mag-4',
    code: 'M4-R3',
    name: 'Regał 3 (Kompletacja PARTNER >12 msc)',
    zoneType: 'picking',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'violet',
  },
  // Bok Dolny (od lewej strony od bramy: Regał 4, Regał 5, Regał 6)
  {
    id: 'rack-m4-r4',
    warehouseId: 'wh-mag-4',
    code: 'M4-R4',
    name: 'Regał 4 (Próbki z Ulotką i B2C)',
    zoneType: 'samples_kits',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'rose',
  },
  {
    id: 'rack-m4-r5',
    warehouseId: 'wh-mag-4',
    code: 'M4-R5',
    name: 'Regał 5 (Zestawy Promocyjne i Akcesoria)',
    zoneType: 'samples_kits',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'amber',
  },
  {
    id: 'rack-m4-r6',
    warehouseId: 'wh-mag-4',
    code: 'M4-R6',
    name: 'Regał 6 (Kompletacja Rezerwowa)',
    zoneType: 'picking',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'emerald',
  },
  // Miejsca paletowe na podłodze w Magazynie 4
  {
    id: 'rack-m4-floor',
    warehouseId: 'wh-mag-4',
    code: 'M4-PODLOGA',
    name: 'Miejsca Paletowe na Podłodze (Magazyn 4)',
    zoneType: 'floor_pallet',
    hallPlacement: 'floor_zone',
    levelsCount: 1,
    slotsPerLevel: 6,
    colorTheme: 'amber',
  },

  // ============================================================================
  // MAGAZYN 5 — SKŁADOWANIE (Po 3 regały 12-paletowe na stronę + miejsca na podłodze)
  // ============================================================================
  // Bok Górny (od lewej strony od bramy: Regał 1, Regał 2, Regał 3)
  {
    id: 'rack-m5-r1',
    warehouseId: 'wh-mag-5',
    code: 'M5-R1',
    name: 'Regał 1 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r2',
    warehouseId: 'wh-mag-5',
    code: 'M5-R2',
    name: 'Regał 2 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r3',
    warehouseId: 'wh-mag-5',
    code: 'M5-R3',
    name: 'Regał 3 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  // Bok Dolny (od lewej strony od bramy: Regał 4, Regał 5, Regał 6)
  {
    id: 'rack-m5-r4',
    warehouseId: 'wh-mag-5',
    code: 'M5-R4',
    name: 'Regał 4 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r5',
    warehouseId: 'wh-mag-5',
    code: 'M5-R5',
    name: 'Regał 5 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m5-r6',
    warehouseId: 'wh-mag-5',
    code: 'M5-R6',
    name: 'Regał 6 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  // Miejsca paletowe na podłodze w Magazynie 5
  {
    id: 'rack-m5-floor',
    warehouseId: 'wh-mag-5',
    code: 'M5-PODLOGA',
    name: 'Miejsca Paletowe na Podłodze (Magazyn 5)',
    zoneType: 'floor_pallet',
    hallPlacement: 'floor_zone',
    levelsCount: 1,
    slotsPerLevel: 6,
    colorTheme: 'amber',
  },

  // ============================================================================
  // MAGAZYN 6 — SKŁADOWANIE (Po 3 regały 12-paletowe na stronę + miejsca na podłodze)
  // ============================================================================
  // Bok Górny (od lewej strony od bramy: Regał 1, Regał 2, Regał 3)
  {
    id: 'rack-m6-r1',
    warehouseId: 'wh-mag-6',
    code: 'M6-R1',
    name: 'Regał 1 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r2',
    warehouseId: 'wh-mag-6',
    code: 'M6-R2',
    name: 'Regał 2 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r3',
    warehouseId: 'wh-mag-6',
    code: 'M6-R3',
    name: 'Regał 3 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'top_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  // Bok Dolny (od lewej strony od bramy: Regał 4, Regał 5, Regał 6)
  {
    id: 'rack-m6-r4',
    warehouseId: 'wh-mag-6',
    code: 'M6-R4',
    name: 'Regał 4 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r5',
    warehouseId: 'wh-mag-6',
    code: 'M6-R5',
    name: 'Regał 5 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  {
    id: 'rack-m6-r6',
    warehouseId: 'wh-mag-6',
    code: 'M6-R6',
    name: 'Regał 6 (12-paletowy)',
    zoneType: 'pallet',
    hallPlacement: 'bottom_wall',
    levelsCount: 4,
    slotsPerLevel: 3, // 12 miejsc paletowych
    colorTheme: 'blue',
  },
  // Miejsca paletowe na podłodze w Magazynie 6
  {
    id: 'rack-m6-floor',
    warehouseId: 'wh-mag-6',
    code: 'M6-PODLOGA',
    name: 'Miejsca Paletowe na Podłodze (Magazyn 6)',
    zoneType: 'floor_pallet',
    hallPlacement: 'floor_zone',
    levelsCount: 1,
    slotsPerLevel: 6,
    colorTheme: 'amber',
  },
];

/**
 * Buduje kompletną siatkę miejsc magazynowych (Magazyn 4, 5, 6 — po 3 regały 12-paletowe na stronę + miejsca na podłodze)
 * wraz z początkową alokacją stanów z zestawienia wFirma na dzień 11-10-2026.
 */
export function buildInitialSlotsWithAllocations(products: ProductCatalogItem[]): WarehouseLocationSlot[] {
  const slots: WarehouseLocationSlot[] = [];
  const nowIso = '2026-10-11T08:00:00.000Z';

  for (const rack of DEFAULT_RACKS) {
    for (let level = 0; level < rack.levelsCount; level++) {
      for (let pos = 1; pos <= rack.slotsPerLevel; pos++) {
        const posStr = String(pos).padStart(2, '0');
        const slotCode = `${rack.code}-P${level}-${posStr}`;
        let slotType: WarehouseLocationSlot['slotType'] = 'pallet_storage';
        let maxCap = 2000;

        if (rack.id === 'rack-m4-r1' || rack.id === 'rack-m4-r2' || rack.id === 'rack-m4-r6') {
          slotType = 'picking_standard';
          maxCap = 300;
        } else if (rack.id === 'rack-m4-r3') {
          slotType = 'picking_partner_12m';
          maxCap = 250;
        } else if (rack.zoneType === 'floor_pallet' || rack.hallPlacement === 'floor_zone') {
          slotType = 'floor_pallet';
          maxCap = 2500;
        } else if (rack.zoneType === 'samples_kits') {
          slotType = 'shelf_storage';
          maxCap = 5000;
        }

        slots.push({
          id: `slot-${rack.id}-${level}-${pos}`,
          warehouseId: rack.warehouseId,
          rackId: rack.id,
          code: slotCode,
          name:
            slotType === 'picking_standard'
              ? `${rack.name} — P${level}-${posStr}`
              : slotType === 'picking_partner_12m'
              ? `${rack.name} — P${level}-${posStr}`
              : slotType === 'floor_pallet'
              ? `Miejsce Paletowe na Podłodze ${rack.code} (Pole #${posStr})`
              : `${rack.name} — Poziom P${level}, Miejsce ${posStr}`,
          level,
          position: pos,
          slotType,
          maxCapacityUnits: maxCap,
          allocations: [],
        });
      }
    }
  }

  // Rozmieść produkty z katalogu na Magazynie 4 (Kompletacja) oraz Magazynach 5 i 6 (Regały 1-6 + Podłoga)
  const pickingMainSlots = slots.filter(
    (s) => s.rackId === 'rack-m4-r1' || s.rackId === 'rack-m4-r2' || s.rackId === 'rack-m4-r6'
  );
  const pickingPartnerSlots = slots.filter((s) => s.rackId === 'rack-m4-r3');
  const palletSlots = slots.filter(
    (s) => s.warehouseId === 'wh-mag-5' || s.warehouseId === 'wh-mag-6'
  );
  const sampleSlots = slots.filter((s) => s.rackId === 'rack-m4-r4');
  const kitBagSlots = slots.filter((s) => s.rackId === 'rack-m4-r5');

  let mainPickIdx = 0;
  let partnerPickIdx = 0;
  let palletIdx = 0;
  let sampleIdx = 0;
  let kitIdx = 0;

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const totalWfirma = prod.wfirmaStockRegular + prod.wfirmaStockPartner;
    if (totalWfirma <= 0) continue;

    if (prod.category === 'probiotic' || prod.category === 'prebiotic' || prod.category === 'mikrosan') {
      const pickSlot = pickingMainSlots[mainPickIdx % pickingMainSlots.length];
      mainPickIdx++;

      const hasShortBatchDemo = prod.id === 'prod-9120117912933' || prod.id === 'prod-9120117914470';

      if (hasShortBatchDemo && prod.wfirmaStockPartner > 0) {
        const stdPickQty = Math.min(80, prod.wfirmaStockRegular);
        const partnerPickQty = Math.min(60, prod.wfirmaStockPartner);
        const remainingQty = totalWfirma - stdPickQty - partnerPickQty;

        pickSlot.allocations.push({
          id: `batch-pick-std-${prod.id}`,
          productId: prod.id,
          quantity: stdPickQty,
          lotNumber: `LOT-25A${100 + i}`,
          expiryDate: '2027-05-31',
          dedicatedForPartnerOnly: false,
          palletLabel: 'Karton Kompletacyjny (Krótka data <12m)',
          notes: 'Partia poniżej 12 msc — tylko dla zamówień standardowych/sklepu. Partnerzy pobierają z Regału 3 (PARTNER)!',
          updatedAt: nowIso,
        });

        const partSlot = pickingPartnerSlots[partnerPickIdx % pickingPartnerSlots.length];
        partnerPickIdx++;
        partSlot.allocations.push({
          id: `batch-pick-part-${prod.id}`,
          productId: prod.id,
          quantity: partnerPickQty,
          lotNumber: `LOT-26P${200 + i}`,
          expiryDate: '2028-04-30',
          dedicatedForPartnerOnly: true,
          palletLabel: 'Regał 3 — Gniazdo PARTNER (>12 msc)',
          notes: 'Wydzielona partia dla Partnerów (powyżej 12 miesięcy ważności)',
          updatedAt: nowIso,
        });

        if (remainingQty > 0) {
          const pSlot = palletSlots[palletIdx % palletSlots.length];
          palletIdx++;
          pSlot.allocations.push({
            id: `batch-pal-${prod.id}-1`,
            productId: prod.id,
            quantity: remainingQty,
            lotNumber: `LOT-26P${200 + i}`,
            expiryDate: '2028-04-30',
            palletLabel: `Paleta #${palletIdx} (Zapas składowania)`,
            updatedAt: nowIso,
          });
        }
      } else {
        const pickQty = Math.min(120, totalWfirma);
        const remainingQty = totalWfirma - pickQty;

        pickSlot.allocations.push({
          id: `batch-pick-${prod.id}`,
          productId: prod.id,
          quantity: pickQty,
          lotNumber: `LOT-26B${300 + i}`,
          expiryDate: '2028-06-30',
          dedicatedForPartnerOnly: false,
          palletLabel: 'Magazyn 4 Kompletacja (Wspólna >12 msc)',
          updatedAt: nowIso,
        });

        if (remainingQty > 0) {
          if (remainingQty > 2500) {
            const half1 = Math.floor(remainingQty / 2);
            const half2 = remainingQty - half1;

            const pSlot1 = palletSlots[palletIdx % palletSlots.length];
            palletIdx++;
            pSlot1.allocations.push({
              id: `batch-pal-${prod.id}-1`,
              productId: prod.id,
              quantity: half1,
              lotNumber: `LOT-25F${400 + i}`,
              expiryDate: '2027-12-31',
              palletLabel: `Paleta #${palletIdx} (FEFO #1)`,
              updatedAt: nowIso,
            });

            const pSlot2 = palletSlots[palletIdx % palletSlots.length];
            palletIdx++;
            pSlot2.allocations.push({
              id: `batch-pal-${prod.id}-2`,
              productId: prod.id,
              quantity: half2,
              lotNumber: `LOT-26N${500 + i}`,
              expiryDate: '2028-09-30',
              palletLabel: `Paleta #${palletIdx} (FEFO #2 — nowsza dostawa)`,
              updatedAt: nowIso,
            });
          } else {
            const pSlot = palletSlots[palletIdx % palletSlots.length];
            palletIdx++;
            pSlot.allocations.push({
              id: `batch-pal-${prod.id}-1`,
              productId: prod.id,
              quantity: remainingQty,
              lotNumber: `LOT-26B${300 + i}`,
              expiryDate: '2028-06-30',
              palletLabel: `Paleta #${palletIdx}`,
              updatedAt: nowIso,
            });
          }
        }
      }
    } else if (prod.category === 'sample') {
      const sSlot = sampleSlots[sampleIdx % sampleSlots.length];
      sampleIdx++;
      sSlot.allocations.push({
        id: `batch-sample-${prod.id}`,
        productId: prod.id,
        quantity: totalWfirma,
        lotNumber: `PROB-2026-${i}`,
        expiryDate: '2028-03-31',
        palletLabel: 'Karton próbek z ulotką',
        updatedAt: nowIso,
      });
    } else {
      const kSlot = kitBagSlots[kitIdx % kitBagSlots.length];
      kitIdx++;
      let expDate = '2028-12-31';
      if (/10[\/\s]2026|10\/26/.test(prod.name)) expDate = '2026-10-31';
      else if (/11[\/\s]2026|11\/26/.test(prod.name)) expDate = '2026-11-30';
      else if (/12[\/\s]2026/.test(prod.name)) expDate = '2026-12-31';

      kSlot.allocations.push({
        id: `batch-kit-${prod.id}`,
        productId: prod.id,
        quantity: totalWfirma,
        lotNumber: `SERIA-${2026}-${i}`,
        expiryDate: expDate,
        palletLabel: prod.category === 'promo_kit' ? 'Strefa Zestawów / Promocji' : 'Regał Materiałów',
        updatedAt: nowIso,
      });
    }
  }

  // Przykładowe pozycje na miejscach paletowych na podłodze (w tym opis ręczny)
  const m4FloorSlots = slots.filter((s) => s.rackId === 'rack-m4-floor');
  if (m4FloorSlots.length >= 1) {
    m4FloorSlots[0].customDescription = 'Paleta z kartonami zbiorczymi i wypełniaczem przy strefie pakowania';
    m4FloorSlots[0].allocations.push({
      id: 'batch-custom-m4-floor-1',
      productId: 'CUSTOM',
      isCustomItem: true,
      customName: 'Kartony wysyłkowe B2C + rolki folii bąbelkowej i taśmy',
      customUnit: 'paleta',
      quantity: 1,
      lotNumber: '-',
      expiryDate: '',
      palletLabel: 'Paleta podłogowa #1 (Pakowanie)',
      notes: 'Podręczna paleta na podłodze przy strefie kompletacji',
      updatedAt: nowIso,
    });
  }

  const m6FloorSlots = slots.filter((s) => s.rackId === 'rack-m6-floor');
  if (m6FloorSlots.length >= 2) {
    const customSlot1 = m6FloorSlots[0];
    customSlot1.customDescription = 'Materiały do pakowania przesyłek kurierskich i paletowych';
    customSlot1.allocations.push({
      id: 'batch-custom-packaging-1',
      productId: 'CUSTOM',
      isCustomItem: true,
      customName: 'Kartony wysyłkowe zbiorcze + taśmy pakowe Eubiosis + wypełniacz',
      customUnit: 'paleta',
      quantity: 2,
      lotNumber: '-',
      expiryDate: '',
      palletLabel: 'Paleta na podłodze — Opakowania',
      notes: 'Zapas kartonów do wysyłek B2C oraz aptecznych',
      updatedAt: nowIso,
    });

    const customSlot2 = m6FloorSlots[1];
    customSlot2.customDescription = 'Wyposażenie targowe i konferencyjne na podłodze';
    customSlot2.allocations.push({
      id: 'batch-custom-conference-stand',
      productId: 'CUSTOM',
      isCustomItem: true,
      customName: 'Stoisko targowe: Roll-upy OMNi-BiOTiC (4 szt.), lada konferencyjna, obrusy i ekspozytory',
      customUnit: 'kpl.',
      quantity: 1,
      lotNumber: '-',
      expiryDate: '',
      palletLabel: 'Paleta na podłodze — Konferencje',
      notes: 'Zwrócone po ostatniej konferencji — gotowe do kolejnego wyjazdu',
      updatedAt: nowIso,
    });
  }

  return slots;
}

/**
 * 4 autentyczne dokumenty z przesłanego przez użytkownika pliku PDF z wFirma (w statusie wersji roboczej "draft",
 * gotowe do przetestowania zatwierdzenia 1 kliknięciem!)
 */
export const DEFAULT_SAMPLE_DOCUMENTS: WarehouseDocument[] = [
  {
    id: 'doc-pz-18-10-2026',
    docType: 'PZ',
    docNumber: 'PZ 18/10/2026',
    issueDate: '2026-10-09',
    warehouseName: 'Główny Magazyn',
    counterparty: 'JOLANTA STASZCZAK APTEKI FANTAZJA (NIP: 6790025172)',
    notes: 'Dostawa zewnętrzna z wFirma.pl — do alokacji na wybrane miejsce paletowe lub Strefę Kompletacji PARTNER (>12 msc).',
    status: 'draft',
    createdAt: '2026-10-11T08:00:00.000Z',
    items: [
      {
        id: 'item-pz-1',
        lp: 1,
        rawSku: 'EAN9120117914470',
        rawName: 'OMNI-BIOTIC® Travel - 14 sasz.*5g PL PARTNER',
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
    id: 'doc-wz-906-10-2026',
    docType: 'WZ',
    docNumber: 'WZ 906/10/2026',
    issueDate: '2026-10-09',
    warehouseName: 'Główny Magazyn',
    counterparty: 'weronika kalwat (al. ks. Jerzego Popiełuszki 40, 25-394 Kielce)',
    notes: 'Wydanie zewnętrzne B2C — ściąga ilości ze Strefy Kompletacji.',
    status: 'draft',
    createdAt: '2026-10-11T08:00:00.000Z',
    items: [
      {
        id: 'item-wz-1',
        lp: 1,
        rawSku: '9120117912934',
        rawName: 'MikroSan promocja 11 2026',
        matchedProductId: 'prod-9120117912934',
        isPartnerChannel: false,
        quantity: 3,
        unit: 'szt.',
        unitPrice: 139.30,
        totalValue: 417.90,
        allocatedMovements: [],
      },
      {
        id: 'item-wz-2',
        lp: 2,
        rawSku: '7412589633700',
        rawName: 'SKLEP B2C - PRÓBKA Z ULOTKĄ - OMNi BiOTiC® STRESS REPAIR 9',
        matchedProductId: 'prod-sample-stress',
        isPartnerChannel: false,
        quantity: 1,
        unit: 'szt.',
        unitPrice: 0.01,
        totalValue: 0.01,
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
    notes: 'Częściowy zwrot zamówienia. Protokół anulacji e-paragonu nr 20/10/2026. (Dodaje na Strefę Kompletacji).',
    status: 'draft',
    createdAt: '2026-10-11T08:00:00.000Z',
    items: [
      {
        id: 'item-pw-1',
        lp: 1,
        rawSku: '9120117912674',
        rawName: 'OMNi-BiOTiC® AAD10 - 30sasz.*5g PL',
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
  {
    id: 'doc-rw-14-10-2026',
    docType: 'RW',
    docNumber: 'RW 14/10/2026',
    issueDate: '2026-10-08',
    warehouseName: 'Główny Magazyn',
    counterparty: 'Eubiosis sp. z o.o.',
    notes: 'Przesunięcie wewnątrzmagazynowe + PW 20/10/2026 (Ściąga ze Strefy Kompletacji / Próbek).',
    status: 'draft',
    createdAt: '2026-10-11T08:00:00.000Z',
    items: [
      {
        id: 'item-rw-1',
        lp: 1,
        rawSku: 'PROBKA-PRO-VI',
        rawName: 'PRÓBKA Z ULOTKĄ PRO-VI',
        matchedProductId: 'prod-sample-provi',
        isPartnerChannel: false,
        quantity: 280,
        unit: 'szt.',
        unitPrice: 2.15,
        totalValue: 602.00,
        allocatedMovements: [],
      },
      {
        id: 'item-rw-2',
        lp: 2,
        rawSku: '7412589633703',
        rawName: 'SKLEP B2C - PRÓBKA Z ULOTKĄ - OMNi BiOTiC® STRESS REPAIR KIDS',
        matchedProductId: 'prod-sample-stress-kids',
        isPartnerChannel: false,
        quantity: 38,
        unit: 'szt.',
        unitPrice: 2.11,
        totalValue: 80.20,
        allocatedMovements: [],
      },
    ],
  },
];

export const DEFAULT_SUSPENDED_RECORDS: SuspendedItemRecord[] = [];

export const DEFAULT_MOVEMENTS_HISTORY: StockMovementHistoryEntry[] = [
  {
    id: 'mov-init-1',
    timestamp: '2026-10-11T08:00:00.000Z',
    type: 'INVENTORY_ADJUST',
    productId: 'ALL',
    productName: 'Bilans otwarcia na podstawie Zestawienia Stanów wFirma z dn. 11-10-2026',
    quantity: 0,
    lotNumber: '-',
    expiryDate: '-',
    toSlotCode: 'WSZYSTKIE MAGAZYNY',
    referenceDoc: 'STANY MAGAZYNOWE 11-10-2026',
    performedBy: 'System WMS Eubiosis',
    notes: 'Automatyczne rozmieszczenie 49 pozycji katalogowych (240 wierszy FIFO wFirma) na Strefę Kompletacji oraz Regały Paletowe.',
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
      warehouseName: 'Główny Magazyn',
      totalRowsParsed: 240,
      totalValueNet: 9681955.72,
      importedAt: '2026-10-11T08:00:00.000Z',
      rows: [],
    },
  };
}
