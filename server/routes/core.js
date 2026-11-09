// Auth/session, profile, menu, attendance, wallet & coupons — all backed by SQLite.
const router = require('express').Router();
const { q, tx, DAYS_WEEK } = require('../db');
const { auth, adminOnly, publicUser, getUser, brief, createSession, fail } = require('../auth');
const U = require('../utils');

const nowIso = () => new Date().toISOString();
const isMeal = (m) => U.MEALS.some((x) => x.key === m);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const addXp = (userId, n) => q.run('UPDATE users SET xp = xp + ? WHERE id = ?', n, userId);
const txn = (userId, amount, desc) => q.run('INSERT INTO transactions (id, user_id, amount, description, at) VALUES (?,?,?,?,?)', U.id(), userId, amount, desc, nowIso());
const mealRow = (r) => r && ({ id: r.id, userId: r.user_id, date: r.date, meal: r.meal, at: r.at });

function streakOf(userId) {
  const days = new Set(q.all('SELECT DISTINCT date FROM attendance WHERE user_id = ?', userId).map((r) => r.date));
  let streak = 0;
  const d = new Date();
  if (!days.has(U.dateStr(d))) d.setDate(d.getDate() - 1); // today not over yet
  while (days.has(U.dateStr(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function badgesOf(userId) {
  const n = (sql) => q.count(sql, userId);
  const list = [];
  const push = (ok, emoji, name, desc) => list.push({ emoji, name, desc, earned: ok });
  push(n("SELECT COUNT(*) FROM attendance WHERE user_id = ? AND meal = 'breakfast'") >= 5, '🌅', 'Early Bird', '5 breakfasts attended');
  push(streakOf(userId) >= 7, '⚡', 'On a Roll', '7 day mess streak');
  push(n('SELECT COUNT(*) FROM ratings WHERE user_id = ?') >= 10, '🧑‍⚖️', 'Food Critic', 'Rated 10 meals');
  push(n("SELECT COUNT(*) FROM coupons WHERE seller_id = ? AND status = 'sold'") >= 3, '💸', 'Hustler', 'Sold 3 coupons');
  push(n('SELECT COUNT(*) FROM posts WHERE user_id = ?') >= 5, '📣', 'Community OG', '5 community posts');
  push(n('SELECT COUNT(*) FROM optouts WHERE user_id = ?') >= 3, '🌱', 'Zero Waste', 'Opted out 3 times in advance');
  push(n('SELECT COUNT(*) FROM attendance WHERE user_id = ?') >= 50, '🏆', 'Mess Legend', '50 meals attended');
  return list;
}

/* ---------- auth & sessions ---------- */
router.post('/auth/register', (req, res) => {
  const { name, email, password, rollNo, hostel } = req.body || {};
  if (!name || !email || !password || !rollNo) return res.status(400).json({ error: 'fill in all the fields bestie' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "that email doesn't look right" });
  if (String(password).length < 6) return res.status(400).json({ error: 'password needs 6+ chars' });
  if (q.get('SELECT 1 FROM users WHERE email = ?', email)) return res.status(409).json({ error: 'that email is already taken' });
  const userId = U.id();
  tx(() => {
    q.run(`INSERT INTO users (id, name, email, roll_no, hostel, avatar, bio, role, password_hash, wallet, xp, joined_at)
           VALUES (?,?,?,?,?,'🙂','','student',?,500,0,?)`,
      userId, String(name).slice(0, 40), String(email).trim(), String(rollNo).slice(0, 20), String(hostel || 'Bakul').slice(0, 30), U.hashPassword(String(password)), nowIso());
    txn(userId, 500, 'Welcome bonus 🎉');
  });
  const user = getUser(userId);
  res.json({ token: createSession(user, req.headers['user-agent']), user });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const row = q.get('SELECT * FROM users WHERE email = ?', String(email || '').trim());
  if (!row || !U.verifyPassword(String(password || ''), row.password_hash)) return res.status(401).json({ error: 'wrong email or password' });
  res.json({ token: createSession(row, req.headers['user-agent']), user: publicUser(row) });
});

// Logout = delete this device's session row, so the token stops working immediately.
router.post('/auth/logout', auth, (req, res) => {
  q.run('DELETE FROM sessions WHERE id = ?', req.sessionId);
  res.json({ ok: true });
});

router.post('/auth/logout-all', auth, (req, res) => {
  const { changes } = q.run('DELETE FROM sessions WHERE user_id = ?', req.user.id);
  res.json({ ok: true, sessionsEnded: Number(changes) });
});

router.get('/auth/sessions', auth, (req, res) => {
  const rows = q.all('SELECT id, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
  res.json(rows.map((s) => ({ current: s.id === req.sessionId, userAgent: s.user_agent, createdAt: s.created_at, expiresAt: s.expires_at })));
});

router.post('/auth/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const row = q.get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!U.verifyPassword(String(currentPassword || ''), row.password_hash)) return res.status(400).json({ error: 'current password is wrong' });
  if (String(newPassword || '').length < 6) return res.status(400).json({ error: 'new password needs 6+ chars' });
  tx(() => {
    q.run('UPDATE users SET password_hash = ? WHERE id = ?', U.hashPassword(String(newPassword)), req.user.id);
    q.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', req.user.id, req.sessionId); // sign out other devices
  });
  res.json({ ok: true });
});

/* ---------- profile ---------- */
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user, streak: streakOf(req.user.id), badges: badgesOf(req.user.id) });
});

