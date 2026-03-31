const CYCLE_LABEL = { monthly: '/ Monat', quarterly: '/ Quartal', halfyearly: '/ Halbjahr', yearly: '/ Jahr' };
const CAT_LABEL   = { insurance: 'Versicherung', subscription: 'Abonnement', other: 'Sonstiges' };

function fmt(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'crm') { loadWiedervorlagen(); loadBirthdays(); loadTasksOverview(); }
    if (btn.dataset.tab === 'calendar') loadCalendar();
    if (btn.dataset.tab === 'settings') loadSettings();
  });
});

// ── Kunden laden ──────────────────────────────────────────────────────────────
let customers = [];

async function loadCustomers() {
  customers = await fetch('/api/admin/customers').then(r => r.json()).catch(() => []);
  renderCustomerTable();
  populateCustomerSelect();
}

function renderCustomerTable() {
  const tbody = document.getElementById('customersBody');
  const empty = document.getElementById('customersEmpty');
  tbody.innerHTML = '';

  if (customers.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  customers.forEach(c => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.style.fontWeight = 'bold';
    tdName.textContent = c.full_name;
    if (c.crm_status) {
      const statusKey = c.crm_status.toLowerCase()
        .replace('ü', 'u').replace('ä', 'a').replace('ö', 'o').replace(/ /g, '-');
      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge badge-crm-' + statusKey;
      statusBadge.style.marginLeft = '8px';
      statusBadge.textContent = c.crm_status;
      tdName.appendChild(statusBadge);
    }
    const bdDays = upcomingBirthdayDays(c.birthday);
    if (bdDays !== null) {
      const bdSpan = document.createElement('span');
      bdSpan.className = 'badge badge-birthday';
      bdSpan.style.marginLeft = '8px';
      bdSpan.textContent = bdDays === 0 ? '🎂 Heute!' : `🎂 in ${bdDays}d`;
      tdName.appendChild(bdSpan);
    }
    // Consent-Badges
    if (c.consent_given) {
      const consentWrap = document.createElement('div');
      consentWrap.style.cssText = 'margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;';
      const badgeAdvisory = document.createElement('span');
      badgeAdvisory.title = c.consent_advisory ? 'Einwilligung Beratung: Ja' : 'Einwilligung Beratung: Nein';
      badgeAdvisory.style.cssText = `font-size:11px;padding:1px 6px;border-radius:10px;font-weight:500;background:${c.consent_advisory ? '#d1fae5' : '#fee2e2'};color:${c.consent_advisory ? '#065f46' : '#991b1b'};`;
      badgeAdvisory.textContent = c.consent_advisory ? '✓ Beratung' : '✗ Beratung';
      const badgeOffers = document.createElement('span');
      badgeOffers.title = c.consent_offers ? 'Einwilligung Angebote: Ja' : 'Einwilligung Angebote: Nein';
      badgeOffers.style.cssText = `font-size:11px;padding:1px 6px;border-radius:10px;font-weight:500;background:${c.consent_offers ? '#d1fae5' : '#fee2e2'};color:${c.consent_offers ? '#065f46' : '#991b1b'};`;
      badgeOffers.textContent = c.consent_offers ? '✓ Angebote' : '✗ Angebote';
      consentWrap.appendChild(badgeAdvisory);
      consentWrap.appendChild(badgeOffers);
      tdName.appendChild(consentWrap);
    } else {
      const noConsent = document.createElement('div');
      noConsent.style.cssText = 'font-size:11px;color:#9ca3af;margin-top:3px;';
      noConsent.textContent = 'Noch keine Einwilligung';
      tdName.appendChild(noConsent);
    }

    const tdEmail = document.createElement('td');
    tdEmail.textContent = c.email;

    const tdPhone = document.createElement('td');
    tdPhone.textContent = c.phone || '–';

    const tdCount = document.createElement('td');
    tdCount.textContent = c.contract_count;

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(c.created_at);
    if (c.wiedervorlage) {
      const wv    = new Date(c.wiedervorlage);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff  = (wv - today) / (1000 * 60 * 60 * 24);
      if (diff <= 7) {
        const wvSpan = document.createElement('div');
        wvSpan.style.cssText = 'font-size:12px;color:#c2410c;margin-top:2px;';
        wvSpan.textContent = '⏰ WV: ' + wv.toLocaleDateString('de-DE');
        tdDate.appendChild(wvSpan);
      }
    }

    const tdActions = document.createElement('td');
    tdActions.style.whiteSpace = 'nowrap';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-secondary';
    viewBtn.style.marginRight = '6px';
    viewBtn.textContent = '👤 Profil';
    viewBtn.addEventListener('click', () => openCustomerDetail(c));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Kunden löschen';
    delBtn.addEventListener('click', () => deleteCustomer(c.id, c.full_name));

    tdActions.appendChild(viewBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdPhone);
    tr.appendChild(tdCount);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

function populateCustomerSelect() {
  const sel = document.getElementById('acCustomer');
  sel.innerHTML = '<option value="">Kunden wählen…</option>';
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.full_name + ' (' + c.email + ')';
    sel.appendChild(opt);
  });
}

async function deleteCustomer(id, name) {
  if (!confirm(`Kunden "${name}" wirklich löschen?\n\nAlle Verträge und Nachrichten dieses Kunden werden ebenfalls gelöscht.`)) return;
  const res = await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await loadCustomers();
  } else {
    const data = await res.json();
    alert(data.error || 'Fehler beim Löschen');
  }
}

// ── Neuer Kunde Modal ─────────────────────────────────────────────────────────
const newCustModal = document.getElementById('newCustomerModal');

document.getElementById('newCustomerBtn').addEventListener('click', () => {
  document.getElementById('newCustomerForm').reset();
  document.getElementById('custModalAlert').classList.add('hidden');
  document.getElementById('custSuccessInfo').classList.add('hidden');
  newCustModal.classList.remove('hidden');
});

function closeNewCustModal() { newCustModal.classList.add('hidden'); }
document.getElementById('custModalClose').addEventListener('click', closeNewCustModal);
document.getElementById('custModalCancel').addEventListener('click', closeNewCustModal);
newCustModal.addEventListener('click', e => { if (e.target === newCustModal) closeNewCustModal(); });

document.getElementById('newCustomerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl   = document.getElementById('custModalAlert');
  const successEl = document.getElementById('custSuccessInfo');
  alertEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const body = {
    full_name: document.getElementById('custName').value,
    email:     document.getElementById('custEmail').value,
    phone:     document.getElementById('custPhone').value,
    birthday:  document.getElementById('custBirthday').value,
    password:  document.getElementById('custPassword').value
  };

  const res  = await fetch('/api/admin/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();

  if (!res.ok) {
    alertEl.textContent = data.error || 'Fehler beim Anlegen';
    alertEl.classList.remove('hidden');
    return;
  }

  successEl.textContent = `Kunde "${data.full_name}" wurde angelegt. Login: ${data.email}`;
  successEl.classList.remove('hidden');
  document.getElementById('newCustomerForm').reset();
  await loadCustomers();
});

// ── Vertrag für Kunden hinzufügen – Name-Feld Logik ──────────────────────────
const acCategory      = document.getElementById('acCategory');
const acNameSelectGrp = document.getElementById('acNameSelectGroup');
const acNameTextGrp   = document.getElementById('acNameTextGroup');
const acNameSelect    = document.getElementById('acNameSelect');
const acNameCustom    = document.getElementById('acNameCustom');
const acNameText      = document.getElementById('acNameText');
const acExtraFields   = document.getElementById('acExtraFields');

populateInsuranceSelect(acNameSelect);

