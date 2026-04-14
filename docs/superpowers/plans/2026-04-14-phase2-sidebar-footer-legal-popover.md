# Phase 2: Sidebar Footer — Legal Links + Profil-Popover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add legally required Impressum/Datenschutz/AGB links to the sidebar footer and replace the direct `switchTab('profile')` click on the sidebar avatar with a compact profile popover menu.

**Architecture:** Legal links are a simple `<div class="sidebar-legal">` inserted at the top of `.sidebar-footer`. The popover is an absolutely positioned panel that opens upward on avatar click, contains user info + quick-links, and closes on outside click. The existing `switchTab('profile')` on `.sidebar-user` is replaced with `toggleProfilePopover()`. No backend changes needed.

**Tech Stack:** HTML, CSS Custom Properties, Vanilla JS

**Spec Reference:** `docs/superpowers/specs/2026-04-11-complete-redesign.md` Sections 7b, 7c, 9

---

### Sidebar-Footer Reihenfolge (Ziel-Zustand)

```
┌─────────────────────────────┐
│ Impressum · Datenschutz · AGB │  ← Legal Links (NEU)
│ [DE] [EN]                     │  ← Lang-Switcher (existiert)
│ [☀/🌙]                       │  ← Theme Toggle (existiert)
│ [Avatar] Name · Plan          │  ← User (existiert, Klick → Popover NEU)
└─────────────────────────────┘
```

### Profil-Popover (Ziel-Zustand)

```
┌──────────────────────────┐
│  [Avatar] Julia Müller   │
│  julia@example.com       │
│  ┌──────┐                │
│  │ Free │ Plan-Badge     │
│  └──────┘                │
│ ─────────────────────── │
│  ⚙ Einstellungen         │  → switchTab('profile')
│  ⭐ Premium              │  → switchTab('premium')
│  👥 Teams                │  → switchTab('team')
│  ℹ Über Dokuvo           │  → switchTab('about')
│ ─────────────────────── │
│  🚪 Abmelden             │  → logout()
└──────────────────────────┘
```

---

### Task 1: Add Legal Links HTML + CSS

**Files:**
- Modify: `public/index.html:131` (inside `.sidebar-footer`, before `.lang-switcher`)
- Modify: `public/styles.css` (append after `.sidebar-user-plan.premium` at line ~1590)

- [ ] **Step 1: Add legal links HTML**

In `public/index.html`, find line 131:
```html
      <div class="sidebar-footer">
        <div class="lang-switcher">
```

Insert the legal links between `<div class="sidebar-footer">` and `<div class="lang-switcher">`:

```html
      <div class="sidebar-footer">
        <div class="sidebar-legal">
          <a href="/impressum" target="_blank">Impressum</a>
          <span>·</span>
          <a href="/datenschutz" target="_blank">Datenschutz</a>
          <span>·</span>
          <a href="/agb" target="_blank">AGB</a>
        </div>
        <div class="lang-switcher">
```

- [ ] **Step 2: Add legal links CSS**

Append to `public/styles.css` after `.sidebar-user-plan.premium { color: var(--success); }` (line ~1590):

```css
/* ── Sidebar Legal Links ── */
.sidebar-legal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 12px 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.sidebar-legal a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.sidebar-legal a:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}

.sidebar-legal span {
  color: var(--text-dim);
  font-size: 10px;
}
```

- [ ] **Step 3: Verify in browser**

Open the app, log in. Check sidebar footer — legal links should appear above the language switcher. Verify:
1. Links are small, muted, centered
2. Hover underlines and brightens text
3. Visible in both Dark Mode and Light Mode

- [ ] **Step 4: Commit**

```bash
cd /Users/jul/dokuvo
git add public/index.html public/styles.css
git commit -m "feat: add legal links (Impressum, Datenschutz, AGB) to sidebar footer"
```

---

### Task 2: Add Profile Popover HTML

**Files:**
- Modify: `public/index.html:140-146` (replace `.sidebar-user` onclick, add popover HTML)

- [ ] **Step 1: Change sidebar-user onclick from switchTab to toggleProfilePopover**

In `public/index.html`, find line 140:
```html
        <div class="sidebar-user" onclick="switchTab('profile')">
```

Replace with:
```html
        <div class="sidebar-user" onclick="toggleProfilePopover(event)">
```

- [ ] **Step 2: Add popover HTML after `.sidebar-user` closing div**

Find the closing `</div>` of `.sidebar-footer` (line 147). Insert the popover HTML just before it:

Find this block (lines 145-147):
```html
          </div>
        </div>
      </div>
```

The first `</div>` closes `.sidebar-user-info`, the second closes `.sidebar-user`, the third closes `.sidebar-footer`. Insert the popover between the second and third:

