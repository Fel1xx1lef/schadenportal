require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const path = require('path');
const { users, contracts, messages, activityLog, settings, appointments, seedAdmin, seedSettings } = require('./db');
const { requireLogin, requireAdmin } = require('./middleware/auth');

const fs     = require('fs');
const multer = require('multer');
const uploadScan = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', 'contracts');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const id  = req.params.contractId || req.params.id;
      cb(null, `${id}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype))
});

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.redirect('/login.html'));

app.use(session({
  store: new FileStore({ path: path.join(__dirname, 'data', 'sessions'), ttl: 28800 }),
  secret: process.env.SESSION_SECRET || 'bitte-in-.env-aendern-' + Math.random(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000  // 8 Stunden
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Loginversuche. Bitte 15 Minuten warten.' }
});

const twoFALimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Versuche. Bitte 15 Minuten warten.' }
});

const PASSWORD_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

function buildPasswordFlags(user) {
  const mustChange = !!user.must_change_password;
  const ninetyDaysAgo = new Date(Date.now() - PASSWORD_EXPIRY_MS);
  const pwChangedAt = user.password_changed_at ? new Date(user.password_changed_at) : null;
  const expiryWarning = !mustChange && (!pwChangedAt || pwChangedAt < ninetyDaysAgo);
  return {
    requires_password_change: mustChange ? true : undefined,
    password_expiry_warning: expiryWarning ? true : undefined
  };
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });

    const user = await users.findOneAsync({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });

    await new Promise((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve())
    );

    if (user.totp_enabled) {
      req.session.twofa_pending = true;
      req.session.twofa_userId = user._id;
      req.session.twofa_expires = Date.now() + (5 * 60 * 1000);
      return res.json({ ok: true, requires_2fa: true });
    }

    await users.updateAsync({ _id: user._id }, { $set: { last_login_at: new Date().toISOString() } });

    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    const flags = buildPasswordFlags(user);

    if (user.role === 'admin' && !user.totp_enabled) {
      return res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!(user.terms_accepted_at || user.consent_given), requires_2fa_setup: true, ...flags });
    }

    res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!(user.terms_accepted_at || user.consent_given), ...flags });
  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });
    const { requires_password_change, password_expiry_warning } = buildPasswordFlags(user);
    res.json({
      id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone || '',
      consent_given: !!(user.terms_accepted_at || user.consent_given),
      consent_analysis: !!user.consent_analysis,
      totp_enabled: !!user.totp_enabled,
      requires_password_change,
      password_expiry_warning
    });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Einwilligung – nur Analyse (Portalnutzung basiert auf Nutzungsverhältnis, kein Opt-in nötig)
app.post('/api/auth/consent', requireLogin, async (req, res) => {
  try {
    const { consent_analysis } = req.body;
    await users.updateAsync({ _id: req.session.userId }, { $set: {
      terms_accepted_at: new Date().toISOString(),
      consent_given: true,  // Kompatibilität mit bestehendem Login-Check
      consent_analysis: !!consent_analysis,
      consent_analysis_at: new Date().toISOString()
    }});
    res.json({ ok: true });
  } catch (err) {
    console.error('Consent-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Analyse-Einwilligung widerrufbar
app.put('/api/auth/consent', requireLogin, async (req, res) => {
  try {
    const { consent_analysis } = req.body;
    await users.updateAsync({ _id: req.session.userId }, { $set: {
      consent_analysis: !!consent_analysis,
      consent_analysis_at: new Date().toISOString()
    }});
    res.json({ ok: true });
  } catch (err) {
    console.error('Consent-Update-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/change-password', requireLogin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Alle Felder erforderlich' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort falsch' });

    const sameAsOld = await bcrypt.compare(new_password, user.password_hash);
    if (sameAsOld) return res.status(400).json({ error: 'Das neue Passwort muss sich vom aktuellen unterscheiden' });

    const hash = await bcrypt.hash(new_password, 12);
    await users.updateAsync({ _id: req.session.userId }, {
      $set: { password_hash: hash, password_changed_at: new Date().toISOString() },
      $unset: { must_change_password: true }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Account-Löschung (nur für Kunden, mit Passwort-Bestätigung)
app.delete('/api/auth/account', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Admin-Konten können nicht selbst gelöscht werden' });

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Passwort erforderlich' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(403).json({ error: 'Passwort falsch' });

    const userId = req.session.userId;

    // Scan-Dateien löschen
    const userContracts = await contracts.findAsync({ user_id: userId });
    for (const c of userContracts) {
      if (c.scan_image) {
        fs.unlink(path.join(__dirname, 'uploads', 'contracts', c.scan_image), () => {});
      }
    }

    await contracts.removeAsync({ user_id: userId }, { multi: true });
    await messages.removeAsync({ user_id: userId }, { multi: true });
    await activityLog.removeAsync({ user_id: userId }, { multi: true });
    await users.removeAsync({ _id: userId });

    req.session.destroy(() => res.json({ ok: true }));
  } catch (err) {
    console.error('Account-Löschung-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Two-Factor Authentication Routes ─────────────────────────────────────────

app.get('/api/auth/2fa/status', (req, res) => {
  res.json({ pending: !!req.session.twofa_pending });
});

app.get('/api/auth/2fa/setup', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });

    const secret = speakeasy.generateSecret({
      name: 'Schindelhauer Kundenportal (' + user.email + ')',
      issuer: 'Felix Schindelhauer GmbH',
      length: 20
    });

    await users.updateAsync({ _id: user._id }, { $set: {
      totp_secret_temp: secret.base32,
      totp_setup_pending: true
    }});

    const qr = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ qr, secret: secret.base32 });
  } catch (err) {
    console.error('2FA Setup-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/2fa/confirm', requireLogin, twoFALimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Code erforderlich' });

    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user || !user.totp_setup_pending || !user.totp_secret_temp) {
      return res.status(400).json({ error: '2FA-Setup nicht gestartet' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret_temp,
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 1
    });

    if (!valid) return res.status(401).json({ error: 'Ungültiger Code. Bitte erneut versuchen.' });

    await users.updateAsync({ _id: user._id }, {
      $set: {
        totp_secret: user.totp_secret_temp,
        totp_enabled: true,
        totp_enabled_at: new Date().toISOString()
      },
      $unset: { totp_secret_temp: true, totp_setup_pending: true }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('2FA Bestätigungs-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/2fa/verify', twoFALimiter, async (req, res) => {
  try {
    if (!req.session.twofa_pending || !req.session.twofa_userId) {
      return res.status(401).json({ error: 'Keine ausstehende 2FA-Verifizierung' });
    }

    if (Date.now() > req.session.twofa_expires) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Sitzung abgelaufen. Bitte neu einloggen.' });
    }

    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Code erforderlich' });

    const user = await users.findOneAsync({ _id: req.session.twofa_userId });
    if (!user || !user.totp_enabled) return res.status(401).json({ error: 'Session ungültig' });

    if (user.totp_last_used_token === token.replace(/\s/g, '')) {
      return res.status(401).json({ error: 'Code bereits verwendet. Bitte warten Sie auf den nächsten Code.' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 1
    });

    if (!valid) return res.status(401).json({ error: 'Ungültiger Code.' });

    await users.updateAsync({ _id: user._id }, { $set: {
      totp_last_used_token: token.replace(/\s/g, ''),
      last_login_at: new Date().toISOString()
    }});

    await new Promise((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve())
    );

    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    const flags = buildPasswordFlags(user);
    res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!(user.terms_accepted_at || user.consent_given), ...flags });
  } catch (err) {
    console.error('2FA Verify-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/2fa/disable', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admins können 2FA nicht deaktivieren.' });
    }

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Passwort erforderlich' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Passwort falsch' });

    await users.updateAsync({ _id: user._id }, {
      $set: { totp_enabled: false },
      $unset: { totp_secret: true, totp_last_used_token: true, totp_enabled_at: true }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('2FA Disable-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Contract Routes ───────────────────────────────────────────────────────────
app.get('/api/contracts', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const list = await contracts.findAsync({ user_id: userId }).sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/contracts', requireLogin, async (req, res) => {
  try {
    const { category, name, provider, description, premium_amount, premium_cycle, start_date, end_date, details,
            cancellation_deadline, renewal_date, is_own_insurer } = req.body;
    if (!category || !name || !premium_amount || !premium_cycle) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen' });
    }

    const doc = await contracts.insertAsync({
      user_id: req.session.userId,
      category,
      name: name.trim(),
      provider: provider ? provider.trim() : '',
      description: description ? description.trim() : '',
      premium_amount: parseFloat(premium_amount),
      premium_cycle,
      start_date: start_date || '',
      end_date: end_date || '',
      details: details && typeof details === 'object' ? details : {},
      is_own_insurer: category === 'insurance' ? !!is_own_insurer : false,
      cancellation_deadline: cancellation_deadline || '',
      renewal_date: renewal_date || '',
      added_by_role: 'customer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    await logActivity(req.session.userId, 'contract_added', null);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/contracts/:id', requireLogin, async (req, res) => {
  try {
    const contract = await contracts.findOneAsync({ _id: req.params.id, user_id: req.session.userId });
    if (!contract) return res.status(404).json({ error: 'Nicht gefunden' });
    if (contract.added_by_role === 'admin') return res.status(403).json({ error: 'Agentur-Verträge können nicht bearbeitet werden' });

    const { category, name, provider, description, premium_amount, premium_cycle, start_date, end_date, details,
            cancellation_deadline, renewal_date, is_own_insurer } = req.body;

    await contracts.updateAsync({ _id: req.params.id }, {
      $set: {
        category, name: name.trim(),
        provider: provider ? provider.trim() : '',
        description: description ? description.trim() : '',
        premium_amount: parseFloat(premium_amount),
        premium_cycle,
        start_date: start_date || '',
        end_date: end_date || '',
        details: details && typeof details === 'object' ? details : {},
        is_own_insurer: category === 'insurance' ? !!is_own_insurer : false,
        cancellation_deadline: cancellation_deadline || '',
        renewal_date: renewal_date || '',
        updated_at: new Date().toISOString()
      }
    });
    const updated = await contracts.findOneAsync({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/contracts/:id', requireLogin, async (req, res) => {
  try {
    const contract = await contracts.findOneAsync({ _id: req.params.id, user_id: req.session.userId });
    if (!contract) return res.status(404).json({ error: 'Nicht gefunden' });
    if (contract.added_by_role === 'admin') return res.status(403).json({ error: 'Agentur-Verträge können nicht gelöscht werden' });

    if (contract.scan_image) {
      fs.unlink(path.join(__dirname, 'uploads', 'contracts', contract.scan_image), () => {});
    }
    await contracts.removeAsync({ _id: req.params.id });
    await logActivity(req.session.userId, 'contract_deleted', null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Customer Contract Scan Upload ─────────────────────────────────────────────
app.post('/api/contracts/:id/scan', requireLogin,
  (req, res, next) => { uploadScan.single('image')(req, res, next); },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
      const contract = await contracts.findOneAsync({ _id: req.params.id, user_id: req.session.userId });
      if (!contract) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      if (contract.scan_image) {
        fs.unlink(path.join(__dirname, 'uploads', 'contracts', contract.scan_image), () => {});
      }
      await contracts.updateAsync({ _id: req.params.id }, { $set: { scan_image: req.file.filename } });
      res.json({ ok: true, filename: req.file.filename });
    } catch (err) {
      res.status(500).json({ error: 'Serverfehler' });
    }
  }
);

// ── Contact Routes ────────────────────────────────────────────────────────────
app.post('/api/contact', requireLogin, async (req, res) => {
  try {
    const { subject, message, request_type, callback_time } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Betreff und Nachricht erforderlich' });

    await messages.insertAsync({
      user_id: req.session.userId,
      subject: subject.trim(),
      message: message.trim(),
      request_type: request_type || 'message',
      callback_time: callback_time ? callback_time.trim() : '',
      status: 'new',
      created_at: new Date().toISOString()
    });
    await logActivity(req.session.userId, 'message_sent', null);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Profile Routes ────────────────────────────────────────────────────────────
app.get('/api/profile', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });
    res.json({
      email: user.email,
      full_name: user.full_name || '',
      phone: user.phone || '',
      mobile: user.mobile || '',
      birth_date: user.birth_date || '',
      marital_status: user.marital_status || '',
      spouse_name: user.spouse_name || '',
      health_insurance_type: user.health_insurance_type || '',
      health_insurance_provider: user.health_insurance_provider || '',
      gross_income: user.gross_income || '',
      net_income: user.net_income || '',
      beruf: user.beruf || '',
      berufsgruppe: user.berufsgruppe || '',
      wohneigentum: user.wohneigentum || '',
      rente_aktiv:                user.rente_aktiv || '',
      rente:                      user.rente || '',
      minijob_aktiv:              user.minijob_aktiv || '',
      minijob:                    user.minijob || '',
      kindergeld_aktiv:           user.kindergeld_aktiv || '',
      kindergeld:                 user.kindergeld || '',
      andere_einkuenfte_aktiv:    user.andere_einkuenfte_aktiv || '',
      andere_einkuenfte:          user.andere_einkuenfte || '',
      ausgaben_miete:             user.ausgaben_miete || '',
      ausgaben_nebenkosten:       user.ausgaben_nebenkosten || '',
      ausgaben_lebensmittel:      user.ausgaben_lebensmittel || '',
      ausgaben_mobilitaet:        user.ausgaben_mobilitaet || '',
      ausgaben_telekommunikation: user.ausgaben_telekommunikation || '',
      ausgaben_freizeit:          user.ausgaben_freizeit || '',
      ausgaben_kleidung:          user.ausgaben_kleidung || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/profile', requireLogin, async (req, res) => {
  try {
    const NUMERIC_FIELDS = new Set([
      'gross_income', 'net_income',
      'rente', 'minijob', 'kindergeld', 'andere_einkuenfte',
      'ausgaben_miete', 'ausgaben_nebenkosten', 'ausgaben_lebensmittel',
      'ausgaben_mobilitaet', 'ausgaben_telekommunikation',
      'ausgaben_freizeit', 'ausgaben_kleidung'
    ]);
    const allowed = ['full_name', 'phone', 'mobile', 'birth_date', 'marital_status',
      'spouse_name', 'health_insurance_type', 'health_insurance_provider',
      'gross_income', 'net_income', 'beruf', 'berufsgruppe', 'wohneigentum',
      'rente_aktiv', 'rente', 'minijob_aktiv', 'minijob',
      'kindergeld_aktiv', 'kindergeld', 'andere_einkuenfte_aktiv', 'andere_einkuenfte',
      'ausgaben_miete', 'ausgaben_nebenkosten', 'ausgaben_lebensmittel',
      'ausgaben_mobilitaet', 'ausgaben_telekommunikation',
      'ausgaben_freizeit', 'ausgaben_kleidung'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = NUMERIC_FIELDS.has(key)
          ? (req.body[key] === '' ? '' : parseFloat(req.body[key]))
          : String(req.body[key]).trim();
      }
    }
    await users.updateAsync({ _id: req.session.userId }, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Recommendations Route ─────────────────────────────────────────────────────
function generateRecommendations(profile, contractList) {
  const recs = [];
  const names = contractList.map(c => c.name.toLowerCase());
  const has = (...kws) => kws.some(kw => names.some(n => n.includes(kw)));

  // Todesfallabsicherung
  if (!has('risikoleben', 'lebensversicherung')) {
    const isMarried = profile.marital_status === 'verheiratet' || profile.spouse_name;
    recs.push({ type: 'Risikolebensversicherung', priority: 'hoch',
      reason: isMarried
        ? 'Typisch für Familien mit gemeinsamen Verpflichtungen: Eine Risikolebensversicherung könnte sinnvoll sein, um Hinterbliebene finanziell abzusichern.'
        : 'Möglicher Bedarf: Eine Risikolebensversicherung könnte zur Absicherung von Hinterbliebenen oder laufenden Krediten sinnvoll sein.' });
  }

  // Arbeitskraftabsicherung – BU
  if (profile.gross_income > 0 && !has('berufsunfähigkeit', 'berufsunfähigkeits')) {
    recs.push({ type: 'Berufsunfähigkeitsversicherung', priority: 'hoch',
      reason: 'Möglicher Bedarf: Die staatliche Absicherung bei Berufsunfähigkeit ist in vielen Situationen lückenhaft. Eine private BU-Versicherung könnte zur Prüfung empfohlen werden.' });
  }

  // Krankentagegeld
  if (profile.health_insurance_type === 'gkv' && !has('krankentagegeld', 'krankentage')) {
    recs.push({ type: 'Krankentagegeld', priority: 'hoch',
      reason: 'Typisch für GKV-Versicherte: Nach 6 Wochen Krankheit sinkt das Krankengeld. Eine Krankentagegeldversicherung könnte diese Lücke schließen.' });
  }

  // Haftpflicht
  if (!has('haftpflicht')) {
    recs.push({ type: 'Privathaftpflichtversicherung', priority: 'hoch',
      reason: 'Häufig empfohlen: Eine Privathaftpflichtversicherung könnte bei Schäden im Alltag sinnvoll sein und ist typischerweise günstig.' });
  }

  // Hausrat
  if (!has('hausrat')) {
    recs.push({ type: 'Hausratversicherung', priority: 'mittel',
      reason: 'Möglicher Bedarf: Eine Hausratversicherung könnte den Hausrat bei Feuer, Einbruch oder Wasserschäden absichern.' });
  }

  // Rechtsschutz
  if (!has('rechtsschutz')) {
    recs.push({ type: 'Rechtsschutzversicherung', priority: 'niedrig',
      reason: 'Zur Prüfung empfohlen: Eine Rechtsschutzversicherung könnte bei Anwalts- und Gerichtskosten im Alltag, Beruf oder Verkehr helfen.' });
  }

  // Wohneigentum
  const isOwner = profile.wohneigentum === 'eigentuemer-haus' || profile.wohneigentum === 'eigentuemer-wohnung';
  if (isOwner && !has('gebäude', 'gebaeude', 'wohngebäude')) {
    recs.push({ type: 'Gebäudeversicherung', priority: 'hoch',
      reason: 'Typisch für Eigentümer: Eine Gebäudeversicherung könnte bei Schäden durch Feuer, Sturm oder Leitungswasser sinnvoll sein.' });
  }
  if (isOwner && !has('grundbesitzer', 'haus- und grund', 'hauseigentümer')) {
    recs.push({ type: 'Haus- und Grundbesitzerhaftpflicht', priority: 'hoch',
      reason: 'Möglicher Bedarf für Eigentümer: Diese Versicherung könnte bei Haftungsansprüchen Dritter auf dem eigenen Grundstück sinnvoll sein.' });
  }

  return recs;
}

app.get('/api/recommendations', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });

    if (!user.consent_analysis) {
      return res.json({ recommendations: [], profile_complete: false, consent_required: true });
    }

    const contractList = await contracts.findAsync({ user_id: req.session.userId });
    const profileComplete = !!(user.health_insurance_type || user.gross_income || user.marital_status);
    const recs = generateRecommendations(user, contractList);
    res.json({ recommendations: recs, profile_complete: profileComplete });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Activity Log Helper ───────────────────────────────────────────────────────
async function logActivity(userId, type, _description) {
  try {
    await activityLog.insertAsync({ user_id: userId, type, created_at: new Date().toISOString() });
  } catch (e) {}
}

// ── Settings Routes ───────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const s = await settings.findOneAsync({});
    res.json(s || {});
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const allowed = ['agency_name', 'address', 'phone', 'email', 'opening_hours', 'whatsapp'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = String(req.body[key]);
    }
    await settings.updateAsync({}, { $set: update }, { upsert: true });
    const updated = await settings.findOneAsync({});
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Admin-Account Verwaltung ───────────────────────────────────────────────────
app.get('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const admins = await users.findAsync({ role: 'admin' }).sort({ created_at: 1 });
    res.json(admins.map(a => ({ id: a._id, email: a.email, full_name: a.full_name, created_at: a.created_at })));
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const { email, full_name, password } = req.body;
    if (!email || !full_name || !password) return res.status(400).json({ error: 'E-Mail, Name und Passwort erforderlich' });
    if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
    const hash = await bcrypt.hash(password, 12);
    const admin = await users.insertAsync({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      full_name: full_name.trim(),
      role: 'admin',
      must_change_password: true,
      created_at: new Date().toISOString()
    });
    res.status(201).json({ id: admin._id, email: admin.email, full_name: admin.full_name });
  } catch (err) {
    if (err.errorType === 'uniqueViolated') return res.status(409).json({ error: 'E-Mail bereits vergeben' });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/admin/admins/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.session.userId) return res.status(400).json({ error: 'Du kannst deinen eigenen Account nicht löschen' });
    const admin = await users.findOneAsync({ _id: req.params.id, role: 'admin' });
    if (!admin) return res.status(404).json({ error: 'Admin nicht gefunden' });
    await users.removeAsync({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Admin Routes – nur Metadaten ──────────────────────────────────────────────
app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    await logActivity(req.session.userId, 'admin_customer_list_viewed', null);
    const customerList = await users.findAsync({ role: 'customer' }).sort({ created_at: -1 });
    const result = customerList.map(c => ({
      id: c._id,
      email: c.email,
      full_name: c.full_name,
      created_at: c.created_at,
      last_login_at: c.last_login_at || null,
      consent_analysis: !!c.consent_analysis
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const { email, full_name, password } = req.body;
    if (!email || !full_name || !password) return res.status(400).json({ error: 'E-Mail, Name und Passwort erforderlich' });
    if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

    const hash = await bcrypt.hash(password, 12);
    const user = await users.insertAsync({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      full_name: full_name.trim(),
      role: 'customer',
      must_change_password: true,
      created_at: new Date().toISOString()
    });
    await logActivity(user._id, 'customer_created', null);
    res.status(201).json({ id: user._id, email: user.email, full_name: user.full_name });
  } catch (err) {
    if (err.errorType === 'uniqueViolated') return res.status(409).json({ error: 'E-Mail bereits vergeben' });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.params.id, role: 'customer' });
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' });

    // Scan-Dateien löschen
    const userContracts = await contracts.findAsync({ user_id: req.params.id });
    for (const c of userContracts) {
      if (c.scan_image) {
        fs.unlink(path.join(__dirname, 'uploads', 'contracts', c.scan_image), () => {});
      }
    }

    await users.removeAsync({ _id: req.params.id });
    await contracts.removeAsync({ user_id: req.params.id }, { multi: true });
    await messages.removeAsync({ user_id: req.params.id }, { multi: true });
    await activityLog.removeAsync({ user_id: req.params.id }, { multi: true });

    await logActivity(req.session.userId, 'admin_customer_deleted', null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Admin Messages ────────────────────────────────────────────────────────────
app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
    await logActivity(req.session.userId, 'admin_messages_viewed', null);
    const msgs = await messages.findAsync({}).sort({ created_at: -1 });
    const result = await Promise.all(msgs.map(async m => {
      const user = await users.findOneAsync({ _id: m.user_id });
      return { ...m, customer_name: user ? user.full_name : 'Unbekannt', customer_email: user ? user.email : '' };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.patch('/api/admin/messages/:id/read', requireAdmin, async (req, res) => {
  try {
    await messages.updateAsync({ _id: req.params.id }, { $set: { status: 'read' } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/admin/messages/:userId', requireAdmin, async (req, res) => {
  try {
    const list = await messages.findAsync({ user_id: req.params.userId }).sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Appointments Routes ───────────────────────────────────────────────────────
app.get('/api/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    let query = {};
    if (month) {
      query = { date: { $regex: new RegExp('^' + month) } };
    }
    const list = await appointments.findAsync(query).sort({ date: 1, time: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { title, date, time, notes } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Titel und Datum erforderlich' });
    const doc = await appointments.insertAsync({
      title:      title.trim(),
      date:       date,
      time:       time || '',
      notes:      notes ? notes.trim() : '',
      created_at: new Date().toISOString()
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const appt = await appointments.findOneAsync({ _id: req.params.id });
    if (!appt) return res.status(404).json({ error: 'Nicht gefunden' });
    await appointments.removeAsync({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

async function migratePasswordFields() {
  try {
    const result = await users.updateAsync(
      { password_changed_at: { $exists: false }, must_change_password: { $exists: false } },
      { $set: { must_change_password: true } },
      { multi: true }
    );
    if (result > 0) {
      console.log(`✓ Migration: ${result} Benutzer müssen ihr Passwort beim nächsten Login ändern`);
    }
  } catch (err) {
    console.error('Warnung: Migration der Passwort-Felder fehlgeschlagen:', err.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
Promise.all([seedAdmin(), seedSettings(), migratePasswordFields()]).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`\nKundenportal läuft auf http://localhost:${PORT}`);
    console.log('Zum Beenden: Strg+C\n');
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nFEHLER: Port ${PORT} ist bereits belegt!`);
      console.error(`Bitte andere Anwendung auf Port ${PORT} beenden oder PORT in .env ändern.\n`);
    } else {
      console.error('\nServer-Fehler:', err.message);
    }
    process.exit(1);
  });
});
