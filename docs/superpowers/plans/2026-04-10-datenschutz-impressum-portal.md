# Datenschutz & Impressum im Portal – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Datenschutz- und Impressum-Links in den Sidebar-Footer aller Portal-Seiten sowie in der Login-Seite auf externe URLs umstellen.

**Architecture:** Jede betroffene HTML-Datei enthält entweder einen `sidebar-footer`-Block (Portal-Seiten) oder einen bestehenden Link-Abschnitt (login.html). Überall werden die Links auf die externen URLs `https://versicherung-schindelhauer.de/datenschutz` und `https://versicherung-schindelhauer.de/impressum` gesetzt. Links öffnen in neuem Tab (`target="_blank" rel="noopener"`). Keine neuen Dateien, keine JS-Änderungen.

**Tech Stack:** Vanilla HTML, CSS-Variablen (`--text-secondary` aus `style.css`)

---

### Task 0: login.html – bestehende Links auf externe URLs umstellen

**Files:**
- Modify: `public/login.html:71-73`

- [ ] **Step 1: Links ersetzen**

In `public/login.html` den bestehenden Abschnitt (Zeilen 70–73):

```html
      <!-- D6: Informationspflicht nach Art. 13 DSGVO -->
      <p style="font-size:12px;color:var(--text-secondary);text-align:center;margin-top:8px;">
        Mit der Anmeldung akzeptieren Sie unsere <a href="datenschutz.html" style="color:var(--primary);">Datenschutzerklärung</a>.
        &nbsp;|&nbsp;<a href="impressum.html" style="color:var(--primary);">Impressum</a>
      </p>
```

ersetzen durch:

```html
      <!-- D6: Informationspflicht nach Art. 13 DSGVO -->
      <p style="font-size:12px;color:var(--text-secondary);text-align:center;margin-top:8px;">
        Mit der Anmeldung akzeptieren Sie unsere <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--primary);">Datenschutzerklärung</a>.
        &nbsp;|&nbsp;<a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--primary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/login.html
git commit -m "feat: Datenschutz/Impressum auf externe URLs umstellen (login)"
```

---

### Task 1: dashboard.html

**Files:**
- Modify: `public/dashboard.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/dashboard.html` nach dem `<a href="#" id="logoutBtn" ...>...</a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/dashboard.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (dashboard)"
```

---

### Task 2: contracts.html

**Files:**
- Modify: `public/contracts.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/contracts.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/contracts.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (contracts)"
```

---

### Task 3: contact.html

**Files:**
- Modify: `public/contact.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/contact.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/contact.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (contact)"
```

---

### Task 4: profile.html

**Files:**
- Modify: `public/profile.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/profile.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/profile.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (profile)"
```

---

### Task 5: consent.html

**Files:**
- Modify: `public/consent.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/consent.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/consent.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (consent)"
```

---

### Task 6: 2fa-setup.html

**Files:**
- Modify: `public/2fa-setup.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/2fa-setup.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/2fa-setup.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (2fa-setup)"
```

---

### Task 7: change-password.html

**Files:**
- Modify: `public/change-password.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/change-password.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/change-password.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (change-password)"
```

---

### Task 8: admin.html

**Files:**
- Modify: `public/admin.html` (sidebar-footer)

- [ ] **Step 1: Link-Block einfügen**

In `public/admin.html` nach dem Logout-`<a>` innerhalb von `.sidebar-footer` einfügen:

```html
      <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
        <a href="https://versicherung-schindelhauer.de/datenschutz" target="_blank" rel="noopener" style="color:var(--text-secondary);">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://versicherung-schindelhauer.de/impressum" target="_blank" rel="noopener" style="color:var(--text-secondary);">Impressum</a>
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add public/admin.html
git commit -m "feat: Datenschutz/Impressum-Links in Sidebar (admin)"
```
