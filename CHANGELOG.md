# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.3] - 2026-02-14

### Added
- **Refetch from OFF button** on product detail modal
  - Fetches fresh data from Open Food Facts for products with linked barcodes
  - Shows comparison panel with checkboxes: update image, brand, nutrition
  - Server-side image download and upload via `product-actions.ts`

### Fixed
- **Product image from OFF now reliably persists after save** — moved image download server-side to avoid CORS issues; broadened URL detection to catch all external image sources
- **Nutrition data feedback** — `parseNutriments()` now returns null when OFF provides an empty nutriments object; toast shown when no nutrition data is available
- **Below-min-stock filter** — products with zero stock entries now correctly appear in the "below min stock" view (fixed early-return empty state check in both desktop and mobile tables)

---

## [0.9.X] - 2026-02-14

### Added
- **Enhanced OFF integration** (v0.9.0)
  - Added `images.openfoodfacts.org` to Next.js `remotePatterns` (fixes broken OFF product images)
  - OFF images now downloaded to Supabase storage on product save for persistent display
  - `downloadOffImage()` helper in `openfoodfacts.ts` — fetches OFF image as File for upload
  - Added `?fields=` parameter to OFF API requests for efficient data fetching
  - Expanded `OFFProduct` type with: `nutriments`, `nutritionGrade`, `categories`, `ingredientsText`, `stores`
  - New `OFFNutriments` type with 9 per-100g nutrition fields
  - `parseNutriments()` helper maps OFF hyphenated keys (`energy-kcal_100g`) to camelCase
  - Updated OFF tests: new field assertions, `?fields=` URL verification, missing/partial nutriments handling (8 tests)
- **Brand & store-brand detection** (v0.9.1)
  - `brand` (TEXT) and `is_store_brand` (BOOLEAN) columns added to products table (migration 010)
  - `store-brand-map.ts`: ordered tuple array of 15+ UK supermarket brand prefixes with `detectStoreBrand()` function
  - Longest-prefix-first matching (e.g., "Tesco Finest" matches before "Tesco")
  - Covers: Aldi, Lidl, Tesco, Sainsbury's, Asda, Morrisons, M&S, Waitrose, Co-op, Iceland, Spar
  - Brand auto-filled from OFF `brands` field during barcode scan
  - Store-brand detection triggers toast suggesting matching shopping location
  - Brand input field and "Store brand" checkbox on product form (Basic tab)
  - Unit tests for store-brand detection (15 tests)
- **Nutrition facts** (v0.9.2)
  - `product_nutrition` table with EU Big 8 per-100g values, Nutri-Score grade, and data source tracking (migration 011)
  - Full RLS policies (dual-mode: auth + guest) matching existing table patterns
  - `ProductNutrition` and `NutritionDataSource` TypeScript types in `database.ts`
  - `mapOFFNutrimentsToNutrition()` maps OFF API data to database schema
  - `NutritionLabel` component — EU-style nutrition facts table (Energy kJ/kcal, Fat, Saturates, Carbohydrate, Sugars, Fibre, Protein, Salt)
  - `NutriScoreBadge` component — color-coded A–E grade pill (official Nutri-Score colors)
  - Nutrition auto-populated from OFF on product creation (inserted into `product_nutrition` table)
  - Nutrition display on `ProductDetailModal` (label + Nutri-Score badge in header)
  - New "Nutrition" tab on `ProductForm` with 9 per-100g number inputs in 2-column grid
  - Manual nutrition entry/edit with upsert logic (supports both OFF-sourced and manual data)
  - Existing nutrition data loaded on product edit
  - Unit tests for OFF→nutrition mapping (4 tests)

### Changed
- `ProductForm` — 6 tabs (Basic, Stock Defaults, Locations, QU Conversions, Barcodes, Nutrition) instead of 5
- `ProductForm` — standalone `calories` field removed in favour of full nutrition tab
- `ProductDetailModal` — fetches and displays `product_nutrition` row alongside stock entries
- `openfoodfacts.ts` — API URL now includes `?fields=` for selective field fetching
- `database.ts` — version comment updated to v0.9.2
- `package.json` — version bumped to 0.9.2

