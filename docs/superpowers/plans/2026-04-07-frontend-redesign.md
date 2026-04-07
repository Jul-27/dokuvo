# Dokuvo Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Dokuvo's frontend from a generic dark UI into a distinctive, polished Deep Blue design with Plus Jakarta Sans typography, card-based analysis layout, and unified branding across app + landing page.

**Architecture:** Extract all inline CSS from `index.html` (lines 13–2779) and `landing.html` (lines 10–565) into separate `styles.css` and `landing.css` files. Redesign the token system, then restyle every component. HTML changes are limited to font link swaps, `<link>` additions, and removing duplicate/conflicting CSS rules in the `<style>` block.

**Tech Stack:** Plain CSS (no preprocessor), Plus Jakarta Sans via Google Fonts, vanilla HTML

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `public/styles.css` | Create | All app styles — extracted from index.html, redesigned |
| `public/landing.css` | Create | All landing page styles — extracted from landing.html, redesigned |
| `public/index.html` | Modify | Remove `<style>` block (lines 13–2779), add `<link>` to styles.css, swap Inter → Plus Jakarta Sans |
| `public/landing.html` | Modify | Remove `<style>` block (lines 10–565), add `<link>` to landing.css, swap DM Sans/Serif → Plus Jakarta Sans |

---

### Task 1: Extract App CSS and Set Up New Design Tokens

**Files:**
- Create: `public/styles.css`
- Modify: `public/index.html` (lines 7–8 font link, lines 13–2779 style block removal, add link tag)

- [ ] **Step 1: Create `public/styles.css` with new design token system**

Create the file with the complete `:root` token system from the design spec. This replaces the old inconsistent variables.

```css
/* ══════════════════════════════════════════
   Dokuvo — App Styles
   Design System: Deep Blue + Plus Jakarta Sans
   ══════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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

  /* Semantic */
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
  --cyan-surface: rgba(6, 182, 212, 0.06);
  --cyan-border: rgba(6, 182, 212, 0.12);
  --orange: #F97316;
  --orange-surface: rgba(249, 115, 22, 0.06);
  --orange-border: rgba(249, 115, 22, 0.12);
  --indigo: #6366F1;
  --indigo-surface: rgba(99, 102, 241, 0.06);
  --indigo-border: rgba(99, 102, 241, 0.12);

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

body {
  font-family: var(--font-family);
  background: linear-gradient(160deg, var(--bg-base) 0%, var(--bg-surface) 50%, var(--bg-base) 100%);
  min-height: 100vh;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Copy the full existing CSS from `index.html` lines 14–2778 into `styles.css` BELOW the tokens**

Append the existing CSS rules after the new token block. Keep all existing rules intact — they will be refactored in subsequent tasks. The key is to have a working extraction first.

Use this approach:
1. Read lines 14–2778 from `public/index.html`
2. Append them to `public/styles.css` after the new token block (wrapped in a `/* ── LEGACY STYLES (to be refactored) ── */` comment)

- [ ] **Step 3: Modify `public/index.html` head section**

Replace the Inter font link and add the stylesheet link. Remove the entire `<style>...</style>` block.

In `public/index.html`, change the `<head>` to:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
```

Remove the old Inter font link (line 8) and the entire `<style>` block (lines 13–2779).

- [ ] **Step 4: Verify the app loads correctly with extracted CSS**

Run: `cd /Users/jul/dokuvo && node index.js`

Open http://localhost:3000 (or the configured port) in browser. Verify:
- Auth screen renders
- All pages/tabs load
- No unstyled content flashes

- [ ] **Step 5: Commit**

```bash
git add public/styles.css public/index.html
git commit -m "refactor: extract app CSS to styles.css, swap Inter → Plus Jakarta Sans"
```

---

### Task 2: Redesign Auth Screen

**Files:**
- Modify: `public/styles.css` (auth section)

- [ ] **Step 1: Replace legacy auth styles in `styles.css`**

Find and replace all auth-related styles (from `/* ── AUTH ── */` through `.auth-message.success`) with the redesigned version:

