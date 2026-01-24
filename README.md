# Food Wars | 食戟

A free, open-source kitchen inventory and meal planning app — fighting food waste one meal at a time.

**[Live Demo →](https://food-wars.muhammadhazimiyusri.uk)** *(coming soon)*

> *Inspired by the creative cooking spirit of Shokugeki no Soma*

---

[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)]()
[![Status](https://img.shields.io/badge/status-In%20Development-yellow.svg)]()

<details>
<summary><strong>Table of Contents</strong></summary>

- [Current Features](#current-features)
- [Why Food Wars?](#why-food-wars)
- [Roadmap](#roadmap)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Run Locally](#run-locally)
- [Self-Hosting](#self-hosting)
- [Contributing](#contributing)
- [License](#license)

</details>

## Current Features

Current version is v0.4.0

### For Users
- 🚧 *In development* — see [Roadmap](#roadmap) for planned features

### For Contributors
- **Project Documentation** — README, BRANDING.md, CONTRIBUTING.md
- **Database Schema** — Households, inventory items, recipes, shopping lists
- **Design System** — Shokugeki-inspired color palette with Japanese diner aesthetic
- **Developer Tooling:**
  - `pnpm version:bump` — Interactive version updater
  - Pre-commit hooks for linting

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

---

### In Progress

#### v0.4 - Schema Expansion (In Progress)

**Goal:** Align database with Grocy's data model for full feature support

> ⚠️ Breaking change: Guest mode temporarily disabled

**New master data tables:**
- [x] `locations` — storage locations (Fridge, Freezer, Pantry, Cupboard)
- [x] `shopping_locations` — stores (Tesco, Costco, Local Shop)
- [x] `product_groups` — item categories (Dairy, Produce, Meat, Bakery, Snacks)
- [x] `quantity_units` — units (pc, kg, g, L, mL, pack, bottle)
- [x] `quantity_unit_conversions` — e.g., 1 pack = 6 pieces
- [x] Auto-seed default data on user signup

**Products table (replaces inventory_items):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Required |
| `description` | text | Optional notes |
| `active` | boolean | Soft delete |
| `picture_file_name` | string | Product image |
| `location_id` | FK | Default storage location |
| `shopping_location_id` | FK | Default store |
| `product_group_id` | FK | Category |
| `qu_id_stock` | FK | Stock unit (immutable after first entry) |
| `qu_id_purchase` | FK | Purchase unit |
| `qu_factor_purchase_to_stock` | decimal | Conversion factor |
| `min_stock_amount` | decimal | Low stock threshold |
| `due_type` | enum | 1=best_before, 2=expiration |
| `default_due_days` | int | Pre-fill expiry (-1 = never) |
| `default_due_days_after_open` | int | New expiry when opened |
| `default_due_days_after_freezing` | int | Expiry when frozen |
| `default_due_days_after_thawing` | int | Expiry when thawed |
| `quick_consume_amount` | decimal | One-click consume qty |
| `quick_open_amount` | decimal | One-click open qty |
| `calories` | int | kcal per stock unit |
| `treat_opened_as_out_of_stock` | boolean | Opened = missing for min stock |
| `should_not_be_frozen` | boolean | Warn if moved to freezer |

**Stock entries table (tracks individual batches):**

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | FK | Parent product |
| `amount` | decimal | Quantity remaining |
| `best_before_date` | date | Due date for this batch |
| `purchased_date` | date | When added |
| `price` | decimal | Unit price paid |
| `location_id` | FK | Current storage location |
| `shopping_location_id` | FK | Where purchased |
| `stock_id` | uuid | Unique ID for Grocycode |
| `open` | boolean | Has been opened |
| `opened_date` | date | When opened |
| `note` | text | Per-entry notes |

**Components:**
- [x] `StockCard` component for new schema
- [x] `StockList` component with filtering
- [x] Updated `InventoryStats` and `InventoryWarnings`

**UI for master data:**
- [ ] Manage locations page
- [ ] Manage stores page
- [ ] Manage product groups page
- [ ] Manage quantity units page
- [ ] Product form with full fields (tabbed/sectioned)

**Migration:**
- ~~Migrate v0.3 `inventory_items` to new schema~~ (clean slate instead)

### Planned

#### v0.5 - Demo Mode & Filtering

**Goal:** Demo data for testing + filtering UI

**Demo mode (guest):**
- [ ] Seed data generator with varied test scenarios
- [ ] Products with different locations, groups, statuses
- [ ] Stock entries with varied expiry dates
- [ ] Reset demo button
- [ ] **Disclaimer banner:** "Guest mode is for demo only — data may reset on app updates. Sign in or self-host for persistent storage."

**Filtering & display:**
- [ ] Warning banners (clickable to apply filter)
- [ ] Stats display (total items, by status, by location)
- [ ] Filter by expiry status (all, fresh, due soon, overdue, expired)
- [ ] Filter by location
- [ ] Filter by product group
- [ ] Search by name
- [ ] Sort options (name, expiry, location, date added)
- [ ] List view / Card view toggle

#### v0.6 - Stock Actions & Journal

**Goal:** Consume vs Open distinction + transaction logging

**Stock journal table:**

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | FK | Product affected |
| `stock_entry_id` | FK | Specific batch |
| `amount` | decimal | Quantity changed |
| `transaction_type` | enum | purchase, consume, spoiled, open, transfer, correction |
| `location_id` | FK | Location involved |
| `price` | decimal | Price at transaction |
| `spoiled` | boolean | Wasted (not consumed) |
| `note` | text | Optional note |
| `undone` | boolean | Was this reversed |
| `undone_timestamp` | datetime | When reversed |
| `correlation_id` | uuid | Links related transactions |

**Consume action:**
- [ ] Partial consume (reduce quantity)
- [ ] Mark as spoiled option (waste tracking)
- [ ] Consume rule: opened first → due soonest → FIFO
- [ ] Consume from specific location
- [ ] Quick consume button (uses `quick_consume_amount`)

**Open action:**
- [ ] Mark stock entry as opened
- [ ] Set `opened_date`
- [ ] Recalculate due date using `default_due_days_after_open`
- [ ] New due date never extends original
- [ ] Quick open button (uses `quick_open_amount`)
- [ ] Visual indicator for opened items

**Transfer action:**
- [ ] Move stock between locations
- [ ] Freezer detection: apply `default_due_days_after_freezing`
- [ ] Thaw detection: apply `default_due_days_after_thawing`
- [ ] Warn if `should_not_be_frozen` product moved to freezer

**Journal UI:**
- [ ] Stock journal page with filters (product, type, date range)
- [ ] Undo recent transactions (within time limit)
- [ ] Journal summary view (aggregated by product/type)

#### v0.7 - Shopping Lists

**Goal:** Manual and auto-generated shopping lists

**Shopping lists table:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | List name |
| `description` | text | Optional |

**Shopping list items table:**

| Field | Type | Description |
|-------|------|-------------|
| `shopping_list_id` | FK | Parent list |
| `product_id` | FK | Nullable (can be freeform) |
| `note` | text | Item description if no product |
| `amount` | decimal | Quantity needed |
| `qu_id` | FK | Quantity unit |
| `done` | boolean | Checked off |

**Core features:**
- [ ] Multiple shopping lists
- [ ] Add product-linked items (inherit name, unit)
- [ ] Add freeform items (just text + amount)
- [ ] Checkbox to mark done
- [ ] Group by product group (aisle optimization)
- [ ] Group by store

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

**Product barcodes table:**

| Field | Type | Description |
|-------|------|-------------|
| `barcode` | string | Barcode value |
| `product_id` | FK | Linked product |
| `amount` | decimal | Pre-fill purchase amount |
| `qu_id` | FK | Pre-fill quantity unit |
| `shopping_location_id` | FK | Pre-fill store |
| `note` | text | Pre-fill note |
| `last_price` | decimal | Auto-tracked |

**Barcode scanning:**
- [ ] Camera barcode scanning (html5-qrcode)
- [ ] Supports 1D (Code128, EAN) and 2D (QR, DataMatrix)
- [ ] Multiple barcodes per product
- [ ] Barcode appears on product picker fields

**Open Food Facts integration:**
- [ ] Lookup unknown barcode via OFF API
- [ ] Auto-fill: product name, image, barcode
- [ ] Opens product form to complete setup
- [ ] Configurable: enable/disable lookup

**Grocycode (internal barcodes):**
- [ ] Format: `grcy:p:{product_id}` or `grcy:s:{stock_id}`
- [ ] Generate printable codes
- [ ] Scan to quick-consume or quick-open

**Input productivity:**
- [ ] Date field shorthands (e.g., `0517` → `2025-05-17`, `+1m` → next month, `x` → never expires)
- [ ] Recently used products list
- [ ] Default values from product settings
- [ ] Keyboard shortcuts for common actions

#### v0.9 - Recipes

**Goal:** Recipe database with inventory integration

**Recipes table:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Recipe name |
| `description` | text | Instructions (rich text) |
| `picture_file_name` | string | Recipe image |
| `base_servings` | int | Default serving size |
| `desired_servings` | int | Current scaled servings |
| `product_id` | FK | "Produces product" (optional) |

**Recipe ingredients table:**

| Field | Type | Description |
|-------|------|-------------|
| `recipe_id` | FK | Parent recipe |
| `product_id` | FK | Ingredient product |
| `amount` | decimal | Quantity needed |
| `qu_id` | FK | Quantity unit |
| `note` | text | Prep notes (e.g., "diced", "room temp") |
| `ingredient_group` | string | Section header (e.g., "For the sauce") |
| `variable_amount` | string | Text instead of number (e.g., "to taste") |
| `only_check_single_unit_in_stock` | boolean | Just verify any amount exists |
| `not_check_stock_fulfillment` | boolean | Always show as fulfilled |
| `price_factor` | decimal | Cost calculation multiplier |

**Recipe nestings table:**

| Field | Type | Description |
|-------|------|-------------|
| `recipe_id` | FK | Parent recipe |
| `includes_recipe_id` | FK | Nested recipe |
| `servings` | int | How many servings to include |

**Core features:**
- [ ] Recipe CRUD with rich text instructions
- [ ] Ingredient groups (collapsible sections)
- [ ] Serving size scaling (auto-calculates amounts)
- [ ] Recipe images
- [ ] Recipe nesting (recipe as ingredient)

**Inventory integration:**
- [ ] "Can I make this?" — stock fulfillment check
- [ ] Green/red indicator per ingredient
- [ ] Shows: needed amount, in stock, missing
- [ ] "Add missing to shopping list" button
- [ ] "Consume recipe" — deducts all ingredients

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

**Meal plan sections table:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Section name (Breakfast, Lunch, Dinner) |
| `sort_number` | int | Display order |
| `time` | time | Optional time for calendar export |

**Meal plan table:**

| Field | Type | Description |
|-------|------|-------------|
| `day` | date | Planned date |
| `type` | enum | recipe, product, note |
| `recipe_id` | FK | If type=recipe |
| `recipe_servings` | int | Servings for this entry |
| `product_id` | FK | If type=product |
| `product_amount` | decimal | Amount for product entry |
| `product_qu_id` | FK | Unit for product entry |
| `note` | text | If type=note |
| `section_id` | FK | Meal section |

**Calendar UI:**
- [ ] Week view (desktop primary)
- [ ] Day view (mobile primary)
- [ ] Configurable week start day
- [ ] Drag-and-drop to reschedule
- [ ] Copy single day
- [ ] Copy entire week

**Entry types:**
- [ ] Recipe entry (links to recipe, shows servings)
- [ ] Product entry (single ingredient, e.g., "Yogurt for breakfast")
- [ ] Note entry (freeform text, e.g., "Eating out")

**Shopping integration:**
- [ ] "Add week to shopping list" button
- [ ] Calculates all missing ingredients across recipes
- [ ] Respects current stock (only adds shortfall)
- [ ] Groups by product (no duplicates)

**Stats display:**
- [ ] Cost per day (from ingredient prices)
- [ ] Cost per week
- [ ] Calories per day (if product calories defined)

**Calendar export:**
- [ ] iCal sharing link
- [ ] Sync with external calendars

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
├── app/
│   ├── (auth)/                 # Login, signup pages
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/            # Protected routes
│   │   ├── inventory/
│   │   ├── recipes/
│   │   ├── shopping/
│   │   └── suggestions/
│   ├── api/                    # API routes
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn components
│   ├── diner/                  # Themed components
│   │   ├── Noren.tsx           # Curtain header
│   │   ├── Chalkboard.tsx      # AI suggestions section
│   │   ├── WoodCard.tsx        # Inventory item card
│   │   └── LanternButton.tsx   # Primary button
│   └── inventory/              # Feature components
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client
│   │   └── middleware.ts       # Auth middleware
│   └── utils/
├── styles/
│   ├── globals.css
│   └── diner-theme.css         # Japanese diner styles
├── types/
│   └── database.ts             # Supabase types
├── supabase/
│   └── migrations/             # SQL migrations
├── scripts/
│   └── bump-version.mjs        # Version updater
├── .husky/
│   └── pre-commit              # Pre-commit hooks
├── BRANDING.md                 # Design system
├── CHANGELOG.md
├── CONTRIBUTING.md
└── README.md
```

---

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
| `pnpm version:bump` | Interactive version updater |

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
