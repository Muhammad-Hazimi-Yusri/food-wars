# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.2] - 2026-03-25

### Added
- **Cook Now Dashboard** (`/cook-now`) — visual overview of in-stock products organized by cooking role
  - 7 role-based bucket sections: Seasoning System, Protein, Form Factor, Produce, Starch, Other, Untagged
  - Product cards with stock amounts and color-coded expiry badges (expired, overdue, due soon, fresh)
  - Sorted by expiry urgency within each bucket (most urgent first)
  - Collapsible accordion sections on mobile
  - Drag-and-drop meal idea staging area: drag products from buckets to assemble combinations
  - Staging area groups items by role with clear button
  - Mobile: pinned bottom staging bar; Desktop: sticky sidebar
  - Empty states: prompts to tag products or add stock
  - Attribution: "Inspired by Ethan Chlebowski's cooking framework"

---

## [0.14.1] - 2026-03-25

### Added
- **Cook Now Setup** (`/cook-now/setup`) — batch tagger for assigning cooking roles to products with stock
  - Progress bar showing X / Y products tagged
  - 6 role buttons per product: Protein, Produce, Starch, Seasoning, Base, Other
  - Auto-suggest pre-fills roles based on product group keywords (e.g., "Meat & Seafood" → Protein, "Spices" → Seasoning)
  - Filter toggle: untagged only (default) vs show all
  - Mobile-first card layout with 44px+ tap targets; compact table on desktop
  - Optimistic save with instant feedback
  - "Save all suggestions" bulk-confirm button

---

## [0.14.0] - 2026-03-24

### Added
- **Cook Now feature scaffolding** (v0.14.0) — new `cooking_role` column on the `products` table with CHECK constraint for valid values (`protein`, `vegetable`, `starch`, `seasoning_system`, `sauce`, `produce`, `form_factor_base`, `other`); nullable so existing products are unaffected
  - Cook Now nav entry in UserMenu (between Meal Plan and Reports)
  - Empty `/cook-now` page with setup prompt and link to `/cook-now/setup`
  - Guest seed data updated with cooking role assignments for all 25 products

---

## [0.13.18] - 2026-03-22

### Added
- **Current stock display in Add Stock modal's Product Insight Panel** (v0.13.18) — the placeholder paragraph ("Stock amount, value, last purchased... coming in v0.6") is replaced with a live current stock indicator
  - When a product has stock: displays "Current stock: X units" in prominent `font-semibold text-megumi` styling
  - When a product has no stock: displays "Not in stock" in muted `text-gray-400`
  - New optional `stockSummary?: Map<string, number>` prop on `AddStockEntryModal` — parent pages pass a product-id-to-total-amount map; defaults to an empty Map when not provided (backwards-compatible)
  - Parent render sites that need to supply `stockSummary`: `page.tsx`, `ScanToStockFlow.tsx`, `ProductDetailModal.tsx`

---

## [0.13.17] - 2026-03-01

### Changed
- **History tab "Per g" view auto-scales to "per 100g" for small per-unit prices** (v0.13.17) — toggling from "Per bottle" to the stock-unit view in the History tab previously displayed prices like £0.01/g for products such as a 300g sauce bottle (£1.89), which is both misleading (rounding silently drops a significant digit from £0.0063) and unfamiliar — UK supermarkets uniformly show such prices per 100g or per 100ml, not per gram
  - Root cause: raw prices are stored per stock unit (e.g. £0.0063/g); the "Per g" view applied a factor of 1 and formatted with `.toFixed(2)`, rounding £0.0063 to £0.01 and losing precision
  - Fix: `ProductDetailModal.tsx` now derives `scaledStockFactor` (100 or 1) and `scaledStockUnitName` ("100g" or "g") from the product's average or last purchase price per stock unit; if that raw price is below the £0.10 threshold, the stock-unit view multiplies prices by 100 and relabels the unit accordingly; the toggle button ("Per 100g"), table column header ("Price/100g"), stat pills ("Last price", "Avg price"), and price history chart axis all update automatically because they all consume `activeFactor` and `activeUnitName` — no separate display changes required
  - Threshold of £0.10/unit covers all practical small-unit cases (g, ml) without false positives for items priced above £0.10 per unit, where the existing per-unit label is already meaningful
  - The "Per bottle" (purchase-unit) view is completely unaffected; the toggle remains hidden when no QU conversion is defined (existing behaviour unchanged)

---

## [0.13.16] - 2026-03-01

### Fixed
- **Percentage-based quick consume using shrinking remaining stock instead of original purchase amount** (v0.13.16) — when a product's quick consume amount is set as a percentage (e.g. 1%), the calculation was based on the current remaining stock; as stock was consumed the absolute amount per click grew progressively smaller, meaning the product could never fully empty (asymptotic decay)
  - Root cause: `handleConsume` in `MobileStockList.tsx` and `DesktopStockTable.tsx` multiplied `product.totalAmount` (current remaining) by the percentage, rather than the original purchased quantity
  - Fix: `getStockData()` in `src/app/page.tsx` now runs a secondary `stock_log` query after fetching `stock_entries`, matching on `stock_id` with `transaction_type = 'purchase'` and `undone = false`; the original purchase amount is attached to each entry as `originalAmount`; `handleConsume` in both list components now sums `entry.originalAmount ?? entry.amount` across all entries to derive a stable `originalTotal`, then uses that as the percentage base — so a 1% consume on a 300 g product always removes 3 g regardless of how much has already been consumed
  - Pre-v0.13.1 entries that have no matching `stock_log` purchase row receive `originalAmount = null` and fall back to the current `entry.amount` (best-effort; same behaviour as before)
- **Absurd decimal precision in percentage-calculated consume amounts** (v0.13.16) — amounts such as `2.6627721397200004 g` were being passed to `consumeStock` and shown in the toast notification
  - Fix: result of the percentage multiply is now wrapped in `parseFloat(...toFixed(2))`, rounding to a maximum of 2 decimal places while stripping trailing zeros (e.g. `3.00 → 3`, `3.50 → 3.5`)

### Changed
- **Stock detail modal shows consumed vs. original amount** (v0.13.16) — the "Total stock" row in the `ProductDetailModal` hero now displays `current/original unit` (e.g. `270/300 g`) when the product has been partially consumed, giving instant visibility into how much has been used; displays the plain `270 g` format when nothing has been consumed yet or `originalAmount` data is unavailable

---

## [0.13.15] - 2026-02-28

### Fixed
- **Purchase history showing remaining stock instead of original amount** (v0.13.15) — the History tab in ProductDetailModal was displaying the current remaining stock quantity instead of the original purchased amount for entries sourced from `stock_log`
  - Root cause: a `.not("stock_entry_id", "is", null)` filter added in v0.13.9 to suppress ghost records from deleted entries was also silently excluding valid purchase log rows whose `stock_entry_id` is NULL (e.g. purchases made after the linked stock entry was deleted); `stock_log.amount` stores the original purchase amount and is always correct, but these rows were never reaching the UI
  - Fix: removed the NULL filter from the `stock_log` query in `getProductPurchaseHistory()` (`src/lib/analytics-actions.ts`); the existing `undone = false` filter is sufficient to exclude ghost/undone records, making the NULL check redundant and harmful
  - Deduplication is unaffected — the `loggedEntryIds` set already uses `.filter(Boolean)` so NULL `stock_entry_id` values are never added to the set and cannot cause false deduplication against `stock_entries` rows
  - Added a comment to the `stock_entries` fallback mapping noting that `stock_entries.amount` reflects current remaining stock (not original purchase amount) — a known limitation for pre-v0.13.1 data where no `stock_log` row exists

---

## [0.13.14] - 2026-02-26

### Added
- **Default location display in Product Detail modal** (v0.13.14) — the product's default storage location now appears in the summary stats grid alongside total stock, stock value, and batch count; only shown when a default location is set; resolves the last open item from the v0.13 milestone, marking the version complete

---

## [0.13.13] - 2026-02-26