### Database Migrations
- `010_brand_fields.sql` — `ALTER TABLE products ADD COLUMN brand TEXT; ADD COLUMN is_store_brand BOOLEAN NOT NULL DEFAULT FALSE`
- `011_product_nutrition.sql` — `CREATE TABLE product_nutrition` with EU Big 8 columns, Nutri-Score, data_source, UNIQUE(product_id), indexes, full RLS

## [0.8.X] - 2026-02-12

### Added
- **Barcode scanner & CRUD** (v0.8.0)
  - `BarcodeScanner` reusable component with live camera feed (`react-zxing`)
  - Supports 1D (EAN-8, EAN-13, UPC-A, Code128) and 2D (QR, DataMatrix)
  - Inline rendering (aspect-4/3, not full-page takeover)
  - Targeting reticle overlay, 2s debounce, rear camera preferred
  - Graceful error states: camera denied, no camera found, camera in use
  - `BarcodesSection` replaces placeholder on `/products/[id]/conversions`
  - Add barcodes via camera scan or manual text entry
  - Edit and delete existing barcodes with inline form
  - Per-barcode metadata: quantity unit, amount, store, last price, note
  - `barcode-actions.ts`: `addBarcode()`, `updateBarcode()`, `deleteBarcode()`, `lookupBarcodeLocal()`
  - All functions use `getHouseholdId()` for dual auth/guest mode
  - Compound database index `(household_id, barcode)` for fast scan resolution (migration 009)
  - Unit tests for barcode actions (8 tests)
- **Open Food Facts integration & product form scan** (v0.8.1)
  - `lookupBarcodeOFF()` client for Open Food Facts API (`world.openfoodfacts.org/api/v2`)
  - 5-second timeout, graceful null on any error, never blocks UI
  - Extracts: product name, image URL, brands, quantity
  - `ScannerDialog` reusable dialog wrapping `BarcodeScanner` with manual text entry fallback
  - Barcode scan button (ScanBarcode icon) on product form next to name field
  - Scan flow: check local DB first, then OFF lookup, pre-fill name + image
  - `/products/new?barcode=XXX` route pre-fills from OFF on mount
  - Auto-saves barcode to `product_barcodes` after product creation
  - Unit tests for OFF client (6 tests: found, fallback name, not found, 404, network error, timeout)
- **Scan-to-add-stock workflow** (v0.8.2)
  - `ScanToStockFlow` orchestration component on stock overview page
  - Scan button (amber) in action bar alongside Add Stock and Add Product
  - Known barcode: opens AddStockEntryModal pre-filled with product, amount, unit, store, price from barcode metadata
  - Unknown barcode: OFF lookup then redirect to `/products/new?barcode=XXX`
  - `AddStockEntryModal` Prefill type extended with `shoppingLocationId` and `price`
- **Shopping list scan workflow** (v0.8.3)
  - `ScanToShoppingFlow` orchestration component with floating scan button (FAB)
  - Continuous scanning mode: scanner stays open between scans, "Done" button to close
  - Scan product on list: auto-purchase and add to stock
  - Scan product not on list: add to list then purchase
  - Scan unknown barcode: OFF lookup then redirect to product creation
  - `ScannerDialog` extended with `continuous` prop for rapid scanning
- **Input productivity & polish** (v0.8.4)
  - `parseDateShorthand()`: `+7`/`+7d` (days), `+1m` (months), `+1y` (years), `0517` (MMDD), `x`/`never` (never expires)
  - Quick-entry text input below due date field in AddStockEntryModal (expands on Enter/blur)
  - `useRecentProducts` hook: tracks recently used product IDs in localStorage
  - Recent products shown at top of product selector in AddStockEntryModal
  - Recent products shown in shopping list add-item dialog (when search is empty)
  - Haptic feedback (`navigator.vibrate(100)`) on successful barcode scan
  - Unit tests for date shorthands (27 tests)

