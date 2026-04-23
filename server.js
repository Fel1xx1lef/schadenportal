require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const { users, cases, timeline, documents, messages, settings, getNextCaseNumber, seedAdmin, seedSettings } = require('./db');
const { requireLogin, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads', 'documents');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.headers['x-requested-with'])
    return res.status(403).json({ error: 'CSRF-Schutz: Header fehlt.' });
  next();
});

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Session ───────────────────────────────────────────────────────────────────
const FileStore = require('session-file-store')(session);
const sessionStore = new FileStore({ path: path.join(DATA_DIR, 'sessions'), ttl: 28800, retries: 0 });
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  name: 'sid',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 },
}));

app.use(express.static(path.join(__dirname, 'public')));

// ── Upload ────────────────────────────────────────────────────────────────────
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => ALLOWED_MIMES.includes(file.mimetype) ? cb(null, true) : cb(new Error('Nur JPG, PNG, WebP und PDF erlaubt.')),
});

// ── Mailer ────────────────────────────────────────────────────────────────────
async function sendNotificationEmail(toEmail, toName, caseNumber, updateText) {
  if (!process.env.SMTP_HOST) return { ok: false, reason: 'SMTP nicht konfiguriert' };
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Felix Schindelhauer GmbH'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Update zu Ihrem Schadensfall ${caseNumber}`,
      text: `Guten Tag ${toName},\n\nIhr Schadensfall ${caseNumber} wurde aktualisiert:\n\n${updateText}\n\nMit freundlichen Gruessen\nFelix Schindelhauer GmbH - Continentale`,
      html: `<p>Guten Tag ${toName},</p><p>Ihr Schadensfall <strong>${caseNumber}</strong> wurde aktualisiert:</p><blockquote style="border-left:3px solid #1d5ec7;padding:8px 16px;margin:16px 0;color:#333">${updateText}</blockquote><p>Mit freundlichen Gruessen<br><strong>Felix Schindelhauer GmbH &ndash; Continentale</strong></p>`,
    });
    return { ok: true };
  } catch (err) {
    console.error('E-Mail-Fehler:', err.message);
    return { ok: false, reason: err.message };
  }
}

// ── Rate limiters ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const postLimiter  = rateLimit({ windowMs: 60 * 1000, max: 30 });

