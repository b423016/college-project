import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, CrayonButton, Sticker } from '../crayon/Sketch';
import { Title, Pills, Field, deal, tilt } from '../components/ui';
import { MEAL_DOODLE, Curry } from '../crayon/Doodles';

export default function Admin() {
  const [stats, , reloadStats] = useFetch('/admin/stats');
  useEffect(() => { const t = setInterval(reloadStats, 20_000); return () => clearInterval(t); }, [reloadStats]);

  return (
    <div>
      <Title kicker="for the mess office only" color="orange" doodle={<Curry size={84} boil />}>mess control</Title>
      <div className="admin-top">
        <LiveCode />
        {stats && (
          <div className="stat-row">
            {[['students', stats.students, 'sky'], ['open complaints', stats.openComplaints, 'red'], ['coupons resold', stats.couponsSold, 'pink'], ['meals saved 🌱', stats.mealsSaved, 'green']].map(([l, v, c], i) => (
              <Sketch key={l} fill={c} look="scribble" gap={7} className="stat" style={{ rotate: `${tilt(i)}deg` }}><b className="big-num">{v}</b><span>{l}</span></Sketch>
            ))}
          </div>
        )}
      </div>

      {stats && (
        <>
          <h2 className="h2">today's kitchen plan</h2>
          <motion.div className="meal-grid" variants={deal.wrap} initial="hidden" animate="show">
            {stats.meals.map((m, i) => {
              const D = MEAL_DOODLE[m.key];
              return (
                <motion.div key={m.key} variants={deal.item} style={{ rotate: tilt(i) }}>
                  <Sketch fill="paper" className="meal-card" seed={'adm' + m.key}>
                    <div className="meal-head"><D size={56} /><div><h3 className="h3">{m.label}</h3><span className="muted small">{m.start}–{m.end}</span></div></div>
                    <dl className="kv">
                      <dt>checked in</dt><dd>{m.attended}</dd>
                      <dt>opted out</dt><dd>{m.optedOut}</dd>
                      <dt>cook for</dt><dd><b>{m.expected}</b></dd>
                      <dt>tomorrow</dt><dd>{m.expectedTomorrow}</dd>
                      <dt>rating</dt><dd>{m.rating.avg ? `${m.rating.avg.toFixed(1)}★ (${m.rating.count})` : '—'}</dd>
                    </dl>
                  </Sketch>
                </motion.div>
              );
            })}
          </motion.div>
          <TrendChart trend={stats.trend} />
        </>
      )}
      <MenuEditor />
    </div>
  );
}

// Rotating check-in code to put on the screen at the mess door.
function LiveCode() {
  const [c, setC] = useState(null);
  const [left, setLeft] = useState(30);
  useEffect(() => {
    let alive = true;
    const load = () => api('/attendance/code').then((r) => { if (alive) { setC(r); setLeft(Math.ceil(r.msLeft / 1000)); } });
    load();
    const tick = setInterval(() => setLeft((l) => { if (l <= 1) { load(); return 30; } return l - 1; }), 1000);
    return () => { alive = false; clearInterval(tick); };
  }, []);
  const circ = 2 * Math.PI * 26;
  return (
    <Sketch fill="yellow" look="scribble" gap={9} className="live-code">
      <p className="kicker">show this at the mess door · {c?.meal?.label}</p>
      <div className="code-row">
        <div className="code-chars" key={c?.code || 'loading'}>
          {(c?.code || '······').split('').map((ch, i) => (
            <motion.span key={i} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 260 }}>{ch}</motion.span>
          ))}
        </div>
        <svg viewBox="0 0 60 60" width="64" height="64" aria-label={`${left} seconds left`}>
          <circle cx="30" cy="30" r="26" fill="none" stroke="var(--ink)" strokeOpacity="0.15" strokeWidth="6" />
          <circle cx="30" cy="30" r="26" fill="none" stroke="var(--c-red)" strokeWidth="6" strokeLinecap="round" filter="url(#crayon)"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - left / 30)} transform="rotate(-90 30 30)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
          <text x="30" y="36" textAnchor="middle" className="code-secs">{left}</text>
        </svg>
      </div>
      <p className="small">rotates every 30s — screenshots don't work 😏</p>
    </Sketch>
  );
}

