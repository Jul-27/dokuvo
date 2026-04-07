# Dokuvo Frontend Redesign — Design Spec

## Overview

Complete frontend redesign of Dokuvo, a German AI-powered document analysis SPA. The goal is to transform the current functional but generic dark UI into a distinctive, polished experience that conveys trust, intelligence, and accessibility — fitting for an app that explains complex legal and bureaucratic documents to everyday users.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Color palette | Deep Blue — refined | Keep existing blue identity, but deepen backgrounds, add subtle gradients, reduce generic Tailwind-blue feel |
| Typography | Plus Jakarta Sans | Distinctive, modern, geometric but warm. Replaces Inter (app) and DM Sans (landing). Single font family everywhere |
| Chat layout | Card-based analysis | Structured cards for Risiken, Fristen, Glossar, Zusammenfassung instead of flat text. Scannable dashboard-in-chat |
| Architecture | CSS extraction | Move all styles from index.html into `public/styles.css`. Redesign there |
| Scope | Full: CSS + HTML + Landing | Unified brand from landing page through app |

## Architecture: CSS Extraction

### Current State
- `public/index.html`: ~5838 lines containing inline `<style>` block (~2700 lines of CSS), HTML structure, and `<script>` block
- `public/landing.html`: Separate file with its own inline styles and different design system (DM Sans + DM Serif Display)
- Many hardcoded hex values instead of CSS variables
- Duplicate/conflicting style rules (e.g., `.app-header` defined twice)
- Multiple `!important` hacks in media queries

### Target State
- `public/styles.css`: All app styles, organized by component section
- `public/landing.css`: All landing page styles, sharing the same design tokens
- `public/index.html`: `<link rel="stylesheet" href="styles.css">` replaces the `<style>` block
- `public/landing.html`: `<link rel="stylesheet" href="landing.css">` replaces inline styles

## Design System

### Color Tokens (CSS Custom Properties)

```css
:root {
  /* Backgrounds */
  --bg-base: #060B18;
  --bg-surface: #0B1225;
  --bg-elevated: #111827;
  --bg-overlay: #162036;
  
  /* Borders */
  --border-subtle: rgba(37, 99, 235, 0.08);
  --border-default: rgba(37, 99, 235, 0.12);
  --border-strong: rgba(37, 99, 235, 0.2);
  
  /* Text */
  --text-primary: #E8EAED;
  --text-secondary: #94A3B8;
  --text-muted: #4A5568;
  --text-dim: #2D3748;
  
  /* Accent — Deep Blue */
  --accent: #2563EB;
  --accent-light: #3B82F6;
  --accent-lighter: #60A5FA;
  --accent-glow: rgba(37, 99, 235, 0.15);
  --accent-surface: rgba(37, 99, 235, 0.04);
  --accent-border: rgba(37, 99, 235, 0.12);
  
  /* Semantic colors */
  --danger: #EF4444;
  --danger-surface: rgba(239, 68, 68, 0.08);
  --danger-border: rgba(239, 68, 68, 0.15);
  
  --warning: #FBBF24;
  --warning-surface: rgba(245, 158, 11, 0.06);
  --warning-border: rgba(245, 158, 11, 0.12);
  
  --success: #34D399;
  --success-surface: rgba(16, 185, 129, 0.06);
  --success-border: rgba(16, 185, 129, 0.12);
  
  --info: #60A5FA;
  --purple: #8B5CF6;
  --purple-surface: rgba(139, 92, 246, 0.06);
  --purple-border: rgba(139, 92, 246, 0.12);
  
  --cyan: #06B6D4;
  --orange: #F97316;
  --indigo: #6366F1;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  
  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 24px rgba(37, 99, 235, 0.08);
  
  /* Typography */
  --font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 0.7rem;
  --font-size-sm: 0.8rem;
  --font-size-base: 0.9rem;
  --font-size-lg: 1.05rem;
  --font-size-xl: 1.3rem;
  --font-size-2xl: 1.6rem;
  --font-size-3xl: 2rem;
}
```

### Typography

- **Font**: Plus Jakarta Sans (weights: 400, 500, 600, 700, 800)
- **Headings**: weight 700-800, letter-spacing -0.02em to -0.03em
- **Body**: weight 400-500, line-height 1.6
- **Labels/Captions**: weight 600-700, uppercase, letter-spacing 0.06-0.08em, font-size-xs
- **Landing page headings**: Plus Jakarta Sans weight 800 (replaces DM Serif Display)

## Component Redesigns

### 1. Auth Screen
- Background: `--bg-base` with subtle radial gradient glow behind card
- Card: `--bg-elevated` with `--border-subtle`, no box container visible — floating inputs
- Inputs: `--bg-surface` background, `--border-default` on focus becomes `--accent`
- Primary button: gradient from `--accent` to slightly darker, subtle glow on hover
- Tab switcher: pill-style with `--bg-surface` inactive, `--accent-surface` + `--accent-border` active

### 2. Sidebar
- Background: `--bg-base` (deepest)
- Logo section: Plus Jakarta Sans weight 800
- Nav items: `--text-muted` default, `--text-primary` + `--accent-surface` background on active
- Session items: subtle hover with `--bg-elevated`, active with `--accent-border` left border (3px)
- Search input: `--bg-surface` with icon, softer corners
- Footer/user section: cleaner avatar with gradient, plan badge
- New chat button: `--accent` with subtle glow shadow
- Scrollbar: 3px wide, `--bg-overlay` thumb