### Changed
- **README roadmap restructured:**
  - v0.9: Enhanced OFF & Product Data (NEW — brand, nutrition, store-brand detection)
  - v1.0: AI Smart Input (was v0.9 — added receipt scanning)
  - v1.1: Recipes (was v1.0)
  - v1.2: Meal Planning (was v1.1)
  - v1.3: Product Analytics (was v1.2)
  - v1.4: Grocycode & Label Printing (was v1.3)
  - v1.5: PWA & Polish (was v1.4)
  - v2.0: AI Platform added to Future Ideas
- `ProductConversionsClient` — accepts `barcodes` and `shoppingLocations` props
- Conversions page — fetches product barcodes and shopping locations
- `ProductForm` — accepts `initialBarcode` prop, includes barcode scan button and OFF lookup
- `/products/new` page — accepts `?barcode=` search param
- Stock overview page — 3-column action button grid (Add Stock, Scan, Add Product)
- Shopping list detail page — floating barcode scan button for scan-to-purchase
- `AddStockEntryModal` — date shorthand input, recent products in selector
- `BarcodeScanner` — haptic feedback on successful scan
- Shopping list add-item dialog — recent products shown when search is empty

### Fixed
- **Shopping list: purchased items now stay visible** (v0.8.5)
  - Checking off a product item marks it as done (crossed out) instead of deleting it
  - Item remains in the "Done" section so users can see what was already bought
  - Use "Clear done" button to remove purchased items when no longer needed
  - Unchecking a purchased item moves it back to the active list (stock entry is kept)
  - Progress bar, duplicate detection, and barcode scan purchase all work correctly
- **Shopping list: unit is now choosable when adding product items** (v0.8.5)
  - Product items now show a unit dropdown instead of a static label
  - Defaults to the product's purchase unit, but can be changed to any available unit

### Dependencies
- Added `react-zxing` ^2.1.0

## [0.7.X] - 2026-02-11

### Added
- **Shopping lists** (v0.7.1)
  - New `/shopping-lists` page with list CRUD (create, edit, delete)
  - List detail page with full item management
  - Product-linked items: search products, inherit name/unit, show current stock
  - Freeform items: custom note + amount with optional unit
  - Checkbox to mark items done, with progress bar (% complete)
  - Drag-and-drop reordering via @dnd-kit
  - Group by product group (aisle optimization) or store
  - Grouping preference persisted to localStorage
  - Amount adjustment (increment/decrement buttons)
  - Clear all done items button
  - "Shopping Lists" link added to UserMenu (ShoppingCart icon)
  - `shopping_lists` and `shopping_list_items` database tables (migration 008)
  - Full RLS policies for authenticated + guest mode
  - **Purchase workflow**: checking off a product item auto-creates a stock entry
    - Converts item unit to stock unit via `quantity_unit_conversions`
    - Applies product defaults (location, due days, store)
    - Removes item from list after stock entry created
  - **Deduplication**: adding an existing product increments amount instead of duplicating
  - **Auto-generation buttons**:
    - "Below min stock" — adds products where current stock < min_stock_amount
    - "Expired" — adds products with expired stock entries (due_type=2)
    - "Overdue" — adds products with overdue stock entries (due_type=1)
    - Calculates missing amount: `min_stock - current_stock`
  - **Auto-add to shopping list** on consume below min stock
    - `checkAutoAddToShoppingList()` in `stock-actions.ts` (fire-and-forget)
    - `is_auto_target` flag on shopping lists to designate auto-add target
  - `getHouseholdId()` helper (`src/lib/supabase/get-household.ts`)
    - Resolves household ID for both authenticated and guest users
    - Shared by shopping list actions and stock actions
  - Unit tests for shopping list actions (14 tests)
    - addItemToList: auth, dedup, freeform, sort order, guest mode
    - removeItemFromList, toggleItemDone, updateItemAmount, clearDoneItems, reorderItems
  - Unit tests for shopping list utils (18 tests)
    - findExistingItem, computeBelowMinStock, computeExpiredProducts, computeOverdueProducts

### Changed
- `stock-actions.ts` — `consumeStock()` now calls `checkAutoAddToShoppingList()` after consumption
- `UserMenu` — added "Shopping Lists" navigation link
- Extracted `getHouseholdId()` into shared module (was inline in stock-actions)

## [0.6.X] - 2026-02-10

