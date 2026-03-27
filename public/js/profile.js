const PROFILE_FIELDS = [
  'full_name', 'birth_date', 'marital_status', 'spouse_name',
  'phone', 'mobile', 'gross_income', 'net_income',
  'health_insurance_type', 'health_insurance_provider',
  'beruf', 'berufsgruppe', 'wohneigentum'
];

function calculateCompletion(profile) {
  const filled = PROFILE_FIELDS.filter(f => profile[f] && String(profile[f]).trim() !== '').length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

function updateCompletionBar(profile) {
  const pct = calculateCompletion(profile);
  document.getElementById('completionFill').style.width = pct + '%';
  document.getElementById('completionLabel').textContent = pct + ' %';
}

function setKvType(type) {
  document.getElementById('fKvType').value = type;
  document.querySelectorAll('#kvToggle .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.kv === type);
  });
  document.getElementById('kvProviderGroup').style.display = type === 'gkv' ? 'block' : 'none';
}

function toggleSpouseField() {
  const status = document.getElementById('fMaritalStatus').value;
  document.getElementById('spouseGroup').style.display =
    status === 'verheiratet' ? 'block' : 'none';
}

async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  if (me.role === 'admin') { window.location.href = 'admin.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // Profil laden
  const profile = await fetch('/api/profile').then(r => r.json()).catch(() => ({}));

  document.getElementById('fEmail').value = profile.email || '';
  document.getElementById('fFullName').value = profile.full_name || '';
  document.getElementById('fBirthDate').value = profile.birth_date || '';
  document.getElementById('fMaritalStatus').value = profile.marital_status || '';
  document.getElementById('fSpouseName').value = profile.spouse_name || '';
  document.getElementById('fPhone').value = profile.phone || '';
  document.getElementById('fMobile').value = profile.mobile || '';
  document.getElementById('fGrossIncome').value = profile.gross_income || '';
  document.getElementById('fNetIncome').value = profile.net_income || '';
  document.getElementById('fKvProvider').value = profile.health_insurance_provider || '';
  document.getElementById('fBeruf').value = profile.beruf || '';
  document.getElementById('fBerufsgruppe').value = profile.berufsgruppe || '';
  document.getElementById('fWohneigentum').value = profile.wohneigentum || '';

  if (profile.health_insurance_type) setKvType(profile.health_insurance_type);
  toggleSpouseField();
  updateCompletionBar(profile);

  // KV-Toggle
  document.querySelectorAll('#kvToggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setKvType(btn.dataset.kv));
  });

  // Ehepartner-Feld ein/ausblenden
  document.getElementById('fMaritalStatus').addEventListener('change', toggleSpouseField);

  // Formular speichern
  document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const alertMsg = document.getElementById('alertMsg');
    const errorMsg = document.getElementById('errorMsg');
    alertMsg.classList.add('hidden');
    errorMsg.classList.add('hidden');

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;

    const body = {
      full_name:                  document.getElementById('fFullName').value,
      birth_date:                 document.getElementById('fBirthDate').value,
      marital_status:             document.getElementById('fMaritalStatus').value,
      spouse_name:                document.getElementById('fSpouseName').value,
      phone:                      document.getElementById('fPhone').value,
      mobile:                     document.getElementById('fMobile').value,
      gross_income:               document.getElementById('fGrossIncome').value,
      net_income:                 document.getElementById('fNetIncome').value,
      health_insurance_type:      document.getElementById('fKvType').value,
      health_insurance_provider:  document.getElementById('fKvProvider').value,
      beruf:                      document.getElementById('fBeruf').value,
      berufsgruppe:               document.getElementById('fBerufsgruppe').value,
      wohneigentum:               document.getElementById('fWohneigentum').value
    };

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    btn.disabled = false;

    if (!res.ok) {
      errorMsg.textContent = data.error || 'Fehler beim Speichern';
      errorMsg.classList.remove('hidden');
    } else {
      alertMsg.classList.remove('hidden');
      updateCompletionBar(body);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

init();
