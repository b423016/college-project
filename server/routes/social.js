// Announcements, community, complaints, leaderboard, search, admin stats — backed by SQLite.
const router = require('express').Router();
const { q, tx } = require('../db');
const { auth, adminOnly, brief } = require('../auth');
const { streakOf, ratingSummary, weekMenu } = require('./core');
const U = require('../utils');

const nowIso = () => new Date().toISOString();
const ids = (sql, ...p) => q.all(sql, ...p).map((r) => r.user_id);
// Toggle a (thing, user) row in a join table: delete if present, otherwise insert.
function toggle(table, cols, vals) {
  const where = cols.map((c) => `${c} = ?`).join(' AND ');
  const { changes } = q.run(`DELETE FROM ${table} WHERE ${where}`, ...vals);
  if (!changes) q.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...vals);
}

/* ---------- announcements ---------- */
function annView(a) {
  const reactions = {};
  for (const r of q.all('SELECT emoji, user_id FROM announcement_reactions WHERE announcement_id = ? ORDER BY rowid', a.id)) (reactions[r.emoji] ||= []).push(r.user_id);
  return { id: a.id, title: a.title, body: a.body, tag: a.tag, pinned: !!a.pinned, authorId: a.author_id, createdAt: a.created_at, reactions, author: brief(a.author_id) };
}
const getAnn = (aid) => q.get('SELECT * FROM announcements WHERE id = ?', aid);

router.get('/announcements', auth, (req, res) => {
  res.json(q.all('SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC').map(annView));
});

router.post('/announcements', auth, adminOnly, (req, res) => {
  const { title, body, tag, pinned } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const aid = U.id();
  q.run('INSERT INTO announcements (id, title, body, tag, pinned, author_id, created_at) VALUES (?,?,?,?,?,?,?)',
    aid, String(title).slice(0, 100), String(body).slice(0, 2000), String(tag || 'update').slice(0, 20), pinned ? 1 : 0, req.user.id, nowIso());
  res.json(annView(getAnn(aid)));
});

router.patch('/announcements/:id', auth, adminOnly, (req, res) => {
  if (!getAnn(req.params.id)) return res.status(404).json({ error: 'not found' });
  if (req.body?.pinned !== undefined) q.run('UPDATE announcements SET pinned = ? WHERE id = ?', req.body.pinned ? 1 : 0, req.params.id);
  res.json(annView(getAnn(req.params.id)));
});