router.patch('/me', auth, (req, res) => {
  const { name, avatar, hostel, bio } = req.body || {};
  q.run(`UPDATE users SET name = COALESCE(?, name), avatar = COALESCE(?, avatar), hostel = COALESCE(?, hostel), bio = COALESCE(?, bio) WHERE id = ?`,
    name ? String(name).slice(0, 40) : null, avatar ? String(avatar).slice(0, 8) : null,
    hostel ? String(hostel).slice(0, 30) : null, bio !== undefined ? String(bio).slice(0, 120) : null, req.user.id);
  res.json({ user: getUser(req.user.id) });
});

/* ---------- menu ---------- */
function weekMenu() {
  const week = Object.fromEntries(DAYS_WEEK.map((d) => [d, Object.fromEntries(U.MEALS.map((m) => [m.key, []]))]));
  for (const r of q.all('SELECT day, meal, name FROM menu_items ORDER BY day, meal, position')) week[r.day]?.[r.meal]?.push(r.name);
  return week;
}

function ratingSummary(date, meal) {
  const rs = q.all('SELECT stars, vibe FROM ratings WHERE date = ? AND meal = ?', date, meal);
  const avg = rs.length ? rs.reduce((s, r) => s + r.stars, 0) / rs.length : null;
  const vibes = {};
  rs.forEach((r) => { vibes[r.vibe] = (vibes[r.vibe] || 0) + 1; });
  return { avg, count: rs.length, vibes };
}

const ratingRow = (r) => r && ({ ...mealRow(r), stars: r.stars, vibe: r.vibe, comment: r.comment });

router.get('/menu', auth, (req, res) => {
  const now = new Date();
  const today = U.dateStr(now);
  const day = U.DAYS[now.getDay()];
  const week = weekMenu();
  const todays = U.MEALS.map((m) => ({
    ...m,
    items: week[day][m.key],
    rating: ratingSummary(today, m.key),
    myRating: ratingRow(q.get('SELECT * FROM ratings WHERE user_id = ? AND date = ? AND meal = ?', req.user.id, today, m.key)) || null,
  }));
  res.json({ week, days: U.DAYS, meals: U.MEALS, today, day, todays, current: U.currentMeal(now), next: U.nextMeal(now) });
});

router.put('/menu/:day', auth, adminOnly, (req, res) => {
  const day = req.params.day;
  if (!DAYS_WEEK.includes(day)) return res.status(404).json({ error: 'no such day' });
  tx(() => {
    for (const m of U.MEALS) {
      if (!Array.isArray(req.body?.[m.key])) continue;
      q.run('DELETE FROM menu_items WHERE day = ? AND meal = ?', day, m.key);
      req.body[m.key].map((s) => String(s).trim().slice(0, 60)).filter(Boolean)
        .forEach((name, i) => q.run('INSERT INTO menu_items (day, meal, position, name) VALUES (?,?,?,?)', day, m.key, i, name));
    }
  });
  res.json({ menu: weekMenu()[day] });
});