### Added
- **Journal pagination & summary** (v0.6.8)
  - Client-side pagination for journal entries
    - Page size selector (10 / 25 / 50), default 25
    - Previous / Next navigation with "Page X of Y" display
    - Total entry count shown alongside controls
    - Page resets to 1 when filters or page size change
  - Journal summary tab (Grocy-style aggregated view)
    - Toggle between "Journal" and "Summary" tabs (Radix Tabs)
    - Groups transactions by product + type, sums amounts, counts transactions
    - Undone entries excluded from summary totals
    - Respects all active filters (product, type, date range, search)
    - Responsive: desktop table + mobile cards
  - Extracted shared constants (`TYPE_LABELS`, `TYPE_COLORS`, `formatTimestamp`, `formatAmount`) to `journal-constants.ts` to eliminate duplication between desktop/mobile components
- **Stock Journal UI** (v0.6.7)
  - New `/journal` page showing all stock transactions in reverse chronological order
  - Desktop table + mobile card layout (responsive `sm:` breakpoint)
  - Filters: product search, product select, transaction type select, date range (from/to)
  - Mobile collapsible filter panel with active filter badge count
  - Undo button per row — dispatches to correct undo function via `undoTransaction()`
  - Undone rows shown with muted opacity + strikethrough + "Undone" badge
  - Type badges: Consumed, Spoiled, Opened, Transferred, Corrected, Purchased
  - Relative timestamps (Just now, Xm ago, Xh ago, Xd ago, then date)
  - `transfer-to`, `stock-edit-old`, `stock-edit-new` rows filtered from display
  - "Journal" link added to user menu dropdown (BookOpen icon)
  - Works for both authenticated and guest mode (same Supabase RLS)
- **Inventory correction action** (v0.6.6)
  - Grocy-style correction: user enters new total amount, system computes delta
  - `correctInventory()` in `stock-actions.ts`
    - Decrease path: removes stock via FIFO (`computeConsumePlan`)
    - Increase path: adds delta to the most recent stock entry
    - Logs to `stock_log` with `transaction_type = 'inventory-correction'`
  - `undoCorrectInventory(correlationId)` — restores previous amounts
  - `CorrectionModal` with location filter and current stock display
  - "Correct..." in three-dots menus (desktop + mobile)
  - Undo toast with sonner
  - Supports both authenticated and guest mode
- **Transfer stock action** (v0.6.5)
  - Move stock entries between locations via `TransferModal`
    - Entry-level transfer button in `ProductDetailModal`
    - Product-level "Transfer..." in three-dots menus (desktop + mobile)
    - Entry selector when product has multiple stock entries
  - `transferStock()` in `stock-actions.ts`
    - Updates `location_id` on the stock entry
    - Dual logging: `transfer-from` (original values for undo) + `transfer-to` (new values for audit)
    - Both rows share a `correlation_id`
  - `undoTransfer(correlationId)` — restores original location and due date
  - **Freezer detection** (non-freezer → freezer):
    - When `default_due_days_after_freezing` is configured: radio choice to keep current due date or use freezer shelf life
    - When not configured: warning + manual date input
  - **Thaw detection** (freezer → non-freezer):
    - When `default_due_days_after_thawing` is configured: auto-replaces due date (fresh shelf-life window)
    - When not configured: warning + manual date input
  - **Should-not-be-frozen guard**: blocks transfer to freezer locations (disables button, red error)
  - Undo toast with sonner for all transfers
  - Supports both authenticated and guest mode
- **Open stock action** (v0.6.4)
  - Pure FIFO open logic in `inventory-utils.ts` (`computeOpenPlan`)
    - Selects sealed entries by earliest due date → oldest purchase date
  - `openStock()` in `stock-actions.ts`
    - Sets `open: true` and `opened_date` on selected entries
    - Recalculates `best_before_date` using `default_due_days_after_open` (never extends original)
    - Auto-moves to `default_consume_location_id` when `move_on_open` is enabled
    - Logs to `stock_log` with `transaction_type = 'product-opened'`
    - Supports both authenticated and guest mode
  - `undoOpen(correlationId)` — restores sealed state, original due date, and original location
  - Wired quick open button in `DesktopStockTable` and `MobileStockList`
    - Uses product's `quick_open_amount`, undo toast via sonner
    - Disabled when all entries already open
