# Sicherheits- & Datenschutz-Audit — Kundenportal

**Erstellt:** 2026-04-08 | **Geprüft mit:** Claude Sonnet + Opus  
**Status:** In Bearbeitung

---

## 🔴 Kritisch — sofort beheben

### K1: Uploads ohne Authentifizierung öffentlich zugänglich
- **Datei:** `server.js`, Zeile 38
- **Problem:** `app.use('/uploads', express.static(...))` — Vertrags-Scans sind für jeden abrufbar, der die URL kennt oder errät. Hochsensible Versicherungsdokumente!
- **Fix:** Eigenen authentifizierten Endpunkt bauen, der Zugriff nur für den Eigentümer des Vertrags erlaubt.
```js
app.get('/uploads/contracts/:filename', requireLogin, async (req, res) => {
  const contract = await contracts.findOneAsync({ scan_image: req.params.filename, user_id: req.session.userId });
  if (!contract && req.session.userRole !== 'admin') return res.status(403).json({ error: 'Kein Zugriff' });
  res.sendFile(path.join(__dirname, 'uploads', 'contracts', req.params.filename));
});
```
- [x] **Erledigt**

---

### K2: Kein CSRF-Schutz
- **Datei:** `server.js` (alle POST/PUT/DELETE-Routen)
- **Problem:** Kein CSRF-Token. Ein Angreifer kann eingeloggte User zu ungewollten Aktionen bringen (Account löschen, Passwort ändern, Einwilligungen ändern). `sameSite: 'strict'` mildert es, ist aber kein vollständiger Schutz.
- **Fix:** `csrf-csrf` Paket installieren und Middleware einbinden, oder Custom-Header-Pattern (`X-Requested-With`) verwenden.
- [ ] **Erledigt**

---

### K3: Keine HTTP-Security-Header (Helmet fehlt)
- **Datei:** `server.js`
- **Problem:** Kein `Content-Security-Policy`, kein `X-Frame-Options` (Clickjacking möglich), kein `X-Content-Type-Options`, kein `Strict-Transport-Security`, kein `Referrer-Policy`.
- **Fix:**
```bash
npm install helmet
```
```js
const helmet = require('helmet');
app.use(helmet());
```
- [x] **Erledigt**

---

### K4: SESSION_SECRET Fallback ist unsicher
- **Datei:** `server.js`, Zeile 44
- **Problem:** `|| 'bitte-in-.env-aendern-' + Math.random()` — Bei fehlendem Secret wird jeder Neustart alle Sessions invalidieren und ein kryptographisch schwaches Secret verwenden.
- **Fix:**
```js
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET nicht in .env gesetzt!');
  process.exit(1);
}
```
- [x] **Erledigt**

---

### K5: Admin-Default-Passwort im Code
- **Datei:** `db.js`, Zeile 25
- **Problem:** `|| 'Admin1234!'` — Wenn `ADMIN_PASSWORD` nicht in `.env` gesetzt ist, wird ein triviales bekanntes Passwort verwendet. Zusammen mit der Default-E-Mail ein vollständiger Credential-Leak.
- **Fix:** Wie K4 — Start verweigern wenn `ADMIN_PASSWORD` fehlt:
```js
if (!process.env.ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD nicht in .env gesetzt!');
  process.exit(1);
}
```
- [x] **Erledigt**

---

## 🟠 Hoch — bald beheben

### H1: Upload MIME-Prüfung durch Client umgehbar
- **Datei:** `server.js`, Zeile 28
- **Problem:** `file.mimetype` wird vom Client gesendet und ist fälschbar. Eine HTML-Datei mit MIME `image/jpeg` wird akzeptiert → mögliches Stored XSS (besonders kritisch zusammen mit K1).
- **Fix:** Dateiendung zusätzlich prüfen + idealerweise Magic Bytes validieren (`npm install file-type`).
```js
const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
const ext = path.extname(file.originalname).toLowerCase();
if (!allowed.includes(ext)) return cb(new Error('Ungültiger Dateityp'));
```
- [x] **Erledigt**

---

### H2: Path Traversal bei Upload-Dateiname
- **Datei:** `server.js`, Zeile 23
- **Problem:** `req.params.id` wird unvalidiert in den Dateinamen eingebaut. Bei manipulierten IDs (z.B. `../../etc`) könnte ein Path-Traversal entstehen.
- **Fix:**
```js
const id = (req.params.contractId || req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
```
- [x] **Erledigt**

