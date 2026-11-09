// SQLite database (Node's built-in `node:sqlite`, no native install needed).
// File: server/data/messmate.db  (override with DB_FILE env var)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { MEALS, id, dateStr, hashPassword } = require('./utils');

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, 'data');
const FILE = process.env.DB_FILE || (isVercel ? path.join('/tmp', 'messmate.db') : path.join(DATA_DIR, 'messmate.db'));
const LEGACY_JSON = path.join(DATA_DIR, 'db.json');
const DAYS_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

fs.mkdirSync(path.dirname(FILE), { recursive: true });
const db = new DatabaseSync(FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

const MEAL_CHECK = `CHECK (meal IN ('breakfast','lunch','snacks','dinner'))`;
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  roll_no       TEXT NOT NULL,
  hostel        TEXT NOT NULL DEFAULT 'Bakul',
  avatar        TEXT NOT NULL DEFAULT '🙂',
  bio           TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  password_hash TEXT NOT NULL,
  wallet        INTEGER NOT NULL DEFAULT 0 CHECK (wallet >= 0),
  xp            INTEGER NOT NULL DEFAULT 0,
  joined_at     TEXT NOT NULL
);

-- One row per logged-in device. The client holds a random token; only its SHA-256 is stored here.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS menu_items (
  day      TEXT NOT NULL,
  meal     TEXT NOT NULL ${MEAL_CHECK},
  position INTEGER NOT NULL,
  name     TEXT NOT NULL,
  PRIMARY KEY (day, meal, position)
);

CREATE TABLE IF NOT EXISTS attendance (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  meal    TEXT NOT NULL ${MEAL_CHECK},
  at      TEXT NOT NULL,
  UNIQUE (user_id, date, meal)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date, meal);
CREATE INDEX IF NOT EXISTS idx_attendance_at ON attendance(at);

CREATE TABLE IF NOT EXISTS optouts (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  meal    TEXT NOT NULL ${MEAL_CHECK},
  at      TEXT NOT NULL,
  UNIQUE (user_id, date, meal)
);

CREATE TABLE IF NOT EXISTS ratings (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  meal    TEXT NOT NULL ${MEAL_CHECK},
  stars   INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  vibe    TEXT NOT NULL DEFAULT '😋',
  comment TEXT NOT NULL DEFAULT '',
  at      TEXT NOT NULL,
  UNIQUE (user_id, date, meal)
);
CREATE INDEX IF NOT EXISTS idx_ratings_date ON ratings(date, meal);

