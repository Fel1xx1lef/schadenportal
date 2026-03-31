const CYCLE_LABEL = { monthly: '/ Monat', quarterly: '/ Quartal', halfyearly: '/ Halbjahr', yearly: '/ Jahr' };
const CAT_LABEL   = { insurance: 'Versicherung', subscription: 'Abonnement', other: 'Sonstiges' };

function fmt(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function catBadge(cat) {
  const map = { insurance: 'badge-insurance', subscription: 'badge-subscription', other: 'badge-other' };
  const span = document.createElement('span');
  span.className = 'badge ' + (map[cat] || 'badge-other');
  span.textContent = CAT_LABEL[cat] || cat;
  return span;
}

let allContracts = [];

const EMPTY_TEXTS = {
  all:          'Noch keine Verträge vorhanden.',
  own:          'Du hast noch keine eigenen Verträge bei Continentale hinterlegt.',
  external:     'Du hast noch keine weiteren Versicherungen hinzugefügt.',
  subscription: 'Du hast noch keine Abos oder laufenden Kosten hinzugefügt.',
  other:        'Keine sonstigen Einträge vorhanden.'
};

function isOwn(c) {
  return c.category === 'insurance' && (c.is_own_insurer === true || c.added_by_role === 'admin');
}

function renderGrids() {
  const grids = {
    all:          document.getElementById('grid-all'),
    own:          document.getElementById('grid-own'),
    external:     document.getElementById('grid-external'),
    subscription: document.getElementById('grid-subscription'),
    other:        document.getElementById('grid-other')
  };

  Object.values(grids).forEach(g => g.innerHTML = '');

  const filtered = {
    all:          allContracts,
    own:          allContracts.filter(c => isOwn(c)),
    external:     allContracts.filter(c => c.category === 'insurance' && !isOwn(c)),
    subscription: allContracts.filter(c => c.category === 'subscription'),
    other:        allContracts.filter(c => c.category === 'other')
  };

  for (const [key, list] of Object.entries(filtered)) {
    if (list.length === 0) {
      grids[key].innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>${EMPTY_TEXTS[key]}</p></div>`;
      continue;
    }
    list.forEach(c => grids[key].appendChild(buildCard(c)));
  }
}

function buildCard(c) {
  const card = document.createElement('div');
  card.className = 'contract-card' + (c.added_by_role === 'admin' ? ' agency' : '');

  const name = document.createElement('div');
  name.className = 'contract-name';
  name.textContent = c.name;

  const provider = document.createElement('div');
  provider.className = 'contract-provider';
  provider.textContent = c.provider || '';

  const amount = document.createElement('div');
  amount.className = 'contract-amount';
  amount.textContent = fmt(c.premium_amount);
  const cycle = document.createElement('span');
  cycle.textContent = ' ' + (CYCLE_LABEL[c.premium_cycle] || '');
  amount.appendChild(cycle);

  const meta = document.createElement('div');
  meta.className = 'contract-meta';
  meta.appendChild(catBadge(c.category));
  if (isOwn(c)) {
    const agBadge = document.createElement('span');
    agBadge.className = 'badge badge-own-insurer';
    agBadge.textContent = 'Beim Versicherer';
    meta.appendChild(agBadge);
  } else if (c.category === 'insurance' || c.category === 'subscription') {
    const selfBadge = document.createElement('span');
    selfBadge.className = 'badge badge-self-added';
    selfBadge.textContent = 'Selbst hinzugefügt';
    meta.appendChild(selfBadge);
  }

  card.appendChild(name);
  card.appendChild(provider);
  card.appendChild(amount);
  card.appendChild(meta);

  // Sparten-spezifische Details
  if (c.details && Object.keys(c.details).length > 0) {
    const detailsHtml = formatDetailsHtml(c.name, c.details);
    if (detailsHtml) {
      const detDiv = document.createElement('div');
      detDiv.className = 'text-muted';
      detDiv.style.cssText = 'font-size:12px;margin-top:6px;';
      detDiv.innerHTML = detailsHtml;
      card.appendChild(detDiv);
    }
  }

  if (c.start_date || c.end_date) {
    const dates = document.createElement('div');
    dates.className = 'text-muted';
    dates.style.fontSize = '12px';
    if (c.start_date) dates.textContent += 'Ab ' + c.start_date;
    if (c.end_date)   dates.textContent += (c.start_date ? ' · ' : '') + 'Bis ' + c.end_date;
    card.appendChild(dates);
  }

  if (c.description) {
    const desc = document.createElement('div');
    desc.className = 'text-muted';
    desc.style.cssText = 'font-size:13px;margin-top:8px;';
    desc.textContent = c.description;
    card.appendChild(desc);
  }

  // Scan-Thumbnail
  if (c.scan_image) {
    const scanDiv = document.createElement('div');
    scanDiv.style.marginTop = '10px';
    const img = document.createElement('img');
    img.src = `/uploads/contracts/${c.scan_image}`;
    img.style.cssText = 'max-width:100%;max-height:80px;border-radius:4px;cursor:pointer;border:1px solid var(--light-gray);';
    img.title = 'Versicherungsschein ansehen';
    img.addEventListener('click', () => window.open(`/uploads/contracts/${c.scan_image}`, '_blank'));
    scanDiv.appendChild(img);
    card.appendChild(scanDiv);
  }

  // Aktionen (für alle Verträge)
  const actions = document.createElement('div');
  actions.className = 'contract-actions';

  // 📷 Scan hochladen / ersetzen
  const scanLabel = document.createElement('label');
  scanLabel.className = 'btn btn-sm btn-secondary';
  scanLabel.style.cursor = 'pointer';
  scanLabel.innerHTML = (c.scan_image ? '🔄 Scan ersetzen' : '📷 Scan hochladen') +
    '<input type="file" accept="image/jpeg,image/png,image/webp" style="display:none">';
  scanLabel.querySelector('input').addEventListener('change', async e => {
    if (!e.target.files[0]) return;
    const fd = new FormData();
    fd.append('image', e.target.files[0]);
    const r = await fetch(`/api/contracts/${c._id}/scan`, { method: 'POST', body: fd });
    if (r.ok) await loadContracts();
  });
  actions.appendChild(scanLabel);

  // ℹ️ Details
  const infoBtn = document.createElement('button');
  infoBtn.className = 'btn btn-sm btn-secondary';
  infoBtn.textContent = 'ℹ️ Details';
  infoBtn.addEventListener('click', () => openInfoModal(c));
  actions.appendChild(infoBtn);

  // 💬 Kontakt
  const contactBtn = document.createElement('button');
  contactBtn.className = 'btn btn-sm btn-secondary';
  contactBtn.textContent = '💬 Kontakt';
  contactBtn.addEventListener('click', () => openContactModal(c));
  actions.appendChild(contactBtn);

  // ✏️ Bearbeiten + 🗑️ Löschen (nur eigene Verträge)
  if (c.added_by_role !== 'admin') {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-secondary';
    editBtn.textContent = '✏️ Bearbeiten';
    editBtn.addEventListener('click', () => openEdit(c));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '🗑️ Löschen';
    delBtn.addEventListener('click', () => deleteContract(c._id, c.name));
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);
  return card;
}

// ── Kontakt-Modal ─────────────────────────────────────────────────────────────
const contactModal       = document.getElementById('contactModal');
const contactModalAlert  = document.getElementById('contactModalAlert');

function openContactModal(c) {
  document.getElementById('cmSubject').value  = `Rückfrage zu: ${c.name}`;
  document.getElementById('cmMessage').value  = '';
  contactModalAlert.classList.add('hidden');
  contactModal.classList.remove('hidden');
}
function closeContactModal() { contactModal.classList.add('hidden'); }

document.getElementById('contactModalClose').addEventListener('click', closeContactModal);
document.getElementById('contactModalCancel').addEventListener('click', closeContactModal);
contactModal.addEventListener('click', e => { if (e.target === contactModal) closeContactModal(); });

document.getElementById('contactModalSend').addEventListener('click', async () => {
  const subject = document.getElementById('cmSubject').value;
  const message = document.getElementById('cmMessage').value.trim();
  if (!message) {
    contactModalAlert.textContent = 'Bitte Nachricht eingeben.';
    contactModalAlert.className   = 'alert alert-error';
    contactModalAlert.classList.remove('hidden');
    return;
  }
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, message, request_type: 'message' })
  });
  if (res.ok) {
    contactModalAlert.textContent = '✓ Nachricht gesendet!';
    contactModalAlert.className   = 'alert alert-success';
    contactModalAlert.classList.remove('hidden');
    setTimeout(closeContactModal, 1500);
  } else {
    contactModalAlert.textContent = 'Fehler beim Senden.';
    contactModalAlert.className   = 'alert alert-error';
    contactModalAlert.classList.remove('hidden');
  }
});

// ── Info-Modal ────────────────────────────────────────────────────────────────
const infoModal = document.getElementById('infoModal');

function openInfoModal(c) {
  document.getElementById('infoModalTitle').textContent = c.name;
  const body = document.getElementById('infoModalBody');
  body.innerHTML = '';

  function row(label, value) {
    if (!value) return;
    const d = document.createElement('div');
    d.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--light-gray);display:flex;gap:12px;font-size:14px;';
    d.innerHTML = `<span class="text-muted" style="min-width:130px;flex-shrink:0;">${label}</span><span>${value}</span>`;
    body.appendChild(d);
  }

  const badges = document.createElement('div');
  badges.style.cssText = 'padding:8px 0 12px;display:flex;gap:6px;flex-wrap:wrap;';
  const cb = catBadge(c.category); badges.appendChild(cb);
  if (isOwn(c)) {
    const ab = document.createElement('span');
    ab.className = 'badge badge-own-insurer';
    ab.textContent = 'Beim Versicherer';
    badges.appendChild(ab);
  } else if (c.category === 'insurance' || c.category === 'subscription') {
    const sb = document.createElement('span');
    sb.className = 'badge badge-self-added';
    sb.textContent = 'Selbst hinzugefügt';
    badges.appendChild(sb);
  }
  body.appendChild(badges);

  row('Anbieter', c.provider);
  row('Beitrag', fmt(c.premium_amount) + ' ' + (CYCLE_LABEL[c.premium_cycle] || ''));
  if (c.start_date || c.end_date) {
    let dates = '';
    if (c.start_date) dates += 'Ab ' + c.start_date;
    if (c.end_date)   dates += (c.start_date ? ' · ' : '') + 'Bis ' + c.end_date;
    row('Laufzeit', dates);
  }

  if (c.details && Object.keys(c.details).length > 0) {
    const dHtml = formatDetailsHtml(c.name, c.details);
    if (dHtml) {
      const dd = document.createElement('div');
      dd.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--light-gray);font-size:14px;';
      dd.innerHTML = `<span class="text-muted" style="display:block;margin-bottom:4px;font-size:13px;">Vertragsdetails</span>${dHtml}`;
      body.appendChild(dd);
    }
  }

  if (c.cancellation_deadline) row('Kündigungsdatum', c.cancellation_deadline);
  if (c.renewal_date) row('Nächste Verlängerung', c.renewal_date);
  if (c.description) row('Notizen', c.description);

  if (c.scan_image) {
    const scanRow = document.createElement('div');
    scanRow.style.cssText = 'padding:12px 0;font-size:14px;';
    const img = document.createElement('img');
    img.src = `/uploads/contracts/${c.scan_image}`;
    img.style.cssText = 'max-width:100%;max-height:200px;border-radius:6px;cursor:pointer;border:1px solid var(--light-gray);display:block;margin-top:6px;';
    img.title = 'Zum Vergrößern klicken';
    img.addEventListener('click', () => window.open(`/uploads/contracts/${c.scan_image}`, '_blank'));
    scanRow.innerHTML = '<span class="text-muted" style="font-size:13px;">Versicherungsschein</span>';
    scanRow.appendChild(img);
    body.appendChild(scanRow);
  }

  infoModal.classList.remove('hidden');
}
function closeInfoModal() { infoModal.classList.add('hidden'); }

document.getElementById('infoModalClose').addEventListener('click', closeInfoModal);
document.getElementById('infoModalCloseBtn').addEventListener('click', closeInfoModal);
infoModal.addEventListener('click', e => { if (e.target === infoModal) closeInfoModal(); });

// ── Name-Feld Logik ────────────────────────────────────────────────────────────
const fCategory        = document.getElementById('fCategory');
const nameSelectGrp    = document.getElementById('nameSelectGroup');
const nameTextGrp      = document.getElementById('nameTextGroup');
const fNameSelect      = document.getElementById('fNameSelect');
const fNameCustom      = document.getElementById('fNameCustom');
const fNameText        = document.getElementById('fNameText');
const fExtraFields     = document.getElementById('fExtraFields');
const insurerSelectRow = document.getElementById('insurerSelectRow');
const btnContinentale  = document.getElementById('btnContinentale');
const btnOtherInsurer  = document.getElementById('btnOtherInsurer');
const providerRow      = document.getElementById('providerRow');
let selectedInsurer    = null; // 'continentale' | 'other' | null

function setInsurer(type) {
  selectedInsurer = type;
  btnContinentale.classList.toggle('btn-primary', type === 'continentale');
  btnContinentale.classList.toggle('btn-secondary', type !== 'continentale');
  btnOtherInsurer.classList.toggle('btn-primary', type === 'other');
  btnOtherInsurer.classList.toggle('btn-secondary', type !== 'other');

  const fProvider = document.getElementById('fProvider');
  if (type === 'continentale') {
    fProvider.value = 'Continentale';
    fProvider.readOnly = true;
    fProvider.style.background = 'var(--light-gray)';
    providerRow.style.display = 'none'; // Anbieter-Feld ausblenden, da klar
  } else if (type === 'other') {
    if (fProvider.value === 'Continentale') fProvider.value = '';
    fProvider.readOnly = false;
    fProvider.style.background = '';
    providerRow.style.display = '';
  }
}

btnContinentale.addEventListener('click', () => setInsurer('continentale'));
btnOtherInsurer.addEventListener('click', () => setInsurer('other'));

populateInsuranceSelect(fNameSelect);


fCategory.addEventListener('change', () => {
  const fProvider = document.getElementById('fProvider');
  if (fCategory.value === 'insurance') {
    nameSelectGrp.style.display    = '';
    nameTextGrp.style.display      = 'none';
    insurerSelectRow.style.display = '';
    fNameText.removeAttribute('required');
    fProvider.placeholder = 'Name des Versicherers';
  } else if (fCategory.value === 'subscription') {
    nameSelectGrp.style.display    = 'none';
    nameTextGrp.style.display      = '';
    insurerSelectRow.style.display = 'none';
    providerRow.style.display      = 'none';
    fProvider.readOnly = false;
    fProvider.style.background = '';
    selectedInsurer = null;
    fNameText.setAttribute('required', '');
    fNameText.placeholder = 'z.B. Netflix, Spotify, Amazon Prime';
  } else {
    nameSelectGrp.style.display    = 'none';
    nameTextGrp.style.display      = '';
    insurerSelectRow.style.display = 'none';
    providerRow.style.display      = '';
    document.getElementById('providerLabel').textContent = 'Anbieter';
    fProvider.placeholder = 'Vertragspartner / Anbieter';
    fProvider.readOnly = false;
    fProvider.style.background = '';
    selectedInsurer = null;
    fNameText.setAttribute('required', '');
    fNameText.placeholder = 'z.B. Strom, Handy, Gym';
  }
  fExtraFields.innerHTML = '';
});

fNameSelect.addEventListener('change', () => {
  const val = fNameSelect.value;
  if (val === '__custom__') {
    fNameCustom.style.display = '';
    fNameCustom.focus();
  } else {
    fNameCustom.style.display = 'none';
    fNameCustom.value = '';
  }
  renderExtraFields(val === '__custom__' ? '' : val, fExtraFields, 'f');
});

function getFormName() {
  if (fCategory.value === 'insurance') {
    return fNameSelect.value === '__custom__' ? fNameCustom.value.trim() : fNameSelect.value;
  }
  return fNameText.value.trim();
}

function getSelectedInsuranceType() {
  if (fCategory.value !== 'insurance') return '';
  return fNameSelect.value === '__custom__' ? '' : fNameSelect.value;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const modal      = document.getElementById('contractModal');
const form       = document.getElementById('contractForm');
const modalAlert = document.getElementById('modalAlert');

function openAdd() {
  document.getElementById('modalTitle').textContent = 'Vertrag hinzufügen';
  document.getElementById('contractId').value = '';
  form.reset();
  // Reset Namensfelder-Anzeige
  nameSelectGrp.style.display    = 'none';
  nameTextGrp.style.display      = '';
  fNameText.setAttribute('required', '');
  fNameCustom.style.display      = 'none';
  fExtraFields.innerHTML         = '';
  insurerSelectRow.style.display = 'none';
  providerRow.style.display      = 'none'; // wird per Kategorie-Wechsel eingeblendet
  selectedInsurer                = null;
  btnContinentale.classList.remove('btn-primary'); btnContinentale.classList.add('btn-secondary');
  btnOtherInsurer.classList.remove('btn-primary');  btnOtherInsurer.classList.add('btn-secondary');
  const fProvider = document.getElementById('fProvider');
  fProvider.readOnly = false;
  fProvider.style.background = '';
  fProvider.placeholder = 'Name des Versicherers';
  document.getElementById('providerLabel').textContent = 'Anbieter';
  document.getElementById('fNameText').placeholder = 'z.B. Hausratversicherung';
  // Neue Felder zurücksetzen
  document.getElementById('fCancellationDeadline').value = '';
  document.getElementById('fRenewalDate').value = '';
  modalAlert.classList.add('hidden');
  modal.classList.remove('hidden');
  if (window.location.hash === '#new') history.replaceState(null, '', window.location.pathname);
}

function openEdit(c) {
  document.getElementById('modalTitle').textContent = 'Vertrag bearbeiten';
  document.getElementById('contractId').value = c._id;
  fCategory.value = c.category;
  document.getElementById('fProvider').value  = c.provider || '';
  document.getElementById('fAmount').value    = c.premium_amount;
  document.getElementById('fCycle').value     = c.premium_cycle;
  document.getElementById('fStartDate').value = c.start_date || '';
  document.getElementById('fEndDate').value   = c.end_date || '';
  document.getElementById('fCancellationDeadline').value = c.cancellation_deadline || '';
  document.getElementById('fRenewalDate').value = c.renewal_date || '';
  document.getElementById('fDescription').value = c.description || '';

  if (c.category === 'insurance') {
    nameSelectGrp.style.display    = '';
    nameTextGrp.style.display      = 'none';
    insurerSelectRow.style.display = '';
    fNameText.removeAttribute('required');

    const typeMatch = INSURANCE_TYPES.find(t => t.name === c.name);
    if (typeMatch) {
      fNameSelect.value         = c.name;
      fNameCustom.style.display = 'none';
      fNameCustom.value         = '';
    } else {
      fNameSelect.value         = '__custom__';
      fNameCustom.value         = c.name;
      fNameCustom.style.display = '';
    }
    renderExtraFields(typeMatch ? c.name : '', fExtraFields, 'f', c.details || {});

    // Versicherer-Buttons wiederherstellen
    const insurerType = (c.is_own_insurer || c.added_by_role === 'admin') ? 'continentale' : 'other';
    setInsurer(insurerType);
  } else {
    nameSelectGrp.style.display    = 'none';
    nameTextGrp.style.display      = '';
    insurerSelectRow.style.display = 'none';
    selectedInsurer                = null;
    const fProvider = document.getElementById('fProvider');
    fProvider.readOnly = false;
    fProvider.style.background = '';
    fNameText.setAttribute('required', '');
    fNameText.value             = c.name;
    fExtraFields.innerHTML      = '';
    if (c.category === 'subscription') {
      providerRow.style.display = 'none';
      fNameText.placeholder = 'z.B. Netflix, Spotify, Amazon Prime';
    } else {
      providerRow.style.display = '';
      document.getElementById('providerLabel').textContent = 'Anbieter';
      fProvider.placeholder = 'Vertragspartner / Anbieter';
      fNameText.placeholder = 'z.B. Strom, Handy, Gym';
    }
  }

  modalAlert.classList.add('hidden');
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  form.reset();
  fExtraFields.innerHTML         = '';
  insurerSelectRow.style.display = 'none';
  providerRow.style.display      = '';
  selectedInsurer                = null;
  const fProvider = document.getElementById('fProvider');
  fProvider.readOnly = false;
  fProvider.style.background = '';
  btnContinentale.classList.remove('btn-primary'); btnContinentale.classList.add('btn-secondary');
  btnOtherInsurer.classList.remove('btn-primary');  btnOtherInsurer.classList.add('btn-secondary');
}

document.getElementById('addBtn').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

form.addEventListener('submit', async e => {
  e.preventDefault();

  const name = getFormName();
  if (!name) {
    modalAlert.textContent = 'Bitte Versicherungsart / Namen angeben.';
    modalAlert.classList.remove('hidden');
    return;
  }

  const id = document.getElementById('contractId').value;
  const insuranceType = getSelectedInsuranceType();
  const details = insuranceType ? collectExtraFields(insuranceType, 'f') : {};
  const cat = fCategory.value;

  // Versicherer-Validierung für Versicherungen
  if (cat === 'insurance' && !selectedInsurer) {
    modalAlert.textContent = 'Bitte wähle, ob der Vertrag bei der Continentale oder einem anderen Versicherer läuft.';
    modalAlert.classList.remove('hidden');
    return;
  }

  const isOwnInsurer = cat === 'insurance' && selectedInsurer === 'continentale';

  const providerVal = cat === 'subscription'
    ? name
    : (isOwnInsurer ? 'Continentale' : document.getElementById('fProvider').value);

  const body = {
    category:       cat,
    name,
    provider:       providerVal,
    is_own_insurer: isOwnInsurer,
    premium_amount: document.getElementById('fAmount').value,
    premium_cycle:  document.getElementById('fCycle').value,
    start_date:     document.getElementById('fStartDate').value,
    end_date:       document.getElementById('fEndDate').value,
    cancellation_deadline: document.getElementById('fCancellationDeadline').value,
    renewal_date:   document.getElementById('fRenewalDate').value,
    description:    document.getElementById('fDescription').value,
    details
  };

  const url    = id ? `/api/contracts/${id}` : '/api/contracts';
  const method = id ? 'PUT' : 'POST';

  const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();

  if (!res.ok) {
    modalAlert.textContent = data.error || 'Fehler beim Speichern';
    modalAlert.classList.remove('hidden');
    return;
  }

  closeModal();
  await loadContracts();
});

// ── Löschen ───────────────────────────────────────────────────────────────────
async function deleteContract(id, name) {
  if (!confirm(`Vertrag "${name}" wirklich löschen?`)) return;
  const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await loadContracts();
  } else {
    const data = await res.json();
    alert(data.error || 'Fehler beim Löschen');
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function loadContracts() {
  allContracts = await fetch('/api/contracts').then(r => r.json()).catch(() => []);
  renderGrids();
}

async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  await loadContracts();

  // Direkt Modal öffnen wenn #new im Hash
  if (window.location.hash === '#new') openAdd();

  // Vorausgefülltes Formular per URL-Parameter (Schnell-Hinzufügen vom Dashboard)
  const params = new URLSearchParams(window.location.search);
  if (params.get('prefill') === '1') {
    history.replaceState(null, '', window.location.pathname);
    openAdd();
    const cat  = params.get('category');
    const name = params.get('name');
    if (cat) {
      fCategory.value = cat;
      fCategory.dispatchEvent(new Event('change'));
    }
    if (name) {
      if (cat === 'insurance') {
        const typeMatch = INSURANCE_TYPES.find(t => t.name === name);
        if (typeMatch) {
          fNameSelect.value = name;
          fNameSelect.dispatchEvent(new Event('change'));
        } else {
          fNameSelect.value = '__custom__';
          fNameSelect.dispatchEvent(new Event('change'));
          fNameCustom.value = name;
        }
      } else {
        fNameText.value = name;
      }
    }
  }
}

init();
