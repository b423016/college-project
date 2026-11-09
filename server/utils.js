const crypto = require('crypto');

const SECRET = process.env.APP_SECRET || 'messmate-dev-secret-change-me';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳', start: '07:30', end: '09:30', price: 40 },
  { key: 'lunch', label: 'Lunch', emoji: '🍛', start: '12:30', end: '14:30', price: 70 },
  { key: 'snacks', label: 'Snacks', emoji: '🥪', start: '17:00', end: '18:15', price: 30 },
  { key: 'dinner', label: 'Dinner', emoji: '🍲', start: '19:30', end: '21:30', price: 70 },
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const id = () => crypto.randomBytes(6).toString('hex');
const dateStr = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

function currentMeal(d = new Date()) {
  const n = nowMin(d);
  return MEALS.find((m) => n >= toMin(m.start) && n <= toMin(m.end)) || null;
}

// Meal whose window is closest to now — used for check-ins outside hours in demo mode.
function nearestMeal(d = new Date()) {
  const n = nowMin(d);
  const dist = (m) => Math.min(Math.abs(n - toMin(m.start)), Math.abs(n - toMin(m.end)));
  return [...MEALS].sort((a, b) => dist(a) - dist(b))[0];
}

function nextMeal(d = new Date()) {
  const n = nowMin(d);
  return MEALS.find((m) => toMin(m.start) > n) || MEALS[0];
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(8).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

// Rotating 6-char check-in code shown on the mess screen; changes every 30s.
const CODE_WINDOW_MS = 30_000;
function messCode(windowIndex = Math.floor(Date.now() / CODE_WINDOW_MS)) {
  const h = crypto.createHmac('sha256', SECRET).update(`code:${windowIndex}`).digest();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(h.subarray(0, 6), (b) => alphabet[b % alphabet.length]).join('');
}
function isValidCode(code) {
  const w = Math.floor(Date.now() / CODE_WINDOW_MS);
  const c = String(code || '').trim().toUpperCase();
  return c === messCode(w) || c === messCode(w - 1); // grace for the previous window
}

module.exports = {
  MEALS, DAYS, CODE_WINDOW_MS, id, dateStr, toMin, nowMin, currentMeal, nearestMeal, nextMeal,
  hashPassword, verifyPassword, messCode, isValidCode,
};