// 7-day headcount, one series → hand-drawn bars with a hover tooltip per bar.
function TrendChart({ trend }) {
  const [hover, setHover] = useState(null);
  const W = 560, H = 220, pad = { l: 36, r: 12, t: 16, b: 34 };
  const max = Math.max(4, ...trend.map((t) => t.count));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const bw = (W - pad.l - pad.r) / trend.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / top);

  return (
    <Sketch fill="paper" className="chart-card">
      <h3 className="h3">meals served · last 7 days</h3>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="meals served per day over the last week">
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <line x1={pad.l} x2={W - pad.r} y1={y(k * step)} y2={y(k * step)} stroke="var(--ink)" strokeOpacity={k ? 0.1 : 0.5} strokeWidth="1" strokeDasharray={k ? '3 5' : undefined} />
              <text x={pad.l - 8} y={y(k * step) + 4} textAnchor="end" className="axis">{k * step}</text>
            </g>
          ))}
          {trend.map((t, i) => {
            const x = pad.l + i * bw + bw * 0.2, w = bw * 0.6, h = y(0) - y(t.count);
            return (
              <g key={t.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                <motion.path filter="url(#crayon)" fill="var(--c-orange)" opacity={hover === null || hover === i ? 1 : 0.45}
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ originY: `${y(0)}px` }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 90 }}
                  d={`M${x} ${y(0)} L${x + 1} ${y(0) - h + 4} Q${x + 2} ${y(0) - h} ${x + 6} ${y(0) - h} L${x + w - 6} ${y(0) - h + 1} Q${x + w - 1} ${y(0) - h + 1} ${x + w - 1} ${y(0) - h + 5} L${x + w} ${y(0)} Z`} />
                <text x={x + w / 2} y={H - 12} textAnchor="middle" className="axis">{t.day}</text>
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="tip" style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, top: `${(y(trend[hover].count) / H) * 100}%` }}>
            <b>{trend[hover].count} meals</b><br />{trend[hover].date}<br />{trend[hover].avg ? `avg ${trend[hover].avg.toFixed(1)}★` : 'no ratings'}
          </div>
        )}
      </div>
    </Sketch>
  );
}

function MenuEditor() {
  const { toast } = useApp();
  const [data, setData] = useFetch('/menu');
  const [day, setDay] = useState('Monday');
  const [draft, setDraft] = useState(null);
  useEffect(() => { if (data) setDraft(Object.fromEntries(data.meals.map((m) => [m.key, data.week[day][m.key].join(', ')]))); }, [data, day]);
  if (!data || !draft) return null;

  const save = async () => {
    const body = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.split(',').map((s) => s.trim()).filter(Boolean)]));
    try { const r = await api(`/menu/${day}`, { method: 'PUT', body }); setData({ ...data, week: { ...data.week, [day]: r.menu } }); toast(`${day} menu updated 🍳`); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <section className="menu-editor">
      <h2 className="h2">edit weekly menu</h2>
      <Pills options={[...data.days.slice(1), data.days[0]].map((d) => ({ value: d, label: d.slice(0, 3) }))} value={day} onChange={setDay} />
      <Sketch fill="paper" className="composer">
        <div className="stack">
          {data.meals.map((m) => <Field key={m.key} label={`${m.emoji} ${m.label} (comma separated)`} value={draft[m.key]} onChange={(e) => setDraft({ ...draft, [m.key]: e.target.value })} />)}
          <div className="composer-row"><Sticker fill="sky" tilt={-2}>students see changes instantly</Sticker><CrayonButton small fill="orange" onClick={save}>save {day}</CrayonButton></div>
        </div>
      </Sketch>
    </section>
  );
}