```css
/* ══ AUTH SCREEN ══ */
#authScreen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  background: var(--bg-base);
  position: relative;
}

#authScreen::before {
  content: '';
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(ellipse, var(--accent-glow), transparent 70%);
  pointer-events: none;
}

.auth-logo {
  font-size: 3rem;
  margin-bottom: var(--space-sm);
  position: relative;
}

.auth-title {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
  letter-spacing: -0.03em;
  position: relative;
}

.auth-subtitle {
  color: var(--text-secondary);
  margin-bottom: 40px;
  text-align: center;
  font-size: var(--font-size-base);
  position: relative;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  position: relative;
}

.auth-tabs {
  display: flex;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 4px;
  margin-bottom: var(--space-xl);
}

.auth-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  font-family: var(--font-family);
}

.auth-tab.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.input-group {
  margin-bottom: var(--space-lg);
}

.input-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  letter-spacing: 0.02em;
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 1rem;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-family);
}

.input-field::placeholder {
  color: var(--text-muted);
}

.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--accent), #1D4ED8);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: var(--space-sm);
  font-family: var(--font-family);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.25);
}

.btn-primary:hover {
  box-shadow: 0 6px 24px rgba(37, 99, 235, 0.35);
  transform: translateY(-1px);
}

.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.auth-message {
  font-size: var(--font-size-sm);
  margin-top: var(--space-md);
  text-align: center;
  min-height: 20px;
}

.auth-message.error { color: var(--danger); }
.auth-message.success { color: var(--success); }

.forgot-password-link {
  text-align: center;
  margin-top: var(--space-lg);
  font-size: var(--font-size-sm);
  color: var(--accent-lighter);
  cursor: pointer;
  transition: color 0.2s;
}

.forgot-password-link:hover { color: #93C5FD; text-decoration: underline; }
```

- [ ] **Step 2: Verify auth screen renders correctly**

Run dev server, open the app. Verify login and register tabs both render with:
- Radial glow behind auth card
- Deep blue inputs with accent focus ring
- Gradient primary button

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign auth screen with Deep Blue tokens"
```

---

### Task 3: Redesign Sidebar

**Files:**
- Modify: `public/styles.css` (sidebar section, from `/* ── Sidebar Toggle Button ── */` through `.sidebar-user-plan.premium`)

- [ ] **Step 1: Replace legacy sidebar styles**

Find and replace all sidebar-related styles with the redesigned version using the new token system. Key changes:
- `--bg-base` for sidebar background
- Active nav items get `--accent-surface` background + `--accent-border` left border
- Session items get subtle `--bg-elevated` hover
- New chat button gets `--accent` with glow shadow
- Sidebar user section gets gradient avatar
- All hardcoded hex colors replaced with token references
- Scrollbar: 3px wide, `--bg-overlay` thumb

The full replacement CSS for the sidebar section (`.sidebar-toggle-btn` through `.sidebar-user-plan.premium`, `.chat-sidebar`, `.sidebar-header`, `.sidebar-logo`, `.sidebar-nav`, `.nav-item`, `.sidebar-sessions-title`, `.sidebar-search`, `.chat-sessions`, `.session-item`, `.session-item-row`, `.sidebar-empty`, `.sidebar-footer`, `.sidebar-user`, `.sidebar-avatar`, `.new-chat-btn`, `.sidebar-overlay`, `.sidebar-open-btn`, `.lang-switcher`, `.lang-btn`, etc.) must use the new design tokens throughout. Replace all instances of:
- `#0D0D0D` → `var(--bg-base)`
- `#1E1E1E` → `var(--border-subtle)`
- `#1A1A1A` → `var(--bg-surface)`
- `#1C1C1E` → `var(--bg-elevated)`
- `#2C2C2E` → `var(--border-default)`
- `#636366` → `var(--text-muted)`
- `#AEAEB2` → `var(--text-secondary)`
- `#F1F5F9` → `var(--text-primary)`
- `#48484A` → `var(--text-muted)`
- `#3B82F6` → `var(--accent-light)`
- `#2563EB` → `var(--accent)`
- `#E8EAED` → `var(--text-primary)`
- `#4A4F58` → `var(--text-muted)`
- `#9CA3AF` → `var(--text-secondary)`
- `#6B7280` → `var(--text-secondary)`
- `#34D399` → `var(--success)`
- `#F87171` → `var(--danger)`

Additionally, update these specific component styles:

**`.new-chat-btn`**: Add `box-shadow: 0 2px 12px rgba(37, 99, 235, 0.3);`

**`.nav-item.active`**: Change to `background: var(--accent-surface); color: var(--text-primary); border-left: 3px solid var(--accent-light);` and add `padding-left: 9px;`

**`.session-item-row.active`**: Change to `background: var(--bg-elevated); border-color: var(--accent-border);`

