# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.X] - In Progress

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

## [0.4.X] - 2025-01-26

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

## [0.3.X] - 2025-01-24

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

## [0.2.X] - 2025-01-23

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


## [0.1.X] - 2025-01-19

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