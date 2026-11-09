import { motion } from 'framer-motion';
import { api, localDate, prettyDate } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, Sticker } from '../crayon/Sketch';
import { Title, deal } from '../components/ui';
import { blob } from '../crayon/paths';
import { MEAL_DOODLE, Ladoo } from '../crayon/Doodles';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', color: 'var(--c-yellow)' },
  { key: 'lunch', label: 'Lunch', color: 'var(--c-orange)' },
  { key: 'snacks', label: 'Snacks', color: 'var(--c-pink)' },
  { key: 'dinner', label: 'Dinner', color: 'var(--c-blue)' },
];

export default function Attendance() {
  const { toast, refresh } = useApp();
  const [data, setData] = useFetch('/attendance/me');
  if (!data) return <p className="loading">counting your meals…</p>;

  // Five weeks of days, ending today, laid out in weekday columns.
  const days = [];
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 34 - ((end.getDay() + 6) % 7) + 6);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(localDate(d));

  const upcoming = [0, 1, 2].map((n) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); });
  const isOut = (date, meal) => data.optouts.some((o) => o.date === date && o.meal === meal);
  const toggle = async (date, meal) => {
    try {
      const r = await api('/attendance/optout', { method: 'POST', body: { date, meal } });
      setData({ ...data, optouts: r.optedOut ? [...data.optouts, { date, meal }] : data.optouts.filter((o) => !(o.date === date && o.meal === meal)) });
      toast(r.optedOut ? 'skipped — mess will cook less 🌱' : 'back on the list 🍽️');
      if (r.optedOut) refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
  const max = Math.max(1, ...Object.values(data.perMeal));

  return (
    <div>
      <Title kicker="your mess diary" color="green" doodle={<Ladoo size={80} boil />}>attendance</Title>

      <motion.div className="stat-row" variants={deal.wrap} initial="hidden" animate="show">
        {[
          ['total meals', data.total, 'orange'], ['day streak', `${data.streak}🔥`, 'yellow'],
          ['last 30 days', `${data.percent30}%`, 'sky'], ['meals this month', data.last30, 'pink'],
        ].map(([l, v, c], i) => (
          <motion.div key={l} variants={deal.item} style={{ rotate: [-2, 1.5, -1, 2][i] }}>
            <Sketch fill={c} look="scribble" gap={7} className="stat"><b className="big-num">{v}</b><span>{l}</span></Sketch>
          </motion.div>
        ))}
      </motion.div>

      <div className="att-grid">
        <Sketch fill="paper" className="heat-card">
          <h3 className="h3">5 week heatmap</h3>
          <div className="heat-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="heat">
            {days.map((d, i) => {
              const n = data.byDate[d]?.length || 0;
              return (
                <motion.div key={d} className="heat-cell" title={`${prettyDate(d)} · ${n} meals`}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.012, type: 'spring', stiffness: 400 }}>
                  <svg viewBox="0 0 40 40">
                    <path d={blob(d, 20, 20, 15, 15, 0.18, 7)} fill={n ? 'var(--c-green)' : 'transparent'} opacity={0.25 + n * 0.19} filter="url(#crayon)" />
                    <path d={blob(d + 'o', 20, 20, 15, 15, 0.18, 7)} fill="none" stroke="var(--ink)" strokeWidth="1.2" opacity="0.5" filter="url(#crayon-line)" />
                    {d === localDate() && <circle cx="20" cy="20" r="18" fill="none" stroke="var(--c-red)" strokeWidth="2.4" filter="url(#crayon-line)" />}
                  </svg>
                  <small>{Number(d.slice(8))}</small>
                </motion.div>
              );
            })}
          </div>
          <p className="small muted">darker green = more meals that day. red circle = today.</p>
        </Sketch>

        <Sketch fill="paper" className="bars-card">
          <h3 className="h3">which meal u never miss</h3>
          {MEALS.map((m, i) => {
            const D = MEAL_DOODLE[m.key];
            return (
              <div key={m.key} className="hbar">
                <D size={38} />
                <span className="hbar-label">{m.label}</span>
                <div className="hbar-track">
                  <motion.svg className="hbar-fill" viewBox="0 0 100 20" preserveAspectRatio="none" initial={{ width: 0 }} animate={{ width: `${(data.perMeal[m.key] / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 60 }}>
                    <path d="M2 4 L98 3 L97 17 L3 16 Z" fill={m.color} filter="url(#crayon)" />
                  </motion.svg>
                </div>
                <b>{data.perMeal[m.key]}</b>
              </div>
            );
          })}
        </Sketch>
      </div>

      <section className="optout">
        <h2 className="h2">skipping a meal? <span className="muted small">tell the mess in advance so less food gets wasted 🌱 (+2 xp)</span></h2>
        <div className="optout-grid">
          {upcoming.map((date, di) => (
            <Sketch key={date} fill="paper" className="optout-day" seed={'od' + date} style={{ rotate: `${[-1, 1, -0.5][di]}deg` }}>
              <h4>{di === 0 ? 'today' : di === 1 ? 'tomorrow' : prettyDate(date)}</h4>
              {MEALS.map((m) => {
                const out = isOut(date, m.key);
                return (
                  <motion.button key={m.key} className={`optout-row ${out ? 'out' : ''}`} onClick={() => toggle(date, m.key)} whileTap={{ scale: 0.95 }}>
                    <span>{m.label}</span>
                    <span className="optout-mark">
                      {out ? (
                        <svg viewBox="0 0 30 30" width="28" height="28"><motion.path d="M5 5 L25 25 M25 5 L5 25" stroke="var(--c-red)" strokeWidth="4" strokeLinecap="round" filter="url(#crayon)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} /></svg>
                      ) : (
                        <svg viewBox="0 0 30 30" width="28" height="28"><path d="M5 16 L12 23 L26 6" stroke="var(--c-green)" strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#crayon)" /></svg>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </Sketch>
          ))}
        </div>
        {data.optouts.length > 0 && <Sticker fill="green" tilt={-2}>you're skipping {data.optouts.length} upcoming meal{data.optouts.length > 1 ? 's' : ''} — planet says thx 🌍</Sticker>}
      </section>
    </div>
  );
}
