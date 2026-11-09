import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, CrayonButton, Star, Sticker } from '../crayon/Sketch';
import { Title, Pills, Field, deal, tilt } from '../components/ui';
import { MEAL_DOODLE, doodleFor, Pizza } from '../crayon/Doodles';

const MEAL_COLORS = { breakfast: 'yellow', lunch: 'orange', snacks: 'pink', dinner: 'blue' };
const VIBES = ['🔥', '😋', '😐', '🤢', '💀'];
const VIBE_WORDS = { '🔥': 'bussin', '😋': 'tasty', '😐': 'mid', '🤢': 'nah', '💀': 'crime' };

export default function Menu() {
  const [data, setData] = useFetch('/menu');
  const [params, setParams] = useSearchParams();
  const [day, setDay] = useState(null);

  useEffect(() => { if (data && !day) setDay(params.get('day') || data.day); }, [data, day, params]);
  if (!data || !day) return <p className="loading">reading the menu…</p>;

  const isToday = day === data.day;
  const order = [...data.days.slice(1), data.days[0]]; // Mon → Sun

  return (
    <div className="menu-page">
      <Title kicker="this week at the mess" color="yellow" doodle={<Pizza size={80} boil />}>what's on the menu</Title>
      <Pills options={order.map((d) => ({ value: d, label: d === data.day ? `${d.slice(0, 3)} · today` : d.slice(0, 3) }))} value={day} onChange={(d) => { setDay(d); setParams({ day: d }); }} />

      <AnimatePresence mode="wait">
        <motion.div key={day} className="meal-grid" variants={deal.wrap} initial="hidden" animate="show" exit={{ opacity: 0, y: 10 }}>
          {data.meals.map((m, i) => {
            const D = MEAL_DOODLE[m.key];
            const today = isToday ? data.todays.find((t) => t.key === m.key) : null;
            const live = isToday && data.current?.key === m.key;
            return (
              <motion.div key={m.key} variants={deal.item} style={{ rotate: tilt(i) }} whileHover={{ rotate: 0, y: -6, transition: { type: 'spring', stiffness: 300 } }}>
                <Sketch fill="paper" className="meal-card" seed={day + m.key}>
                  <div className="meal-head">
                    <D size={70} boil={live} />
                    <div>
                      <h3 className="h3">{m.label}</h3>
                      <span className="muted small">{m.start}–{m.end} · ₹{m.price}</span>
                    </div>
                    {live && <Sticker fill="green" tilt={8} className="live-tag">live!</Sticker>}
                  </div>
                  <ul className="dish-list">
                    {data.week[day][m.key].map((it) => {
                      const DI = doodleFor(it);
                      return <li key={it}><DI size={30} /><span>{it}</span></li>;
                    })}
                  </ul>
                  {today && <RateMeal meal={today} color={MEAL_COLORS[m.key]} onRated={(summary, rating) =>
                    setData({ ...data, todays: data.todays.map((t) => (t.key === m.key ? { ...t, rating: summary, myRating: rating } : t)) })} />}
                </Sketch>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <Wishlist />
    </div>
  );
}

function RateMeal({ meal, color, onRated }) {
  const { toast, refresh } = useApp();
  const [stars, setStars] = useState(meal.myRating?.stars || 0);
  const [hover, setHover] = useState(0);
  const [vibe, setVibe] = useState(meal.myRating?.vibe || '');
  const send = async (s, v) => {
    try {
      const r = await api('/menu/rate', { method: 'POST', body: { meal: meal.key, stars: s, vibe: v || VIBES[5 - s] } });
      onRated(r.summary, r.rating);
      if (!meal.myRating) { toast('rated! +5 xp ⭐'); refresh(); }
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Sketch fill={color} look="scribble" gap={6} className="rate-box" seed={'r' + meal.key}>
      <div className="rate-row">
        <span className="small"><b>rate it</b></span>
        <div className="stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} whileHover={{ scale: 1.25, rotate: 12 }} whileTap={{ scale: 0.8 }} onMouseEnter={() => setHover(n)}
              onClick={() => { setStars(n); send(n, vibe); }} aria-label={`${n} stars`}>
              <Star filled={n <= (hover || stars)} size={26} seed={'st' + n} />
            </motion.button>
          ))}
        </div>
      </div>
      <div className="vibes">
        {VIBES.map((v) => (
          <motion.button key={v} className={vibe === v ? 'on' : ''} whileHover={{ y: -4, rotate: -8 }} whileTap={{ scale: 0.8 }}
            onClick={() => { setVibe(v); if (stars) send(stars, v); else { setStars(5 - VIBES.indexOf(v)); send(5 - VIBES.indexOf(v), v); } }} title={VIBE_WORDS[v]}>
            {v}<small>{VIBE_WORDS[v]}</small>
          </motion.button>
        ))}
      </div>
      {meal.rating.count > 0 && <p className="small">avg {meal.rating.avg.toFixed(1)}★ from {meal.rating.count} ppl</p>}
    </Sketch>
  );
}

function Wishlist() {
  const { user, toast } = useApp();
  const [list, setList, reload] = useFetch('/menu/wishlist');
  const [dish, setDish] = useState('');
  const add = async (e) => {
    e.preventDefault();
    try { await api('/menu/wishlist', { method: 'POST', body: { dish } }); setDish(''); reload(); toast('added to the wishlist 🙏'); } catch (err) { toast(err.message, 'err'); }
  };
  const vote = async (w) => {
    const r = await api(`/menu/wishlist/${w.id}/vote`, { method: 'POST' });
    setList(list.map((x) => (x.id === w.id ? { ...x, votes: r.votes } : x)).sort((a, b) => b.votes.length - a.votes.length));
  };
  const max = Math.max(1, ...(list || []).map((w) => w.votes.length));
  return (
    <section className="wishlist">
      <h2 className="h2">dish wishlist 🤞 <span className="muted small">vote what the mess should cook next</span></h2>
      <form onSubmit={add} className="inline-form">
        <Field placeholder="e.g. pav bhaji friday" value={dish} onChange={(e) => setDish(e.target.value)} />
        <CrayonButton fill="pink" small type="submit" disabled={!dish.trim()}>+ suggest</CrayonButton>
      </form>
      <motion.ul className="wish-list" layout>
        {list?.map((w) => {
          const mine = w.votes.includes(user.id);
          return (
            <motion.li key={w.id} layout transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
              <motion.button className={`vote ${mine ? 'on' : ''}`} onClick={() => vote(w)} whileTap={{ scale: 0.8, rotate: -10 }} aria-label="vote">
                <Sketch fill={mine ? 'orange' : 'none'} look="scribble" shape="blob" gap={4} seed={'v' + w.id}>▲<b>{w.votes.length}</b></Sketch>
              </motion.button>
              <div className="wish-body">
                <b>{w.dish}</b>
                <div className="bar"><motion.span initial={{ width: 0 }} animate={{ width: `${(w.votes.length / max) * 100}%` }} transition={{ type: 'spring', stiffness: 80 }} /></div>
                <small className="muted">suggested by {w.by.avatar} {w.by.name}</small>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
