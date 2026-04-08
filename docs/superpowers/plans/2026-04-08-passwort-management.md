# Passwort-Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passwortänderung beim Erstlogin erzwingen, jederzeit änderbar machen und nach 90 Tagen eine Warnung anzeigen.

**Architecture:** Neue User-Felder `must_change_password` und `password_changed_at` in NeDB. Backend gibt nach Login Flags zurück; Login-Flow leitet bei Bedarf auf neue Seite `change-password.html` weiter. Bestehende Seiten (Dashboard, Admin) zeigen dismissbares Warn-Banner via `/api/auth/me`.

**Tech Stack:** Node.js/Express, NeDB (@seald-io/nedb), bcryptjs, Vanilla JS, HTML/CSS (kein Build-Step)

---

## Dateiübersicht

| Datei | Aktion | Zweck |
|---|---|---|
| `db.js` | Modify | `must_change_password: true` in seedAdmin() |
| `server.js` | Modify | change-password Route, Login, 2FA-verify, /me, Admin-Routen |
| `public/change-password.html` | Create | Neue Seite für Erstlogin-Pflichtänderung |
| `public/js/change-password.js` | Create | Logik für die neue Seite |
| `public/js/login.js` | Modify | Neue Weiterleitung `requires_password_change` |
| `public/profile.html` | Modify | Passwort-Ändern-Karte einfügen |
| `public/js/profile.js` | Modify | Handler für Passwort-Karte |
| `public/dashboard.html` | Modify | Warn-Banner Container |
| `public/js/dashboard.js` | Modify | Banner-Logik |
| `public/admin.html` | Modify | Warn-Banner Container |
| `public/js/admin.js` | Modify | Banner-Logik |

---

## Task 1: db.js — must_change_password beim Admin-Seed

**Files:**
- Modify: `db.js:28-35`

- [ ] **Schritt 1: `must_change_password: true` in seedAdmin() einfügen**

In `db.js`, das `insertAsync` in `seedAdmin()` (ca. Zeile 28) um das Feld ergänzen:

```js
await users.insertAsync({
  email: adminEmail,
  password_hash: hash,
  full_name: 'Felix Schindelhauer',
  phone: '',
  role: 'admin',
  must_change_password: true,
  created_at: new Date().toISOString()
});
```

- [ ] **Schritt 2: Verifizieren**

Falls der Admin-Account bereits existiert, muss das Feld manuell in der DB gesetzt werden — oder das Flag wird erst bei neu angelegten Accounts gesetzt. Der bestehende Admin bekommt das Flag über Task 4 (Admin-Routen) bei neuen Accounts.

- [ ] **Schritt 3: Committen**

```bash
git add db.js
git commit -m "feat: must_change_password beim Admin-Seed setzen"
```

---

## Task 2: server.js — change-password Route erweitern

**Files:**
- Modify: `server.js:163-179`

Drei Änderungen: (1) Prüfen ob neues = altes Passwort, (2) `password_changed_at` setzen, (3) `must_change_password` entfernen.

- [ ] **Schritt 1: Route ersetzen**

Den Block `app.post('/api/auth/change-password', ...)` (Zeilen 163–179) vollständig ersetzen:

```js
app.post('/api/auth/change-password', requireLogin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Alle Felder erforderlich' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

    const user = await users.findOneAsync({ _id: req.session.userId });
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort falsch' });

    const sameAsOld = await bcrypt.compare(new_password, user.password_hash);
    if (sameAsOld) return res.status(400).json({ error: 'Das neue Passwort muss sich vom aktuellen unterscheiden' });

    const hash = await bcrypt.hash(new_password, 12);
    await users.updateAsync({ _id: req.session.userId }, {
      $set: { password_hash: hash, password_changed_at: new Date().toISOString() },
      $unset: { must_change_password: true }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});
```

- [ ] **Schritt 2: Manuell testen**

Server starten (`node server.js`), einloggen, dann:
```
POST /api/auth/change-password
{ "current_password": "...", "new_password": "..." }
```
Erwartet: `{ ok: true }`. Gleiches Passwort nochmal → `400 "muss sich unterscheiden"`.

