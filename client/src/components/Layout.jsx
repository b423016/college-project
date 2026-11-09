import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../store';
import { prefs } from '../api';
import { Sketch } from '../crayon/Sketch';
import { CRAYONS } from '../crayon/paths';
import { Chai, Sparkle, Chilli, Jalebi } from '../crayon/Doodles';
import SearchPalette from './SearchPalette';

export const NAV = [
  { to: '/', label: 'home', emoji: '🏠', color: 'orange' },
  { to: '/menu', label: 'menu', emoji: '🍛', color: 'yellow' },
  { to: '/attendance', label: 'attendance', emoji: '✅', color: 'green' },
  { to: '/notices', label: 'notices', emoji: '📢', color: 'red' },
  { to: '/community', label: 'community', emoji: '💬', color: 'blue' },
  { to: '/coupons', label: 'coupon bazaar', emoji: '🎟️', color: 'pink' },
  { to: '/speak-up', label: 'speak up', emoji: '🗣️', color: 'purple' },
  { to: '/leaderboard', label: 'leaderboard', emoji: '🏆', color: 'sky' },
];

// A crayon stick drawn in SVG, used as the nav marker.
function CrayonStick({ color, active }) {
  return (
    <motion.svg width="56" height="16" viewBox="0 0 56 16" className="crayon-stick" animate={{ x: active ? 0 : -18 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} aria-hidden="true">
      <g filter="url(#crayon)">
        <rect x="0" y="2" width="40" height="12" rx="2" fill={CRAYONS[color]} />
        <path d="M40 2 L54 7 Q56 8 54 9 L40 14 Z" fill={CRAYONS[color]} />
        <rect x="8" y="2" width="14" height="12" fill="var(--paper-card)" opacity="0.5" />
      </g>
      <path d="M0 2 H40 L54 7 Q56 8 54 9 L40 14 H0" fill="none" stroke="var(--ink)" strokeWidth="1.3" filter="url(#crayon-line)" />
    </motion.svg>
  );
}

export default function Layout({ children }) {
  const { user, extras, logout } = useApp();
  const askLogout = () => { if (window.confirm('log out of messmate?')) logout(); };
  const loc = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState(() => prefs.get('mm_theme') || 'paper');

  useEffect(() => { document.documentElement.dataset.theme = theme === 'chalk' ? 'dark' : 'light'; prefs.set('mm_theme', theme); }, [theme]);
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const nav = user?.role === 'admin' ? [...NAV, { to: '/admin', label: 'mess control', emoji: '👨‍🍳', color: 'brown' }] : NAV;

  return (
    <div className="shell">
      <aside className="side">
        <NavLink to="/" className="logo">
          <Chai size={46} boil />
          <span>mess<b>mate</b></span>
        </NavLink>
        <p className="logo-sub">iiit mess, but make it fun</p>
        <nav className="nav">
          {nav.map((n) => {
            const active = n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to);
            return (
              <NavLink key={n.to} to={n.to} className={`nav-item ${active ? 'on' : ''}`}>
                <CrayonStick color={n.color} active={active} />
                <span className="nav-label">{n.label}</span>
                {active && <motion.span layoutId="nav-blob" className="nav-blob" style={{ background: CRAYONS[n.color] }} transition={{ type: 'spring', stiffness: 350, damping: 28 }} />}
              </NavLink>
            );
          })}
        </nav>
        <button className="side-logout" onClick={askLogout}>
          <Sketch fill="red" look="scribble" gap={5} radius={14} wobble={1.4}><span>🚪 log out</span></Sketch>
        </button>
        <div className="side-doodles" aria-hidden="true">
          <Jalebi size={54} /><Chilli size={44} /><Sparkle size={30} color="var(--c-pink)" />
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="search-pill" onClick={() => setSearchOpen(true)}>
            <Sketch fill="paper" look="wash" radius={30} wobble={1.6} strokeWidth={1.8}>
              <span>🔍 search menu, posts, coupons, people…</span><kbd>⌘K</kbd>
            </Sketch>
          </button>
          <div className="top-right">
            <motion.button className="theme-btn" whileTap={{ rotate: 180, scale: 0.8 }} onClick={() => setTheme(theme === 'chalk' ? 'paper' : 'chalk')}
              title={theme === 'chalk' ? 'switch to paper' : 'switch to chalkboard'}>
              {theme === 'chalk' ? '📄' : '🖍️'}
            </motion.button>
            <NavLink to="/coupons" className="chip"><Sketch fill="green" look="scribble" gap={4} radius={20} wobble={1.3}>₹{user?.wallet ?? 0}</Sketch></NavLink>
            <NavLink to="/profile" className="chip"><Sketch fill="orange" look="scribble" gap={4} radius={20} wobble={1.3}>🔥 {extras.streak}</Sketch></NavLink>
            <NavLink to="/profile" className="avatar-btn" title="profile">
              <Sketch fill="yellow" look="scribble" shape="blob" gap={4}><span className="avatar">{user?.avatar}</span></Sketch>
            </NavLink>
            <motion.button className="logout-btn" whileTap={{ scale: 0.85, rotate: -10 }} onClick={askLogout} title="log out" aria-label="log out">
              🚪<span className="logout-text">log out</span>
            </motion.button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>

      <nav className="bottom-nav">
        {nav.slice(0, 6).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `bn-item ${isActive ? 'on' : ''}`} style={{ '--c': CRAYONS[n.color] }}>
            <span>{n.emoji}</span><small>{n.label.split(' ')[0]}</small>
          </NavLink>
        ))}
        <NavLink to="/profile" className={({ isActive }) => `bn-item ${isActive ? 'on' : ''}`} style={{ '--c': CRAYONS.purple }}>
          <span>{user?.avatar}</span><small>me</small>
        </NavLink>
      </nav>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
