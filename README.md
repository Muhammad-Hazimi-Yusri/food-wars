# Food Wars | 食戟

A free, open-source kitchen inventory and meal planning app — fighting food waste one meal at a time.

**[Live Demo →](https://food-wars.muhammadhazimiyusri.uk)** *(coming soon)*

> *Inspired by the creative cooking spirit of Shokugeki no Soma*

---

[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Version](https://img.shields.io/badge/version-0.5.19-blue.svg)]()
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

Current version is v0.5.19

### For Users
- **Stock Overview** — View all inventory with expiry status badges
- **Responsive Views** — Mobile/desktop tables with Grocy-style quick actions (Consume, Open)
- **Add Products** — 5-tab form (basic, stock defaults, locations, QU conversions, barcodes)
- **Product Pictures** — Upload from camera or gallery (mobile-optimized)
- **Add Stock** — Quick-add entries with location, expiry, price
- **Stock Details** — View and delete individual batches per product
- **Status Warnings** — Expired, overdue, due soon, below minimum alerts
- **Google Sign-in** — OAuth authentication with household isolation

### For Contributors
- **Documentation** — README, BRANDING.md, CONTRIBUTING.md, CHANGELOG.md
- **Database Schema** — Grocy-compatible with 40+ product fields, full RLS
- **Design System** — Shokugeki color palette, Japanese diner aesthetic
- **Testing** — Vitest unit tests + Playwright E2E
- **CI/CD** — GitHub Actions, Vercel deployment
- **Tooling:** `pnpm version:bump`, pre-commit hooks

### Technical Highlights
- **Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase
- **Auth:** Google OAuth + guest mode (localStorage)
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
| **Barcode scanning** | ✅ | ❌ | ❌ | 🔜 Planned |
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

---

### In Progress

#### v0.5 - Guest Mode & Filtering

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
- [ ] Delete product pictures when deleting products

### Planned

#### v0.6 - Stock Actions & Journal

**Goal:** Consume vs Open distinction + transaction logging

> Schema ready: `stock_log` table with `stock_transaction_type` enum already in place

**Consume action:**
- [ ] Partial consume (reduce quantity)
- [ ] Mark as spoiled option (waste tracking)
- [ ] Consume rule: opened first → due soonest → FIFO
- [ ] Consume from specific location
- [ ] Quick consume button (uses `quick_consume_amount`)
- [ ] Log to `stock_log` with `transaction_type = 'consume'`

**Open action:**
- [ ] Mark stock entry as opened
- [ ] Set `opened_date`
- [ ] Recalculate due date using `default_due_days_after_open`
- [ ] New due date never extends original
- [ ] Quick open button (uses `quick_open_amount`)
- [ ] Optional: auto-move to `default_consume_location_id` if `move_on_open` is true
- [ ] Log to `stock_log` with `transaction_type = 'product-opened'`

**Transfer action:**
- [ ] Move stock between locations
- [ ] Freezer detection: apply `default_due_days_after_freezing`
- [ ] Thaw detection: apply `default_due_days_after_thawing`
- [ ] Warn if `should_not_be_frozen` product moved to freezer
- [ ] Log to `stock_log` with `transaction_type = 'transfer-from'` and `'transfer-to'`

**Inventory correction:**
- [ ] Adjust stock amount directly
- [ ] Log to `stock_log` with `transaction_type = 'inventory-correction'`

**Journal UI:**
- [ ] Stock journal page with filters (product, type, date range)
- [ ] Undo recent transactions (sets `undone = true`, `undone_timestamp`)
- [ ] Journal summary view (aggregated by product/type)
- [ ] Uses `correlation_id` to group related transactions

#### v0.7 - Shopping Lists

**Goal:** Manual and auto-generated shopping lists

**Schema to add:**
```sql
-- Shopping lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping list items
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  note TEXT,
  amount DECIMAL NOT NULL DEFAULT 1,
  qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Core features:**
- [ ] Multiple shopping lists
- [ ] Add product-linked items (inherit name, unit)
- [ ] Add freeform items (just text + amount)
- [ ] Checkbox to mark done
- [ ] Group by product group (aisle optimization)
- [ ] Group by store (`shopping_location_id`)

**Inventory integration:**
- [ ] "Add to stock" from shopping list item
- [ ] Pre-fills purchase form with product, amount, unit
- [ ] Auto-remove from list when added to stock
- [ ] Amount increments if product already on list

**Auto-generation:**
- [ ] "Add all below min stock" button
- [ ] "Add all expired" button
- [ ] "Add all overdue" button
- [ ] Setting: auto-add products below min stock
- [ ] Calculates missing amount: `min_stock - current_stock`

#### v0.8 - Barcodes & Smart Input

**Goal:** Fast, error-free product entry

> Schema ready: `product_barcodes` table already in place

**Barcode scanning:**
- [ ] Camera barcode scanning (html5-qrcode or ZXing)
- [ ] Supports 1D (Code128, EAN-8, EAN-13) and 2D (QR, DataMatrix)
- [ ] Multiple barcodes per product (via `product_barcodes` table)
- [ ] Barcode icon on product picker fields
- [ ] Scan auto-fills: product, amount (`product_barcodes.amount`), unit (`product_barcodes.qu_id`), store (`product_barcodes.shopping_location_id`)

**Open Food Facts integration:**
- [ ] Lookup unknown barcode via OFF API
- [ ] Auto-fill: product name, image, barcode
- [ ] Opens product form to complete setup
- [ ] Configurable: enable/disable lookup

**Grocycode (internal barcodes):**
- [ ] Format: `grcy:p:{product_id}` or `grcy:s:{stock_id}`
- [ ] Generate printable DataMatrix/Code128 codes
- [ ] Scan to quick-consume or quick-open
- [ ] Print labels (webhook or browser print)

**Label printing:** (uses `default_stock_label_type` and `auto_reprint_stock_label` fields)
- [ ] Print Grocycode labels for products
- [ ] Print Grocycode labels for stock entries
- [ ] Auto-print on purchase if enabled

**Input productivity:**
- [ ] Date field shorthands (e.g., `0517` → `2025-05-17`, `+1m` → next month, `x` → never expires)
- [ ] Recently used products list
- [ ] Default values from product settings
- [ ] Keyboard shortcuts for common actions

#### v0.9 - Recipes

**Goal:** Recipe database with inventory integration

**Schema to add:**
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

#### v0.10 - Meal Planning

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
- [ ] Based on product `calories` field
- [ ] Visual charts

#### v0.11 - Product Analytics

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

#### v1.0 - PWA & Polish

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
- [ ] Receipt OCR (Tesseract.js or Google Vision)
- [ ] Label printer support (Grocycode printing)
- [ ] Calendar sync (Google Calendar, Apple Calendar)

**AI features:**
- [ ] Natural language item input ("2 bottles of milk expiring next week")
- [ ] Smart expiry predictions based on history
- [ ] Recipe suggestions from current stock
- [ ] Chalkboard component for AI suggestions

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
│   └── guest-mode.spec.ts         # Guest mode flow E2E tests
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
│   │   │   └── test-supabase/
│   │   │       └── route.ts       # Supabase connection test endpoint
│   │   ├── auth/
│   │   │   ├── callback/
│   │   │   │   └── route.ts       # OAuth callback handler
│   │   │   └── error/
│   │   │       └── page.tsx       # Auth error page
│   │   ├── master-data/
│   │   │   ├── layout.tsx         # Master data layout with tab nav
│   │   │   ├── page.tsx           # Redirects to /products
│   │   │   ├── products/
│   │   │   │   └── page.tsx       # Products list with filters & table options
│   │   │   │   └── page.tsx       # Locations CRUD
│   │   │   ├── product-groups/
│   │   │   │   └── page.tsx       # Product groups CRUD
│   │   │   ├── quantity-units/
│   │   │   │   └── page.tsx       # Quantity units CRUD
│   │   │   └── shopping-locations/
│   │   │       └── page.tsx       # Stores CRUD
│   │   ├── products/
│   │   │   └── new/
│   │   │       └── page.tsx       # Add new product page
│   │   ├── test/
│   │   │   └── page.tsx           # Color palette test page
│   │   ├── globals.css            # Tailwind + theme CSS variables
│   │   ├── layout.tsx             # Root layout with fonts
│   │   └── page.tsx               # Home/Stock overview page
│   ├── components/
│   │   ├── diner/                 # Themed components
│   │   │   ├── GuestBanner.tsx    # Guest mode warning banner
│   │   │   ├── Noren.tsx          # Header with lantern decorations
│   │   │   ├── UserMenu.tsx       # Auth dropdown menu
│   │   │   └── WelcomeModal.tsx   # First-visit onboarding modal
│   │   ├── inventory/             # Stock management components
│   │   │   ├── AddStockEntryModal.tsx
│   │   │   ├── DesktopStockTable.tsx
│   │   │   ├── EditStockEntryModal.tsx
│   │   │   ├── InventoryStats.tsx
│   │   │   ├── MobileStockList.tsx
│   │   │   ├── ProductDetailModal.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   ├── StockFilters.tsx
│   │   │   └── StockOverviewClient.tsx
│   │   ├── master-data/           # Master data components
│   │   │   ├── MasterDataForm.tsx # Reusable add/edit modal
│   │   │   ├── MasterDataList.tsx # Reusable list with CRUD
│   │   │   └── ProductsListClient.tsx # Products table with filters/sorting
│   │   └── ui/                    # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── image-upload.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       └── tabs.tsx
│   ├── hooks/
│   │   └── useGuestStorage.ts     # localStorage hook (legacy)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser Supabase client
│   │   │   ├── inventory.ts       # Stock CRUD operations
│   │   │   ├── middleware.ts      # Auth middleware helpers
│   │   │   ├── server.ts          # Server-side Supabase client
│   │   │   └── storage.ts         # File upload utilities
│   │   ├── __tests__/
│   │   │   └── inventory-utils.test.ts # Inventory utils unit tests
│   │   ├── constants.ts           # Shared constants (GUEST_HOUSEHOLD_ID)
│   │   ├── inventory-utils.ts     # Stock aggregation & expiry helpers
│   │   └── utils.ts               # cn() and general utilities
│   └── types/
│       └── database.ts            # Supabase generated types
├── supabase/
│   ├── migrations/
│   │   ├── 001_core_schema.sql    # Main tables + RLS policies
│   │   ├── 002_storage.sql        # Product pictures bucket
│   │   ├── 003_guest_mode.sql     # Guest household + RLS updates
│   │   ├── 004_guest_seed_data.sql    # Demo data for guest
│   │   ├── 005_seed_guest_function.sql # Re-seed function for admin
│   │   └── 006_fix_anon_trigger.sql   # Skip anon users in trigger
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
| `recipes` | Recipe definitions | 🔮 v0.9 |
| `recipe_ingredients` | Recipe ingredients | 🔮 v0.9 |
| `meal_plan` | Meal planning calendar | 🔮 v0.10 |
| `shopping_lists` | Shopping list management | 🔮 v0.7 |

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
| `calories` | int | null | kcal per stock unit |
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
