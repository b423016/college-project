// Session auth with stateless signed tokens + SQLite sessions table fallback.
const crypto = require('crypto');
const { q } = require('./db');

const SESSION_DAYS = 30;
const SECRET = process.env.APP_SECRET || 'messmate-dev-secret-key-2026';
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const signToken = (userId) => {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
};

const verifyToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [userId, expires, sig] = parts;
  if (Number(expires) < Date.now()) return null;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(`${userId}.${expires}`).digest('base64url');
  if (sig !== expectedSig) return null;
  return userId;
};

// Error type the routes can throw (also from inside transactions); index.js turns it into a JSON response.
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => new HttpError(status, message);

// DB row (snake_case) -> API user (camelCase, no password hash).
const publicUser = (r) => r && ({
  id: r.id, name: r.name, email: r.email, rollNo: r.roll_no, hostel: r.hostel, avatar: r.avatar,
  bio: r.bio, role: r.role, wallet: r.wallet, xp: r.xp, joinedAt: r.joined_at,
});
const getUser = (userId) => publicUser(q.get('SELECT * FROM users WHERE id = ?', userId));

function createSession(userId, userAgent = '') {
  const token = signToken(userId);
  try {
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
    q.run('INSERT OR REPLACE INTO sessions (id, user_id, user_agent, created_at, expires_at) VALUES (?,?,?,?,?)',
      hashToken(token), userId, String(userAgent).slice(0, 200), now.toISOString(), expires.toISOString());
  } catch { /* ignore db session write error in serverless */ }
  return token;
}

function auth(req, res, next) {
  const rawToken = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!rawToken) return res.status(401).json({ error: 'login required' });

  // 1. Verify stateless signed token (works across all serverless lambda instances)
  const verifiedUserId = verifyToken(rawToken);
  if (verifiedUserId) {
    const userRow = q.get('SELECT * FROM users WHERE id = ?', verifiedUserId);
    if (userRow) {
      req.user = publicUser(userRow);
      req.sessionId = hashToken(rawToken);
      return next();
    }
  }

  // 2. Fallback to sessions table check
  const row = q.get('SELECT s.id AS session_id, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', hashToken(rawToken));
  if (!row || row.expires_at < new Date().toISOString()) {
    if (row) q.run('DELETE FROM sessions WHERE id = ?', row.session_id);
    return res.status(401).json({ error: 'session expired, log in again' });
  }
  req.user = publicUser(row);
  req.sessionId = row.session_id;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admins only 🙅' });
  next();
}

const brief = (userId) => {
  const u = userId && q.get('SELECT id, name, avatar, hostel, role FROM users WHERE id = ?', userId);
  return u ? { id: u.id, name: u.name, avatar: u.avatar, hostel: u.hostel, role: u.role } : { id: userId, name: 'ghost', avatar: '👻' };
};

module.exports = { auth, adminOnly, publicUser, getUser, brief, createSession, hashToken, HttpError, fail };