// =============================================================================
// AUTH
// =============================================================================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });
    const user = await users.findOneAsync({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Ungueltige Anmeldedaten.' });
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Ungueltige Anmeldedaten.' });
    await new Promise((ok, fail) => req.session.regenerate(e => e ? fail(e) : ok()));
    req.session.userId = user._id;
    req.session.role = user.role;
    await users.updateAsync({ _id: user._id }, { $set: { last_login_at: new Date().toISOString() } });
    res.json({ ok: true, role: user.role, must_change_password: !!user.must_change_password });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/auth/logout', requireLogin, (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/auth/me', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/auth/change-password', requireLogin, postLimiter, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!await bcrypt.compare(current_password, user.password_hash)) return res.status(400).json({ error: 'Aktuelles Passwort falsch.' });
    if (!new_password || new_password.length < 12) return res.status(400).json({ error: 'Mind. 12 Zeichen erforderlich.' });
    if (!/[A-Z]/.test(new_password)) return res.status(400).json({ error: 'Grossbuchstabe erforderlich.' });
    if (!/[0-9]/.test(new_password)) return res.status(400).json({ error: 'Ziffer erforderlich.' });
    const hash = await bcrypt.hash(new_password, 12);
    await users.updateAsync({ _id: req.session.userId }, { $set: { password_hash: hash, must_change_password: false, password_changed_at: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// PROFILE
// =============================================================================
app.get('/api/profile', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.put('/api/profile', requireLogin, postLimiter, async (req, res) => {
  try {
    const update = {};
    for (const key of ['full_name', 'phone', 'mobile', 'notification_preference']) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.notification_preference && !['email', 'whatsapp'].includes(update.notification_preference))
      return res.status(400).json({ error: 'Ungueltige Benachrichtigungspraeferenz.' });
    await users.updateAsync({ _id: req.session.userId }, { $set: update });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// CASES
// =============================================================================
const SPARTEN = ['hausrat', 'wohngebaeude', 'haftpflicht', 'kfz', 'glas'];

app.get('/api/cases', requireLogin, async (req, res) => {
  try {
    const query = req.session.role === 'admin' ? {} : { user_id: req.session.userId };
    if (req.query.sparte && SPARTEN.includes(req.query.sparte)) query.sparte = req.query.sparte;
    if (req.query.status) query.status = req.query.status;
    let result = await cases.findAsync(query);
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (req.session.role === 'admin') {
      const userIds = [...new Set(result.map(c => c.user_id))];
      const ul = await users.findAsync({ _id: { $in: userIds } });
      const um = Object.fromEntries(ul.map(u => [u._id, u.full_name]));
      result = result.map(c => ({ ...c, customer_name: um[c.user_id] || '-' }));
    }
    const caseIds = result.map(c => c._id);
    const unreadField = req.session.role === 'admin' ? 'read_by_admin' : 'read_by_customer';
    const unread = await messages.findAsync({ case_id: { $in: caseIds }, [unreadField]: false });
    const unreadMap = {};
    for (const m of unread) unreadMap[m.case_id] = (unreadMap[m.case_id] || 0) + 1;
    result = result.map(c => ({ ...c, unread_messages: unreadMap[c._id] || 0 }));
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/cases', requireLogin, postLimiter, async (req, res) => {
  try {
    const { sparte, title, description, damage_date } = req.body;
    if (!SPARTEN.includes(sparte)) return res.status(400).json({ error: 'Ungueltige Sparte.' });
    if (!title || title.trim().length < 3) return res.status(400).json({ error: 'Titel zu kurz (mind. 3 Zeichen).' });
    if (!damage_date) return res.status(400).json({ error: 'Schadensdatum fehlt.' });
    const case_number = await getNextCaseNumber();
    const now = new Date().toISOString();
    const c = await cases.insertAsync({ user_id: req.session.userId, case_number, sparte, title: title.trim(), description: (description || '').trim(), damage_date, status: 'offen', created_at: now, updated_at: now });
    await timeline.insertAsync({ case_id: c._id, author_role: 'customer', text: 'Schadensfall wurde gemeldet.', created_at: now });
    res.status(201).json(c);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.get('/api/cases/:id', requireLogin, async (req, res) => {
  try {
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    if (req.session.role === 'admin') {
      const cu = await users.findOneAsync({ _id: c.user_id });
      c.customer_name = cu ? cu.full_name : '-';
      c.customer_email = cu ? cu.email : '-';
      c.customer_phone = cu ? (cu.mobile || cu.phone || '') : '';
      c.customer_notification = cu ? (cu.notification_preference || 'email') : 'email';
    }
    res.json(c);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.patch('/api/cases/:id/status', requireAdmin, postLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['offen', 'in_bearbeitung', 'abgeschlossen'].includes(status)) return res.status(400).json({ error: 'Ungueltiger Status.' });
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    await cases.updateAsync({ _id: req.params.id }, { $set: { status, updated_at: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// TIMELINE
// =============================================================================
app.get('/api/cases/:id/timeline', requireLogin, async (req, res) => {
  try {
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    const entries = await timeline.findAsync({ case_id: req.params.id });
    entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(entries);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/cases/:id/timeline', requireLogin, postLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 2) return res.status(400).json({ error: 'Text zu kurz.' });
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    const entry = await timeline.insertAsync({ case_id: req.params.id, author_role: req.session.role, text: text.trim(), created_at: new Date().toISOString() });
    await cases.updateAsync({ _id: req.params.id }, { $set: { updated_at: new Date().toISOString() } });
    res.status(201).json(entry);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// DOCUMENTS
// =============================================================================
app.get('/api/cases/:id/documents', requireLogin, async (req, res) => {
  try {
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    const docs = await documents.findAsync({ case_id: req.params.id });
    docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(docs);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/cases/:id/documents', requireLogin, postLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) { try { fs.unlinkSync(req.file.path); } catch {} return res.status(404).json({ error: 'Fall nicht gefunden.' }); }
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) { try { fs.unlinkSync(req.file.path); } catch {} return res.status(403).json({ error: 'Kein Zugriff.' }); }
    const doc_type = (req.body && req.body.doc_type) ? req.body.doc_type : 'Sonstiges';
    const doc = await documents.insertAsync({ case_id: req.params.id, uploaded_by_role: req.session.role, filename: req.file.filename, original_name: req.file.originalname, mimetype: req.file.mimetype, doc_type, created_at: new Date().toISOString() });
    res.status(201).json(doc);
  } catch (err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message || 'Serverfehler.' });
  }
});

app.patch('/api/timeline/:entryId', requireAdmin, postLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 2) return res.status(400).json({ error: 'Text zu kurz.' });
    const entry = await timeline.findOneAsync({ _id: req.params.entryId });
    if (!entry) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
    await timeline.updateAsync({ _id: req.params.entryId }, { $set: { text: text.trim(), edited_at: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.get('/uploads/documents/:filename', requireLogin, (req, res) => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Datei nicht gefunden.' });
  res.sendFile(filePath);
});

app.delete('/api/documents/:docId', requireLogin, postLimiter, async (req, res) => {
  try {
    const doc = await documents.findOneAsync({ _id: req.params.docId });
    if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden.' });
    const c = await cases.findOneAsync({ _id: doc.case_id });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    const fp = path.join(UPLOADS_DIR, doc.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await documents.removeAsync({ _id: req.params.docId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// MESSAGES
// =============================================================================
app.get('/api/cases/:id/messages', requireLogin, async (req, res) => {
  try {
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    const msgs = await messages.findAsync({ case_id: req.params.id });
    msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const field = req.session.role === 'admin' ? 'read_by_admin' : 'read_by_customer';
    await messages.updateAsync({ case_id: req.params.id, [field]: false }, { $set: { [field]: true } }, { multi: true });
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/cases/:id/messages', requireLogin, postLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 2) return res.status(400).json({ error: 'Nachricht zu kurz.' });
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    if (req.session.role !== 'admin' && c.user_id !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });
    const user = await users.findOneAsync({ _id: req.session.userId });
    const msg = await messages.insertAsync({
      case_id: req.params.id,
      author_id: req.session.userId,
      author_role: req.session.role,
      author_name: user ? user.full_name : '-',
      text: text.trim(),
      read_by_admin: req.session.role === 'admin',
      read_by_customer: req.session.role === 'customer',
      created_at: new Date().toISOString(),
    });
    await cases.updateAsync({ _id: req.params.id }, { $set: { updated_at: new Date().toISOString() } });
    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// NOTIFICATION
// =============================================================================
app.post('/api/cases/:id/notify', requireAdmin, postLimiter, async (req, res) => {
  try {
    const { update_text } = req.body;
    const c = await cases.findOneAsync({ _id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Fall nicht gefunden.' });
    const customer = await users.findOneAsync({ _id: c.user_id });
    if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden.' });
    const pref = customer.notification_preference || 'email';
    if (pref === 'whatsapp') {
      const phone = (customer.mobile || customer.phone || '').replace(/\D/g, '');
      const waPhone = phone.startsWith('0') ? '49' + phone.slice(1) : phone;
      const text = encodeURIComponent('Hallo ' + customer.full_name + ', Ihr Schadensfall ' + c.case_number + ' wurde aktualisiert: ' + (update_text || 'Bitte schauen Sie ins Portal.'));
      return res.json({ ok: true, method: 'whatsapp', url: 'https://wa.me/' + waPhone + '?text=' + text });
    }
    const result = await sendNotificationEmail(customer.email, customer.full_name, c.case_number, update_text || 'Ihr Fall wurde aktualisiert.');
    res.json({ ok: result.ok, method: 'email', reason: result.reason });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Serverfehler.' }); }
});

// =============================================================================
// ADMIN
// =============================================================================
app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const list = await users.findAsync({ role: 'customer' });
    const safe = list.map(({ password_hash, ...u }) => u);
    safe.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(safe);
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.post('/api/admin/customers', requireAdmin, postLimiter, async (req, res) => {
  try {
    const { email, full_name, password, phone, mobile, notification_preference } = req.body;
    if (!email || !full_name || !password) return res.status(400).json({ error: 'E-Mail, Name und Passwort erforderlich.' });
    if (password.length < 12) return res.status(400).json({ error: 'Passwort muss mind. 12 Zeichen haben.' });
    const hash = await bcrypt.hash(password, 12);
    const user = await users.insertAsync({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      full_name: full_name.trim(),
      phone: phone || '',
      mobile: mobile || '',
      role: 'customer',
      notification_preference: notification_preference || 'email',
      must_change_password: true,
      created_at: new Date().toISOString(),
    });
    const { password_hash, ...safe } = user;
    res.status(201).json(safe);
  } catch (err) {
    if (err.errorType === 'uniqueViolated') return res.status(409).json({ error: 'E-Mail bereits vergeben.' });
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

app.put('/api/admin/customers/:id/password', requireAdmin, postLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 12) return res.status(400).json({ error: 'Passwort muss mind. 12 Zeichen haben.' });
    const hash = await bcrypt.hash(password, 12);
    await users.updateAsync({ _id: req.params.id }, { $set: { password_hash: hash, must_change_password: true } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

app.delete('/api/admin/customers/:id', requireAdmin, postLimiter, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.params.id });
    if (!user || user.role !== 'customer') return res.status(404).json({ error: 'Kunde nicht gefunden.' });
    const userCases = await cases.findAsync({ user_id: req.params.id });
    for (const c of userCases) {
      const docs = await documents.findAsync({ case_id: c._id });
      for (const doc of docs) { const fp = path.join(UPLOADS_DIR, doc.filename); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
      await documents.removeAsync({ case_id: c._id }, { multi: true });
      await timeline.removeAsync({ case_id: c._id }, { multi: true });
      await messages.removeAsync({ case_id: c._id }, { multi: true });
    }
    await cases.removeAsync({ user_id: req.params.id }, { multi: true });
    await users.removeAsync({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Serverfehler.' }); }
});

app.get('/api/settings', async (req, res) => {
  try { res.json(await settings.findOneAsync({}) || {}); }
  catch (err) { res.status(500).json({ error: 'Serverfehler.' }); }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  await seedAdmin();
  await seedSettings();
  app.listen(PORT, () => console.log('\nSchadenportal laeuft auf http://localhost:' + PORT + '\n'));
})();
