// Versicherungsarten mit sparten-spezifischen Pflichtfeldern
const INSURANCE_TYPES = [
  { name: 'Haftpflichtversicherung',              fields: [] },
  { name: 'Kfz-Versicherung',                     fields: [] },
  {
    name: 'Hausratversicherung',
    fields: [{ key: 'wohnflaeche', label: 'Wohnfläche (m²)', type: 'number', unit: 'm²', placeholder: 'z.B. 80' }]
  },
  {
    name: 'Berufsunfähigkeitsversicherung (BU)',
    fields: [{ key: 'bu_rente', label: 'Höhe der BU-Rente (€/Monat)', type: 'number', unit: '€/Monat', placeholder: 'z.B. 1500' }]
  },
  {
    name: 'Krankentagegeld',
    fields: [{ key: 'krankentagegeld', label: 'Abgesichertes Krankentagegeld (€/Tag)', type: 'number', unit: '€/Tag', placeholder: 'z.B. 100' }]
  },
  {
    name: 'Rechtsschutzversicherung',
    fields: [{
      key: 'bereiche',
      label: 'Abgedeckte Bereiche',
      type: 'checkbox-group',
      options: ['Privat', 'Beruf', 'Verkehr', 'Wohnungs-/Grundstücksrechtsschutz']
    }]
  },
  {
    name: 'Risikolebensversicherung',
    fields: [{ key: 'versicherungssumme', label: 'Versicherungssumme (€)', type: 'number', unit: '€', placeholder: 'z.B. 200000' }]
  },
  {
    name: 'Unfallversicherung',
    fields: [{ key: 'invaliditaetssumme', label: 'Invaliditätssumme (€)', type: 'number', unit: '€', placeholder: 'z.B. 100000' }]
  },
  { name: 'Zahnzusatzversicherung',               fields: [] },
  { name: 'Private Krankenversicherung (PKV)',     fields: [] },
  { name: 'Pflegeversicherung',                   fields: [] },
  {
    name: 'Rentenversicherung / Altersvorsorge',
    fields: []
  },
  {
    name: 'Gebäudeversicherung',
    fields: [{ key: 'wohnflaeche', label: 'Wohnfläche (m²)', type: 'number', unit: 'm²', placeholder: 'z.B. 150' }]
  },
  { name: 'Lebensversicherung',                   fields: [] },
  { name: 'Cyber-Versicherung',                   fields: [] },
];

/**
 * Füllt ein <select>-Element mit den vordefinierten Versicherungsarten.
 * @param {HTMLSelectElement} selectEl
 */
function populateInsuranceSelect(selectEl) {
  // Bestehende Optionen außer der ersten (Platzhalter) entfernen
  while (selectEl.options.length > 1) selectEl.remove(1);

  INSURANCE_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = t.name;
    selectEl.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '— Eigene Eingabe —';
  selectEl.appendChild(customOpt);
}

/**
 * Gibt die Felddefinitionen für eine Versicherungsart zurück.
 * @param {string} typeName
 * @returns {Array}
 */
function getInsuranceFields(typeName) {
  const type = INSURANCE_TYPES.find(t => t.name === typeName);
  return type ? type.fields : [];
}

/**
 * Rendert sparten-spezifische Extrafelder in einen Container.
 * @param {string} typeName  - Versicherungsart (oder leer)
 * @param {HTMLElement} container
 * @param {string} prefix    - ID-Präfix für Inputs (z.B. 'f' oder 'ac')
 * @param {Object} values    - Vorausgefüllte Werte (optional)
 */
function renderExtraFields(typeName, container, prefix, values = {}) {
  container.innerHTML = '';
  const fields = getInsuranceFields(typeName);
  if (!fields.length) return;

  fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = field.label;
    group.appendChild(label);

    if (field.type === 'checkbox-group') {
      const wrapper = document.createElement('div');
      wrapper.className = 'checkbox-group';
      const selected = values[field.key];
      field.options.forEach(opt => {
        const cbLabel = document.createElement('label');
        cbLabel.className = 'checkbox-group-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = prefix + 'Extra_' + field.key;
        cb.value = opt;
        if (Array.isArray(selected) && selected.includes(opt)) cb.checked = true;
        cbLabel.appendChild(cb);
        cbLabel.appendChild(document.createTextNode(' ' + opt));
        wrapper.appendChild(cbLabel);
      });
      group.appendChild(wrapper);
    } else {
      const input = document.createElement('input');
      input.type = field.type || 'text';
      input.id = prefix + 'Extra_' + field.key;
      input.className = 'form-control';
      input.placeholder = field.placeholder || '';
      if (field.type === 'number') { input.min = '0'; input.step = '0.01'; }
      if (values[field.key] !== undefined) input.value = values[field.key];
      group.appendChild(input);
    }

    container.appendChild(group);
  });
}

/**
 * Liest die Extrafeld-Werte aus dem DOM und gibt ein details-Objekt zurück.
 * @param {string} typeName
 * @param {string} prefix
 * @returns {Object}
 */
function collectExtraFields(typeName, prefix) {
  const fields = getInsuranceFields(typeName);
  const details = {};
  fields.forEach(field => {
    if (field.type === 'checkbox-group') {
      const checked = Array.from(document.querySelectorAll(`[name="${prefix}Extra_${field.key}"]:checked`)).map(cb => cb.value);
      if (checked.length > 0) details[field.key] = checked;
    } else {
      const el = document.getElementById(prefix + 'Extra_' + field.key);
      if (el && el.value !== '') details[field.key] = parseFloat(el.value) || el.value;
    }
  });
  return details;
}

/**
 * Erstellt eine lesbare Darstellung der details-Felder für die Vertragskarte.
 * @param {string} typeName
 * @param {Object} details
 * @returns {string}  HTML-String
 */
function formatDetailsHtml(typeName, details) {
  if (!details || !typeName) return '';
  const fields = getInsuranceFields(typeName);
  const parts = fields
    .filter(f => details[f.key] !== undefined && details[f.key] !== '')
    .map(f => {
      const raw = details[f.key];
      const val = Array.isArray(raw)
        ? raw.join(', ')
        : (typeof raw === 'number' ? raw.toLocaleString('de-DE') : raw);
      const unitStr = f.unit ? ` ${f.unit}` : '';
      return `<span>${f.label.replace(/\s*\(.*?\)/, '')}: <strong>${val}${unitStr}</strong></span>`;
    });
  return parts.join(' &nbsp;·&nbsp; ');
}
