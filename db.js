const Datastore = require('@seald-io/nedb');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// DATA_DIR kann als Umgebungsvariable gesetzt werden (z.B. Railway Volume-Mount).
// Fallback: lokales ./data Verzeichnis (nur für Entwicklung geeignet).
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(path.join(dataDir, 'sessions'), { recursive: true });

const users = new Datastore({ filename: path.join(dataDir, 'users.db'), autoload: true });
const contracts = new Datastore({ filename: path.join(dataDir, 'contracts.db'), autoload: true });
const messages = new Datastore({ filename: path.join(dataDir, 'messages.db'), autoload: true });
const activityLog = new Datastore({ filename: path.join(dataDir, 'activity_log.db'), autoload: true });
const settings      = new Datastore({ filename: path.join(dataDir, 'settings.db'),      autoload: true });
const appointments  = new Datastore({ filename: path.join(dataDir, 'appointments.db'),  autoload: true });

// Indizes
users.ensureIndex({ fieldName: 'email', unique: true });

// Admin-Account beim ersten Start anlegen
async function seedAdmin() {
  const existing = await users.findOneAsync({ role: 'admin' });
  if (existing) return;

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@schindelhauer.de';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('FATAL: ADMIN_PASSWORD nicht in .env gesetzt! Server wird beendet.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(adminPassword, 12);

  await users.insertAsync({
    email: adminEmail,
    password_hash: hash,
    full_name: 'Felix Schindelhauer',
    phone: '',
    role: 'admin',
    must_change_password: true,
    created_at: new Date().toISOString()
  });

  console.log(`\n✓ Admin-Account angelegt: ${adminEmail}`);
  console.log('  Bitte Passwort nach dem ersten Login ändern!\n');
}

// Standard-Einstellungen beim ersten Start anlegen
async function seedSettings() {
  const existing = await settings.findOneAsync({});
  if (!existing) {
    await settings.insertAsync({
      agency_name:    'Felix Schindelhauer GmbH',
      address:        'Castrop-Rauxel',
      phone:          '',
      email:          'info.schindelhauer@continentale.de',
      opening_hours:  'Mo, Di, Do, Fr: 9:30–13:00 Uhr & 14:00–17:00 Uhr\nMi: 9:30–13:00 Uhr',
      whatsapp:       '4915150900461'
    });
  }
}

module.exports = { users, contracts, messages, activityLog, settings, appointments, seedAdmin, seedSettings };
