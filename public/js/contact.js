async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // Typ-Toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      document.getElementById('requestType').value = type;
      const isCallback = type === 'callback';
      document.getElementById('callbackTimeGroup').style.display = isCallback ? 'block' : 'none';
      document.getElementById('sendBtn').textContent = isCallback ? '📞 Rückruf anfragen' : '✉️ Absenden';
    });
  });

  // Betreff-Prefill aus URL-Parameter (z.B. von Empfehlungen)
  const urlSubject = new URLSearchParams(window.location.search).get('subject');
  if (urlSubject) {
    document.getElementById('fSubject').value = urlSubject;
    history.replaceState(null, '', window.location.pathname);
  }

  // Direkt auf Rückruf wenn #callback im Hash
  if (window.location.hash === '#callback') {
    document.querySelector('[data-type="callback"]').click();
    history.replaceState(null, '', window.location.pathname);
  }

  document.getElementById('contactForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('sendBtn');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');
    btn.disabled = true;

    const body = {
      subject:       document.getElementById('fSubject').value,
      message:       document.getElementById('fMessage').value,
      request_type:  document.getElementById('requestType').value,
      callback_time: document.getElementById('fCallbackTime').value
    };

    const res  = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();

    btn.disabled = false;

    if (!res.ok) {
      errorMsg.textContent = data.error || 'Fehler beim Senden';
      errorMsg.classList.remove('hidden');
    } else {
      successMsg.classList.remove('hidden');
      document.getElementById('contactForm').reset();
      document.getElementById('callbackTimeGroup').style.display = 'none';
    }
  });
}

init();