**`.sidebar-avatar`**: Change gradient to `background: linear-gradient(135deg, var(--accent-light), var(--accent));`

**`.chat-sessions::-webkit-scrollbar`**: Change width to `3px`, thumb to `var(--bg-overlay)`

- [ ] **Step 2: Verify sidebar renders correctly**

Open app, verify:
- Sidebar opens/closes on desktop and mobile
- Nav items highlight correctly
- Session list scrolls
- New chat button has glow
- User section shows properly

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign sidebar with Deep Blue tokens"
```

---

### Task 4: Redesign Chat Area (Main Content)

**Files:**
- Modify: `public/styles.css` (chat-main, chat-empty, chat-messages, chat-bubble, chat-input sections)

- [ ] **Step 1: Replace chat area styles**

Replace all chat-related styles from `.chat-main` through `.input-hint` with redesigned versions. Key changes:

**`.chat-main`**: Background `var(--bg-surface)`, grid pattern uses `var(--accent)` at 0.02 opacity

**`.chat-empty`**: Keep structure, update colors to tokens. `.chat-empty-icon` gets `background: linear-gradient(135deg, var(--accent-glow), rgba(37,99,235,0.05)); border: 1px solid var(--accent-border);`

**`.chat-empty h2`**: `color: var(--text-primary); font-weight: 800; letter-spacing: -0.03em;`

**`.quick-btn`**: `background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-xl);` Hover: `border-color: var(--accent-light);`

**`.chat-bubble.user`**: `background: var(--accent-surface); border: 1px solid var(--accent-border); color: var(--accent-lighter); border-radius: 16px 16px 4px 16px;`

**`.chat-bubble.assistant`**: `background: transparent; border: none; color: var(--text-secondary);`

**`.chat-input-row`**: `background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.4);`

**`.chat-input-row:focus-within`**: `border-color: var(--accent-light); box-shadow: var(--shadow-glow), 0 4px 24px rgba(0,0,0,0.4);`

**`.send-btn`**: `background: var(--accent); border-radius: var(--radius-md);` Hover: `background: var(--accent); transform: scale(1.05);`

**`.depth-step.active`**: `color: var(--accent-light); border-color: var(--accent-light); background: var(--accent-surface);`

All other chat elements (`.chat-textarea`, `.attach-btn`, `.mic-btn`, `.typing-dots`, etc.) replace hardcoded hex with tokens.

- [ ] **Step 2: Verify chat renders correctly**

Open app, start a chat or load existing. Verify:
- Empty state with quick actions renders
- User/assistant bubbles display correctly
- Input area with depth slider works
- Send button, attach, mic buttons visible
- Typing dots animation works

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign chat area with Deep Blue tokens and card layout"
```

---

### Task 5: Redesign Analysis Blocks (Cards)

**Files:**
- Modify: `public/styles.css` (analyse-block, risiko, fristen, zusammenfassung, glossar, checkliste, handlungen, statistiken sections)

- [ ] **Step 1: Replace analysis block styles**

This is the heart of the card-based redesign. Replace all `.analyse-block` and related styles. Each block type gets:
- Background: semantic color at 0.04 opacity
- Border: 1px solid semantic color at 0.10 opacity
- Left border: 3px solid semantic color
- Border-radius: `0 var(--radius-md) var(--radius-md) 0`

