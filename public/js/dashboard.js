const CYCLE_LABEL = { monthly: '/ Monat', quarterly: '/ Quartal', halfyearly: '/ Halbjahr', yearly: '/ Jahr' };

function toMonthly(amount, cycle) {
  if (cycle === 'monthly')    return amount;
  if (cycle === 'quarterly')  return amount / 3;
  if (cycle === 'halfyearly') return amount / 6;
  if (cycle === 'yearly')     return amount / 12;
  return amount;
}

function fmt(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function categoryLabel(cat) {
  if (cat === 'insurance')    return '<span class="badge badge-insurance">Versicherung</span>';
  if (cat === 'subscription') return '<span class="badge badge-subscription">Abo</span>';
  return '<span class="badge badge-other">Sonstiges</span>';
}

async function init() {
  // Auth-Check
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null);
  if (!me || !me.id) { window.location.href = 'login.html'; return; }
  if (me.role === 'admin') { window.location.href = 'admin.html'; return; }

  document.getElementById('userName').textContent = me.full_name;

  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // Verträge laden
  const contracts = await fetch('/api/contracts').then(r => r.json()).catch(() => []);

  // Kostenberechnung
  let totalMonthly = 0, insMonthly = 0, subMonthly = 0, othMonthly = 0;
  contracts.forEach(c => {
    const m = toMonthly(c.premium_amount, c.premium_cycle);
    totalMonthly += m;
    if (c.category === 'insurance')    insMonthly += m;
    else if (c.category === 'subscription') subMonthly += m;
    else othMonthly += m;
  });

  document.getElementById('totalMonthly').textContent = fmt(totalMonthly).replace(' €', '');
  document.getElementById('totalYearly').textContent = fmt(totalMonthly * 12);
  document.getElementById('insuranceMonthly').textContent = fmt(insMonthly);
  document.getElementById('subscriptionMonthly').textContent = fmt(subMonthly);
  document.getElementById('otherMonthly').textContent = fmt(othMonthly);

  // Statistiken
  const ownCount      = contracts.filter(c => c.category === 'insurance' && (c.is_own_insurer === true || c.added_by_role === 'admin')).length;
  const externalCount = contracts.filter(c => c.category === 'insurance' && !c.is_own_insurer && c.added_by_role !== 'admin').length;
  document.getElementById('countTotal').textContent        = contracts.length;
  document.getElementById('countOwn').textContent          = ownCount;
  document.getElementById('countExternal').textContent     = externalCount;
  document.getElementById('countSubscription').textContent = contracts.filter(c => c.category === 'subscription').length;

  // Schnell-Hinzufügen: bereits vorhandene Einträge ausblenden
  const existingNames = new Set(contracts.map(c => c.name));
  document.querySelectorAll('.btn-quick').forEach(btn => {
    if (existingNames.has(btn.dataset.name)) btn.style.display = 'none';
  });

  // Hinweise rendern
  renderHints(contracts);

  // Empfehlungen laden
  loadRecommendations();

  // Kostenverteilung
  renderCostChart(insMonthly, subMonthly, othMonthly);
}