### Added
- **Access control middleware** (v0.13.13) — new `src/middleware.ts` restricts the hosted instance to an email allowlist while keeping guest mode and unauthenticated access open
  - Runs on all page routes; static assets and `/api/*` are excluded from the matcher and are unaffected
  - Gets the current user via `supabase.auth.getUser()` (server-side JWT validation, not the client-side session cache)
  - Reads allowed emails from the `ALLOWED_EMAILS` env var (comma-separated; supports multiple emails)
  - If a non-anonymous authenticated user's email is not in the allowlist → redirect to `/restricted`
  - Anonymous (`is_anonymous === true`) and unauthenticated users pass through without restriction
  - `/restricted` and `/auth/**` are excluded from the check to prevent redirect loops
  - Fails safe: if `ALLOWED_EMAILS` is unset or empty, all non-anonymous authenticated users are blocked

- **Restricted access page** (v0.13.13) — new `src/app/restricted/page.tsx` shown to blocked authenticated users
  - Follows the Japanese diner aesthetic: `Noren` header, `bg-hayama-light` background, `font-display` title, `text-megumi` brand colour
  - Title: "Early Access 限定公開"
  - Three clearly separated options:
    - **Guest Mode** — "Continue as Guest" signs out the current account, signs in anonymously, and redirects to `/`; restores full app access as a demo user
    - **Request Access** — contact links for email, LinkedIn, GitHub, and Reddit using Lucide icons (no emoji)
    - **Self-Host** — link to the `#self-hosting` section of the GitHub README
  - **Sign Out** button (outline) signs out and redirects to `/` so the WelcomeModal appears for a fresh login
  - Loading state on both action buttons while async sign-out/sign-in is in progress

### Changed
- **README early-access note** (v0.13.13) — blockquote added below the Live Demo link noting single-user early access and pointing visitors to guest mode or self-hosting
- **README privacy notice** (v0.13.13) — "Hosted version" paragraph updated to note that access is currently restricted to a single account, with guest mode and self-hosting as alternatives
- **README roadmap trimmed** (v0.13.13) — v0.14 (Grocycode & label printing) and v1.0 (PWA, feature flags, dark mode, accessibility) sections removed from the roadmap; these are not planned for the near term while the app is in single-user early access

---

## [0.13.12] - 2026-02-25

### Fixed
- **Recipe instructions markdown numbered lists not rendering** (v0.13.12) — ordered (numbered) lists in recipe instructions were displaying as unstyled plain text in both the Edit/Preview tab and the saved recipe detail page
  - Root cause: `@tailwindcss/typography` was not installed; the `prose prose-sm` wrapper classes applied to both `<ReactMarkdown>` containers were generating no CSS, leaving Tailwind's preflight reset (`ol, ul { list-style: none }`) with no counter-rule to restore list markers
  - Fix: installed `@tailwindcss/typography` (`pnpm add -D @tailwindcss/typography`) and registered it via `@plugin "@tailwindcss/typography"` in `src/app/globals.css` — the Tailwind v4 plugin registration syntax
  - No component changes required; `prose prose-sm max-w-none` in `RecipeForm.tsx` (preview tab) and `src/app/recipes/[id]/page.tsx` (detail view) already correctly wrap the markdown output

---

## [0.13.11] - 2026-02-24

### Fixed
- **Stale `undoTransaction` test** (v0.13.11) — the "returns error for unknown type" assertion in `stock-actions.test.ts` was probing with `'purchase'`, which became a handled case in v0.13.9 when `undoPurchase` was added; the mock was not configured for the purchase path, causing a spurious "is not a function" error rather than the expected message; changed probe value to `'transfer-to'`, which genuinely hits the `default` branch

---

## [0.13.10] - 2026-02-24

### Fixed
- **dnd-kit hydration mismatch on Meal Plan page** (v0.13.10) — dev-mode `aria-describedby` mismatch warning eliminated
  - `DndContext` in `MealPlanWeekView`, `MealPlanClient`, and `MealPlanSectionsManager` now each receive a stable string `id` prop (`"meal-plan-week-dnd"`, `"meal-plan-mobile-dnd"`, `"meal-plan-sections-dnd"`); dnd-kit's internal ID counter no longer differs between SSR and CSR renders
- **Missing `key` prop warning in MealPlanWeekView** (v0.13.10) — React console warning about keyless children in a list resolved
  - `sections.map()` used a shorthand `<>` Fragment as its direct return element, which cannot accept a `key` prop; replaced with `<React.Fragment key={section.id}>` so React can correctly track each section row across re-renders

### Changed
- **Recipe meal entries link to recipe detail page** (v0.13.10) — recipe names in both the week grid and mobile day view are now clickable
  - `MealPlanEntryCard` imports `Link` from `next/link`; when `entry.type === "recipe"` and `entry.recipe_id` is set, the name label renders as `<Link href="/recipes/{id}">` with `hover:underline`; other entry types (product, note) are unchanged
  - `e.stopPropagation()` on the link prevents interference with dnd-kit's pointer listeners on the surrounding sortable chip

---

## [0.13.9] - 2026-02-24

### Fixed
- **Orphaned price history on stock entry deletion** (v0.13.9) — deleting a stock entry no longer leaves ghost purchase records in the History tab
  - `stock_log.stock_entry_id` is set to `NULL` by the database (`ON DELETE SET NULL`) when a stock entry is deleted; `getProductPurchaseHistory()` in `analytics-actions.ts` now filters `.not("stock_entry_id", "is", null)` so orphaned log rows are excluded from the purchase log table and price chart
  - Pre-v0.13.1 retroactive rows (sourced from `stock_entries` directly) are unaffected — they never had a `stock_log` row and continue to come from the second merge source

### Added
- **Undo purchase transactions in Stock Journal** (v0.13.9) — "Purchased" entries in the Stock Journal can now be fully reversed via the undo button
  - `undoPurchase(correlationId)` added to `stock-actions.ts`: marks the `stock_log` row as `undone = true` first (so it disappears from history queries immediately), then deletes the associated `stock_entries` row; if stock was partially consumed before undoing, the remaining amount is removed
  - `case 'purchase'` added to `undoTransaction()` dispatcher — previously fell through to "Cannot undo this transaction type"
  - The `undone = false` filter on `getProductPurchaseHistory()` ensures an undone purchase also vanishes from the History tab price chart

### Changed
- **Product Detail modal accessible from Master Data > Products List** (v0.13.9) — product names and images in the Products List are now clickable and open the same `ProductDetailModal` used on the Stock Overview
  - Clicking a product name or picture queries `stock_entries` for that product and opens the modal; zero-stock products are fully supported — the Stock tab shows "No stock entries" while History and Analytics tabs still populate from their own queries
  - `ProductDetailModal` accepts a new optional `product?: ProductWithRelations` prop so the modal can render without requiring at least one stock entry; the render guard changed from `entries.length === 0 || !product` to `!product`; backward-compatible — existing callers on Stock Overview are unchanged
  - Desktop and mobile tables in `ProductsListClient` both updated with `hover:text-soma` clickable name/image buttons matching the Stock Overview pattern

---

## [0.13.8] - 2026-02-24

### Changed
- **Purchase unit price in History tab** (v0.13.8) — the History tab in `ProductDetailModal` now shows price in **purchase quantity units** by default (e.g. `£1.10/pack`) instead of the raw stock-unit price stored in the database (e.g. `£0.01/g`)
  - `purchaseFactor` computed client-side via a `useMemo` that looks up `quantity_unit_conversions` for a row where `from_qu_id = product.qu_id_purchase` and `to_qu_id = product.qu_id_stock`; product-specific conversions take priority over global ones; returns `null` when the two QUs are the same unit or no conversion row exists
  - `priceView` state (`"purchase"` | `"stock"`, defaults to `"purchase"`) drives a pill segmented control that appears in the "Purchase log" heading row only when a non-trivial conversion factor is found
  - Toggle labels read `Per {purchaseUnitName}` / `Per {unitName}` (e.g. `Per pack` / `Per g`); resets to `"purchase"` whenever the modal closes
  - `displayRows` derived from `purchaseHistory.rows` with `price * activeFactor` applied; fed to both the table and the chart so both update together
  - "Last price" and "Avg price" stat pills also multiply by `activeFactor`
  - Price/unit column header now reads `Price/{activeUnitName}` (e.g. `Price/pack`) rather than the static `Price/unit` string
  - Products whose `qu_id_purchase === qu_id_stock`, or whose conversion is not defined, show stock-unit price unchanged and no toggle is rendered
