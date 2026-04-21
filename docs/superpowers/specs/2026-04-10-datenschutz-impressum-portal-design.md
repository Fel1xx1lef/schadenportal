# Design: Datenschutz & Impressum im Kundenportal

**Datum:** 2026-04-10

## Ziel

Datenschutzerklärung und Impressum sind bisher nur auf der Login-Seite verlinkt. Sie müssen auch im eingeloggten Bereich (Kundenportal) erreichbar sein, um die gesetzliche Informationspflicht zu erfüllen.

## Lösung

In allen Portal-Seiten wird im `sidebar-footer` unterhalb des Abmelden-Buttons ein kleiner Textblock mit Links ergänzt.

### HTML-Block (je Seite identisch)

```html
<p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">
  <a href="datenschutz.html" style="color:var(--text-secondary);">Datenschutz</a>
  &nbsp;|&nbsp;
  <a href="impressum.html" style="color:var(--text-secondary);">Impressum</a>
</p>
```

## Betroffene Dateien

- `public/dashboard.html`
- `public/contracts.html`
- `public/contact.html`
- `public/profile.html`
- `public/consent.html`
- `public/2fa-setup.html`
- `public/change-password.html`
- `public/admin.html`

## Nicht betroffen

- `public/login.html` — Links bereits vorhanden
- `public/datenschutz.html`, `public/impressum.html` — Zielseiten, kein Portal-Layout
