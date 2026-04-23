# Schadenportal Schindelhauer — CLAUDE.md

## Überblick

Eigenständiges Kundenportal für die Felix Schindelhauer GmbH (Continentale-Agentur).  
Kunden melden Schäden, laden Dokumente hoch und verfolgen den Bearbeitungsstand.  
Admins (Sachbearbeiter) pflegen Status, Timeline, Dokumente und Nachrichten.

**Stack:** Node.js · Express.js · NeDB (@seald-io/nedb) · Nodemailer · Vanilla JS  
**Port:** 3002 (Entwicklung) — konfigurierbar via `PORT` in `.env`  
**Start:** `node server.js`

---

## Projektstruktur

```
Schadenportal/
├── server.js          # Hauptdatei: alle API-Routen, Auth, Middleware
├── db.js              # NeDB-Collections + seedAdmin() + getNextCaseNumber()
├── middleware/
│   └── auth.js        # requireLogin, requireAdmin
├── public/            # Statische HTML/CSS-Dateien (Inline-JS, kein Build-Schritt)
│   ├── login.html
│   ├── dashboard.html
│   ├── case-new.html
│   ├── case-detail.html
│   ├── profile.html
│   ├── change-password.html
│   ├── admin.html
│   └── style.css
├── uploads/
│   └── documents/     # Hochgeladene Dateien (nicht ins Repo einchecken!)
├── data/              # NeDB-Datenbankdateien (nicht ins Repo einchecken!)
│   ├── users.db
│   ├── cases.db
│   ├── timeline.db
│   ├── documents.db
│   ├── messages.db
│   └── settings.db
├── .env               # Lokale Konfiguration (nie ins Repo!)
└── .env.example       # Vorlage für neue Instanzen
```

---

## Datenmodelle

| Collection | Felder |
|------------|--------|
| **users** | email, password_hash, full_name, phone, mobile, role (customer\|admin), notification_preference (email\|whatsapp), created_at, last_login_at, must_change_password |
| **cases** | _id, case_number (SCH-YYYY-NNNN), user_id, sparte, title, description, damage_date, status (offen\|in_bearbeitung\|abgeschlossen), created_at, updated_at |
| **timeline** | _id, case_id, author_role (admin\|customer), text, created_at |
| **documents** | _id, case_id, uploaded_by_role, filename (uuid), original_name, mimetype, created_at |
| **messages** | _id, case_id, author_id, author_role, text, read_by_admin, read_by_customer, created_at |
| **settings** | agency_name, agency_phone, agency_whatsapp |

---

## API-Routen

| Methode | Route | Auth | Beschreibung |
|---------|-------|------|--------------|
| POST | /api/auth/login | — | Login |
| POST | /api/auth/logout | — | Logout |
| GET | /api/auth/me | Login | Eigene Nutzerdaten |
| POST | /api/auth/change-password | Login | Passwort ändern |
| GET/PUT | /api/profile | Login | Profil lesen/speichern |
| GET | /api/cases | Login | Fälle (Kunde: eigene, Admin: alle) |
| POST | /api/cases | Login | Neuen Fall anlegen |
| GET | /api/cases/:id | Login | Falldetails |
| PATCH | /api/cases/:id/status | Admin | Status ändern |
| GET/POST | /api/cases/:id/timeline | Login | Timeline |
| GET/POST | /api/cases/:id/documents | Login | Dokumente |
| GET | /uploads/documents/:filename | Login | Datei-Download |
| DELETE | /api/documents/:docId | Login | Dokument löschen |
| GET/POST | /api/cases/:id/messages | Login | Nachrichten |
| PATCH | /api/cases/:id/messages/read | Login | Als gelesen markieren |
| POST | /api/cases/:id/notify | Admin | Kundenbenachrichtigung |
| GET | /api/admin/customers | Admin | Kundenliste |
| POST | /api/admin/customers | Admin | Kunden anlegen |
| PUT | /api/admin/customers/:id/password | Admin | Passwort setzen |
| DELETE | /api/admin/customers/:id | Admin | Kunden löschen (DSGVO) |
| GET | /api/settings | — | Agentur-Einstellungen |

---

## Sicherheit

- **Session:** express-session mit FileStore-Fallback; `SESSION_SECRET` aus `.env`
- **CSRF-Schutz:** `X-Requested-With: XMLHttpRequest` auf allen API-Anfragen
- **Rate-Limiting:** Login: 10/15 min; alle POST-Routen: 30/min
- **Passwort:** bcryptjs (12 rounds)
- **Uploads:** MIME-Whitelist (JPG, PNG, WebP, PDF), max. 10 MB
- **Datei-Download:** Authentifizierung erforderlich (kein direkter public-Pfad)
- **Helmet:** Sicherheits-Header inkl. CSP

---

## Benachrichtigungen

- **E-Mail:** Nodemailer → SMTP-Konfiguration in `.env` (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- **WhatsApp:** wa.me-URL mit vorausgefülltem Text (kein bezahlter API-Dienst)
  - Admin klickt „Benachrichtigen" → öffnet WhatsApp-Web mit Kundennummer

---

## Sparten

`hausrat` · `wohngebaeude` · `haftpflicht` · `kfz` · `glas`

---

## Wichtige Konventionen

- **Inline-JS:** Alle Seiten haben `<script>` direkt in der HTML-Datei — kein separates JS-Bundle
- **api()-Hilfsfunktion:** Jede Seite enthält eine lokale `api(url, opts)` Funktion mit `credentials: 'same-origin'` und dem CSRF-Header
- **Admin vs. Kunde:** `req.session.role === 'admin'` — gespeichert beim Login
- **case_number:** Wird von `getNextCaseNumber()` in db.js vergeben, nie manuell setzen
- **DSGVO-Löschung:** `DELETE /api/admin/customers/:id` löscht alle Cases, Timeline, Docs (inkl. Dateien auf Disk), Messages des Kunden

---

## Entwicklung

```bash
cp .env.example .env
# .env anpassen: SESSION_SECRET, ADMIN_PASSWORD, SMTP_*
node server.js
# → http://localhost:3002
```

Admin-Login beim ersten Start: `ADMIN_EMAIL` / `ADMIN_PASSWORD` aus `.env`

---

## Deployment (Railway / VPS)

- `DATA_DIR` und `UPLOADS_DIR` auf persistente Volumes setzen
- `NODE_ENV=production`
- `SESSION_SECRET` mit starkem Zufallswert belegen:  
  `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- SMTP-Zugangsdaten konfigurieren
- `APP_URL` auf die echte Domain setzen (für E-Mail-Links)
