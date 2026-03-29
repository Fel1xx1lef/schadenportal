# Kundenportal-Anpassung für Ausschließlichkeitsvertrieb

## Ziel
Das Kundenportal soll so erweitert werden, dass Kundinnen und Kunden:

1. **eigene Verträge beim Versicherer** einsehen können
2. **Fremdverträge** manuell hinzufügen können
3. **Abonnements und laufende Kosten** wie Netflix, Amazon Prime oder Spotify hinzufügen können
4. transparent in **Service**, **Analyse** und **optionale Angebots-/Beratungslogik** getrennt werden

Diese Datei ist als Arbeitsgrundlage für Claude Code gedacht, damit die Produkt-, UX-, Copy- und Umsetzungslogik im Portal angepasst werden kann.

---

## Ausgangslage und rechtliche Leitplanken

### Vertriebsmodell
Wir sind **kein Makler**, sondern **Ausschließlichkeitsvertrieb / gebundener Vertreter**.

### Konsequenz
Daraus folgt:

- kein automatischer Abruf von Fremdverträgen bei anderen Versicherern
- keine Darstellung als unabhängiger Marktbetreuer
- keine Formulierungen, die wie Maklerbetreuung klingen
- Nutzung von Fremdvertragsdaten nur, wenn der Kunde sie **selbst aktiv eingibt** und **klar einwilligt**

### Erlaubt
- Anzeige eigener Verträge beim Versicherer
- manuelle Erfassung von Fremdverträgen
- manuelle Erfassung von Abos und sonstigen laufenden Kosten
- Analyse innerhalb des Kundenportals
- optionale Beratungs- oder Angebotslogik nur mit gesonderter Einwilligung

### Nicht erlaubt
- automatischer Datenabruf bei Drittversicherern
- Formulierungen wie „Wir verwalten alle deine Verträge“
- Formulierungen wie „Wir kümmern uns um alles für dich“
- Vertrieb auf Basis eingegebener Fremdvertragsdaten ohne saubere Einwilligung
- Vermischung von Servicezweck und Werbezweck ohne klare Trennung

---

## Produktstrategie

Das Portal soll **nicht nur ein Versicherungsportal** sein, sondern ein:

> **Finanz- und Vertragscockpit für Kundinnen und Kunden**

### Zielbild
Das Portal bietet einen zentralen Überblick über:

- Versicherungen beim eigenen Haus
- weitere Versicherungen bei anderen Anbietern
- Abos und wiederkehrende Ausgaben
- Einsparpotenziale, Erinnerungen und Hinweise

### Strategischer Nutzen
Dadurch entsteht:

- mehr Mehrwert für Kundinnen und Kunden
- höhere Login-Frequenz
- stärkere Kundenbindung
- bessere Grundlage für spätere Beratung
- niedrigere Hemmschwelle als bei einem rein vertrieblichen Portal

### Grundprinzip
Nicht zuerst Verkauf, sondern zuerst Mehrwert:

> **Mehrwert → Nutzung → Vertrauen → Abschluss**

---

## Zielstruktur des Portals

### 1. Dashboard / Startseite

Die Startseite soll in wenigen Sekunden einen echten Überblick geben.

#### Inhalte
- monatliche Gesamtausgaben
- Aufteilung nach Kategorien
- Summe Versicherungen
- Summe Abos / laufende Kosten
- Hinweise und Erinnerungen
- erkannte Optimierungspotenziale

#### Beispielmodule
- „Deine monatlichen Fixkosten“
- „Deine Versicherungen“
- „Deine Abos“
- „Bald kündbar“
- „Prüfenswert“
- „Mögliche Einsparungen“

---

### 2. Bereich „Meine Verträge bei [Versicherer]“

Dieser Bereich enthält ausschließlich Verträge des eigenen Hauses.

#### Eigenschaften
- automatisch geladen
- vollständige Einsicht
- Verwaltung bestehender Vertragsinformationen
- Anzeige von Beiträgen, Laufzeiten, Ansprechpartnern und Dokumenten

#### UX-Ziel
Dies ist der vertrauensstarke Kernbereich des Portals.

---

### 3. Bereich „Weitere Versicherungen“