- [ ] **Schritt 3: Committen**

```bash
git add server.js
git commit -m "feat: change-password setzt password_changed_at und entfernt must_change_password"
```

---

## Task 3: server.js — Hilfsfunktion + Login/2FA-Verify erweitern

**Files:**
- Modify: `server.js:67` (vor den Auth-Routes), `server.js:91-101`, `server.js:310-323`

- [ ] **Schritt 1: Hilfsfunktion vor den Auth-Routes einfügen**

Direkt vor der Zeile `// ── Auth Routes ───` (ca. Zeile 68) einfügen:

```js
function buildPasswordFlags(user) {
  const mustChange = !!user.must_change_password;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const pwChangedAt = user.password_changed_at ? new Date(user.password_changed_at) : null;
  const expiryWarning = !mustChange && (!pwChangedAt || pwChangedAt < ninetyDaysAgo);
  return {
    requires_password_change: mustChange ? true : undefined,
    password_expiry_warning: expiryWarning ? true : undefined
  };
}

```

- [ ] **Schritt 2: Login-Route — Antworten mit Flags erweitern**

In der Login-Route die zwei `res.json`-Aufrufe am Ende (ca. Zeilen 97–101) ersetzen:

```js
    const flags = buildPasswordFlags(user);

    if (user.role === 'admin' && !user.totp_enabled) {
      return res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!(user.terms_accepted_at || user.consent_given), requires_2fa_setup: true, ...flags });
    }

    res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!(user.terms_accepted_at || user.consent_given), ...flags });
```

- [ ] **Schritt 3: 2FA-Verify-Route — Antwort mit Flags erweitern**

In `app.post('/api/auth/2fa/verify', ...)` die letzte `res.json`-Zeile (ca. Zeile 323) ersetzen:

```js
    const flags = buildPasswordFlags(user);
    res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!(user.terms_accepted_at || user.consent_given), ...flags });
```

- [ ] **Schritt 4: Manuell testen**

Login mit einem User, der `must_change_password: true` hat (z.B. Admin-Account nach `data/users.db` löschen und neu starten):
Antwort muss `"requires_password_change": true` enthalten.

- [ ] **Schritt 5: Committen**

```bash
git add server.js
git commit -m "feat: Login und 2FA-Verify geben requires_password_change und password_expiry_warning zurück"
```

---

## Task 4: server.js — /api/auth/me + Admin-Anlage-Routen

**Files:**
- Modify: `server.js:112-129`, `server.js:689-695`, `server.js:741-747`

- [ ] **Schritt 1: /api/auth/me um password_expiry_warning erweitern**

Den `res.json`-Block in `GET /api/auth/me` (ca. Zeilen 117–126) ersetzen:

```js
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const pwChangedAt = user.password_changed_at ? new Date(user.password_changed_at) : null;
    const password_expiry_warning = !user.must_change_password && (!pwChangedAt || pwChangedAt < ninetyDaysAgo);
    res.json({
      id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone || '',
      consent_given: !!(user.terms_accepted_at || user.consent_given),
      consent_analysis: !!user.consent_analysis,
      totp_enabled: !!user.totp_enabled,
      password_expiry_warning
    });
```

- [ ] **Schritt 2: POST /api/admin/admins — must_change_password setzen**

Im `insertAsync`-Aufruf in `app.post('/api/admin/admins', ...)` (ca. Zeile 689) das Feld ergänzen:

```js
    const admin = await users.insertAsync({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      full_name: full_name.trim(),
      role: 'admin',
      must_change_password: true,
      created_at: new Date().toISOString()
    });
```

- [ ] **Schritt 3: POST /api/admin/customers — must_change_password setzen**

Im `insertAsync`-Aufruf in `app.post('/api/admin/customers', ...)` (ca. Zeile 741) das Feld ergänzen:

```js
    const user = await users.insertAsync({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      full_name: full_name.trim(),
      role: 'customer',
      must_change_password: true,
      created_at: new Date().toISOString()
    });
```

- [ ] **Schritt 4: Committen**