```css
/* ══ ANALYSIS CARDS ══ */
.analyse-block {
  margin-top: 14px;
  padding: 16px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  border-left: 3px solid var(--accent-light);
}

.analyse-block-title {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Statistiken */
.analyse-block.statistiken {
  border-left-color: var(--indigo);
  background: var(--indigo-surface);
  border-color: var(--indigo-border);
  border-left: 3px solid var(--indigo);
}

.statistiken-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

@media (max-width: 480px) { .statistiken-grid { grid-template-columns: repeat(2, 1fr); } }

.statistik-karte {
  background: var(--bg-base);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  text-align: center;
  border: 1px solid var(--indigo-border);
}

.statistik-wert {
  font-size: 18px;
  font-weight: 800;
  color: var(--indigo);
  line-height: 1.2;
}

.statistik-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Risiko */
.analyse-block.risiko {
  border-left-color: var(--warning);
  background: var(--warning-surface);
  border-color: var(--warning-border);
  border-left: 3px solid var(--warning);
}

.risiko-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.risiko-item:last-child { border-bottom: none; }

.risiko-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
}

.risiko-dot.rot { background: var(--danger); box-shadow: 0 0 8px rgba(239,68,68,0.4); }
.risiko-dot.gelb { background: var(--warning); box-shadow: 0 0 8px rgba(245,158,11,0.3); }
.risiko-dot.gruen { background: var(--success); box-shadow: 0 0 8px rgba(52,211,153,0.3); }
.risiko-text { flex: 1; min-width: 0; }
.risiko-klausel { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.risiko-grund { font-size: 11px; color: var(--text-secondary); }

/* Zusammenfassung */
.analyse-block.zusammenfassung {
  border-left-color: var(--purple);
  background: var(--purple-surface);
  border-color: var(--purple-border);
  border-left: 3px solid var(--purple);
}

/* ... (same pattern for all block types) */

/* Handlungen */
.analyse-block.handlungen {
  border-left-color: var(--success);
  background: var(--success-surface);
  border-color: var(--success-border);
  border-left: 3px solid var(--success);
}

/* Glossar */
.analyse-block.glossar {
  border-left-color: var(--cyan);
  background: var(--cyan-surface);
  border-color: var(--cyan-border);
  border-left: 3px solid var(--cyan);
}

/* Checkliste */
.analyse-block.checkliste {
  border-left-color: var(--orange);
  background: var(--orange-surface);
  border-color: var(--orange-border);
  border-left: 3px solid var(--orange);
}
```

Preserve all existing child element styles (`.zusammenfassung-grid`, `.handlung-item`, `.glossar-item`, `.checkliste-item`, etc.) but replace their hardcoded colors with tokens.

- [ ] **Step 2: Replace Fristen block styles**

The `.fristen-block` uses the same card pattern:

```css
.fristen-block {
  margin-top: 14px;
  padding: 14px 16px;
  background: var(--accent-surface);
  border: 1px solid var(--accent-border);
  border-left: 3px solid var(--accent-light);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}
```

Update all child elements (`.fristen-title`, `.frist-item`, `.frist-titel`, `.frist-datum`, `.frist-export-btn`, `.frist-remind-btn`, `.remind-popup`, etc.) to use tokens.

- [ ] **Step 3: Verify analysis blocks render**

Upload a document or open an existing chat with analysis results. Verify each block type renders with correct semantic colors and card styling.

- [ ] **Step 4: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign analysis blocks as semantic color cards"
```

---

### Task 6: Redesign Markdown Rendering, Feedback, Followup Chips

**Files:**
- Modify: `public/styles.css` (result-text, feedback, followup sections)

- [ ] **Step 1: Replace markdown rendering styles**

Replace `.result-text` and all children (`.result-text h2`, `.result-text ul`, `.result-text ol`, `.result-text li`, `.result-text strong`, `.result-text p`). Key changes:
- List items: `background: var(--bg-base); border-radius: var(--radius-sm);`
- `h2` labels: `color: var(--text-secondary);`
- `strong`: `color: var(--text-primary);`
- `p`: `color: var(--text-secondary);`
- `ol li::before` counter: `background: var(--bg-overlay); color: var(--text-secondary);`
- `ul li::before` dot: `background: var(--text-muted);`

- [ ] **Step 2: Replace feedback and followup styles**

Replace `.feedback-row`, `.feedback-btn`, `.followup-container`, `.followup-chip` with token-based versions:

```css
.followup-chip {
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  line-height: 1.4;
  font-family: var(--font-family);
}

.followup-chip:hover {
  border-color: var(--accent-light);
  color: var(--text-primary);
  background: var(--accent-surface);
}

.feedback-btn {
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  transition: all 0.15s;
  font-family: var(--font-family);
}

.feedback-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.feedback-btn.active-up { border-color: var(--success); color: var(--success); background: var(--success-surface); }
.feedback-btn.active-down { border-color: var(--danger); color: var(--danger); background: var(--danger-surface); }
```

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign markdown rendering and interaction elements"
```

---

### Task 7: Redesign Tab Panels (Templates, Premium, Profile, Team, About)

**Files:**
- Modify: `public/styles.css` (template, premium, profile, team, about sections)

- [ ] **Step 1: Replace template card styles**

Replace `.templates-intro`, `.templates-grid`, `.template-card` and children with token-based versions:
- Card: `background: var(--bg-elevated); border: 1.5px solid var(--border-default);`
- Hover: `border-color: var(--accent-light); background: var(--bg-overlay);`
- Icon: `background: var(--accent-surface); color: var(--accent-lighter);`
- Button: `color: var(--accent-lighter); border: 1px solid var(--accent-border);`

