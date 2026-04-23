const Datastore = require('@seald-io/nedb');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(path.join(dataDir, 'sessions'), { recursive: true });

const users     = new Datastore({ filename: path.join(dataDir, 'users.db'),     autoload: true });
const cases     = new Datastore({ filename: path.join(dataDir, 'cases.db'),     autoload: true });
const timeline  = new Datastore({ filename: path.join(dataDir, 'timeline.db'),  autoload: true });
const documents = new Datastore({ filename: path.join(dataDir, 'documents.db'), autoload: true });
const messages  = new Datastore({ filename: path.join(dataDir, 'messages.db'),  autoload: true });
const settings  = new Datastore({ filename: path.join(dataDir, 'settings.db'),  autoload: true });

users.ensureIndex({ fieldName: 'email', unique: true });
cases.ensureIndex({ fieldName: 'user_id' });
cases.ensureIndex({ fieldName: 'case_number', unique: true });
timeline.ensureIndex({ fieldName: 'case_id' });
documents.ensureIndex({ fieldName: 'case_id' });
messages.ensureIndex({ fieldName: 'case_id' });

async function getNextCaseNumber() {
  const year = new Date().getFullYear();
  const prefix = `SCH-${year}-`;
  const all = await cases.findAsync({ case_number: new RegExp(`^${prefix}`) });
  let max = 0;
  for (const c of all) {
    const n = parseInt(c.case_number.replace(prefix, ''), 10);
    if (n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@schindelhauer.de';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('FATAL: ADMIN_PASSWORD nicht in .env gesetzt! Server wird beendet.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(adminPassword, 12);
  const existing = await users.findOneAsync({ role: 'admin' });
  if (existing) {
    await users.updateAsync({ role: 'admin' }, { $set: { email: adminEmail, password_hash: hash } });
    console.log(`\n✓ Admin-Account aktualisiert: ${adminEmail}\n`);
  } else {
    await users.insertAsync({
      email: adminEmail,
      password_hash: hash,
      full_name: 'Felix Schindelhauer',
      phone: '',
      mobile: '',
      role: 'admin',
      notification_preference: 'email',
      must_change_password: false,
      created_at: new Date().toISOString()
    });
    console.log(`\n✓ Admin-Account angelegt: ${adminEmail}\n`);
  }
}

async function seedSettings() {
  const existing = await settings.findOneAsync({});
  if (!existing) {
    await settings.insertAsync({
      agency_name:   'Felix Schindelhauer GmbH',
      phone:         '',
      email:         'info.schindelhauer@continentale.de',
      whatsapp:      '4915150900461',
      opening_hours: 'Mo, Di, Do, Fr: 9:30–13:00 & 14:00–17:00 Uhr\nMi: 9:30–13:00 Uhr'
    });
  }
}

module.exports = { users, cases, timeline, documents, messages, settings, getNextCaseNumber, seedAdmin, seedSettings };
