function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht eingeloggt' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht eingeloggt' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
