(function () {
  let userRole = 'customer';

  async function init() {
    try {
      const me = await api('/api/auth/me');
      userRole = me.role || 'customer';
      if (me.must_change_password) {
        document.getElementById('pageSubtitle').textContent =
          'Bitte legen Sie beim ersten Login ein neues Passwort fest.';
      }
    } catch {
      window.location.href = '/login.html';
    }
  }

  document.getElementById('changePwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const alert = document.getElementById('alertMsg');
    alert.classList.add('hidden');

    const current = document.getElementById('currentPassword').value;
    const next = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (next !== confirm) {
      alert.textContent = 'Die neuen Passwörter stimmen nicht überein.';
      alert.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Speichern…';

    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      window.location.href = userRole === 'admin' ? '/admin.html' : '/dashboard.html';
    } catch (err) {
      alert.textContent = err.message || 'Fehler beim Speichern.';
      alert.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Passwort speichern';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    window.location.href = '/login.html';
  });

  init();
})();
