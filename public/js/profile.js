const PROFILE_FIELDS = [
  'full_name', 'birth_date', 'marital_status', 'spouse_name',
  'phone', 'mobile', 'gross_income',
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
  const providerGroup = document.getElementById('kvProviderGroup');
  const providerLabel = document.getElementById('kvProviderLabel');
  const providerInput = document.getElementById('fKvProvider');
  if (type === 'gkv') {
    providerGroup.style.display = 'block';
    providerLabel.textContent = 'Krankenkasse';
    providerInput.placeholder = 'z.B. AOK, Techniker Krankenkasse…';
  } else if (type === 'pkv') {
    providerGroup.style.display = 'block';
    providerLabel.textContent = 'Versicherungsgesellschaft';
    providerInput.placeholder = 'z.B. Continentale, Allianz, DKV…';
  } else {
    providerGroup.style.display = 'none';
  }
}

function toggleSpouseField() {
  const status = document.getElementById('fMaritalStatus').value;
  document.getElementById('spouseGroup').style.display =
    status === 'verheiratet' ? 'block' : 'none';
}

function toMonthly(amount, cycle) {
  if (cycle === 'monthly')    return amount;
  if (cycle === 'quarterly')  return amount / 3;
  if (cycle === 'halfyearly') return amount / 6;
  if (cycle === 'yearly')     return amount / 12;
  return amount;
}

function formatEuro(value) {
  return '€ ' + value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Monatliche Vertragskosten (werden beim Init befüllt)
let contractInsurance = 0, contractAbos = 0, contractSonstiges = 0;

// Ja/Nein-Toggle für Einkommensquellen
const EINKUNFT_FELDER = [
  { profileKey: 'rente_aktiv',            toggleId: 'renteToggle',             hiddenId: 'fRenteAktiv',             groupId: 'renteAmountGroup' },
  { profileKey: 'minijob_aktiv',          toggleId: 'minijobToggle',           hiddenId: 'fMinijobAktiv',           groupId: 'minijobAmountGroup' },
  { profileKey: 'kindergeld_aktiv',       toggleId: 'kindergeldToggle',        hiddenId: 'fKindergeldAktiv',        groupId: 'kindergeldAmountGroup' },
  { profileKey: 'andere_einkuenfte_aktiv', toggleId: 'andereEinkuenfteToggle', hiddenId: 'fAndereEinkuenfteAktiv',  groupId: 'andereEinkuenfteAmountGroup' }
];

function setEinkunftAktiv(feld, value) {
  document.getElementById(feld.hiddenId).value = value;
  document.querySelectorAll('#' + feld.toggleId + ' .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.aktiv === value);
  });
  document.getElementById(feld.groupId).style.display = value === 'ja' ? 'block' : 'none';
  updateFinanzuebersicht();
}

