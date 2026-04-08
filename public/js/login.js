document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const alert = document.getElementById('alert');

  alert.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Anmelden…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      })
    });
    const data = await res.json();

    if (!res.ok) {
      alert.textContent = data.error || 'Anmeldung fehlgeschlagen';
      alert.classList.remove('hidden');
    } else {
      if (data.password_expiry_warning) {
        sessionStorage.setItem('pw_expiry_warning', '1');
      } else {
        sessionStorage.removeItem('pw_expiry_warning');
      }

      if (data.requires_2fa) {
        window.location.href = '2fa-verify.html';
      } else if (data.requires_2fa_setup) {
        window.location.href = '2fa-setup.html';
      } else if (data.requires_password_change) {
        window.location.href = 'change-password.html';
      } else if (data.role === 'admin') {
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
    btn.textContent = 'Anmelden';
  }
});