- **Price history chart repositioned and made collapsible** (v0.13.8) — `PriceHistoryChart` moved from above the purchase log table to below it
  - Wrapped in a native `<details open>` element so users can collapse it on small screens; the `<summary>` ("Price over time") replaces the internal `<h4>` heading that was removed from the component
  - Chart continues to require ≥ 2 priced rows to render; outer gate uses `purchaseHistory.rows` so visibility is stable regardless of the active price view
  - Chart receives `displayRows` and `activeUnitName`, so its Y-axis and tooltip label reflect the same toggle state as the table

---

## [0.13.7] - 2026-02-24

### Fixed
- **Purchase history retroactive data** (v0.13.7) — History tab and Spending report now surface stock added before v0.13.1 introduced purchase logging
  - `getProductPurchaseHistory()` rewritten to merge two sources: `stock_log` purchase rows (v0.13.1+) and `stock_entries` rows not already represented in the log (pre-v0.13.1); deduplication via `stock_log.stock_entry_id`; merged rows sorted by date descending
  - `getHouseholdSpending()` updated with the same dual-source approach: always queries `stock_entries` alongside `stock_log`, deduplicates, and aggregates spend from both into the product-group and store breakdowns; `days` filter applied to `stock_log.created_at` and `stock_entries.purchased_date` respectively
  - Previously the fallback in `getProductPurchaseHistory()` only derived `lastPurchasedAt`/`lastPrice` scalars from a single `stock_entries` row and never populated `rows[]`, so the History tab showed "No purchase history yet" even for products with existing stock entries

---

## [0.13.6] - 2026-02-23

### Added
- **Expiring soon report** (`/reports/expiring`) — lists all in-stock entries with `best_before_date <= today + 7`, sorted by date ascending; columns: Product, Amount, Location, Due date, Status badge (overdue / due soon / fresh); empty state when nothing due imminently
- **Print support** — `PrintButton` client component calls `window.print()`; print-specific CSS in `globals.css` hides nav/header/buttons, expands content to full page width, adds clean table borders, and renders a "Printed from Food Wars · {date}" watermark footer

---

## [0.13.5] - 2026-02-23

### Added
- **Spending report** (`/reports/spending`) — total spend summary card, bar chart by product group, bar chart by store, breakdown table with % of total; `getHouseholdSpending(days?)` server action in `analytics-actions.ts`
- **Stock value report** (`/reports/stock-value`) — total inventory value card, bar chart by product group, breakdown table (batches, value, % of total); `getStockValueByGroup()` server action in `analytics-actions.ts`
- **`SpendingChart`** client component (`src/components/reports/SpendingChart.tsx`) — shared recharts `BarChart` used by both reports; accepts `color` prop for theming

---

## [0.13.4] - 2026-02-23

### Added
- **Reports section** (v0.13.4) — new `/reports` route with horizontal tab nav (Waste | Spending | Stock Value | Expiring Soon); "Reports" link (BarChart2 icon) added to `UserMenu` between Journal and Settings
- **Waste report** (`/reports/waste`) — summary cards (total items spoiled, estimated value wasted), weekly spoiled-items bar chart (recharts), breakdown table by product group; empty state when no spoils recorded
  - `getHouseholdWaste(days?)` server action in `analytics-actions.ts` — queries `stock_log WHERE spoiled = true AND undone = false`, joins `products → product_groups`, computes weekly (`WasteByWeek[]`) and group (`WasteByGroup[]`) breakdowns
  - `WasteChart` client component (`src/components/reports/WasteChart.tsx`) — recharts `BarChart` of spoiled count per ISO week

---

## [0.13.3] - 2026-02-23

### Added
- **Price history chart** (v0.13.3) — `PriceHistoryChart` component using `recharts` renders in the History tab when 2 or more priced purchase rows exist
  - `LineChart` with one coloured line per shopping location; x-axis = purchase date, y-axis = price per stock unit
  - `Tooltip` shows formatted price per unit (e.g. "£1.50 / 100g"); `Legend` shown when multiple stores are present
  - `ResponsiveContainer` fills full tab width at a fixed 200px height; gracefully returns `null` when fewer than 2 priced data points exist
  - Added `recharts` dependency

---

## [0.13.2] - 2026-02-23

### Added
- **Consumption analytics tab populated** (v0.13.2) — `ProductDetailModal` Analytics tab now shows real data from `getProductConsumptionStats()` in `analytics-actions.ts`
  - Stat pills: Last consumed date, Spoil rate (colour-coded: green < 10%, amber 10–29%, red ≥ 30%), Average shelf life in days
  - Consumption log table: Date | Amount | Status badge (consumed / spoiled), newest-first, up to 200 rows
  - Empty state shown when no consume or spoiled events exist for the product

---

## [0.13.1] - 2026-02-23

### Added
- **Purchase logging** (v0.13.1) — every stock addition now writes a `stock_log` row with `transaction_type = 'purchase'`, capturing `price`, `shopping_location_id`, `amount`, `stock_entry_id`, and `purchased_date`
  - `AddStockEntryModal.handleSubmit` inserts into `stock_log` after the `stock_entries` insert (best-effort; non-blocking on failure)
  - `bulkCreateStockEntries` (used by receipt/barcode scan bulk-add) also writes a purchase log row per successful entry
  - Migration `017_analytics_index.sql` adds a composite index on `stock_log(household_id, product_id, transaction_type, created_at DESC)` for fast per-product analytics queries
- **History tab populated** — `ProductDetailModal` History tab now shows real data from `getProductPurchaseHistory()` in `analytics-actions.ts`
  - Stat pills: Last purchased date, Last price per stock unit, Average price across all purchases
  - Purchase log table: Date | Store | Amount | Price/unit (newest-first, up to 100 rows)
  - Falls back gracefully to `stock_entries` data (`lastPrice`, `lastPurchasedAt`) for users who added stock before v0.13.1 introduced purchase logging
  - Empty state retained when no purchase rows exist

---

## [0.13.0] - 2026-02-23

### Added
- **Product analytics: modal tabs + quick links** (v0.13.0) — restructures `ProductDetailModal` into a tabbed layout with navigation shortcuts
  - **Three-tab layout** (Stock | History | Analytics) using shadcn `Tabs` — Stock tab holds all existing content; History and Analytics show placeholder empty states (data arrives in v0.13.1 and v0.13.2 respectively)
  - **Per-location stock breakdown** — when a product's stock spans multiple locations, pill badges appear below the summary stats showing `{location}: {amount} {unit}` for each location
  - **Quick links footer** — always-visible action row at the bottom of the modal: "Journal" (navigates to `/journal`), "Add Stock" (opens an inline `AddStockEntryModal` pre-filled with this product and its defaults), "Edit Product" (navigates to `/products/{id}/edit`)
  - **Inline Add Stock modal** — `AddStockEntryModal` rendered as a sibling dialog, pre-filled with the product using a single-product list derived from the already-fetched product data; `qu_purchase` resolved from the fetched quantity units; on success, both modals close and stock refreshes
  - **Responsive dialog shell** — `DialogContent` changed from `sm:max-w-lg overflow-y-auto` to `sm:max-w-2xl flex flex-col max-h-[90vh] overflow-hidden`; tab content panels use `overflow-y-auto` so only the tab area scrolls, keeping the header, summary, and quick links visible
  - **Bug fix:** `statusColors` map corrected from `expiring_soon` to `due_soon` to match the `ExpiryStatus` type returned by `getExpiryStatus()` — amber badge now correctly shows for items due within 5 days

---

## [0.12.6] - 2026-02-23

