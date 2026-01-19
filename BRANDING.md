# 🍳 Food Wars - Brand & Design Guide

> "A war against food waste, inspired by the spirit of creative cooking"

---

## Name Options

### Primary: **Food Wars**
- ✅ Perfect double meaning (anime + anti-waste mission)
- ✅ Memorable and punchy
- ⚠️ Trademark consideration: "Food Wars!" is the English title of Shokugeki no Soma
- 💡 For a personal FOSS project, likely fine. If scaling commercially, consider alternatives.

### Alternatives (if needed):
| Name | Japanese | Meaning |
|------|----------|---------|
| **Meshi Wars** | メシウォーズ | "Meal Wars" - avoids direct trademark |
| **Shokudo** | 食堂 | "Dining hall" - classic diner vibe |
| **Yukihira** | 幸平 | MC's family restaurant name |
| **Pantry Shokugeki** | パントリー食戟 | "Pantry Food Battle" |
| **Fridge Wars** | — | More specific to the app's purpose |

**Recommended:** Stick with **Food Wars** for personal use, consider **Meshi Wars** if you want to be safe.

---

## Color Palette (Extracted from Characters)

### Primary Colors

```css
:root {
  /* SOMA RED - Hero/Action color (Yukihira Soma's hair) */
  --soma-red: #C41E3A;
  --soma-red-light: #E63950;
  --soma-red-dark: #8B1528;
  
  /* MEGUMI NAVY - Primary dark (Tadokoro's hair + uniforms) */
  --megumi-navy: #1E3A5F;
  --megumi-navy-light: #2C5282;
  --megumi-navy-dark: #1A202C;
  
  /* HAYAMA SILVER - Neutral/Background (Akira's hair) */
  --hayama-silver: #E8E8E8;
  --hayama-silver-light: #F7F7F7;
  --hayama-silver-dark: #C0C0C0;
}
```

### Accent Colors

```css
:root {
  /* HISAKO PINK - Soft accent (Arato's hair) */
  --hisako-pink: #E6B8D4;
  --hisako-pink-light: #F5D5E8;
  --hisako-pink-dark: #D4A5C2;
  
  /* TAKUMI GOLD - Highlight/Warning (Aldini's hair) */
  --takumi-gold: #D4AF37;
  --takumi-gold-light: #F0D060;
  --takumi-gold-dark: #B8960C;
  
  /* KUROKIBA MAROON - Danger/Expiring (Ryō's hair) */
  --kurokiba-maroon: #722F37;
  --kurokiba-maroon-light: #8B4049;
  --kurokiba-maroon-dark: #5C2630;
}
```

### Semantic Usage

| Purpose | Color | Hex | Usage |
|---------|-------|-----|-------|
| **Primary Action** | Soma Red | `#C41E3A` | Buttons, CTAs, links |
| **Background Dark** | Megumi Navy | `#1E3A5F` | Headers, sidebars, cards |
| **Background Light** | Hayama Silver | `#E8E8E8` | Page backgrounds |
| **Success/Fresh** | — | `#2D8B4E` | Fresh items, in-stock |
| **Warning/Expiring Soon** | Takumi Gold | `#D4AF37` | Items expiring in 3-7 days |
| **Danger/Expired** | Kurokiba Maroon | `#722F37` | Expired items, delete |
| **Accent/Highlight** | Hisako Pink | `#E6B8D4` | Selected states, badges |

---

## Japanese Mom & Pop Diner Aesthetic (居酒屋/食堂)

### Visual Elements

```
┌─────────────────────────────────────────────────────────┐
│  🏮 FOOD WARS 食戟                              ≡ Menu │  ← Noren curtain header
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ ░░░░░░░░░░░ │ │ ░░░░░░░░░░░ │ │ ░░░░░░░░░░░ │        │  ← Wood-textured cards
│ │  🥚 Eggs    │ │  🥩 Chicken │ │  🧅 Onions  │        │
│ │  x6         │ │  500g       │ │  x3         │        │
│ │  Exp: 3 days│ │  Exp: 2 days│ │  Fresh      │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                         │
│ ╔═══════════════════════════════════════════════════╗  │
│ ║  📋 今日のおすすめ (Today's Recommendations)      ║  │  ← Chalkboard menu style
│ ║  • Oyakodon - uses chicken & eggs (expiring!)    ║  │
│ ║  • Onion soup - use those onions                 ║  │
│ ╚═══════════════════════════════════════════════════╝  │
│                                                         │
│  [ 🛒 Shopping List ]  [ 🍳 What Can I Cook? ]         │  ← Lantern-style buttons
└─────────────────────────────────────────────────────────┘
```

