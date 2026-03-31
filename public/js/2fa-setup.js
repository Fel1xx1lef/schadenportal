(async function() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  if (me.totp_enabled) {
    window.location.href = me.role === 'admin' ? 'admin.html' : 'profile.html';
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // QR-Code laden
  const setupData = await fetch('/api/auth/2fa/setup').then(r => r.json()).catch(() => null);
  if (!setupData) {
    showAlert('Fehler beim Laden des QR-Codes. Bitte Seite neu laden.');
    return;
  }

  document.getElementById('qrLoading').style.display = 'none';
  const qrImg = document.getElementById('qrImg');
  qrImg.src = setupData.qr;
  qrImg.style.display = 'inline-block';
  document.getElementById('manualSecret').textContent = setupData.secret;
  document.getElementById('btnStep1Next').disabled = false;

  // Schritt 1 → Schritt 2
  document.getElementById('btnStep1Next').addEventListener('click', () => {
    setStep(2);
  });

  // Schritt 2 → Schritt 1
  document.getElementById('btnStep2Back').addEventListener('click', () => {
    setStep(1);
  });

  // Aktivieren
  document.getElementById('btnActivate').addEventListener('click', async () => {
    const btn = document.getElementById('btnActivate');
    const token = document.getElementById('confirmToken').value;

    hideAlert();
    btn.disabled = true;
    btn.textContent = 'Aktiviere…';

    try {
      const res = await fetch('/api/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Ungültiger Code. Bitte erneut versuchen.');
      } else {
        window.location.href = me.role === 'admin' ? 'admin.html' : 'profile.html';
      }
    } catch {
      showAlert('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      btn.disabled = false;
      btn.textContent = '2FA aktivieren';
    }
  });

  function setStep(n) {
    document.querySelectorAll('.twofa-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + n).classList.add('active');
    document.getElementById('dot1').className = 'step-dot' + (n === 1 ? ' active' : ' done');
    document.getElementById('dot2').className = 'step-dot' + (n === 2 ? ' active' : '');
    hideAlert();
  }

  function showAlert(msg) {
    const el = document.getElementById('alertMsg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideAlert() {
    document.getElementById('alertMsg').classList.add('hidden');
  }
})();
