let currentStep = 1;
const TOTAL_STEPS = 8;

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

// ── Versicherungsliste dynamisch rendern ──────────────────────────────────────

const ABONNEMENTS = [
  { value: 'Stromvertrag',          label: '⚡ Strom',              cat: 'subscription' },
  { value: 'Gasvertrag',            label: '🔥 Gas / Heizung',      cat: 'subscription' },
  { value: 'Internetvertrag',       label: '🌐 Internet',           cat: 'subscription' },
  { value: 'Mobilfunkvertrag',      label: '📱 Mobilfunk',          cat: 'subscription' },
  { value: 'GEZ / Rundfunkbeitrag', label: '📺 Rundfunkbeitrag',    cat: 'subscription' },
  { value: 'Netflix',               label: '🎬 Netflix',            cat: 'subscription' },
  { value: 'Spotify',               label: '🎵 Spotify',            cat: 'subscription' },
  { value: 'Amazon Prime',          label: '📦 Amazon Prime',       cat: 'subscription' },
  { value: 'Disney+',               label: '🎠 Disney+',            cat: 'subscription' },
  { value: 'YouTube Premium',       label: '▶️ YouTube Premium',    cat: 'subscription' },
  { value: 'Apple One',             label: '🍎 Apple One',          cat: 'subscription' },
  { value: 'DAZN',                  label: '⚽ DAZN',               cat: 'subscription' },
  { value: '',                      label: '➕ Sonstiges',          cat: 'subscription', custom: true },
];

const VERSICHERUNGEN = [
  { value: 'Privathaftpflicht',                    label: '🛡️ Privathaftpflicht' },
  { value: 'Kfz-Versicherung',                     label: '🚗 Kfz-Versicherung' },
  { value: 'Hausratversicherung',                  label: '🏠 Hausrat' },
  { value: 'Rechtsschutzversicherung',             label: '⚖️ Rechtsschutz' },
  { value: 'Berufsunfähigkeitsversicherung (BU)',  label: '💼 Berufsunfähigkeit' },
  { value: 'Risikolebensversicherung',             label: '❤️ Risikoleben' },
  { value: 'Unfallversicherung',                   label: '🩺 Unfall' },
  { value: 'Zahnzusatzversicherung',               label: '🦷 Zahnzusatz' },
  { value: 'Gebäudeversicherung',                  label: '🏗️ Gebäude' },
  { value: 'Krankentagegeldversicherung',          label: '🏥 Krankentagegeld' },
  { value: '',                                     label: '➕ Sonstiges', custom: true },
];

function detailFields() {
  return `
    <div class="wizard-ins-detail-row">
      <div style="flex:2;">
        <label style="font-size:12px;margin-bottom:2px;display:block;">Versicherer</label>
        <input type="text" class="form-control vc-provider" placeholder="z. B. Allianz">
      </div>
      <div style="flex:1;">
        <label style="font-size:12px;margin-bottom:2px;display:block;">Beitrag (€)</label>
        <input type="number" class="form-control vc-amount" placeholder="0" min="0" step="0.01">
      </div>
      <div style="flex:1;">
        <label style="font-size:12px;margin-bottom:2px;display:block;">Zahlweise</label>
        <select class="form-control vc-cycle">
          <option value="monthly">monatlich</option>
          <option value="quarterly">vierteljährl.</option>
          <option value="biannual">halbjährl.</option>
          <option value="yearly">jährlich</option>
        </select>
      </div>
    </div>`;
}

function buildItemsHtml(items) {
  return items.map(ins => {
    const nameField = ins.custom
      ? `<div style="margin-bottom:8px;">
           <label style="font-size:12px;margin-bottom:2px;display:block;">Bezeichnung <span style="color:var(--danger)">*</span></label>
           <input type="text" class="form-control vc-name-custom" placeholder="z. B. Fitnessstudio">
         </div>`
      : '';
    return `<div class="wizard-ins-item">
      <label class="wizard-ins-header">
        <input type="checkbox" value="${ins.value}" data-cat="${ins.cat || 'insurance'}">
        <span>${ins.label}</span>
      </label>
      <div class="wizard-ins-detail">
        ${nameField}
        ${detailFields()}
      </div>
    </div>`;
  }).join('');
}

function wireToggle(container) {
  container.querySelectorAll('.wizard-ins-header input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.wizard-ins-item').querySelector('.wizard-ins-detail')
        .classList.toggle('open', cb.checked);
    });
  });
}

function renderAboList() {
  const container = document.getElementById('abosList');
  container.innerHTML = buildItemsHtml(ABONNEMENTS);
  wireToggle(container);
}

function renderInsuranceList() {
  const container = document.getElementById('versicherungenList');
  container.innerHTML = buildItemsHtml(VERSICHERUNGEN);
  wireToggle(container);
}

// ── Schrittsteuerung ──────────────────────────────────────────────────────────

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

function getBtnForStep(step) {
  const ids = ['nextBtn', 'nextBtn2', 'nextBtn3', 'nextBtn4', 'nextBtn5', 'nextBtn6', 'nextBtn7'];
  return document.getElementById(ids[step - 1]) || null;
}

// ── Speichern ─────────────────────────────────────────────────────────────────

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

