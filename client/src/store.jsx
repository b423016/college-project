import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, token } from './api';
import { Sketch } from './crayon/Sketch';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [extras, setExtras] = useState({ streak: 0, badges: [] });
  const [booting, setBooting] = useState(!!token.get());
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api('/me');
      setUser(r.user);
      setExtras({ streak: r.streak, badges: r.badges });
    } catch { setUser(null); } finally { setBooting(false); }
  }, []);

  useEffect(() => {
    if (token.get()) refresh();
    const out = () => setUser(null);
    window.addEventListener('mm:logout', out);
    return () => window.removeEventListener('mm:logout', out);
  }, [refresh]);

  const signIn = async (path, body) => {
    const r = await api(path, { method: 'POST', body });
    token.set(r.token);
    await refresh();
  };
  // Ends the session on the server (token stops working everywhere it was copied), then clears it locally.
  const logout = async ({ everywhere = false } = {}) => {
    try { await api(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }); } catch { /* already expired: still log out locally */ }
    token.set(null);
    setUser(null);
    setExtras({ streak: 0, badges: [] });
    toast(everywhere ? 'logged out on every device 👋' : 'logged out, see you at the next meal 👋');
  };

  return (
    <Ctx.Provider value={{ user, setUser, extras, refresh, signIn, logout, toast, booting }}>
      {children}
      <div className="toasts" role="status">
        <AnimatePresence>
          {toasts.map((t, i) => (
            <motion.div key={t.id} layout initial={{ y: 60, opacity: 0, rotate: 6 }} animate={{ y: 0, opacity: 1, rotate: i % 2 ? 1.5 : -1.5 }}
              exit={{ x: 120, opacity: 0, rotate: 12 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
              <Sketch fill={t.kind === 'err' ? 'red' : 'green'} look="scribble" gap={5} className="toast">{t.msg}</Sketch>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

// Small fetch hook: returns [data, setData, reload, loading, error].
export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    setLoading(true);
    return api(path).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return [data, setData, reload, loading, error];
}
