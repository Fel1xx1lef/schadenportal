# Passwort-Management — Design-Dokument

**Datum:** 2026-04-07  
**Projekt:** Kundenportal Felix Schindelhauer GmbH

---

## Überblick

Drei Anforderungen werden in einem Feature zusammengefasst:

1. **Erstlogin-Passwortänderung** — Alle Nutzer (Admin + Kunden) müssen ihr Passwort beim ersten Login ändern.
2. **Passwort jederzeit ändern** — UI-Sektion im Profil zum freiwilligen Ändern (API existiert bereits).
3. **Passwort-Ablauf-Warnung** — Nach 90 Tagen erscheint ein dismissbares Banner; kein harter Block.

---

## Datenmodell

Neue Felder im User-Dokument (NeDB):

| Feld | Typ | Bedeutung |
|---|---|---|
| `must_change_password` | `boolean` | Wird beim Anlegen gesetzt; nach erster Änderung entfernt |
| `password_changed_at` | ISO-String | Zeitstempel der letzten Passwortänderung |

Migration: Bestehende User ohne `password_changed_at` gelten als „nie geändert" → Warnung erscheint sofort beim nächsten Login.

---

## Backend

### db.js — seedAdmin()
`must_change_password: true` beim initialen Admin-Account hinzufügen.

### Admin-Route — neuen Kunden anlegen
Wo immer ein neuer User angelegt wird (Admin-Panel), wird `must_change_password: true` gesetzt.

### POST /api/auth/login
Nach erfolgreichem Login (Passwort korrekt, 2FA abgeschlossen):

```
if user.must_change_password:
  → { ok: true, requires_password_change: true }

else if password_changed_at fehlt ODER älter als 90 Tage:
  → { ok: true, password_expiry_warning: true, ...normaler Login }
```

Beide Flags können gleichzeitig auftreten (neuer User + keine `password_changed_at` → nur `requires_password_change` hat Vorrang).

### POST /api/auth/change-password (bestehend, erweitern)
Nach erfolgreicher Änderung:
- `password_changed_at` auf `new Date().toISOString()` setzen
- `must_change_password` entfernen (`$unset`)

### GET /api/auth/me (bestehend, erweitern)
Gibt zusätzlich zurück:
- `password_expiry_warning: true/false` — damit Dashboard und Admin-Seite das Banner zeigen können, auch ohne frischen Login

---

## Frontend

### login.js — Weiterleitungslogik erweitern
Priorität der Weiterleitungen (von oben nach unten):

1. `requires_2fa` → `2fa-verify.html`
2. `requires_2fa_setup` → `2fa-setup.html` (nur Admin)
3. `requires_password_change` → `change-password.html` **(neu)**
4. `role === 'admin'` → `admin.html`
5. `!consent_given` → `consent.html`
6. Sonst → `dashboard.html`

Das `password_expiry_warning`-Flag wird bei normalem Login in `sessionStorage` gespeichert, damit Dashboard/Admin es lesen können.

### change-password.html (neu)
Eigenständige Seite im Stil der bestehenden Auth-Seiten (Login, 2FA-Setup).

Felder:
- Aktuelles Passwort
- Neues Passwort (min. 8 Zeichen)
- Neues Passwort bestätigen

Nach Erfolg: Weiterleitung zur ursprünglichen Zielseite (Admin oder Dashboard) abhängig von `sessionStorage.userRole`.

### js/change-password.js (neu)
- Ruft `POST /api/auth/change-password` auf
- Zeigt Validierungsfehler inline
- Nach Erfolg: Weiterleitung

### profile.html — neue Karte „Passwort ändern"
Zwischen der 2FA-Karte und dem Konto-löschen-Bereich. Formular mit drei Feldern (aktuell, neu, bestätigen). Nutzt denselben API-Endpunkt.

Kein separates JS nötig — Logik in `profile.js` integrieren.

### dashboard.html + admin.html — Ablauf-Warnung
Beide Seiten rufen `/api/auth/me` beim Laden auf. Wenn `password_expiry_warning: true`:
- Gelbes, dismissbares Banner oben im `main`-Bereich
- Text: „Ihr Passwort wurde seit mehr als 90 Tagen nicht geändert. [Jetzt ändern]"
- Link zu `profile.html` (Abschnitt Passwort) bzw. `change-password.html`
- Banner kann per Klick auf „×" für die Session ausgeblendet werden (`sessionStorage`)

---

## Passwort-Validierung

Gilt für alle Änderungen:
- Mindestens 8 Zeichen (bereits vorhanden)
- Neues Passwort ≠ aktuelles Passwort (serverseitig prüfen)
- Bestätigung muss übereinstimmen (clientseitig)

---

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Falsches aktuelles Passwort | 401 + Fehlermeldung inline |
| Neues Passwort zu kurz | 400 + Fehlermeldung inline |
| Neues = altes Passwort | 400 + Fehlermeldung |
| Session abgelaufen auf change-password.html | Redirect zu login.html |

---

## Was nicht geändert wird

- Keine E-Mail-Benachrichtigungen (kein Mail-System vorhanden)
- Kein Hard-Block nach 90 Tagen (nur Warnung)
- Passwort-History nicht geprüft (außer „neu ≠ aktuell")
