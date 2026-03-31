require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { users, contracts, messages, crm, activityLog, settings, tasks, consultations, appointments, seedAdmin, seedSettings } = require('./db');
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
    maxAge: 8 * 60 * 60 * 1000  // 8 Stunden
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Loginversuche. Bitte 15 Minuten warten.' }
});

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

    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    res.json({ ok: true, role: user.role, name: user.full_name, consent_given: !!user.consent_given });
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
    res.json({ id: user._id, email: user.email, full_name: user.full_name, role: user.role, phone: user.phone || '',
      consent_given: !!user.consent_given, consent_advisory: !!user.consent_advisory, consent_offers: !!user.consent_offers });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/consent', requireLogin, async (req, res) => {
  try {
    const { consent_display_and_analysis, consent_advisory, consent_offers } = req.body;
    if (!consent_display_and_analysis) return res.status(400).json({ error: 'Grundeinwilligung erforderlich' });
    await users.updateAsync({ _id: req.session.userId }, { $set: {
      consent_given: true,
      consent_display_and_analysis: true,
      consent_advisory: !!consent_advisory,
      consent_offers: !!consent_offers,
      consent_date: new Date().toISOString()
    }});
    res.json({ ok: true });
  } catch (err) {
    console.error('Consent-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/auth/consent', requireLogin, async (req, res) => {
  try {
    const { consent_advisory, consent_offers } = req.body;
    await users.updateAsync({ _id: req.session.userId }, { $set: {
      consent_advisory: !!consent_advisory,
      consent_offers: !!consent_offers,
      updated_at: new Date().toISOString()
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
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort falsch' });

    const hash = await bcrypt.hash(new_password, 12);
    await users.updateAsync({ _id: req.session.userId }, { $set: { password_hash: hash } });
    res.json({ ok: true });
  } catch (err) {
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

    const user = await users.findOneAsync({ _id: req.session.userId });
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
      consent_display_and_analysis: !!user.consent_display_and_analysis,
      consent_advisory: !!user.consent_advisory,
      consent_offers: !!user.consent_offers,
      consent_date: user.consent_date || null,
      added_by_role: 'customer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    await logActivity(req.session.userId, 'contract_added_customer', `Kunde hat Vertrag hinzugefügt: ${doc.name}`);
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
            cancellation_deadline, renewal_date, consent_display_and_analysis, consent_advisory, consent_offers,
            is_own_insurer } = req.body;
    const consentUpdate = {};
    if (consent_display_and_analysis !== undefined) consentUpdate.consent_display_and_analysis = !!consent_display_and_analysis;
    if (consent_advisory !== undefined) consentUpdate.consent_advisory = !!consent_advisory;
    if (consent_offers !== undefined) consentUpdate.consent_offers = !!consent_offers;

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
        ...consentUpdate,
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

    await contracts.removeAsync({ _id: req.params.id });
    await logActivity(req.session.userId, 'contract_deleted', `Vertrag gelöscht: ${contract.name}`);
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
    await logActivity(req.session.userId, 'message_received', `Nachricht eingegangen: ${subject.trim()}`);
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

  // Priorität 1 (Leitfaden): Todesfallabsicherung
  if (!has('risikoleben', 'lebensversicherung')) {
    const isMarried = profile.marital_status === 'verheiratet' || profile.spouse_name;
    recs.push({ type: 'Risikolebensversicherung', priority: 'hoch',
      reason: isMarried
        ? 'Ihr Ehepartner und Ihre Familie sind auf Ihr Einkommen angewiesen. Eine Risikolebensversicherung schützt sie finanziell, falls Ihnen etwas zustoßen sollte.'
        : 'Wer schützt Ihre Familie, wenn Sie nicht mehr da sind? Eine Risikolebensversicherung sichert Hinterbliebene und laufende Kredite zu sehr günstigen Beiträgen ab.' });
  }

  // Priorität 2 (Leitfaden): Arbeitskraftabsicherung – BU
  if (profile.gross_income > 0 && !has('berufsunfähigkeit', 'berufsunfähigkeits')) {
    recs.push({ type: 'Berufsunfähigkeitsversicherung', priority: 'hoch',
      reason: 'Ihr Einkommen ist Ihr größtes Kapital. Staatliche Absicherung reicht bei Berufsunfähigkeit nicht aus. Je früher Sie absichern, desto günstiger der Beitrag.' });
  }

  // Priorität 2 (Leitfaden): Arbeitskraftabsicherung – Krankentagegeld
  if (profile.health_insurance_type === 'gkv' && !has('krankentagegeld', 'krankentage')) {
    recs.push({ type: 'Krankentagegeld', priority: 'hoch',
      reason: 'Als GKV-Versicherter erhalten Sie nach 6 Wochen Krankheit nur noch ca. 70 % Ihres Einkommens. Eine Krankentagegeldversicherung schließt diese Lücke.' });
  }

  // Ergänzend (Leitfaden): existenzieller Basisschutz
  if (!has('haftpflicht')) {
    recs.push({ type: 'Privathaftpflichtversicherung', priority: 'hoch',
      reason: 'Schützt Sie vor existenziellen Schäden durch Missgeschicke im Alltag. Unverzichtbar für jeden – und dabei sehr günstig.' });
  }
  if (!has('hausrat')) {
    recs.push({ type: 'Hausratversicherung', priority: 'mittel',
      reason: 'Schützt Ihren gesamten Hausrat vor Feuer, Einbruch und Wasserschäden – oft unterschätzt, aber günstig.' });
  }
  if (!has('rechtsschutz')) {
    recs.push({ type: 'Rechtsschutzversicherung', priority: 'niedrig',
      reason: 'Schützt Sie vor hohen Anwalts- und Gerichtskosten im Alltag, Beruf und Verkehr.' });
  }

  // Wohneigentum: Gebäude- und Haus-/Grundbesitzerhaftpflicht
  const isOwner = profile.wohneigentum === 'eigentuemer-haus' || profile.wohneigentum === 'eigentuemer-wohnung';
  if (isOwner && !has('gebäude', 'gebaeude', 'wohngebäude')) {
    recs.push({ type: 'Gebäudeversicherung', priority: 'hoch',
      reason: 'Als Eigentümer sind Sie für Schäden am Gebäude selbst verantwortlich. Eine Gebäudeversicherung schützt vor den finanziellen Folgen von Feuer, Sturm, Hagel und Leitungswasserschäden.' });
  }
  if (isOwner && !has('grundbesitzer', 'haus- und grund', 'hauseigentümer')) {
    recs.push({ type: 'Haus- und Grundbesitzerhaftpflicht', priority: 'hoch',
      reason: 'Als Eigentümer haften Sie für Schäden, die Dritten auf Ihrem Grundstück entstehen – z.B. durch Schnee, Eis oder bauliche Mängel. Diese Versicherung schützt vor Schadensersatzforderungen.' });
  }

  return recs;
}

app.get('/api/recommendations', requireLogin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.session.userId });
    if (!user) return res.status(401).json({ error: 'Session ungültig' });

    const contractList = await contracts.findAsync({ user_id: req.session.userId });
    const profileComplete = !!(user.health_insurance_type || user.gross_income || user.marital_status);
    const recs = generateRecommendations(user, contractList);
    res.json({ recommendations: recs, profile_complete: profileComplete });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Activity Log Helper ───────────────────────────────────────────────────────
async function logActivity(userId, type, description) {
  try {
    await activityLog.insertAsync({ user_id: userId, type, description, created_at: new Date().toISOString() });
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

// ── Admin Routes ──────────────────────────────────────────────────────────────
app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const customers = await users.findAsync({ role: 'customer' }).sort({ created_at: -1 });
    const result = await Promise.all(customers.map(async c => {
      const count = await contracts.countAsync({ user_id: c._id });
      const crmRecord = await crm.findOneAsync({ user_id: c._id });
      return {
        id: c._id, email: c.email, full_name: c.full_name, phone: c.phone || '',
        birthday: c.birthday || '',
        created_at: c.created_at, contract_count: count,
        crm_status: crmRecord ? crmRecord.status : '',
        wiedervorlage: crmRecord ? crmRecord.wiedervorlage : '',
        consent_given: !!c.consent_given,
        consent_advisory: !!c.consent_advisory,
        consent_offers: !!c.consent_offers
      };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const { email, full_name, phone, password, birthday } = req.body;
    if (!email || !full_name || !password) return res.status(400).json({ error: 'E-Mail, Name und Passwort erforderlich' });
    if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

    const hash = await bcrypt.hash(password, 12);
    const user = await users.insertAsync({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : '',
      birthday: birthday ? birthday.trim() : '',
      role: 'customer',
      created_at: new Date().toISOString()
    });
    await logActivity(user._id, 'customer_created', 'Kunde angelegt');
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

    await users.removeAsync({ _id: req.params.id });
    await contracts.removeAsync({ user_id: req.params.id }, { multi: true });
    await messages.removeAsync({ user_id: req.params.id }, { multi: true });
    await crm.removeAsync({ user_id: req.params.id });
    await activityLog.removeAsync({ user_id: req.params.id }, { multi: true });
    await tasks.removeAsync({ user_id: req.params.id }, { multi: true });
    await consultations.removeAsync({ user_id: req.params.id }, { multi: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/contracts', requireAdmin, async (req, res) => {
  try {
    const { user_id, category, name, provider, description, premium_amount, premium_cycle, start_date, end_date, details } = req.body;
    if (!user_id || !category || !name || !premium_amount || !premium_cycle) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen' });
    }

    const customer = await users.findOneAsync({ _id: user_id, role: 'customer' });
    if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

    const doc = await contracts.insertAsync({
      user_id,
      category,
      name: name.trim(),
      provider: provider ? provider.trim() : '',
      description: description ? description.trim() : '',
      premium_amount: parseFloat(premium_amount),
      premium_cycle,
      start_date: start_date || '',
      end_date: end_date || '',
      details: details && typeof details === 'object' ? details : {},
      is_own_insurer: true,
      added_by_role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    await logActivity(user_id, 'contract_added_admin', `Vertrag hinzugefügt: ${doc.name} (${doc.category})`);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/admin/contracts/:id', requireAdmin, async (req, res) => {
  try {
    const contract = await contracts.findOneAsync({ _id: req.params.id });
    if (!contract) return res.status(404).json({ error: 'Nicht gefunden' });

    const { category, name, provider, description, premium_amount, premium_cycle, start_date, end_date, details,
            cancellation_deadline, renewal_date } = req.body;
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

app.delete('/api/admin/contracts/:id', requireAdmin, async (req, res) => {
  try {
    const contract = await contracts.findOneAsync({ _id: req.params.id });
    if (!contract) return res.status(404).json({ error: 'Nicht gefunden' });
    await contracts.removeAsync({ _id: req.params.id });
    await logActivity(contract.user_id, 'contract_deleted', `Vertrag gelöscht: ${contract.name}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
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

app.get('/api/admin/contracts/:userId', requireAdmin, async (req, res) => {
  try {
    const list = await contracts.findAsync({ user_id: req.params.userId }).sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── CRM Routes ────────────────────────────────────────────────────────────────
app.get('/api/admin/crm/:userId', requireAdmin, async (req, res) => {
  try {
    const record = await crm.findOneAsync({ user_id: req.params.userId }) || {
      user_id: req.params.userId, status: '', wiedervorlage: '', notes: ''
    };
    const log = await activityLog.findAsync({ user_id: req.params.userId }).sort({ created_at: -1 });
    res.json({ record, log });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/admin/crm/:userId', requireAdmin, async (req, res) => {
  try {
    const { status, wiedervorlage, notes } = req.body;
    await crm.updateAsync(
      { user_id: req.params.userId },
      { $set: { user_id: req.params.userId, status: status || '', wiedervorlage: wiedervorlage || '', notes: notes || '', updated_at: new Date().toISOString() } },
      { upsert: true }
    );
    const updated = await crm.findOneAsync({ user_id: req.params.userId });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Messages per Customer ─────────────────────────────────────────────────────
app.get('/api/admin/messages/:userId', requireAdmin, async (req, res) => {
  try {
    const list = await messages.findAsync({ user_id: req.params.userId }).sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Tasks Routes ──────────────────────────────────────────────────────────────
app.get('/api/admin/tasks/:userId', requireAdmin, async (req, res) => {
  try {
    const list = await tasks.findAsync({ user_id: req.params.userId }).sort({ due_date: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/tasks/:userId', requireAdmin, async (req, res) => {
  try {
    const { title, due_date, priority } = req.body;
    if (!title || !due_date || !priority) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
    const doc = await tasks.insertAsync({
      user_id:    req.params.userId,
      title:      title.trim(),
      due_date:   due_date,
      priority:   priority,
      status:     'offen',
      created_at: new Date().toISOString()
    });
    await logActivity(req.params.userId, 'task_created', `Aufgabe erstellt: ${doc.title}`);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.patch('/api/admin/tasks/:taskId/toggle', requireAdmin, async (req, res) => {
  try {
    const task = await tasks.findOneAsync({ _id: req.params.taskId });
    if (!task) return res.status(404).json({ error: 'Nicht gefunden' });
    const newStatus = task.status === 'offen' ? 'erledigt' : 'offen';
    await tasks.updateAsync({ _id: req.params.taskId }, { $set: { status: newStatus } });
    res.json({ ok: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/admin/tasks/:taskId', requireAdmin, async (req, res) => {
  try {
    const task = await tasks.findOneAsync({ _id: req.params.taskId });
    if (!task) return res.status(404).json({ error: 'Nicht gefunden' });
    await tasks.removeAsync({ _id: req.params.taskId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/admin/tasks-overview', requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const allOpen = await tasks.findAsync({ status: 'offen' }).sort({ due_date: 1 });
    const userMap = {};
    const overdue = [];
    const dueThisWeek = [];

    for (const t of allOpen) {
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      if (!userMap[t.user_id]) {
        const u = await users.findOneAsync({ _id: t.user_id });
        userMap[t.user_id] = u ? u.full_name : 'Unbekannt';
      }
      const enriched = { ...t, customer_name: userMap[t.user_id] };
      if (due < today) {
        overdue.push(enriched);
      } else if (due <= weekEnd) {
        dueThisWeek.push(enriched);
      }
    }

    res.json({ overdue, dueThisWeek });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Admin Customer Profile Routes ─────────────────────────────────────────────
app.get('/api/admin/customers/:id/profile', requireAdmin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.params.id, role: 'customer' });
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      mobile: user.mobile || '',
      birth_date: user.birth_date || user.birthday || '',
      marital_status: user.marital_status || '',
      spouse_name: user.spouse_name || '',
      health_insurance_type: user.health_insurance_type || '',
      health_insurance_provider: user.health_insurance_provider || '',
      gross_income: user.gross_income || '',
      net_income: user.net_income || '',
      beruf: user.beruf || '',
      berufsgruppe: user.berufsgruppe || '',
      wohneigentum: user.wohneigentum || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/admin/customers/:id/profile', requireAdmin, async (req, res) => {
  try {
    const user = await users.findOneAsync({ _id: req.params.id, role: 'customer' });
    if (!user) return res.status(404).json({ error: 'Nicht gefunden' });

    const allowed = ['full_name', 'email', 'phone', 'mobile', 'birth_date',
      'marital_status', 'spouse_name', 'health_insurance_type',
      'health_insurance_provider', 'gross_income', 'net_income',
      'beruf', 'berufsgruppe', 'wohneigentum'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = (key === 'gross_income' || key === 'net_income')
          ? (req.body[key] === '' ? '' : parseFloat(req.body[key]))
          : String(req.body[key]).trim();
      }
    }
    if (update.birth_date !== undefined) update.birthday = update.birth_date;
    if (update.email) {
      const newEmail = update.email.toLowerCase();
      if (newEmail !== user.email) {
        const existing = await users.findOneAsync({ email: newEmail });
        if (existing) return res.status(409).json({ error: 'E-Mail bereits vergeben' });
      }
      update.email = newEmail;
    }

    await users.updateAsync({ _id: req.params.id }, { $set: update });
    await logActivity(req.params.id, 'profile_updated_admin', 'Stammdaten durch Admin aktualisiert');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Consultations Routes ──────────────────────────────────────────────────────
app.get('/api/admin/consultations/:userId', requireAdmin, async (req, res) => {
  try {
    const list = await consultations.findAsync({ user_id: req.params.userId }).sort({ date: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/consultations/:userId', requireAdmin, async (req, res) => {
  try {
    const { date, subject, result, next_step } = req.body;
    if (!date || !subject) return res.status(400).json({ error: 'Datum und Betreff erforderlich' });
    const doc = await consultations.insertAsync({
      user_id:    req.params.userId,
      date:       date,
      subject:    subject.trim(),
      result:     result ? result.trim() : '',
      next_step:  next_step ? next_step.trim() : '',
      created_at: new Date().toISOString()
    });
    await logActivity(req.params.userId, 'consultation_added', `Beratungsprotokoll erstellt: ${doc.subject}`);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/admin/consultations/:entryId', requireAdmin, async (req, res) => {
  try {
    const entry = await consultations.findOneAsync({ _id: req.params.entryId });
    if (!entry) return res.status(404).json({ error: 'Nicht gefunden' });
    await consultations.removeAsync({ _id: req.params.entryId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Contract Scan Upload ──────────────────────────────────────────────────────
app.post('/api/admin/contracts/:contractId/scan', requireAdmin,
  (req, res, next) => { uploadScan.single('image')(req, res, next); },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
      const contract = await contracts.findOneAsync({ _id: req.params.contractId });
      if (!contract) return res.status(404).json({ error: 'Vertrag nicht gefunden' });
      if (contract.scan_image) {
        fs.unlink(path.join(__dirname, 'uploads', 'contracts', contract.scan_image), () => {});
      }
      await contracts.updateAsync({ _id: req.params.contractId }, { $set: { scan_image: req.file.filename } });
      res.json({ ok: true, filename: req.file.filename });
    } catch (err) {
      res.status(500).json({ error: 'Serverfehler' });
    }
  }
);

app.delete('/api/admin/contracts/:contractId/scan', requireAdmin, async (req, res) => {
  try {
    const contract = await contracts.findOneAsync({ _id: req.params.contractId });
    if (!contract || !contract.scan_image) return res.status(404).json({ error: 'Kein Scan vorhanden' });
    fs.unlink(path.join(__dirname, 'uploads', 'contracts', contract.scan_image), () => {});
    await contracts.updateAsync({ _id: req.params.contractId }, { $unset: { scan_image: true } });
    res.json({ ok: true });
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
    const result = await Promise.all(list.map(async a => {
      if (!a.user_id) return { ...a, customer_name: null };
      const u = await users.findOneAsync({ _id: a.user_id });
      return { ...a, customer_name: u ? u.full_name : null };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { title, date, time, user_id, notes } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Titel und Datum erforderlich' });
    const doc = await appointments.insertAsync({
      title:      title.trim(),
      date:       date,
      time:       time || '',
      user_id:    user_id || null,
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

// ── Start ─────────────────────────────────────────────────────────────────────
Promise.all([seedAdmin(), seedSettings()]).then(() => {
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