- **Undo toast for all actions** (v0.6.3)
  - Every destructive action now executes immediately with an undo toast (no more `window.confirm`)
  - Consume 1 (quick action) — toast with undo via `undoConsume`
  - Consume... (modal) — toast with undo via `undoConsume`
  - Entry-level consume in `ProductDetailModal` — toast with undo
  - Mark as spoiled — removed `confirm()`, toast with undo via `undoConsume`
  - Delete stock entry — removed `confirm()`, captures snapshot, toast with undo via `undoDeleteEntry`
  - Edit stock entry — captures old values, toast with undo via `undoEditEntry`
  - New `undoDeleteEntry(snapshot)` — re-inserts deleted stock entry from captured data
  - New `undoEditEntry(entryId, oldValues)` — restores previous field values
- **Consume enhancements** (v0.6.2)
  - **Consume Modal** — product-level consume via three-dots menu → "Consume..."
    - Amount input (decimal), location filter (only locations with stock), spoiled checkbox
    - FIFO within selected location, logs `transaction_type = 'spoiled'` when toggled
    - New `ConsumeModal` component using shadcn Dialog
  - **Entry-level actions** in `ProductDetailModal`
    - Consume button (fork icon) — inline amount input with confirm/cancel
    - Spoiled button (warning icon) — consumes full entry as spoiled
    - Both target a specific entry by passing single-entry array to `consumeStock`
  - **Undo toast** for Consume All (replaces `window.confirm`)
    - Executes immediately, shows 8-second undo toast via `sonner`
    - Undo reverses the consume: re-creates deleted entries, increments partial entries
    - `undoConsume(correlationId)` in `stock-actions.ts` marks `stock_log` rows as undone
  - Extended `consumeStock` with `options?: { spoiled }` and `correlationId` in return
  - Preserves `entry.note` in `stock_log` for lossless undo reconstruction
  - Toast infrastructure: `sonner` package, `Toaster` component in root layout
- **Consume 1 quick action** (v0.6.1)
  - Pure FIFO consume logic in `inventory-utils.ts` (`computeConsumePlan`)
    - Priority: opened entries first → earliest due date → oldest purchase date
    - Supports partial consume (reduce amount) and full consume (delete entry)
  - Stock action handler (`src/lib/stock-actions.ts`) with `consumeStock()`
    - Applies mutations to Supabase for both authenticated and guest mode
    - Writes `stock_log` entries with `transaction_type = 'consume'`
    - Groups related log rows with shared `correlation_id`
  - Wired "Consume" button in `DesktopStockTable` and `MobileStockList`
    - Uses product's `quick_consume_amount` for consume quantity
    - Loading state while consuming, refreshes stock overview on success

## [0.5.X] - 2026-02-05

### Added
- Guest mode via Supabase anonymous auth
  - Shared guest household for all anonymous users
  - `GuestBanner` component with sign-in prompt
  - Auto sign-in as guest when closing WelcomeModal
  - WelcomeModal reappears after sign-out
- Demo seed data for guest household
  - 25 products across 10 categories (numbered like Grocy: "01 Dairy", etc.)
  - 29 stock entries with edge cases (expired, overdue, due soon, below min stock)
  - Proper `due_type` values: 1=best before (overdue), 2=expiration (expired)
  - 5 locations, 4 stores, 10 product groups, 12 quantity units
- Admin page (`/admin`) to reset guest data
  - `seed_guest_data()` Postgres function for re-seeding
  - Protected by `ADMIN_SECRET` environment variable
- Stock overview filters
  - Search by product name (mobile + desktop)
  - Filter by location, product group, status
  - Mobile: collapsible filter panel with toggle button
  - Desktop: inline filter bar
  - Clear all filters button
- Grocy-style warning banners (clickable to filter)
  - Red: "X products are expired" (due_type=2, past date)
  - Gray: "X products are overdue" (due_type=1, past date)
  - Amber: "X products are due within the next 5 days"
  - Teal: "X products are below defined min. stock amount"
