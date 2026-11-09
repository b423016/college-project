// Session auth backed by the `sessions` table: login creates a row, logout deletes it.
const crypto = require('crypto');
const { q } = require('./db');

const SESSION_DAYS = 30;
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

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
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  q.run('INSERT INTO sessions (id, user_id, user_agent, created_at, expires_at) VALUES (?,?,?,?,?)',
    hashToken(token), userId, String(userAgent).slice(0, 200), now.toISOString(), expires.toISOString());
  return token;
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'login required' });
  const row = q.get('SELECT s.id AS session_id, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', hashToken(token));
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