function setupEinkunftToggles() {
  EINKUNFT_FELDER.forEach(feld => {
    document.querySelectorAll('#' + feld.toggleId + ' .toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setEinkunftAktiv(feld, btn.dataset.aktiv));
    });
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
    val('fAusgabenFreizeit') +
    val('fAusgabenKleidung') +
    contractInsurance + contractAbos + contractSonstiges;

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
  document.getElementById('fKvProvider').value = profile.health_insurance_provider || '';
  document.getElementById('fBeruf').value = profile.beruf || '';
  document.getElementById('fBerufsgruppe').value = profile.berufsgruppe || '';
  document.getElementById('fWohneigentum').value = profile.wohneigentum || '';

  document.getElementById('fRente').value             = profile.rente             || '';
  document.getElementById('fMinijob').value           = profile.minijob           || '';
  document.getElementById('fKindergeld').value        = profile.kindergeld        || '';
  document.getElementById('fAndereEinkuenfte').value  = profile.andere_einkuenfte || '';
  // Ja/Nein-Status wiederherstellen
  setupEinkunftToggles();
  EINKUNFT_FELDER.forEach(feld => {
    if (profile[feld.profileKey]) setEinkunftAktiv(feld, profile[feld.profileKey]);
  });

  document.getElementById('fAusgabenMiete').value             = profile.ausgaben_miete             || '';
  document.getElementById('fAusgabenNebenkosten').value       = profile.ausgaben_nebenkosten       || '';
  document.getElementById('fAusgabenMobilitaet').value        = profile.ausgaben_mobilitaet        || '';

  // Vertragskosten laden und automatisch anzeigen
  const contracts = await fetch('/api/contracts').then(r => r.json()).catch(() => []);
  contracts.forEach(c => {
    const m = toMonthly(parseFloat(c.premium_amount) || 0, c.premium_cycle);
    if (c.category === 'insurance')     contractInsurance += m;
    else if (c.category === 'subscription') contractAbos += m;
    else contractSonstiges += m;
  });
  document.getElementById('autoVersicherungen').textContent = formatEuro(contractInsurance);
  document.getElementById('autoAbos').textContent           = formatEuro(contractAbos);
  document.getElementById('autoSonstiges').textContent      = formatEuro(contractSonstiges);

  if (profile.health_insurance_type) setKvType(profile.health_insurance_type);
  toggleSpouseField();
  updateCompletionBar(profile);
  updateFinanzuebersicht();

  // 2FA Status
  if (me.totp_enabled) {
    document.getElementById('twofa-status-enabled').classList.remove('hidden');
  } else {
    document.getElementById('twofa-status-disabled').classList.remove('hidden');
  }

  document.getElementById('btnDisable2fa').addEventListener('click', () => {
    document.getElementById('disableForm').classList.toggle('hidden');
  });

  document.getElementById('btnConfirmDisable').addEventListener('click', async () => {
    const password = document.getElementById('disablePassword').value;
    const alertEl = document.getElementById('twofa-alert');
    alertEl.classList.add('hidden');
    const resD = await fetch('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const dataD = await resD.json();
    if (!resD.ok) {
      alertEl.textContent = dataD.error;
      alertEl.classList.remove('hidden');
    } else {
      window.location.reload();
    }
  });

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
    'fAusgabenMobilitaet', 'fAusgabenFreizeit', 'fAusgabenKleidung'
  ];
  FINANZ_IDS.forEach(id =>
    document.getElementById(id).addEventListener('input', updateFinanzuebersicht));

  // Konto löschen
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    document.getElementById('deleteAccountForm').style.display = '';
    document.getElementById('deleteAccountBtn').style.display = 'none';
  });

  document.getElementById('deleteAccountCancelBtn').addEventListener('click', () => {
    document.getElementById('deleteAccountForm').style.display = 'none';
    document.getElementById('deleteAccountBtn').style.display = '';
    document.getElementById('deleteAccountPassword').value = '';
    document.getElementById('deleteAccountAlert').classList.add('hidden');
  });

  document.getElementById('deleteAccountConfirmBtn').addEventListener('click', async () => {
    const alertEl = document.getElementById('deleteAccountAlert');
    alertEl.classList.add('hidden');
    const password = document.getElementById('deleteAccountPassword').value;
    if (!password) {
      alertEl.textContent = 'Bitte Passwort eingeben.';
      alertEl.classList.remove('hidden');
      return;
    }
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      window.location.href = 'login.html';
    } else {
      const d = await res.json();
      alertEl.textContent = d.error || 'Fehler beim Löschen des Kontos.';
      alertEl.classList.remove('hidden');
    }
  });

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
      health_insurance_type:      document.getElementById('fKvType').value,
      health_insurance_provider:  document.getElementById('fKvProvider').value,
      beruf:                      document.getElementById('fBeruf').value,
      berufsgruppe:               document.getElementById('fBerufsgruppe').value,
      wohneigentum:               document.getElementById('fWohneigentum').value,
      rente_aktiv:                document.getElementById('fRenteAktiv').value,
      rente:                      document.getElementById('fRente').value,
      minijob_aktiv:              document.getElementById('fMinijobAktiv').value,
      minijob:                    document.getElementById('fMinijob').value,
      kindergeld_aktiv:           document.getElementById('fKindergeldAktiv').value,
      kindergeld:                 document.getElementById('fKindergeld').value,
      andere_einkuenfte_aktiv:    document.getElementById('fAndereEinkuenfteAktiv').value,
      andere_einkuenfte:          document.getElementById('fAndereEinkuenfte').value,
      ausgaben_miete:             document.getElementById('fAusgabenMiete').value,
      ausgaben_nebenkosten:       document.getElementById('fAusgabenNebenkosten').value,
      ausgaben_mobilitaet:        document.getElementById('fAusgabenMobilitaet').value
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

// ── Passwort ändern ───────────────────────────────────────────────────────────
document.getElementById('pwChangeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('pwChangeAlert');
  const btn = document.getElementById('pwChangeBtn');
  alertEl.className = 'alert hidden';

  const current_password = document.getElementById('pwCurrent').value;
  const new_password = document.getElementById('pwNew').value;
  const confirm = document.getElementById('pwConfirm').value;

  if (new_password !== confirm) {
    alertEl.textContent = 'Die neuen Passwörter stimmen nicht überein.';
    alertEl.className = 'alert alert-error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Speichern…';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password })
    });
    const data = await res.json();
    if (!res.ok) {
      alertEl.textContent = data.error || 'Fehler beim Speichern.';
      alertEl.className = 'alert alert-error';
    } else {
      alertEl.textContent = 'Passwort erfolgreich geändert.';
      alertEl.className = 'alert alert-success';
      document.getElementById('pwChangeForm').reset();
      sessionStorage.removeItem('pw_expiry_warning');
      sessionStorage.removeItem('pw_banner_dismissed');
    }
  } catch {
    alertEl.textContent = 'Verbindungsfehler.';
    alertEl.className = 'alert alert-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Passwort ändern';
  }
});