### Added
- **Meal planning: "What's for Dinner?" + calorie display** (v0.12.6) — quick dinner visibility on the home page and estimated daily calories in the meal plan view
  - **"Tonight's dinner" card** on the stock overview home page (`/`) — async server component (`TodaysDinnerCard`) fetches today's "Dinner" section entries at page render; shows each recipe name with a green `CheckCircle` / red `XCircle` fulfillment badge; displays a "See full plan →" link to `/meal-plan?date=today`; rendered inside a `<Suspense fallback={null}>` so it streams in without blocking the main page; card is entirely absent when no dinner is planned (no empty state clutter)
  - **Daily kcal estimate** in mobile day view — a "~X,XXX kcal" text line appears below the day tab strip when any recipe entries on the selected day have nutrition data; updates in real-time when entries are moved between days via drag-and-drop (derived from `localEntries` + `kcalPerServingByRecipe` in `useMemo`)
  - **Per-day kcal in week grid** — each day column header shows "~X,XXX" in muted text below the date number when there are recipe entries with nutrition data for that day
  - **`computeDailyNutrition`** pure utility in `meal-plan-utils.ts`: takes `entries: EntryForAggregation[]` and `kcalPerServing: Map<string, number>`; multiplies per-serving kcal by `recipe_servings` (falls back to 1); returns a rounded integer; ignores product/note entries
  - **Server-side nutrition computation** (`meal-plan/page.tsx`): fetches `product_nutritions` in parallel with ingredients and stock; builds `kcalByProduct` map; computes `kcalPerServingByRecipe[recipeId] = totalIngredientKcal / base_servings` for each recipe in the week; passed as a new `kcalPerServingByRecipe` prop to `MealPlanClient`
  - **Unit tests** — 7 new Vitest tests for `computeDailyNutrition`: empty entries, non-recipe entries skipped, no nutrition data returns 0, single recipe kcal, servings scaling, null servings fallback, multi-recipe sum

---

## [0.12.5] - 2026-02-23

### Added
- **Meal planning: shopping list generation** (v0.12.5) — one-click button fills the shopping list for the entire week's meal plan
  - **"Generate list" button** in the week view secondary actions row (ShoppingCart icon); calls `generateWeekShoppingList(weekStart)` server action; Sonner toast reports "Added N ingredients to "List Name"" with a "View list" action that navigates to `/shopping-lists`; separate toast shown when all ingredients are already in stock
  - **`aggregateWeekIngredients`** pure utility in `src/lib/meal-plan-utils.ts`: iterates all recipe entries in the week; scales each ingredient's amount by `recipe_servings / base_servings`; consolidates duplicate `product_id × qu_id` pairs across all days and sections; subtracts current stock from totals; returns only items with a positive deficit, sorted by `product_id`; skips: `not_check_stock_fulfillment`, `variable_amount` ("to taste") ingredients, null `product_id`, and products with `not_check_stock_fulfillment_for_recipes`
  - **`generateWeekShoppingList(weekStart)`** server action: fetches all recipe entries for the 7-day window; parallel fetches for ingredients (with product+qu joins), base servings per recipe, current stock totals, and existing shopping lists; builds Maps and calls `aggregateWeekIngredients`; finds target list (auto-target flag or alphabetically first); delegates to reused `addMissingToShoppingList` from `recipe-actions.ts`; returns `{ success, addedCount, listName }`
  - **Unit tests** (`src/lib/__tests__/meal-plan-utils.test.ts`) — 13 Vitest tests for `aggregateWeekIngredients`: empty entries, no ingredients found, serving scaling (recipe_servings / base_servings), null servings fallback to base, consolidation of same product×qu across multiple entries, separate entries for different qu_ids, stock subtraction, fully-in-stock items omitted, skip flags (not_check_stock_fulfillment, variable_amount, null product_id, product.not_check_stock_fulfillment_for_recipes), cross-recipe aggregation

---

## [0.12.4] - 2026-02-23

### Added
- **Meal planning: copy day/week + sections management** (v0.12.4) — batch copy operations and configurable meal sections
  - **Copy day** — compact icon button in the mobile day-tab bar opens a "Copy day to…" dialog with a native date picker; `copyMealPlanDay(fromDate, toDate)` server action fetches all entries for `fromDate` and bulk-inserts copies with fresh IDs to `toDate`; shows count toast with the target date
  - **Copy week** — "Copy week →" text button in the week header calls `copyMealPlanWeek(fromWeekStart, toWeekStart)` with next week as the target; preserves day-of-week offsets (Mon→Mon, Tue→Tue, etc.); toast includes a "View" action that navigates to the destination week
  - **Sections manager** — gear icon (⚙) button in the week navigation header opens a `MealPlanSectionsManager` dialog:
    - DnD-sortable section list (GripVertical handle); `reorderMealPlanSections(ids[])` server action persists new sort order
    - Inline edit: pencil button toggles each row to an editable name + optional time (`HH:MM`) input; ✓/✗ buttons save or cancel; keyboard `Enter` / `Escape` also work
    - Delete: trash button removes section; `meal_plan` entries with that section fall back to "Other" (DB `ON DELETE SET NULL`); toast confirms with a message
    - Add section: name + time inputs with a "+" button at the bottom of the dialog; appended at the end of the sort order
  - New server actions in `meal-plan-actions.ts`: `addMealPlanSection`, `updateMealPlanSection`, `removeMealPlanSection`, `reorderMealPlanSections`, `copyMealPlanDay`, `copyMealPlanWeek`
  - New component `MealPlanSectionsManager` (`src/components/meal-plan/MealPlanSectionsManager.tsx`) — self-contained Dialog with optimistic local state synced from server props via `useEffect`

---

## [0.12.3] - 2026-02-22

### Added
- **Meal planning: drag-and-drop** (v0.12.3) — reorder meals within a slot and drag across day×section cells; touch-friendly
  - `reorderMealPlanEntries(ids[])` server action — sequential `sort_order` updates (0, 1, 2…) for entries in a slot
  - `MealPlanWeekView` — self-contained `DndContext` with `PointerSensor` (distance: 8px) + `TouchSensor` (delay: 250ms) + `KeyboardSensor`; `DroppableCell` wrapper uses `useDroppable` so empty cells register as valid drop targets; `SortableEntryChip` uses `useSortable` per entry; `DragOverlay` shows a compact floating card (slight rotation + shadow) while dragging; drop zone highlighted with `ring-2 ring-soma/40` on hover
  - `MealPlanClient` — mobile `DndContext` with `DroppableSection` + `SortableDayEntryCard` per section; `DragOverlay` shows full-size card; separate `DndContext`s for mobile and desktop avoid entry ID conflicts between the CSS-hidden view and the visible one
  - Shared `handleDragEnd(event)` callback (via `useCallback`): parses `over.id` — if starts with `cell:${day}|${sectionId}` → drop onto empty cell/container; otherwise looks up target entry to determine its slot; same slot → `arrayMove` + `reorderMealPlanEntries`; different slot → `updateMealPlanEntry({ day, section_id, sort_order })`; optimistic update applied immediately; reverts to server snapshot + error toast on failure
  - `localEntries` state in `MealPlanClient` (initialised from server `entries` prop) holds the optimistic DnD state; synced back via `useEffect` on `entries` prop change (after `router.refresh()`)

---

## [0.12.2] - 2026-02-22

### Added
- **Meal planning: week view + fulfillment badges** (v0.12.2) — desktop 7-column calendar grid with stock fulfillment indicators
  - `MealPlanWeekView` — CSS Grid layout (`80px + repeat(7, 1fr)`) with section label column + 7 day columns; header row shows short weekday names + date number with today highlighted in `soma` colour; each day×section cell has a minimum height of 72px with stacked compact entry cards and a hover-reveal "+" button; unsectioned entries rendered in an "Other" row at the bottom if any exist
  - `MealPlanEntryCard` — two display modes: default (day view) and `compact` (week grid); `compact` shows icon + truncated name + fulfillment badge on one line; both modes show fulfillment badge: green `CheckCircle` (can make) or red `XCircle` (missing stock) when `canMake` prop is provided
  - `MealPlanClient` — restructured for week-based navigation: accepts `weekStart`, `weekDays`, `today`, and `fulfillmentByRecipeId`; **mobile**: day-tab strip (Mon–Sun, scrollable) with the existing section-card day view for the selected tab; **desktop** (`≥md`): `MealPlanWeekView`; week navigation header (prev/next chevrons + "Today" link) shared across both; dialog state tracks `dialogDay` and `dialogSectionId` for both mobile and desktop add buttons
  - `/meal-plan` page updated to week-based routing: accepts `?week=YYYY-MM-DD` (ISO Monday) or `?date=YYYY-MM-DD` (derives Monday); fetches all 7 days' entries in one query (`.gte/.lte` on day column); max content width widened to `max-w-6xl` for desktop grid
  - **Fulfillment computation (server-side):** unique recipe IDs collected from week entries; `recipe_ingredients` (with product + qu joins) and `stock_entries` fetched in parallel; stock totals aggregated into `Map<product_id, number>`; `computeRecipeFulfillment` called per recipe at base servings; `fulfillmentByRecipeId: Record<string, boolean>` passed as prop — computed once on page load, not per card
  - Week header displays formatted date range (e.g. "17–23 Feb 2026", cross-month aware); "Today" link navigates to the current week's Monday