```bash
git add server.js
git commit -m "feat: /api/auth/me gibt password_expiry_warning zurück; neue User bekommen must_change_password"
```

---

## Task 5: change-password.html + change-password.js erstellen

**Files:**
- Create: `public/change-password.html`
- Create: `public/js/change-password.js`

- [ ] **Schritt 1: change-password.html erstellen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Passwort ändern – Kundenportal Schindelhauer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<div class="page-wrapper">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-mark">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
        </svg>
      </div>
      <div class="sidebar-company">Felix Schindelhauer GmbH</div>
      <div class="sidebar-subtitle">Kundenportal</div>
    </div>

    <nav class="sidebar-nav">
      <div class="sidebar-nav-label">Sicherheit</div>
      <a href="#" class="nav-item active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Passwort ändern</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <a href="#" id="logoutBtn" class="nav-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Abmelden</span>
      </a>
    </div>
  </aside>

  <!-- Main -->
  <div class="main-content">
    <main class="main">
      <div class="page-header">
        <div>
          <h1>Passwort ändern</h1>
          <p class="page-header-sub" id="pageSubtitle">Bitte legen Sie ein neues Passwort fest.</p>
        </div>
      </div>

      <div class="card animate-in" style="max-width:480px;">
        <div class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:8px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Neues Passwort festlegen
        </div>

        <div id="alertMsg" class="alert alert-error hidden" style="margin-bottom:16px;"></div>

        <form id="changePwForm">
          <div class="form-group">
            <label for="currentPassword">Aktuelles Passwort</label>
            <input type="password" id="currentPassword" class="form-control" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <div class="form-group">
            <label for="newPassword">Neues Passwort</label>
            <input type="password" id="newPassword" class="form-control" placeholder="Mindestens 8 Zeichen" required autocomplete="new-password">
          </div>
          <div class="form-group">
            <label for="confirmPassword">Neues Passwort bestätigen</label>
            <input type="password" id="confirmPassword" class="form-control" placeholder="••••••••" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn btn-primary" id="submitBtn" style="width:100%;justify-content:center;margin-top:8px;">
            Passwort speichern
          </button>
        </form>
      </div>
    </main>
  </div>
</div>