- Summary stats: products count, stock entries count, total value
- Database migrations
  - `003_guest_mode.sql` — guest household + updated RLS policies
  - `004_guest_seed_data.sql` — demo data seeding
  - `005_seed_guest_function.sql` — re-seed function for admin reset
  - `006_fix_anon_trigger.sql` — skip household creation for anonymous users
- `src/lib/constants.ts` — shared constants (GUEST_HOUSEHOLD_ID)
- `supabase/scripts/cleanup_orphan_households.sql` — manual cleanup script
- Edit stock entries from ProductDetailModal
  - `EditStockEntryModal` component for editing amount, location, expiry, price, note, opened status
  - Edit button (pencil icon) next to delete button for each entry
- Master data management pages (`/master-data/*`)
  - Locations: name, description, is_freezer, active, sort_order
  - Product Groups: name, description, active, sort_order
  - Quantity Units: name, name_plural, description, active, sort_order
  - Shopping Locations (Stores): name, description, active, sort_order
  - Reusable `MasterDataList` and `MasterDataForm` components
  - Add/Edit/Delete functionality with confirmation
  - Active/Inactive toggle (soft delete)
  - Freezer badge for locations
  - Mobile-first horizontal tab navigation
- Products list page (`/master-data/products`)
  - Table with sortable columns (Name, Location, Min stock, QU stock, QU purchase, Product group, Default store)
  - Filters: search, product group, status (active/inactive)
  - Table options popover: show/hide columns, group by (location, product group, min stock, QU stock, default store)
  - Product images with signed URLs
  - Edit/Delete/Toggle active actions
  - Mobile-responsive with card layout and inline table options panel
  - Preferences saved to localStorage
- `EditStockEntryModal`: Added store field, date warning for past dates
- `ProductDetailModal`: Now displays store name for each stock entry
- Drag-and-drop reordering for master data tables (locations, product groups, quantity units, stores)
  - Uses @dnd-kit/core + @dnd-kit/sortable
  - Touch support with 250ms hold delay for mobile
  - Saves sort_order to database on drop
- Unit tests for `inventory-utils.ts` (32 test cases, 100% coverage)
  - `getExpiryStatus` — expiry status logic with date mocking
  - `getExpiryLabel` — human-readable label formatting
  - `getExpiryDaysLabel` — relative day calculations
  - `getInventoryStats` — aggregation, value calc, min stock detection
  - Edge cases: missing location, product group, product
- Unit tests for `storage.ts` (4 test cases)
  - Invalid JSON handling
- E2E tests for guest mode flow (Playwright)
  - WelcomeModal visibility on first visit
  - Guest sign-in flow and GuestBanner display
  - Stock overview loads after guest auth
- E2E tests for product CRUD (create, edit, delete)
- Local Supabase setup for isolated E2E testing
  - Anonymous auth enabled in `supabase/config.toml`
  - CI uses local Supabase instead of cloud

### Changed
- `WelcomeModal` — uses `signInAnonymously()` for guest mode
- `UserMenu` — clears localStorage on sign-out to show WelcomeModal again
- `InventoryStats` — Grocy-style warning banners with proper status logic
- `inventory-utils.ts` — new `ExpiryStatus` types: expired, overdue, due_soon, fresh, none
- RLS policies updated to allow anonymous users access to guest household
- **ProductForm:** Fixed mobile footer layout using fixed positioning with proper bottom spacing
- **Products list (master-data):**
  - Desktop: Sticky action column (edit/toggle/delete) always visible when scrolling horizontally
  - Mobile: Replaced card layout with horizontally scrollable table (Grocy-style)
  - Added column dividers and visible scrollbar
- **Stock overview:**
  - Added Grocy-style quick action buttons (Consume 1, Consume All, Open 1) — disabled until v0.6
  - Added 3-dots menu with "Edit product" option
  - Clickable product name opens detail modal
  - Mobile: Collapsible action buttons with header toggle
  - Mobile: Batch count button expands stock entries inline
  - Tighter spacing with column dividers and scroll indicator
