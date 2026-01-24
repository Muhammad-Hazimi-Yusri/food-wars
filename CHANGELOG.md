# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Next.js 14 project scaffolding (in progress)

---

## [Unreleased]

### Added
- *Nothing yet*

---

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