async function saveInsurances() {
  const existing = await fetch('/api/contracts').then(r => r.ok ? r.json() : []).catch(() => []);
  const byName = {};
  (existing || []).forEach(c => { byName[c.name] = c; });

  const items = document.querySelectorAll('#versicherungenList .wizard-ins-item');
  for (const item of items) {
    const cb = item.querySelector('input[type=checkbox]');
    if (!cb.checked) continue;

    let name = cb.value;
    if (!name) {
      const customInput = item.querySelector('.vc-name-custom');
      name = customInput ? customInput.value.trim() : '';
    }
    if (!name) continue;

    const provider = (item.querySelector('.vc-provider')?.value || '').trim();
    const amountVal = item.querySelector('.vc-amount')?.value;
    const premium_amount = amountVal !== '' && amountVal !== undefined ? parseFloat(amountVal) || 0 : 0;
    const premium_cycle = item.querySelector('.vc-cycle')?.value || 'monthly';

    if (byName[name]) {
      const c = byName[name];
      if (c.added_by_role !== 'admin') {
        await fetch('/api/contracts/' + c._id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'insurance', name, provider, premium_amount, premium_cycle,
            description: c.description || '',
            start_date: c.start_date || '',
            end_date: c.end_date || ''
          })
        });
      }
    } else {
      await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'insurance', name, provider, premium_amount, premium_cycle })
      });
    }
  }
}

async function saveAbos() {
  const existing = await fetch('/api/contracts').then(r => r.ok ? r.json() : []).catch(() => []);
  const byName = {};
  (existing || []).forEach(c => { byName[c.name] = c; });

  const items = document.querySelectorAll('#abosList .wizard-ins-item');
  for (const item of items) {
    const cb = item.querySelector('input[type=checkbox]');
    if (!cb.checked) continue;

    let name = cb.value;
    if (!name) {
      const customInput = item.querySelector('.vc-name-custom');
      name = customInput ? customInput.value.trim() : '';
    }
    if (!name) continue;

    const provider = (item.querySelector('.vc-provider')?.value || '').trim();
    const amountVal = item.querySelector('.vc-amount')?.value;
    const premium_amount = amountVal !== '' && amountVal !== undefined ? parseFloat(amountVal) || 0 : 0;
    const premium_cycle = item.querySelector('.vc-cycle')?.value || 'monthly';
    const category = cb.dataset.cat || 'subscription';

    if (byName[name]) {
      const c = byName[name];
      if (c.added_by_role !== 'admin') {
        await fetch('/api/contracts/' + c._id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category, name, provider, premium_amount, premium_cycle,
            description: c.description || '',
            start_date: c.start_date || '',
            end_date: c.end_date || ''
          })
        });
      }
    } else {
      await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, name, provider, premium_amount, premium_cycle })
      });
    }
  }
}

async function saveCurrentStep() {
  if (currentStep === 6) { await saveInsurances(); return true; }
  if (currentStep === 7) { await saveAbos(); return true; }
  const data = getStepData(currentStep);
  if (!data) return true;
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.ok;
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

// ── Profil laden & Checkboxen vormarkieren ────────────────────────────────────

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

async function preCheckContracts() {
  try {
    const list = await fetch('/api/contracts').then(r => r.ok ? r.json() : []).catch(() => []);
    const byName = {};
    (list || []).forEach(c => { byName[c.name] = c; });

    // Versicherungen: Checkbox + Detail-Felder vorausfüllen
    document.querySelectorAll('#versicherungenList .wizard-ins-item').forEach(item => {
      const cb = item.querySelector('input[type=checkbox]');
      if (!cb.value) return; // Sonstiges überspringen (kein fixer Name)
      const c = byName[cb.value];
      if (!c) return;
      cb.checked = true;
      const detail = item.querySelector('.wizard-ins-detail');
      detail.classList.add('open');
      const provEl = item.querySelector('.vc-provider');
      const amtEl  = item.querySelector('.vc-amount');
      const cycEl  = item.querySelector('.vc-cycle');
      if (provEl) provEl.value = c.provider || '';
      if (amtEl)  amtEl.value  = c.premium_amount != null ? c.premium_amount : '';
      if (cycEl)  cycEl.value  = c.premium_cycle || 'monthly';
    });

    // Abonnements: Checkbox + Detail-Felder vorausfüllen
    document.querySelectorAll('#abosList .wizard-ins-item').forEach(item => {
      const cb = item.querySelector('input[type=checkbox]');
      if (!cb.value) return; // Sonstiges überspringen
      const c = byName[cb.value];
      if (!c) return;
      cb.checked = true;
      const detail = item.querySelector('.wizard-ins-detail');
      detail.classList.add('open');
      const provEl = item.querySelector('.vc-provider');
      const amtEl  = item.querySelector('.vc-amount');
      const cycEl  = item.querySelector('.vc-cycle');
      if (provEl) provEl.value = c.provider || '';
      if (amtEl)  amtEl.value  = c.premium_amount != null ? c.premium_amount : '';
      if (cycEl)  cycEl.value  = c.premium_cycle || 'monthly';
    });
  } catch (_) {}
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async function () {
  const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // Schritt-Buttons verdrahten
  ['nextBtn', 'nextBtn2', 'nextBtn3', 'nextBtn4', 'nextBtn5', 'nextBtn6', 'nextBtn7'].forEach(id => {
    document.getElementById(id).addEventListener('click', wizardNext);
  });
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

  renderInsuranceList();
  renderAboList();
  await loadProfile();
  await preCheckContracts();
})();
