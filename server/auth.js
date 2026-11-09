// Session auth with stateless signed tokens + SQLite sessions table fallback.
const crypto = require('crypto');
const { q } = require('./db');

const SESSION_DAYS = 30;
const SECRET = process.env.APP_SECRET || 'messmate-dev-secret-key-2026';
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const signToken = (payloadObj) => {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const data = Buffer.from(JSON.stringify({ ...payloadObj, exp: expires })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
};

const verifyToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length === 3) {
    const [userId, expires, sig] = parts;
    if (Number(expires) < Date.now()) return null;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(`${userId}.${expires}`).digest('base64url');
    if (sig === expectedSig) return { id: userId };
    return null;
  }
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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

function createSession(userOrId, userAgent = '') {
  let userObj;
  if (typeof userOrId === 'object' && userOrId !== null) {
    userObj = userOrId;
  } else {
    userObj = q.get('SELECT * FROM users WHERE id = ?', userOrId) || { id: userOrId };
  }
  const token = signToken({
    id: userObj.id,
    email: userObj.email,
    name: userObj.name,
    role: userObj.role || 'student',
    rollNo: userObj.roll_no || userObj.rollNo || '',
    hostel: userObj.hostel || 'Bakul',
  });
  try {
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
    q.run('INSERT OR REPLACE INTO sessions (id, user_id, user_agent, created_at, expires_at) VALUES (?,?,?,?,?)',
      hashToken(token), userObj.id, String(userAgent).slice(0, 200), now.toISOString(), expires.toISOString());
  } catch { /* ignore db session write error in serverless */ }
  return token;
}

function auth(req, res, next) {
  const rawToken = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!rawToken) return res.status(401).json({ error: 'login required' });

  // 1. Verify stateless signed token
  const payload = verifyToken(rawToken);
  if (payload && (payload.id || payload.email)) {
    let userRow = payload.id ? q.get('SELECT * FROM users WHERE id = ?', payload.id) : null;
    if (!userRow && payload.email) {
      userRow = q.get('SELECT * FROM users WHERE email = ?', payload.email);
    }

    // Auto-provision missing user in this container if needed
    if (!userRow && payload.email) {
      try {
        q.run(`INSERT OR IGNORE INTO users (id, name, email, roll_no, hostel, avatar, bio, role, password_hash, wallet, xp, joined_at)
               VALUES (?,?,?,?,?,'🙂','',?,'',500,0,?)`,
               payload.id, payload.name || 'User', payload.email, payload.rollNo || '', payload.hostel || 'Bakul', payload.role || 'student', new Date().toISOString());
        userRow = q.get('SELECT * FROM users WHERE email = ?', payload.email);
      } catch (e) {
        console.error('Auto-provision user error:', e);
      }
    }

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