```html
          </div>
        </div>
        <div class="profile-popover" id="profilePopover">
          <div class="popover-user-section">
            <div class="popover-avatar" id="popoverAvatar">?</div>
            <div class="popover-user-details">
              <div class="popover-user-name" id="popoverName">—</div>
              <div class="popover-user-email" id="popoverEmail">—</div>
              <span class="popover-plan-badge" id="popoverPlan">Free</span>
            </div>
          </div>
          <div class="popover-divider"></div>
          <button class="popover-item" onclick="popoverNavigate('profile')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Einstellungen
          </button>
          <button class="popover-item" onclick="popoverNavigate('premium')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Premium
          </button>
          <button class="popover-item" onclick="popoverNavigate('team')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Teams
          </button>
          <button class="popover-item" onclick="popoverNavigate('about')">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Über Dokuvo
          </button>
          <div class="popover-divider"></div>
          <button class="popover-item popover-logout" onclick="logout()">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Abmelden
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jul/dokuvo
git add public/index.html
git commit -m "feat: add profile popover HTML to sidebar footer"
```

---

### Task 3: Add Profile Popover CSS

**Files:**
- Modify: `public/styles.css` (append after the `.sidebar-legal` block from Task 1)

- [ ] **Step 1: Add popover CSS**

Append to `public/styles.css` after the sidebar legal links CSS:

```css
/* ── Profile Popover ── */
.profile-popover {
  display: none;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 8px;
  right: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 6px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.profile-popover.open {
  display: block;
}

.sidebar-footer {
  position: relative;
}

.popover-user-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
}

.popover-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-light), var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: white;
  overflow: hidden;
}

[data-theme="light"] .popover-avatar {
  background: linear-gradient(135deg, #DBEAFE, #C7D2FE);
  color: var(--accent);
}

.popover-user-details {
  flex: 1;
  min-width: 0;
}

.popover-user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popover-user-email {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.popover-plan-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 4px;
  background: var(--bg-overlay);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.popover-plan-badge.premium {
  background: var(--success-surface);
  color: var(--success);
  border-color: var(--success-border);
}

.popover-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 8px;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.popover-item:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.popover-item svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.popover-item:hover svg {
  color: var(--text-secondary);
}

.popover-logout {
  color: var(--danger);
}

.popover-logout svg {
  color: var(--danger);
}

.popover-logout:hover {
  background: var(--danger-surface);
  color: var(--danger);
}
```

- [ ] **Step 2: Verify popover positioning**

To quickly test the popover without JS, open DevTools and on `#profilePopover` add class `open`. Check:
1. Popover opens upward from user section
2. It stays within sidebar bounds
3. Background, borders, shadows look correct
4. Test in both Dark and Light mode

- [ ] **Step 3: Commit**

```bash
cd /Users/jul/dokuvo
git add public/styles.css
git commit -m "feat: add profile popover CSS with light mode support"
```

---

### Task 4: Add Profile Popover JavaScript

**Files:**
- Modify: `public/index.html` (inside `<script>` block, after the `toggleTheme` function)

- [ ] **Step 1: Add toggleProfilePopover and popoverNavigate functions**

In `public/index.html`, find the `toggleTheme` function (search for `function toggleTheme()`). After the closing `}` of `toggleTheme`, add:

```javascript
    // ── Profile Popover ──
    function toggleProfilePopover(event) {
      event.stopPropagation();
      const popover = document.getElementById('profilePopover');
      popover.classList.toggle('open');
    }

    function popoverNavigate(tabName) {
      document.getElementById('profilePopover').classList.remove('open');
      switchTab(tabName);
    }

    // Close popover on outside click
    document.addEventListener('click', function(e) {
      const popover = document.getElementById('profilePopover');
      if (!popover) return;
      const sidebarUser = document.querySelector('.sidebar-user');
      if (!popover.contains(e.target) && !sidebarUser.contains(e.target)) {
        popover.classList.remove('open');
      }
    });
```

- [ ] **Step 2: Add popover data sync to zeigeApp**

The popover needs the user's name, email, and plan. Find the `zeigeApp` function (line ~1533). After the existing sidebar data population (after `document.getElementById('sidebarCount').textContent = ...` at line ~1562), add:

```javascript
      // Sync popover data
      const popoverPlan = document.getElementById('popoverPlan');
      if (popoverPlan) {
        popoverPlan.textContent = data.isPremium ? '✦ Premium' : 'Free';
        popoverPlan.className = 'popover-plan-badge' + (data.isPremium ? ' premium' : '');
      }
```

- [ ] **Step 3: Add popover data sync to ladeProfil**

The profile loading function also updates sidebar user info. Find the section where `sidebarEmail` gets set (search for `document.getElementById('sidebarEmail').textContent`). There are two places — one in `ladeProfil` (~line 2936) and one in `speichereAnzeigename` (~line 3039).

After each `sidebarEmail` update, also update popover fields. 

In `ladeProfil` (around line 2936), find:

```javascript
        document.getElementById('sidebarEmail').textContent = data.display_name;
```

After that line, add:
```javascript
        document.getElementById('popoverName').textContent = data.display_name;
        document.getElementById('popoverEmail').textContent = email;
```

Find the else branch (around line 2939):
```javascript
        document.getElementById('sidebarEmail').textContent = email;
```

After that line, add:
```javascript
        document.getElementById('popoverName').textContent = email;
        document.getElementById('popoverEmail').textContent = email;
```

