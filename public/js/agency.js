(async function () {
  try {
    const s = await fetch('/api/settings').then(r => r.json());
    if (!s) return;

    // Header-Agenturname (alle Seiten)
    if (s.agency_name) {
      document.querySelectorAll('.sidebar-company').forEach(el => { el.textContent = s.agency_name; });
      document.querySelectorAll('.login-brand-name').forEach(el => {
        const span = el.querySelector('span');
        el.textContent = s.agency_name;
        if (span) el.appendChild(span);
      });
    }

    // Kontaktseite: Felder dynamisch befüllen
    const agencyNameEl = document.getElementById('agencyName');
    if (agencyNameEl) agencyNameEl.textContent = s.agency_name || '';

    const agencyAddrEl = document.getElementById('agencyAddress');
    if (agencyAddrEl) agencyAddrEl.textContent = s.address || '';

    const agencyPhoneEl = document.getElementById('agencyPhone');
    if (agencyPhoneEl) {
      agencyPhoneEl.innerHTML = s.phone
        ? `<a href="tel:${s.phone}">${s.phone}</a>`
        : 'Auf Anfrage';
    }

    const agencyEmailEl = document.getElementById('agencyEmail');
    if (agencyEmailEl) {
      agencyEmailEl.innerHTML = s.email
        ? `<a href="mailto:${s.email}">${s.email}</a>`
        : '';
    }

    const agencyHoursEl = document.getElementById('agencyHours');
    if (agencyHoursEl) {
      agencyHoursEl.innerHTML = (s.opening_hours || '').replace(/\n/g, '<br>');
    }

    const agencyWaEl = document.getElementById('agencyWhatsapp');
    if (agencyWaEl) {
      const num = (s.whatsapp || '').replace(/\D/g, '');
      agencyWaEl.href = num ? 'https://wa.me/' + num : '#';
      agencyWaEl.style.display = num ? '' : 'none';
    }
    const agencyWaCardEl = document.getElementById('agencyWhatsappCard');
    if (agencyWaCardEl) {
      const num = (s.whatsapp || '').replace(/\D/g, '');
      agencyWaCardEl.style.display = num ? '' : 'none';
    }
  } catch (e) {}
})();

// ── 2FA-Hinweis für Kunden ────────────────────────────────────────────────────
(async function() {
  const main = document.querySelector('.main');
  if (!main) return;
  if (window.location.pathname.endsWith('2fa-setup.html')) return;

  try {
    const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
    if (!me || !me.id || me.role === 'admin' || me.totp_enabled) return;

    const banner = document.createElement('div');
    banner.className = 'alert alert-warning';
    banner.style.cssText = 'justify-content:space-between;align-items:center;margin-bottom:20px;';
    banner.innerHTML =
      '<span>🔐 <strong>Tipp:</strong> Schützen Sie Ihr Konto mit der Zwei-Faktor-Authentifizierung.</span>' +
      '<span style="display:flex;gap:8px;align-items:center;flex-shrink:0;">' +
        '<a href="2fa-setup.html" style="font-weight:600;color:#92400e;text-decoration:underline;white-space:nowrap;">Jetzt einrichten</a>' +
        '<button id="dismiss2faBanner" style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;color:#92400e;padding:0 2px;" title="Schließen">×</button>' +
      '</span>';

    main.insertBefore(banner, main.firstChild);

    document.getElementById('dismiss2faBanner').addEventListener('click', () => {
      banner.remove();
    });
  } catch (e) {}
})();