const acProviderGroup = document.getElementById('acProviderGroup');
const acProviderLabel = document.getElementById('acProviderLabel');
const acProviderInput = document.getElementById('acProvider');

acCategory.addEventListener('change', () => {
  if (acCategory.value === 'insurance') {
    acNameSelectGrp.style.display = '';
    acNameTextGrp.style.display   = 'none';
    acProviderGroup.style.display = '';
    acProviderLabel.textContent   = 'Versicherer';
    acProviderInput.placeholder   = 'z.B. Continentale';
    acNameText.placeholder        = 'z.B. Hausratversicherung';
  } else if (acCategory.value === 'subscription') {
    acNameSelectGrp.style.display = 'none';
    acNameTextGrp.style.display   = '';
    acProviderGroup.style.display = 'none';
    acNameText.placeholder        = 'z.B. Netflix, Spotify, Amazon Prime';
  } else {
    acNameSelectGrp.style.display = 'none';
    acNameTextGrp.style.display   = '';
    acProviderGroup.style.display = '';
    acProviderLabel.textContent   = 'Anbieter';
    acProviderInput.placeholder   = 'Vertragspartner / Anbieter';
    acNameText.placeholder        = 'z.B. Strom, Handy, Gym';
  }
  acExtraFields.innerHTML = '';
});

acNameSelect.addEventListener('change', () => {
  const val = acNameSelect.value;
  if (val === '__custom__') {
    acNameCustom.style.display = '';
    acNameCustom.focus();
  } else {
    acNameCustom.style.display = 'none';
    acNameCustom.value = '';
  }
  renderExtraFields(val === '__custom__' ? '' : val, acExtraFields, 'ac');
});

function getAcFormName() {
  if (acCategory.value === 'insurance') {
    return acNameSelect.value === '__custom__' ? acNameCustom.value.trim() : acNameSelect.value;
  }
  return acNameText.value.trim();
}

function getAcInsuranceType() {
  if (acCategory.value !== 'insurance') return '';
  return acNameSelect.value === '__custom__' ? '' : acNameSelect.value;
}

// ── Vertrag für Kunden hinzufügen ─────────────────────────────────────────────
document.getElementById('addContractForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('addContractAlert');
  alertEl.classList.add('hidden');

  const name = getAcFormName();
  if (!name) {
    alertEl.textContent = 'Bitte Versicherungsart / Namen angeben.';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
    return;
  }

  const insuranceType = getAcInsuranceType();
  const details = insuranceType ? collectExtraFields(insuranceType, 'ac') : {};

  const acCat = acCategory.value;
  const acProviderVal = acCat === 'subscription'
    ? name
    : document.getElementById('acProvider').value;

  const body = {
    user_id:        document.getElementById('acCustomer').value,
    category:       acCat,
    name,
    provider:       acProviderVal,
    premium_amount: document.getElementById('acAmount').value,
    premium_cycle:  document.getElementById('acCycle').value,
    start_date:     document.getElementById('acStartDate').value,
    end_date:       document.getElementById('acEndDate').value,
    description:    document.getElementById('acDescription').value,
    details
  };

  const res  = await fetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();

  if (!res.ok) {
    alertEl.textContent = data.error || 'Fehler beim Hinzufügen';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
    return;
  }

  alertEl.textContent = 'Vertrag erfolgreich hinzugefügt!';
  alertEl.className = 'alert alert-success';
  alertEl.classList.remove('hidden');
  document.getElementById('addContractForm').reset();
  acExtraFields.innerHTML = '';
  acNameSelectGrp.style.display = 'none';
  acNameTextGrp.style.display   = '';
  await loadCustomers();
});

// ── Kundenprofil Modal ────────────────────────────────────────────────────────
const detailModal = document.getElementById('customerDetailModal');
let currentCrmUserId = null;

// Inner-Tab-Switching
document.querySelectorAll('.modal-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('mtab-' + btn.dataset.mtab).classList.remove('hidden');
    if (btn.dataset.mtab === 'stammdaten')    loadCustomerProfile(currentCrmUserId);
    if (btn.dataset.mtab === 'messages')      loadCustomerMessages(currentCrmUserId);
    if (btn.dataset.mtab === 'tasks')         loadTasks(currentCrmUserId);
    if (btn.dataset.mtab === 'consultations') loadConsultations(currentCrmUserId);
    if (btn.dataset.mtab === 'empfehlungen')  loadEmpfehlungen(currentCrmUserId);
  });
});