- [ ] **Step 2: Replace premium, profile, about, team tab styles**

Update all panel styles to use tokens:
- `.premium-hero`: `background: linear-gradient(135deg, #1D4ED8, var(--accent));`
- `.premium-features`, `.about-card`, `.settings-card`: `background: var(--bg-elevated); border: 1.5px solid var(--border-default);`
- `.profile-avatar`: `background: linear-gradient(135deg, var(--accent-light), var(--accent));`
- `.btn-logout`: `border: 1.5px solid rgba(239,68,68,0.3); color: var(--danger); background: var(--bg-elevated);` Hover: `background: var(--danger-surface);`
- `.section-title`: `color: var(--text-primary); font-weight: 800; letter-spacing: -0.02em;`
- `.section-subtitle`: `color: var(--text-secondary);`

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign tab panels (templates, premium, profile, team, about)"
```

---

### Task 8: Redesign Topbar, Mobile Nav, Header, Modals

**Files:**
- Modify: `public/styles.css` (persistent-topbar, mobile-bottom-nav, app-header, modal sections)

- [ ] **Step 1: Replace persistent topbar styles**

Replace `.persistent-topbar` and children with token-based versions:
- Background: `var(--bg-base)` with backdrop-filter blur
- Toggle button: `border: 1px solid var(--border-default);`
- Logo box: `background: var(--bg-surface); border: 1px solid var(--border-subtle);`

- [ ] **Step 2: Replace mobile bottom nav and header styles**

Replace `.mobile-bottom-nav`, `.mobile-nav-item`, `.app-header` with token-based versions:
- Nav background: `var(--bg-base); border-top: 1px solid var(--border-subtle);`
- Active item: `color: var(--accent-light);`
- Header: `background: rgba(6, 11, 24, 0.95); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border-subtle);`

- [ ] **Step 3: Replace modal styles (share, compare, tour)**

Replace `.share-modal-overlay`, `.share-modal`, `.vergleich-overlay`, `.vergleich-modal`, `.tour-tooltip` and all children with token-based versions:
- Overlay: `background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);`
- Modal: `background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 16px; box-shadow: var(--shadow-lg);`
- Tour tooltip: `background: var(--bg-elevated); border: 1px solid var(--accent-border);`

- [ ] **Step 4: Replace onboarding tour styles**

Replace `.tour-overlay`, `.tour-highlight`, `.tour-tooltip` with token-based:
- Tooltip: `background: var(--bg-elevated); border: 1px solid var(--accent-border);`
- `.tour-btn-next`: `background: var(--accent);`
- `.tour-btn-skip`: `background: transparent; color: var(--text-secondary); border: 1px solid var(--border-default);`

- [ ] **Step 5: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign topbar, mobile nav, header, and modals"
```

---

### Task 9: Redesign Responsive / Media Queries and Limit Banner

**Files:**
- Modify: `public/styles.css` (media queries, limit banner)

- [ ] **Step 1: Replace limit banner styles**

```css
.limit-banner {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xl) var(--space-2xl);
  margin: 0 var(--space-lg) var(--space-md);
  background: var(--warning-surface);
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-lg);
  color: var(--warning);
  font-size: var(--font-size-base);
  position: relative;
  z-index: 1;
  text-align: center;
}

.limit-banner.visible { display: flex; }

.limit-banner-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--warning-surface);
  border: 1px solid var(--warning-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.limit-upgrade-btn {
  background: linear-gradient(135deg, var(--warning), #F59E0B);
  color: var(--bg-base);
  border: none;
  border-radius: var(--radius-md);
  padding: 10px 28px;
  font-size: var(--font-size-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-family);
}

.limit-upgrade-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(251,191,36,0.3);
}
```

- [ ] **Step 2: Clean up and consolidate media queries**

Remove all `!important` overrides where possible by reordering CSS specificity. Consolidate the duplicate `@media (max-width: 768px)` blocks into a single block at the end of the file. Update all hardcoded colors within media queries to use tokens.

