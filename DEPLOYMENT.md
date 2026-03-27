# Deployment-Anleitung: Kundenportal auf GitHub & beim Kunden ausrollen

## Inhaltsverzeichnis
1. [Sicherheits-Check vor dem ersten Push](#1-sicherheits-check-vor-dem-ersten-push)
2. [GitHub Repository erstellen](#2-github-repository-erstellen)
3. [Git einrichten & ersten Push durchführen](#3-git-einrichten--ersten-push-durchführen)
4. [Beim Kunden installieren](#4-beim-kunden-installieren)
   - [Option A: Railway.app (empfohlen)](#option-a--railwayapp-empfohlen-für-einfaches-hosting)
   - [Option B: Eigener VPS](#option-b--eigener-vps-z-b-hetzner-für-vollständige-kontrolle)
5. [Sicherheits-Hinweise für Produktion](#5-sicherheits-hinweise-für-produktion)
6. [DSGVO & Datenschutz](#6-dsgvo--datenschutz)
7. [Updates einspielen](#7-updates-einspielen)

---

## 1. Sicherheits-Check vor dem ersten Push

**Folgende Dateien dürfen NIEMALS auf GitHub landen:**

| Datei / Ordner | Warum |
|----------------|-------|
| `.env` | Enthält Passwörter und Session-Secret |
| `data/*.db` | Enthält echte Kundendaten (DSGVO!) |
| `data/sessions/` | Enthält aktive Sitzungen |
| `uploads/` | Enthält von Kunden hochgeladene Dokumente |
| `node_modules/` | Zu groß, wird bei Installation neu geladen |

**Prüfen, ob .gitignore korrekt ist:**
```bash
cat .gitignore
```
Die Datei muss mindestens folgende Zeilen enthalten:
```
node_modules/
data/
.env
uploads/
```

**Nach Passwörtern/Secrets im Code suchen:**
```bash
grep -r "password\|secret\|api_key\|apikey" --include="*.js" --include="*.json" . | grep -v node_modules | grep -v ".gitignore"
```
Keine echten Werte sollten im Code stehen — nur Referenzen auf `process.env.VARIABLE`.

**Prüfen, was Git tracken würde (Trockenübung):**
```bash
git status
```
Wenn `.env` oder `data/` auftauchen: STOPP! Erst `.gitignore` korrigieren.

---

## 2. GitHub Repository erstellen

1. Gehe zu [github.com](https://github.com) und melde dich an (oder erstelle einen Account)
2. Klicke oben rechts auf **"+"** → **"New repository"**
3. Einstellungen:
   - **Repository name:** z.B. `kundenportal` oder `kundenportal-schindelhauer`
   - **Visibility: PRIVAT** (wichtig! Nicht öffentlich, da es Kundeninfrastruktur ist)
   - **KEIN** Haken bei "Add a README file"
   - **KEIN** Haken bei "Add .gitignore"
4. Klicke **"Create repository"**
5. Notiere die angezeigte Repository-URL, z.B.:
   ```
   https://github.com/DEIN-BENUTZERNAME/kundenportal.git
   ```

---

## 3. Git einrichten & ersten Push durchführen

Öffne ein Terminal im Ordner `Kundenapp/` und führe folgende Befehle der Reihe nach aus:

```bash
# 1. Git im Ordner initialisieren (einmalig)
git init

# 2. Alle Dateien zur Staging-Area hinzufügen (.gitignore wird automatisch beachtet)
git add .

# 3. Ersten Commit erstellen
git commit -m "Initial commit: Kundenportal"

# 4. GitHub-Repository verknüpfen (URL anpassen!)
git remote add origin https://github.com/DEIN-BENUTZERNAME/kundenportal.git

# 5. Code auf GitHub hochladen
git push -u origin master
```

**GitHub fragt nach Anmeldedaten:**
- Benutzername: dein GitHub-Benutzername
- Passwort: ein **Personal Access Token** (kein GitHub-Passwort!)
  - Token erstellen: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
  - Berechtigungen: Haken bei `repo`
  - Token sicher speichern — er wird nur einmal angezeigt!

**Prüfen ob alles korrekt ist:**
- Gehe auf GitHub → dein Repository
- Prüfe: Ist `.env` vorhanden? → Wenn ja, STOPP und Fehler beheben!
- Prüfe: Ist `data/` vorhanden? → Wenn ja, STOPP und Fehler beheben!

---

## 4. Beim Kunden installieren

### Option A – Railway.app (empfohlen für einfaches Hosting)

Railway verbindet sich direkt mit GitHub und deployt automatisch. HTTPS ist inklusive.

**Kosten:** Ca. 5–10 USD/Monat (Hobby-Plan), EU-Server verfügbar.

**Schritte:**

1. Gehe zu [railway.app](https://railway.app) und melde dich mit GitHub an
2. Klicke **"New Project"** → **"Deploy from GitHub repo"**
3. Wähle dein `kundenportal`-Repository aus
4. Railway erkennt Node.js automatisch und startet das Deployment
5. Klicke auf den Service → **"Variables"** → Umgebungsvariablen eintragen:

   | Variable | Wert |
   |----------|------|
   | `PORT` | `3000` (Railway nutzt intern Port 3000) |
   | `SESSION_SECRET` | Langen Zufallsstring (siehe unten) |
   | `ADMIN_EMAIL` | z.B. `admin@kundenname.de` |
   | `ADMIN_PASSWORD` | Sicheres Passwort |

6. Zufälligen SESSION_SECRET generieren:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
7. Unter **"Settings"** → **"Networking"** eine öffentliche Domain zuweisen
8. Fertig! Das Portal ist unter `https://xyz.railway.app` erreichbar

**Eigene Domain (optional):**
- Railway → Settings → Custom Domain → Domain eintragen
- Beim Domain-Anbieter einen CNAME-Eintrag auf die Railway-Domain setzen

---

### Option B – Eigener VPS (z.B. Hetzner, für vollständige Kontrolle)

**Voraussetzungen auf dem Server:** Node.js 18+, Git, npm, pm2

```bash
# 1. Repository auf dem Server klonen
git clone https://github.com/DEIN-BENUTZERNAME/kundenportal.git
cd kundenportal

# 2. Abhängigkeiten installieren
npm install

# 3. Umgebungsvariablen anlegen
cp .env.example .env
nano .env   # Werte anpassen!

# 4. Datenbankordner anlegen
mkdir -p data/sessions

# 5. Mit pm2 als Dienst starten (läuft nach Server-Neustart weiter)
npm install -g pm2
pm2 start server.js --name kundenportal
pm2 startup   # Autostart bei Neustart einrichten
pm2 save

# 6. HTTPS einrichten (nginx + Let's Encrypt)
# nginx als Reverse Proxy vor Node.js → zertifikate über certbot
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d meinedomain.de
```

---

## 5. Sicherheits-Hinweise für Produktion

**Vor dem ersten Kundenstart zwingend erledigen:**

- [ ] `SESSION_SECRET` durch langen Zufallsstring ersetzen (mind. 64 Zeichen)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] `ADMIN_PASSWORD` auf ein sicheres Passwort ändern (mind. 12 Zeichen, Sonderzeichen)
- [ ] `ADMIN_EMAIL` auf eine echte E-Mail-Adresse setzen
- [ ] HTTPS aktiviert (Railway: automatisch; VPS: nginx + certbot)
- [ ] Regelmäßige Backups des `data/`-Ordners einrichten
- [ ] GitHub-Repository auf "Private" gestellt

**Backup-Skript (VPS):**
```bash
# Täglich um 2 Uhr sichern (crontab -e)
0 2 * * * tar -czf /backup/kundenportal-$(date +%Y%m%d).tar.gz /pfad/zum/kundenportal/data/
```

---

## 6. DSGVO & Datenschutz

Das Portal verarbeitet personenbezogene Daten (Kundennamen, Verträge, Nachrichten).

**Wichtige Punkte:**

- **Serverstandort:** EU-Region wählen! Railway → Beim Erstellen "Europe West" auswählen. Hetzner hat Rechenzentren in Deutschland (Nürnberg, Falkenstein).
- **Auftragsverarbeitungsvertrag (AVV):** Bei externem Hosting (Railway, Hetzner etc.) muss ein AVV mit dem Anbieter abgeschlossen werden.
  - Railway: Unter [railway.app/legal/dpa](https://railway.app/legal/dpa) abrufbar
  - Hetzner: Unter Hetzner-Kundenkonto → Bestellungen → DPA
- **Datensparsamkeit:** Nur notwendige Daten erfassen
- **Datenlöschung:** Kunden auf Wunsch löschen (Funktion im Admin-Panel vorhanden)
- **Keine Kundendaten ins Git-Repo:** `.gitignore` schützt `data/` — niemals manuell umgehen!
- **Verschlüsselung:** HTTPS ist Pflicht (kein HTTP in Produktion)
- **Datenschutzerklärung:** Auf der Website des Kunden muss eine Datenschutzerklärung vorhanden sein, die das Portal erwähnt

---

## 7. Updates einspielen

Wenn du das Portal weiterentwickelst und Updates zum Kunden bringen möchtest:

**Lokal: Änderungen pushen**
```bash
git add .
git commit -m "Beschreibung der Änderung"
git push
```

**Railway:** Deployt automatisch nach jedem Push auf den `master`-Branch. Keine weiteren Schritte nötig.

**VPS: Manuelles Update**
```bash
cd /pfad/zum/kundenportal
git pull
npm install   # nur wenn package.json sich geändert hat
pm2 restart kundenportal
```