Dieser Bereich enthält **Fremdverträge**, die der Kunde **selbst hinzugefügt** hat.

#### Wichtige Anforderungen
- keine automatische Befüllung
- kein Drittanbieter-Abruf
- klare Kennzeichnung als selbst hinzugefügt
- Nutzung nur für freigegebene Zwecke

#### Geeignete Bezeichnung im UI
- „Weitere Versicherungen“
- „Selbst hinzugefügte Versicherungen“
- „Versicherungen außerhalb von [Versicherer]“

#### Nicht verwenden
- „Alle deine Versicherungen werden von uns verwaltet“
- „Wir betreuen deine Versicherungen vollständig“

#### Datenfelder
Mindestens:
- Versicherer
- Sparte
- Tarifbezeichnung optional
- Beitrag optional
- Zahlungsintervall optional
- Vertragsbeginn optional
- Kündigungsdatum optional
- Freitextnotiz optional

#### Hinweise im UI
Unterhalb des Bereichs sollte klar stehen:

> Diese Verträge wurden von dir selbst hinzugefügt. Sie dienen deiner Übersicht und – sofern von dir freigegeben – der Analyse und Beratung.

---

### 4. Bereich „Abos und laufende Kosten“

Dieser Bereich erweitert das Portal über Versicherungen hinaus und erhöht die Relevanz im Alltag.

#### Beispiele
- Netflix
- Amazon Prime
- Spotify
- Apple iCloud
- DAZN
- Adobe
- Mobilfunk
- Fitnessstudio
- Software-Abos
- sonstige wiederkehrende Verträge

#### Ziel
Der Bereich soll helfen, laufende Kosten sichtbar zu machen und die Nutzung des Portals zu erhöhen.

#### Datenfelder
Mindestens:
- Anbieter
- Kategorie
- Preis
- Zahlungsintervall
- Startdatum optional
- nächster Verlängerungszeitpunkt optional
- Kündigungsfrist optional
- Notiz optional

#### Geeignete Kategorien
- Streaming
- Shopping / Mitgliedschaften
- Software / Tools
- Telekommunikation
- Fitness / Freizeit
- Sonstiges

#### UI-Hinweis
> Abos und laufende Kosten werden von dir selbst gepflegt und dienen deiner persönlichen Übersicht sowie – soweit von dir gewünscht – Optimierungshinweisen.

---

### 5. Bereich „Hinweise und Optimierung“

Hier werden neutrale, vorsichtige Hinweise ausgespielt.

#### Beispiele
- „Du hast mehrere laufende Abos.“
- „Ein Vertrag ist bald kündbar.“
- „Für diesen Bereich könnte Optimierungspotenzial bestehen.“
- „Du hast in dieser Kategorie aktuell keinen Schutz hinterlegt.“

#### Wichtig
Die Hinweise sollen **serviceorientiert** formuliert sein, nicht aggressiv vertrieblich.

#### Nicht so
- „Jetzt sofort abschließen“
- „Dein Vertrag ist schlecht“
- „Dieses Produkt musst du wechseln“

#### Besser so
- „Hier könnte Optimierungspotenzial bestehen.“
- „Gerne prüfen wir mit dir, ob dein aktueller Schutz noch zu deiner Situation passt.“
- „Auf Wunsch zeigen wir dir passende Lösungen aus unserem Haus.“

---

### 6. Bereich „Datenschutz und Einwilligungen“

Nutzerinnen und Nutzer müssen ihre Einwilligungen jederzeit einsehen und ändern können.

#### Funktionen
- Einwilligungen anzeigen
- Einwilligungen ändern
- Einwilligungen widerrufen
- Daten löschen
- einzelne Fremdverträge löschen
- einzelne Abos löschen

#### Pflicht
Die Widerrufsmöglichkeit muss leicht auffindbar sein und darf nicht versteckt werden.

---

## Informationsarchitektur

### Empfohlene Hauptnavigation
1. Dashboard
2. Meine Verträge
3. Weitere Versicherungen
4. Abos & laufende Kosten
5. Hinweise
6. Datenschutz & Einwilligungen
7. Profil / Service

---

## UX-Grundsätze

### 1. Klare Trennung
Es muss immer sichtbar sein, ob ein Datensatz:

- ein Vertrag beim eigenen Haus ist
- ein manuell gepflegter Fremdvertrag ist
- ein Abo / laufender Kostenposten ist

### 2. Keine Makler-Anmutung
Wording, Struktur und Funktionsumfang dürfen nicht den Eindruck erzeugen, dass sämtliche Verträge des Kunden umfassend betreut oder verwaltet werden.

### 3. Einfache Sprache
Kurze, klare und verständliche Texte statt juristischem Fachdeutsch.

### 4. Kein Dark Pattern
- keine vorausgewählten optionalen Werbeeinwilligungen
- keine irreführenden Buttontexte
- kein Zwang zur Angebotsfreigabe, um die Grundfunktion zu nutzen

### 5. Mehrwert vor Abschluss
Der erste Nutzen soll Übersicht, Orientierung und Transparenz sein.

---

## UX-Flow für Fremdverträge

### Schritt 1: Einstieg
Button:
> Fremde Versicherung hinzufügen

### Schritt 2: Erklärung
Kurzer Hinweis:
> Hier kannst du Versicherungen eintragen, die nicht bei [Versicherer] bestehen. Diese Angaben dienen deiner Übersicht und – wenn du es erlaubst – der Analyse und Beratung.

### Schritt 3: Datenerfassung
Formularfelder für den Vertrag

### Schritt 4: Einwilligungen
Pflicht- und optionale Einwilligungen anzeigen

### Schritt 5: Bestätigung
Nach dem Speichern:
> Dein Vertrag wurde hinzugefügt.

Zusatz:
> Du kannst deine Angaben und Einwilligungen jederzeit anpassen oder löschen.

---

## UX-Flow für Abos und laufende Kosten

### Schritt 1: Einstieg
Button:
> Abo hinzufügen

### Schritt 2: Erklärung
> Trage hier Abos und wiederkehrende Ausgaben ein, um einen besseren Überblick über deine laufenden Kosten zu erhalten.

### Schritt 3: Datenerfassung
Formularfelder für Anbieter, Preis, Intervall etc.

### Schritt 4: Einwilligungen
Schlankere Einwilligungslogik als bei Versicherungen, aber ebenfalls transparent

### Schritt 5: Bestätigung
> Dein Abo wurde hinzugefügt.

---

## Einwilligungslogik

Die Einwilligungen sollen nach Zweck getrennt werden.

### Zweck 1: Speicherung und Anzeige
Pflicht, damit die Funktion überhaupt nutzbar ist.

### Zweck 2: Analyse / Auswertung
Kann bei Fremdverträgen und Abos als Teil der Portal-Funktion eingebunden werden, sollte aber transparent beschrieben werden.

### Zweck 3: Beratung / Optimierungshinweise
Optional.

### Zweck 4: Angebote / Produktempfehlungen
Optional und klar als vertriebliche Nutzung gekennzeichnet.

---

## Einwilligungsstrecke – Copy-Vorschlag

### A. Fremdverträge – Pflichttext
Checkbox, erforderlich:

```text
☑ Ich willige ein, dass meine eingegebenen Vertragsdaten gespeichert und zur Darstellung sowie Analyse in meinem Kundenportal verwendet werden.
```

### B. Fremdverträge – optionale Beratung
Checkbox, optional:

```text
☐ Ich möchte, dass meine Vertragsdaten genutzt werden, um mich zu bestehenden Verträgen zu beraten und Optimierungsvorschläge zu erhalten.
```

### C. Fremdverträge – optionale Angebote
Checkbox, optional:

```text
☐ Ich bin damit einverstanden, auf Basis meiner angegebenen Vertragsdaten Angebote und Empfehlungen zu Produkten von [Versicherer] zu erhalten.
```

### D. Abos und laufende Kosten – Pflichttext
Checkbox, erforderlich:

```text
☑ Ich willige ein, dass meine eingegebenen Abonnements und laufenden Kosten zur Darstellung und Analyse im Kundenportal verwendet werden.
```

### E. Abos und laufende Kosten – optionale Hinweise
Checkbox, optional:

```text
☐ Ich möchte Hinweise zur Optimierung meiner laufenden Kosten und passende Empfehlungen erhalten.
```

