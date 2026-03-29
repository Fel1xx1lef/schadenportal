const CAT_LABEL = { insurance: 'Versicherung', subscription: 'Abonnement', other: 'Sonstiges' };
const CYCLE_LABEL = { monthly: '/ Monat', quarterly: '/ Quartal', halfyearly: '/ Halbjahr', yearly: '/ Jahr' };

function fmt(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

let allContracts = [];
let pendingDeleteId = null;

function isOwn(c) {
  return c.is_own_insurer === true || c.added_by_role === 'admin';
}

function renderList() {
  const container = document.getElementById('consentList');
  // Nur selbst hinzugefügte Verträge anzeigen (nicht eigene Versicherer-Verträge)
  const selfAdded = allContracts.filter(c => !isOwn(c));

  if (selfAdded.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>Du hast noch keine selbst hinzugefügten Verträge oder Abos.</p>
        <a href="contracts.html" class="btn btn-primary" style="margin-top:12px;display:inline-block;">Verträge verwalten</a>
      </div>`;
    return;
  }

  container.innerHTML = '';
  selfAdded.forEach(c => {
    const card = document.createElement('div');
    card.className = 'contract-card';
    card.style.marginBottom = '16px';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    const info = document.createElement('div');
    info.innerHTML = `
      <div class="contract-name">${c.name}</div>
      <div class="contract-provider">${c.provider || ''}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px;">${CAT_LABEL[c.category] || c.category} · ${fmt(c.premium_amount)} ${CYCLE_LABEL[c.premium_cycle] || ''}</div>`;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-secondary';
    editBtn.textContent = '✏️ Einwilligungen';
    editBtn.addEventListener('click', () => openConsentEdit(c));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '🗑️ Löschen';
    delBtn.addEventListener('click', () => openDeleteModal(c));
    actions.appendChild(delBtn);

    header.appendChild(info);
    header.appendChild(actions);
    card.appendChild(header);

    // Einwilligungsstatus
    const consentStatus = document.createElement('div');
    consentStatus.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px;';

    function consentBadge(active, label) {
      const b = document.createElement('span');
      b.style.cssText = `font-size:12px;padding:3px 10px;border-radius:20px;font-weight:500;${active ? 'background:#dcfce7;color:#065f46;' : 'background:#f3f4f6;color:#6b7280;'}`;
      b.textContent = (active ? '✓ ' : '– ') + label;
      return b;
    }

    consentStatus.appendChild(consentBadge(c.consent_display_and_analysis, 'Datenspeicherung'));
    consentStatus.appendChild(consentBadge(c.consent_advisory, 'Beratung'));
    if (c.category === 'insurance') {
      consentStatus.appendChild(consentBadge(c.consent_offers, 'Angebote'));
    }

    card.appendChild(consentStatus);
    container.appendChild(card);
  });
}

// ── Einwilligungen bearbeiten ──────────────────────────────────────────────
const consentEditModal = document.getElementById('consentEditModal');

function openConsentEdit(c) {
  document.getElementById('consentEditId').value = c._id;
  document.getElementById('consentEditTitle').textContent = c.name;
  document.getElementById('ceConsentDisplay').checked  = !!c.consent_display_and_analysis;
  document.getElementById('ceConsentAdvisory').checked = !!c.consent_advisory;
  document.getElementById('ceConsentOffers').checked   = !!c.consent_offers;

  // Angebote-Zeile nur bei Versicherungen
  document.getElementById('ceOffersRow').style.display = c.category === 'insurance' ? '' : 'none';

  document.getElementById('consentEditAlert').classList.add('hidden');
  consentEditModal.classList.remove('hidden');
}

document.getElementById('consentEditClose').addEventListener('click', () => consentEditModal.classList.add('hidden'));
document.getElementById('consentEditCancel').addEventListener('click', () => consentEditModal.classList.add('hidden'));
consentEditModal.addEventListener('click', e => { if (e.target === consentEditModal) consentEditModal.classList.add('hidden'); });

document.getElementById('consentEditSave').addEventListener('click', async () => {
  const id = document.getElementById('consentEditId').value;
  const alertEl = document.getElementById('consentEditAlert');
  alertEl.classList.add('hidden');

  const body = {
    consent_display_and_analysis: document.getElementById('ceConsentDisplay').checked,
    consent_advisory:             document.getElementById('ceConsentAdvisory').checked,
    consent_offers:               document.getElementById('ceConsentOffers').checked
  };

  // Für den PUT brauchen wir auch die Pflichtfelder – laden wir den Vertrag aus der lokalen Liste
  const contract = allContracts.find(c => c._id === id);
  if (!contract) return;

  const fullBody = {
    category:       contract.category,
    name:           contract.name,
    provider:       contract.provider,
    description:    contract.description,
    premium_amount: contract.premium_amount,
    premium_cycle:  contract.premium_cycle,
    start_date:     contract.start_date,
    end_date:       contract.end_date,
    details:        contract.details,
    cancellation_deadline: contract.cancellation_deadline,
    renewal_date:   contract.renewal_date,
    ...body
  };

  const res = await fetch(`/api/contracts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullBody)
  });

  if (!res.ok) {
    const d = await res.json();
    alertEl.textContent = d.error || 'Fehler beim Speichern';
    alertEl.classList.remove('hidden');
    return;
  }

  consentEditModal.classList.add('hidden');
  await loadContracts();
});

// ── Löschen ────────────────────────────────────────────────────────────────
const deleteModal = document.getElementById('deleteModal');

function openDeleteModal(c) {
  pendingDeleteId = c._id;
  document.getElementById('deleteName').textContent = c.name;
  deleteModal.classList.remove('hidden');
}

document.getElementById('deleteModalClose').addEventListener('click', () => deleteModal.classList.add('hidden'));
document.getElementById('deleteCancel').addEventListener('click', () => deleteModal.classList.add('hidden'));
deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.classList.add('hidden'); });

document.getElementById('deleteConfirm').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const res = await fetch(`/api/contracts/${pendingDeleteId}`, { method: 'DELETE' });
  deleteModal.classList.add('hidden');
  if (res.ok) {
    await loadContracts();
  } else {
    const d = await res.json();
    alert(d.error || 'Fehler beim Löschen');
  }
  pendingDeleteId = null;
});

// ── Init ───────────────────────────────────────────────────────────────────
async function loadContracts() {
  allContracts = await fetch('/api/contracts').then(r => r.json()).catch(() => []);
  renderList();
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
}

init();
