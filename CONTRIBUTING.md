# Contributing to Food Wars

Thanks for your interest in contributing! This project is open source under the MIT license.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/food-wars.git
cd food-wars

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Add your Supabase credentials

# Start dev server
pnpm dev
```

## Project Structure

See README.md for full directory tree.

Key areas:
- `app/` — Next.js App Router pages
- `components/ui/` — shadcn components
- `components/diner/` — Themed components (Noren, Chalkboard, WoodCard)
- `lib/supabase/` — Database client and utilities
- `styles/diner-theme.css` — Japanese diner custom styles

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

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# For admin operations
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The `NEXT_PUBLIC_` prefix makes variables available client-side. These keys are safe to expose (security comes from Supabase Row Level Security).

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

## Questions?

Open an issue or start a discussion. We're happy to help!