- **InventoryStats refactor:** Removed duplicate min stock calculation
  - Single source of truth in `StockOverviewClient`
  - `InventoryStats` receives count as prop instead of recalculating
- Redesigned `AddStockEntryModal` to match Grocy's Purchase page
  - Two-column layout with product insight panel
  - Unit dropdown shows all units with available conversions
  - Store (shopping location) field added
  - "Never expires" checkbox for due date
  - Past date warning
  - Price per unit/total toggle with calculated price per stock unit
- Unit conversions now use `quantity_unit_conversions` table exclusively
- Removed deprecated `qu_factor_purchase_to_stock` from Product type (migration 007)

### Fixed
- Anonymous users no longer create orphan households
- Expiry status now respects `due_type` (1=overdue, 2=expired)
- **Min stock calculation:** Products with zero stock entries now correctly count toward "below min. stock" warning
  - Previously only products with existing stock entries were evaluated
  - Now fetches all products with `min_stock_amount > 0` and compares against stock totals
  - Zero-stock products display in table when filtering by "below min. stock"
- Product pictures now display when editing existing products
- Product pictures are deleted from storage when deleting products

## [0.4.X] - 2026-01-26

### Added
- Complete Grocy-compatible database schema (`supabase/migrations/001_core_schema.sql`)
  - `locations` table with `is_freezer` and `active` flags
  - `shopping_locations` table with `active` flag
  - `product_groups` table with `active` flag
  - `quantity_units` table with `active` flag
  - `quantity_unit_conversions` table
  - `products` table (40+ fields matching Grocy)
  - `product_barcodes` table (UI in v0.8)
  - `stock_entries` table with Grocycode support
  - `stock_log` table for transaction history (UI in v0.6)
- Supabase Storage buckets (`supabase/migrations/002_storage.sql`)
  - `product-pictures` bucket with RLS policies
  - `recipe-pictures` bucket (for v0.9)
  - Support for JPEG, PNG, WebP, GIF, HEIC/HEIF
- Auto-seed default master data on user signup
- `ImageUpload` component with camera/gallery support
- `ProductForm` with picture upload and 5-tab layout
- `AddStockEntryModal` for quick stock entry
- `StockCard` and `StockList` components
- Storage helper functions (`src/lib/supabase/storage.ts`)
- Full RLS policies for all tables and storage
- Product picture upload with camera support (mobile)
- `ImageUpload` component with Take Photo / Choose Photo buttons
- Supabase Storage buckets for product and recipe pictures
- Storage helper functions (`src/lib/supabase/storage.ts`)
- Responsive stock views:
  - `MobileStockList` — card-based layout for mobile
  - `DesktopStockTable` — table layout for desktop
- Stock aggregation by product (shows total across batches)
- Expandable batch details in stock table
- `InventoryStats` with clickable status filter badges
- Purchase-to-stock unit conversion in AddStockEntryModal
- Product detail modal with stock entries view
- Delete stock entries from modal
- Separate mobile/desktop stock views with consistent modal behavior
- Expand/collapse batches inline (arrow) vs view details (click row)

### Changed
- `inventory-utils.ts` updated for `StockEntryWithProduct` type
- `InventoryStats` redesigned with grid layout
- `InventoryWarnings` updated for new expiry statuses
- Home page uses server component data fetching
- README roadmap rewritten with complete Grocy feature audit

### Removed
- `inventory_items` table (replaced by products + stock_entries)
- Legacy components (WoodCard, InventoryList, AddItemForm, EditItemForm)
- `src/lib/inventory.ts` (replaced by `src/lib/supabase/inventory.ts`)

### Breaking Changes
- Database schema completely restructured
- Guest mode temporarily non-functional

## [0.3.X] - 2026-01-24

### Added
- Database tables: households, inventory_items
- Row Level Security policies for multi-user data isolation
- TypeScript types for database entities
- SQL migration files for reference
- Auto-create household on user signup
- Auth error page (`/auth/error`) with reason handling
- UserMenu dropdown component with Google avatar
- WelcomeModal for first-time visitors (いらっしゃいませ!)
- Next.js image config for Google profile pictures
- Inventory CRUD data layer (`src/lib/inventory.ts`)
- WoodCard component with expiry status badges
- AddItemForm with category and expiry date
- InventoryList with responsive grid layout
- Dual storage: Supabase (signed in) and localStorage (guest)
- EditItemForm component for updating items
- Inventory utility functions (`src/lib/inventory-utils.ts`)
- `InventoryWarnings` component (warning banners by status)
- `InventoryStatsDisplay` component (item counts)