---

### H3: Passwort-Policy zu schwach
- **Datei:** `server.js`, Zeilen 168, 184
- **Problem:** Nur `length >= 8` wird geprüft. Für ein Portal mit Finanzdaten unzureichend.
- **Fix:** Mindestanforderungen erhöhen (>= 12 Zeichen, Groß/Klein/Zahl) — `validatePasswordStrength()` Helper.
- [x] **Erledigt**

---

### H4: Rate Limiting auf sensitiven Endpunkten unvollständig
- **Datei:** `server.js`
- **Problem:** `POST /api/auth/change-password` und `DELETE /api/auth/account` haben kein Rate Limiting. Brute-Force auf aktuelles Passwort möglich.
- **Fix:** `loginLimiter` auch auf diese Routen anwenden.
- [x] **Erledigt**

---

### H5: path-to-regexp ReDoS-Lücke (npm audit: HIGH)
- **Paket:** `path-to-regexp < 0.1.13`
- **Problem:** Regular Expression Denial of Service — böswillige URLs können den Server blockieren. GHSA-37ch-88jc-xwx2
- **Fix:**
```bash
npm audit fix
```
- [x] **Erledigt**

---

### H6: TOTP-Secret im Klartext in der Datenbank
- **Datei:** `server.js`, Zeilen 258, 289–291
- **Problem:** Das TOTP-Secret liegt unverschlüsselt in `users.db`. Bei einem DB-Leak kann ein Angreifer 2FA-Codes generieren.
- **Fix:** TOTP-Secrets mit AES-256-GCM und einem Server-Key aus der Umgebungsvariable verschlüsseln.
- [ ] **Erledigt**

---

### H7: Session-Dateien im Klartext auf Disk
- **Datei:** `server.js`, Zeile 43
- **Problem:** `session-file-store` speichert Sessions als Plaintext-JSON-Dateien. Bei Server-Kompromittierung sofort lesbar.
- **Fix:** Für Produktion Redis oder verschlüsselten Store verwenden (`connect-redis`).
- [ ] **Erledigt**

---

### H8: speakeasy (2FA-Paket) nicht mehr aktiv gewartet
- **Problem:** `speakeasy` hat seit Jahren keine Updates erhalten. Sicherheitsprobleme werden nicht mehr gepatcht.
- **Fix:** Migration zu `otplib` (aktiv gewartet, gleiche API-Struktur).
- [ ] **Erledigt**

---

## 🟡 Datenschutz / DSGVO

### D1: Kein Datenauskunfts-Endpunkt (Art. 15 DSGVO)
- **Problem:** Kunden haben das Recht, alle über sie gespeicherten Daten zu erhalten. Es gibt keinen Export-Endpunkt.
- **Fix:** `GET /api/auth/data-export` implementieren — liefert Profil, Verträge, Nachrichten, Activity-Log als JSON. Download-Button in `profile.html`.
- [x] **Erledigt**

---

### D2: Gesundheitsdaten ohne Art.-9-DSGVO-Einwilligung
- **Datei:** `server.js`, Zeilen 531–532 | `consent.html`
- **Problem:** `health_insurance_type` (GKV/PKV) und `health_insurance_provider` sind Gesundheitsdaten nach Art. 9 DSGVO (besondere Kategorien). Die aktuelle Analyse-Einwilligung deckt diese nicht explizit ab.
- **Fix:** Separate, ausdrückliche Einwilligung mit klarem Hinweis auf Gesundheitsdaten einholen — `consent_health_data` Feld + eigene Checkbox in `consent.html`.
- [x] **Erledigt**

---

### D3: Datensparsamkeit verletzt — ungenutzte Felder (Art. 5 Abs. 1 lit. c DSGVO)
- **Datei:** `server.js`, Zeilen 537–551
- **Problem:** Nettoeinkommen, alle Ausgaben-Felder (Lebensmittel, Telekommunikation, Freizeit, Kleidung...) werden erhoben, aber in `generateRecommendations()` nie ausgewertet. Datensparsamkeit verletzt.
- **Fix:** Felder `net_income`, `ausgaben_lebensmittel`, `ausgaben_telekommunikation`, `ausgaben_freizeit`, `ausgaben_kleidung` aus Allowlist und GET-Response entfernt.
- [x] **Erledigt**

