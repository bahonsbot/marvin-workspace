# Weather/Time Widget — Implementation Plan
**Status:** Revision 2 (addresses operator feedback)
**Component:** `SidebarAmbientWidget` in `components/shell/Sidebar.tsx`
**Design system:** FLOATING / Mission Control General Domain

---

## Operator Feedback

1. ✅ Keep the dynamic time/colour concept
2. ❌ Temperature uses a large serif font (Georgia) — change to a **clean sans-serif**
3. ❌ Widget fills the full sidebar width — make it **slimmer, compact, or circular**

---

## Design Concept: "Floating Orb"

Replace the full-width card with a compact, elegant **floating orb** — a glassy circular widget that sits at the bottom of the sidebar, showing time and temperature in a contained, balanced composition. It breathes, it shifts colour through the day, and it is genuinely small.

### Visual Description
- **Shape:** Circle, ~100px diameter
- **Layout:** Stacked vertical — time on top (large, bold), temperature below (clean weight, sans-serif)
- **Weather condition label:** Small strip below the orb
- **Colour shift:** Background and accent tint shift by time of day
- **Location in sidebar:** Bottom, full-width container padded on sides, no extra chrome

### Dynamic Colour System (Time-of-Day)

| Period | Time (HCMC) | Background | Accent Tint |
|---|---|---|---|
| Dawn | 05:00–07:00 | `#f4ede6` → `#f9f5f0` | Muted peach-rose |
| Morning | 07:00–11:00 | `#f9f5f0` → `#f5f0eb` | Warm amber-green |
| Midday | 11:00–14:00 | `#f5f0eb` → `#f0ece6` | Warm neutral |
| Afternoon | 14:00–17:00 | `#f0ece6` → `#eae6de` | Warm stone |
| Evening | 17:00–20:00 | `#e8e0d8` → `#ddd6cc` | Dusky amber |
| Night | 20:00–23:00 | `#ddd6cc` → `#d4cdc4` | Cool grey-green |
| Late Night | 23:00–05:00 | `#d4cdc4` → `#c8c2ba` | Deep cool |

### Typography

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Time | `var(--font-sans)` | 22px | 700 | Bold, monospace-style numerals via `font-variant-numeric: tabular-nums` |
| Temperature | `var(--font-sans)` | 15px | 500 | Clean, NOT serif. Balanced with other sidebar text (13px nav items) |
| Date / condition | `var(--font-sans)` | 11px | 400 | Muted, small caps style |

### Widget Dimensions

```
Sidebar padding: 14px each side
Orb diameter: 100px
Container: full sidebar width minus 28px (14px × 2 padding)
Centered horizontally
```

### Circular Layout Breakdown

```
┌─────────────────────────────┐
│         Hoi An, Vietnam       │  ← 11px, muted, small caps
│                             │
│          ┌──────┐           │
│          │ 32°  │           │  ← 22px bold time (inside orb)
│          │  32  │           │  ← 15px sans-serif temp (inside orb)
│          └──────┘           │
│                             │
│     Partly cloudy · ☁       │  ← 11px condition + icon strip
└─────────────────────────────┘
```

### Animation
- Background colour transitions smoothly via CSS `transition: background 2s ease`
- Subtle box-shadow pulse on the orb (opacity 0.12 → 0.20) every 4s to give it life

---

## Implementation Steps

### Step 1 — Refactor `SidebarAmbientWidget` layout
- Remove the full-width card grid
- Add a circular orb div with fixed dimensions (100×100px)
- Move time and temperature inside the orb, vertically stacked and centred
- Place condition label and date below the orb, not inside it
- Keep the glassmorphism treatment (backdrop blur, subtle border)

### Step 2 — Switch temperature to sans-serif
- Replace `fontFamily: 'Georgia, "Times New Roman", serif'` on the temperature element
- Inherit `var(--font-sans)` — no serif anywhere in the widget
- Use `fontVariantNumeric: 'tabular-nums'` on both time and temperature so numbers don't shift as they change

### Step 3 — Implement dynamic colour system
- Create a `getTimeSlot()` helper that maps current hour to a named slot
- Create a `TIME_SLOTS` colour map object matching the table above
- Apply `background` and `accentTint` to the orb and the container div
- Use CSS `transition` for smooth colour interpolation (2s ease)

### Step 4 — Trim container width
- Remove the full-width card approach entirely
- The sidebar already provides a fixed-width column (~200px)
- The orb sits inside a thin inner container (centered) with no additional padding that expands it
- Add a small `maxWidth: 'calc(100% - 0px)'` or remove the full-width grid gap that was previously stretching it

### Step 5 — Polish
- Ensure `border-radius: 50%` on the orb
- Use a subtle `box-shadow` with the accent tint colour for the glow
- Weather icon stays at 14px, inside the condition strip below the orb
- Keep the `backdrop-filter: blur(18px)` for the glass effect

---

## File Changes

| File | Change |
|---|---|
| `components/shell/Sidebar.tsx` | Full refactor of `SidebarAmbientWidget` — new layout, new colour system, sans-serif temperature |

## Verification Checklist

- [ ] Temperature renders in sans-serif, not serif
- [ ] Widget does not span full sidebar width — orb is compact and centred
- [ ] Background colour shifts when time passes a period boundary (or on reload with different time)
- [ ] Time and temperature are both `tabular-nums` so values don't shift
- [ ] Widget still looks good at the narrowest sidebar width (~180px)
- [ ] All existing weather API logic (Open-Meteo fetch, WMO code map) is preserved
- [ ] No layout break on General domain sidebar at any viewport height

---

## CSS Variables Used (Already Defined)

```css
--font-sans       /* Avenir Next — clean sans-serif for temperature */
--accent-mid      /* #3c6658 forest green — accent tint for glow/shadow */
--accent-deep     /* #0f1f19 — used in orb text */
--text-muted      /* #7a7a7a — used for condition/date labels */
--bg-sidebar      /* gradient — container inherits this as base */
```
