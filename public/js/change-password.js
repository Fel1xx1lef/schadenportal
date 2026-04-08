(async () => {
  // Session prüfen
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  document.getElementById('changePwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = document.getElementById('alertMsg');
    const btn = document.getElementById('submitBtn');
    alertEl.classList.add('hidden');

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      alertEl.textContent = 'Die neuen Passwörter stimmen nicht überein.';
      alertEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Speichern…';

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        alertEl.textContent = data.error || 'Fehler beim Speichern.';
        alertEl.classList.remove('hidden');
      } else {
        // Nach erfolgreicher Änderung: frische Session-Daten holen für korrektes Routing
        const fresh = await fetch('/api/auth/me').then(r => r.json()).catch(() => me);
        if (fresh.role === 'admin') {
          window.location.href = 'admin.html';
        } else if (!fresh.consent_given) {
          window.location.href = 'consent.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }
    } catch {
      alertEl.textContent = 'Verbindungsfehler. Bitte erneut versuchen.';
      alertEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Passwort speichern';
    }
  });
})();
