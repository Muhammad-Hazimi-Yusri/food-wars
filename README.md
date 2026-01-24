# Food Wars | 食戟

A free, open-source kitchen inventory and meal planning app — fighting food waste one meal at a time.

**[Live Demo →](https://food-wars.muhammadhazimiyusri.uk)** *(coming soon)*

> *Inspired by the creative cooking spirit of Shokugeki no Soma*

---

[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Version](https://img.shields.io/badge/version-0.3.2-blue.svg)]()
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

Current version is v0.3.2

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

Existing FOSS options (Grocy, Mealie, Tandoor) are excellent but require self-hosting. Food Wars targets a different niche:

| | Grocy | Mealie | Tandoor | **Food Wars** |
|--|-------|--------|---------|---------------|
| **Focus** | Full household ERP | Recipe management | Recipe management | Pantry + waste reduction |
| **Hosting** | Self-host (PHP/SQLite) | Self-host (Python) | Self-host (Django) | Vercel free tier |
| **Setup** | Docker required | Docker required | Docker required | Just sign in |
| **Barcode scanning** | ✅ | ❌ | ❌ | 🔜 Planned |
| **AI features** | ❌ | ✅ Recipe import (API key) | ✅ Recipe import (API key) | ✅ Context export (free) |
| **Receipt → Pantry** | ⚠️ Third-party addon | ❌ | ❌ | 🔜 Planned |

**Our niche:** Zero-config cloud hosting, expiry-focused workflow, and a cozy Japanese diner aesthetic.

> Already happy with Grocy/Mealie/Tandoor? Stick with them — they're battle-tested. Food Wars is for those who want something simpler to deploy.

---

## Roadmap

> See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Completed

<details>
<summary><strong>v0.2 - Project Foundation ✓</strong></summary>

**Goal:** Scaffolding and basic auth

- [x] Next.js 14 project setup with TypeScript
- [x] Tailwind CSS configuration
- [x] Custom color palette (Soma Red, Megumi Navy, etc.)
- [x] Custom fonts (Dela Gothic One, Zen Kaku Gothic)
- [x] CSS test page for visual verification
- [x] shadcn/ui component library
- [x] Basic layout with Noren header component
- [x] Guest mode with localStorage
- [x] Supabase project setup
- [x] Google OAuth authentication
- [x] Testing framework (Vitest + Playwright)
- [x] GitHub Actions CI pipeline
- [x] Custom domain setup (food-wars.muhammadhazimiyusri.uk)
</details>

### In Progress

#### v0.3 - Basic Inventory

**Goal:** Core inventory CRUD

- [x] Database migrations (households, inventory_items)
- [x] Row Level Security policies
- [x] Auto-create household on signup
- [x] Welcome modal with sign-in/guest options
- [x] UserMenu dropdown with Google avatar
- [x] Add/delete inventory items
- [x] WoodCard component with diner styling
- [x] Expiry status badges (fresh → warning → urgent → expired)
- [x] Responsive grid layout
- [x] Guest mode (localStorage) and signed-in mode (Supabase)
- [ ] Edit inventory items

---

### Planned

#### v0.4 - Inventory Polish

**Goal:** Views, filters, and warnings like Grocy

- [ ] Edit item modal
- [ ] List view / Card view toggle
- [ ] Category tabs (fridge, freezer, pantry, spices)
- [ ] Warning banners (X expired, X expiring soon, X low stock)
- [ ] Filter by status (all, fresh, expiring, expired)
- [ ] Search items
- [ ] Sort options (name, expiry date, category)
- [ ] Item count and stats display

#### v0.5 - Smart Input

**Goal:** Fast, error-free input like Grocy

- [ ] Common items quick-add (searchable list)
- [ ] Recently added items suggestions
- [ ] Barcode scanning (html5-qrcode)
- [ ] Barcode lookup via Open Food Facts API
- [ ] Quick quantity adjustment (+/- buttons)
- [ ] Duplicate item detection

#### v0.6 - Stock Management

**Goal:** Minimum stock levels and consumption tracking

- [ ] Minimum stock amount per item
- [ ] Low stock warnings
- [ ] "Consume" action (reduce quantity)
- [ ] "Open" status for items (e.g., opened milk)
- [ ] Purchase history (when added, quantity)
- [ ] Expiry date presets (common durations)

#### v0.7 - Shopping Lists

**Goal:** Auto-generate shopping lists from inventory

- [ ] Shopping list CRUD
- [ ] Auto-generate from low-stock items
- [ ] Manual add items
- [ ] Checkbox items with swipe to delete
- [ ] Group by store section/category
- [ ] Share list (copy to clipboard, share link)
- [ ] Mark as purchased → auto-add to inventory

#### v0.8 - Recipes & Meal Planning

**Goal:** Recipe database with ingredient matching

- [ ] Recipe CRUD with ingredients (JSONB)
- [ ] "Can I make this?" ingredient matching
- [ ] Missing ingredients → add to shopping list
- [ ] "Due Score" — recipes using expiring items
- [ ] Meal planning calendar (daily/weekly)
- [ ] One-click: meal plan → shopping list

#### v0.9 - PWA & Mobile

**Goal:** Native-like mobile experience

- [ ] PWA manifest and service worker
- [ ] Offline mode with sync queue
- [ ] Install prompt
- [ ] Mobile-optimized touch interactions
- [ ] Camera access for barcode scanning
- [ ] Dark mode (auto + manual toggle)

#### v1.0 - AI Features

**Goal:** Smart suggestions and automation

- [ ] Chalkboard component for AI suggestions
- [ ] AI context export (one-click copy pantry state)
- [ ] Recipe suggestions based on inventory
- [ ] Smart expiry predictions
- [ ] Natural language item input
- [ ] Import recipe from AI response

---

### Future Ideas

> Post-launch features, no timeline commitment.

- Custom fields for items (brand, price, notes)
- Price tracking and budget insights
- Grocery delivery integration (Tesco, Asda APIs)
- Nutrition tracking
- Household sharing invites (multi-user)
- Recipe sharing community
- Multi-language support (i18n)
- Voice input for hands-free use
- Receipt OCR (Tesseract.js or Google Vision)

---

### Design Philosophy

> Inspired by [Grocy](https://grocy.info) — ported for modern cloud deployment.

Food Wars aims to bring Grocy's excellent feature set to a modern tech stack (Next.js, Supabase, Vercel) that's:

- **Zero-config deployment** — No Docker, no self-hosting required
- **Cloud-first** — Works across devices, auto-backup
- **Forkable** — MIT license, easy to customize
- **Cozy UX** — Japanese diner aesthetic instead of utilitarian

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