### Key Design Elements

1. **Noren (暖簾) Curtain Header**
   - Fabric-like texture with vertical stripes
   - App name with kanji: "Food Wars 食戟"
   - Red/navy color scheme

2. **Wood Grain Textures**
   - Warm cedar/hinoki wood for card backgrounds
   - Subtle grain pattern, not overwhelming
   - Evokes wooden counter seating

3. **Chalkboard/Menu Board Sections**
   - Dark slate background with chalk-like text
   - Handwritten font for recommendations
   - White/cream text on dark

4. **Paper Lantern (提灯) Elements**
   - Rounded buttons with soft glow effect
   - Warm orange/red accents
   - Subtle shadow suggesting depth

5. **Steam/Smoke Effects**
   - Subtle animated wisps on hot items
   - Creates "freshly cooked" atmosphere

6. **Hand-drawn Icons**
   - Sketch-style food icons
   - Imperfect, charming line art
   - Not sterile corporate icons

---

## Typography

### Fonts

```css
/* Headers - Japanese diner feel */
@import url('https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap');

/* Body - Clean, readable */
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');

/* Handwritten/Menu style */
@import url('https://fonts.googleapis.com/css2?family=Yomogi&display=swap');

:root {
  --font-display: 'Dela Gothic One', sans-serif;  /* Bold headers */
  --font-body: 'Zen Kaku Gothic New', sans-serif; /* Japanese-friendly body */
  --font-handwritten: 'Yomogi', cursive;          /* Menu/recommendations */
}
```

### Usage

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Logo/App Name | Dela Gothic One | 400 | 32px |
| Section Headers | Dela Gothic One | 400 | 24px |
| Card Titles | Zen Kaku Gothic | 700 | 18px |
| Body Text | Zen Kaku Gothic | 400 | 16px |
| Menu/Recommendations | Yomogi | 400 | 18px |
| Labels/Captions | Zen Kaku Gothic | 500 | 14px |

---

## Component Styles

### Buttons

```css
/* Primary Button - Lantern style */
.btn-primary {
  background: linear-gradient(180deg, #E63950 0%, #C41E3A 100%);
  border: none;
  border-radius: 24px;
  padding: 12px 24px;
  color: white;
  font-family: var(--font-display);
  box-shadow: 
    0 4px 6px rgba(196, 30, 58, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 6px 12px rgba(196, 30, 58, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
```

### Cards (Wood texture)

```css
.card-item {
  background: 
    linear-gradient(rgba(255,255,255,0.03), rgba(0,0,0,0.03)),
    url('/textures/wood-grain.png');
  background-color: #DEB887; /* Fallback burlywood */
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.1);
  box-shadow: 
    0 2px 4px rgba(0,0,0,0.1),
    inset 0 1px 0 rgba(255,255,255,0.1);
}
```

### Chalkboard Section

```css
.chalkboard {
  background: linear-gradient(135deg, #2C3E50 0%, #1C2833 100%);
  border-radius: 4px;
  padding: 20px;
  font-family: var(--font-handwritten);
  color: #F5F5DC; /* Beige/cream like chalk */
  border: 4px solid #5D4037; /* Wood frame */
  box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
}
```

### Status Badges

```css
/* Fresh/Plenty */
.badge-fresh {
  background: #2D8B4E;
  color: white;
}

/* Expiring Soon (3-7 days) */
.badge-warning {
  background: var(--takumi-gold);
  color: #1A202C;
}

/* Expiring Very Soon (1-2 days) */
.badge-urgent {
  background: var(--soma-red);
  color: white;
  animation: pulse 2s infinite;
}

/* Expired */
.badge-expired {
  background: var(--kurokiba-maroon);
  color: white;
  text-decoration: line-through;
}
```

---

## Logo Concepts

