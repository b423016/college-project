// Hand-drawn path generators. Everything is seeded so a shape keeps the same
// wobble across re-renders instead of jittering on every state change.

export function rng(seed) {
  let a = typeof seed === 'number' ? seed : hash(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const f = (n) => n.toFixed(1);

// One wobbly stroke from a to b, slightly overshooting like a real hand.
function roughLine(r, x1, y1, x2, y2, wob) {
  const j = () => (r() - 0.5) * wob * 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ox = ((x2 - x1) / len) * wob * 1.2, oy = ((y2 - y1) / len) * wob * 1.2;
  const sx = x1 - ox * r() + j(), sy = y1 - oy * r() + j();
  const ex = x2 + ox * r() + j(), ey = y2 + oy * r() + j();
  const c1x = x1 + (x2 - x1) * 0.35 + j() * 1.5, c1y = y1 + (y2 - y1) * 0.35 + j() * 1.5;
  const c2x = x1 + (x2 - x1) * 0.7 + j() * 1.5, c2y = y1 + (y2 - y1) * 0.7 + j() * 1.5;
  return `M${f(sx)} ${f(sy)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(ex)} ${f(ey)}`;
}

// Outline of a rectangle drawn as two loose passes — the classic crayon double line.
export function roughRect(seed, x, y, w, h, wob = 2.5, passes = 2) {
  const r = rng(seed);
  let d = '';
  for (let p = 0; p < passes; p++) {
    d += roughLine(r, x, y, x + w, y, wob) + roughLine(r, x + w, y, x + w, y + h, wob)
      + roughLine(r, x + w, y + h, x, y + h, wob) + roughLine(r, x, y + h, x, y, wob);
  }
  return d;
}

// Rounded-corner outline in two loose passes that don't quite agree — no hard box corners.
export function roughRounded(seed, x, y, w, h, wob = 3, radius = 20) {
  const r = rng(seed);
  const a = lumpyRect(seed + 'a', x, y, w, h, wob, radius * (0.8 + r() * 0.4));
  const b = lumpyRect(seed + 'b', x + (r() - 0.5) * 2, y + (r() - 0.5) * 2, w, h, wob * 1.2, radius * (0.7 + r() * 0.5));
  return a + b.replace(/Z$/, '');
}

// Closed, slightly lumpy shape (for fills and clip paths).
export function lumpyRect(seed, x, y, w, h, wob = 2.5, radius = 10) {
  const r = rng(seed);
  const pts = [];
  const step = 40;
  const rad = Math.min(radius, w / 2, h / 2);
  const push = (px, py) => pts.push([px + (r() - 0.5) * wob * 2, py + (r() - 0.5) * wob * 2]);
  for (let i = rad; i < w - rad; i += step) push(x + i, y);
  push(x + w - rad * 0.3, y + rad * 0.3);
  for (let i = rad; i < h - rad; i += step) push(x + w, y + i);
  push(x + w - rad * 0.3, y + h - rad * 0.3);
  for (let i = w - rad; i > rad; i -= step) push(x + i, y + h);
  push(x + rad * 0.3, y + h - rad * 0.3);
  for (let i = h - rad; i > rad; i -= step) push(x, y + i);
  push(x + rad * 0.3, y + rad * 0.3);
  return smoothClosed(pts);
}

export function blob(seed, cx, cy, rx, ry, lump = 0.08, n = 9) {
  const r = rng(seed);
  const pts = [];
  const off = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * lump * 2;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothClosed(pts);
}

// Two loose passes around an ellipse, the second not quite closing.
export function roughEllipse(seed, cx, cy, rx, ry, wob = 2) {
  const r = rng(seed);
  let d = '';
  for (let p = 0; p < 2; p++) {
    const n = 10;
    const start = r() * Math.PI * 2;
    const sweep = Math.PI * 2 * (1.04 + r() * 0.08);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = start + (i / n) * sweep;
      pts.push([cx + Math.cos(a) * (rx + (r() - 0.5) * wob * 2), cy + Math.sin(a) * (ry + (r() - 0.5) * wob * 2)]);
    }
    d += smoothOpen(pts);
  }
  return d;
}

// Zigzag coloring strokes filling a bounding box — clip it to a shape for the
// "kid colouring inside (and a bit outside) the lines" look.
export function scribbleFill(seed, x, y, w, h, gap = 7, angle = -32) {
  const r = rng(seed);
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const cx = x + w / 2, cy = y + h / 2;
  const diag = Math.hypot(w, h) / 2 + gap;
  const pts = [];
  let flip = false;
  for (let t = -diag; t <= diag; t += gap * (0.8 + r() * 0.4)) {
    const ends = [[-diag, t], [diag, t]];
    if (flip) ends.reverse();
    flip = !flip;
    for (const [u, v] of ends) {
      const jx = (r() - 0.5) * gap * 0.8, jy = (r() - 0.5) * gap * 0.6;
      pts.push([cx + u * cos - v * sin + jx, cy + u * sin + v * cos + jy]);
    }
  }
  return 'M' + pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L');
}

// Wiggly hand underline.
export function underline(seed, w, h = 12) {
  const r = rng(seed);
  const n = Math.max(3, Math.round(w / 60));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * w, h / 2 + (r() - 0.5) * h * 0.7]);
  const back = [];
  for (let i = n; i >= Math.round(n * 0.25); i--) back.push([(i / n) * w + (r() - 0.5) * 8, h / 2 + 3 + (r() - 0.5) * h * 0.6]);
  return smoothOpen(pts) + smoothOpen(back);
}

function smoothClosed(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

function smoothOpen(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

// Crayon box palette, used by name across the app.
export const CRAYONS = {
  red: 'var(--c-red)', orange: 'var(--c-orange)', yellow: 'var(--c-yellow)', green: 'var(--c-green)',
  blue: 'var(--c-blue)', purple: 'var(--c-purple)', pink: 'var(--c-pink)', brown: 'var(--c-brown)', sky: 'var(--c-sky)',
};
export const CRAYON_ORDER = ['orange', 'blue', 'pink', 'green', 'yellow', 'purple', 'red', 'sky'];