router.post('/menu/rate', auth, (req, res) => {
  const { meal, stars, vibe, comment } = req.body || {};
  if (!isMeal(meal) || !(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'invalid rating' });
  const date = U.dateStr();
  const rating = tx(() => {
    const existing = q.get('SELECT id FROM ratings WHERE user_id = ? AND date = ? AND meal = ?', req.user.id, date, meal);
    const args = [Math.round(stars), String(vibe || '😋').slice(0, 8), String(comment || '').slice(0, 200), nowIso()];
    if (existing) {
      q.run('UPDATE ratings SET stars = ?, vibe = ?, comment = ?, at = ? WHERE id = ?', ...args, existing.id);
    } else {
      q.run('INSERT INTO ratings (stars, vibe, comment, at, id, user_id, date, meal) VALUES (?,?,?,?,?,?,?,?)', ...args, U.id(), req.user.id, date, meal);
      addXp(req.user.id, 5);
    }
    return q.get('SELECT * FROM ratings WHERE user_id = ? AND date = ? AND meal = ?', req.user.id, date, meal);
  });
  res.json({ rating: ratingRow(rating), summary: ratingSummary(date, meal) });
});

const wishView = (w) => ({
  id: w.id, dish: w.dish, userId: w.user_id, createdAt: w.created_at, by: brief(w.user_id),
  votes: q.all('SELECT user_id FROM wishlist_votes WHERE wish_id = ?', w.id).map((r) => r.user_id),
});

router.get('/menu/wishlist', auth, (req, res) => {
  res.json(q.all(`SELECT w.* FROM wishlist w ORDER BY (SELECT COUNT(*) FROM wishlist_votes v WHERE v.wish_id = w.id) DESC, w.created_at DESC`).map(wishView));
});

router.post('/menu/wishlist', auth, (req, res) => {
  const dish = String(req.body?.dish || '').trim().slice(0, 60);
  if (!dish) return res.status(400).json({ error: 'name a dish' });
  const wid = U.id();
  tx(() => {
    q.run('INSERT INTO wishlist (id, dish, user_id, created_at) VALUES (?,?,?,?)', wid, dish, req.user.id, nowIso());
    q.run('INSERT INTO wishlist_votes (wish_id, user_id) VALUES (?,?)', wid, req.user.id);
  });
  res.json(wishView(q.get('SELECT * FROM wishlist WHERE id = ?', wid)));
});

router.post('/menu/wishlist/:id/vote', auth, (req, res) => {
  const w = q.get('SELECT * FROM wishlist WHERE id = ?', req.params.id);
  if (!w) return res.status(404).json({ error: 'not found' });
  const { changes } = q.run('DELETE FROM wishlist_votes WHERE wish_id = ? AND user_id = ?', w.id, req.user.id);
  if (!changes) q.run('INSERT INTO wishlist_votes (wish_id, user_id) VALUES (?,?)', w.id, req.user.id);
  res.json(wishView(w));
});

/* ---------- attendance ---------- */
router.post('/attendance/checkin', auth, (req, res) => {
  if (!U.isValidCode(req.body?.code)) return res.status(400).json({ error: 'code expired or wrong — look at the screen again 👀' });
  const meal = U.currentMeal() || (process.env.STRICT_HOURS ? null : U.nearestMeal());
  if (!meal) return res.status(400).json({ error: 'mess is closed rn, come back at meal time' });
  const date = U.dateStr();
  if (q.get('SELECT 1 FROM attendance WHERE user_id = ? AND date = ? AND meal = ?', req.user.id, date, meal.key)) {
    return res.status(409).json({ error: `already checked in for ${meal.label.toLowerCase()} ✅` });
  }
  q.run('INSERT INTO attendance (id, user_id, date, meal, at) VALUES (?,?,?,?,?)', U.id(), req.user.id, date, meal.key, nowIso());
  const streak = streakOf(req.user.id);
  const bonus = streak > 0 && streak % 7 === 0 ? 50 : 0;
  addXp(req.user.id, 10 + bonus);
  res.json({ ok: true, meal, streak, xpGained: 10 + bonus });
});