CREATE TABLE IF NOT EXISTS coupons (
  id         TEXT PRIMARY KEY,
  seller_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  date       TEXT NOT NULL,
  meal       TEXT NOT NULL ${MEAL_CHECK},
  price      INTEGER NOT NULL CHECK (price > 0),
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'listed' CHECK (status IN ('listed','sold','cancelled')),
  created_at TEXT NOT NULL,
  sold_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status, date);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, at);

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT 'update',
  pinned     INTEGER NOT NULL DEFAULT 0,
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcement_reactions (
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji           TEXT NOT NULL,
  PRIMARY KEY (announcement_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS posts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'post' CHECK (type IN ('post','poll')),
  tag        TEXT NOT NULL DEFAULT 'general',
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_upvotes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS poll_options (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id  TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text     TEXT NOT NULL,
  UNIQUE (post_id, position)
);
CREATE TABLE IF NOT EXISTS poll_votes (
  post_id   TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS complaints (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'food',
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in-progress','resolved')),
  anonymous   INTEGER NOT NULL DEFAULT 0,
  response    TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS complaint_upvotes (
  complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (complaint_id, user_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  id         TEXT PRIMARY KEY,
  dish       TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wishlist_votes (
  wish_id TEXT NOT NULL REFERENCES wishlist(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (wish_id, user_id)
);
`);

/* ---------- tiny query helpers (prepared statements are cached) ---------- */
const cache = new Map();
const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
const q = {
  all: (sql, ...p) => stmt(sql).all(...p),
  get: (sql, ...p) => stmt(sql).get(...p),
  run: (sql, ...p) => stmt(sql).run(...p),
  count: (sql, ...p) => Number(Object.values(stmt(sql).get(...p) || { n: 0 })[0] || 0),
};

// Run fn inside a transaction; any throw rolls everything back.
let depth = 0;
function tx(fn) {
  if (depth > 0) return fn();
  depth++;
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } finally { depth--; }
}

/* ---------- first run: import old db.json if present, otherwise seed demo data ---------- */
function importData(d) {
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    tx(() => {
      for (const u of d.users || []) {
        q.run(`INSERT INTO users (id,name,email,roll_no,hostel,avatar,bio,role,password_hash,wallet,xp,joined_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          u.id, u.name, u.email, u.rollNo || '', u.hostel || 'Bakul', u.avatar || '🙂', u.bio || '', u.role || 'student', u.passwordHash, Math.max(0, u.wallet || 0), u.xp || 0, u.joinedAt || new Date().toISOString());
      }
      for (const [day, meals] of Object.entries(d.menu || {})) {
        for (const [meal, items] of Object.entries(meals)) items.forEach((name, i) => q.run('INSERT INTO menu_items (day,meal,position,name) VALUES (?,?,?,?)', day, meal, i, name));
      }
      for (const a of d.attendance || []) q.run('INSERT OR IGNORE INTO attendance (id,user_id,date,meal,at) VALUES (?,?,?,?,?)', a.id, a.userId, a.date, a.meal, a.at);
      for (const o of d.optouts || []) q.run('INSERT OR IGNORE INTO optouts (id,user_id,date,meal,at) VALUES (?,?,?,?,?)', o.id, o.userId, o.date, o.meal, o.at);
      for (const r of d.ratings || []) q.run('INSERT OR IGNORE INTO ratings (id,user_id,date,meal,stars,vibe,comment,at) VALUES (?,?,?,?,?,?,?,?)', r.id, r.userId, r.date, r.meal, r.stars, r.vibe || '😋', r.comment || '', r.at);
      for (const c of d.coupons || []) q.run('INSERT INTO coupons (id,seller_id,buyer_id,date,meal,price,note,status,created_at,sold_at) VALUES (?,?,?,?,?,?,?,?,?,?)', c.id, c.sellerId, c.buyerId || null, c.date, c.meal, c.price, c.note || '', c.status, c.createdAt, c.soldAt || null);
      for (const t of d.transactions || []) q.run('INSERT INTO transactions (id,user_id,amount,description,at) VALUES (?,?,?,?,?)', t.id, t.userId, t.amount, t.desc, t.at);
      for (const a of d.announcements || []) {
        q.run('INSERT INTO announcements (id,title,body,tag,pinned,author_id,created_at) VALUES (?,?,?,?,?,?,?)', a.id, a.title, a.body, a.tag || 'update', a.pinned ? 1 : 0, a.authorId, a.createdAt);
        for (const [emoji, users] of Object.entries(a.reactions || {})) users.forEach((u) => q.run('INSERT OR IGNORE INTO announcement_reactions VALUES (?,?,?)', a.id, u, emoji));
      }
      for (const p of d.posts || []) {
        q.run('INSERT INTO posts (id,user_id,type,tag,content,created_at) VALUES (?,?,?,?,?,?)', p.id, p.userId, p.type || 'post', p.tag || 'general', p.content, p.createdAt);
        (p.upvotes || []).forEach((u) => q.run('INSERT OR IGNORE INTO post_upvotes VALUES (?,?)', p.id, u));
        (p.comments || []).forEach((c) => q.run('INSERT INTO comments (id,post_id,user_id,text,created_at) VALUES (?,?,?,?,?)', c.id, p.id, c.userId, c.text, c.createdAt));
        (p.poll?.options || []).forEach((o, i) => {
          const optId = q.run('INSERT INTO poll_options (post_id,position,text) VALUES (?,?,?)', p.id, i, o.text).lastInsertRowid;
          (o.votes || []).forEach((u) => q.run('INSERT OR IGNORE INTO poll_votes VALUES (?,?,?)', p.id, u, optId));
        });
      }
      for (const c of d.complaints || []) {
        q.run('INSERT INTO complaints (id,user_id,category,title,description,status,anonymous,response,created_at) VALUES (?,?,?,?,?,?,?,?,?)', c.id, c.userId, c.category || 'food', c.title, c.description || '', c.status || 'open', c.anonymous ? 1 : 0, c.response || '', c.createdAt);
        (c.upvotes || []).forEach((u) => q.run('INSERT OR IGNORE INTO complaint_upvotes VALUES (?,?)', c.id, u));
      }
      for (const w of d.wishlist || []) {
        q.run('INSERT INTO wishlist (id,dish,user_id,created_at) VALUES (?,?,?,?)', w.id, w.dish, w.userId, w.createdAt);
        (w.votes || []).forEach((u) => q.run('INSERT OR IGNORE INTO wishlist_votes VALUES (?,?)', w.id, u));
      }
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

if (q.count('SELECT COUNT(*) n FROM users') === 0) {
  if (!process.env.DB_FILE && fs.existsSync(LEGACY_JSON)) {
    importData(JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8')));
    fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.migrated'); // keep a backup, don't import twice
    console.log('📦 imported data/db.json into SQLite (backup kept as db.json.migrated)');
  } else {
    importData(seed());
    console.log('🌱 seeded a fresh SQLite database with demo data');
  }
}
q.run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString());

/* ---------- demo seed (same shape as the old JSON file, imported above) ---------- */
function seed() {
  const daysAgo = (n, hour = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hour, 0, 0, 0); return d; };
  const pw = hashPassword('password123');
  const idFromEmail = (em) => crypto.createHash('md5').update(String(em).toLowerCase().trim()).digest('hex').slice(0, 12);
  const mk = (name, email, rollNo, hostel, avatar, extra = {}) => ({
    id: idFromEmail(email), name, email, rollNo, hostel, avatar, passwordHash: pw, role: 'student',
    wallet: 500, xp: 0, bio: '', joinedAt: daysAgo(30).toISOString(), ...extra,
  });

  const users = [
    mk('Mess Admin', 'admin@iiit.ac.in', 'ADMIN', 'Mess Office', '👨‍🍳', { role: 'admin', wallet: 0 }),
    mk('Aarav Sharma', 'aarav@iiit.ac.in', '2023CS101', 'Bakul', '😎', { bio: 'maggi at 3am enjoyer' }),
    mk('Diya Patel', 'diya@iiit.ac.in', '2023EC042', 'Parijaat', '🦋', { bio: 'paneer > everything' }),
    mk('Kabir Singh', 'kabir@iiit.ac.in', '2022CS077', 'Bakul', '🔥'),
    mk('Ananya Rao', 'ananya@iiit.ac.in', '2024CS015', 'Parijaat', '🌸'),
    mk('Vihaan Gupta', 'vihaan@iiit.ac.in', '2023ME009', 'Obh', '🐼'),
    mk('Ishita Verma', 'ishita@iiit.ac.in', '2022EC120', 'Kadamba', '✨'),
    mk('Rohan Mehta', 'rohan@iiit.ac.in', '2024CS088', 'Obh', '🎧'),
  ];
  const [admin, ...students] = users;

  const menu = {
    Monday:    { breakfast: ['Aloo Paratha', 'Curd', 'Tea/Coffee'], lunch: ['Rajma', 'Jeera Rice', 'Roti', 'Salad'], snacks: ['Samosa', 'Chai'], dinner: ['Paneer Butter Masala', 'Naan', 'Dal Fry', 'Gulab Jamun'] },
    Tuesday:   { breakfast: ['Poha', 'Jalebi', 'Milk'], lunch: ['Chole', 'Bhature', 'Rice', 'Raita'], snacks: ['Bread Pakoda', 'Coffee'], dinner: ['Mix Veg', 'Roti', 'Dal Tadka', 'Rice'] },
    Wednesday: { breakfast: ['Idli', 'Sambar', 'Coconut Chutney'], lunch: ['Kadhi Pakoda', 'Rice', 'Aloo Gobi', 'Roti'], snacks: ['Maggi', 'Tea'], dinner: ['Chicken Curry / Paneer Tikka', 'Biryani Rice', 'Raita', 'Ice Cream'] },
    Thursday:  { breakfast: ['Upma', 'Banana', 'Tea/Coffee'], lunch: ['Dal Makhani', 'Rice', 'Bhindi Fry', 'Roti'], snacks: ['Vada Pav', 'Chai'], dinner: ['Egg Curry / Malai Kofta', 'Roti', 'Rice', 'Kheer'] },
    Friday:    { breakfast: ['Masala Dosa', 'Sambar', 'Chutney'], lunch: ['Sambar', 'Rice', 'Cabbage Poriyal', 'Curd'], snacks: ['Pav Bhaji'], dinner: ['Veg Biryani', 'Mirchi Salan', 'Raita', 'Rasmalai'] },
    Saturday:  { breakfast: ['Chole Kulche', 'Lassi'], lunch: ['Matar Paneer', 'Pulao', 'Roti', 'Papad'], snacks: ['Momos', 'Cold Coffee'], dinner: ['Pasta (Red Sauce)', 'Garlic Bread', 'Soup', 'Brownie'] },
    Sunday:    { breakfast: ['Puri Sabzi', 'Halwa', 'Tea'], lunch: ['Special Thali', 'Dal Baati', 'Churma'], snacks: ['Pani Puri', 'Lemonade'], dinner: ['Fried Rice', 'Manchurian', 'Hakka Noodles', 'Ice Cream'] },
  };

  // Two weeks of fake attendance + ratings so the dashboards look alive.
  const attendance = [];
  const ratings = [];
  const vibes = ['🔥', '😋', '😐', '🤢', '💀'];
  students.forEach((u, ui) => {
    for (let d = 14; d >= 1; d--) {
      MEALS.forEach((m, mi) => {
        if (Math.random() < 0.72 - ui * 0.04) {
          const at = daysAgo(d, Number(m.start.slice(0, 2)));
          attendance.push({ id: id(), userId: u.id, date: dateStr(at), meal: m.key, at: at.toISOString() });
          if (Math.random() < 0.3) {
            const stars = Math.max(1, Math.min(5, Math.round(3.4 + (Math.random() - 0.5) * 3 + (mi === 3 ? 0.4 : 0))));
            ratings.push({ id: id(), userId: u.id, date: dateStr(at), meal: m.key, stars, vibe: vibes[5 - stars], comment: '', at: at.toISOString() });
          }
        }
      });
    }
  });
  students.forEach((u) => { u.xp = attendance.filter((a) => a.userId === u.id).length * 10 + ratings.filter((r) => r.userId === u.id).length * 5; });
  const transactions = students.map((u) => ({ id: id(), userId: u.id, amount: 500, desc: 'Welcome bonus 🎉', at: u.joinedAt }));

  const tomorrow = dateStr(daysAgo(-1));
  const coupons = [
    { id: id(), sellerId: students[1].id, date: tomorrow, meal: 'dinner', price: 55, note: 'going home for the weekend 🏠', status: 'listed', buyerId: null, createdAt: daysAgo(0, 9).toISOString() },
    { id: id(), sellerId: students[3].id, date: tomorrow, meal: 'breakfast', price: 25, note: 'not waking up at 7 lol', status: 'listed', buyerId: null, createdAt: daysAgo(0, 8).toISOString() },
    { id: id(), sellerId: students[5].id, date: tomorrow, meal: 'lunch', price: 60, note: 'hackathon day, catering provided', status: 'listed', buyerId: null, createdAt: daysAgo(1).toISOString() },
  ];

  const announcements = [
    { id: id(), title: 'Diwali Special Dinner 🪔', body: 'This Friday dinner is a full festive spread — kaju katli, paneer tikka, dal makhani, and live jalebi counter. Dress code: ethnic. Mess closes at 22:00 instead of 21:30.', tag: 'event', pinned: true, authorId: admin.id, createdAt: daysAgo(1).toISOString(), reactions: { '🔥': [students[0].id, students[1].id, students[2].id], '😍': [students[3].id] } },
    { id: id(), title: 'Mess fee due by the 10th', body: 'Semester mess dues must be cleared by the 10th of this month. Late fee of ₹50/day applies after that. Pay via the student portal.', tag: 'important', pinned: false, authorId: admin.id, createdAt: daysAgo(2).toISOString(), reactions: { '💀': [students[4].id, students[5].id] } },
    { id: id(), title: 'New: rotating check-in code', body: 'Attendance is now marked with the 6-character code on the screen at the mess entrance. It rotates every 30 seconds, so no proxies 👀', tag: 'update', pinned: false, authorId: admin.id, createdAt: daysAgo(4).toISOString(), reactions: { '👀': [students[0].id, students[6].id] } },
  ];

  const posts = [
    { id: id(), userId: students[0].id, type: 'post', tag: 'food-review', content: 'the paneer butter masala yesterday was actually bussin no cap 🔥 whoever is the new chef pls stay', upvotes: [students[1].id, students[2].id, students[4].id], comments: [{ id: id(), userId: students[2].id, text: 'fr fr 😭', createdAt: daysAgo(0, 9).toISOString() }], createdAt: daysAgo(0, 8).toISOString() },
    { id: id(), userId: students[2].id, type: 'poll', tag: 'poll', content: 'Which sunday special should come back?', poll: { options: [{ text: 'Chole Bhature', votes: [students[0].id, students[3].id] }, { text: 'Pav Bhaji', votes: [students[4].id] }, { text: 'Biryani', votes: [students[1].id, students[5].id, students[6].id] }] }, upvotes: [students[3].id], comments: [], createdAt: daysAgo(1).toISOString() },
    { id: id(), userId: students[4].id, type: 'post', tag: 'lost-found', content: 'lost a black bottle (has a frog sticker 🐸) near the dinner counter. pls dm if found', upvotes: [], comments: [], createdAt: daysAgo(1, 21).toISOString() },
    { id: id(), userId: students[6].id, type: 'post', tag: 'meme', content: 'mess wednesday dinner queue at 7:29pm be like: 🏃‍♂️🏃‍♀️🏃🏃‍♂️🏃‍♀️🏃🏃‍♂️', upvotes: [students[0].id, students[1].id, students[2].id, students[3].id, students[5].id], comments: [], createdAt: daysAgo(2).toISOString() },
  ];

  const complaints = [
    { id: id(), userId: students[3].id, category: 'hygiene', title: 'Water cooler on 2nd counter is leaking', description: 'Floor is slippery near the cooler, someone might fall.', status: 'in-progress', anonymous: false, upvotes: [students[0].id, students[1].id], response: 'Plumber has been called, will be fixed by tomorrow.', createdAt: daysAgo(2).toISOString() },
    { id: id(), userId: students[5].id, category: 'food', title: 'Rotis are often cold at dinner', description: 'After 8:30pm rotis are cold and hard. Can we get a hot case?', status: 'open', anonymous: true, upvotes: [students[2].id, students[4].id, students[6].id], response: '', createdAt: daysAgo(1).toISOString() },
  ];

  const wishlist = [
    { id: id(), dish: 'Pizza Night 🍕', userId: students[0].id, votes: [students[0].id, students[1].id, students[3].id, students[6].id], createdAt: daysAgo(3).toISOString() },
    { id: id(), dish: 'Dosa Counter at dinner', userId: students[2].id, votes: [students[2].id, students[4].id], createdAt: daysAgo(2).toISOString() },
    { id: id(), dish: 'Fresh juice in breakfast', userId: students[5].id, votes: [students[5].id], createdAt: daysAgo(1).toISOString() },
  ];

  return { users, menu, attendance, optouts: [], ratings, coupons, transactions, announcements, posts, complaints, wishlist };
}

module.exports = { db, q, tx, FILE, DAYS_WEEK };
