const PROFILE_FIELDS = [
  'full_name', 'birth_date', 'marital_status', 'spouse_name',
  'phone', 'mobile', 'gross_income', 'net_income',
  'health_insurance_type', 'health_insurance_provider',
  'beruf', 'berufsgruppe', 'wohneigentum',
  'rente', 'minijob', 'kindergeld', 'andere_einkuenfte'
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

function formatEuro(value) {
  return '€ ' + value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function updateFinanzuebersicht() {
  const val = id => parseFloat(document.getElementById(id).value) || 0;

  const einnahmen =
    val('fNetIncome') +
    val('fRente') +
    val('fMinijob') +
    val('fKindergeld') +
    val('fAndereEinkuenfte');

  const ausgaben =
    val('fAusgabenMiete') +
    val('fAusgabenNebenkosten') +
    val('fAusgabenLebensmittel') +
    val('fAusgabenMobilitaet') +
    val('fAusgabenTelekommunikation') +
    val('fAusgabenVersicherungen') +
    val('fAusgabenFreizeit') +
    val('fAusgabenKleidung') +
    val('fAusgabenSonstiges');

  const bilanz = einnahmen - ausgaben;
  const isPositive = bilanz >= 0;

  document.getElementById('fzGesamteinnahmen').textContent = formatEuro(einnahmen);
  document.getElementById('fzGesamtausgaben').textContent  = formatEuro(ausgaben);
  document.getElementById('fzBilanz').textContent          = formatEuro(bilanz);

  const bilanzBox   = document.getElementById('fzBilanzBox');
  const bilanzLabel = document.getElementById('fzBilanzLabel');
  const bilanzVal   = document.getElementById('fzBilanz');

  if (isPositive) {
    bilanzBox.style.background  = 'var(--success-light)';
    bilanzBox.style.borderColor = '#c6e9b0';
    bilanzLabel.style.color     = 'var(--success)';
    bilanzLabel.textContent     = 'Monatlicher Überschuss';
    bilanzVal.style.color       = 'var(--success)';
  } else {
    bilanzBox.style.background  = 'var(--danger-light)';
    bilanzBox.style.borderColor = '#fca5a5';
    bilanzLabel.style.color     = 'var(--danger)';
    bilanzLabel.textContent     = 'Monatliches Defizit';
    bilanzVal.style.color       = 'var(--danger)';
  }
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

  document.getElementById('fRente').value             = profile.rente             || '';
  document.getElementById('fMinijob').value           = profile.minijob           || '';
  document.getElementById('fKindergeld').value        = profile.kindergeld        || '';
  document.getElementById('fAndereEinkuenfte').value  = profile.andere_einkuenfte || '';

  document.getElementById('fAusgabenMiete').value             = profile.ausgaben_miete             || '';
  document.getElementById('fAusgabenNebenkosten').value       = profile.ausgaben_nebenkosten       || '';
  document.getElementById('fAusgabenLebensmittel').value      = profile.ausgaben_lebensmittel      || '';
  document.getElementById('fAusgabenMobilitaet').value        = profile.ausgaben_mobilitaet        || '';
  document.getElementById('fAusgabenTelekommunikation').value = profile.ausgaben_telekommunikation || '';
  document.getElementById('fAusgabenVersicherungen').value    = profile.ausgaben_versicherungen    || '';
  document.getElementById('fAusgabenFreizeit').value          = profile.ausgaben_freizeit          || '';
  document.getElementById('fAusgabenKleidung').value          = profile.ausgaben_kleidung          || '';
  document.getElementById('fAusgabenSonstiges').value         = profile.ausgaben_sonstiges         || '';

  if (profile.health_insurance_type) setKvType(profile.health_insurance_type);
  toggleSpouseField();
  updateCompletionBar(profile);
  updateFinanzuebersicht();

  // KV-Toggle
  document.querySelectorAll('#kvToggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setKvType(btn.dataset.kv));
  });

  // Ehepartner-Feld ein/ausblenden
  document.getElementById('fMaritalStatus').addEventListener('change', toggleSpouseField);

  // Live-Berechnung Finanzübersicht
  const FINANZ_IDS = [
    'fNetIncome', 'fRente', 'fMinijob', 'fKindergeld', 'fAndereEinkuenfte',
    'fAusgabenMiete', 'fAusgabenNebenkosten', 'fAusgabenLebensmittel',
    'fAusgabenMobilitaet', 'fAusgabenTelekommunikation', 'fAusgabenVersicherungen',
    'fAusgabenFreizeit', 'fAusgabenKleidung', 'fAusgabenSonstiges'
  ];
  FINANZ_IDS.forEach(id =>
    document.getElementById(id).addEventListener('input', updateFinanzuebersicht));

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
      wohneigentum:               document.getElementById('fWohneigentum').value,
      rente:                      document.getElementById('fRente').value,
      minijob:                    document.getElementById('fMinijob').value,
      kindergeld:                 document.getElementById('fKindergeld').value,
      andere_einkuenfte:          document.getElementById('fAndereEinkuenfte').value,
      ausgaben_miete:             document.getElementById('fAusgabenMiete').value,
      ausgaben_nebenkosten:       document.getElementById('fAusgabenNebenkosten').value,
      ausgaben_lebensmittel:      document.getElementById('fAusgabenLebensmittel').value,
      ausgaben_mobilitaet:        document.getElementById('fAusgabenMobilitaet').value,
      ausgaben_telekommunikation: document.getElementById('fAusgabenTelekommunikation').value,
      ausgaben_versicherungen:    document.getElementById('fAusgabenVersicherungen').value,
      ausgaben_freizeit:          document.getElementById('fAusgabenFreizeit').value,
      ausgaben_kleidung:          document.getElementById('fAusgabenKleidung').value,
      ausgaben_sonstiges:         document.getElementById('fAusgabenSonstiges').value
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
