export type WorkstationRole = 'coordinator' | 'warehouse';

export type NavigationTab =
  | 'magazyn_4'         // 1a. Magazyn 4 — Kompletacja (Wizualizacja Przestrzenna 3D + Regały)
  | 'magazyn_5'         // 1b. Magazyn 5 — Składowanie (Wizualizacja Przestrzenna 3D + Regały Paletowe)
  | 'magazyn_6'         // 1c. Magazyn 6 — Składowanie (Wizualizacja Przestrzenna 3D + Regały Paletowe)
  | 'documents'         // 2. Dokumenty WZ / RW / PZ / PW (PDF z wFirma + Ręczne + Alokacja Palet)
  | 'transfers_fefo'    // 3. Przesunięcia Magazynowe i Uzupełnianie Strefy Kompletacji (FEFO / >12 msc Partner)
  | 'suspended'         // 4. Wydane bez dokumentu — W Zawieszeniu (Konferencje, Targi, Przedstawiciele)
  | 'inventory_wfirma'  // 5. Inwentaryzacja i Porównanie z wFirma (Zestawienie Stanów)
  | 'summary_catalog';  // 6. Podsumowanie Wszystkich Ilości i Katalog Produktów / Zestawów

export type ProductCategory =
  | 'probiotic'
  | 'prebiotic'
  | 'mikrosan'
  | 'promo_kit'
  | 'sample'
  | 'accessory';

export type KitHandlingMode = 'separate_slot' | 'virtual_bundle';

export interface KitComponent {
  productId: string;
  quantityPerKit: number;
}

export interface ProductCatalogItem {
  id: string;
  baseEan: string;            // Wspólny kod EAN fizycznego produktu (np. 9120117912766)
  skuRegular: string;         // Indeks standardowy w wFirma (np. 9120117912766 lub EANPL9120117912902)
  skuPartner?: string;        // Indeks partnerski w wFirma (np. EAN9120117912766 ... PARTNER)
  name: string;               // Pełna nazwa z wFirma
  shortName: string;          // Krótka czytelna nazwa na kafelkach regałów
  category: ProductCategory;
  unit: string;
  avgPurchasePriceNet: number;
  minPickingStock: number;    // Minimalny zalecany stan na Strefie Kompletacji
  kitHandlingMode: KitHandlingMode; // Wybór dla zestawów/promocji: osobne miejsce na półce vs rozbijanie na składowe
  kitComponents?: KitComponent[];
  wfirmaStockRegular: number; // Suma z wFirma dla indeksu PL (zwykłego)
  wfirmaStockPartner: number; // Suma z wFirma dla indeksu PL PARTNER
  wfirmaLastUpdated?: string;
  defaultUnitsPerCarton?: number; // Domyślna ilość sztuk w kartonie zbiorczym z Cennika
  cartonDimensions?: string;      // Wymiary kartonu zbiorczego (np. 40x40x30)
  cartonsPerPallet?: number;      // Ilość kartonów na pełnej palecie
}