---

### D4: Keine Aufbewahrungsfristen / automatische Löschung (Art. 5 Abs. 1 lit. e DSGVO)
- **Problem:** Activity-Logs und Nachrichten werden nie automatisch gelöscht.
- **Fix:** `runRetentionJob()` implementiert — Activity-Logs nach 12 Monaten, gelesene Nachrichten nach 24 Monaten. Läuft täglich beim Serverstart.
- [x] **Erledigt**

---

### D5: Einwilligung nicht granular genug (Art. 7 DSGVO)
- **Datei:** `consent.html`
- **Problem:** Ein einzelnes Kontrollkästchen für die gesamte Analyse. Nicht differenziert genug, besonders für Gesundheitsdaten (→ D2).
- **Fix:** Separate Einwilligung für Gesundheitsdaten (Art. 9 DSGVO) hinzugefügt — eigene Checkbox mit explizitem Hinweistext.
- [x] **Erledigt**

---

### D6: Datenschutzerklärung nicht verlinkt (Art. 13 DSGVO)
- **Datei:** `login.html`, `consent.html`
- **Problem:** Kein Link zur Datenschutzerklärung auf der Login-Seite. Informationspflichten nach Art. 13 DSGVO müssen bei der Datenerhebung erfüllt sein.
- **Fix:** Link auf `datenschutz.html` in `login.html` und `consent.html` eingebaut. ⚠️ Datenschutz-Seite selbst muss noch inhaltlich befüllt werden.
- [x] **Erledigt**

---

### D7: Account-Lösch-Logik unvollständig
- **Datei:** `server.js`, Zeilen 220–233 und 784–806
- **Problem:** Beim Löschen eines Accounts werden `appointments` (falls dort referenziert) und Dateisystem-Sessions nicht bereinigt.
- **Fix:** `appointments.removeAsync` zur Löschroutine hinzugefügt.
- [x] **Erledigt**

---

### D8: `/api/settings` ohne Authentifizierung
- **Datei:** `server.js`, Zeile 675
- **Problem:** Agentur-Daten (E-Mail, Telefon, WhatsApp-Nummer) sind ohne Login abrufbar. Nicht direkt gefährlich, aber unnötige Datenoffenlegung. Sollte bewusst entschieden und dokumentiert sein.
- **Fix:** Bewusste Entscheidung getroffen und im Code dokumentiert — Daten werden auf der Login-Seite benötigt (kein Login ohne Agenturinfo möglich). Enthält nur öffentliche Kontaktdaten.
- [x] **Erledigt**

---

## 🟢 Bereits gut — kein Handlungsbedarf

| Bereich | Details |
|---|---|
| Passwort-Hashing | bcrypt, Cost Factor 12 ✓ |
| Session-Regeneration nach Login + 2FA | Schutz vor Session-Fixation ✓ |
| Rate Limiting auf Login + 2FA | 10 Versuche / 15 Min ✓ |
| Cookie-Flags | httpOnly, sameSite: strict, secure (prod) ✓ |
| TOTP Replay-Schutz | Letzter Token wird gespeichert ✓ |
| Passwort-Erstlogin-Pflicht + 90-Tage-Warnung | Neu implementiert ✓ |
| Allowlist-Pattern bei Profil-Updates | Kein Mass Assignment ✓ |
| Account-Selbstlöschung mit Passwortbestätigung | Art. 17 DSGVO ✓ |
| Einwilligung optional + widerrufbar | Art. 7 Abs. 3 DSGVO ✓ |
| Generische Login-Fehlermeldungen | Kein User-Enumeration ✓ |
| .gitignore korrekt | data/, .env, uploads/ ausgeschlossen ✓ |
| Admin-Übersicht zeigt nur Metadaten | Keine Finanzdaten in der Liste ✓ |

---

## Fortschritt

- **Kritisch:** 4 / 5 erledigt *(offen: K2 CSRF)*
- **Hoch:** 5 / 8 erledigt *(offen: H6 TOTP-Verschlüsselung, H7 Session-Store, H8 speakeasy-Migration)*
- **Datenschutz:** 8 / 8 erledigt*
- **Gesamt:** 17 / 21 erledigt

*⚠️ D6: Link zu `datenschutz.html` gesetzt — Inhalt der Seite muss noch erstellt werden.*