---

## [0.12.1] - 2026-02-22

### Added
- **Meal planning: day view + entry CRUD** (v0.12.1) — full add/remove for recipe, product, and note entries with mobile-first day navigation
  - `/meal-plan` page updated to server component with real data fetching: reads `?date=YYYY-MM-DD` query param (defaults to today), fetches sections, day entries, recipes, and products in parallel via `Promise.all`; assembles `MealPlanEntryWithRelations` server-side by manual map join (avoids complex Supabase FK hints)
  - `MealPlanClient` — client wrapper for date navigation and dialog state; date header with prev/next chevron buttons using `router.push('/meal-plan?date=…')`; groups entries by `section_id` using `useMemo`; renders each section as a bordered card with entry list and per-section "+" button
  - Date formatting helpers (no date-fns): `offsetDate` uses `new Date(str + 'T00:00:00')` for timezone-safe arithmetic; `formatDateDisplay` returns "Today", "Yesterday", "Tomorrow", or `en-AU` long date
  - `MealPlanEntryCard` — entry card with type icon (ChefHat = recipe, Package = product, FileText = note), name, and servings/amount sub-label; delete button visible on hover; 8-second undo toast using `removeMealPlanEntry` + `undoRemoveMealPlanEntry` (same pattern as recipe deletion)
  - `AddMealEntryDialog` — modal dialog for adding entries: 3-button type toggle (Recipe / Product / Note); recipe picker via shadcn Select with servings stepper (−0.5 / value / +0.5); base servings pre-filled when recipe selected; product picker with amount stepper; note textarea; section picker; client-side validation before submit
  - `src/lib/meal-plan-actions.ts` — four server actions (browser Supabase client pattern):
    - `addMealPlanEntry` — inserts with computed `sort_order` (max+1 within day×section slot)
    - `removeMealPlanEntry` — fetches row snapshot then deletes; returns snapshot for undo
    - `undoRemoveMealPlanEntry` — re-inserts snapshot with original ID for referential integrity
    - `updateMealPlanEntry` — partial update for servings edits and future DnD moves
  - `shadcn/ui` Textarea component installed (`src/components/ui/textarea.tsx`) for note entry

---

## [0.12.0] - 2026-02-22

### Added
- **Meal planning: schema + nav + empty page** (v0.12.0) — foundation for v0.12 calendar-based meal planner
  - `meal_plan_sections` table — configurable meal sections (name, optional time, sort_order) with full dual-mode RLS (authenticated + anonymous guest)
  - `meal_plan` table — entries per day with type `recipe | product | note`, recipe_servings, product_amount/qu, note text, section assignment, and `sort_order` for drag-and-drop within a slot; full dual-mode RLS
  - Indexes: `(household_id)`, `(household_id, day)`, `(section_id)` on `meal_plan`; `(household_id)` on `meal_plan_sections`
  - Default sections seeded automatically: `Breakfast` (08:00), `Lunch` (12:00), `Dinner` (18:00)
    - New user signup trigger (`handle_new_user`) updated to insert default sections
    - Guest household seeded with fixed-ID sections (`b0000000-...`) for reset stability
    - `seed_guest_data()` function updated to clear and re-seed sections on admin reset
    - One-time backfill for all existing authenticated households (no duplicate guard via `NOT EXISTS`)
  - `MealPlanSection` and `MealPlanEntry` TypeScript types in `src/types/database.ts`
  - `MealPlanEntryWithRelations` joined type (section, recipe, product, product_qu)
  - Empty `/meal-plan` page (server component) — CalendarDays icon empty state with placeholder text
  - "Meal Plan" navigation link (CalendarDays icon) added to UserMenu dropdown between Recipes and Journal

### Database Migrations
- `015_meal_plan.sql` — `CREATE TABLE meal_plan_sections`, `CREATE TABLE meal_plan` with full RLS + indexes; updates `handle_new_user()` and `seed_guest_data()` functions; seeds guest and backfills existing households

---

## [0.11.8] - 2026-02-22

### Added
- **AI recipe generation** — users describe a recipe in natural language and the AI generates a structured draft reviewed inline in chat before saving
  - `POST /api/ai/chat` — new `## RECIPE GENERATION` section appended to system prompt unconditionally (always present, regardless of recipe library size); instructs the model to emit a single `<recipe_draft>` XML tag containing a JSON object when the user asks to "create", "make", "generate", or "give me a recipe"; includes full example schema and rules: use `[id:...]` product IDs from the known products context where matched, use units from the units list, format instructions as markdown with `##` headings and numbered steps, use ingredient groups ("Main", "Sauce", "Garnish", "Spices"), prefer in-stock products first when user says "from my stock" / "using what I have"; tag must never be emitted for other intents (stock queries, recipe lookups, etc.)
  - `<recipe_draft>` tag parsing — regex-extracted from raw Ollama response alongside existing `<stock_entry>`, `<recipe_ref>`, `<recipe_action>` tags; JSON parsed as a single object; server-side ingredient validation loop: if AI provides a `product_id`, validated against the live products list and nulled if invented; null `product_id` fuzzy-matched via `findBestMatch` (bigram Dice coefficient) against active products by name; `unit_name` fuzzy-matched to `qu_id` against active quantity units; resulting `RecipeDraft` returned as `recipe_draft` field in the API JSON response; `<recipe_draft>` tag stripped from display text alongside all other tags
  - `findBestMatch` imported directly from `src/lib/fuzzy-match.ts` into the route (previously only reached via `ai-parse-items.ts`)
  - `RecipeDraftCard` component (`src/components/ai/RecipeDraftCard.tsx`) — inline review card rendered in chat messages when `recipe_draft` is present:
    - **Header**: inline-editable recipe name (transparent input that looks like text until focused), base servings stepper (−/count/+ controls, minimum 1); description shown as 1-line muted preview when present
    - **Ingredients section**: each row shows `amount unit product_name — note`; "Matched" (green border, `text-green-700 bg-green-50 border-green-200`) or "No match" (amber border, `text-amber-700 bg-amber-50 border-amber-200`) badge — same visual pattern as `StockEntryCard`; matching determined by `product_id !== null` (resolved server-side at parse time); per-ingredient ✕ remove button removes from local state before saving
    - **Instructions preview**: first 3 non-empty lines shown as truncated plain text with "Full instructions included" italic hint below; full markdown instructions always saved regardless
    - **Save Recipe button**: calls `createRecipe({ name, description, instructions, base_servings })`, then sequential `addIngredient(recipeId, { product_id, amount, qu_id, note, ingredient_group, variable_amount })` for each remaining ingredient; `addIngredient` auto-increments `sort_order` via `max(existing)+1` so sequential calls produce correct ingredient ordering
    - Loading spinner during save; on error: sonner error toast, card remains interactive for retry
    - **Saved state**: card body replaced with green success panel — recipe name with ✓ (ChefHat icon), "View Recipe →" link to `/recipes/[id]`, "Edit Recipe →" link to `/recipes/[id]/edit`
  - `AiChatWidget` — `Message` type extended with `recipe_draft?: RecipeDraft`; `data.recipe_draft` mapped onto assistant message in `handleSend`; `RecipeDraftCard` rendered below message text (after recipe_action block) when `recipe_draft` is present
  - "Create a recipe from my stock" added as 5th suggestion chip on the chat welcome screen
  - `src/types/ai.ts` — two new shared types exported: `RecipeDraftIngredient` (`product_name`, `product_id`, `qu_id`, `amount`, `unit_name`, `ingredient_group`, `note`, `variable_amount`) and `RecipeDraft` (`name`, `description`, `instructions`, `base_servings`, `ingredients: RecipeDraftIngredient[]`)

