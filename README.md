# Food Wars | 食戟

A free, open-source kitchen inventory and meal planning app — fighting food waste one meal at a time.

**[Live Demo →](https://food-wars.muhammadhazimiyusri.uk)** *(coming soon)*

> *Inspired by the creative cooking spirit of Shokugeki no Soma*

---

[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
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

Current version is v0.1.0

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

### In Progress

#### v0.2 - Project Foundation

**Goal:** Scaffolding and basic auth

- [ ] Next.js 14 project setup with TypeScript
- [ ] Tailwind CSS + shadcn/ui configuration
- [ ] Custom color palette (Soma Red, Megumi Navy, etc.)
- [ ] Supabase project setup
- [ ] Google OAuth authentication
- [ ] Guest mode with localStorage
- [ ] Basic layout with Noren header component

---

### Planned

#### v0.3 - Inventory MVP

**Goal:** Core pantry tracking functionality

- [ ] Database migrations (households, inventory_items)
- [ ] Row Level Security policies
- [ ] Add/edit/delete inventory items
- [ ] Categories (fridge, freezer, pantry, spices)
- [ ] Expiry date tracking
- [ ] Urgency badges (fresh → warning → urgent → expired)
- [ ] WoodCard component with diner styling
- [ ] Mobile-responsive grid layout

#### v0.4 - Shopping Lists

**Goal:** Auto-generate shopping lists from inventory

- [ ] Shopping list CRUD
- [ ] Auto-generate from low-stock items
- [ ] Checkbox items with swipe to delete
- [ ] Share list (copy to clipboard)

#### v0.5 - Recipes & AI

**Goal:** Recipe database with AI-powered suggestions

- [ ] Recipe CRUD with ingredients (JSONB)
- [ ] "Can I make this?" ingredient matching
- [ ] Chalkboard component for suggestions
- [ ] AI context export (one-click copy pantry)
- [ ] Import recipe from AI response (optional)

#### v0.6 - Smart Features

**Goal:** Advanced input methods

- [ ] Receipt OCR (Tesseract.js or Google Vision)
- [ ] Barcode scanning (html5-qrcode)
- [ ] Image recognition for pantry items (experimental)

#### v0.7 - Polish

**Goal:** Production-ready experience

- [ ] PWA support
- [ ] Offline mode with sync
- [ ] Meal planning calendar
- [ ] Performance optimization

---

### Known Issues & Polish

- [ ] *None yet — project just started!*

---

### v1.0.0 - Official Release

**Goal:** Production-ready, polished pantry app

- [ ] All core features complete
- [ ] Comprehensive test coverage
- [ ] Accessibility audit passed
- [ ] Documentation complete

---

### Future Ideas

> Post-launch features, no timeline commitment.

- Grocery delivery integration (Tesco, Asda APIs)
- Nutrition tracking
- Cost tracking & budgeting
- Household sharing invites
- Recipe sharing community
- Multi-language support

---

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
| `pnpm lint` | Run ESLint |
| `pnpm db:migrate` | Run Supabase migrations |
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