async function openCustomerDetail(customer) {
  currentCrmUserId = customer.id;
  document.getElementById('customerDetailTitle').textContent = customer.full_name;

  // Inner-Tabs auf "contracts" zurücksetzen
  document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mtab === 'contracts'));
  document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'mtab-contracts'));

  // Verträge laden
  const list = document.getElementById('viewContractsList');
  list.innerHTML = '<div class="text-muted" style="padding:16px">Lade…</div>';
  detailModal.classList.remove('hidden');

  const contractList = await fetch(`/api/admin/contracts/${customer.id}`).then(r => r.json()).catch(() => []);
  list.innerHTML = '';

  if (contractList.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>Keine Verträge vorhanden</p></div>';
  } else {
    contractList.forEach(c => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:14px 0;border-bottom:1px solid var(--light-gray);display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

      const left = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.style.fontWeight = 'bold';
      nameEl.textContent = c.name;
      const metaEl = document.createElement('div');
      metaEl.style.marginTop = '4px';
      metaEl.innerHTML = `<span class="badge ${c.category === 'insurance' ? 'badge-insurance' : c.category === 'subscription' ? 'badge-subscription' : 'badge-other'}">${CAT_LABEL[c.category] || c.category}</span>`;
      if (c.provider) {
        const pr = document.createElement('span');
        pr.className = 'text-muted';
        pr.style.marginLeft = '8px';
        pr.textContent = c.provider;
        metaEl.appendChild(pr);
      }
      left.appendChild(nameEl);
      left.appendChild(metaEl);

      // Scan-Anhang
      const scanArea = document.createElement('div');
      scanArea.style.marginTop = '8px';
      if (c.scan_image) {
        const img = document.createElement('img');
        img.src = `/uploads/contracts/${c.scan_image}`;
        img.style.cssText = 'max-width:110px;max-height:70px;border-radius:4px;cursor:pointer;border:1px solid var(--light-gray);vertical-align:middle;';
        img.title = 'Zum Vergrößern klicken';
        img.addEventListener('click', () => window.open(`/uploads/contracts/${c.scan_image}`, '_blank'));
        scanArea.appendChild(img);
        const replLabel = document.createElement('label');
        replLabel.className = 'btn btn-sm btn-secondary';
        replLabel.style.cssText = 'margin-left:6px;cursor:pointer;font-size:11px;';
        replLabel.innerHTML = '🔄 Ersetzen<input type="file" accept="image/jpeg,image/png,image/webp" style="display:none">';
        replLabel.querySelector('input').addEventListener('change', async e => {
          if (!e.target.files[0]) return;
          const fd = new FormData(); fd.append('image', e.target.files[0]);
          const r = await fetch(`/api/admin/contracts/${c._id}/scan`, { method: 'POST', body: fd });
          if (r.ok) openCustomerDetail(customer);
        });
        scanArea.appendChild(replLabel);
      } else {
        const uplLabel = document.createElement('label');
        uplLabel.className = 'btn btn-sm btn-secondary';
        uplLabel.style.cssText = 'cursor:pointer;font-size:11px;';
        uplLabel.innerHTML = '📷 Scan hochladen<input type="file" accept="image/jpeg,image/png,image/webp" style="display:none">';
        uplLabel.querySelector('input').addEventListener('change', async e => {
          if (!e.target.files[0]) return;
          const fd = new FormData(); fd.append('image', e.target.files[0]);
          const r = await fetch(`/api/admin/contracts/${c._id}/scan`, { method: 'POST', body: fd });
          if (r.ok) openCustomerDetail(customer);
        });
        scanArea.appendChild(uplLabel);
      }
      left.appendChild(scanArea);

      const right = document.createElement('div');
      right.style.textAlign = 'right';
      const amtEl = document.createElement('div');
      amtEl.style.cssText = 'font-weight:bold;color:var(--primary)';
      amtEl.textContent = fmt(c.premium_amount);
      const cycleEl = document.createElement('div');
      cycleEl.className = 'text-muted';
      cycleEl.textContent = CYCLE_LABEL[c.premium_cycle] || '';

      const actEl = document.createElement('div');
      actEl.style.marginTop = '6px';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-danger';
      delBtn.textContent = '🗑️ Löschen';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Vertrag "${c.name}" löschen?`)) return;
        const res = await fetch(`/api/admin/contracts/${c._id}`, { method: 'DELETE' });
        if (res.ok) {
          row.remove();
          await loadCustomers();
        }
      });
      actEl.appendChild(delBtn);

      right.appendChild(amtEl);
      right.appendChild(cycleEl);
      right.appendChild(actEl);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });
  }

  // CRM-Daten im Hintergrund laden
  await loadCrmData(customer.id);
}

async function loadCrmData(userId) {
  const data = await fetch(`/api/admin/crm/${userId}`).then(r => r.json()).catch(() => null);
  if (!data) return;

  const { record, log } = data;

  document.getElementById('crmStatus').value       = record.status || '';
  document.getElementById('crmWiedervorlage').value = record.wiedervorlage || '';
  document.getElementById('crmNotes').value         = record.notes || '';

  const logContainer = document.getElementById('activityLogList');
  if (log.length === 0) {
    logContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Noch keine Aktivitäten</p></div>';
    return;
  }
  logContainer.innerHTML = '';
  log.forEach(entry => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--light-gray);display:flex;justify-content:space-between;gap:12px;font-size:14px;';
    const desc = document.createElement('span');
    desc.textContent = entry.description;
    const date = document.createElement('span');
    date.className = 'text-muted';
    date.style.whiteSpace = 'nowrap';
    date.textContent = formatDate(entry.created_at);
    div.appendChild(desc);
    div.appendChild(date);
    logContainer.appendChild(div);
  });
}

document.getElementById('crmSaveBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('crmAlert');
  alertEl.classList.add('hidden');

  const body = {
    status:        document.getElementById('crmStatus').value,
    wiedervorlage: document.getElementById('crmWiedervorlage').value,
    notes:         document.getElementById('crmNotes').value
  };

  const res = await fetch(`/api/admin/crm/${currentCrmUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    alertEl.textContent = 'Gespeichert';
    alertEl.className = 'alert alert-success';
    alertEl.classList.remove('hidden');
    await loadCustomers();
    setTimeout(() => alertEl.classList.add('hidden'), 2000);
  } else {
    alertEl.textContent = 'Fehler beim Speichern';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

function closeDetailModal() { detailModal.classList.add('hidden'); }
document.getElementById('customerDetailClose').addEventListener('click', closeDetailModal);
document.getElementById('customerDetailCancel').addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', e => { if (e.target === detailModal) closeDetailModal(); });

// ── Wiedervorlagen-Übersicht ──────────────────────────────────────────────────
async function loadWiedervorlagen() {
  const container = document.getElementById('wiedervorlageList');
  const all = await fetch('/api/admin/customers').then(r => r.json()).catch(() => []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const due = all.filter(c => {
    if (!c.wiedervorlage) return false;
    const wv = new Date(c.wiedervorlage);
    return wv >= today && wv <= cutoff;
  }).sort((a, b) => new Date(a.wiedervorlage) - new Date(b.wiedervorlage));

  if (due.length === 0) {
    container.innerHTML = '<div class="text-muted" style="padding:12px 0">Keine anstehenden Wiedervorlagen in den nächsten 14 Tagen</div>';
    return;
  }

  container.innerHTML = '';
  due.forEach(c => {
    const wv   = new Date(c.wiedervorlage);
    const diff = Math.round((wv - today) / (1000 * 60 * 60 * 24));
    const row  = document.createElement('div');
    row.style.cssText = 'padding:12px 0;border-bottom:1px solid var(--light-gray);display:flex;justify-content:space-between;align-items:center;gap:12px;';

    const left = document.createElement('div');
    left.innerHTML = `<span style="font-weight:600">${c.full_name}</span><span class="text-muted" style="margin-left:8px;font-size:13px">${c.email}</span>`;

    const right = document.createElement('div');
    right.style.cssText = 'text-align:right;font-size:13px;';
    const color = diff <= 2 ? '#c2410c' : '#d97706';
    right.innerHTML = `<span style="color:${color};font-weight:600">⏰ ${wv.toLocaleDateString('de-DE')}</span><br><span class="text-muted">in ${diff} Tag${diff === 1 ? '' : 'en'}</span>`;

    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-secondary';
    btn.textContent = '👤 Profil';
    btn.style.marginLeft = '12px';
    btn.addEventListener('click', () => openCustomerDetail(c));

    row.appendChild(left);
    row.appendChild(right);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

// ── Nachrichten laden (nach Kunden gruppiert) ──────────────────────────────────
async function loadMessages() {
  const msgs = await fetch('/api/admin/messages').then(r => r.json()).catch(() => []);
  const unread = msgs.filter(m => m.status === 'new').length;
  const badge = document.getElementById('unreadBadge');
  if (unread > 0) {
    badge.textContent = unread;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const list  = document.getElementById('messagesList');
  const empty = document.getElementById('messagesEmpty');
  list.innerHTML = '';

  if (msgs.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  // Nach Kunden gruppieren
  const groups = {};
  msgs.forEach(m => {
    if (!groups[m.user_id]) groups[m.user_id] = { name: m.customer_name, msgs: [] };
    groups[m.user_id].msgs.push(m);
  });

  Object.entries(groups).forEach(([userId, group]) => {
    // Kunden-Header
    const groupHeader = document.createElement('div');
    groupHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:16px 0 4px;padding:10px 12px;background:var(--light-gray);border-radius:8px;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px;';
    nameEl.textContent = group.name;
    const unreadCount = group.msgs.filter(m => m.status === 'new').length;
    if (unreadCount > 0) {
      const nb = document.createElement('span');
      nb.className = 'tab-badge';
      nb.style.cssText = 'display:inline-block;min-width:18px;text-align:center;';
      nb.textContent = unreadCount;
      nameEl.appendChild(nb);
    }

    const profileBtn = document.createElement('button');
    profileBtn.className = 'btn btn-sm btn-secondary';
    profileBtn.textContent = '👤 Zum Kunden';
    profileBtn.addEventListener('click', () => openCustomerDetail({ id: userId, full_name: group.name }));

    groupHeader.appendChild(nameEl);
    groupHeader.appendChild(profileBtn);
    list.appendChild(groupHeader);

    // Nachrichten dieses Kunden
    group.msgs.forEach(m => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:12px 0 12px 12px;border-bottom:1px solid var(--light-gray);border-left:3px solid ' + (m.status === 'new' ? 'var(--primary)' : 'transparent') + ';';

      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:6px;';

      const left = document.createElement('div');
      const subjectEl = document.createElement('div');
      subjectEl.style.fontWeight = 'bold';
      subjectEl.textContent = m.subject;
      const metaEl = document.createElement('div');
      metaEl.className = 'text-muted';
      metaEl.style.fontSize = '13px';
      metaEl.textContent = formatDate(m.created_at);
      left.appendChild(subjectEl);
      left.appendChild(metaEl);

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;gap:6px;align-items:center;';
      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge ' + (m.request_type === 'callback' ? 'badge-callback' : 'badge-insurance');
      typeBadge.textContent = m.request_type === 'callback' ? 'Rückruf' : 'Nachricht';
      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge ' + (m.status === 'new' ? 'badge-new' : 'badge-read');
      statusBadge.textContent = m.status === 'new' ? 'Neu' : 'Gelesen';
      right.appendChild(typeBadge);
      right.appendChild(statusBadge);

      headerRow.appendChild(left);
      headerRow.appendChild(right);

      const bodyEl = document.createElement('div');
      bodyEl.style.cssText = 'font-size:14px;color:var(--text);margin:6px 0;white-space:pre-wrap;';
      bodyEl.textContent = m.message;

      div.appendChild(headerRow);
      div.appendChild(bodyEl);

      if (m.callback_time) {
        const cb = document.createElement('div');
        cb.className = 'text-muted';
        cb.style.fontSize = '13px';
        cb.textContent = '📞 Gewünschter Rückrufzeitraum: ' + m.callback_time;
        div.appendChild(cb);
      }

      if (m.status === 'new') {
        const readBtn = document.createElement('button');
        readBtn.className = 'btn btn-sm btn-secondary';
        readBtn.style.marginTop = '8px';
        readBtn.textContent = '✓ Als gelesen markieren';
        readBtn.addEventListener('click', async () => {
          await fetch(`/api/admin/messages/${m._id}/read`, { method: 'PATCH' });
          await loadMessages();
        });
        div.appendChild(readBtn);
      }

      list.appendChild(div);
    });
  });
}

// ── Einstellungen ─────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
  document.getElementById('sAgencyName').value = s.agency_name   || '';
  document.getElementById('sAddress').value    = s.address       || '';
  document.getElementById('sPhone').value      = s.phone         || '';
  document.getElementById('sEmail').value      = s.email         || '';
  document.getElementById('sHours').value      = s.opening_hours || '';
  document.getElementById('sWhatsapp').value   = s.whatsapp      || '';
}

document.getElementById('settingsForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('settingsAlert');
  alertEl.classList.add('hidden');

  const body = {
    agency_name:   document.getElementById('sAgencyName').value,
    address:       document.getElementById('sAddress').value,
    phone:         document.getElementById('sPhone').value,
    email:         document.getElementById('sEmail').value,
    opening_hours: document.getElementById('sHours').value,
    whatsapp:      document.getElementById('sWhatsapp').value
  };

  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    alertEl.textContent = 'Einstellungen gespeichert!';
    alertEl.className = 'alert alert-success';
    alertEl.classList.remove('hidden');
    // Header-Name sofort aktualisieren
    document.querySelectorAll('.sidebar-company').forEach(el => { if (body.agency_name) el.textContent = body.agency_name; });
    setTimeout(() => alertEl.classList.add('hidden'), 3000);
  } else {
    const errData = await res.json().catch(() => ({}));
    alertEl.textContent = errData.error || 'Fehler beim Speichern';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

// ── Hilfsfunktion: Tage bis Geburtstag ───────────────────────────────────────
function upcomingBirthdayDays(birthdayStr) {
  if (!birthdayStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bd = new Date(birthdayStr);
  let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
  const diff = Math.round((next - today) / (1000 * 60 * 60 * 24));
  return diff <= 14 ? diff : null;
}

// ── Nachrichten eines Kunden laden ────────────────────────────────────────────
async function loadCustomerMessages(userId) {
  const container = document.getElementById('customerMessagesList');
  container.innerHTML = '<div class="text-muted" style="padding:16px">Lade…</div>';
  const msgs = await fetch(`/api/admin/messages/${userId}`).then(r => r.json()).catch(() => []);
  container.innerHTML = '';

  if (msgs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Keine Nachrichten</p></div>';
    return;
  }

  msgs.forEach(m => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:14px 0;border-bottom:1px solid var(--light-gray);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px;flex-wrap:wrap;';

    const subjectEl = document.createElement('span');
    subjectEl.style.fontWeight = 'bold';
    subjectEl.textContent = m.subject;

    const rightEl = document.createElement('div');
    rightEl.style.cssText = 'display:flex;gap:6px;align-items:center;';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'badge ' + (m.request_type === 'callback' ? 'badge-callback' : 'badge-insurance');
    typeBadge.textContent = m.request_type === 'callback' ? 'Rückruf' : 'Nachricht';

    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + (m.status === 'new' ? 'badge-new' : 'badge-read');
    statusBadge.textContent = m.status === 'new' ? 'Neu' : 'Gelesen';

    rightEl.appendChild(typeBadge);
    rightEl.appendChild(statusBadge);
    header.appendChild(subjectEl);
    header.appendChild(rightEl);

    const dateEl = document.createElement('div');
    dateEl.className = 'text-muted';
    dateEl.style.fontSize = '12px';
    dateEl.textContent = formatDate(m.created_at);

    const bodyEl = document.createElement('div');
    bodyEl.style.cssText = 'font-size:14px;margin:8px 0;white-space:pre-wrap;';
    bodyEl.textContent = m.message;

    div.appendChild(header);
    div.appendChild(dateEl);
    div.appendChild(bodyEl);

    if (m.callback_time) {
      const cb = document.createElement('div');
      cb.className = 'text-muted';
      cb.style.fontSize = '13px';
      cb.textContent = '📞 Gewünschter Rückrufzeitraum: ' + m.callback_time;
      div.appendChild(cb);
    }

    if (m.status === 'new') {
      const readBtn = document.createElement('button');
      readBtn.className = 'btn btn-sm btn-secondary';
      readBtn.style.marginTop = '6px';
      readBtn.textContent = '✓ Als gelesen markieren';
      readBtn.addEventListener('click', async () => {
        await fetch(`/api/admin/messages/${m._id}/read`, { method: 'PATCH' });
        await Promise.all([loadCustomerMessages(userId), loadMessages()]);
      });
      div.appendChild(readBtn);
    }

    container.appendChild(div);
  });
}

// ── Aufgaben laden ────────────────────────────────────────────────────────────
async function loadTasks(userId) {
  const container = document.getElementById('tasksList');
  container.innerHTML = '<div class="text-muted" style="padding:8px">Lade…</div>';
  const list = await fetch(`/api/admin/tasks/${userId}`).then(r => r.json()).catch(() => []);
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Keine Aufgaben</p></div>';
    return;
  }

  list.forEach(t => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date(t.due_date); due.setHours(0, 0, 0, 0);
    const overdue = t.status === 'offen' && due < today;

    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--light-gray);display:flex;justify-content:space-between;align-items:center;gap:8px;';
    if (t.status === 'erledigt') row.style.opacity = '0.5';

    const left = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight:600;' + (t.status === 'erledigt' ? 'text-decoration:line-through;' : '');
    titleEl.textContent = t.title;

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:12px;margin-top:3px;';
    const dueTxt = overdue
      ? `<span style="color:var(--danger);font-weight:700">⚠ Überfällig: ${formatDate(t.due_date)}</span>`
      : `<span class="text-muted">Fällig: ${formatDate(t.due_date)}</span>`;
    metaEl.innerHTML = dueTxt + ` <span class="badge badge-priority-${t.priority}" style="margin-left:6px">${t.priority}</span>`;

    left.appendChild(titleEl);
    left.appendChild(metaEl);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-sm btn-secondary';
    toggleBtn.textContent = t.status === 'offen' ? '✓ Erledigt' : '↩ Öffnen';
    toggleBtn.addEventListener('click', async () => {
      await fetch(`/api/admin/tasks/${t._id}/toggle`, { method: 'PATCH' });
      await loadTasks(userId);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Aufgabe löschen?')) return;
      await fetch(`/api/admin/tasks/${t._id}`, { method: 'DELETE' });
      await loadTasks(userId);
    });

    right.appendChild(toggleBtn);
    right.appendChild(delBtn);
    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

document.getElementById('taskAddBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('taskAlert');
  alertEl.classList.add('hidden');
  const title    = document.getElementById('taskTitle').value.trim();
  const due_date = document.getElementById('taskDueDate').value;
  const priority = document.getElementById('taskPriority').value;
  if (!title || !due_date) {
    alertEl.textContent = 'Bitte Aufgabe und Fälligkeitsdatum angeben.';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
    return;
  }
  const res = await fetch(`/api/admin/tasks/${currentCrmUserId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, due_date, priority })
  });
  if (res.ok) {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDueDate').value = '';
    await loadTasks(currentCrmUserId);
  } else {
    const data = await res.json();
    alertEl.textContent = data.error || 'Fehler';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

// ── Beratungsprotokolle laden ─────────────────────────────────────────────────
async function loadConsultations(userId) {
  const container = document.getElementById('consultationsList');
  container.innerHTML = '<div class="text-muted" style="padding:8px">Lade…</div>';
  const list = await fetch(`/api/admin/consultations/${userId}`).then(r => r.json()).catch(() => []);
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Noch keine Protokolle</p></div>';
    return;
  }

  list.forEach(entry => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:14px;border:1px solid var(--light-gray);border-radius:6px;margin-bottom:10px;';

    const headEl = document.createElement('div');
    headEl.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
    const titleEl = document.createElement('span');
    titleEl.style.fontWeight = 'bold';
    titleEl.textContent = entry.subject;
    const dateEl = document.createElement('span');
    dateEl.className = 'text-muted';
    dateEl.style.fontSize = '12px';
    dateEl.textContent = formatDate(entry.date);
    headEl.appendChild(titleEl);
    headEl.appendChild(dateEl);

    const bodyEl = document.createElement('div');
    bodyEl.style.fontSize = '13px';
    if (entry.result) {
      const rEl = document.createElement('div');
      rEl.innerHTML = `<strong>Ergebnis:</strong> ${entry.result}`;
      bodyEl.appendChild(rEl);
    }
    if (entry.next_step) {
      const nEl = document.createElement('div');
      nEl.style.marginTop = '4px';
      nEl.innerHTML = `<strong>Nächster Schritt:</strong> ${entry.next_step}`;
      bodyEl.appendChild(nEl);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.style.marginTop = '8px';
    delBtn.textContent = '🗑️ Löschen';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Protokoll löschen?')) return;
      await fetch(`/api/admin/consultations/${entry._id}`, { method: 'DELETE' });
      await loadConsultations(userId);
    });

    card.appendChild(headEl);
    card.appendChild(bodyEl);
    card.appendChild(delBtn);
    container.appendChild(card);
  });
}

document.getElementById('consultationSaveBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('consultationAlert');
  alertEl.classList.add('hidden');
  const date      = document.getElementById('conDate').value;
  const subject   = document.getElementById('conSubject').value.trim();
  const result    = document.getElementById('conResult').value.trim();
  const next_step = document.getElementById('conNextStep').value.trim();

  if (!date || !subject) {
    alertEl.textContent = 'Datum und Betreff sind erforderlich.';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
    return;
  }

  const res = await fetch(`/api/admin/consultations/${currentCrmUserId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, subject, result, next_step })
  });

  if (res.ok) {
    document.getElementById('conDate').value = '';
    document.getElementById('conSubject').value = '';
    document.getElementById('conResult').value = '';
    document.getElementById('conNextStep').value = '';
    await loadConsultations(currentCrmUserId);
  } else {
    const data = await res.json();
    alertEl.textContent = data.error || 'Fehler';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

// ── CRM-Tab: Geburtstage ──────────────────────────────────────────────────────
function loadBirthdays() {
  const container = document.getElementById('birthdayList');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const upcoming = customers
    .filter(c => c.birthday)
    .map(c => {
      const bd = new Date(c.birthday);
      let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
      const daysUntil = Math.round((next - today) / (1000 * 60 * 60 * 24));
      return { ...c, nextBirthday: next, daysUntil };
    })
    .filter(c => c.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcoming.length === 0) {
    container.innerHTML = '<div class="text-muted" style="padding:12px 0">Keine Geburtstage in den nächsten 14 Tagen</div>';
    return;
  }

  container.innerHTML = '';
  upcoming.forEach(c => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--light-gray);display:flex;justify-content:space-between;align-items:center;gap:12px;';
    const label = c.daysUntil === 0 ? '🎂 Heute!' : `in ${c.daysUntil} Tag${c.daysUntil === 1 ? '' : 'en'}`;

    const left = document.createElement('div');
    left.innerHTML = `<span style="font-weight:600">${c.full_name}</span> <span class="text-muted" style="font-size:13px">${c.nextBirthday.toLocaleDateString('de-DE')}</span>`;

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const dayLabel = document.createElement('span');
    dayLabel.style.cssText = 'color:var(--primary);font-weight:700;font-size:13px;';
    dayLabel.textContent = label;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-secondary';
    btn.textContent = '👤 Profil';
    btn.addEventListener('click', () => openCustomerDetail(c));
    right.appendChild(dayLabel);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

// ── CRM-Tab: Aufgaben-Übersicht ───────────────────────────────────────────────
async function loadTasksOverview() {
  const overdueEl  = document.getElementById('crmTasksOverdue');
  const dueWeekEl  = document.getElementById('crmTasksDueWeek');
  overdueEl.innerHTML = '';
  dueWeekEl.innerHTML = '';

  const data = await fetch('/api/admin/tasks-overview').then(r => r.json()).catch(() => ({ overdue: [], dueThisWeek: [] }));

  if (data.overdue.length > 0) {
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;color:var(--danger);margin:12px 0 6px';
    h.textContent = `⚠ Überfällig (${data.overdue.length})`;
    overdueEl.appendChild(h);
    data.overdue.forEach(t => overdueEl.appendChild(buildTaskOverviewRow(t)));
  }

  if (data.dueThisWeek.length > 0) {
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;color:var(--warning);margin:12px 0 6px';
    h.textContent = `📅 Fällig diese Woche (${data.dueThisWeek.length})`;
    dueWeekEl.appendChild(h);
    data.dueThisWeek.forEach(t => dueWeekEl.appendChild(buildTaskOverviewRow(t)));
  }

  if (data.overdue.length === 0 && data.dueThisWeek.length === 0) {
    overdueEl.innerHTML = '<div class="text-muted" style="padding:12px 0">Keine offenen oder überfälligen Aufgaben diese Woche</div>';
  }
}

function buildTaskOverviewRow(t) {
  const row = document.createElement('div');
  row.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--light-gray);display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;cursor:pointer;';
  row.title = 'Zum Kunden & Aufgaben öffnen';

  row.addEventListener('click', () => {
    openCustomerDetail({ id: t.user_id, full_name: t.customer_name });
    // Nach dem synchronen Teil von openCustomerDetail zum Aufgaben-Tab wechseln
    document.querySelector('.modal-tab-btn[data-mtab="tasks"]').click();
  });

  const left = document.createElement('div');
  left.innerHTML = `<span style="font-weight:600">${t.title}</span> <span class="text-muted">· ${t.customer_name}</span>`;

  const right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
  right.innerHTML = `<span class="badge badge-priority-${t.priority}">${t.priority}</span><span class="text-muted">${formatDate(t.due_date)}</span>`;

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

// ── Stammdaten laden / speichern ──────────────────────────────────────────────
async function loadCustomerProfile(userId) {
  const alertEl = document.getElementById('stammdatenAlert');
  alertEl.classList.add('hidden');

  const data = await fetch(`/api/admin/customers/${userId}/profile`).then(r => r.json()).catch(() => null);
  if (!data) return;

  document.getElementById('sdName').value             = data.full_name || '';
  document.getElementById('sdEmail').value            = data.email || '';
  document.getElementById('sdPhone').value            = data.phone || '';
  document.getElementById('sdMobile').value           = data.mobile || '';
  document.getElementById('sdBirthDate').value        = data.birth_date || '';
  document.getElementById('sdMaritalStatus').value    = data.marital_status || '';
  document.getElementById('sdSpouseName').value       = data.spouse_name || '';
  document.getElementById('sdHealthInsType').value    = data.health_insurance_type || '';
  document.getElementById('sdHealthInsProvider').value = data.health_insurance_provider || '';
  document.getElementById('sdGrossIncome').value      = data.gross_income || '';
  document.getElementById('sdNetIncome').value        = data.net_income || '';
  document.getElementById('sdBeruf').value            = data.beruf || '';
  document.getElementById('sdBerufsgruppe').value     = data.berufsgruppe || '';
  document.getElementById('sdWohneigentum').value     = data.wohneigentum || '';
}

document.getElementById('stammdatenSaveBtn').addEventListener('click', async () => {
  const alertEl = document.getElementById('stammdatenAlert');
  alertEl.classList.add('hidden');

  const body = {
    full_name:               document.getElementById('sdName').value,
    email:                   document.getElementById('sdEmail').value,
    phone:                   document.getElementById('sdPhone').value,
    mobile:                  document.getElementById('sdMobile').value,
    birth_date:              document.getElementById('sdBirthDate').value,
    marital_status:          document.getElementById('sdMaritalStatus').value,
    spouse_name:             document.getElementById('sdSpouseName').value,
    health_insurance_type:   document.getElementById('sdHealthInsType').value,
    health_insurance_provider: document.getElementById('sdHealthInsProvider').value,
    gross_income:            document.getElementById('sdGrossIncome').value,
    net_income:              document.getElementById('sdNetIncome').value,
    beruf:                   document.getElementById('sdBeruf').value,
    berufsgruppe:            document.getElementById('sdBerufsgruppe').value,
    wohneigentum:            document.getElementById('sdWohneigentum').value
  };

  const res = await fetch(`/api/admin/customers/${currentCrmUserId}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    alertEl.textContent = 'Stammdaten gespeichert';
    alertEl.className = 'alert alert-success';
    alertEl.classList.remove('hidden');
    await loadCustomers();
    setTimeout(() => alertEl.classList.add('hidden'), 2000);
  } else {
    const data = await res.json();
    alertEl.textContent = data.error || 'Fehler beim Speichern';
    alertEl.className = 'alert alert-error';
    alertEl.classList.remove('hidden');
  }
});

// ── Kalender ──────────────────────────────────────────────────────────────────
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_DE   = ['Mo','Di','Mi','Do','Fr','Sa','So'];
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calAppointments = [];

async function loadCalendar() {
  const ym = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  calAppointments = await fetch(`/api/admin/appointments?month=${ym}`).then(r => r.json()).catch(() => []);
  renderCalendar();
}

function renderCalendar() {
  document.getElementById('calMonthTitle').textContent = `${MONTHS_DE[calMonth]} ${calYear}`;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // Wochentag-Header
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px;';
  DAYS_DE.forEach(d => {
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;font-size:11px;font-weight:600;color:var(--text-muted);padding:4px 0;text-transform:uppercase;';
    cell.textContent = d;
    headerRow.appendChild(cell);
  });
  grid.appendChild(headerRow);

  // Tage-Grid
  const daysGrid = document.createElement('div');
  daysGrid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;';

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1; // Mo=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < offset; i++) daysGrid.appendChild(document.createElement('div'));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayAppts = calAppointments.filter(a => a.date === dateStr);
    const isToday  = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;

    const cell = document.createElement('div');
    cell.style.cssText = `border-radius:8px;padding:5px 4px;min-height:54px;cursor:pointer;border:2px solid ${isToday ? 'var(--primary)' : 'transparent'};background:${isToday ? '#eff6ff' : 'var(--light-gray)'};`;

    const dayNum = document.createElement('div');
    dayNum.style.cssText = `font-size:13px;font-weight:${isToday ? '700' : '400'};text-align:center;margin-bottom:3px;color:${isToday ? 'var(--primary)' : 'inherit'};`;
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    dayAppts.slice(0, 3).forEach(a => {
      const chip = document.createElement('div');
      chip.style.cssText = 'font-size:10px;background:var(--primary);color:white;border-radius:3px;padding:1px 4px;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
      chip.textContent = (a.time ? a.time + ' ' : '') + a.title;
      cell.appendChild(chip);
    });
    if (dayAppts.length > 3) {
      const more = document.createElement('div');
      more.style.cssText = 'font-size:10px;color:var(--text-muted);text-align:center;margin-top:1px;';
      more.textContent = `+${dayAppts.length - 3} mehr`;
      cell.appendChild(more);
    }

    cell.addEventListener('mouseenter', () => { cell.style.background = isToday ? '#dbeafe' : '#e2e8f0'; });
    cell.addEventListener('mouseleave', () => { cell.style.background = isToday ? '#eff6ff' : 'var(--light-gray)'; });
    cell.addEventListener('click', () => {
      document.getElementById('calDate').value = dateStr;
      renderCalDayDetail(dateStr);
    });

    daysGrid.appendChild(cell);
  }

  grid.appendChild(daysGrid);
  document.getElementById('calDayDetail').innerHTML = '';
}

function renderCalDayDetail(dateStr) {
  const el    = document.getElementById('calDayDetail');
  const appts = calAppointments.filter(a => a.date === dateStr);
  const [y, m, d] = dateStr.split('-');
  const label = `${parseInt(d)}. ${MONTHS_DE[parseInt(m) - 1]} ${y}`;

  if (appts.length === 0) {
    el.innerHTML = `<div class="text-muted" style="font-size:13px;padding:8px 0;">Keine Termine am ${label}</div>`;
    return;
  }

  el.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:8px;">Termine am ${label}</div>`;
  appts.forEach(a => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 10px;border-left:3px solid var(--primary);background:var(--light-gray);border-radius:0 6px 6px 0;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;';

    const info = document.createElement('div');
    info.style.minWidth = '0';
    let html = `<div style="font-weight:600;font-size:13px;">${a.time ? a.time + ' Uhr — ' : ''}${a.title}</div>`;
    if (a.customer_name) html += `<div class="text-muted" style="font-size:12px;">👤 ${a.customer_name}</div>`;
    if (a.notes)         html += `<div class="text-muted" style="font-size:12px;margin-top:2px;">${a.notes}</div>`;
    info.innerHTML = html;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.style.cssText = 'font-size:11px;padding:2px 8px;flex-shrink:0;';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Termin löschen?')) return;
      await fetch(`/api/admin/appointments/${a._id}`, { method: 'DELETE' });
      await loadCalendar();
      renderCalDayDetail(dateStr);
    });

    row.appendChild(info);
    row.appendChild(delBtn);
    el.appendChild(row);
  });
}

// Kunden-Suchfeld im Kalender-Formular
document.getElementById('calCustomerSearch').addEventListener('input', function () {
  const q        = this.value.toLowerCase().trim();
  const dropdown = document.getElementById('calCustomerDropdown');
  dropdown.innerHTML = '';
  document.getElementById('calCustomerId').value = '';
  document.getElementById('calCustomerSelected').textContent = '';

  if (!q) { dropdown.classList.add('hidden'); return; }

  const matches = customers.filter(c =>
    c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  ).slice(0, 6);

  if (matches.length === 0) { dropdown.classList.add('hidden'); return; }

  matches.forEach(c => {
    const item = document.createElement('div');
    item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--light-gray);';
    item.innerHTML = `<span style="font-weight:600;">${c.full_name}</span> <span class="text-muted" style="font-size:12px;">${c.email}</span>`;
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--light-gray)'; });
    item.addEventListener('mouseleave', () => { item.style.background = ''; });
    item.addEventListener('click', () => {
      document.getElementById('calCustomerId').value = c.id;
      document.getElementById('calCustomerSearch').value = c.full_name;
      document.getElementById('calCustomerSelected').textContent = '✓ ' + c.full_name + ' ausgewählt';
      dropdown.classList.add('hidden');
    });
    dropdown.appendChild(item);
  });
  dropdown.classList.remove('hidden');
});

document.addEventListener('click', e => {
  if (!e.target.closest('#calCustomerSearch') && !e.target.closest('#calCustomerDropdown')) {
    document.getElementById('calCustomerDropdown').classList.add('hidden');
  }
});

document.getElementById('calForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('calFormAlert');
  const title  = document.getElementById('calTitle').value.trim();
  const date   = document.getElementById('calDate').value;
  const time   = document.getElementById('calTime').value;
  const notes  = document.getElementById('calNotes').value.trim();
  const userId = document.getElementById('calCustomerId').value;

  const res = await fetch('/api/admin/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, time, user_id: userId || null, notes })
  });

  if (res.ok) {
    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Termin gespeichert!';
    alertEl.classList.remove('hidden');
    document.getElementById('calForm').reset();
    document.getElementById('calCustomerId').value = '';
    document.getElementById('calCustomerSelected').textContent = '';
    const [y, m] = date.split('-');
    calYear = parseInt(y); calMonth = parseInt(m) - 1;
    await loadCalendar();
    renderCalDayDetail(date);
    setTimeout(() => alertEl.classList.add('hidden'), 3000);
  } else {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Fehler beim Speichern.';
    alertEl.classList.remove('hidden');
  }
});

document.getElementById('calPrevBtn').addEventListener('click', () => {
  if (--calMonth < 0) { calMonth = 11; calYear--; }
  loadCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
  if (++calMonth > 11) { calMonth = 0; calYear++; }
  loadCalendar();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { window.location.href = 'dashboard.html'; return; }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  await Promise.all([loadCustomers(), loadMessages()]);
}

// ── Admin-Account Verwaltung ───────────────────────────────────────────────────
async function loadAdmins() {
  const admins = await fetch('/api/admin/admins').then(r => r.json()).catch(() => []);
  const tbody = document.getElementById('adminsBody');
  tbody.innerHTML = '';
  admins.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:bold">${a.full_name}</td>
      <td>${a.email}</td>
      <td>${formatDate(a.created_at)}</td>
      <td><button class="btn btn-sm" style="color:#e53e3e;border-color:#e53e3e" data-id="${a.id}">Löschen</button></td>`;
    tr.querySelector('button').addEventListener('click', async () => {
      if (!confirm(`Admin "${a.full_name}" wirklich löschen?`)) return;
      const res = await fetch(`/api/admin/admins/${a.id}`, { method: 'DELETE' });
      const data = await res.json();
      const alertEl = document.getElementById('adminsAlert');
      if (!res.ok) {
        alertEl.textContent = data.error;
        alertEl.className = 'alert alert-error';
        alertEl.classList.remove('hidden');
      } else {
        alertEl.classList.add('hidden');
        loadAdmins();
      }
    });
    tbody.appendChild(tr);
  });
}

const newAdminModal = document.getElementById('newAdminModal');
document.getElementById('newAdminBtn').addEventListener('click', () => {
  document.getElementById('newAdminForm').reset();
  document.getElementById('adminModalAlert').classList.add('hidden');
  document.getElementById('adminSuccessInfo').classList.add('hidden');
  newAdminModal.classList.remove('hidden');
});
function closeAdminModal() { newAdminModal.classList.add('hidden'); }
document.getElementById('adminModalClose').addEventListener('click', closeAdminModal);
document.getElementById('adminModalCancel').addEventListener('click', closeAdminModal);
newAdminModal.addEventListener('click', e => { if (e.target === newAdminModal) closeAdminModal(); });

document.getElementById('newAdminForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl   = document.getElementById('adminModalAlert');
  const successEl = document.getElementById('adminSuccessInfo');
  alertEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const body = {
    full_name: document.getElementById('adminName').value,
    email:     document.getElementById('adminEmail').value,
    password:  document.getElementById('adminPassword').value
  };
  const res  = await fetch('/api/admin/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    alertEl.textContent = data.error || 'Fehler beim Anlegen';
    alertEl.classList.remove('hidden');
    return;
  }
  successEl.textContent = `Admin "${data.full_name}" wurde angelegt.`;
  successEl.classList.remove('hidden');
  document.getElementById('newAdminForm').reset();
  loadAdmins();
});

// Admins laden wenn Einstellungen-Tab geöffnet wird
document.querySelectorAll('.tab-btn').forEach(btn => {
  if (btn.dataset.tab === 'settings') {
    btn.addEventListener('click', loadAdmins);
  }
});

// ── Versicherungsempfehlungen ─────────────────────────────────────────────────
async function loadEmpfehlungen(userId) {
  const container = document.getElementById('empfehlungenContainer');
  container.innerHTML = '<div class="text-muted" style="padding:16px">Lade…</div>';

  const [contractList, profile] = await Promise.all([
    fetch(`/api/admin/contracts/${userId}`).then(r => r.json()).catch(() => []),
    fetch(`/api/admin/customers/${userId}/profile`).then(r => r.json()).catch(() => ({}))
  ]);

  const vorhandene = contractList.map(c => c.name ? c.name.toLowerCase() : '');
  const hat = name => vorhandene.some(v => v.includes(name.toLowerCase()));

  const alter = profile.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date)) / 31557600000) : null;
  const verheiratet = ['verheiratet', 'verpartnert'].includes((profile.marital_status || '').toLowerCase());
  const selbststaendig = (profile.berufsgruppe || '').toLowerCase().includes('selbst');
  const gkv = (profile.health_insurance_type || '').toLowerCase().includes('g');
  const einkommen = parseFloat(profile.gross_income) || 0;

  const empfehlungen = [];

  // 🔴 Kritisch
  if (!hat('haftpflicht'))
    empfehlungen.push({ prio: 1, farbe: '#e53e3e', stufe: '🔴 Kritisch', name: 'Haftpflichtversicherung', grund: 'Jeder Erwachsene benötigt eine Haftpflicht – unbegrenzte Haftung bei Schäden an Dritten.', tipp: 'Günstigste und wichtigste Versicherung überhaupt.' });

  if (!hat('berufsunfähigkeit') && !hat('bu') && (alter === null || alter < 58))
    empfehlungen.push({ prio: 1, farbe: '#e53e3e', stufe: '🔴 Kritisch', name: 'Berufsunfähigkeitsversicherung (BU)', grund: 'Jeder 4. Arbeitnehmer wird vor Renteneintritt berufsunfähig. Ohne BU droht Altersarmut.', tipp: selbststaendig ? 'Als Selbstständige/r besonders dringend – kein gesetzlicher Schutz vorhanden.' : 'Faustformel: BU-Rente = 70–80 % des Nettoeinkommens.' });

  if (!hat('krankentagegeld'))
    empfehlungen.push({ prio: selbststaendig ? 1 : 2, farbe: selbststaendig ? '#e53e3e' : '#dd6b20', stufe: selbststaendig ? '🔴 Kritisch' : '🟠 Wichtig', name: 'Krankentagegeld', grund: selbststaendig ? 'Selbstständige erhalten keine Lohnfortzahlung – ab Tag 1 kein Einkommen bei Krankheit.' : 'Nach 6 Wochen sinkt das Krankengeld auf ca. 70 % des Bruttoeinkommens.', tipp: 'Lücke zwischen Nettoeinkommen und gesetzlichem Krankengeld schließen.' });

  if (!hat('gebäude') && !hat('gebaeude') && !hat('wohngebäude'))
    empfehlungen.push({ prio: 1, farbe: '#e53e3e', stufe: '🔴 Kritisch (für Eigentümer)', name: 'Gebäudeversicherung', grund: 'Feuer, Sturm oder Leitungswasser können ein Gebäude komplett vernichten.', tipp: 'Elementarschadenklausel (Überschwemmung) separat prüfen – oft nicht enthalten!' });

  if (!hat('risikoleben') && !hat('risiko-leben') && verheiratet)
    empfehlungen.push({ prio: 1, farbe: '#e53e3e', stufe: '🔴 Kritisch', name: 'Risikolebensversicherung', grund: 'Als verheiratete Person: Todesfall würde den Partner finanziell stark belasten.', tipp: 'Versicherungssumme = mind. 3–5-faches Jahreseinkommen.' });

  // 🟠 Wichtig
  if (!hat('hausrat'))
    empfehlungen.push({ prio: 2, farbe: '#dd6b20', stufe: '🟠 Wichtig', name: 'Hausratversicherung', grund: 'Einbruch, Feuer oder Leitungswasser können den gesamten Hausrat vernichten.', tipp: 'Faustformel: 650–750 € × Wohnfläche in m².' });

  if (!hat('risikoleben') && !hat('risiko-leben') && !verheiratet)
    empfehlungen.push({ prio: 2, farbe: '#dd6b20', stufe: '🟠 Wichtig', name: 'Risikolebensversicherung', grund: 'Absicherung bei gemeinsamen Krediten oder finanziell abhängigen Angehörigen.', tipp: 'Günstig und einfach – besonders bei laufender Baufinanzierung.' });

  if (!hat('pflege') && alter !== null && alter >= 40)
    empfehlungen.push({ prio: 2, farbe: '#dd6b20', stufe: '🟠 Wichtig', name: 'Pflegezusatzversicherung', grund: `Mit ${alter} Jahren: Beiträge noch günstig, Abschluss vor 50 dringend empfohlen.`, tipp: 'Gesetzliche Pflegeversicherung deckt nur einen Bruchteil der echten Kosten.' });

  if (!hat('rente') && !hat('altersvorsorge'))
    empfehlungen.push({ prio: 2, farbe: '#dd6b20', stufe: '🟠 Wichtig', name: 'Rentenversicherung / Altersvorsorge', grund: selbststaendig ? 'Selbstständige ohne gesetzliche Rentenversicherung – private Vorsorge zwingend.' : 'Gesetzliche Rente reicht nicht aus – Versorgungslücke schließen.', tipp: selbststaendig ? 'Basisrente (Rürup) für Selbstständige steuerlich attraktiv.' : 'Betriebliche Altersvorsorge: Arbeitgeberzuschuss mitnehmen.' });

  if (!hat('pkv') && !hat('private kranken') && gkv && einkommen > 69300)
    empfehlungen.push({ prio: 2, farbe: '#dd6b20', stufe: '🟠 Wichtig', name: 'Private Krankenversicherung (PKV)', grund: `Einkommen überschreitet die Versicherungspflichtgrenze (69.300 €). PKV-Wechsel möglich.`, tipp: 'Sorgfältige Beratung notwendig – Rückkehr zur GKV schwierig.' });

  if (!hat('pkv') && !hat('private kranken') && selbststaendig)
    empfehlungen.push({ prio: 2, farbe: '#dd6b20', stufe: '🟠 Wichtig', name: 'Private Krankenversicherung (PKV)', grund: 'Als Selbstständige/r keine Pflichtmitgliedschaft in der GKV – PKV oft günstiger und besser.', tipp: 'Einmal PKV, schwer zurück zur GKV. Rechtzeitig beraten lassen.' });

  // 🟡 Mittel
  if (!hat('rechtsschutz'))
    empfehlungen.push({ prio: 3, farbe: '#d69e2e', stufe: '🟡 Mittel', name: 'Rechtsschutzversicherung', grund: 'Rechtsstreitigkeiten (Miete, Arbeit, Verkehr) können fünfstellige Kosten verursachen.', tipp: 'Achtung: 3 Monate Wartezeit nach Abschluss – nicht im Streitfall abschließen.' });

  if (!hat('unfall') && (alter === null || alter > 55 || !hat('berufsunfähigkeit')))
    empfehlungen.push({ prio: 3, farbe: '#d69e2e', stufe: '🟡 Mittel', name: 'Unfallversicherung', grund: 'Ergänzt die BU für Unfälle – zahlt Einmalzahlung bei dauerhafter Invalidität.', tipp: 'Kein Ersatz für BU, aber sinnvolle Ergänzung – besonders für Kinder und Rentner.' });

  if (!hat('zahn') && gkv)
    empfehlungen.push({ prio: 3, farbe: '#d69e2e', stufe: '🟡 Mittel', name: 'Zahnzusatzversicherung', grund: 'GKV erstattet nur Festzuschüsse – hochwertiger Zahnersatz kostet schnell mehrere tausend Euro.', tipp: 'Wartezeiten und Staffelregelungen im ersten Jahr beachten.' });

  if (!hat('cyber'))
    empfehlungen.push({ prio: selbststaendig ? 2 : 4, farbe: selbststaendig ? '#dd6b20' : '#38a169', stufe: selbststaendig ? '🟠 Wichtig' : '🟢 Optional', name: 'Cyber-Versicherung', grund: selbststaendig ? 'Selbstständige mit Kundendaten sind attraktive Ziele für Phishing und Datenmissbrauch.' : 'Schutz vor Online-Banking-Betrug, Identitätsdiebstahl und Phishing.', tipp: 'Schäden können schnell vier- bis fünfstellig werden.' });

  empfehlungen.sort((a, b) => a.prio - b.prio);

  container.innerHTML = '';

  if (empfehlungen.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Alle wesentlichen Versicherungen sind abgedeckt.</p></div>';
    return;
  }

  const hinweis = document.createElement('p');
  hinweis.className = 'text-muted';
  hinweis.style.cssText = 'font-size:13px;margin-bottom:16px;padding:0 4px';
  hinweis.textContent = `${empfehlungen.length} fehlende oder empfehlenswerte Versicherung${empfehlungen.length !== 1 ? 'en' : ''} basierend auf Vertragsdaten und Kundenprofil.`;
  container.appendChild(hinweis);

  empfehlungen.forEach(e => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;border-left:4px solid ' + e.farbe;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <strong style="font-size:15px">${e.name}</strong>
        <span style="font-size:12px;color:${e.farbe};font-weight:600;white-space:nowrap">${e.stufe}</span>
      </div>
      <p style="margin:6px 0 4px;font-size:13px;color:#4a5568">${e.grund}</p>
      <p style="margin:0;font-size:12px;color:#718096">💡 ${e.tipp}</p>`;
    container.appendChild(card);
  });
}

init();
