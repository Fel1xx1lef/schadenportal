# Kundenportal auf GitHub & online stellen – Anleitung für Einsteiger

> **Was wir machen:** Den Code auf GitHub (eine Art Cloud-Speicher für Code) hochladen und dann bei einem Hosting-Dienst (Railway) online stellen, damit Kunden das Portal über das Internet aufrufen können.
>
> **Was du brauchst:** Ca. 30 Minuten, eine E-Mail-Adresse, eine Kreditkarte (für Railway, ca. 5 USD/Monat)

---

## Teil 1: GitHub einrichten (einmalig)

### Schritt 1 – GitHub-Account erstellen

1. Gehe zu **github.com**
2. Klicke auf **"Sign up"**
3. E-Mail-Adresse eingeben → Passwort wählen → Benutzernamen wählen (z.B. `felix-schindelhauer`)
4. E-Mail bestätigen

### Schritt 2 – GitHub Desktop installieren

GitHub Desktop ist ein Programm, das dir das Hochladen des Codes erleichtert — ohne komplizierte Befehle tippen zu müssen.

1. Gehe zu **desktop.github.com**
2. Klicke auf **"Download for Windows"**
3. Installiere das Programm
4. Beim ersten Start: Mit deinem GitHub-Account anmelden

### Schritt 3 – Repository erstellen

Ein "Repository" ist einfach ein Ordner auf GitHub, in dem dein Code liegt.

1. Gehe zu **github.com**
2. Klicke oben rechts auf das **"+"** Symbol → **"New repository"**
3. Fülle das Formular aus:
   - **Repository name:** `kundenportal`
   - **Description:** `Kundenportal Felix Schindelhauer GmbH`
   - Wähle **"Private"** (WICHTIG! Nicht öffentlich — da sind Kundendaten drin)
   - Alle anderen Haken NICHT setzen
4. Klicke **"Create repository"**

---

## Teil 2: Code hochladen

### Schritt 4 – Ordner mit GitHub Desktop verbinden

1. Öffne **GitHub Desktop**
2. Klicke auf **"File"** → **"Add local repository"**
3. Klicke auf **"Choose..."** und navigiere zu deinem `Kundenapp`-Ordner
   - Pfad: `C:\ClaudeProjekte\MeinProjekt\Kundenapp`
4. Wenn GitHub Desktop fragt "This directory does not appear to be a Git repository. Would you like to create one?" → Klicke **"create a repository"**
5. Gib einen Namen ein: `kundenportal`
6. Klicke **"Create repository"**

### Schritt 5 – Sicherheits-Check (sehr wichtig!)

Bevor du hochlädst, prüfe im GitHub Desktop links unter "Changes":

- Siehst du eine Datei namens `.env`? → **STOPP!** Das darf nicht hochgeladen werden. Schreibe mir eine Nachricht.
- Siehst du Dateien aus dem Ordner `data/`? → **STOPP!** Das sind Kundendaten. Schreibe mir eine Nachricht.

Wenn du nur Dateien wie `server.js`, `package.json`, `public/`, `.env.example` siehst → alles gut, weiter.

### Schritt 6 – Code committen und hochladen

1. In GitHub Desktop links unten: Schreibe in das Feld "Summary": `Erster Upload`
2. Klicke auf den blauen Button **"Commit to master"**
3. Klicke oben auf **"Publish repository"**
4. Im Popup: Stelle sicher dass **"Keep this code private"** angehakt ist
5. Klicke **"Publish repository"**

Dein Code ist jetzt sicher auf GitHub gespeichert. Gehe zu github.com → dein Repository und prüfe, ob alles da ist.

---

## Teil 3: Online stellen mit Railway

Railway ist ein Hosting-Dienst, der deinen Code von GitHub nimmt und ihn automatisch im Internet verfügbar macht. HTTPS ist automatisch dabei.

### Schritt 7 – Railway-Account erstellen

1. Gehe zu **railway.app**
2. Klicke auf **"Login"** → **"Login with GitHub"**
3. GitHub-Zugangsdaten eingeben → Railway darf auf dein GitHub zugreifen (bestätigen)