### Changed
- Noren header now uses UserMenu dropdown instead of menu icon
- Auth flow moved from dedicated `/login` page to modal
- Home page now shows inventory list

### Removed
- `/login` page (replaced by WelcomeModal)
- AuthStatus component (replaced by UserMenu)
- GuestStorageTest component (replaced by InventoryList)

## [0.2.X] - 2026-01-23

### Added
- Next.js 14 project scaffolding with App Router
- TypeScript strict mode configuration
- Tailwind CSS 4 with custom theme
- Custom color palette from BRANDING.md
  - Soma Red (#C41E3A) — primary actions
  - Megumi Navy (#1E3A5F) — headers/backgrounds
  - Hayama Silver (#E8E8E8) — light backgrounds
  - Hisako Pink (#E6B8D4) — highlights
  - Takumi Gold (#D4AF37) — warnings
  - Kurokiba Maroon (#722F37) — danger/expired
- Custom fonts via next/font
  - Dela Gothic One — display/headers
  - Zen Kaku Gothic New — body text
- CSS test page at `/test` for visual verification
- ESLint configuration
- Noren (暖簾) header component with curtain fringe effect
- Lucide icons for UI elements
- Guest mode storage utilities (`src/lib/storage.ts`)
- `useGuestStorage` hook for localStorage persistence
- Supabase client setup (browser, server, middleware)
- Google OAuth authentication via Supabase
- Login page (`/login`)
- Auth callback handler
- AuthStatus component for signed-in user display
- Vitest unit testing with jsdom environment
- Playwright E2E testing (Chromium)
- Example tests for storage utilities and home page
- Test scripts: `test`, `test:run`, `test:e2e`, `test:e2e:ui`
- GitHub Actions CI pipeline (lint, test, e2e)
- Custom domain (food-wars.muhammadhazimiyusri.uk) via Vercel + Cloudflare

### Changed
- Pre-commit hook now checks for version bump in both package.json and README.md
- Moved husky to devDependencies

### Technical
- React 19 + Next.js 16
- Tailwind CSS 4 with `@theme` syntax
- pnpm as package manager


## [0.1.X] - 2026-01-19

### Added
- Project documentation
  - README.md with tech stack, roadmap, and project structure
  - BRANDING.md with Shokugeki no Soma-inspired design system
  - CONTRIBUTING.md with development guidelines
  - CHANGELOG.md (this file)
- Database schema design
  - `households` — sharing unit for multi-user support
  - `inventory_items` — name, category, quantity, expiry, status
  - `recipes` — ingredients (JSONB), instructions, tags
  - `shopping_lists` — items with checked state
- Design system
  - Character color palette (Soma Red, Megumi Navy, Takumi Gold, etc.)
  - Japanese mom & pop diner aesthetic guidelines
  - Typography (Dela Gothic One, Zen Kaku Gothic, Yomogi)
  - Component styles (Noren, Chalkboard, WoodCard, LanternButton)
- Developer tooling
  - Version bump script (`scripts/bump-version.mjs`)
  - Pre-commit hook (`.husky/pre-commit`)
  - Claude Project setup instructions
- shadcn/ui component library with custom theme mapping
  - Primary → Soma Red
  - Secondary → Megumi Navy
  - Destructive → Kurokiba Maroon
  - Accent → Hisako Pink
  - Dark mode variables configured

### Technical Decisions
- **Next.js 14 App Router** — Modern React patterns, server components
- **Supabase** — Free tier PostgreSQL + auth, Row Level Security
- **Vercel** — Zero-config deployment, generous free tier
- **Lucide icons** — Consistent, clean icon system (not emoji)
- **Cost-free AI** — Context export to Claude/ChatGPT instead of API calls

---