router.delete('/announcements/:id', auth, adminOnly, (req, res) => {
  q.run('DELETE FROM announcements WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

router.post('/announcements/:id/react', auth, (req, res) => {
  const a = getAnn(req.params.id);
  const emoji = String(req.body?.emoji || '');
  if (!a || !['🔥', '😍', '👀', '💀', '😭', '👏'].includes(emoji)) return res.status(400).json({ error: 'nope' });
  toggle('announcement_reactions', ['announcement_id', 'user_id', 'emoji'], [a.id, req.user.id, emoji]);
  res.json(annView(a));
});

/* ---------- community ---------- */
function postView(p) {
  const view = {
    id: p.id, userId: p.user_id, type: p.type, tag: p.tag, content: p.content, createdAt: p.created_at, author: brief(p.user_id),
    upvotes: ids('SELECT user_id FROM post_upvotes WHERE post_id = ? ORDER BY rowid', p.id),
    comments: q.all('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at', p.id)
      .map((c) => ({ id: c.id, userId: c.user_id, text: c.text, createdAt: c.created_at, author: brief(c.user_id) })),
  };
  if (p.type === 'poll') {
    view.poll = {
      options: q.all('SELECT * FROM poll_options WHERE post_id = ? ORDER BY position', p.id)
        .map((o) => ({ text: o.text, votes: ids('SELECT user_id FROM poll_votes WHERE option_id = ?', o.id) })),
    };
  }
  return view;
}
const getPost = (pid) => q.get('SELECT * FROM posts WHERE id = ?', pid);

router.get('/posts', auth, (req, res) => {
  const { tag, sort } = req.query;
  const filter = tag && tag !== 'all';
  const order = sort === 'top' ? '(SELECT COUNT(*) FROM post_upvotes u WHERE u.post_id = p.id) DESC, p.created_at DESC' : 'p.created_at DESC';
  const rows = filter ? q.all(`SELECT p.* FROM posts p WHERE p.tag = ? ORDER BY ${order}`, String(tag)) : q.all(`SELECT p.* FROM posts p ORDER BY ${order}`);
  res.json(rows.map(postView));
});

router.post('/posts', auth, (req, res) => {
  const { content, tag, pollOptions } = req.body || {};
  const text = String(content || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'say something first' });
  const opts = Array.isArray(pollOptions) ? pollOptions.map((o) => String(o).trim().slice(0, 60)).filter(Boolean).slice(0, 5) : [];
  const isPoll = opts.length >= 2;
  const pid = U.id();
  tx(() => {
    q.run('INSERT INTO posts (id, user_id, type, tag, content, created_at) VALUES (?,?,?,?,?,?)',
      pid, req.user.id, isPoll ? 'poll' : 'post', isPoll ? 'poll' : String(tag || 'general').slice(0, 20), text, nowIso());
    if (isPoll) opts.forEach((o, i) => q.run('INSERT INTO poll_options (post_id, position, text) VALUES (?,?,?)', pid, i, o));
    q.run('UPDATE users SET xp = xp + 3 WHERE id = ?', req.user.id);
  });
  res.json(postView(getPost(pid)));
});

router.post('/posts/:id/upvote', auth, (req, res) => {
  const p = getPost(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  toggle('post_upvotes', ['post_id', 'user_id'], [p.id, req.user.id]);
  res.json(postView(p));
});

router.post('/posts/:id/vote', auth, (req, res) => {
  const p = getPost(req.params.id);
  const opt = p && p.type === 'poll' && q.get('SELECT id FROM poll_options WHERE post_id = ? AND position = ?', p.id, Number(req.body?.option));
  if (!opt) return res.status(400).json({ error: 'invalid vote' });
  q.run(`INSERT INTO poll_votes (post_id, user_id, option_id) VALUES (?,?,?)
         ON CONFLICT (post_id, user_id) DO UPDATE SET option_id = excluded.option_id`, p.id, req.user.id, opt.id);
  res.json(postView(p));
});

router.post('/posts/:id/comments', auth, (req, res) => {
  const p = getPost(req.params.id);
  const text = String(req.body?.text || '').trim().slice(0, 300);
  if (!p || !text) return res.status(400).json({ error: 'empty comment' });
  q.run('INSERT INTO comments (id, post_id, user_id, text, created_at) VALUES (?,?,?,?,?)', U.id(), p.id, req.user.id, text, nowIso());
  res.json(postView(p));
});

router.delete('/posts/:id', auth, (req, res) => {
  const p = getPost(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (p.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'not yours' });
  q.run('DELETE FROM posts WHERE id = ?', p.id); // upvotes, comments, poll rows cascade
  res.json({ ok: true });
});

/* ---------- complaints ---------- */
function complaintView(c, viewer) {
  const hidden = c.anonymous && viewer.role !== 'admin';
  return {
    id: c.id, category: c.category, title: c.title, description: c.description, status: c.status,
    anonymous: !!c.anonymous, response: c.response, createdAt: c.created_at,
    upvotes: ids('SELECT user_id FROM complaint_upvotes WHERE complaint_id = ? ORDER BY rowid', c.id),
    author: hidden && c.user_id !== viewer.id ? { name: 'Anonymous', avatar: '🕵️' } : brief(c.user_id),
    userId: hidden ? undefined : c.user_id,
    mine: c.user_id === viewer.id,
  };
}
const getComplaint = (cid) => q.get('SELECT * FROM complaints WHERE id = ?', cid);

router.get('/complaints', auth, (req, res) => {
  const rows = q.all('SELECT c.* FROM complaints c ORDER BY (SELECT COUNT(*) FROM complaint_upvotes u WHERE u.complaint_id = c.id) DESC, c.created_at DESC');
  res.json(rows.map((c) => complaintView(c, req.user)));
});

router.post('/complaints', auth, (req, res) => {
  const { category, title, description, anonymous } = req.body || {};
  if (!title) return res.status(400).json({ error: 'give it a title' });
  const cid = U.id();
  tx(() => {
    q.run(`INSERT INTO complaints (id, user_id, category, title, description, status, anonymous, response, created_at) VALUES (?,?,?,?,?,'open',?,'',?)`,
      cid, req.user.id, String(category || 'food').slice(0, 20), String(title).slice(0, 100), String(description || '').slice(0, 1000), anonymous ? 1 : 0, nowIso());
    q.run('INSERT INTO complaint_upvotes (complaint_id, user_id) VALUES (?,?)', cid, req.user.id);
    q.run('UPDATE users SET xp = xp + 2 WHERE id = ?', req.user.id);
  });
  res.json(complaintView(getComplaint(cid), req.user));
});

router.post('/complaints/:id/upvote', auth, (req, res) => {
  const c = getComplaint(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  toggle('complaint_upvotes', ['complaint_id', 'user_id'], [c.id, req.user.id]);
  res.json(complaintView(c, req.user));
});

router.patch('/complaints/:id', auth, adminOnly, (req, res) => {
  if (!getComplaint(req.params.id)) return res.status(404).json({ error: 'not found' });
  const { status, response } = req.body || {};
  if (['open', 'in-progress', 'resolved'].includes(status)) q.run('UPDATE complaints SET status = ? WHERE id = ?', status, req.params.id);
  if (response !== undefined) q.run('UPDATE complaints SET response = ? WHERE id = ?', String(response).slice(0, 500), req.params.id);
  res.json(complaintView(getComplaint(req.params.id), req.user));
});

/* ---------- leaderboard ---------- */
router.get('/leaderboard', auth, (req, res) => {
  const rows = q.all(`SELECT u.id, u.name, u.avatar, u.hostel, u.role, u.xp,
                             (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) AS meals
                      FROM users u WHERE u.role = 'student' ORDER BY u.xp DESC`);
  res.json(rows.map((u) => ({ id: u.id, name: u.name, avatar: u.avatar, hostel: u.hostel, role: u.role, xp: u.xp, streak: streakOf(u.id), meals: u.meals })));
});

/* ---------- global search ---------- */
router.get('/search', auth, (req, res) => {
  const s = String(req.query.q || '').trim().toLowerCase();
  if (s.length < 2) return res.json([]);
  const hit = (x) => String(x || '').toLowerCase().includes(s);
  const has = (col) => `instr(lower(${col}), ?) > 0`;
  const out = [];
  const week = weekMenu();
  for (const day of U.DAYS) {
    for (const m of U.MEALS) {
      const items = week[day][m.key].filter(hit);
      if (items.length) out.push({ type: 'menu', title: items.join(', '), sub: `${day} ${m.label}`, emoji: m.emoji, to: `/menu?day=${day}` });
    }
  }
  q.all(`SELECT title, body FROM announcements WHERE ${has('title')} OR ${has('body')} LIMIT 5`, s, s)
    .forEach((a) => out.push({ type: 'notice', title: a.title, sub: a.body.slice(0, 70), emoji: '📢', to: '/notices' }));
  q.all(`SELECT content, user_id FROM posts WHERE ${has('content')} LIMIT 5`, s)
    .forEach((p) => out.push({ type: 'post', title: p.content.slice(0, 70), sub: `by ${brief(p.user_id).name}`, emoji: '💬', to: '/community' }));
  q.all(`SELECT meal, price, date FROM coupons WHERE status = 'listed' AND (${has('meal')} OR ${has('note')} OR ${has('date')}) LIMIT 5`, s, s, s)
    .forEach((c) => out.push({ type: 'coupon', title: `${c.meal} coupon · ₹${c.price}`, sub: c.date, emoji: '🎟️', to: '/coupons' }));
  q.all(`SELECT title, status FROM complaints WHERE ${has('title')} LIMIT 5`, s)
    .forEach((c) => out.push({ type: 'complaint', title: c.title, sub: c.status, emoji: '🗣️', to: '/speak-up' }));
  q.all(`SELECT name, hostel, xp, avatar FROM users WHERE ${has('name')} OR ${has('roll_no')} LIMIT 5`, s, s)
    .forEach((u) => out.push({ type: 'person', title: u.name, sub: `${u.hostel} · ${u.xp} xp`, emoji: u.avatar, to: '/leaderboard' }));
  res.json(out.slice(0, 20));
});

/* ---------- admin ---------- */
router.get('/admin/stats', auth, adminOnly, (req, res) => {
  const today = U.dateStr();
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = U.dateStr(tomorrowD);
  const students = q.count("SELECT COUNT(*) FROM users WHERE role = 'student'");
  const optCount = (date, meal) => q.count('SELECT COUNT(*) FROM optouts WHERE date = ? AND meal = ?', date, meal);
  const meals = U.MEALS.map((m) => {
    const optToday = optCount(today, m.key);
    return {
      ...m,
      attended: q.count('SELECT COUNT(*) FROM attendance WHERE date = ? AND meal = ?', today, m.key),
      optedOut: optToday,
      expected: students - optToday,
      expectedTomorrow: students - optCount(tomorrow, m.key),
      rating: ratingSummary(today, m.key),
    };
  });
  // Last 7 days of headcount, for the trend chart.
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = U.dateStr(d);
    const r = q.get('SELECT AVG(stars) AS avg FROM ratings WHERE date = ?', ds);
    trend.push({ date: ds, day: U.DAYS[d.getDay()].slice(0, 3), count: q.count('SELECT COUNT(*) FROM attendance WHERE date = ?', ds), avg: r.avg ?? null });
  }
  res.json({
    students, meals, trend,
    openComplaints: q.count("SELECT COUNT(*) FROM complaints WHERE status != 'resolved'"),
    couponsSold: q.count("SELECT COUNT(*) FROM coupons WHERE status = 'sold'"),
    mealsSaved: q.count('SELECT COUNT(*) FROM optouts'),
  });
});

module.exports = { router };
