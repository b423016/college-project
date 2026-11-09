const BASE = import.meta.env.VITE_API || '/api';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const token = { get: () => store.get('mm_token'), set: (t) => store.set('mm_token', t) };
export const prefs = store;

export async function api(path, { method = 'GET', body } = {}) {
  const t = token.get();
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t) { token.set(null); window.dispatchEvent(new Event('mm:logout')); }
  if (!res.ok) throw new Error(data.error || 'something broke 🫠');
  return data;
}

export const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const prettyDate = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