Key mobile overrides to preserve:
- `.app-header { display: flex; }` on mobile
- `.mobile-bottom-nav { display: block; }` on mobile
- `.erklaeren-layout { height: calc(100vh - 52px - 56px); }` on mobile
- `.chat-sidebar` fixed positioning on mobile
- `.persistent-topbar { display: none; }` on mobile

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "style: redesign limit banner, consolidate media queries"
```

---

### Task 10: Clean Up Legacy Styles and Remove Duplicates

**Files:**
- Modify: `public/styles.css`

- [ ] **Step 1: Remove duplicate CSS rules**

Search for and remove duplicate definitions:
- `.app-header` is defined twice (once in general section ~line 265, once in mobile header section ~line 2393)
- `.text-area:focus` is defined twice
- `.tab-panel { display: none; } .tab-panel.active { display: block; }` appears twice
- Any other duplicates from the legacy extraction

Keep only the redesigned version of each.

- [ ] **Step 2: Remove the `/* ── LEGACY STYLES ── */` wrapper comment**

The legacy styles should all be replaced by this point. Remove any remaining unreplaced legacy rules and the wrapper comment.

- [ ] **Step 3: Verify all features work end-to-end**

Open the app and check:
1. Auth screen (login/register)
2. Sidebar (open/close, nav, sessions)
3. Chat (empty state, messages, analysis blocks)
4. Input area (depth slider, attach, mic, send)
5. All tabs (templates, premium, profile, team, about)
6. Modals (share, compare)
7. Mobile (bottom nav, header, sidebar overlay)
8. Onboarding tour

- [ ] **Step 4: Commit**

```bash
git add public/styles.css
git commit -m "refactor: remove duplicate CSS rules, clean up legacy styles"
```

---

### Task 11: Extract and Redesign Landing Page CSS

**Files:**
- Create: `public/landing.css`
- Modify: `public/landing.html` (lines 9 font link, lines 10–565 style block removal, add link tag)

- [ ] **Step 1: Create `public/landing.css` with shared tokens + landing styles**

Create the file. It starts with the same `:root` token block as `styles.css` (copy the token section), then contains all landing-specific styles extracted from `landing.html` lines 11–564, with these replacements:

- `--serif: 'DM Serif Display'` → removed, all serif usages replaced with `var(--font-family)` weight 800
- `--sans: 'DM Sans'` → replaced with `var(--font-family)`
- `--bg: #08090A` → `var(--bg-base)` (token value `#060B18`)
- `--surface: #111214` → `var(--bg-surface)`
- `--surface-2: #1A1C1F` → `var(--bg-elevated)`
- `--border: #2A2D32` → `var(--border-default)`
- `--text: #E8EAED` → `var(--text-primary)`
- `--text-muted: #7A7F88` → `var(--text-secondary)`
- `--text-dim: #4A4F58` → `var(--text-muted)`
- `font-family: var(--serif)` → `font-family: var(--font-family); font-weight: 800;`

All section titles that used `var(--serif)` (`.hero h1`, `.section-title`, `.cta-box h2`) become `font-family: var(--font-family); font-weight: 800; letter-spacing: -0.03em;`

- [ ] **Step 2: Modify `public/landing.html`**

Replace the `<head>` font links and add stylesheet link:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="landing.css">
```

Remove the old DM Sans/Serif font link (line 9) and the entire `<style>` block (lines 10–565).

- [ ] **Step 3: Verify landing page renders**

Open the landing page URL. Verify:
- Navigation renders with Plus Jakarta Sans
- Hero heading uses weight 800 (not serif)
- All sections (comparison, features, how-it-works, use cases, CTA) render
- Responsive: mobile layout works
- Colors match the app's deep blue palette

- [ ] **Step 4: Commit**

```bash
git add public/landing.css public/landing.html
git commit -m "style: extract landing CSS, unify with Plus Jakarta Sans and Deep Blue tokens"
```

---

### Task 12: Final Verification and Push

**Files:**
- All modified files

- [ ] **Step 1: Run the test suite**

```bash
cd /Users/jul/dokuvo && npm run test:api
```

Expected: All API tests pass (CSS changes should not affect API behavior).

- [ ] **Step 2: Run visual verification checklist**

Open the app and systematically verify each screen:
1. Landing page — all sections, responsive
2. Auth screen — login, register, forgot password
3. Main app — sidebar, chat, empty state
4. Upload document — analysis renders with card-based blocks
5. All tabs — templates, premium, profile, team, about
6. Mobile — bottom nav, header, sidebar overlay, chat input
7. Modals — share, compare documents
8. Onboarding tour — tooltips, highlights

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```