<script src="js/agency.js"></script>
<script src="js/change-password.js"></script>
</body>
</html>
```

- [ ] **Schritt 2: change-password.js erstellen**

```js
(async () => {
  // Session prüfen
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  document.getElementById('changePwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = document.getElementById('alertMsg');
    const btn = document.getElementById('submitBtn');
    alertEl.classList.add('hidden');

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      alertEl.textContent = 'Die neuen Passwörter stimmen nicht überein.';
      alertEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Speichern…';

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        alertEl.textContent = data.error || 'Fehler beim Speichern.';
        alertEl.classList.remove('hidden');
      } else {
        // Weiterleitung zur richtigen Zielseite
        window.location.href = me.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }
    } catch {
      alertEl.textContent = 'Verbindungsfehler. Bitte erneut versuchen.';
      alertEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Passwort speichern';
    }
  });
})();
```

- [ ] **Schritt 3: Manuell testen**

`change-password.html` direkt aufrufen (ohne eingeloggt zu sein) → muss zu `login.html` weiterleiten.
Eingeloggt aufrufen → Formular erscheint, Passwortänderung funktioniert, Weiterleitung zum Dashboard.

- [ ] **Schritt 4: Committen**

```bash
git add public/change-password.html public/js/change-password.js
git commit -m "feat: change-password.html Seite für Erstlogin-Pflichtänderung"
```

---

## Task 6: login.js — Weiterleitung für requires_password_change

**Files:**
- Modify: `public/js/login.js:25-35`

- [ ] **Schritt 1: Weiterleitungslogik erweitern**

Den `else`-Block in `login.js` (ca. Zeilen 25–35) ersetzen. Neue Priorität: 2FA → 2FA-Setup → **Passwort ändern** → Admin → Consent → Dashboard:

```js
    } else {
      if (data.requires_2fa) {
        window.location.href = '2fa-verify.html';
      } else if (data.requires_2fa_setup) {
        window.location.href = '2fa-setup.html';
      } else if (data.requires_password_change) {
        window.location.href = 'change-password.html';
      } else if (data.role === 'admin') {
        window.location.href = 'admin.html';
      } else if (!data.consent_given) {
        window.location.href = 'consent.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }
```

- [ ] **Schritt 2: password_expiry_warning in sessionStorage speichern**

Direkt vor dem `if (data.requires_2fa)` einfügen:

```js
      if (data.password_expiry_warning) {
        sessionStorage.setItem('pw_expiry_warning', '1');
      } else {
        sessionStorage.removeItem('pw_expiry_warning');
      }
```

- [ ] **Schritt 3: Manuell testen**

User mit `must_change_password: true` einloggen → Weiterleitung zu `change-password.html`. ✓
User ohne das Flag → normaler Login-Flow. ✓

- [ ] **Schritt 4: Committen**

```bash
git add public/js/login.js
git commit -m "feat: Login leitet bei requires_password_change zu change-password.html weiter"
```

---

## Task 7: profile.html + profile.js — Passwort-Ändern-Karte

**Files:**
- Modify: `public/profile.html:340-363` (vor der 2FA-Karte)
- Modify: `public/js/profile.js` (Handler anhängen)

- [ ] **Schritt 1: Passwort-Karte in profile.html einfügen**

Direkt vor `<!-- 2FA Karte -->` (ca. Zeile 340) einfügen:

```html
      <!-- Passwort ändern -->
      <div class="card animate-in" style="margin-top:24px;">
        <div class="card-title"><span class="icon">🔑</span>Passwort ändern</div>
        <div id="pwChangeAlert" class="alert hidden" style="margin-bottom:16px;"></div>
        <form id="pwChangeForm">
          <div class="form-group" style="max-width:360px;">
            <label>Aktuelles Passwort</label>
            <input type="password" id="pwCurrent" class="form-control" placeholder="••••••••" autocomplete="current-password">
          </div>
          <div class="form-group" style="max-width:360px;">
            <label>Neues Passwort</label>
            <input type="password" id="pwNew" class="form-control" placeholder="Mindestens 8 Zeichen" autocomplete="new-password">
          </div>
          <div class="form-group" style="max-width:360px;">
            <label>Neues Passwort bestätigen</label>
            <input type="password" id="pwConfirm" class="form-control" placeholder="••••••••" autocomplete="new-password">
          </div>
          <button type="submit" class="btn btn-primary" id="pwChangeBtn">Passwort ändern</button>
        </form>
      </div>
```

- [ ] **Schritt 2: Handler in profile.js anhängen**

Am Ende von `public/js/profile.js` anfügen:

```js
// ── Passwort ändern ───────────────────────────────────────────────────────────
document.getElementById('pwChangeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('pwChangeAlert');
  const btn = document.getElementById('pwChangeBtn');
  alertEl.classList.add('hidden');
  alertEl.className = 'alert hidden';

  const current_password = document.getElementById('pwCurrent').value;
  const new_password = document.getElementById('pwNew').value;
  const confirm = document.getElementById('pwConfirm').value;

  if (new_password !== confirm) {
    alertEl.textContent = 'Die neuen Passwörter stimmen nicht überein.';
    alertEl.className = 'alert alert-error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Speichern…';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password })
    });
    const data = await res.json();
    if (!res.ok) {
      alertEl.textContent = data.error || 'Fehler beim Speichern.';
      alertEl.className = 'alert alert-error';
    } else {
      alertEl.textContent = 'Passwort erfolgreich geändert.';
      alertEl.className = 'alert alert-success';
      document.getElementById('pwChangeForm').reset();
      sessionStorage.removeItem('pw_expiry_warning');
    }
  } catch {
    alertEl.textContent = 'Verbindungsfehler.';
    alertEl.className = 'alert alert-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Passwort ändern';
  }
});
```

- [ ] **Schritt 3: Manuell testen**

Profil aufrufen → Karte „Passwort ändern" sichtbar. Falsches aktuelles Passwort → Fehlermeldung. Korrektes Passwort → Erfolgsmeldung, Felder geleert.

- [ ] **Schritt 4: Committen**

```bash
git add public/profile.html public/js/profile.js
git commit -m "feat: Passwort-Ändern-Karte im Profil"
```

---

## Task 8: dashboard.html + admin.html — 90-Tage-Ablauf-Warnung

**Files:**
- Modify: `public/dashboard.html:57-64`
- Modify: `public/js/dashboard.js:21-33`
- Modify: `public/admin.html:41-43`
- Modify: `public/js/admin.js` (init-Funktion)

- [ ] **Schritt 1: Banner-HTML in dashboard.html einfügen**

Direkt nach `<main class="main">` (ca. Zeile 58) einfügen:

```html
      <div id="pwExpiryBanner" class="alert alert-warning hidden" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <span>Ihr Passwort wurde seit mehr als 90 Tagen nicht geändert. <a href="profile.html#passwort">Jetzt ändern</a></span>
        <button onclick="document.getElementById('pwExpiryBanner').classList.add('hidden');sessionStorage.setItem('pw_banner_dismissed','1');" style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">×</button>
      </div>