export interface StockAllocationBatch {
  id: string;
  productId: string;                  // ID produktu z katalogu lub 'CUSTOM' dla ręcznego opisu
  isCustomItem?: boolean;             // Czy to pozycja opisana ręcznie (spoza katalogu produktów wFirma)
  customName?: string;                // Ręczny opis pozycji (np. "Kartony wysyłkowe", "Roll-up konferencyjny")
  customUnit?: string;                // Jednostka dla pozycji ręcznej (np. "szt.", "paleta", "karton", "kpl.")
  quantity: number;                   // Łączna ilość (wyliczana z kartonów lub wpisana ręcznie)
  fullCartonsCount?: number;          // Ilość pełnych kartonów (np. 8)
  unitsPerCarton?: number;            // Ilość sztuk w każdym pełnym kartonie (np. 24)
  looseUnitsInOpenCarton?: number;    // Ilość sztuk w kartonie otwartym / luzem (np. 5)
  lotNumber: string;                  // Numer serii LOT (np. 25E3475 lub '-' dla innych rzeczy)
  expiryDate: string;                 // Data ważności MHD w formacie YYYY-MM-DD (lub '' dla innych rzeczy)
  dedicatedForPartnerOnly?: boolean;  // Etykieta PARTNER (różowy kolor, tylko dla dat >= 12 msc)
  firstToExit?: boolean;              // Etykieta "Pierwsza do wyjścia" (żółty kolor)
  isKitLabel?: boolean;               // Etykieta "ZESTAW" (bez zmiany koloru tła — specjalna obramówka + znacznik 🎁 ZESTAW)
  isPromoLabel?: boolean;             // Etykieta "PROMOCJA" (bez zmiany koloru tła — specjalna obramówka + znacznik 🏷️ PROMOCJA)
  palletLabel?: string;               // Oznaczenie palety (np. Paleta #1, Dostawa PZ)
  notes?: string;
  updatedAt: string;
}

export type SlotType =
  | 'picking_standard'     // Strefa Kompletacji — gniazdo główne (wspólne gdy MHD > 12 msc)
  | 'picking_partner_12m'  // Strefa Kompletacji — wydzielone miejsce PARTNER (> 12 msc), gdy zwykłe ma < 12 msc
  | 'pallet_storage'       // Miejsce Paletowe na regale (zapas magazynowy / dostawy PZ)
  | 'floor_pallet'         // Miejsce Paletowe bezpośrednio na podłodze hali (Posadzka P0)
  | 'shelf_storage'        // Regał półkowy (próbki, akcesoria, materiały)
  | 'quarantine_promo';    // Strefa krótkich dat / zestawów promocyjnych

export interface WarehouseLocationSlot {
  id: string;
  warehouseId: string;
  rackId: string;
  code: string;               // Np. M4-KOMP-P0-01, M5-PAL-A-P0-01, M5-PODLOGA-P0-01
  name: string;               // Opis gniazda / miejsca paletowego
  customDescription?: string; // Dodatkowy ręczny opis miejsca (np. co tu przechowujemy na stałe)
  isKitLabel?: boolean;       // Etykieta ZESTAW przypisana do miejsca/palety
  isPromoLabel?: boolean;     // Etykieta PROMOCJA przypisana do miejsca/palety
  level: number;              // Poziom regału (0 = posadzka/dół, 1 = poziom 1, 2 = poziom 2...)
  position: number;           // Kolumna / miejsce w rzędzie (1, 2, 3...)
  slotType: SlotType;
  maxCapacityUnits: number;
  allocations: StockAllocationBatch[];
}

export type ZoneType = 'picking' | 'pallet' | 'floor_pallet' | 'samples_kits';

export type HallPlacement = 'top_wall' | 'bottom_wall' | 'floor_zone';

export interface WarehouseRack {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  zoneType: ZoneType;
  hallPlacement?: HallPlacement; // Położenie w prostokątnej hali: góra (lewy bok od bramy), dół (prawy bok od bramy) lub podłoga
  levelsCount: number;
  slotsPerLevel: number;
  colorTheme: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose';
}

export interface SpatialWarehouse {
  id: string;
  code: string;
  name: string;
  description: string;
  hasPickingZone: boolean;
}

export type WarehouseDocType = 'WZ' | 'RW' | 'PZ' | 'PW';

export interface PutAwayRecommendationOption {
  slotId: string;
  slotCode: string;
  slotName: string;
  warehouseId: string;
  warehouseName: string;
  rackName: string;
  level: number;
  position: number;
  isEmpty: boolean;
  score: number;
  badge: string;
  reason: string;
}

