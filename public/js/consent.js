let currentUser = null;

function updateBadge(consentAnalysis) {
  document.getElementById('badge_analysis').textContent = consentAnalysis ? '✅' : '⬜';
}

// ── Erst-Einwilligung ─────────────────────────────────────────────────────────
document.getElementById('firstConsentBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('firstConsentAlert');
  alertEl.classList.add('hidden');

  const res = await fetch('/api/auth/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consent_analysis: document.getElementById('fc_analysis').checked
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
  } else {
    // Erst-Einwilligungs-Modus: Sidebar ausblenden
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.marginLeft = '0';
    document.getElementById('mainContent').style.padding = '40px 24px';
    document.getElementById('firstConsentView').style.display = '';
  }
}

init();