### Ergänzender Hinweis unter den Checkboxen
```text
Die Angabe weiterer Versicherungen sowie von Abos und laufenden Kosten ist freiwillig. Ohne deine zusätzliche Zustimmung erfolgt keine Nutzung zu Beratungs- oder Angebotszwecken. Weitere Informationen findest du in unserer Datenschutzerklärung.
```

### Widerrufshinweis
```text
Du kannst deine Einwilligungen jederzeit in den Einstellungen widerrufen.
```

---

## Copy-Vorschläge für zentrale Screens

### Bereichstitel
- Meine Verträge bei [Versicherer]
- Weitere Versicherungen
- Abos & laufende Kosten
- Hinweise für dich
- Datenschutz & Einwilligungen

### Leerer Zustand – Fremdverträge
> Du hast noch keine weiteren Versicherungen hinzugefügt.

Button:
> Weitere Versicherung hinzufügen

Zusatz:
> Trage Verträge anderer Anbieter ein, um deine Übersicht zu vervollständigen.

### Leerer Zustand – Abos
> Du hast noch keine Abos oder laufenden Kosten hinzugefügt.

Button:
> Abo hinzufügen

Zusatz:
> Behalte wiederkehrende Ausgaben wie Streaming, Mitgliedschaften oder Software im Blick.

### Info-Badge – Fremdverträge
> Selbst hinzugefügt

### Info-Badge – eigene Verträge
> Bei [Versicherer]

---

## Funktionsregeln für Claude Code

### 1. Datenmodell erweitern

Es werden mindestens drei klar getrennte Vertragstypen benötigt:

- `OWN_INSURANCE_CONTRACT`
- `EXTERNAL_INSURANCE_CONTRACT`
- `SUBSCRIPTION_OR_RECURRING_EXPENSE`

#### Beispielhafte Felder für alle Objekte
- `id`
- `type`
- `title`
- `provider`
- `category`
- `amount`
- `billing_interval`
- `start_date`
- `renewal_date`
- `cancellation_deadline`
- `notes`
- `source`
- `created_by_user`
- `consent_display_and_analysis`
- `consent_advisory`
- `consent_offers`
- `created_at`
- `updated_at`
- `deleted_at` optional

#### Zusätzliche Anforderungen
- Fremdverträge und Abos müssen eindeutig als `created_by_user = true` markiert werden
- Eigene Verträge dürfen nicht mit Fremdverträgen zusammengeführt werden
- Einwilligungen müssen versionsfähig gespeichert werden
- Änderungen an Einwilligungen sollten protokolliert werden

---

### 2. UI-Komponenten anpassen

Claude Code soll bestehende Screens so umbauen, dass:

- Verträge des eigenen Hauses separat dargestellt werden
- Fremdverträge separat dargestellt werden
- Abos separat dargestellt werden
- jeder Bereich eigene Empty States, Formulare und Hilfetexte bekommt

#### Benötigte Komponenten
- Dashboard Summary Card
- Contract Section
- External Contract Form
- Subscription Form
- Consent Module
- Consent Settings Screen
- Hint / Recommendation Card
- Delete Confirmation Modal

---

### 3. Formulare implementieren

#### Formular Fremdvertrag
Pflichtfelder:
- Versicherer
- Sparte

Optionale Felder:
- Tarif
- Beitrag
- Intervall
- Startdatum
- Kündigungsdatum
- Notiz

#### Formular Abo / laufende Kosten
Pflichtfelder:
- Anbieter
- Kategorie
- Preis
- Intervall

Optionale Felder:
- Startdatum
- Verlängerungsdatum
- Kündigungsfrist
- Notiz

---

### 4. Consent Handling implementieren

Claude Code soll eine Einwilligungsarchitektur umsetzen mit:

- klar getrennten Checkboxen
- optionalen Zwecken nicht vorangekreuzt
- Widerruf in den Einstellungen
- Löschung einzelner Datensätze
- nachvollziehbarer Speicherung der Zustimmungen

#### Anforderungen
- Ohne Pflichtzustimmung darf der Datensatz nicht gespeichert werden
- Optionale Zustimmungen dürfen später geändert werden
- Nach Widerruf optionaler Zustimmungen dürfen diese Daten nicht weiter für Beratung oder Angebote genutzt werden

