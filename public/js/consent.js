let currentUser = null;

function updateBadges(me) {
  document.getElementById('badge_advisory').textContent = me.consent_advisory ? '✅' : '⬜';
  document.getElementById('badge_offers').textContent   = me.consent_offers   ? '✅' : '⬜';
}

// ── Erst-Einwilligung ─────────────────────────────────────────────────────────
document.getElementById('firstConsentBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('firstConsentAlert');
  alertEl.classList.add('hidden');

  if (!document.getElementById('fc_display').checked) {
    alertEl.textContent = 'Die Einwilligung zur Datenspeicherung ist erforderlich, um das Portal zu nutzen.';
    alertEl.classList.remove('hidden');
    return;
  }

  const res = await fetch('/api/auth/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consent_display_and_analysis: true,
      consent_advisory: document.getElementById('fc_advisory').checked,
      consent_offers:   document.getElementById('fc_offers').checked
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

// ── Optionale Einwilligungen bearbeiten ───────────────────────────────────────
const editModal = document.getElementById('editConsentModal');

document.getElementById('editConsentBtn').addEventListener('click', () => {
  document.getElementById('ec_advisory').checked = !!currentUser.consent_advisory;
  document.getElementById('ec_offers').checked   = !!currentUser.consent_offers;
  document.getElementById('editConsentModalAlert').classList.add('hidden');
  editModal.classList.remove('hidden');
});

document.getElementById('editConsentModalClose').addEventListener('click',  () => editModal.classList.add('hidden'));
document.getElementById('editConsentModalCancel').addEventListener('click', () => editModal.classList.add('hidden'));
editModal.addEventListener('click', e => { if (e.target === editModal) editModal.classList.add('hidden'); });

document.getElementById('editConsentModalSave').addEventListener('click', async () => {
  const alertEl = document.getElementById('editConsentModalAlert');
  alertEl.classList.add('hidden');

  const res = await fetch('/api/auth/consent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consent_advisory: document.getElementById('ec_advisory').checked,
      consent_offers:   document.getElementById('ec_offers').checked
    })
  });

  if (res.ok) {
    currentUser.consent_advisory = document.getElementById('ec_advisory').checked;
    currentUser.consent_offers   = document.getElementById('ec_offers').checked;
    updateBadges(currentUser);
    editModal.classList.add('hidden');
  } else {
    const d = await res.json();
    alertEl.textContent = d.error || 'Fehler beim Speichern';
    alertEl.classList.remove('hidden');
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  currentUser = me;

  if (me.consent_given) {
    // Verwaltungs-Modus
    document.getElementById('sidebar').style.display = '';
    document.getElementById('manageConsentView').style.display = '';
    updateBadges(me);

    document.getElementById('logoutBtn').addEventListener('click', async e => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = 'login.html';
    });
  } else {
    // Erst-Einwilligungs-Modus: Sidebar ausblenden
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.marginLeft = '0';
    document.getElementById('mainContent').style.padding = '40px 24px';
    document.getElementById('firstConsentView').style.display = '';
  }
}

init();
