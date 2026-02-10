# Contributing to Food Wars

Thanks for your interest in contributing! This project is open source under the MIT license.

## Getting Started
```bash
# Clone the repo
git clone https://github.com/Muhammad-Hazimi-Yusri/food-wars.git
cd food-wars

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Visit `http://localhost:3000` to see the app.
Visit `http://localhost:3000/test` to see the color palette test page.

## Project Structure

See README.md for full directory tree.

Key areas:
- `src/app/` — Next.js App Router pages
- `src/components/ui/` — shadcn components
- `src/components/diner/` — Themed components (Noren, WelcomeModal, UserMenu)
- `src/components/inventory/` — Stock overview, modals, tables
- `src/components/journal/` — Stock journal, filters, pagination, summary
- `src/lib/supabase/` — Database client and utilities
- `src/lib/stock-actions.ts` — Stock action logic (consume, open, transfer, correct, undo)
- `src/lib/inventory-utils.ts` — FIFO helpers, expiry calculations
- `src/app/globals.css` — Tailwind + theme CSS variables (see BRANDING.md)

## Ways to Contribute

### 1. Bug Fixes
- Check [Issues](https://github.com/YOUR_USERNAME/food-wars/issues) for known bugs
- Test on different browsers/devices
- Report new bugs with steps to reproduce

### 2. Features
- Check README.md roadmap for planned features
- Discuss major changes in an issue first

### 3. Design
- See BRANDING.md for the design system
- Keep the Japanese diner aesthetic consistent
- Use Lucide icons, not emoji in UI

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Prefer server components; use `'use client'` only when needed
- Follow existing patterns in the codebase

### CSS
- Global styles go in `src/styles/`
- Component-specific styles use Tailwind classes
- Use CSS variables from BRANDING.md for theming

### Database
- Supabase migrations go in `supabase/migrations/`
- Always include RLS policies for new tables
- Test with both authenticated and guest modes

### Architecture Patterns

**Stock Action Pattern** — All stock mutations live in `src/lib/stock-actions.ts`. Each action function (e.g. `consumeStock`, `openStock`, `transferStock`, `correctInventory`) follows the same shape:
1. Accept product ID, stock entries, and action-specific params
2. Compute a mutation plan (using pure helpers from `inventory-utils.ts`)
3. Apply mutations to Supabase (update/delete stock entries)
4. Log to `stock_log` with the appropriate `transaction_type` and a shared `correlation_id`
5. Return `{ success, correlationId }` for the caller to wire up undo

**Undo Toast Pattern** — Destructive actions execute immediately, then show an 8-second undo toast via `sonner`. The undo callback calls the matching undo function (e.g. `undoConsume(correlationId)`), which reads the `stock_log` rows by `correlation_id` to reverse the mutation and marks them `undone = true`.

**Dual Mode Pattern** — All data mutations must work for both authenticated users (Supabase RLS scoped to their household) and guest mode (using `GUEST_HOUSEHOLD_ID` from `src/lib/constants.ts`). Check `user.is_anonymous` when determining the household.

**Journal Integration** — Every stock mutation logs to `stock_log` with a `transaction_type` and `correlation_id`. Transfers create two rows (`transfer-from` + `transfer-to`) sharing the same `correlation_id`. The journal page filters out `transfer-to`, `stock-edit-old`, and `stock-edit-new` rows from display.

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# For admin operations
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The `NEXT_PUBLIC_` prefix makes variables available client-side. These keys are safe to expose (security comes from Supabase Row Level Security).

### Production URLs

When deploying, update these in Supabase Dashboard (Authentication → URL Configuration):
- Site URL: `https://food-wars.muhammadhazimiyusri.uk`
- Redirect URLs: `https://food-wars.muhammadhazimiyusri.uk/**`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting (`pnpm lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Self-Hosting

Want to run your own instance? See the "Self-Hosting Option" section in README.md.

## Code Analysis

See the [Scripts section in README.md](README.md#scripts) for testing and code analysis commands.

## Questions?

Open an issue or start a discussion. We're happy to help!
