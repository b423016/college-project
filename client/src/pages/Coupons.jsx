import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ago, localDate, prettyDate } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, CrayonButton, Sticker } from '../crayon/Sketch';
import { Title, Field, Pills, Confetti, deal, tilt } from '../components/ui';
import { MEAL_DOODLE, IceCream } from '../crayon/Doodles';

const MEAL_COLORS = { breakfast: 'yellow', lunch: 'orange', snacks: 'pink', dinner: 'sky' };

export default function Coupons() {
  const { user, refresh, toast } = useApp();
  const [data, , reload] = useFetch('/coupons');
  const [wallet, , reloadWallet] = useFetch('/wallet');
  const [tab, setTab] = useState('market');
  const [party, setParty] = useState(0);

  const after = () => { reload(); reloadWallet(); refresh(); };
  const buy = async (c) => {
    try { await api(`/coupons/${c.id}/buy`, { method: 'POST' }); toast(`coupon secured 🎟️ enjoy ur ${c.meal}`); setParty((p) => p + 1); after(); } catch (e) { toast(e.message, 'err'); }
  };
  const cancel = async (c) => { await api(`/coupons/${c.id}/cancel`, { method: 'POST' }); toast('listing pulled'); after(); };

  return (
    <div className="coupons">
      <Confetti show={party} key={party} />
      <Title kicker="not hungry? sell it. starving? buy it." color="pink" doodle={<IceCream size={84} boil />}>coupon bazaar</Title>

      <div className="bazaar-top">
        <WalletCard wallet={wallet} onTopup={after} />
        <SellForm meals={data?.meals || []} onListed={after} />
      </div>

      <Pills options={[{ value: 'market', label: `🛒 market (${data?.listed.length ?? 0})` }, { value: 'mine', label: '📦 my coupons' }, { value: 'history', label: '🧾 wallet history' }]} value={tab} onChange={setTab} colors={['pink', 'yellow', 'green']} />

      <AnimatePresence mode="wait">
        {tab === 'market' && (
          <motion.div key="m" className="tickets" variants={deal.wrap} initial="hidden" animate="show" exit={{ opacity: 0 }}>
            {data?.listed.map((c, i) => <Ticket key={c.id} c={c} i={i} mine={c.sellerId === user.id} onBuy={() => buy(c)} onCancel={() => cancel(c)} />)}
            {data?.listed.length === 0 && <p className="muted">no coupons up for grabs rn. check back near meal time 👀</p>}
          </motion.div>
        )}
        {tab === 'mine' && (
          <motion.ul key="y" className="my-coupons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {data?.mine.map((c) => (
              <li key={c.id}>
                <span>{c.mealInfo.emoji} <b>{c.mealInfo.label}</b> · {prettyDate(c.date)} · ₹{c.price}</span>
                <span className="muted small">
                  {c.sellerId === user.id ? (c.status === 'sold' ? `sold to ${c.buyer.name} 💸` : c.status) : `bought from ${c.seller.name} — show this at the counter`}
                </span>
                {c.status === 'listed' && c.sellerId === user.id && <button className="link danger" onClick={() => cancel(c)}>cancel</button>}
              </li>
            ))}
            {data?.mine.length === 0 && <p className="muted">nothing yet.</p>}
          </motion.ul>
        )}
        {tab === 'history' && (
          <motion.ul key="h" className="my-coupons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {wallet?.transactions.map((t) => (
              <li key={t.id}><span>{t.desc}</span><b className={t.amount < 0 ? 'neg' : 'pos'}>{t.amount < 0 ? '−' : '+'}₹{Math.abs(t.amount)}</b><small className="muted">{ago(t.at)}</small></li>
            ))}
            {wallet?.transactions.length === 0 && <p className="muted">no transactions yet.</p>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Ticket({ c, i, mine, onBuy, onCancel }) {
  const [flipped, setFlipped] = useState(false);
  const D = MEAL_DOODLE[c.meal];
  const off = Math.round((1 - c.price / c.mealInfo.price) * 100);
  return (
    <motion.div variants={deal.item} className="ticket-wrap" style={{ rotate: tilt(i, 2) }} whileHover={{ y: -6 }}>
      <motion.div className="ticket" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }} onClick={() => setFlipped(!flipped)}>
        <div className="ticket-face front">
          <Sketch fill={MEAL_COLORS[c.meal]} look="scribble" gap={7} className="ticket-card" seed={c.id}>
            <div className="ticket-notch l" /><div className="ticket-notch r" />
            <D size={70} />
            <div className="ticket-info">
              <b className="h3">{c.mealInfo.label}</b>
              <span>{prettyDate(c.date)}</span>
            </div>
            <div className="ticket-price"><b>₹{c.price}</b>{off > 0 && <small>{off}% off</small>}</div>
            <span className="flip-hint">tap to flip ↻</span>
          </Sketch>
        </div>
        <div className="ticket-face back">
          <Sketch fill="paper" className="ticket-card" seed={c.id + 'b'}>
            <div className="ticket-notch l" /><div className="ticket-notch r" />
            <div className="ticket-back">
              <p><span className="avatar xs">{c.seller.avatar}</span> <b>{c.seller.name}</b> <small className="muted">· {c.seller.hostel}</small></p>
              {c.note && <p className="small">“{c.note}”</p>}
              <div onClick={(e) => e.stopPropagation()}>
                {mine ? <CrayonButton small fill="red" onClick={onCancel}>cancel listing</CrayonButton> : <CrayonButton small fill="green" onClick={onBuy}>buy for ₹{c.price}</CrayonButton>}
              </div>
            </div>
          </Sketch>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WalletCard({ wallet, onTopup }) {
  const { toast } = useApp();
  const top = async (amount) => {
    try { await api('/wallet/topup', { method: 'POST', body: { amount } }); toast(`+₹${amount} added 💰`); onTopup(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Sketch fill="green" look="scribble" gap={8} className="wallet">
      <p className="kicker">mess wallet</p>
      <motion.b key={wallet?.balance} className="mega-num" initial={{ scale: 1.3, rotate: -6 }} animate={{ scale: 1, rotate: 0 }}>₹{wallet?.balance ?? '…'}</motion.b>
      <div className="topups">
        {[50, 100, 200].map((a) => <CrayonButton key={a} small fill="yellow" onClick={() => top(a)} seed={'t' + a}>+₹{a}</CrayonButton>)}
      </div>
      <small>demo money — no real payments 😌</small>
    </Sketch>
  );
}

function SellForm({ meals, onListed }) {
  const { toast } = useApp();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d); })();
  const [f, setF] = useState({ date: tomorrow, meal: 'dinner', price: 50, note: '' });
  const max = meals.find((m) => m.key === f.meal)?.price || 70;
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/coupons', { method: 'POST', body: f }); toast('listed! someone hungry will grab it 🤝'); setF({ ...f, note: '' }); onListed(); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <Sketch fill="paper" className="sell">
      <form onSubmit={submit} className="stack">
        <h3 className="h3">sell a meal coupon</h3>
        <Pills options={meals.map((m) => ({ value: m.key, label: `${m.emoji} ${m.label}` }))} value={f.meal} onChange={(meal) => setF({ ...f, meal, price: Math.min(f.price, meals.find((m) => m.key === meal).price) })} colors={['yellow', 'orange', 'pink', 'sky']} />
        <div className="row2">
          <Field label="date" type="date" min={localDate()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <label className="field">
            <span className="field-label">price: <b>₹{f.price}</b> <small className="muted">(max ₹{max})</small></span>
            <input type="range" min={5} max={max} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} className="crayon-range" />
          </label>
        </div>
        <Field placeholder="note (optional) — e.g. going home 🏠" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={80} />
        <div className="composer-row"><Sticker fill="yellow" tilt={-2}>no scalping: max is the mess price</Sticker><CrayonButton fill="pink" small type="submit">list it →</CrayonButton></div>
      </form>
    </Sketch>
  );
}