export interface AllocatedMovementRecord {
  slotId: string;
  slotCode: string;
  batchId?: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  palletLabel?: string;
  cartonsCount?: number;
  unitsPerCarton?: number;
  openCartonQty?: number;
  dedicatedForPartnerOnly?: boolean;
  firstToExit?: boolean;
  recommendationReason?: string;
  recommendationBadge?: string;
}

export interface WarehouseDocumentItem {
  id: string;
  lp: number;
  rawSku: string;
  rawName: string;
  matchedProductId: string | null;
  isPartnerChannel: boolean;  // Wykryty dopisek PARTNER lub prefiks EAN -> wymóg MHD > 12 msc!
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  allocatedMovements: AllocatedMovementRecord[];
}

export interface WarehouseDocument {
  id: string;
  docType: WarehouseDocType;
  docNumber: string;
  issueDate: string;
  warehouseName: string;
  counterparty: string;
  notes: string;
  status: 'draft' | 'applied';
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
  items: WarehouseDocumentItem[];
}

export type SuspendedReasonCategory =
  | 'konferencja'
  | 'zamowienie_pracownicze'
  | 'niewystawione_rw'
  | 'zwrot_bez_pw'
  | 'wymiana_b2b'
  | 'ponowna_wysylka'
  | 'inne';

export interface SuspendedSubItem {
  id: string;
  productId: string;
  productName: string;
  quantityIssued: number;
  quantityReturned: number;
  quantitySettled: number;
  lotNumber: string;
  expiryDate: string;
  sourceSlotId: string;
  sourceSlotCode: string;
  reason?: string;            // Np. "Konferencja", "Zamówienie pracownicze bez dokumentu sprzedaży", "Niewystawione RW", "Zwrot bez PW", "Wymiana B2B w toku", "Ponowna wysyłka przed dostawą zwrotu"
  category?: SuspendedReasonCategory;
}

export interface SuspendedItemRecord {
  id: string;
  eventName: string;          // Np. Konferencja / Zamówienie pracownicze / Niewystawione RW / Zwrot bez PW
  takenBy: string;            // Kto pobrał lub opis kontrahenta/pracownika
  issuedAt: string;           // Data wydania / wpisu
  expectedReturnDate?: string;
  status: 'suspended' | 'returned' | 'settled_by_doc';
  settledDocNumber?: string;
  notes: string;
  category?: SuspendedReasonCategory;
  items: SuspendedSubItem[];
}

export interface StockMovementHistoryEntry {
  id: string;
  timestamp: string;
  type:
    | 'MOVE'
    | 'WZ'
    | 'RW'
    | 'PZ'
    | 'PW'
    | 'SUSPEND_OUT'
    | 'SUSPEND_RETURN'
    | 'SUSPEND_SETTLE'
    | 'INVENTORY_ADJUST'
    | 'MANUAL_ALLOC';
  productId: string;
  productName: string;
  quantity: number;
  lotNumber: string;
  expiryDate: string;
  fromSlotCode?: string;
  toSlotCode?: string;
  referenceDoc?: string;
  performedBy: string;
  notes?: string;
}

export interface WFirmaInventoryRow {
  lp: number;
  ktm: string;
  name: string;
  unit: string;
  quantity: number;
  purchasePrice: number;
  totalValue: number;
  isPartner: boolean;
  baseEan: string;
}

export interface WFirmaInventorySnapshot {
  snapshotDate: string;
  warehouseName: string;
  totalRowsParsed: number;
  totalValueNet: number;
  importedAt: string;
  rows: WFirmaInventoryRow[];
}

export interface WMSFullState {
  revision: number;
  updatedAt: string;
  warehouses: SpatialWarehouse[];
  racks: WarehouseRack[];
  slots: WarehouseLocationSlot[];
  products: ProductCatalogItem[];
  documents: WarehouseDocument[];
  suspendedRecords: SuspendedItemRecord[];
  movementsHistory: StockMovementHistoryEntry[];
  wfirmaSnapshot: WFirmaInventorySnapshot | null;
}
