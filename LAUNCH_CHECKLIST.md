# Launch-Checkliste – Kundenportal Schindelhauer

Alle Code-seitigen Sicherheitslücken wurden bereits geschlossen.
Diese Liste enthält nur noch die **manuellen Aufgaben** vor dem Live-Gang.

---

## 1. Impressum vervollständigen

**Datei:** `public/impressum.html`

Folgende Platzhalter müssen ersetzt werden:

- [ ] **Handelsregisternummer** — z. B. „Amtsgericht Recklinghausen, HRB 12345"
  → Nachschauen im Handelsregister: [handelsregister.de](https://www.handelsregister.de)
- [ ] **Vermittlerregisternummer (34d GewO)** — die Nummer aus dem DIHK-Vermittlerregister
  → Nachschauen unter: [vermittlerregister.info](https://www.vermittlerregister.info)
- [ ] **Umsatzsteuer-ID** — „DE…" Nummer vom Finanzamt

---

## 2. Auftragsverarbeitungsvertrag (AVV) mit Railway abschließen

**Warum:** DSGVO Art. 28 — ohne schriftlichen AVV ist der Betrieb rechtswidrig.

- [ ] Login unter [railway.app](https://railway.app) → Account Settings → Legal → **Data Processing Agreement** herunterladen und unterzeichnen
- [ ] Unterzeichnetes Exemplar aufbewahren (mind. 3 Jahre)
- [ ] In die interne Datenschutzdokumentation aufnehmen

---

## 3. Umgebungsvariablen in Railway prüfen

- [ ] `SESSION_SECRET` gesetzt? — mind. 32 zufällige Zeichen
- [ ] `TOTP_ENCRYPTION_KEY` gesetzt? — exakt 64 Hex-Zeichen
  Generieren: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] `ADMIN_PASSWORD` gesetzt? — mind. 12 Zeichen, Groß+Klein+Zahl
- [ ] `NODE_ENV=production` gesetzt?
- [ ] `REDIS_URL` gesetzt? (empfohlen — ohne Redis werden Sessions in Dateien gespeichert)

---

## 4. Admin-Konto nach erstem Login absichern

- [ ] Ersten Login mit dem gesetzten `ADMIN_PASSWORD` durchführen
- [ ] Passwort sofort ändern (Portal fordert das automatisch)
- [ ] **2-Faktor-Authentifizierung (2FA) aktivieren** — das Portal erzwingt dies für Admins
- [ ] Neues sicheres Admin-Passwort an einem sicheren Ort speichern (Passwort-Manager)

---

## 5. DSGVO-Dokumentation anlegen

Auch wenn du kein großes Unternehmen bist, braucht jeder Verantwortliche diese Unterlagen:

- [ ] **Verzeichnis von Verarbeitungstätigkeiten (VVT)** nach Art. 30 DSGVO erstellen
  — Vorlage: [LDI NRW Muster-VVT](https://www.ldi.nrw.de)
  — Einträge: Kundenportal-Betrieb, Versicherungsvermittlung, E-Mail-Kommunikation
- [ ] **Technische und organisatorische Maßnahmen (TOM)** dokumentieren
  — Stichpunkte: HTTPS/TLS, bcrypt-Passwort-Hashing, AES-256-GCM TOTP-Verschlüsselung,
    Session-Absicherung, Rate-Limiting, 2FA-Pflicht für Admins, Daten-Retention-Job

---

## 6. Rechtlichen Rat einholen (empfohlen)

- [ ] Kurzprüfung durch DSGVO-Anwalt: Ob **Art. 9 Abs. 2 lit. b BDSG** als Rechtsgrundlage
  für die Speicherung von Krankenversicherungsdaten (GKV/PKV) in deinem konkreten
  Beratungsauftrag trägt — oder ob eine **explizite Einwilligung** (Art. 9 Abs. 2 lit. a)
  sicherer wäre.
  > Hintergrund: Krankenversicherungsdaten gelten als besondere Kategorie nach Art. 9 DSGVO.
  > Falsche Rechtsgrundlage = Bußgeldrisiko.

---

## 7. Test vor Live-Gang

- [ ] Login mit falschem Passwort 10x versuchen → Rate-Limiter muss greifen
- [ ] Als Kunde: auf `/admin.html` navigieren → API-Calls müssen mit 403 fehlschlagen
- [ ] Daten-Export (Art. 15) testen → TXT-Datei muss Aktivitätsprotokolle korrekt anzeigen
- [ ] 2FA-Setup und Login mit TOTP-Code testen
- [ ] Konto-Löschung testen → alle Daten müssen entfernt sein
- [ ] Datenschutzerklärung und Impressum von der Login-Seite aus erreichbar? ✓

---

## Priorität

| Priorität | Aufgabe |
|-----------|---------|
| **Kritisch** | AVV mit Railway (Nr. 2) |
| **Kritisch** | Umgebungsvariablen setzen (Nr. 3) |
| **Kritisch** | Impressum vervollständigen (Nr. 1) |
| **Hoch** | Admin-Konto absichern (Nr. 4) |
| **Hoch** | Rechtliche Prüfung Art. 9 (Nr. 6) |
| **Mittel** | DSGVO-Dokumentation (Nr. 5) |
| **Mittel** | Abschlusstests (Nr. 7) |