---

### 5. Dashboard-Logik erweitern

Das Dashboard soll aggregierte Werte zeigen für:

- Gesamtanzahl Versicherungen
- Anzahl eigener Verträge
- Anzahl Fremdverträge
- Anzahl Abos
- monatliche Gesamtkosten
- monatliche Abokosten
- Hinweise mit Fristen und Potenzialen

#### Beispielhafte Hinweise
- Kündigungsdatum nähert sich
- mehrere Abos in derselben Kategorie
- hoher Anteil laufender Kosten
- Vertragslücke in relevanter Kategorie

Hinweise dürfen nur auf Daten basieren, für deren Nutzung eine passende Einwilligung vorliegt.

---

### 6. Wording-Regeln erzwingen

Claude Code soll bei Texten und Labels folgende Regeln beachten:

#### Verwenden
- selbst hinzugefügt
- zur Übersicht
- auf Wunsch
- passende Hinweise
- Optimierungspotenzial
- unsere Lösungen / Produkte aus unserem Haus

#### Nicht verwenden
- wir verwalten alles für dich
- wir kümmern uns um alle deine Verträge
- unabhängiger Vergleich
- vollständige Betreuung deiner Versicherungen
- Marktvergleich aller Anbieter

---

### 7. Datenschutzfreundliche Defaults

Claude Code soll sicherstellen:

- optionale Einwilligungen sind standardmäßig deaktiviert
- nur notwendige Daten werden abgefragt
- Löschung ist pro Datensatz möglich
- Einwilligungen sind im Profil sichtbar
- Hilfetexte sind immer in direkter Nähe zur Dateneingabe

---

## MVP-Empfehlung

### Phase 1
- Bereich „Meine Verträge“
- Bereich „Weitere Versicherungen“
- Bereich „Abos & laufende Kosten“
- manuelle Erfassung
- einfache Einwilligungsstrecke
- Dashboard mit Summen und Listen

### Phase 2
- Kündigungs- und Verlängerungshinweise
- einfache Optimierungshinweise
- Einwilligungscenter
- bessere Filter und Suche

### Phase 3
- intelligente Hinweise
- Priorisierung nach Relevanz
- stärkere Personalisierung innerhalb der erlaubten Zwecke
- Service-Nudges statt harter Vertriebslogik

---

## Akzeptanzkriterien

Die Umsetzung ist dann erfolgreich, wenn:

1. eigene Verträge, Fremdverträge und Abos klar getrennt dargestellt werden
2. Fremdverträge und Abos nur manuell angelegt werden können
3. Pflicht- und optionale Einwilligungen sauber getrennt sind
4. optionale Einwilligungen nicht vorausgewählt sind
5. Widerruf und Löschung jederzeit möglich sind
6. das Wording keine Maklerstellung suggeriert
7. das Portal primär als Service- und Überblicksprodukt funktioniert
8. Angebotslogik nur nach ausdrücklicher Freigabe aktiv wird

---

## Kurzfassung für Claude Code

Bitte passe das Kundenportal wie folgt an:

- Trenne die Portalstruktur in:
  - eigene Verträge bei [Versicherer]
  - weitere Versicherungen
  - Abos & laufende Kosten
- Implementiere Formulare für manuell gepflegte Fremdverträge und Abos
- Baue eine getrennte Einwilligungsstrecke für Anzeige/Analyse, Beratung und Angebote
- Stelle sicher, dass optionale Einwilligungen standardmäßig deaktiviert sind
- Implementiere ein Dashboard mit Summen, Kategorien und serviceorientierten Hinweisen
- Verwende ausschließlich Wording, das zur Ausschließlichkeitsrolle passt und keine Maklerstellung suggeriert
- Ergänze einen Bereich, in dem Nutzer ihre Einwilligungen einsehen, widerrufen und Daten löschen können

---

## Schlussgedanke

Das Ziel ist kein CLARK-ähnliches Maklermodell, sondern ein kundenfreundliches Portal mit echtem Mehrwert:

- transparent
- alltagsrelevant
- datenschutzsauber
- serviceorientiert
- vertriebsfähig nur dort, wo der Kunde es ausdrücklich erlaubt