### Schritt 8 – Neues Projekt anlegen

1. Klicke auf **"New Project"**
2. Wähle **"Deploy from GitHub repo"**
3. Wähle dein Repository **"kundenportal"** aus
   - Falls es nicht erscheint: Klicke auf "Configure GitHub App" und erlaube den Zugriff
4. Klicke auf **"Deploy Now"**
5. Railway startet jetzt das Portal. Das dauert ca. 1–2 Minuten.

### Schritt 9 – Geheime Einstellungen eingeben

Das ist der wichtigste Schritt! Hier gibst du die Passwörter ein, die nicht im Code stehen dürfen.

1. Klicke in Railway auf deinen Service (das blaue Kästchen)
2. Klicke oben auf **"Variables"**
3. Klicke auf **"New Variable"** und füge folgende 4 Variablen ein:

**Variable 1:**
- Name: `PORT`
- Value: `3000`

**Variable 2:**
- Name: `SESSION_SECRET`
- Value: Einen langen zufälligen Text — öffne dazu eine Eingabeaufforderung (Windows-Taste → "cmd" eingeben → Enter) und tippe:
  ```
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
  Kopiere den ausgegebenen langen Text und füge ihn als Value ein.

**Variable 3:**
- Name: `ADMIN_EMAIL`
- Value: Die E-Mail-Adresse des Admins, z.B. `admin@kundenname.de`

**Variable 4:**
- Name: `ADMIN_PASSWORD`
- Value: Ein sicheres Passwort (mind. 12 Zeichen, Groß/Kleinschreibung, Zahl, Sonderzeichen)

4. Klicke auf **"Deploy"** — Railway startet das Portal neu mit den neuen Einstellungen

### Schritt 10 – Öffentliche Adresse einrichten

1. Klicke in Railway oben auf **"Settings"**
2. Scrolle zu **"Networking"**
3. Klicke auf **"Generate Domain"**
4. Railway zeigt dir eine Adresse wie `kundenportal-xyz.railway.app`
5. Diese Adresse kannst du dem Kunden geben!

---

## Teil 4: Testen

### Schritt 11 – Prüfen ob alles funktioniert

1. Öffne die Railway-Domain in deinem Browser (z.B. `kundenportal-xyz.railway.app`)
2. Du solltest die Login-Seite sehen
3. Melde dich mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` an (die du in Schritt 9 eingetragen hast)
4. Falls der Login funktioniert: Fertig!

---

## Teil 5: Updates einspielen

Wenn du später etwas am Portal änderst:

1. Öffne **GitHub Desktop**
2. Deine Änderungen erscheinen links unter "Changes"
3. Schreibe unten eine kurze Beschreibung, z.B. `Neues Feature: XYZ`
4. Klicke **"Commit to master"**
5. Klicke oben auf **"Push origin"**
6. Railway erkennt die Änderung automatisch und aktualisiert das Portal innerhalb von 1–2 Minuten

**Das war's!** Kein weiterer Aufwand.

---

## Probleme & Lösungen

| Problem | Lösung |
|---------|--------|
| Railway zeigt "Build failed" | Klicke auf "View logs" und schicke mir den Fehlertext |
| Login funktioniert nicht | Prüfe in Railway → Variables ob ADMIN_EMAIL und ADMIN_PASSWORD korrekt eingetragen sind |
| Seite lädt nicht | Warte 2 Minuten, Railway startet manchmal etwas langsam |
| Kunden können sich nicht registrieren | Registrierung funktioniert nur über das Admin-Panel — dort Kunden anlegen |

---

## Eigene Domain (optional)

Wenn du eine eigene Domain willst (z.B. `portal.schindelhauer.de`):

1. Kaufe eine Domain bei einem Anbieter (z.B. IONOS, Strato, Namecheap)
2. In Railway → Settings → Networking → Custom Domain → Domain eintragen
3. Beim Domain-Anbieter: Einen **CNAME-Eintrag** anlegen, der auf deine Railway-Adresse zeigt
   - Name: `portal`
   - Ziel: `kundenportal-xyz.railway.app`
4. Warte 10–30 Minuten bis die Domain aktiv ist
