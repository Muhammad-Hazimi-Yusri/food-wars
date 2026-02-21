# Food Wars | 食戟

A free, open-source kitchen inventory and meal planning app — fighting food waste one meal at a time.

**[Live Demo →](https://food-wars.muhammadhazimiyusri.uk)** *(coming soon)*

> *Inspired by the creative cooking spirit of Shokugeki no Soma*

---

[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Version](https://img.shields.io/badge/version-0.11.1-blue.svg)]()
[![Status](https://img.shields.io/badge/status-In%20Development-yellow.svg)]()

<details>
<summary><strong>Table of Contents</strong></summary>

- [Current Features](#current-features)
- [Why Food Wars?](#why-food-wars)
- [Roadmap](#roadmap)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Run Locally](#run-locally)
- [Self-Hosting](#self-hosting)
- [Contributing](#contributing)
- [License](#license)

</details>

## Current Features

Current version is v0.11.1

### For Users
- **Stock Overview** — View all inventory with expiry status badges
- **Responsive Views** — Mobile/desktop tables with Grocy-style quick actions (Consume, Open)
- **Add Products** — 5-tab form (basic, stock defaults, locations, QU conversions, barcodes)
- **Product Pictures** — Upload from camera or gallery (mobile-optimized)
- **Add Stock** — Quick-add entries with location, expiry, price
- **Stock Details** — View and edit individual batches per product
- **Status Warnings** — Clickable expired/overdue/due soon/below minimum alert banners
- **Stock Filters** — Search by name, filter by location, product group, status
- **Master Data** — Manage locations, product groups, quantity units, stores (CRUD + drag reorder)
- **Products List** — Sortable/filterable product table with column options
- **Stock Actions** — Consume, Open, Transfer, and Inventory Correction with FIFO logic
- **Quick Actions** — One-tap Consume/Open buttons using product defaults
- **Undo Toasts** — Every destructive action is reversible with an 8-second undo window
- **Stock Journal** — Full transaction history with filters, pagination, and summary view
- **Shopping Lists** — Create lists, add product-linked or freeform items, group by aisle/store, drag-and-drop reorder
- **Purchase from List** — Check off items to auto-add to stock with unit conversion and product defaults
- **Auto-Generate Lists** — One-click buttons for below-min-stock, expired, and overdue products
- **Auto-Add to List** — Consuming below min stock auto-adds to designated shopping list
- **Freezer Intelligence** — Auto-adjusts due dates on freeze/thaw, warns for freeze-sensitive products
- **Authentication** — Google Sign-in with household isolation + guest mode with demo data
- **Brand Tracking** — Auto-detect brand from OFF, store-brand detection for UK supermarkets
- **Nutrition Facts** — EU Big 8 per-100g nutrition label, auto-populated from Open Food Facts
- **Nutri-Score Badge** — Color-coded A–E grade display from OFF data
- **Enhanced OFF Integration** — Expanded fields: brands, nutriments, nutrition grades, categories, ingredients, stores
- **OFF Image Persistence** — Product images downloaded from OFF to Supabase storage for reliable display
- **Refetch from OFF** — Re-fetch product data (image, brand, nutrition) from Open Food Facts on demand
- **AI Smart Input (Ollama)** — Connect your self-hosted Ollama instance for AI-powered stock entry
- **AI Chat Assistant** — Floating chat widget with natural language stock entry, cooking suggestions from current inventory, and expiry advice
- **AI Settings Page** — Configure Ollama URL, test connection, select text and vision models per household
- **Guest Contact Hint** — Settings page shows contact info for guests to request Ollama server access
- **Privacy Warning** — Prominent notice that AI requests are proxied through the server; self-host for full privacy
- **Receipt Scanning** — Photograph a receipt, extract items via OCR (Tesseract.js) or Vision AI (Ollama VLM), review in editable table, and bulk-import to stock
- **Dual OCR/VLM Mode** — Choose between traditional OCR + text AI parsing or direct vision model image analysis, with automatic two-pass fallback for thinking models
- **Receipt Item Editing** — Add, edit, and delete individual receipt items with inline controls; auto-fill product defaults on match
- **Unmatched Product Wizard** — Step through unmatched receipt items, scan barcodes, create new products, and auto-match back
- **Pantry Scanning** — Photograph pantry shelves or fridge contents, Vision AI identifies products and estimates quantities, review and bulk-import to stock
- **Edit Stock Entry Pricing** — Per-unit or total price toggle with unit selector and conversion factor display when editing stock entries
- **Fractional Quick Consume** — Quick consume supports decimal amounts (e.g. 0.5 kg) for sub-unit consumption

### For Contributors
- **Documentation** — README, BRANDING.md, CONTRIBUTING.md, CHANGELOG.md
- **Database Schema** — Grocy-compatible with 40+ product fields, full RLS, nutrition table, AI settings
- **Design System** — Shokugeki color palette, Japanese diner aesthetic
- **Testing** — Vitest unit tests + Playwright E2E
- **CI/CD** — GitHub Actions, Vercel deployment
- **Tooling:** `pnpm version:bump`, pre-commit hooks

### Technical Highlights
- **Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase
- **Auth:** Google OAuth + guest mode (Supabase anonymous auth)
- **AI:** Self-hosted Ollama integration with floating chat assistant (optional, proxied via API routes)
- **Icons:** Lucide
- **Theming:** Japanese mom & pop diner aesthetic (食堂)

---

## Why Food Wars?

> **Acknowledgment:** This project adapts [Grocy's](https://grocy.info) database schema and feature set. Grocy is the gold standard for self-hosted household management — Food Wars is my learning project to understand its architecture while building something accessible for less technical users.

### Background

Grocy is excellent but requires technical setup:
- Self-hosted PHP/SQLite server
- Docker knowledge for easy deployment  
- [grocy-desktop](https://github.com/grocy/grocy-desktop) exists but still needs a webserver for mobile sync

Food Wars targets a different audience: people who want Grocy-like features without managing infrastructure.

### Comparison

| | Grocy | Mealie | Tandoor | **Food Wars** |
|--|-------|--------|---------|---------------|
| **Focus** | Full household ERP | Recipe management | Recipe management | Pantry + waste reduction |
| **Hosting** | Self-host (PHP/SQLite) | Self-host (Python) | Self-host (Django) | Hosted or self-host |
| **Setup** | Docker required | Docker required | Docker required | Sign in (hosted) or Vercel + Supabase (self-host) |
| **Maturity** | Battle-tested since 2017 | Established | Established | Early development |
| **Barcode scanning** | ✅ | ❌ | ❌ | ✅ v0.8 (camera + OFF lookup) |
| **Nutrition facts** | ❌ | ✅ (recipe-level) | ✅ (recipe-level) | ✅ v0.9 (per-product, OFF auto-fill, Nutri-Score) |
| **AI input** | ❌ | ❌ | ❌ | ✅ v0.10 (self-hosted Ollama, NLP stock entry) |
| **Offline support** | ✅ Full | ✅ Full | ✅ Full | ❌ Online only |
| **Multi-user** | ✅ | ✅ | ✅ | 🔜 Planned |
| **Chores/Tasks** | ✅ | ❌ | ❌ | ❌ Not planned |
| **Mobile app** | PWA requiring webserver | Via webserver | Via webserver | Responsive web (PWA) via Vercel hosting |

### Our Niche

- **For less technical users** — No homelab, Docker, or server management required
- **Mobile-first** — Responsive design as primary target (you're in the kitchen, not at a desk)
- **Hosted option** — Just sign in at [food-wars.muhammadhazimiyusri.uk](https://food-wars.muhammadhazimiyusri.uk)
- **Self-host option** — Fork and deploy to Vercel + Supabase free tiers (see [Self-Hosting](#self-hosting))
- **Learning in public** — Built with Claude AI to learn from Grocy's architecture

### Privacy Notice

**Hosted version:** Your data is stored in the developer's Supabase database. While secured with Row Level Security (you can only access your own household's data), if you prefer full data ownership, please use the self-hosting option.

**Self-hosted:** Your data stays in your own Supabase project. See [Self-Hosting](#self-hosting) for setup instructions.

**AI features (Ollama):** If you connect an Ollama instance on the hosted version, your Ollama URL is stored in our database and AI requests are proxied through our server. For full privacy, self-host Food Wars.

---

## Roadmap

> See [CHANGELOG.md](CHANGELOG.md) for detailed version history.
> Feature set adapted from [Grocy](https://grocy.info) — ported for zero-config cloud deployment.

### Completed

<details>
<summary><strong>v0.2 - Project Foundation ✓</strong></summary>

**Goal:** Scaffolding and basic auth

- [x] Next.js 14 App Router with TypeScript
- [x] Tailwind CSS 4 with custom theme
- [x] Shokugeki color palette & Japanese fonts
- [x] shadcn/ui component library
- [x] Noren header component
- [x] Guest mode with localStorage
- [x] Supabase setup with Google OAuth
- [x] Testing (Vitest + Playwright)
- [x] GitHub Actions CI pipeline
- [x] Custom domain deployment
</details>

<details>
<summary><strong>v0.3 - Basic Inventory ✓</strong></summary>

**Goal:** Simple CRUD to validate the stack

- [x] Database: `households`, `inventory_items` tables
- [x] Row Level Security policies
- [x] Auto-create household on signup
- [x] Welcome modal with sign-in/guest options
- [x] UserMenu dropdown with Google avatar
- [x] Add/edit/delete items (name, quantity, unit, category, expiry)
- [x] WoodCard component with expiry badges
- [x] Responsive grid layout
- [x] Dual storage: Supabase (auth) + localStorage (guest)
</details>

<details>
<summary><strong>v0.4 - Schema & Stock Views ✓</strong></summary>

**Goal:** Complete Grocy-compatible database schema + stock UI

**Database schema:** (`supabase/migrations/001_core_schema.sql`)
- [x] `households` — multi-tenant container
- [x] `locations` — storage locations with `is_freezer` flag
- [x] `shopping_locations` — stores
- [x] `product_groups` — categories
- [x] `quantity_units` — units with plural names
- [x] `quantity_unit_conversions` — global and product-specific
- [x] `products` — complete Grocy fields (40+ columns)
- [x] `product_barcodes` — multiple barcodes per product
- [x] `stock_entries` — individual batches with Grocycode support
- [x] `stock_log` — transaction history (UI in v0.6)
- [x] Auto-seed default data on user signup

**Stock UI:**
- [x] `ProductForm` with 5-tab layout + picture upload
- [x] `AddStockEntryModal` for quick stock entry
- [x] `MobileStockList` — card layout for mobile
- [x] `DesktopStockTable` — table with expandable batches
- [x] `ProductDetailModal` — view/delete stock entries
- [x] `InventoryStats` + `InventoryWarnings` components
- [x] Stock aggregation by product
- [x] Supabase Storage for product pictures

**Breaking changes:**
- Database schema restructured (clean slate from v0.3)
- Guest mode temporarily disabled
</details>

<details>
<summary><strong>v0.5 - Guest Mode & Filtering ✓</strong></summary>

**Goal:** Demo-friendly guest mode + filtering UI + master data CRUD

**Guest mode (Supabase anonymous auth):**
- [x] Shared guest household (single anon account for all guests)
- [x] Auto sign-in as guest when "Try as Guest" clicked
- [x] Banner: "Guest mode — data shared and may reset anytime"
- [x] Admin endpoint `/api/admin/reset-guest` to wipe and re-seed
- [x] Seed data with varied test scenarios (edge cases for expiry, locations, etc.)

**Stock overview filters:**
- [x] Search input (filter by product name)
- [x] Location dropdown filter
- [x] Product group dropdown filter
- [x] Status dropdown filter (All, Due soon, Overdue, Expired, Below min stock, In stock)
- [x] Clear all filters button
- [x] Mobile: collapsible filter panel with toggle button

**Clickable warning banners (Grocy-style):**
- [x] Red: "X products are expired" (due_type=2, past date)
- [x] Gray: "X products are overdue" (due_type=1, past date)  
- [x] Amber: "X products are due within the next 5 days"
- [x] Teal: "X products are below defined min. stock amount"

**Summary stats:**
- [x] Total products count
- [x] Total stock entries count
- [x] Total stock value (sum of price × amount)

**Edit stock entries:**
- [x] Edit button in ProductDetailModal
- [x] Edit amount, location, expiry, price, note, opened status

**Master data management:** (`/master-data/*`)
- [x] Locations page — CRUD (name, description, is_freezer, sort_order)
- [x] Quantity units page — CRUD (name, name_plural, description, sort_order)
- [x] Product groups page — CRUD (name, description, sort_order)
- [x] Shopping locations page — CRUD (name, description, sort_order)
- [x] Soft delete support (`active` flag toggle)
- [x] Drag-and-drop reordering (sort_order)

**Products page:** (`/master-data/products`)
- [x] Products list with filters (search, product group, status)
- [x] Show: image, name, location, min stock, QU stock, QU purchase, product group, default store
- [x] Table options: show/hide columns, group by
- [x] Sortable columns (click header to sort asc/desc)
- [x] Edit/Delete/Toggle active actions
- [x] Mobile-responsive card layout
- [x] Add product page (full Grocy fields):
  - [x] Basic: name, description, active, picture, parent product
  - [x] Locations: default location, default consume location, move on open, default store
  - [x] Stock: min stock amount, accumulate sub products, treat opened as out of stock
  - [x] Due dates: due type (best before/expiration), default due days, after opened, after freezing, after thawing, should not be frozen
  - [x] Units: QU stock, QU purchase, tare weight handling
  - [x] Misc: energy (kcal), quick consume/open amounts, stock entry label, auto reprint label
- [x] Edit product page
- [x] Product-specific quantity unit conversions page

**Testing:**
- [x] Unit tests for `inventory-utils.ts`
- [x] Unit tests for stock aggregation logic
- [x] Unit tests for expiry status calculations
- [x] E2E tests for guest mode flow

**Code quality:**
- [x] Code coverage reporting (vitest --coverage)
- [x] Unused code detection (knip)
- [x] Dependency graph visualization (madge)
- [x] Consolidated constants (GUEST_HOUSEHOLD_ID)
- [x] Delete product pictures when deleting products
</details>

<details>
<summary><strong>v0.6 - Stock Actions & Journal ✓</strong></summary>
**Goal:** Consume vs Open distinction + transaction logging

> Schema ready: `stock_log` table with `stock_transaction_type` enum already in place

**Consume action:**
- [x] Partial consume (reduce quantity)
- [x] Mark as spoiled option (waste tracking)
- [x] Consume rule: opened first → due soonest → FIFO
- [x] Consume from specific location
- [x] Quick consume button (uses `quick_consume_amount`)
- [x] Log to `stock_log` with `transaction_type = 'consume'`

**Open action:**
- [x] Mark stock entry as opened
- [x] Set `opened_date`
- [x] Recalculate due date using `default_due_days_after_open`
- [x] New due date never extends original
- [x] Quick open button (uses `quick_open_amount`)
- [x] Optional: auto-move to `default_consume_location_id` if `move_on_open` is true
- [x] Log to `stock_log` with `transaction_type = 'product-opened'`

**Transfer action:**
- [x] Move stock between locations
- [x] Freezer detection: apply `default_due_days_after_freezing`
- [x] Thaw detection: apply `default_due_days_after_thawing`
- [x] Warn if `should_not_be_frozen` product moved to freezer
- [x] Log to `stock_log` with `transaction_type = 'transfer-from'` and `'transfer-to'`

**Inventory correction:**
- [x] Adjust stock amount directly
- [x] Log to `stock_log` with `transaction_type = 'inventory-correction'`

**Journal UI:**
- [x] Stock journal page with filters (product, type, date range)
- [x] Undo recent transactions (sets `undone = true`, `undone_timestamp`)
- [x] Pagination for journal entries (page size selector, prev/next, page X of Y)
- [x] Journal summary view (aggregated by product/type)
- [x] Uses `correlation_id` to group related transactions
</details>

<details>
<summary><strong>v0.7 - Shopping Lists ✓</strong></summary>

**Goal:** Manual and auto-generated shopping lists

**Core features:**
- [x] Multiple shopping lists (create, edit, delete)
- [x] Add product-linked items (inherit name, unit)
- [x] Add freeform items (just text + amount)
- [x] Checkbox to mark done
- [x] Group by product group (aisle optimization)
- [x] Group by store (`shopping_location_id`)
- [x] Drag-and-drop reordering
- [x] Progress bar (% items done)

**Inventory integration:**
- [x] "Add to stock" from shopping list item (purchase workflow)
- [x] Pre-fills stock entry with product defaults, amount, unit
- [x] Auto-remove from list when added to stock
- [x] Amount increments if product already on list (deduplication)
- [x] Auto-add to designated list when stock consumed below min

**Auto-generation:**
- [x] "Add all below min stock" button
- [x] "Add all expired" button
- [x] "Add all overdue" button
- [x] Auto-target list setting (`is_auto_target` flag)
- [x] Calculates missing amount: `min_stock - current_stock`
</details>

<details>
<summary><strong>v0.8 - Barcodes & Smart Input ✓</strong></summary>

**Goal:** Fast, error-free product entry via barcode scanning and smart defaults

**Barcode scanning (v0.8.0):**
- [x] `BarcodeScanner` reusable component with live camera feed (react-zxing)
- [x] Supports 1D (Code128, EAN-8, EAN-13, UPC-A) and 2D (QR, DataMatrix)
- [x] Barcode CRUD on product conversions page (add/edit/delete via `product_barcodes` table)
- [x] Camera scan or manual text entry for barcodes
- [x] Barcode icon on product picker fields across the app
- [x] Scan auto-fills: product, amount, unit, store from barcode metadata

**Open Food Facts integration (v0.8.1):**
- [x] Lookup unknown barcode via OFF API (`world.openfoodfacts.org`)
- [x] Auto-fill: product name, image, barcode
- [x] Opens product form pre-populated for user to complete
- [x] `/products/new?barcode=XXX` route for pre-filled product creation

**Scan-to-add-stock workflow (v0.8.2):**
- [x] Scan button on stock overview page
- [x] Known barcode: open AddStockEntryModal pre-filled with product + barcode defaults
- [x] Unknown barcode: OFF lookup, quick-create product, then add stock

**Shopping list scan workflow (v0.8.3):**
- [x] Floating scan button on shopping list detail page
- [x] Scan product on list: purchase and add to stock
- [x] Scan product not on list: add to list then purchase
- [x] Scan unknown barcode: OFF lookup, create product, add to list
- [x] Continuous scanning mode (scanner stays open between scans)

**Input productivity (v0.8.4):**
- [x] Date field shorthands (e.g., `0517` → `2025-05-17`, `+1m` → next month, `x` → never expires)
- [x] Recently used products list in product selectors
- [x] Manual barcode entry fallback for camera-less devices
- [x] Haptic feedback on successful scan
</details>

<details>
<summary><strong>v0.9 - Enhanced OFF & Product Data ✓</strong></summary>

**Goal:** Maximise Open Food Facts data, add brand tracking, nutrition facts, and store-brand detection

**Enhanced OFF integration (v0.9.0):**
- [x] Fix broken product image fetching from OFF (added `images.openfoodfacts.org` to Next.js `remotePatterns`)
- [x] Persist OFF images to Supabase storage (download on product save)
- [x] Expand OFF fields fetched: `brands`, `nutriments`, `nutrition_grades`, `categories`, `ingredients_text`, `stores`
- [x] Add `?fields=` parameter to OFF API for efficient requests
- [x] Auto-populate brand from OFF response

**Brand & store-brand detection (v0.9.1):**
- [x] Add `brand` and `is_store_brand` fields to products schema (migration 010)
- [x] Store-brand mapping config for 15+ UK supermarket brands
- [x] Auto-detect store brands (Aldi, Tesco, Sainsbury's, M&S, etc.) from OFF data
- [x] Suggest matching shopping location via toast action
- [x] Brand input field and store-brand toggle on product form

**Nutrition facts (v0.9.2):**
- [x] `product_nutrition` table with EU Big 8 per-100g values (migration 011)
- [x] Auto-populate nutrition from OFF `nutriments` on product creation
- [x] `NutritionLabel` component — EU-style nutrition facts table
- [x] `NutriScoreBadge` component — color-coded A–E grade pill
- [x] Nutrition display on product detail modal
- [x] Manual nutrition entry form (new "Nutrition" tab on product form)
- [x] Nutri-Score badge on product detail modal header

**Bug fixes & refetch (v0.9.3):**
- [x] Fix OFF product images not persisting after save (server-side download)
- [x] Fix empty nutrition data from OFF reported as valid (all-null guard)
- [x] Fix below-min-stock filter hiding products with zero stock entries
- [x] "Refetch from OFF" button on product detail modal (image, brand, nutrition)
</details>

<details>
<summary><strong>v0.10 - AI Smart Input (Ollama) — In Progress</strong></summary>

**Goal:** AI-powered input — Ollama connection, natural language stock entry, receipt scanning

**Ollama connection & settings (v0.10.0):** ✓
- [x] `household_ai_settings` table with per-household Ollama URL, text model, vision model (migration 012)
- [x] Full RLS policies (dual-mode: auth + guest) matching existing table patterns
- [x] Settings page (`/settings`) with AI configuration form
- [x] "Test Connection" button — hits Ollama's `/api/tags`, returns available models
- [x] Text model and vision model selection from available models
- [x] Privacy warning: "Your Ollama URL is stored in our database and AI requests are proxied through our server. For full privacy, self-host Food Wars."
- [x] Graceful degradation: AI features hidden/disabled when no Ollama configured
- [x] "Settings" link with Bot icon added to UserMenu dropdown
- [x] API routes: `GET/PUT /api/ai/settings`, `POST /api/ai/test-connection`, `GET /api/ai/models`
- [x] `ai-utils.ts`: `getAiSettings()`, `callOllama()`, `isAiConfigured()`, `fetchOllamaModels()`
- [x] `HouseholdAiSettings` TypeScript type in `database.ts`

**AI Chat Assistant & Natural Language Stock Entry (v0.10.1):** ✓
- [x] Floating AI chat widget (`AiChatWidget`) — FAB button (bottom-right), opens 400x500 desktop / fullscreen mobile panel
- [x] General-purpose AI assistant — cooking suggestions, expiry advice, inventory questions, and stock entry
- [x] Natural language stock entry — user types e.g. "2 cans of tomatoes, aldi, £1" and AI parses into structured items
- [x] Tagged response format — AI responds in plain text, wraps stock entries in `<stock_entry>` XML tags for mixed text/structured output
- [x] Resilient JSON parser (`ai-parse-items.ts`) — 4 extraction strategies: direct `.items`, raw array, any array value, markdown code fences
- [x] Fuzzy matching (`fuzzy-match.ts`) — bigram Dice coefficient to match AI output to existing products, units, stores, locations
- [x] Inline editable stock entry cards (`StockEntryCard`) — product select, amount, unit, date, store, price, location with matched/unmatched badges
- [x] Purchase-to-stock unit conversion in AI save flow — product-specific conversions first, then global fallback
- [x] Stock-aware AI context — system prompt includes current stock inventory (amounts, units, expiry dates) for accurate cooking and expiry answers
- [x] Conversation history — last 10 messages sent as context for multi-turn dialogue
- [x] Suggestion chips on welcome screen: "2 cans of tomatoes, aldi, £1", "What's expiring soon?", "What can I cook?"
- [x] Clear chat button (trash icon) in header
- [x] Typing indicator with bouncing dots
- [x] FAB auto-slides above sonner undo toasts via MutationObserver tracking
- [x] Guest contact hint on Settings page — email, LinkedIn, GitHub links for Ollama server access
- [x] API routes: `POST /api/ai/parse-stock` (JSON mode), `POST /api/ai/chat` (natural language mode)
- [x] Self-managing visibility — FAB only shown when AI is configured (checks `/api/ai/settings` on mount)

**Receipt scanning (v0.10.2):** ✓
- [x] Camera capture or photo upload of receipt image
- [x] Tesseract.js runs OCR in-browser (WASM, no server needed)
- [x] Extracted text sent to Ollama text model via `/api/ai/parse-receipt`
- [x] Dual mode: OCR + text AI or Vision AI (Ollama VLM) for direct image analysis
- [x] Table of parsed items with checkboxes, each row editable (product, amount, unit, date, store, price, location)
- [x] Auto-match to existing products, "Import selected" bulk-creates stock entries with purchase-to-stock conversion
- [x] Natural language refinement of parsed items (e.g. "remove the total row")
- [x] Unmatched product wizard: scan barcode → create product → auto-match back to receipt

**Bug fixes & UX polish (v0.10.3):** ✓
- [x] User-Agent header on all Ollama calls (fixes 403 behind Cloudflare Tunnel)

**Receipt improvements, image fix & stock editing (v0.10.4):** ✓
- [x] Receipt scanning: side-by-side image view, manual add/edit/delete, auto-fill product defaults, wizard fix
- [x] Barcode scanning: trim whitespace/control chars, `maybeSingle()` lookup
- [x] Image timeout fix: bypass Next.js SSR proxy for external OFF images (was blocking pages 2+ min)
- [x] Edit stock entry: per-unit/total price toggle with unit selector and conversion support
- [x] Fractional quick consume: `quick_consume_amount` accepts decimals (min 0.01, step 0.5)
- [x] Quick open label clarified: "entries" instead of misleading unit name
- [x] Receipt price input shows unit suffix (e.g. "/ bottle")

**Pantry scanning (v0.10.5):** ✓
- [x] Photograph pantry shelves or fridge contents for visual product identification via Ollama VLM
- [x] `POST /api/ai/scan-pantry` — VLM-only endpoint with pantry-specific prompt, two-pass fallback
- [x] `PantryScanDialog` — 3-step dialog (capture → processing → review) with side-by-side image + review table
- [x] Pantry scan button (ScanEye icon) in AI chat widget header
- [x] Reuses `ReceiptReviewTable` (with new `emptyMessage` prop), `bulkCreateStockEntries()`, fuzzy matching
- [x] VLM prompt tuned for visual product recognition, quantity estimation, and uncertainty notes
</details>

---

### In Progress

#### v0.11 - Recipes (was v1.1)

**Goal:** Recipe database with inventory integration

**v0.11.0 — Schema + empty page:** ✓
- [x] `recipes` table with RLS (migration 013)
- [x] `recipe_ingredients` table with RLS
- [x] `recipe_nestings` table with RLS (CHECK: no self-nesting)
- [x] `Recipe`, `RecipeIngredient`, `RecipeNesting`, joined types in `database.ts`
- [x] Empty `/recipes` page (server component)
- [x] Recipes nav link (ChefHat icon) in UserMenu

**v0.11.1 — Recipe CRUD:** ✓
- [x] Create/edit recipe form (name, description, servings, picture)
- [x] Recipe list with search/filter and card grid
- [x] Delete with undo toast (sonner)
- [x] Recipe images via `recipe-pictures` Supabase Storage bucket
- [x] `/recipes/new`, `/recipes/[id]`, `/recipes/[id]/edit` pages

**v0.11.2 — Recipe ingredients:**
- [ ] Add/edit/remove ingredients, drag-reorder (@dnd-kit)
- [ ] Ingredient groups (collapsible sections by `ingredient_group`)
- [ ] Product picker with search, quantity unit selector
- [ ] `variable_amount` support ("to taste", "a pinch")

**v0.11.3 — Serving size scaling:**
- [ ] `desired_servings` input with stepper and quick-set buttons
- [ ] Live-scaled ingredient amounts: `amount * (desired / base)`

**v0.11.4 — Stock fulfillment:**
- [ ] "Can I make this?" badge per recipe and per ingredient
- [ ] Per-ingredient: needed vs. in-stock vs. missing amounts
- [ ] "Add missing to shopping list" button
- [ ] "Consume recipe" action — deducts all ingredients from stock with undo

**v0.11.5 — Nesting + produces product:**
- [ ] Recipe as ingredient (recipe_nestings table)
- [ ] "Produces product" — recipe outputs a product on consume
- [ ] Due score: calculated from expiring ingredients, sortable

**Schema added:**
```sql
-- Recipes
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT, -- Rich text instructions
  picture_file_name TEXT,
  base_servings DECIMAL NOT NULL DEFAULT 1,
  desired_servings DECIMAL NOT NULL DEFAULT 1,
  not_check_shoppinglist BOOLEAN NOT NULL DEFAULT FALSE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- "Produces product"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipe ingredients
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  amount DECIMAL NOT NULL DEFAULT 1,
  qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  note TEXT, -- Prep notes (e.g., "diced", "room temp")
  ingredient_group TEXT, -- Section header (e.g., "For the sauce")
  variable_amount TEXT, -- Text instead of number (e.g., "to taste")
  only_check_single_unit_in_stock BOOLEAN NOT NULL DEFAULT FALSE,
  not_check_stock_fulfillment BOOLEAN NOT NULL DEFAULT FALSE,
  price_factor DECIMAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipe nestings (recipe as ingredient)
CREATE TABLE recipe_nestings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  includes_recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  servings DECIMAL NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Core features:**
- [ ] Recipe CRUD with rich text instructions
- [ ] Ingredient groups (collapsible sections)
- [ ] Serving size scaling (auto-calculates amounts)
- [ ] Recipe images (Supabase Storage: `recipe-pictures` bucket)
- [ ] Recipe nesting (recipe as ingredient)

**Inventory integration:**
- [ ] "Can I make this?" — stock fulfillment check
- [ ] Green/red indicator per ingredient
- [ ] Shows: needed amount, in stock, missing
- [ ] "Add missing to shopping list" button
- [ ] "Consume recipe" — deducts all ingredients
- [ ] Respects `not_check_stock_fulfillment_for_recipes` product flag

**Due Score:**
- [ ] Calculated score based on expiring ingredients
- [ ] Higher = more ingredients due soon/overdue/expired
- [ ] Sort recipes by due score
- [ ] Helps reduce food waste

**Produces product:**
- [ ] Recipe can output a product (e.g., Bread recipe → Bread product)
- [ ] On consume, adds produced product to stock
- [ ] Useful for batch cooking, meal prep

#### v0.12 - Meal Planning (was v1.2)

**Goal:** Calendar-based meal organization

**Schema to add:**
```sql
-- Meal plan sections
CREATE TABLE meal_plan_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Breakfast, Lunch, Dinner
  sort_order INTEGER NOT NULL DEFAULT 0,
  time TIME, -- Optional time for calendar export
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal plan entries
CREATE TABLE meal_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recipe', 'product', 'note')),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_servings DECIMAL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  product_amount DECIMAL,
  product_qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  note TEXT,
  section_id UUID REFERENCES meal_plan_sections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Calendar UI:**
- [ ] Week view (desktop primary)
- [ ] Day view (mobile primary)
- [ ] Drag-and-drop meal assignment
- [ ] Copy day / copy week
- [ ] Meal plan sections (Breakfast, Lunch, Dinner)

**Recipe integration:**
- [ ] Add recipe to meal plan
- [ ] Adjust servings per meal
- [ ] Show recipe fulfillment status on calendar
- [ ] "What's for dinner?" — today's meals view

**Shopping integration:**
- [ ] "Generate shopping list for week"
- [ ] Aggregates all recipe ingredients
- [ ] Subtracts current stock
- [ ] Groups by store preference

**Nutritional overview:**
- [ ] Daily/weekly calorie totals
- [ ] Based on `product_nutrition` table (energy_kcal per 100g)
- [ ] Visual charts

#### v0.13 - Product Analytics (was v1.3)

**Goal:** Rich insights per product

**Product detail modal:**
- [ ] Stock amount (total + per location)
- [ ] Stock value (amount × last price)
- [ ] Amount opened
- [ ] Default location display

**Purchase history:**
- [ ] Last purchased date
- [ ] Last price paid
- [ ] Average price (all time)
- [ ] Price history chart (by store, over time)

**Consumption analytics:**
- [ ] Last used/consumed date
- [ ] Average shelf life (calculated from history)
- [ ] Spoil rate (% marked spoiled vs normal consume)

**Quick links from modal:**
- [ ] View stock entries (filtered)
- [ ] View stock journal (filtered)
- [ ] Purchase this product
- [ ] Edit product

**Reports pages:**
- [ ] Waste report (spoiled items over time, by product group)
- [ ] Spending report (by product group, by store, over time)
- [ ] Stock value report (total inventory value)
- [ ] Expiring soon report (printable)

#### v0.14 - Grocycode & Label Printing (was v1.4)

**Goal:** Internal barcodes for stock tracking and label generation

**Grocycode (internal barcodes):**
- [ ] Format: `grcy:p:{product_id}` or `grcy:s:{stock_id}`
- [ ] Generate printable DataMatrix/Code128 codes
- [ ] Scan to quick-consume or quick-open
- [ ] Print labels (webhook or browser print)

**Label printing:** (uses `default_stock_label_type` and `auto_reprint_stock_label` fields)
- [ ] Print Grocycode labels for products
- [ ] Print Grocycode labels for stock entries
- [ ] Auto-print on purchase if enabled

#### v1.0 - Official Release & PWA (was v1.5)

**Goal:** Production-ready release

**Progressive Web App:**
- [ ] Web manifest
- [ ] Service worker (caching, not offline-first)
- [ ] Install prompt
- [ ] Mobile-optimized touch interactions
- [ ] Home screen icon

**Feature flags:**
- [ ] `FEATURE_FLAG_STOCK` — master toggle
- [ ] `FEATURE_FLAG_SHOPPINGLIST` — shopping lists
- [ ] `FEATURE_FLAG_RECIPES` — recipes
- [ ] `FEATURE_FLAG_RECIPES_MEALPLAN` — meal planning
- [ ] `FEATURE_FLAG_STOCK_PRICE_TRACKING` — price features
- [ ] `FEATURE_FLAG_STOCK_LOCATION_TRACKING` — location features
- [ ] `FEATURE_FLAG_STOCK_BEST_BEFORE_DATE_TRACKING` — due date features
- [ ] `FEATURE_FLAG_STOCK_PRODUCT_OPENED_TRACKING` — open/close tracking
- [ ] User settings to hide unused features

**Dark mode:**
- [ ] Auto-detect system preference
- [ ] Manual toggle
- [ ] Persist preference

**Accessibility:**
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Focus indicators
- [ ] ARIA labels

**Performance:**
- [ ] Lazy loading for images
- [ ] Pagination for large lists
- [ ] Optimistic UI updates

---

### Future Ideas

> Post-v1.0 features, no timeline commitment.

**Advanced product features:**
- [ ] Parent/child products (product hierarchies)
- [ ] `no_own_stock` — parent products as summary views
- [ ] `cumulate_min_stock_amount_of_sub_products`
- [ ] Tare weight handling (for containers)
- [ ] Custom fields (userfields) per entity

**Household sharing:**
- [ ] Invite links for household members
- [ ] Role-based permissions
- [ ] Activity feed

**Integrations:**
- [ ] Grocery delivery APIs (Tesco, Instacart)
- [ ] Label printer support (Grocycode printing)
- [ ] Calendar sync (Google Calendar, Apple Calendar)

**AI features:**
- [ ] Smart expiry predictions based on history
- [ ] Recipe suggestions from current stock
- [ ] Chalkboard component for AI suggestions
- [ ] User-provided API keys (OpenAI, Anthropic, etc.)
- [ ] On-device mobile inference option
- [ ] Tool calling framework with Zod schema validation
- [ ] Unified AI provider abstraction (cloud / self-hosted / on-device)

**Other:**
- [ ] Multi-language support (i18n)
- [ ] Voice input for hands-free use
- [ ] Nutrition tracking & reports
- [ ] Budget tracking & alerts
- [ ] Import/export data (JSON, CSV)
- [ ] Grocy migration tool

---

### Design Philosophy

> Inspired by [Grocy](https://grocy.info) — ported for modern cloud deployment.

1. **Cloud-first** — No Docker, no server management. Sign in and go.
2. **Progressive complexity** — Start simple, enable features as needed.
3. **Waste reduction focus** — Expiry tracking is core, not an afterthought.
4. **Cozy aesthetic** — Software you enjoy using, not just tolerate.

Already happy with Grocy/Mealie/Tandoor? Stick with them — they're battle-tested and feature-complete. Food Wars is for those who want something simpler to deploy.

## Tech Stack

- [Next.js 14](https://nextjs.org) — React framework (App Router)
- [TypeScript](https://typescriptlang.org) — Type safety
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com) — Accessible components
- [Supabase](https://supabase.com) — Auth & PostgreSQL database
- [react-zxing](https://github.com/nicoleahmed/react-zxing) — Barcode scanning (camera)
- [Ollama](https://ollama.com) — Self-hosted AI (optional, user-provided)
- [Lucide](https://lucide.dev) — Icons
- [Vercel](https://vercel.com) — Hosting

---

## Project Structure
```
food-wars/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI pipeline
├── .husky/
│   └── pre-commit                 # Pre-commit hooks (lint, version check)
├── e2e/
│   ├── home.spec.ts               # Home page E2E test
│   ├── guest-mode.spec.ts         # Guest mode flow E2E tests
│   └── product-crud.spec.ts       # Product CRUD E2E tests
├── public/                        # Static assets
├── scripts/
│   └── bump-version.mjs           # Interactive version updater
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx           # Admin page (reset guest data)
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   └── reset-guest/
│   │   │   │       └── route.ts   # POST endpoint to reset guest data
│   │   │   ├── ai/
│   │   │   │   ├── chat/
│   │   │   │   │   └── route.ts   # POST general AI chat (natural language + stock entry)
│   │   │   │   ├── models/
│   │   │   │   │   └── route.ts   # GET available Ollama models
│   │   │   │   ├── parse-receipt/
│   │   │   │   │   └── route.ts   # POST receipt scanning (OCR/VLM/refine modes)
│   │   │   │   ├── parse-stock/
│   │   │   │   │   └── route.ts   # POST parse natural language into stock items (JSON mode)
│   │   │   │   ├── scan-pantry/
│   │   │   │   │   └── route.ts   # POST pantry scanning (VLM visual product identification)
│   │   │   │   ├── settings/
│   │   │   │   │   └── route.ts   # GET/PUT household AI settings
│   │   │   │   └── test-connection/
│   │   │   │       └── route.ts   # POST test Ollama connectivity
│   │   │   └── test-supabase/
│   │   │       └── route.ts       # Supabase connection test endpoint
│   │   ├── auth/
│   │   │   ├── callback/
│   │   │   │   └── route.ts       # OAuth callback handler
│   │   │   └── error/
│   │   │       └── page.tsx       # Auth error page
│   │   ├── journal/
│   │   │   └── page.tsx           # Stock journal page
│   │   ├── settings/
│   │   │   └── page.tsx           # AI settings page (Ollama config)
│   │   ├── master-data/
│   │   │   ├── layout.tsx         # Master data layout with tab nav
│   │   │   ├── page.tsx           # Redirects to /products
│   │   │   ├── locations/
│   │   │   │   └── page.tsx       # Locations CRUD
│   │   │   ├── products/
│   │   │   │   └── page.tsx       # Products list with filters & table options
│   │   │   ├── product-groups/
│   │   │   │   └── page.tsx       # Product groups CRUD
│   │   │   ├── quantity-units/
│   │   │   │   └── page.tsx       # Quantity units CRUD
│   │   │   └── shopping-locations/
│   │   │       └── page.tsx       # Stores CRUD
│   │   ├── products/
│   │   │   ├── new/
│   │   │   │   └── page.tsx       # Add new product page
│   │   │   └── [id]/
│   │   │       ├── edit/
│   │   │       │   └── page.tsx   # Edit product page
│   │   │       └── conversions/
│   │   │           └── page.tsx   # QU conversions page
│   │   ├── recipes/
│   │   │   ├── page.tsx           # Recipe list (card grid + search)
│   │   │   ├── new/
│   │   │   │   └── page.tsx       # Create new recipe
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Recipe detail view
│   │   │       └── edit/
│   │   │           └── page.tsx   # Edit recipe
│   │   ├── shopping-lists/
│   │   │   ├── page.tsx           # Shopping lists overview
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Shopping list detail
│   │   ├── test/
│   │   │   └── page.tsx           # Color palette test page
│   │   ├── globals.css            # Tailwind + theme CSS variables
│   │   ├── layout.tsx             # Root layout with fonts, Toaster + AiChatWidget
│   │   └── page.tsx               # Home/Stock overview page
│   ├── components/
│   │   ├── ai/                    # AI chat assistant components
│   │   │   ├── AiChatWidget.tsx   # Floating FAB + chat panel (global)
│   │   │   ├── ChatMessage.tsx    # User/assistant message bubbles
│   │   │   ├── PantryScanDialog.tsx # Pantry/fridge photo scanning dialog
│   │   │   ├── ReceiptCaptureDialog.tsx # Receipt scanning dialog (capture → process → review → wizard)
│   │   │   ├── ReceiptReviewTable.tsx # Editable review table for AI-parsed items
│   │   │   └── StockEntryCard.tsx # Inline editable stock entry cards
│   │   ├── barcode/               # Barcode scanning components
│   │   │   ├── BarcodeScanner.tsx  # Camera scanner (react-zxing)
│   │   │   ├── BarcodesSection.tsx # Barcode CRUD for products
│   │   │   ├── ScannerDialog.tsx   # Reusable scan dialog with manual fallback
│   │   │   ├── ScanToStockFlow.tsx # Scan-to-add-stock orchestration
│   │   │   └── ScanToShoppingFlow.tsx # Scan-to-purchase on shopping lists
│   │   ├── settings/              # Settings components
│   │   │   └── AiSettingsClient.tsx # Ollama config form (URL, models, test)
│   │   ├── diner/                 # Themed components
│   │   │   ├── GuestBanner.tsx    # Guest mode warning banner
│   │   │   ├── Noren.tsx          # Header with lantern decorations
│   │   │   ├── UserMenu.tsx       # Auth dropdown menu
│   │   │   └── WelcomeModal.tsx   # First-visit onboarding modal
│   │   ├── inventory/             # Stock management components
│   │   │   ├── AddStockEntryModal.tsx
│   │   │   ├── ConsumeModal.tsx   # Product-level consume dialog
│   │   │   ├── CorrectionModal.tsx # Inventory correction dialog
│   │   │   ├── DesktopStockTable.tsx
│   │   │   ├── EditStockEntryModal.tsx
│   │   │   ├── InventoryStats.tsx
│   │   │   ├── MobileStockList.tsx
│   │   │   ├── NutriScoreBadge.tsx # Color-coded A–E grade pill
│   │   │   ├── NutritionLabel.tsx  # EU-style nutrition facts table
│   │   │   ├── ProductConversionsClient.tsx
│   │   │   ├── ProductDetailModal.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   ├── StockFilters.tsx
│   │   │   ├── StockOverviewClient.tsx
│   │   │   └── TransferModal.tsx  # Transfer between locations dialog
│   │   ├── journal/               # Stock journal components
│   │   │   ├── DesktopJournalTable.tsx
│   │   │   ├── JournalClient.tsx  # Journal page client wrapper
│   │   │   ├── JournalFilters.tsx # Product, type, date range filters
│   │   │   ├── JournalPagination.tsx
│   │   │   ├── JournalSummary.tsx # Aggregated summary view
│   │   │   ├── MobileJournalList.tsx
│   │   │   └── journal-constants.ts # Shared labels, colors, formatters
│   │   ├── master-data/           # Master data components
│   │   │   ├── MasterDataForm.tsx # Reusable add/edit modal
│   │   │   ├── MasterDataList.tsx # Reusable list with CRUD
│   │   │   └── ProductsListClient.tsx # Products table with filters/sorting
│   │   ├── recipes/               # Recipe components
│   │   │   ├── RecipeForm.tsx     # Create/edit recipe (name, description, servings, picture)
│   │   │   └── RecipesListClient.tsx # Recipe card grid with search + undo delete
│   │   ├── shopping/              # Shopping list components
│   │   │   ├── ShoppingListsClient.tsx    # Lists overview (CRUD)
│   │   │   └── ShoppingListDetailClient.tsx # List detail (items, grouping, purchase)
│   │   └── ui/                    # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── image-upload.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── popover.tsx
│   │       ├── select.tsx
│   │       ├── sonner.tsx         # Toast notifications (undo toasts)
│   │       └── tabs.tsx
│   ├── hooks/
│   │   ├── useGuestStorage.ts     # localStorage hook (legacy)
│   │   └── useRecentProducts.ts   # Recently used products (localStorage)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser Supabase client
│   │   │   ├── inventory.ts       # Stock CRUD operations
│   │   │   ├── middleware.ts      # Auth middleware helpers
│   │   │   ├── get-household.ts   # Household ID resolver (auth + guest)
│   │   │   ├── server.ts          # Server-side Supabase client
│   │   │   └── storage.ts         # File upload utilities (product + recipe pictures)
│   │   ├── __tests__/
│   │   │   ├── barcode-actions.test.ts    # Barcode CRUD tests
│   │   │   ├── date-shorthands.test.ts   # Date shorthand tests
│   │   │   ├── inventory-utils.test.ts    # Inventory utils unit tests
│   │   │   ├── nutrition-mapping.test.ts  # OFF→nutrition mapping tests
│   │   │   ├── openfoodfacts.test.ts      # OFF API client tests
│   │   │   ├── shopping-list-actions.test.ts  # Shopping list action tests
│   │   │   ├── shopping-list-utils.test.ts    # Gap calculation tests
│   │   │   ├── stock-actions.test.ts      # Stock action tests
│   │   │   └── store-brand-map.test.ts    # Store-brand detection tests
│   │   ├── ai-parse-items.ts       # Resilient JSON parser for AI stock entry responses
│   │   ├── ai-utils.ts            # Ollama helpers (getAiSettings, callOllama, isAiConfigured)
│   │   ├── barcode-actions.ts     # Barcode CRUD + local lookup
│   │   ├── constants.ts           # Shared constants (GUEST_HOUSEHOLD_ID)
│   │   ├── fuzzy-match.ts        # Bigram Dice coefficient for fuzzy string matching
│   │   ├── date-shorthands.ts    # Date input shorthand parser
│   │   ├── inventory-utils.ts     # Stock aggregation, expiry & FIFO helpers
│   │   ├── openfoodfacts.ts      # Open Food Facts API client
│   │   ├── store-brand-map.ts    # UK store-brand detection config
│   │   ├── recipe-actions.ts      # Recipe CRUD + undo (create, update, delete, undo delete)
│   │   ├── shopping-list-actions.ts # Shopping list server actions
│   │   ├── shopping-list-utils.ts   # Auto-generation gap calculators
│   │   ├── product-actions.ts     # Product server actions (OFF refetch, image download)
│   │   ├── stock-actions.ts       # Stock actions (consume, open, transfer, correct, undo)
│   │   ├── stock-entry-utils.ts   # Shared bulk import (bulkCreateStockEntries) & unit conversion
│   │   └── utils.ts               # cn() and general utilities
│   └── types/
│       └── database.ts            # Manual TypeScript types (Product, Stock, Recipe, etc.)
├── supabase/
│   ├── migrations/
│   │   ├── 001_core_schema.sql    # Main tables + RLS policies
│   │   ├── 002_storage.sql        # Product pictures bucket
│   │   ├── 003_guest_mode.sql     # Guest household + RLS updates
│   │   ├── 004_guest_seed_data.sql    # Demo data for guest
│   │   ├── 005_seed_guest_function.sql # Re-seed function for admin
│   │   ├── 006_fix_anon_trigger.sql   # Skip anon users in trigger
│   │   ├── 007_drop_qu_factor.sql     # Remove deprecated qu_factor column
│   │   ├── 008_shopping_lists.sql     # Shopping lists + items tables
│   │   ├── 009_barcode_index.sql     # Compound index for barcode lookups
│   │   ├── 010_brand_fields.sql     # Add brand + is_store_brand to products
│   │   ├── 011_product_nutrition.sql # Nutrition facts table with RLS
│   │   ├── 012_household_ai_settings.sql # AI settings table with RLS
│   │   └── 013_recipes.sql        # recipes, recipe_ingredients, recipe_nestings tables + RLS
│   └── scripts/
│       └── cleanup_orphan_households.sql  # Manual cleanup script
├── BRANDING.md                    # Design system & color palette
├── CHANGELOG.md                   # Version history
├── CONTRIBUTING.md                # Development guidelines
├── README.md                      # This file
├── components.json                # shadcn/ui config
├── next.config.ts                 # Next.js configuration
├── playwright.config.ts           # E2E test config
├── vitest.config.js               # Unit test config
└── vitest.setup.ts                # Test setup
```

## Database Schema

Food Wars uses a Grocy-compatible database schema designed for comprehensive kitchen inventory management. All tables include Row Level Security (RLS) for multi-tenant data isolation.

### Tables Overview

| Table | Description | Status |
|-------|-------------|--------|
| `households` | Multi-tenant container | ✅ v0.4 |
| `locations` | Storage locations (Fridge, Freezer, Pantry) | ✅ v0.4 |
| `shopping_locations` | Stores (Tesco, Costco, Local Shop) | ✅ v0.4 |
| `product_groups` | Categories (Dairy, Produce, Meat) | ✅ v0.4 |
| `quantity_units` | Units (pc, kg, g, L, mL, pack) | ✅ v0.4 |
| `quantity_unit_conversions` | Unit conversions (1 pack = 6 pieces) | ✅ v0.4 |
| `products` | Product definitions (40+ fields) | ✅ v0.4 |
| `product_barcodes` | Multiple barcodes per product | ✅ v0.4 (UI in v0.8) |
| `stock_entries` | Individual batches in stock | ✅ v0.4 |
| `stock_log` | Transaction history for undo | ✅ v0.4 (UI in v0.6) |
| `recipes` | Recipe definitions | 🔮 v0.11 |
| `recipe_ingredients` | Recipe ingredients | 🔮 v0.11 |
| `meal_plan` | Meal planning calendar | 🔮 v0.12 |
| `shopping_lists` | Shopping list management | ✅ v0.7 |
| `shopping_list_items` | Items within shopping lists | ✅ v0.7 |
| `product_nutrition` | Nutrition facts per 100g | ✅ v0.9.2 |
| `household_ai_settings` | Per-household Ollama URL, text/vision models | ✅ v0.10.0 |

### Products Table (complete Grocy fields)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Product name |
| `description` | text | null | Optional notes |
| `active` | boolean | true | Soft delete flag |
| `picture_file_name` | string | null | Product image filename |
| `location_id` | FK | null | Default storage location |
| `default_consume_location_id` | FK | null | Consume from here first |
| `shopping_location_id` | FK | null | Default store |
| `move_on_open` | boolean | false | Auto-move to consume location when opened |
| `product_group_id` | FK | null | Category |
| `qu_id_stock` | FK | null | Stock unit (immutable after first entry) |
| `qu_id_purchase` | FK | null | Purchase unit |
| `min_stock_amount` | decimal | 0 | Low stock threshold |
| `quick_consume_amount` | decimal | 1 | One-click consume quantity |
| `quick_open_amount` | decimal | 1 | One-click open quantity |
| `treat_opened_as_out_of_stock` | boolean | false | Opened items count as missing for min stock |
| `due_type` | int | 1 | 1=best before (ok after), 2=expiration (discard) |
| `default_due_days` | int | 0 | Pre-fill expiry days (-1 = never expires) |
| `default_due_days_after_open` | int | 0 | New expiry when opened |
| `default_due_days_after_freezing` | int | 0 | New expiry when frozen |
| `default_due_days_after_thawing` | int | 0 | New expiry when thawed |
| `should_not_be_frozen` | boolean | false | Warn if moved to freezer |
| `brand` | string | null | Brand name (auto-filled from OFF) |
| `is_store_brand` | boolean | false | Whether this is a supermarket own-brand product |
| `calories` | int | null | kcal per stock unit (legacy — see `product_nutrition`) |
| `enable_tare_weight_handling` | boolean | false | For weighing containers |
| `tare_weight` | decimal | 0 | Weight of empty container |
| `parent_product_id` | FK | null | Parent product for hierarchies |
| `no_own_stock` | boolean | false | Parent product as summary only |
| `cumulate_min_stock_amount_of_sub_products` | boolean | false | Sum child min stock amounts |
| `not_check_stock_fulfillment_for_recipes` | boolean | false | Skip recipe availability check |
| `default_stock_label_type` | int | 0 | Label printing: 0=per purchase, 1=per entry, 2=none |
| `auto_reprint_stock_label` | boolean | false | Auto-print label on purchase |
| `hide_on_stock_overview` | boolean | false | Hide from main inventory list |

### Stock Entries Table

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `product_id` | FK | required | Parent product |
| `amount` | decimal | 0 | Quantity remaining |
| `best_before_date` | date | null | Due date for this batch |
| `purchased_date` | date | today | When added to stock |
| `price` | decimal | null | Unit price paid |
| `location_id` | FK | null | Current storage location |
| `shopping_location_id` | FK | null | Where purchased |
| `open` | boolean | false | Has been opened |
| `opened_date` | date | null | When opened |
| `stock_id` | uuid | auto | Unique ID for Grocycode |
| `note` | text | null | Per-entry notes |

### Stock Log Table (transaction history)

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | FK | Product affected |
| `amount` | decimal | Quantity changed |
| `transaction_type` | enum | purchase, consume, spoiled, inventory-correction, product-opened, transfer-from, transfer-to, stock-edit-old, stock-edit-new |
| `stock_id` | uuid | References stock entry |
| `undone` | boolean | Was this transaction undone? |
| `undone_timestamp` | timestamp | When undone |
| `spoiled` | boolean | Was item spoiled? |
| `correlation_id` | uuid | Groups related transactions |
| `transaction_id` | uuid | Unique per transaction |

### Product Barcodes Table

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | FK | Linked product |
| `barcode` | string | Barcode value (EAN, UPC, etc.) |
| `qu_id` | FK | Pre-fill quantity unit on scan |
| `amount` | decimal | Pre-fill amount on scan |
| `shopping_location_id` | FK | Pre-fill store on scan |
| `last_price` | decimal | Auto-tracked from purchases |
| `note` | text | Per-barcode notes |

### Product Nutrition Table (per 100g, EU Big 8)

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | FK | Linked product (unique — one row per product) |
| `energy_kj` | decimal | Energy in kilojoules |
| `energy_kcal` | decimal | Energy in kilocalories |
| `fat` | decimal | Total fat (g) |
| `saturated_fat` | decimal | Saturated fat (g) |
| `carbohydrates` | decimal | Total carbohydrates (g) |
| `sugars` | decimal | Sugars (g) |
| `fibre` | decimal | Dietary fibre (g) |
| `protein` | decimal | Protein (g) |
| `salt` | decimal | Salt (g) |
| `nutrition_grade` | text | Nutri-Score grade (a–e) from OFF |
| `data_source` | text | `off` (Open Food Facts), `manual`, or `cv` |

## Run Locally

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [pnpm](https://pnpm.io) (recommended) or npm
- [Supabase](https://supabase.com) account (free tier)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Muhammad-Hazimi-Yusri/food-wars.git
cd food-wars

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env.local
# Add your Supabase credentials

# 4. Run migrations
pnpm db:migrate

# 5. Start dev server
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get these from [Supabase Dashboard](https://supabase.com) → Project Settings → API.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm start` | Run production build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run unit tests (watch mode) |
| `pnpm test:run` | Run unit tests once |
| `pnpm test:run --coverage` | Run tests with coverage report |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm version:bump` | Interactive version updater |
| `npx knip` | Find unused files, exports, dependencies |
| `npx madge --image graph.png --extensions ts,tsx --ts-config tsconfig.json src/` | Generate dependency graph |

---

## Testing

### Unit Tests
```bash
pnpm test:run              # Run once
pnpm test                  # Watch mode
pnpm test:run --coverage   # With coverage
```

### E2E Tests

E2E tests require local Supabase:
```bash
# Start local Supabase (requires Docker)
supabase start

# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e --ui
```

To stop Supabase when done:
```bash
supabase stop
```

## Self-Hosting

This is FOSS (MIT license). If you prefer full control:

1. **Fork the repo** — Click "Fork" on GitHub
2. **Create Supabase project** — [supabase.com](https://supabase.com) (free tier)
3. **Run migrations** — Copy SQL from `supabase/migrations/`
4. **Enable Google OAuth** — Supabase Dashboard → Authentication → Providers
5. **Deploy to Vercel** — Connect your fork, add env vars
6. **Customize** — It's your code now, modify as you wish

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Version Bumping

When making feature changes, bump the version:

```bash
pnpm version:bump
# Enter: patch, minor, major, or specific version (e.g., 0.2.0)
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Credits

- Design inspired by [Shokugeki no Soma](https://en.wikipedia.org/wiki/Food_Wars!:_Shokugeki_no_Soma)
- Architecture informed by [Grocy](https://grocy.info/) (MIT)
- UI components from [shadcn/ui](https://ui.shadcn.com/)

---

<div align="center">

**食戟 — The secret ingredient is always love... and not letting food expire.**

</div>