Also find the avatar sync section (around line 2945-2958) where `sidebarAvatar` gets its image or initial. After the `sidebarAvatar` image/initial assignment, add matching popover avatar updates.

After the line `sidebarAvatar.innerHTML = \`<img src="${data.avatar_url}?t=${Date.now()}" ...>\`;` add:
```javascript
        document.getElementById('popoverAvatar').innerHTML = `<img src="${data.avatar_url}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
```

After the line `sidebarAvatar.textContent = initial;` add:
```javascript
        document.getElementById('popoverAvatar').textContent = initial;
```

- [ ] **Step 4: Add popover data sync to speichereAnzeigename**

Find `speichereAnzeigename` (search for `document.getElementById('sidebarEmail').textContent = display_name || email;` around line 3039). After that line, add:

```javascript
        document.getElementById('popoverName').textContent = display_name || email;
```

- [ ] **Step 5: Add popover data sync to avatarHochladen**

Find the avatar upload success handler (search for `sidebarAvatar.innerHTML` around line 3018). After the `sidebarAvatar.innerHTML` update, add:

```javascript
            document.getElementById('popoverAvatar').innerHTML = `<img src="${data.avatar_url}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
```

- [ ] **Step 6: Test the full popover flow**

1. Open app in browser, log in
2. Click avatar in sidebar footer — popover should open upward
3. Check: Name, email, plan badge are populated correctly
4. Click "Einstellungen" — popover closes, profile tab opens
5. Click "Premium" — popover closes, premium tab opens
6. Click "Teams" — popover closes, team tab opens
7. Click "Über Dokuvo" — popover closes, about tab opens
8. Click "Abmelden" — logs out
9. Click outside popover — it closes
10. Test in Light Mode — check avatar gradient, backgrounds, colors
11. Test on mobile width (375px) — popover should still be usable

- [ ] **Step 7: Commit**

```bash
cd /Users/jul/dokuvo
git add public/index.html
git commit -m "feat: add profile popover JS with data sync and outside-click close"
```

---

### Task 5: Close Popover on Sidebar Collapse

**Files:**
- Modify: `public/index.html` (inside `toggleSidebar` and `closeSidebar` functions)

- [ ] **Step 1: Close popover when sidebar is toggled or closed**

Find `function toggleSidebar()` and `function closeSidebar()`. At the beginning of each function body, add:

```javascript
      document.getElementById('profilePopover')?.classList.remove('open');
```

This ensures the popover doesn't stay open when the sidebar is collapsed (especially on mobile).

- [ ] **Step 2: Close popover when switching tabs via sidebar nav**

The sidebar nav items (`nav-home`, `nav-templates`, etc.) call `switchTab()` directly. Add popover close at the beginning of `switchTab`:

Find `function switchTab(tabName)` (line ~1437). At the beginning of the function body, add:

```javascript
      document.getElementById('profilePopover')?.classList.remove('open');
```

- [ ] **Step 3: Test edge cases**

1. Open popover, then click a sidebar nav item — popover should close
2. Open popover on mobile, close sidebar — popover should close
3. Open popover, click Neuer Chat button — popover should close (outside click handler)

- [ ] **Step 4: Commit**

```bash
cd /Users/jul/dokuvo
git add public/index.html
git commit -m "fix: close profile popover on sidebar collapse and tab switch"
```

---

### Task 6: Final Visual QA Pass

**Files:** No changes — testing only

- [ ] **Step 1: Test sidebar footer order in Dark Mode**

Verify the visual order from top to bottom:
1. Legal links (Impressum · Datenschutz · AGB) — small, muted, centered
2. Lang-Switcher (DE | EN)
3. Theme Toggle (☀)
4. User section (Avatar + Name + Plan)

- [ ] **Step 2: Test sidebar footer in Light Mode**

Switch to Light Mode. Same visual check — colors should be appropriate for light background.

- [ ] **Step 3: Test popover in both themes**

1. Dark Mode: popover should have `--bg-elevated` background, proper shadows
2. Light Mode: popover should be white with subtle shadow, avatar gradient adapts

- [ ] **Step 4: Test legal links**

Click each legal link — should open in new tab. (Currently pointing to `/impressum`, `/datenschutz`, `/agb` which may not exist yet. The links will 404 — that's expected for Phase 2. The routes get created in a future phase or remain external.)

- [ ] **Step 5: Test on mobile (375px)**

Resize to 375px width:
1. Legal links visible in sidebar?
2. Popover opens within viewport bounds?
3. Popover items are tappable?

- [ ] **Step 6: Run E2E tests**

```bash
cd /Users/jul/dokuvo
npm run test:e2e
```

Expected: All existing tests pass. The `.sidebar-user` click target changed from `switchTab('profile')` to `toggleProfilePopover()`, but E2E tests likely don't click the sidebar avatar directly. If any test fails because it expected `switchTab('profile')` on avatar click, update the test to use the popover flow instead.

- [ ] **Step 7: Fix any issues found and commit**

If fixes needed:
```bash
cd /Users/jul/dokuvo
git add -A
git commit -m "fix: phase 2 visual QA fixes"
```
