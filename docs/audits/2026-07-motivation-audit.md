# End-User Motivation Audit — why using Food Wars feels like a slog

**Date:** 2026-07-14 · **App version:** v0.24.0 · **Method:** full code walkthrough of every user-facing workflow (the deployed site was not reachable from the audit sandbox, so timings are derived from the code's network behaviour rather than stopwatch measurements — every claim below is anchored to a file/line you can check).

---

## TL;DR

The app charges you rent every day (bookkeeping) and pays dividends (dinner decided, waste avoided, money saved) rarely, quietly, or never. Specifically:

1. **Every visit starts with a silent multi-second wait** — no loading states, ~9–15 database round-trips per page, and a full refetch of everything after every single tap of a quick action.
2. **The home screen greets you with chores and guilt** — three data-entry buttons and four alarm banners (expired / overdue / due soon / below min). The payoff features are hidden behind an avatar dropdown.
3. **The reward loop is broken end-to-end** — the app never celebrates anything, the waste report only shows failures (and stays empty anyway because the "spoiled" flag is buried three taps deep in a modal you never use), and the app has no way to reach you when it's closed: no PWA, no push, no email. The habit loop has no trigger, an expensive action, and an invisible reward.
4. **Your own commit history is the smoking gun** — v0.15 through v0.24 (Export for AI → copy-paste LLM import → a full MCP server) are four months of building increasingly elaborate ways to *avoid touching your own UI*. That's the clearest user-research signal this project will ever produce. Treat it as data.

None of this means the app is bad — the backend loop (plan → shop → stock → cook → auto-consume with undo everywhere) is genuinely complete and better than most hobby Grocy clones. The problem is that the *interaction layer prices every action too high and pays every reward too low*.

---

## The evidence in the commit history

| Version | What you built | What it says |
|---|---|---|
| v0.10–0.11 | Ollama AI stock entry, receipt scan, AI chat | "Typing entries into forms is too slow" |
| v0.15 | Token-auth JSON export + expiry notifications | "I want the data *out* of the app" |
| v0.16 | Copy-paste AI ingredient import via external LLM | "Even the in-app AI is too much friction" |
| v0.17–0.24 | Full MCP server: shopping lists, recipes, meal plan, journal, products, master data, reports | "I'd rather have Claude drive the app than open it" |

The most active user interface for Food Wars today is arguably Claude via MCP, not the app. Automation as an *input channel* is a fine direction — but it also means the app's own screens stopped earning their visits.

---

## Workflow-by-workflow friction audit

### 1. Opening the app (the daily "front door")

What actually happens on every visit:

- **It's a browser tab, not an app.** README claims PWA, but there is no manifest, no service worker, no icons — `public/` still contains the default Next.js template SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). No home-screen icon means opening the app requires *remembering a URL*. That alone kills most casual visits.
- **Middleware hits Supabase Auth on every navigation** (`src/middleware.ts:37`) before any page renders.
- **The home page blocks on 9 queries** — 8 in `Promise.all` plus a sequential `stock_log` follow-up (`src/app/page.tsx:52–129`), then `TodaysDinnerCard` adds ~5 more inside Suspense (`src/components/meal-plan/TodaysDinnerCard.tsx:26–79`).
- **There is no `loading.tsx` anywhere in `src/app`** — every route transition shows a frozen screen until all queries return. The app *feels* broken during the wait even when it's working.
- **After hydration, more requests fan out:** `/api/ai/settings` from the chat widget on every page (`src/components/ai/AiChatWidget.tsx:67–77`), `/api/notifications/expiring` (`src/components/inventory/ExpiryAnnouncer.tsx:56`), `supabase.auth.getUser()` again in `UserMenu` (`src/components/diner/UserMenu.tsx:21–27`), and **one signed-URL request per product image** — a classic N+1 (`src/components/inventory/MobileStockList.tsx:104–108`). Thirty products in stock = thirty extra round-trips, every visit.
- On Vercel + Supabase free tiers (cold starts, cross-region latency), all of this stacks.

**Verdict: several seconds of dead, feedback-less waiting before the app is usable — every single time. This is the physical texture of "slog".**

### 2. Logging groceries (the weekly tax)

Per known item via **Add Stock** (`src/components/inventory/AddStockEntryModal.tsx`):
tap *Add Stock* → tap product combobox → type to search → tap result → tap amount → type → confirm date → tap *Add Stock* — **~6–8 interactions plus typing, per item**. The defaults engine (auto unit/location/store/due-date on product select, lines 236–263) is genuinely good and saves the flow from being worse.

But then the submit path: **whole amounts > 1 are split into per-unit entries in a sequential loop with two inserts each** (`AddStockEntryModal.tsx:319–362`). Buying 12 eggs = **24 serial network round-trips** from your phone while the button says "Adding...". A 20-item shop is a hundred-plus taps and several minutes of spinners.

The escape hatches all have their own tax: barcode scanning is still modal-per-item; receipt/pantry scan requires a healthy self-hosted Ollama; the v0.16 copy-paste LLM dance requires leaving the app. You built them because this flow hurts — they route around the pain instead of removing it.

### 3. Logging consumption (the daily tax)

The quick-action idea (Consume X / All / Open with product defaults) is the right idea, but the execution adds friction back:

- The "mobile" list is a **horizontally scrolling spreadsheet** — `min-w-[500px]` inside `overflow-x-auto` (`MobileStockList.tsx:278–279`), product names squeezed into an **80px column with `break-all`** (line 320: "Chicken Breast" renders as "Chick/en Br/east"), action buttons **24px tall** (`h-6`, lines 353–387) — half the 44px minimum tap size the Cook Now changelog brags about.
- **Every quick action calls `router.refresh()`** (lines 188, 213, 239), which re-runs *all nine home-page queries plus the N+1 image URLs*. Consume five things after dinner = five full-world reloads. No optimistic UI anywhere.
- Errors surface via native `alert()` (lines 204, 229, 255).

The 8-second undo toasts are excellent — genuinely trust-building. The waiting between taps is what makes it a chore.

### 4. Deciding dinner (the supposed payoff)

- **The "What's for dinner?" card renders below the chore buttons** and only if you've *already done more upkeep* (dinner entries in the meal plan, or cooking-role tags) — `src/app/page.tsx:191–220`, `TodaysDinnerCard.tsx:138`. The reward is gated behind more work, and displayed in `text-xs`.
- **Cook Now — the most motivating concept in the app — is buried 5th in the avatar dropdown** (`UserMenu.tsx:100–104`). There is no bottom tab bar; all eight destinations live behind that dropdown, so the payoff features are invisible in daily use.
- **The Cook Now staging area is a dead end.** You drag ingredients into a "Meal Idea"... and the only action available is **Clear** (`src/components/cook-now/StagingArea.tsx:108–118`). No "cook this" (consume), no "save to meal plan", no "ask AI for a recipe with these". The single most playful interaction in the app rewards you with a trash-can icon.
- Once a recipe exists, the **Cook button is the best moment in the app** — one tap, ingredients auto-consumed, undoable (`src/components/recipes/RecipeFulfillment.tsx:75–96`). But getting there requires authoring recipes with product-linked ingredients, units and conversions (`RecipeIngredientsClient.tsx`, 711 lines of editor) — hours of setup before the first payoff.

### 5. Shopping lists

Honestly the strongest workflow: auto-generate from below-min/expired/overdue, purchase-with-defaults on check-off (`src/lib/shopping-list-actions.ts:213`), aisle grouping, drag reorder. Its only real problem is that it lives two taps deep in the avatar menu.

### 6. Tracking waste (the app's stated mission)

"Fighting food waste one meal at a time" — but:

- The **spoiled flag lives only in the long-form Consume modal** (`ConsumeModal.tsx:177–181`): ⋮ menu → "Consume..." → check "Mark as spoiled" → confirm. The quick actions you actually use never record waste. So the data mostly doesn't exist.
- The **waste report is all stick, no carrot** (`src/app/reports/waste/page.tsx`): "Total items spoiled" in red, "Estimated value wasted". When you do *well*, the reward is... an empty grey page ("No waste recorded yet"). Success = silence. There is no "£ eaten vs £ wasted", no "items rescued before expiry", no streak, no meals-cooked count. **Nowhere in the entire app does anything ever congratulate you.**
- Meanwhile the home screen shows four alarm banners — expired, overdue, due soon, below min (`InventoryStats.tsx:45–86`) — so the emotional summary of every visit is "here is everything you've failed at, plus three forms to fill in."

### 7. Coming back tomorrow (retention)

- **The app cannot reach you when it's closed.** The "expiry notifications" (v0.15) fire only when the dashboard is already open — a toast and a `new Notification(...)` from page JS (`ExpiryAnnouncer.tsx`), no service worker, no push subscription, no email, no cron. The core value ("act before food expires") depends entirely on you spontaneously remembering to visit a website.
- **Session expiry silently drops you into guest demo data** (`src/middleware.ts:42–44`): if your Google token fails to refresh, the middleware signs you in *anonymously* and renders the shared demo pantry. "Why is my fridge full of demo food?" is a trust-destroying moment, and trust is the currency inventory apps live on.
- Trust also decays structurally: one unlogged snack makes stock wrong → fulfillment says "2 ingredients missing" while you're looking at them in the fridge → you stop believing the numbers → every further entry feels like accounting for a ledger nobody audits. There is no cheap "reconcile" mode (Inventory Correction is per-product, modal-based).

---

## Why this kills motivation (the mechanics, briefly)

A habit needs **trigger → action → reward → investment**. Food Wars today:

| Stage | State |
|---|---|
| Trigger | None. No app icon, no push, no email. You must self-trigger. |
| Action | Expensive. Multi-second silent loads, spreadsheet UI, modal forms, full refetch per tap. |
| Reward | Invisible. No positive stats, payoff features hidden in a dropdown, success renders as empty states. |
| Investment | Punished. Data drift makes past effort *reduce* future trust instead of compounding it. |

And one meta-problem: **the brand promises play, the product delivers ERP.** It's named after a battle-cooking anime, styled like a Japanese diner — and contains zero playful mechanics. No challenges, no streaks, no win states. The gap between what the name promises and what the screens deliver *is* the motivation gap.

---

## What already works — keep and build on

- Undo on every destructive action (8s window) — best-in-class trust feature.
- Defaults-driven Add Stock (unit/location/store/due-date auto-fill).
- Purchase-from-list with unit conversion; auto-generate lists; auto-add on below-min consume.
- Freezer due-date intelligence.
- One-tap **Cook** with auto-consume + undo.
- The quick-combo algorithm (protein + seasoning + base, expiry-prioritized).
- The MCP server — as an *input* channel it's the cheapest data entry you'll ever build.

---

## Prioritized fixes (motivation gained per unit effort)

### P0 — make it stop feeling broken (days, not weeks)

1. **Add `loading.tsx` skeletons to every route.** Cheapest possible change; converts "frozen" into "working".
2. **Bottom tab bar on mobile** — Stock · Cook · Lists · Plan · More. Surfaces the payoff features you already built; kills the avatar-dropdown tax. (This is probably the single highest-leverage change in the list.)
3. **Optimistic quick actions.** Update the row locally, sync in the background, reconcile on failure — stop calling `router.refresh()` per tap.
4. **Batch the Add Stock inserts** — one multi-row insert (or RPC) instead of 2N sequential round-trips.
5. **Kill the image N+1** — public bucket (images are product photos, not secrets) or batch-sign once server-side and cache.
6. **PWA basics** — manifest, icons, minimal service worker. Home-screen icon + instant shell = the difference between "open an app" and "remember a URL".

### P1 — flip the reward loop (the motivation work)

7. **Reorder the home page:** "Tonight" hero first (ready recipes + quick combos + one expiring-soon highlight), alerts second, add-buttons demoted to a FAB. The front door should answer *"what's for dinner?"*, not *"what data will you enter?"*.
8. **Build the scorecard:** meals cooked this week, £ consumed vs £ wasted, items rescued (consumed within N days of expiry), current zero-waste streak. The data already exists in `stock_log`. Put one number on the home screen.
9. **Record waste where it happens:** when consuming an expired/overdue item, one inline choice — "Ate it 🍽 / Tossed it 🗑" — instead of a checkbox buried in a modal. Without this the mission metric stays empty forever.
10. **A daily digest that reaches you:** Vercel cron (or a Claude Routine via your MCP server) → email/ntfy/Telegram at 17:00: "Chicken expires tomorrow → chicken + gochujang + rice?" You already have `/api/notifications/expiring` and the combos util; this is plumbing, not invention.
11. **Give the staging area a payoff:** buttons for "Save as meal idea → meal plan", "Consume these", "Draft recipe with AI". Never end a flow on "Clear".

### P2 — lower the ledger tax

12. **Reconcile mode:** swipe through in-stock products — "still have / gone / less" — 60 seconds to restore trust after a sloppy week.
13. **Fuzzy quantities for don't-care products:** track "have / low / out" instead of grams for condiments and staples. Gram-precision is Grocy DNA; you don't have to inherit it everywhere.
14. **One-field product creation** (name → sensible defaults for everything), with the 5-tab form as an "edit details" follow-up, not the entry gate.

### P3 — let the theme do work

15. Weekly **shokugeki**: "these 3 items expire this week — cook them and win." Streaks, a win screen, playful copy. The brand is begging for it.

### Also fix

16. **Don't silently fall back to guest data** on session expiry (`middleware.ts:42–44`) — show "session expired, sign back in" instead. Seeing demo food where your food should be reads as data loss.

---

## What *not* to do

Don't add another AI/automation layer to route around UI friction until the loop above is fixed. Automated input into an app whose reward surfaces are empty just produces a very well-fed database nobody looks at. (Keep the MCP server — but let it be the hands, not the face.)

And a calibration note: some of this tax is inherent to the genre — plenty of Grocy users burn out the same way. The apps that survive minimize *entries per week* and maximize *decisions per entry*. Every fix above serves one of those two goals.