```

- [ ] **Schritt 2: Banner-Logik in dashboard.js einfügen**

In der `init()`-Funktion, direkt nach `if (!me || !me.id) { ... }` (ca. Zeile 24), einfügen:

```js
  if ((me.password_expiry_warning || sessionStorage.getItem('pw_expiry_warning') === '1')
      && sessionStorage.getItem('pw_banner_dismissed') !== '1') {
    const banner = document.getElementById('pwExpiryBanner');
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  }
```

- [ ] **Schritt 3: Banner-HTML in admin.html einfügen**

Direkt nach `<main class="main">` (ca. Zeile 42) einfügen — gleicher Code wie in Schritt 1:

```html
      <div id="pwExpiryBanner" class="alert alert-warning hidden" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <span>Ihr Passwort wurde seit mehr als 90 Tagen nicht geändert. <a href="profile.html#passwort">Jetzt ändern</a></span>
        <button onclick="document.getElementById('pwExpiryBanner').classList.add('hidden');sessionStorage.setItem('pw_banner_dismissed','1');" style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">×</button>
      </div>
```

- [ ] **Schritt 4: Banner-Logik in admin.js einfügen**

In der `init()`-Funktion in `admin.js`, direkt nach dem Auth-Check (nach `if (!me || !me.id) { ... }`), einfügen:

```js
  if ((me.password_expiry_warning || sessionStorage.getItem('pw_expiry_warning') === '1')
      && sessionStorage.getItem('pw_banner_dismissed') !== '1') {
    const banner = document.getElementById('pwExpiryBanner');
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  }
```

- [ ] **Schritt 5: Manuell testen**

User dessen `password_changed_at` fehlt oder > 90 Tage alt ist einloggen → Banner erscheint auf Dashboard/Admin. „×" klicken → Banner verschwindet und bleibt weg (sessionStorage). Passwort im Profil ändern → Banner taucht beim nächsten Login nicht mehr auf.

- [ ] **Schritt 6: Committen**

```bash
git add public/dashboard.html public/js/dashboard.js public/admin.html public/js/admin.js
git commit -m "feat: 90-Tage-Passwort-Ablauf-Warnung in Dashboard und Admin"
```

---

## Abschluss-Check

Nach allen Tasks manuell durchspielen:

1. **Neuer Kunde anlegen** (Admin-Panel) → Login als Kunde → Weiterleitung zu `change-password.html` → Passwort ändern → Dashboard
2. **Admin-Account** (frisch angelegt) → Login → Weiterleitung zu `change-password.html` → Passwort ändern → Admin-Panel
3. **Bestehender User ohne password_changed_at** → Login → Banner auf Dashboard sichtbar → dismissbar
4. **Passwort in Profil ändern** → Erfolgsmeldung → Banner beim nächsten Login weg
5. **Falsches aktuelles Passwort** → Fehlermeldung, kein Crash
6. **Gleiches Passwort erneut setzen** → `400 "muss sich unterscheiden"`
