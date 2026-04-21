let currentStep = 1;
const TOTAL_STEPS = 7;

// Hilfsfunktionen
const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
const checked = id => { const el = document.getElementById(id); return el ? el.checked : false; };
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
const setChecked = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

function showAlert(msg) {
  const el = document.getElementById('wizardAlert');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAlert() {
  document.getElementById('wizardAlert').classList.add('hidden');
}

function updateToggle(key) {
  const isChecked = document.getElementById('w_' + key + '_aktiv').checked;
  document.getElementById('w_' + key + '_wrap').style.display = isChecked ? 'block' : 'none';
}

function setStep(n) {
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.getElementById('dot' + i);
    if (i < n) dot.className = 'step-dot done';
    else if (i === n) dot.className = 'step-dot active';
    else dot.className = 'step-dot';
  }
  currentStep = n;
  hideAlert();
  window.scrollTo(0, 0);
}

function getStepData(step) {
  switch (step) {
    case 2: return {
      beruf: val('w_beruf'),
      berufsgruppe: val('w_berufsgruppe'),
      wohneigentum: val('w_wohneigentum'),
      health_insurance_type: val('w_health_insurance_type'),
      health_insurance_provider: val('w_health_insurance_provider')
    };
    case 3: return {
      gross_income: val('w_gross_income'),
      rente_aktiv: checked('w_rente_aktiv') ? 'true' : '',
      rente: val('w_rente'),
      minijob_aktiv: checked('w_minijob_aktiv') ? 'true' : '',
      minijob: val('w_minijob'),
      kindergeld_aktiv: checked('w_kindergeld_aktiv') ? 'true' : '',
      kindergeld: val('w_kindergeld'),
      andere_einkuenfte_aktiv: checked('w_andere_einkuenfte_aktiv') ? 'true' : '',
      andere_einkuenfte: val('w_andere_einkuenfte')
    };
    case 4: return {
      ausgaben_miete: val('w_ausgaben_miete'),
      ausgaben_nebenkosten: val('w_ausgaben_nebenkosten')
    };
    case 5: return { ausgaben_mobilitaet: val('w_ausgaben_mobilitaet') };
    default: return null;
  }
}

async function saveCurrentStep() {
  const data = getStepData(currentStep);
  if (!data) return true;
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.ok;
}

function getBtnForStep(step) {
  const ids = ['nextBtn', 'nextBtn2', 'nextBtn3', 'nextBtn4', 'nextBtn5'];
  return document.getElementById(ids[step - 1]) || null;
}

async function wizardNext() {
  hideAlert();
  const btn = getBtnForStep(currentStep);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  const saved = await saveCurrentStep();
  if (!saved) {
    showAlert('Fehler beim Speichern. Bitte versuche es erneut.');
    if (btn) { btn.disabled = false; btn.textContent = 'Weiter →'; }
    return;
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Weiter →'; }
  if (currentStep < TOTAL_STEPS) setStep(currentStep + 1);
}

function wizardBack() {
  if (currentStep > 1) setStep(currentStep - 1);
}

async function wizardFinish() {
  const btn = document.getElementById('finishBtn');
  btn.disabled = true;
  btn.textContent = '…';
  await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ haushalt_wizard_done: true })
  });
  window.location.href = 'dashboard.html';
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return;
    const p = await res.json();
    setVal('w_beruf', p.beruf);
    setVal('w_berufsgruppe', p.berufsgruppe);
    setVal('w_wohneigentum', p.wohneigentum);
    setVal('w_health_insurance_type', p.health_insurance_type);
    setVal('w_health_insurance_provider', p.health_insurance_provider);
    setVal('w_gross_income', p.gross_income);
    setChecked('w_rente_aktiv', p.rente_aktiv === 'true' || p.rente_aktiv === true);
    setVal('w_rente', p.rente);
    setChecked('w_minijob_aktiv', p.minijob_aktiv === 'true' || p.minijob_aktiv === true);
    setVal('w_minijob', p.minijob);
    setChecked('w_kindergeld_aktiv', p.kindergeld_aktiv === 'true' || p.kindergeld_aktiv === true);
    setVal('w_kindergeld', p.kindergeld);
    setChecked('w_andere_einkuenfte_aktiv', p.andere_einkuenfte_aktiv === 'true' || p.andere_einkuenfte_aktiv === true);
    setVal('w_andere_einkuenfte', p.andere_einkuenfte);
    setVal('w_ausgaben_miete', p.ausgaben_miete);
    setVal('w_ausgaben_nebenkosten', p.ausgaben_nebenkosten);
    setVal('w_ausgaben_mobilitaet', p.ausgaben_mobilitaet);
    ['rente', 'minijob', 'kindergeld', 'andere_einkuenfte'].forEach(k => updateToggle(k));
  } catch (_) {}
}

// Init – IIFE-Muster wie alle anderen Portal-Seiten
(async function () {
  const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // Schritt-Buttons verdrahten
  document.getElementById('nextBtn').addEventListener('click', wizardNext);
  document.getElementById('nextBtn2').addEventListener('click', wizardNext);
  document.getElementById('nextBtn3').addEventListener('click', wizardNext);
  document.getElementById('nextBtn4').addEventListener('click', wizardNext);
  document.getElementById('nextBtn5').addEventListener('click', wizardNext);
  document.getElementById('nextBtn6').addEventListener('click', wizardNext);
  document.getElementById('finishBtn').addEventListener('click', wizardFinish);

  document.querySelectorAll('.wizard-back').forEach(btn => {
    btn.addEventListener('click', wizardBack);
  });

  // "Jetzt nicht": wizard_done setzen → kein erneuter Redirect
  document.getElementById('skipWizard').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ haushalt_wizard_done: true })
    });
    window.location.href = 'dashboard.html';
  });

  // Toggle-Checkboxen für optionale Einkommensfelder
  ['rente', 'minijob', 'kindergeld', 'andere_einkuenfte'].forEach(k => {
    document.getElementById('w_' + k + '_aktiv').addEventListener('change', () => updateToggle(k));
  });

  await loadProfile();
})();