router.get('/attendance/me', auth, (req, res) => {
  const mine = q.all('SELECT * FROM attendance WHERE user_id = ? ORDER BY at', req.user.id);
  const byDate = {};
  mine.forEach((a) => { (byDate[a.date] ||= []).push(a.meal); });
  const perMeal = Object.fromEntries(U.MEALS.map((m) => [m.key, mine.filter((a) => a.meal === m.key).length]));
  const since = new Date(); since.setDate(since.getDate() - 30);
  const last30 = mine.filter((a) => a.at >= since.toISOString()).length;
  res.json({
    total: mine.length, streak: streakOf(req.user.id), perMeal, byDate, last30,
    percent30: Math.round((last30 / (30 * U.MEALS.length)) * 100),
    optouts: q.all('SELECT * FROM optouts WHERE user_id = ? AND date >= ? ORDER BY date', req.user.id, U.dateStr()).map(mealRow),
  });
});

router.post('/attendance/optout', auth, (req, res) => {
  const { date, meal } = req.body || {};
  if (!isMeal(meal) || !isDate(date)) return res.status(400).json({ error: 'pick a date and meal' });
  if (date < U.dateStr()) return res.status(400).json({ error: "can't skip the past 😅" });
  const { changes } = q.run('DELETE FROM optouts WHERE user_id = ? AND date = ? AND meal = ?', req.user.id, date, meal);
  if (changes) return res.json({ optedOut: false });
  q.run('INSERT INTO optouts (id, user_id, date, meal, at) VALUES (?,?,?,?,?)', U.id(), req.user.id, date, meal, nowIso());
  addXp(req.user.id, 2);
  res.json({ optedOut: true });
});

router.get('/attendance/code', auth, adminOnly, (req, res) => {
  const msLeft = U.CODE_WINDOW_MS - (Date.now() % U.CODE_WINDOW_MS);
  res.json({ code: U.messCode(), msLeft, meal: U.currentMeal() || U.nearestMeal() });
});

// Rush meter: check-ins in the last 15 min, scaled against an assumed counter capacity.
router.get('/attendance/live', auth, (req, res) => {
  const recent = q.count('SELECT COUNT(*) FROM attendance WHERE at >= ?', new Date(Date.now() - 15 * 60_000).toISOString());
  const meal = U.currentMeal();
  const inMeal = meal ? q.count('SELECT COUNT(*) FROM attendance WHERE date = ? AND meal = ?', U.dateStr(), meal.key) : 0;
  // Time-of-meal curve so the meter feels realistic with few demo users.
  let base = 0;
  if (meal) {
    const p = (U.nowMin() - U.toMin(meal.start)) / (U.toMin(meal.end) - U.toMin(meal.start));
    base = Math.round(85 * Math.sin(Math.PI * Math.min(1, Math.max(0, p))) ** 1.5);
  }
  const level = Math.min(100, base + recent * 6);
  const label = level > 75 ? 'packed 🥵' : level > 45 ? 'kinda busy' : level > 15 ? 'chill' : 'empty, go now 🏃';
  res.json({ level, label, recent, inMeal, meal, next: U.nextMeal() });
});

/* ---------- wallet & coupons ---------- */
const balanceOf = (userId) => q.get('SELECT wallet FROM users WHERE id = ?', userId).wallet;

router.get('/wallet', auth, (req, res) => {
  const transactions = q.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY at DESC LIMIT 30', req.user.id)
    .map((t) => ({ id: t.id, userId: t.user_id, amount: t.amount, desc: t.description, at: t.at }));
  res.json({ balance: balanceOf(req.user.id), transactions });
});

router.post('/wallet/topup', auth, (req, res) => {
  const amount = Math.round(Number(req.body?.amount));
  if (!(amount > 0 && amount <= 2000)) return res.status(400).json({ error: 'top up between ₹1 and ₹2000' });
  tx(() => {
    q.run('UPDATE users SET wallet = wallet + ? WHERE id = ?', amount, req.user.id);
    txn(req.user.id, amount, 'Wallet top-up');
  });
  res.json({ balance: balanceOf(req.user.id) });
});