---

## [0.11.7] - 2026-02-22

### Added
- **AI chat: recipe awareness** — the assistant now knows about all household recipes and can answer recipe questions using real data rather than guessing from stock alone
  - `POST /api/ai/chat` — fetches up to 80 recipes + their ingredients alongside the existing stock/product queries (all in the same `Promise.all`); computes `computeRecipeFulfillment` and `computeDueScore` server-side for each recipe; injects a compact `RECIPE LIBRARY` block into the system prompt, sorted by urgency (ingredient expiry pressure) descending
  - Recipe context format per recipe: name, UUID, base servings, fulfillment status (✓ can make / ✗ missing N), urgency score, up to 15 ingredients with amounts + units + missing markers (`[✗]`), and "produces" product name where set
  - System prompt recipe behaviour instructions: "What can I cook?", "What should I cook first?", "Can I make X?", "Recipe for X?", "Scale X for N servings", "Add missing for X to shopping list", "Suggest a recipe for expiring items"
  - `<recipe_ref>` response tag — AI wraps referenced recipes in structured JSON tags (`recipe_id`, `recipe_name`, `can_make`, `missing_count`); parsed from the raw response alongside existing `<stock_entry>` parsing; returned as `recipe_refs[]` in API response with all tags stripped from display text
  - `<recipe_action>` response tag — AI outputs a structured action tag when user asks to add missing ingredients to shopping list; parsed and returned as `recipe_action` in API response
  - `stock_entries` select in `/api/ai/chat` extended with `product_id` (previously omitted) to enable server-side fulfillment and due score computation against the already-fetched stock data
  - `RecipeRefCard` component (`src/components/ai/RecipeRefCard.tsx`) — mini recipe card rendered inline in chat messages: green `CheckCircle2` (can make) or red `XCircle` + missing count badge, recipe name truncated, "View →" link to `/recipes/[id]`
  - `addRecipeMissingToDefaultList(recipeId)` added to `recipe-actions.ts` — finds the household's `is_auto_target` shopping list (fallback: first list alphabetically), fetches recipe ingredients with product + unit joins, fetches stock for relevant product IDs only, calls `computeRecipeFulfillment`, then delegates to the existing `addMissingToShoppingList`; returns `{ addedCount, listName }` for toast messaging; gracefully handles 0-missing ("already in stock") case
  - `AiChatWidget` — `Message` type extended with `recipe_refs?: RecipeRef[]` and `recipe_action?: RecipeAction`; recipe ref cards rendered as a vertical stack below message text; "Add missing to shopping list" button rendered when `recipe_action` is present; `doneActionRecipeIds: Set<string>` state tracks completed actions per recipe ID (button replaced by "✓ Added to shopping list" on success); `handleAddMissing` calls `addRecipeMissingToDefaultList` and shows sonner toast with item count + list name
  - "Suggest a recipe for expiring items" added as 4th suggestion chip on the chat welcome screen
  - `src/types/ai.ts` — new shared types file: `RecipeRef` and `RecipeAction` interfaces, imported by both the server route and client widget

---

## [0.11.6] - 2026-02-21

### Added
- **Recipes: markdown instructions + due score card badge** (v0.11.6)
  - `instructions TEXT` column added to `recipes` table (migration 014)
  - `Recipe` type gains `instructions: string | null` field
  - `CreateRecipeParams` / `UpdateRecipeParams` in `recipe-actions.ts` include `instructions`
  - `RecipeForm` — new Instructions textarea (monospace font) below Description; Edit / Preview tab toggle renders markdown via `ReactMarkdown` + `remark-gfm`; Description shortened to 2-row blurb field
  - `/recipes/[id]` detail page — renders `recipe.instructions` as markdown (`prose prose-sm`) when set
  - `react-markdown` + `remark-gfm` dependencies added
  - `RecipeCard` — "Expiring!" (red) / "Due soon" (amber) badge overlaid on card picture when due score ≥ 50 / ≥ 5
  - All v0.11 roadmap checklist items now `[x]` in README

---

## [0.11.5] - 2026-02-21

### Added
- **Recipes: nesting + produces product** (v0.11.5)
  - `RecipeNestingClient` component — list of sub-recipes with servings multiplier; add (recipe search picker + servings input), edit servings, remove with undo toast; excludes self and already-nested recipes from picker
  - `ProducesProduct` component — product search picker; links a product to a recipe; when cooked, the linked product is added to stock (amount = desired servings); Change / Clear buttons
  - `flattenNestedIngredients` pure utility in `recipe-utils.ts` — recursively resolves sub-recipes into a flat ingredient list, scaling by nesting servings; cycle guard via `Set<string>`
  - `computeDueScore` pure utility in `recipe-utils.ts` — scores a recipe by ingredient expiry urgency (expired +100, today +50, 1–3 days +20, 4–7 days +5)
  - `addNestedRecipe`, `updateNestedRecipe`, `removeNestedRecipe`, `undoRemoveNestedRecipe`, `setProducesProduct` server actions in `recipe-actions.ts`
  - `consumeRecipe` enhanced: when `recipe.product_id` is set, inserts a stock entry for the produced product after consuming ingredients
  - `RecipeNestingWithRelations` type added to `src/types/database.ts`
  - Nested ingredient fulfillment — `RecipeDetailClient` flattens nested ingredients and normalises amounts to base scale before passing to `computeRecipeFulfillment`; cook action consumes only direct (own) ingredients
  - `RecipeFulfillment` gains `ownIngredients` prop — fulfillment display uses all (own + nested), cook consumes own only
  - `/recipes/[id]` page now fetches nestings, all household recipes, all household recipe_ingredients (for nested fulfillment), and full stock in a single parallel round trip
  - `/recipes` list gains "Due soon" sort — toggle between A–Z and due score (ingredients expiring soonest rise to top)

---

## [0.11.4] - 2026-02-21

### Added
- **Recipes: stock fulfillment + cook action** (v0.11.4)
  - `RecipeFulfillment` component — "Ready to cook" / "X ingredients missing" badge (CheckCircle / XCircle), fulfillment progress bar, per-ingredient need/have/missing rows, "Add missing" button, "Cook" button
  - `RecipeDetailClient` — new thin client wrapper that owns `desiredServings` state and passes it to `ServingScaler`, `RecipeFulfillment`, and `RecipeIngredientsClient` (serving scaler moved out of ingredient list)
  - `consumeRecipe` action — fetches stock entries, computes FIFO fulfillment, consumes all fulfilled non-skipped ingredients with a shared `correlation_id` and `recipe_id` for the stock log
  - `undoConsumeRecipe(correlationId)` — undoes entire recipe cook via shared correlation_id; exposed as 8-second sonner undo toast
  - `addMissingToShoppingList` action — increments existing undone items or inserts new rows for each missing ingredient
  - `computeRecipeFulfillment` pure function in `recipe-utils.ts` — returns per-ingredient and overall fulfillment status
  - `IngredientFulfillment`, `RecipeFulfillmentResult` types in `recipe-utils.ts`
  - `consumeStock` in `stock-actions.ts` now accepts `correlationId?` (shared across recipe cook) and `recipeId?` (written to `stock_log.recipe_id`)
  - `/recipes/[id]` page now fetches stock totals and shopping lists in parallel alongside other data

---

## [0.11.3] - 2026-02-21

### Added
- **Recipes: serving size scaling** (v0.11.3)
  - `ServingScaler` component — stepper (±0.5), direct number input, quick-set ×0.5 / ×1 / ×2 / ×3 buttons relative to base servings; "base: N" hint shown when scaled differs from base
  - All ingredient amounts live-scale as desired servings changes: `amount × (desired / base)`, rounded to 2 decimals, trailing zeros stripped
  - Variable-amount ingredients ("to taste") remain unscaled
  - `desired_servings` persisted to DB on change via `updateRecipe`
  - `scaleAmount(amount, baseServings, desiredServings)` and `formatScaledAmount(scaled)` pure utilities in `src/lib/recipe-utils.ts`
  - Serving scaler only shown when recipe has at least one ingredient

