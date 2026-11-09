import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api';
import { Sketch } from '../crayon/Sketch';
import { NAV } from './Layout';

const SUGGEST = ['paneer', 'biryani', 'dinner coupon', 'diwali', 'momos', 'cold rotis'];

export default function SearchPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  const go = useNavigate();

  useEffect(() => { if (open) { setQ(''); setResults([]); setTimeout(() => input.current?.focus(), 50); } }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      // With no query, the palette doubles as a page jumper.
      setResults(NAV.filter((n) => n.label.includes(q.trim().toLowerCase())).map((n) => ({ type: 'page', title: n.label, emoji: n.emoji, to: n.to, sub: 'go to page' })));
      return;
    }
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([])), 160);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setSel(0), [results]);

  const pick = (r) => { onClose(); go(r.to); };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter' && results[sel]) pick(results[sel]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="palette" onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, rotate: -4, scale: 0.9 }} animate={{ y: 0, rotate: -0.6, scale: 1 }} exit={{ y: -30, rotate: 3, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
            <Sketch fill="paper" radius={20}>
              <div className="palette-in">
                <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="what are u looking for…" className="palette-input" />
                {q.length < 2 && (
                  <div className="suggest">
                    {SUGGEST.map((s) => <button key={s} className="tag" onClick={() => setQ(s)}>{s}</button>)}
                  </div>
                )}
                <ul className="palette-list">
                  {results.map((r, i) => (
                    <motion.li key={r.type + r.title + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => pick(r)}>
                      <span className="pe">{r.emoji}</span>
                      <span className="pt"><b>{r.title}</b><small>{r.sub}</small></span>
                      <span className="ptype">{r.type}</span>
                    </motion.li>
                  ))}
                  {q.length >= 2 && results.length === 0 && <li className="empty">nothing found… try "paneer" 🧀</li>}
                </ul>
              </div>
            </Sketch>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
