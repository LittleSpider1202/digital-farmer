# Design System: The Digital Homestead

## 1. Overview & Creative North Star
**Creative North Star: "The Modern Agrarian Editorial"**

This design system rejects the "utilitarian spreadsheet" look common in agricultural software. Instead, it adopts a high-end editorial approach that treats agricultural data with the same prestige as a luxury lifestyle journal. 

We achieve "Professionalism" and "Trust" not through rigid boxes, but through **Organic Brutalism**. This means using large, authoritative typography (High Contrast) paired with soft, layered surfaces that mimic the natural stratification of soil and landscape. By moving away from standard borders and adopting a "Surface-First" architecture, we create a digital environment that feels breathable, modern, and profoundly accessible for the "Digital Farmer."

---

## 2. Colors & Surface Architecture

### The Palette
The palette is rooted in the earth but polished by technology.
- **Primary (`#0d631b`)**: Used for high-action "Growth" moments.
- **Primary Container (`#2e7d32`)**: The "Fertile Soil" for main call-to-actions.
- **Secondary (`#7a5649`)**: Earthy Brown for grounding accents and hardware-related status.
- **Tertiary (`#923357`)**: A muted "Harvest Berry" used sparingly for critical alerts or "Ripeness" indicators.

### The "No-Line" Rule
**Strict Mandate:** 1px solid borders for sectioning are prohibited. 
Structure must be defined by **Tonal Transitions**. Use the difference between `surface` (#f7fbf0) and `surface_container_low` (#f1f5eb) to define content areas. This creates a "seamless landscape" feel rather than a fragmented grid.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers:
1.  **Base Layer**: `surface` (#f7fbf0) – The wide-open field.
2.  **Section Layer**: `surface_container` (#ebefe5) – Grouping related data.
3.  **Content Cards**: `surface_container_lowest` (#ffffff) – High-contrast "sheets of paper" that float above the soil to highlight specific actions or data points.

### The "Glass & Gradient" Rule
To add a "Tech-Forward" signature:
- Use **Glassmorphism** for bottom navigation bars and floating action buttons (FABs). Apply a `surface_container_low` color at 80% opacity with a `20px` backdrop-blur.
- Use **Signature Gradients** for primary buttons: A linear transition from `primary` (#0d631b) to `primary_container` (#2e7d32) at 135 degrees. This adds "visual soul" and prevents the UI from looking flat or "cheap."

---

## 3. Typography: The Authoritative Voice
In the "Digital Farmer" context, typography is the most critical accessibility tool. We use a high-contrast scale to ensure legibility in high-glare outdoor environments.

- **Display (Lexend)**: Used for large data readouts (e.g., "24°C" or "90% Humidity"). Lexend’s geometric clarity provides a modern, high-tech feel.
- **Headline (Lexend)**: Bold, assertive titles for main modules.
- **Body & Title (Public Sans / Standard Chinese Sans)**: Optimized for reading long-form advice or equipment manuals.

**Editorial Rule:** Always pair a `headline-lg` with a `body-md` in `on_surface_variant` (#40493d) to create a clear visual anchor. Never center-align long text; maintain a "strong left-edge" to mimic editorial layouts.

---

## 4. Elevation & Depth: Tonal Layering

### The Layering Principle
Depth is achieved by stacking, not by "dropshadowing." 
- Place a `surface_container_highest` (#e0e4da) card on a `surface` background to indicate "Active" or "Pressable."
- Use **Ambient Shadows** only for critical floating elements (like a "Call Expert" button). 
  - *Spec:* Blur: 24px, Spread: 0, Color: `on_surface` at 6% opacity. This mimics natural light filtered through a canopy.

### The "Ghost Border" Fallback
If a boundary is required for accessibility (e.g., input fields), use a **Ghost Border**: 
- Token: `outline_variant` (#bfcaba) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Large-Target Buttons
- **Primary**: Gradient-filled (`primary` to `primary_container`), `xl` (1.5rem) corner radius. Height: 56px minimum for easy thumb-tapping in the field.
- **Secondary**: `surface_container_high` background with `on_surface` text. No border.

### Information Cards (Agricultural Tiles)
- **Rule**: Forbid divider lines. Use `3` (1rem) spacing between items.
- **Structure**: A `surface_container_lowest` card with a `md` (0.75rem) corner radius. Use a `secondary` (#7a5649) icon in the top right to denote "Equipment" or "Soil" categories.

### Large-Scale Inputs
- For farmers, input fields must be massive. 
- Background: `surface_container_low`. 
- Active State: `primary` Ghost Border (20% opacity) and a `primary` cursor.

### Chips (Crop/Status Selectors)
- **Unselected**: `surface_container_high` background, no border.
- **Selected**: `primary_container` background, `on_primary_container` text.

### Navigation (The WeChat Bottom Bar)
- Use a **Glassmorphism Blur**. 
- Icons: Simple, thick-stroke (2pt) icons to ensure visibility in sunlight.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `20` (7rem) or `24` (8.5rem) spacing at the bottom of pages to ensure the "Thumb Zone" is clear.
- **Do** use `surface_bright` for peak highlights in data visualizations.
- **Do** use `tertiary` (#923357) for "Urgent Action Required" (e.g., Pest Alert), as it contrasts naturally with the green environment.

### Don't
- **Don't** use pure black (#000000). Use `on_surface` (#181d17) for a softer, premium feel.
- **Don't** use 1px lines to separate list items. Use a `1.5` (0.5rem) vertical gap and a background shift.
- **Don't** use small icons. All touch targets must be at least 44x44px, but ideally 56x56px for agricultural use cases.
- **Don't** crowd the screen. If a farmer is using this in the field, "White Space" is "Focus Space." Use the `10` (3.5rem) spacing token generously between major sections.