---

## [0.11.2] - 2026-02-21

### Added
- **Recipes: ingredient management** (v0.11.2)
  - `RecipeIngredientsClient` component — full ingredient list with drag-reorder (@dnd-kit), collapsible groups, add/edit/delete with undo
  - Add/edit ingredient dialog: product picker with search, amount, quantity unit selector, `ingredient_group` with `<datalist>` autocomplete, `note`, `variable_amount` (text override for "to taste" etc.), `not_check_stock_fulfillment` and `only_check_single_unit_in_stock` checkboxes
  - Drag-reorder with `PointerSensor` (8 px), `TouchSensor` (250 ms), `KeyboardSensor`; persisted via `reorderIngredients`
  - Ingredient groups: collapsible sections keyed by `ingredient_group`, ungrouped items shown first under "Ingredients"
  - Per-ingredient delete with 8-second sonner undo toast
  - Product selection auto-sets quantity unit from `product.qu_id_stock`
  - `addIngredient`, `updateIngredient`, `removeIngredient`, `undoRemoveIngredient`, `reorderIngredients` actions in `recipe-actions.ts`
  - `/recipes/[id]` page now fetches ingredients (with product + qu joins), active products, and active quantity units via `Promise.all`

---

## [0.11.1] - 2026-02-21

### Added
- **Recipes: CRUD + images** (v0.11.1)
  - `RecipeForm` component — create/edit form with name, description, base servings stepper, and picture upload (reuses `ImageUpload`)
  - `RecipesListClient` component — searchable card grid with optimistic delete + 8-second undo toast
  - `/recipes` list page — fetches recipes with signed picture URLs, renders `RecipesListClient`
  - `/recipes/new` — server page with auth redirect guard
  - `/recipes/[id]` — recipe detail page with picture, name, description, servings
  - `/recipes/[id]/edit` — edit page pre-populating `RecipeForm` with existing data
  - `uploadRecipePicture`, `deleteRecipePicture`, `getRecipePictureSignedUrl` in `storage.ts`
  - `createRecipe`, `updateRecipe`, `deleteRecipe`, `undoDeleteRecipe` in `recipe-actions.ts`

---

## [0.11.0] - 2026-02-21

### Added
- **Recipes: schema + empty page** (v0.11.0)
  - `recipes` table — name, description, picture, base_servings, desired_servings, not_check_shoppinglist, product_id (produces product)
  - `recipe_ingredients` table — product, amount, qu, ingredient_group, variable_amount, sort_order, fulfillment flags
  - `recipe_nestings` table — recipe-as-ingredient with self-nesting guard (CHECK constraint)
  - Full dual-mode RLS on all 3 tables (authenticated owner + anonymous guest household)
  - Indexes on household_id, recipe_id, product_id for each table
  - `Recipe`, `RecipeIngredient`, `RecipeNesting` TypeScript types in `database.ts`
  - `RecipeWithRelations`, `RecipeIngredientWithRelations` joined types
  - Empty `/recipes` page (server component, `bg-hayama`, `max-w-5xl`) with `ChefHat` empty state
  - Recipes nav link (ChefHat icon) in UserMenu dropdown between Shopping Lists and Journal

### Database Migrations
- `013_recipes.sql` — `CREATE TABLE recipes`, `recipe_ingredients`, `recipe_nestings` with full RLS + indexes

---

## [0.10.5] - 2026-02-20

### Added
- **Pantry scanning** — photograph pantry shelves or fridge contents; Ollama Vision AI identifies visible products, estimates quantities, and fuzzy-matches to existing products for review and bulk import to stock
- `POST /api/ai/scan-pantry` — VLM-only API endpoint with pantry-specific prompt and two-pass fallback (if VLM returns thinking text instead of JSON, extracts via text model)
- `PantryScanDialog` component — 3-step capture/process/review dialog with side-by-side image reference, reuses `ReceiptReviewTable` and `bulkCreateStockEntries()`
- Pantry scan button (`ScanEye` icon) in AI chat widget header, alongside existing receipt scan button
- `emptyMessage` prop on `ReceiptReviewTable` — context-sensitive empty state text (defaults to receipt message, pantry scan passes "No products identified in photo.")

---

## [0.10.4] - 2026-02-19

### Fixed
- **Image timeout / slow page loads** — external OFF images now bypass Next.js SSR image proxy (`unoptimized` prop on non-Supabase URLs); removed `images.openfoodfacts.org` from `remotePatterns` — pages no longer block for 2+ minutes when openfoodfacts.org is slow
- **Receipt scanning: side-by-side image view** — receipt image now displayed alongside review table for easier item verification
- **Receipt scanning: unmatched product wizard** — fixed flow for creating new products from unmatched receipt items; dropdowns refresh on return
- **Receipt scanning: auto-fill product defaults** — selecting a matched product auto-fills unit, location, store from product defaults
- **Receipt scanning: manual add/edit** — replaced LLM "refine" with direct add/edit/delete of individual receipt items
- **Barcode scanning reliability** — trim whitespace and control characters from scanned barcodes; use `maybeSingle()` for DB lookup to avoid errors on duplicate entries
- **Quick open label** — changed misleading "Quick open amount ({unit})" to "Quick open amount (entries)" to clarify it controls how many entries are opened, not a unit amount
- **Quick open null guard** — `quick_open_amount ?? 1` fallback prevents opening 0 entries when the field is unset
- **Build: useSearchParams Suspense boundary** — wrapped `AiChatWidget` in `<Suspense>` in root layout to fix static generation error

### Added
- **Edit stock entry: price per-unit/total** — toggle between per-unit and total price when editing stock entries, with unit selector dropdown and conversion factor display
- **Fractional quick consume** — `quick_consume_amount` input now accepts decimals (min 0.01, step 0.5) for sub-unit consumption like 0.5 kg
- **Receipt price unit context** — price input in receipt scanning shows unit suffix (e.g. "/ bottle", "/ kg")

### Changed
- `EditStockEntryModal` — rewritten with per-unit/total price toggle, unit selector, and conversion hints
- `ProductDetailModal` — fetches quantity units and conversions to pass to edit modal
- `ReceiptCaptureDialog` — image preview alongside review table, manual item management
- `ReceiptReviewTable` — inline row editing, add new item button
- `AiChatWidget` — reactive `useSearchParams()` for receipt return flow detection
- `ai-parse-items.ts` — improved JSON extraction with better array/object handling
- `ProductForm` — fractional quick consume constraints, clearer quick open label

---

## [0.10.3] - 2026-02-18

### Fixed
- **Ollama 403 behind Cloudflare Tunnel** — added `User-Agent: FoodWars/1.0` header to all Ollama API calls; Cloudflare Tunnel blocks requests without a User-Agent
- **Error handling for 403 responses** — AI endpoints now return clear error messages when Cloudflare blocks the request, instead of generic parse failures

---

## [0.10.2] - 2026-02-17

### Fixed
- **VLM receipt parsing — two-pass fallback for thinking models** (v0.10.2)
  - Vision models like `qwen3-vl` ignore `think: false` and `format: "json"`, producing chain-of-thought reasoning instead of structured JSON (content field empty, all output in thinking field)
  - Simplified VLM prompt from ~3000 chars to ~300 chars — vision models work better with concise instructions
  - Added two-pass fallback: if VLM response yields 0 items, the raw thinking text is sent through the text model to extract structured JSON
  - Removed `/no_think` text directive from both VLM and OCR prompts (redundant with `think: false` API parameter, may confuse models)
- **OCR receipt parsing — 502 timeout** (v0.10.2)
  - `callOllama` had a hardcoded 55s timeout; receipt parsing with `qwen3:14b` took 56s, triggering an abort error returned as 502
  - Added configurable `timeout` option to `OllamaCallOptions`; receipt parsing now uses 120s timeout for both OCR and VLM second-pass calls

