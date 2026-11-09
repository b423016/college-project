import { motion } from 'framer-motion';
import { useApp, useFetch } from '../store';
import { Sketch } from '../crayon/Sketch';
import { Title, deal } from '../components/ui';
import { Ladoo, Sparkle } from '../crayon/Doodles';

const PODIUM = [
  { place: 2, h: 120, color: 'var(--c-sky)', medal: '🥈' },
  { place: 1, h: 170, color: 'var(--c-yellow)', medal: '🥇' },
  { place: 3, h: 90, color: 'var(--c-orange)', medal: '🥉' },
];

export default function Leaderboard() {
  const { user } = useApp();
  const [rows] = useFetch('/leaderboard');
  if (!rows) return <p className="loading">tallying xp…</p>;
  const myRank = rows.findIndex((r) => r.id === user.id) + 1;

  return (
    <div>
      <Title kicker="eat, rate, post, earn xp" color="sky" doodle={<Ladoo size={80} boil />}>leaderboard</Title>
      {myRank > 0 && <p className="lede">you're <b>#{myRank}</b> with {rows[myRank - 1].xp} xp {myRank <= 3 ? '👑' : '— keep eating 💪'}</p>}

      {/* 3D podium: each block is a CSS cuboid with crayon-coloured faces. */}
      <div className="podium-stage">
        <div className="podium">
          {PODIUM.map((p, i) => {
            const r = rows[p.place - 1];
            if (!r) return null;
            return (
              <motion.div key={p.place} className="podium-col" initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 120, damping: 14 }}>
                <motion.div className="podium-person" animate={{ y: [0, -8, 0] }} transition={{ duration: 2 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}>
                  {p.place === 1 && <span className="crown"><Sparkle size={28} /></span>}
                  <span className="podium-avatar">{r.avatar}</span>
                  <b>{r.name.split(' ')[0]}</b>
                  <small>{r.xp} xp</small>
                </motion.div>
                <div className="block" style={{ '--h': `${p.h}px`, '--c': p.color }}>
                  <div className="face front"><span>{p.medal}</span><b>{p.place}</b></div>
                  <div className="face top" />
                  <div className="face side" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <motion.ol className="ranks" variants={deal.wrap} initial="hidden" animate="show" start={4}>
        {rows.slice(3).map((r, i) => (
          <motion.li key={r.id} variants={deal.item} className={r.id === user.id ? 'me' : ''}>
            <Sketch fill={r.id === user.id ? 'yellow' : 'paper'} look={r.id === user.id ? 'scribble' : 'wash'} gap={6} radius={16} seed={'rk' + r.id} className="rank-row">
              <b className="rank-n">#{i + 4}</b>
              <span className="avatar sm">{r.avatar}</span>
              <span className="rank-name"><b>{r.name}</b><small className="muted">{r.hostel}</small></span>
              <span className="small">🔥{r.streak} · 🍽️{r.meals}</span>
              <b>{r.xp} xp</b>
            </Sketch>
          </motion.li>
        ))}
      </motion.ol>
      <p className="small muted">how to earn: check in +10 · rate a meal +5 · sell a coupon +5 · post +3 · complaint +2 · skip in advance +2 · 7-day streak bonus +50</p>
    </div>
  );
}