const couponView = (c) => ({
  id: c.id, sellerId: c.seller_id, buyerId: c.buyer_id, date: c.date, meal: c.meal, price: c.price, note: c.note,
  status: c.status, createdAt: c.created_at, soldAt: c.sold_at,
  seller: brief(c.seller_id), buyer: c.buyer_id ? brief(c.buyer_id) : null, mealInfo: U.MEALS.find((m) => m.key === c.meal),
});
const getCoupon = (cid) => q.get('SELECT * FROM coupons WHERE id = ?', cid);

router.get('/coupons', auth, (req, res) => {
  const listed = q.all("SELECT * FROM coupons WHERE status = 'listed' AND date >= ? ORDER BY date, price", U.dateStr()).map(couponView);
  const mine = q.all('SELECT * FROM coupons WHERE seller_id = ? OR buyer_id = ? ORDER BY created_at DESC', req.user.id, req.user.id).map(couponView);
  res.json({ listed, mine, meals: U.MEALS });
});

router.post('/coupons', auth, (req, res) => {
  const { date, meal, price, note } = req.body || {};
  const m = U.MEALS.find((x) => x.key === meal);
  if (!m || !isDate(date)) return res.status(400).json({ error: 'pick a date and meal' });
  if (date < U.dateStr()) return res.status(400).json({ error: "that meal's already gone" });
  const p = Math.round(Number(price));
  if (!(p >= 5 && p <= m.price)) return res.status(400).json({ error: `price must be ₹5–₹${m.price} (no scalping 😤)` });
  if (q.get("SELECT 1 FROM coupons WHERE seller_id = ? AND date = ? AND meal = ? AND status != 'cancelled'", req.user.id, date, meal)) {
    return res.status(409).json({ error: 'you already listed this meal' });
  }
  if (q.get('SELECT 1 FROM attendance WHERE user_id = ? AND date = ? AND meal = ?', req.user.id, date, meal)) {
    return res.status(400).json({ error: 'you already ate this one 😭' });
  }
  const cid = U.id();
  q.run("INSERT INTO coupons (id, seller_id, date, meal, price, note, status, created_at) VALUES (?,?,?,?,?,?,'listed',?)",
    cid, req.user.id, date, meal, p, String(note || '').slice(0, 80), nowIso());
  res.json(couponView(getCoupon(cid)));
});

// Buying moves money between two wallets, so it all happens in one transaction.
router.post('/coupons/:id/buy', auth, (req, res) => {
  const coupon = tx(() => {
    const c = getCoupon(req.params.id);
    if (!c || c.status !== 'listed') throw fail(404, 'someone was faster 😩');
    if (c.seller_id === req.user.id) throw fail(400, "can't buy your own coupon lol");
    const paid = q.run('UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?', c.price, req.user.id, c.price);
    if (!paid.changes) throw fail(400, 'not enough balance — top up first');
    q.run('UPDATE users SET wallet = wallet + ?, xp = xp + 5 WHERE id = ?', c.price, c.seller_id);
    q.run("UPDATE coupons SET status = 'sold', buyer_id = ?, sold_at = ? WHERE id = ?", req.user.id, nowIso(), c.id);
    const label = `${U.MEALS.find((m) => m.key === c.meal).label} · ${c.date}`;
    txn(req.user.id, -c.price, `Bought coupon: ${label}`);
    txn(c.seller_id, c.price, `Sold coupon: ${label}`);
    // Seller is no longer eating that meal — count it as an opt-out for prep estimates.
    q.run('INSERT OR IGNORE INTO optouts (id, user_id, date, meal, at) VALUES (?,?,?,?,?)', U.id(), c.seller_id, c.date, c.meal, nowIso());
    return getCoupon(c.id);
  });
  res.json({ coupon: couponView(coupon), balance: balanceOf(req.user.id) });
});

router.post('/coupons/:id/cancel', auth, (req, res) => {
  const { changes } = q.run("UPDATE coupons SET status = 'cancelled' WHERE id = ? AND seller_id = ? AND status = 'listed'", req.params.id, req.user.id);
  if (!changes) return res.status(400).json({ error: "can't cancel this one" });
  res.json(couponView(getCoupon(req.params.id)));
});

module.exports = { router, streakOf, ratingSummary, weekMenu };