### Added
- **Receipt Scanning — OCR & Vision AI powered bulk stock import** (v0.10.2)
  - `ReceiptCaptureDialog` — full receipt scanning flow: capture image → process → review → import
  - Dual processing modes: "OCR + Text AI" (Tesseract.js WASM → text model) or "Vision AI" (image → Ollama vision model directly)
  - Default to VLM when vision model is configured, with graceful fallback to OCR
  - `POST /api/ai/parse-receipt` — receipt parsing endpoint supporting `ocr`, `vlm`, and `refine` modes
  - Receipt-specific system prompt: understands line items, prices, quantities, store names; ignores totals, tax, payment lines
  - `ReceiptReviewTable` — editable table with per-row checkboxes, matched/unmatched badges, inline editing (product, amount, unit, date, store, price, location)
  - "Select all" header checkbox, item count, "Import selected" bulk button with count
  - Natural language refinement: text input below review table to modify parsed items (e.g. "remove the total row", "change milk to 2 litres") via text model
  - **Unmatched product wizard** — step-by-step flow to resolve products not in the database:
    - Shows each unmatched item with "Scan barcode" and "Skip" buttons
    - Barcode scan → local DB lookup → auto-match if found
    - If barcode not in DB → navigate to `/products/new?barcode=XXX&returnTo=receipt-scan` for full product creation
    - Receipt state persisted in `sessionStorage` for round-trip to product creation page
    - On return: auto-restores receipt review, re-runs fuzzy matching with new product available
    - Progress dots showing wizard position
  - `callOllamaVision()` in `ai-utils.ts` — new function for Ollama `/api/chat` endpoint with base64 image support (90s timeout for vision models)
  - `src/lib/stock-entry-utils.ts` — shared `bulkCreateStockEntries()` and `getStockAmount()` extracted from `StockEntryCard`
  - Purchase-to-stock unit conversion applied during receipt import (product-specific → global fallback)
  - Receipt scan button (Receipt icon) added to AI chat widget header
  - `returnTo` prop support in `ProductForm` — enables post-save redirect back to receipt scanning flow
  - Tesseract.js progress bar during OCR text extraction
  - Image preview with remove button during capture step
  - "Scan another receipt" reset button in review step

### Changed
- `StockEntryCard` — refactored to use shared `bulkCreateStockEntries()` from `stock-entry-utils.ts`; removed inline save logic
- `HouseholdData` type exported from `StockEntryCard` for reuse by `ReceiptReviewTable`
- `AiChatWidget` — tracks `hasVisionModel` from settings; checks `?receiptReturn=1` URL param on mount to restore receipt flow
- `ProductForm` — accepts optional `returnTo` prop; when `returnTo === "receipt-scan"`, redirects to `/?receiptReturn=1` after save instead of conversions page
- `src/app/products/new/page.tsx` — extracts `returnTo` from search params, passes to `ProductForm`

### Dependencies
- Added `tesseract.js` ^7.0.0 — in-browser OCR with WebAssembly

---

## [0.10.1] - 2026-02-17

### Added
- **AI Chat Assistant — Floating widget & natural language stock entry** (v0.10.1)
  - `AiChatWidget` — floating FAB button (bottom-right, z-50) with expandable chat panel (400x500 desktop, fullscreen mobile)
  - General-purpose AI assistant: cooking suggestions from current inventory, expiry advice, inventory questions, and natural language stock entry
  - `POST /api/ai/chat` — general chat endpoint with conversation history, tagged `<stock_entry>` format for mixed text/structured responses
  - `POST /api/ai/parse-stock` — dedicated stock parsing endpoint with forced JSON mode
  - Stock-aware AI context: system prompt includes current stock inventory (amounts, units, expiry dates) fetched from `stock_entries` with product joins
  - Explicit prompt instructions: only suggest meals from items actually in stock, not just the product catalog
  - `src/lib/ai-parse-items.ts` — resilient shared JSON parser with 4 extraction strategies (direct `.items`, raw array, any array in object, markdown code fences)
  - `src/lib/fuzzy-match.ts` — bigram Dice coefficient for matching AI output to existing products, units, stores, locations (exact → includes → bigram overlap)
  - `ChatMessage` — presentational component for user/assistant message bubbles (megumi theme)
  - `StockEntryCard` — inline editable stock entry cards within chat messages (product, amount, unit, date, store, price, location selects with matched/unmatched/added badges)
  - Purchase-to-stock unit conversion in `StockEntryCard` save flow — product-specific conversions first, then global fallback, with price adjustment
  - Suggestion chips on welcome screen: "2 cans of tomatoes, aldi, £1", "What's expiring soon?", "What can I cook?"
  - Clear chat button (Trash2 icon) in header, only shown when messages exist
  - Typing indicator with bouncing dots animation
  - FAB auto-slides above sonner undo toasts via `MutationObserver` tracking (smooth 300ms transition)
  - Self-managing visibility: FAB only renders when AI is configured (checks `/api/ai/settings` on mount)
  - Lazy household data loading (products, locations, units, stores, conversions) on first chat open
  - Conversation context: last 10 messages sent as `User:`/`Assistant:` prefixed history
  - `ParsedStockItem` type added to `database.ts`
  - `AiChatWidget` mounted globally in root `layout.tsx`
  - Guest contact hint on Settings page — "Don't have an Ollama server?" with email, LinkedIn, GitHub links for requesting access or support
  - `isGuest` prop threaded from Settings page to `AiSettingsClient`

### Changed
- `ai-utils.ts` — `callOllama` format parameter made optional (`OllamaCallOptions.format?: "json"`); format only included in request body when explicitly passed
- `sonner.tsx` — Toaster z-index set to 45 via `--z-index` CSS variable so chat widget (z-50) layers above toasts
- `layout.tsx` — added `<AiChatWidget />` after `<Toaster />`
- `settings/page.tsx` — detects guest mode, passes `isGuest` to `AiSettingsClient`
- `AiSettingsClient` — accepts optional `isGuest` prop, renders contact hint block for guests

### Fixed
- **AddStockEntryModal duplicate key error** — recent products filtered from "All products" section in product Select to prevent Radix duplicate `value` props
- **MobileStockList hydration error** — `zeroStockProducts` `<tr>` elements were outside `<tbody>`; wrapped in conditional `<tbody>` to fix `<tr> cannot be child of <table>` DOM nesting violation

---

## [0.10.0] - 2026-02-15

### Added
- **AI Smart Input — Ollama connection & settings** (v0.10.0)
  - `household_ai_settings` table with per-household Ollama URL, text model, vision model (migration 012)
  - Full RLS policies (dual-mode: auth + guest) matching existing table patterns
  - `HouseholdAiSettings` TypeScript type in `database.ts`
  - New `/settings` page with AI configuration form (`AiSettingsClient`)
  - "Test Connection" button — hits Ollama's `/api/tags`, returns available models with size display
  - Text model and vision model selection dropdowns, populated from connected Ollama instance
  - Privacy warning (amber alert box): "Your Ollama URL is stored in our database and AI requests are proxied through our server. For full privacy, self-host Food Wars."
  - Saved model values persist in dropdowns even before re-testing connection
  - API routes:
    - `GET /api/ai/settings` — fetch household AI settings
    - `PUT /api/ai/settings` — upsert AI settings with URL validation
    - `POST /api/ai/test-connection` — test Ollama connectivity, return model list
    - `GET /api/ai/models` — list models from saved Ollama URL
  - `src/lib/ai-utils.ts` shared helpers:
    - `getAiSettings(householdId)` — fetch AI settings from DB
    - `callOllama(ollamaUrl, model, prompt, system)` — POST to Ollama `/api/generate` with JSON mode, 55s timeout
    - `isAiConfigured(settings)` — returns true when both URL and text model are set
    - `fetchOllamaModels(ollamaUrl)` — GET `/api/tags` with 5s timeout
  - "Settings" link with Bot icon added to UserMenu dropdown

### Changed
- `UserMenu` — added "Settings" navigation link (Bot icon, routes to `/settings`)
- `database.ts` — added `HouseholdAiSettings` type
- README — updated roadmap (v0.10 section), project structure, database schema, tech stack, privacy notice, future ideas, comparison table

### Database Migrations
- `012_household_ai_settings.sql` — `CREATE TABLE household_ai_settings` with `ollama_url`, `text_model`, `vision_model`, `UNIQUE(household_id)`, index, full RLS (SELECT/INSERT/UPDATE/DELETE)

---

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