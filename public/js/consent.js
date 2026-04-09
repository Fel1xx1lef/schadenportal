let currentUser = null;

function updateBadge(consentAnalysis) {
  document.getElementById('badge_analysis').textContent = consentAnalysis ? '✅' : '⬜';
}

function updateHealthBadge(consentHealthData) {
  document.getElementById('badge_health').textContent = consentHealthData ? '✅' : '⬜';
}

// ── Erst-Einwilligung ─────────────────────────────────────────────────────────
document.getElementById('firstConsentBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('firstConsentAlert');
  alertEl.classList.add('hidden');

  const res = await fetch('/api/auth/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consent_analysis: document.getElementById('fc_analysis').checked,
      consent_health_data: document.getElementById('fc_health_data').checked
    })
  });

  if (res.ok) {
    window.location.href = 'dashboard.html';
  } else {
    const d = await res.json();
    alertEl.textContent = d.error || 'Fehler beim Speichern';
    alertEl.classList.remove('hidden');
  }
});

// ── Analyse-Einwilligung ändern ───────────────────────────────────────────────
document.getElementById('toggleAnalysisBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('manageConsentAlert');
  alertEl.classList.add('hidden');

  const newValue = !currentUser.consent_analysis;

  const res = await fetch('/api/auth/consent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_analysis: newValue })
  });

  if (res.ok) {
    currentUser.consent_analysis = newValue;
    updateBadge(newValue);
    alertEl.textContent = newValue
      ? 'Analyse-Einwilligung erteilt.'
      : 'Analyse-Einwilligung widerrufen.';
    alertEl.className = 'alert alert-success';
    alertEl.classList.remove('hidden');
  } else {
    const d = await res.json();
    alertEl.textContent = d.error || 'Fehler beim Speichern';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

// ── Gesundheitsdaten-Einwilligung ändern (D2: Art. 9 DSGVO) ──────────────────
document.getElementById('toggleHealthBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('manageConsentAlert');
  alertEl.classList.add('hidden');

  const newValue = !currentUser.consent_health_data;

  const res = await fetch('/api/auth/consent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_analysis: currentUser.consent_analysis, consent_health_data: newValue })
  });

  if (res.ok) {
    currentUser.consent_health_data = newValue;
    updateHealthBadge(newValue);
    alertEl.textContent = newValue
      ? 'Einwilligung zur Verarbeitung von Krankenversicherungsdaten erteilt.'
      : 'Einwilligung zur Verarbeitung von Krankenversicherungsdaten widerrufen.';
    alertEl.className = 'alert alert-success';
    alertEl.classList.remove('hidden');
  } else {
    const d = await res.json();
    alertEl.textContent = d.error || 'Fehler beim Speichern';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  currentUser = me;

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  if (me.consent_given) {
    // Verwaltungs-Modus
    document.getElementById('manageConsentView').style.display = '';
    updateBadge(me.consent_analysis);
    updateHealthBadge(me.consent_health_data);
  } else {
    // Erst-Einwilligungs-Modus: Sidebar ausblenden
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.marginLeft = '0';
    document.getElementById('mainContent').style.padding = '40px 24px';
    document.getElementById('firstConsentView').style.display = '';
  }
}

init();