### Option A: Noren Style
```
┌──────────────────────────┐
│ ┃  ┃  ┃  ┃  ┃  ┃  ┃  ┃  │  ← Noren curtain fringe
│    🍳 FOOD WARS         │
│       食  戟             │  ← Kanji underneath
│                          │
└──────────────────────────┘
```

### Option B: Battle/Clash Style
```
   ╱╲    FOOD    ╱╲
  ╱  ╲  ═══════  ╱  ╲
 ╱ 🔥 ╲  WARS  ╱ 🔥 ╲
        食戟
```

### Option C: Minimal Lantern
```
    ┌───────┐
    │ FOOD  │
   ┌┤ WARS  ├┐
   │└───────┘│
   │  食戟   │
    ╲       ╱
     ╲_____╱
```

---

## Dark Mode Palette

```css
:root[data-theme="dark"] {
  --bg-primary: #1A202C;      /* Near black */
  --bg-secondary: #2D3748;    /* Dark slate */
  --bg-card: #2C3E50;         /* Card background */
  --text-primary: #F7FAFC;    /* Off-white */
  --text-secondary: #A0AEC0;  /* Muted */
  
  /* Accents stay vibrant */
  --accent-primary: #E63950;  /* Brighter soma red */
  --accent-gold: #F0D060;     /* Brighter gold */
}
```

---

## Animation Guidelines

### Subtle Interactions
- **Hover**: 2px lift with shadow increase (150ms ease)
- **Click**: Scale down 0.98 (100ms)
- **Page transitions**: Slide from right (300ms ease-out)

### Thematic Animations
- **Steam effect**: CSS animation on fresh/hot items
- **Lantern glow**: Subtle pulse on primary buttons
- **Noren sway**: Gentle horizontal movement on header

```css
@keyframes steam {
  0% { opacity: 0; transform: translateY(0) scale(1); }
  50% { opacity: 0.6; }
  100% { opacity: 0; transform: translateY(-20px) scale(1.5); }
}

@keyframes lantern-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(196, 30, 58, 0.3); }
  50% { box-shadow: 0 0 20px rgba(196, 30, 58, 0.5); }
}
```

---

## Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'soma': {
          DEFAULT: '#C41E3A',
          light: '#E63950',
          dark: '#8B1528',
        },
        'megumi': {
          DEFAULT: '#1E3A5F',
          light: '#2C5282',
          dark: '#1A202C',
        },
        'hayama': {
          DEFAULT: '#E8E8E8',
          light: '#F7F7F7',
          dark: '#C0C0C0',
        },
        'hisako': {
          DEFAULT: '#E6B8D4',
          light: '#F5D5E8',
          dark: '#D4A5C2',
        },
        'takumi': {
          DEFAULT: '#D4AF37',
          light: '#F0D060',
          dark: '#B8960C',
        },
        'kurokiba': {
          DEFAULT: '#722F37',
          light: '#8B4049',
          dark: '#5C2630',
        },
      },
      fontFamily: {
        'display': ['Dela Gothic One', 'sans-serif'],
        'body': ['Zen Kaku Gothic New', 'sans-serif'],
        'handwritten': ['Yomogi', 'cursive'],
      },
    },
  },
}
```

---

## Quick Reference

| Character | Color Name | Hex | Use For |
|-----------|-----------|-----|---------|
| Yukihira Soma | Soma Red | `#C41E3A` | Primary actions, hero elements |
| Tadokoro Megumi | Megumi Navy | `#1E3A5F` | Backgrounds, headers |
| Hayama Akira | Hayama Silver | `#E8E8E8` | Light backgrounds, borders |
| Arato Hisako | Hisako Pink | `#E6B8D4` | Highlights, selected states |
| Aldini Takumi | Takumi Gold | `#D4AF37` | Warnings, expiring soon |
| Kurokiba Ryō | Kurokiba Maroon | `#722F37` | Danger, expired items |

---

## Mood Board Keywords

- Warm & inviting
- Nostalgic Japanese diner
- Handcrafted, not corporate
- Playful but functional
- "Come in, sit down, eat well"
- Fighting spirit against waste
- Community kitchen feel

---

*"The secret ingredient is always love... and not letting food expire."* 🍳
