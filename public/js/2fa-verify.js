(async function() {
  const status = await fetch('/api/auth/2fa/status').then(r => r.json()).catch(() => null);
  if (!status || !status.pending) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('twoFAForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('verifyBtn');
    const alert = document.getElementById('alert');

    alert.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Prüfe…';

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: document.getElementById('token').value })
      });
      const data = await res.json();

      if (!res.ok) {
        alert.textContent = data.error || 'Ungültiger Code';
        alert.classList.remove('hidden');
      } else {
        if (data.role === 'admin') {
          window.location.href = 'admin.html';
        } else if (!data.consent_given) {
          window.location.href = 'consent.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }
    } catch {
      alert.textContent = 'Verbindungsfehler. Bitte erneut versuchen.';
      alert.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Code bestätigen';
    }
  });
})();
