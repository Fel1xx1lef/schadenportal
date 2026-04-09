// ── 2FA Guard ─────────────────────────────────────────────────────────────────
(async function() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { window.location.href = 'dashboard.html'; return; }
  if (!me.totp_enabled) { window.location.href = '2fa-setup.html'; return; }
})();

function fmt(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE');
}

function formatDateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'calendar') loadCalendar();
    if (btn.dataset.tab === 'settings') { loadSettings(); loadAdmins(); }
  });
});

// ── Kunden laden ──────────────────────────────────────────────────────────────
let customers = [];

async function loadCustomers() {
  customers = await fetch('/api/admin/customers').then(r => r.json()).catch(() => []);
  renderCustomerTable();
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
    if (!c.consent_analysis) {
      const noAnalysis = document.createElement('div');
      noAnalysis.style.cssText = 'font-size:11px;color:#9ca3af;margin-top:3px;';
      noAnalysis.textContent = 'Keine Analyse-Einwilligung';
      tdName.appendChild(noAnalysis);
    }

    const tdEmail = document.createElement('td');
    tdEmail.textContent = c.email;

    const tdCreated = document.createElement('td');
    tdCreated.textContent = formatDate(c.created_at);

    const tdLogin = document.createElement('td');
    tdLogin.textContent = c.last_login_at ? formatDateTime(c.last_login_at) : '–';
    tdLogin.style.fontSize = '13px';

    const tdActions = document.createElement('td');
    tdActions.style.whiteSpace = 'nowrap';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-secondary';
    viewBtn.style.marginRight = '6px';
    viewBtn.textContent = '💬 Nachrichten';
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
    tr.appendChild(tdCreated);
    tr.appendChild(tdLogin);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
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

// ── Kunden-Detail Modal (nur Metadaten + Nachrichten) ─────────────────────────
const detailModal = document.getElementById('customerDetailModal');
let currentDetailUserId = null;

async function openCustomerDetail(customer) {
  currentDetailUserId = customer.id;
  document.getElementById('customerDetailTitle').textContent = customer.full_name;

  document.getElementById('metaUserId').textContent         = customer.id;
  document.getElementById('metaEmail').textContent          = customer.email;
  document.getElementById('metaCreatedAt').textContent      = formatDate(customer.created_at);
  document.getElementById('metaLastLogin').textContent      = customer.last_login_at ? formatDateTime(customer.last_login_at) : '–';
  document.getElementById('metaConsentAnalysis').textContent = customer.consent_analysis ? '✅ Ja' : '⬜ Nein';

  detailModal.classList.remove('hidden');
  await loadCustomerMessages(customer.id);
}

function closeDetailModal() { detailModal.classList.add('hidden'); }
document.getElementById('customerDetailClose').addEventListener('click', closeDetailModal);
document.getElementById('customerDetailCancel').addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', e => { if (e.target === detailModal) closeDetailModal(); });

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

// ── Alle Nachrichten laden ────────────────────────────────────────────────────
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

  const groups = {};
  msgs.forEach(m => {
    if (!groups[m.user_id]) groups[m.user_id] = { name: m.customer_name, msgs: [] };
    groups[m.user_id].msgs.push(m);
  });

  Object.entries(groups).forEach(([userId, group]) => {
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
    profileBtn.addEventListener('click', () => {
      const c = customers.find(x => x.id === userId);
      if (c) openCustomerDetail(c);
    });

    groupHeader.appendChild(nameEl);
    groupHeader.appendChild(profileBtn);
    list.appendChild(groupHeader);

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
    document.querySelectorAll('.sidebar-company').forEach(el => { if (body.agency_name) el.textContent = body.agency_name; });
    setTimeout(() => alertEl.classList.add('hidden'), 3000);
  } else {
    const errData = await res.json().catch(() => ({}));
    alertEl.textContent = errData.error || 'Fehler beim Speichern';
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

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px;';
  DAYS_DE.forEach(d => {
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;font-size:11px;font-weight:600;color:var(--text-muted);padding:4px 0;text-transform:uppercase;';
    cell.textContent = d;
    headerRow.appendChild(cell);
  });
  grid.appendChild(headerRow);

  const daysGrid = document.createElement('div');
  daysGrid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;';

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1;
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
    if (a.notes) html += `<div class="text-muted" style="font-size:12px;margin-top:2px;">${a.notes}</div>`;
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

document.getElementById('calForm').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('calFormAlert');
  const title = document.getElementById('calTitle').value.trim();
  const date  = document.getElementById('calDate').value;
  const time  = document.getElementById('calTime').value;
  const notes = document.getElementById('calNotes').value.trim();

  const res = await fetch('/api/admin/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, time, notes })
  });

  if (res.ok) {
    alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Termin gespeichert!';
    alertEl.classList.remove('hidden');
    document.getElementById('calForm').reset();
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

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { window.location.href = 'dashboard.html'; return; }

  const banner = document.getElementById('pwExpiryBanner');
  if (banner
      && (me.password_expiry_warning || sessionStorage.getItem('pw_expiry_warning') === '1')
      && sessionStorage.getItem('pw_banner_dismissed') !== '1') {
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
    document.getElementById('pwExpiryDismiss').addEventListener('click', () => {
      banner.classList.add('hidden');
      sessionStorage.setItem('pw_banner_dismissed', '1');
    });
  }

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  await Promise.all([loadCustomers(), loadMessages()]);
}

init();
