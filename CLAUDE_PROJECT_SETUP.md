# Food Wars | 食戟 — Claude Project Setup

## Project Name
```
Food Wars | 食戟
```

## Description
```
FOSS kitchen inventory app with Japanese diner aesthetic. Next.js 14 + Supabase + Vercel. MIT license.
```

---

## Custom Instructions

```
I want to copy paste snippets of code myself to the codebase.
Keep responses concise — small code snippets each time so I'm not overwhelmed.
Work methodically. We don't need to get it correct in one go.
Always ask clarification and be critical when appropriate.

Check project knowledge (README.md, BRANDING.md) before answering unless it makes sense to ask.

## Tech Gotchas

- Next.js 14 App Router — prefer server components, use 'use client' only when needed
- Supabase RLS — users only access their own household's data
- Guest mode uses localStorage, not Supabase
- Lucide for icons, not emoji in UI components
- Use CSS variables from BRANDING.md for theming

## Quick Color Ref

| Name | Hex | Use |
|------|-----|-----|
| soma-red | #C41E3A | Primary actions |
| megumi-navy | #1E3A5F | Headers/backgrounds |
| takumi-gold | #D4AF37 | Warnings/expiring |
| kurokiba-maroon | #722F37 | Danger/expired |

## File Conventions

- Themed components → `components/diner/` (Noren, Chalkboard, WoodCard)
- Supabase client → `lib/supabase/`
- DB types → `types/database.ts`
```

---

## Project Knowledge Files

Upload to your Claude Project:
1. **README.md** — Tech stack, schema, roadmap, project structure
2. **BRANDING.md** — Colors, typography, component styles

---

## Starter Prompts

**Scaffold project:**
> Set up Next.js 14 with TypeScript, Tailwind, and our custom color palette from BRANDING.md. Give me the commands and tailwind.config.ts.

**Build a component:**
> Create a WoodCard component for inventory items. Should show name, quantity, expiry badge. Reference the styling in BRANDING.md.

**Database setup:**
> Write the Supabase migration for inventory_items with RLS policies. Use the schema from README.md.
