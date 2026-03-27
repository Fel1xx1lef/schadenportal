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
