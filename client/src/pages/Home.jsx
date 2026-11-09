import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useApp, useFetch } from '../store';
import Thali3D from '../components/Thali3D';
import { Sketch, Scrawl, CrayonButton, Sticker } from '../crayon/Sketch';
import { Confetti, deal } from '../components/ui';
import { Flame, Sparkle } from '../crayon/Doodles';
import { roughEllipse } from '../crayon/paths';

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const greet = () => { const h = new Date().getHours(); return h < 11 ? 'good morning' : h < 16 ? 'afternoon' : h < 20 ? 'evening' : 'late night'; };

function useThaliSize() {
  const calc = () => Math.max(260, Math.min(400, window.innerWidth - 48));
  const [size, setSize] = useState(calc);
  useEffect(() => { const r = () => setSize(calc()); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  return size;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(t); }, []);
  return now;
}

export default function Home() {
  const { user, extras, refresh, toast } = useApp();
  const [menu] = useFetch('/menu');
  const [live, , reloadLive] = useFetch('/attendance/live');
  const [notices] = useFetch('/announcements');
  const now = useClock();
  const thaliSize = useThaliSize();

  useEffect(() => { const t = setInterval(reloadLive, 15_000); return () => clearInterval(t); }, [reloadLive]);

  const focus = menu && (menu.current ? menu.todays.find((m) => m.key === menu.current.key) : menu.todays.find((m) => m.key === menu.next.key));
  const nm = now.getHours() * 60 + now.getMinutes();
  const countdown = menu && (menu.current
    ? `closes in ${toMin(menu.current.end) - nm} min`
    : (() => { let d = toMin(menu.next.start) - nm; if (d < 0) d += 1440; return `opens in ${Math.floor(d / 60)}h ${d % 60}m`; })());
  const pinned = notices?.[0];

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hello">
          <p className="kicker">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mega">
            {greet()},<br /><Scrawl color="pink" mode="mark" seed={user.name}>{user.name.split(' ')[0]}</Scrawl> {user.avatar}
          </h1>
          {focus && (
            <Sketch fill="paper" className="now-card" motionProps={{ initial: { rotate: -3, y: 20, opacity: 0 }, animate: { rotate: -1, y: 0, opacity: 1 } }}>
              <div className="now-head">
                <Sticker fill={menu.current ? 'green' : 'sky'} tilt={-4}>{menu.current ? '● now serving' : 'up next'}</Sticker>
                <span className="muted">{focus.start}–{focus.end} · {countdown}</span>
              </div>
              <h2 className="h2">{focus.emoji} {focus.label}</h2>
              <div className="tags">
                {focus.items.map((it, i) => (
                  <motion.span key={it} className="tag" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.07, type: 'spring' }}>{it}</motion.span>
                ))}
              </div>
              {focus.rating.count > 0 && <p className="muted small">today's vibe: {'★'.repeat(Math.round(focus.rating.avg))} ({focus.rating.count} ratings) {Object.keys(focus.rating.vibes).slice(0, 3).join('')}</p>}
              <Link to="/menu" className="link">full week menu →</Link>
            </Sketch>
          )}
        </div>
        <div className="home-thali">{focus && <Thali3D items={focus.items} size={thaliSize} />}</div>
      </section>

      <motion.section className="collage" variants={deal.wrap} initial="hidden" animate="show">
        <motion.div variants={deal.item} className="c-checkin"><CheckIn onDone={() => { refresh(); reloadLive(); }} toast={toast} /></motion.div>
        <motion.div variants={deal.item} className="c-rush"><Rush live={live} /></motion.div>
        <motion.div variants={deal.item} className="c-streak">
          <Sketch fill="yellow" look="scribble" gap={7} className="streak-card">
            <Flame size={86} boil />
            <div><b className="big-num">{extras.streak}</b><span>day streak</span></div>
            <p className="small">{extras.streak >= 7 ? 'absolute menace 🔥' : 'eat daily to keep it lit'}</p>
            <p className="small muted">{user.xp} xp · <Link to="/leaderboard" className="link">leaderboard</Link></p>
          </Sketch>
        </motion.div>
        {pinned && (
          <motion.div variants={deal.item} className="c-notice">
            <div className="tape" />
            <Sketch fill="paper" className="note-card">
              <p className="kicker">{pinned.pinned ? '📌 pinned notice' : 'latest notice'}</p>
              <h3 className="h3">{pinned.title}</h3>
              <p className="clamp">{pinned.body}</p>
              <Link to="/notices" className="link">notice board →</Link>
            </Sketch>
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}

function CheckIn({ onDone, toast }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState(0);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/attendance/checkin', { method: 'POST', body: { code } });
      toast(`checked in for ${r.meal.label.toLowerCase()} ✅ +${r.xpGained} xp`);
      setParty((p) => p + 1);
      setCode('');
      onDone();
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sketch fill="sky" look="scribble" gap={8} className="checkin-card">
      <Confetti show={party} key={party} />
      <h3 className="h3">mark attendance</h3>
      <p className="small">type the 6-letter code on the screen at the mess door 👀</p>
      <form onSubmit={submit} className="code-form">
        <div className="code-boxes">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="XXXXXX" aria-label="check-in code" maxLength={6} inputMode="text" autoCapitalize="characters" />
        </div>
        <CrayonButton fill="yellow" type="submit" disabled={busy || code.length < 6} small>i'm here!</CrayonButton>
      </form>
    </Sketch>
  );
}

function Rush({ live }) {
  const level = live?.level ?? 0;
  const angle = -90 + (level / 100) * 180;
  return (
    <Sketch fill="paper" className="rush-card">
      <h3 className="h3">rush meter</h3>
      <svg viewBox="0 0 200 120" className="gauge" aria-label={`crowd level ${level} percent`}>
        <g filter="url(#crayon)" fill="none" strokeWidth="20" strokeLinecap="round">
          <path d="M24 104 A76 76 0 0 1 62 38" stroke="var(--c-green)" />
          <path d="M66 36 A76 76 0 0 1 134 36" stroke="var(--c-yellow)" />
          <path d="M138 38 A76 76 0 0 1 176 104" stroke="var(--c-red)" />
        </g>
        <path d={roughEllipse('g', 100, 104, 8, 8, 1)} fill="var(--ink)" />
        <g className="needle" style={{ transform: `rotate(${angle}deg)` }}>
          <path d="M96.5 104 Q99 60 100 32 Q101 60 103.5 104 Z" fill="var(--ink)" filter="url(#crayon-line)" />
        </g>
      </svg>
      <p className="rush-label"><b>{live?.label || '…'}</b></p>
      <p className="small muted">{live?.meal ? `${live.inMeal} checked in for ${live.meal.label.toLowerCase()}` : `next: ${live?.next?.label ?? ''} at ${live?.next?.start ?? ''}`}</p>
      <span className="rush-spark"><Sparkle size={24} color="var(--c-pink)" /></span>
    </Sketch>
  );
}