### 3. Chat Area
- Background: `--bg-surface` with subtle grid pattern (keep existing, but use `--accent` at 0.02 opacity)
- User bubble: `--accent-surface` with `--accent-border`, right-aligned, softer radius (16px 16px 4px 16px)
- Assistant response: No bubble — left-aligned with Dokuvo avatar icon, text flows directly
- Analysis blocks become **structured cards**:

#### Analysis Card System
Each analysis type gets a card with:
- Colored left border (3px) matching its semantic color
- Background: semantic color at 0.04 opacity
- Border: semantic color at 0.10 opacity
- Title: uppercase label in semantic color
- Content: structured list items

| Block | Left Border | Surface | Label Color |
|---|---|---|---|
| Risiken | `--warning` | `--warning-surface` | `--warning` |
| Fristen | `--accent-light` | `--accent-surface` | `--accent-lighter` |
| Zusammenfassung | `--purple` | `--purple-surface` | `--purple` |
| Glossar | `--cyan` | cyan-surface | `--cyan` |
| Checkliste | `--orange` | orange-surface | `--orange` |
| Handlungen | `--success` | `--success-surface` | `--success` |
| Statistiken | `--indigo` | indigo-surface | `--indigo` |

### 4. Chat Input
- Wrapper: `--bg-elevated` with `--border-default`, 16px radius
- On focus: `--accent-border` + `--shadow-glow`
- Depth slider: cleaner pill buttons with `--accent-surface` active state
- Send button: `--accent` with white icon, rounded, subtle scale on hover
- Attach/mic buttons: `--text-muted`, hover to `--text-secondary`

### 5. Persistent Topbar (Desktop, sidebar collapsed)
- Clean bar with sidebar toggle, logo, plan badge, "Neuer Chat" button
- Background: `--bg-base` with backdrop-filter blur
- Thinner border bottom: `--border-subtle`

### 6. Mobile Bottom Nav
- Background: `--bg-base`
- Active item: `--accent-light` color, subtle dot indicator above icon instead of full color change
- Inactive: `--text-muted`

### 7. Mobile Header
- Background: `--bg-base` at 0.95 opacity + blur
- Sidebar toggle icon left, logo center, action right

### 8. Tab Panels (Templates, Premium, Profile, Team, About)

**Templates grid:**
- Cards: `--bg-elevated` with `--border-subtle`, colored icon backgrounds
- Hover: `--accent-border` + subtle background shift

**Premium:**
- Hero gradient: deeper blue gradient (from `--accent` darker to `--accent`)
- Feature list: check icons with `--success` background circles
- Price: large weight 800

**Profile:**
- Avatar: gradient circle with initials
- Settings items: clean list with icon, label, chevron
- Sections: `--bg-elevated` cards with consistent spacing

**Teams:**
- Team cards with member count badge
- Invite section with email input

### 9. Modals (Share, Compare, Team)
- Overlay: rgba(0,0,0,0.6) + backdrop-filter blur(8px)
- Modal: `--bg-elevated` with `--border-default`, 16px radius
- Shadow: `--shadow-lg`

### 10. Onboarding Tour
- Tooltip: `--bg-elevated` with `--accent-border`
- Highlight: box-shadow spotlight with `--accent` border
- Buttons: skip=ghost, next=`--accent` filled

### 11. Landing Page Alignment
- Replace DM Sans + DM Serif Display with Plus Jakarta Sans
- Map landing CSS variables to match new app tokens:
  - `--bg` → `--bg-base`
  - `--surface` → `--bg-surface`
  - `--accent` → `--accent` (same blue)
- Hero: Plus Jakarta Sans weight 800 for large headings
- Nav: match app header style
- Cards/sections: same radius, border, surface treatment as app
- CTA buttons: same gradient/glow as app buttons

## HTML Structure Improvements

### Cleanup targets (no JS logic changes):
1. **Remove duplicate style rules** — `.app-header` is defined twice, `.text-area:focus` duplicated
2. **Replace hardcoded hex values** with CSS variable references in HTML `style=""` attributes where practical
3. **Improve semantic class names** where they conflict (e.g., `.tab-panel` defined twice)
4. **Clean up `!important` overrides** in media queries by proper CSS specificity ordering

### HTML changes:
1. Add `<link rel="stylesheet" href="styles.css">` to `<head>`
2. Remove entire `<style>...</style>` block
3. Add `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">` (replace Inter)
4. Same pattern for `landing.html` with `landing.css`

## What NOT to Change

- **No JavaScript modifications** — all functions, event handlers, API calls stay untouched
- **No HTML element IDs** — JS references these for DOM manipulation
- **No structural DOM changes** that would break JS selectors (querySelector, getElementById)
- **No new HTML elements** unless purely decorative (pseudo-elements in CSS preferred)
- **No build tooling** — stays as plain CSS files, no preprocessor

## Testing Strategy

- Visual regression: manually verify each tab/panel after CSS extraction
- Mobile: test at 375px (iPhone SE) and 768px breakpoint
- Desktop: test sidebar open/closed states
- Auth screen: verify login/register flow looks correct
- Chat: verify message rendering, analysis blocks, input area
- Modals: verify all overlays render correctly
- Landing page: verify responsive behavior matches current

## File Deliverables

| File | Action |
|---|---|
| `public/styles.css` | New — all app styles |
| `public/landing.css` | New — all landing page styles |
| `public/index.html` | Modified — remove `<style>` block, add `<link>`, update font |
| `public/landing.html` | Modified — remove `<style>` block, add `<link>`, update font |