function renderCostChart(ins, sub, oth) {
  const container = document.getElementById('costChart');
  const total = ins + sub + oth;
  if (total === 0) return;

  const segments = [
    { label: 'Versicherungen', value: ins, color: 'var(--primary)' },
    { label: 'Abonnements',    value: sub, color: '#9d174d' },
    { label: 'Sonstiges',      value: oth, color: '#64748b' },
  ].filter(s => s.value > 0);

  container.innerHTML = '';

  // Segmented bar
  const barWrap = document.createElement('div');
  barWrap.style.cssText = 'display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:20px;gap:2px;';
  segments.forEach(s => {
    const seg = document.createElement('div');
    seg.style.cssText = `flex:${s.value};background:${s.color};transition:flex 0.4s;`;
    seg.title = `${s.label}: ${fmt(s.value)} / Monat`;
    barWrap.appendChild(seg);
  });
  container.appendChild(barWrap);

  // Legend rows
  segments.forEach(s => {
    const pct = Math.round((s.value / total) * 100);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;margin-bottom:14px;gap:10px;';

    const dot = document.createElement('span');
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;`;

    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-size:14px;';
    label.textContent = s.label;

    const barTrack = document.createElement('div');
    barTrack.style.cssText = 'flex:2;background:var(--light-gray);border-radius:4px;height:6px;overflow:hidden;';
    const barFill = document.createElement('div');
    barFill.style.cssText = `width:${pct}%;height:100%;background:${s.color};border-radius:4px;`;
    barTrack.appendChild(barFill);

    const amt = document.createElement('span');
    amt.style.cssText = 'font-weight:600;font-size:13px;white-space:nowrap;min-width:75px;text-align:right;';
    amt.textContent = fmt(s.value) + ' / Mo.';

    const pctEl = document.createElement('span');
    pctEl.style.cssText = 'font-size:12px;color:var(--text-muted);min-width:36px;text-align:right;';
    pctEl.textContent = pct + ' %';

    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(barTrack);
    row.appendChild(amt);
    row.appendChild(pctEl);
    container.appendChild(row);
  });

  // Total line
  const totalRow = document.createElement('div');
  totalRow.style.cssText = 'display:flex;justify-content:space-between;border-top:1px solid var(--light-gray);padding-top:12px;margin-top:4px;font-size:14px;';
  totalRow.innerHTML = `<span class="text-muted">Gesamt monatlich</span><span style="font-weight:700;color:var(--primary)">${fmt(total)} / Mo.</span>`;
  container.appendChild(totalRow);
}

function renderHints(contracts) {
  const hintsCard = document.getElementById('hintsCard');
  const hintsList = document.getElementById('hintsList');
  const hints = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  // Bald kündbare Verträge
  contracts.forEach(c => {
    if (!c.cancellation_deadline || !c.consent_display_and_analysis) return;
    const d = new Date(c.cancellation_deadline);
    if (d >= today && d <= in60) {
      const days = Math.round((d - today) / (24 * 60 * 60 * 1000));
      hints.push({ icon: '⏰', text: `Kündigungsfrist läuft ab: <strong>${c.name}</strong> – noch ${days} Tag${days === 1 ? '' : 'e'} (${c.cancellation_deadline})` });
    }
  });

  // Mehrere Abos in gleicher Kategorie (Streaming, Fitness etc.)
  const subsByName = {};
  contracts.filter(c => c.category === 'subscription' && c.consent_display_and_analysis).forEach(c => {
    const key = (c.name || '').toLowerCase();
    subsByName[key] = (subsByName[key] || 0) + 1;
  });
  const totalSubs = contracts.filter(c => c.category === 'subscription' && c.consent_display_and_analysis).length;
  if (totalSubs >= 4) {
    hints.push({ icon: '📱', text: `Du hast <strong>${totalSubs} aktive Abonnements</strong> hinterlegt. Hier könnte Einsparpotenzial bestehen.` });
  }

  if (hints.length === 0) {
    hintsCard.style.display = 'none';
    return;
  }

  hintsCard.style.display = '';
  hintsList.innerHTML = '';
  hints.forEach(h => {
    const div = document.createElement('div');
    div.className = 'hint-item';
    div.innerHTML = `<span class="hint-icon">${h.icon}</span><span>${h.text}</span>`;
    hintsList.appendChild(div);
  });
}

init();

// ── Anfrage-Felder pro Versicherungstyp ───────────────────────────────────────
const INQUIRY_FIELDS = {
  'Berufsunfähigkeitsversicherung': [
    { id: 'beruf',     label: 'Beruf / Tätigkeit *',       type: 'text',   placeholder: 'z.B. Bürokaufmann, Krankenpfleger', required: true },
    { id: 'geb',       label: 'Geburtsjahr *',             type: 'number', placeholder: 'z.B. 1990', profileKey: 'birth_year', required: true },
    { id: 'brutto',    label: 'Bruttoeinkommen (€/Monat)', type: 'number', placeholder: '0,00', profileKey: 'gross_income' },
    { id: 'netto',     label: 'Nettoeinkommen (€/Monat)',  type: 'number', placeholder: '0,00', profileKey: 'net_income' },
    { id: 'raucher',   label: 'Raucherstatus *',           type: 'select', options: ['Bitte wählen…', 'Nichtraucher', 'Raucher'], required: true },
  ],
  'Risikolebensversicherung': [
    { id: 'beruf',     label: 'Beruf / Tätigkeit',         type: 'text',   placeholder: 'z.B. Ingenieur, Lehrer' },
    { id: 'geb',       label: 'Geburtsjahr *',             type: 'number', placeholder: 'z.B. 1990', profileKey: 'birth_year', required: true },
    { id: 'kinder',    label: 'Anzahl Kinder',             type: 'number', placeholder: '0', min: 0 },
    { id: 'kredite',   label: 'Laufende Kredite / Immobilien', type: 'text', placeholder: 'z.B. Immobiliendarlehen 200.000 €' },
    { id: 'summe',     label: 'Gewünschte Versicherungssumme', type: 'text', placeholder: 'z.B. 200.000 €' },
  ],
  'Krankentagegeld': [
    { id: 'beruf',     label: 'Beruf / Tätigkeit',         type: 'text',   placeholder: 'z.B. Kaufmann' },
    { id: 'status',    label: 'Beschäftigungsstatus *',    type: 'select', options: ['Bitte wählen…', 'Angestellt', 'Selbstständig', 'Beamter'], required: true },
    { id: 'netto',     label: 'Nettoeinkommen (€/Monat)',  type: 'number', placeholder: '0,00', profileKey: 'net_income' },
    { id: 'kk',        label: 'Krankenkasse',              type: 'text',   placeholder: 'z.B. AOK, Techniker Krankenkasse', profileKey: 'health_insurance_provider' },
    { id: 'geb',       label: 'Geburtsjahr',               type: 'number', placeholder: 'z.B. 1990', profileKey: 'birth_year' },
  ],
  'Privathaftpflichtversicherung': [
    { id: 'famstand',  label: 'Familienstand',             type: 'select', options: ['Bitte wählen…', 'Single', 'Verheiratet / mit Partner', 'Alleinerziehend'] },
    { id: 'kinder',    label: 'Anzahl Kinder',             type: 'number', placeholder: '0', min: 0 },
    { id: 'hund',      label: 'Hund vorhanden?',           type: 'select', options: ['Nein', 'Ja'] },
  ],
  'Hausratversicherung': [
    { id: 'flaeche',   label: 'Wohnfläche (m²) *',        type: 'number', placeholder: 'z.B. 80', required: true },
    { id: 'plz',       label: 'Postleitzahl *',            type: 'text',   placeholder: 'z.B. 44575', required: true },
    { id: 'typ',       label: 'Mieter oder Eigentümer?',   type: 'select', options: ['Mieter', 'Eigentümer'] },
  ],
  'Rechtsschutzversicherung': [
    { id: 'berufstyp', label: 'Beschäftigung',             type: 'select', options: ['Bitte wählen…', 'Angestellt', 'Selbstständig', 'Nicht berufstätig / Rente'] },
    { id: 'fahrzeug',  label: 'Fahrzeug vorhanden?',       type: 'select', options: ['Ja', 'Nein'] },
    { id: 'umfang',    label: 'Absicherungsumfang',        type: 'select', options: ['Nur für mich', 'Für meine Familie'] },
  ],
};

let _currentProfile = {};

// ── Empfehlungen ──────────────────────────────────────────────────────────────
async function loadRecommendations() {
  const container = document.getElementById('recommendationsList');
  try {
    const [data, profile] = await Promise.all([
      fetch('/api/recommendations').then(r => r.json()),
      fetch('/api/profile').then(r => r.json()).catch(() => ({}))
    ]);
    _currentProfile = profile;

    if (!data.profile_complete) {
      container.innerHTML = `
        <div class="profile-incomplete-banner">
          <strong>Profil unvollständig</strong><br>
          Vervollständigen Sie Ihr Profil, um persönliche Versicherungsempfehlungen zu erhalten.
          <a href="profile.html" class="btn btn-sm btn-primary" style="margin-top:10px;display:inline-block;">Profil ausfüllen</a>
        </div>`;
      return;
    }
    if (!data.recommendations || data.recommendations.length === 0) {
      container.innerHTML = `
        <div class="recommendation-all-good">
          <span style="font-size:28px;">✅</span>
          <p>Ihre Absicherung sieht vollständig aus. Gut gemacht!</p>
        </div>`;
      return;
    }
    container.innerHTML = '';
    data.recommendations.forEach(rec => {
      const div = document.createElement('div');
      div.className = `recommendation-card priority-${rec.priority}`;
      div.innerHTML = `
        <div class="recommendation-header">
          <strong>${rec.type}</strong>
          <span class="priority-badge priority-badge-${rec.priority}">${rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}</span>
        </div>
        <p class="recommendation-reason">${rec.reason}</p>
        <button class="btn btn-sm btn-primary inquiry-btn" data-type="${rec.type}">Jetzt anfragen</button>
        <a href="contracts.html?prefill=1&category=insurance&name=${encodeURIComponent(rec.type)}" class="btn btn-sm btn-secondary" style="margin-left:8px;">Vertrag hinzufügen</a>`;
      container.appendChild(div);
    });

    container.querySelectorAll('.inquiry-btn').forEach(btn => {
      btn.addEventListener('click', () => openInquiryModal(btn.dataset.type));
    });
  } catch (e) {
    container.innerHTML = '';
  }
}

// ── Beratungsanfrage-Modal ────────────────────────────────────────────────────
function openInquiryModal(type) {
  const fields = INQUIRY_FIELDS[type] || [];
  const profile = _currentProfile;
  const birthYear = profile.birth_date ? new Date(profile.birth_date).getFullYear() : '';

  document.getElementById('inquiryTitle').textContent = 'Anfrage: ' + type;
  document.getElementById('inquiryAlert').classList.add('hidden');
  document.getElementById('inquiryError').classList.add('hidden');

  const container = document.getElementById('inquiryFields');
  container.innerHTML = '';
  fields.forEach(f => {
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = f.label;
    group.appendChild(label);

    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      input.className = 'form-control';
      f.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt === 'Bitte wählen…' ? '' : opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = f.type;
      input.className = 'form-control';
      input.placeholder = f.placeholder || '';
      if (f.min !== undefined) input.min = f.min;
    }
    input.id = 'inq_' + f.id;
    if (f.required) input.required = true;

    // Profil-Daten vorausfüllen
    if (f.profileKey === 'birth_year' && birthYear) input.value = birthYear;
    else if (f.profileKey && profile[f.profileKey]) input.value = profile[f.profileKey];

    group.appendChild(input);
    container.appendChild(group);
  });

  document.getElementById('inquiryModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeInquiryModal() {
  document.getElementById('inquiryModal').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('inquiryClose').addEventListener('click', closeInquiryModal);
document.getElementById('inquiryCancel').addEventListener('click', closeInquiryModal);
document.getElementById('inquiryModal').addEventListener('click', e => {
  if (e.target === document.getElementById('inquiryModal')) closeInquiryModal();
});

document.getElementById('inquiryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const type = document.getElementById('inquiryTitle').textContent.replace('Anfrage: ', '');
  const fields = INQUIRY_FIELDS[type] || [];
  const alertEl = document.getElementById('inquiryAlert');
  const errorEl = document.getElementById('inquiryError');
  alertEl.classList.add('hidden');
  errorEl.classList.add('hidden');

  const lines = [`Ich interessiere mich für eine ${type} und bitte um ein persönliches Angebot.\n\nMeine Angaben:`];
  fields.forEach(f => {
    const el = document.getElementById('inq_' + f.id);
    const val = el ? el.value.trim() : '';
    if (val && val !== 'Bitte wählen…') {
      const labelClean = f.label.replace(' *', '');
      const unit = (f.type === 'number' && f.id !== 'geb' && f.id !== 'kinder' && f.id !== 'flaeche') ? ' €/Monat' : '';
      lines.push(`– ${labelClean}: ${val}${unit}`);
    }
  });

  const btn = document.getElementById('inquirySend');
  btn.disabled = true;
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: `Anfrage: ${type}`, message: lines.join('\n'), request_type: 'message' })
  });
  btn.disabled = false;

  if (!res.ok) {
    const d = await res.json();
    errorEl.textContent = d.error || 'Fehler beim Senden';
    errorEl.classList.remove('hidden');
  } else {
    alertEl.classList.remove('hidden');
    document.getElementById('inquiryForm').reset();
    setTimeout(closeInquiryModal, 2000);
  }
});

// ── Schnell-Hinzufügen-Buttons ────────────────────────────────────────────────
document.querySelectorAll('.btn-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    const category = encodeURIComponent(btn.dataset.category);
    const name     = encodeURIComponent(btn.dataset.name);
    window.location.href = `contracts.html?prefill=1&category=${category}&name=${name}`;
  });
});
