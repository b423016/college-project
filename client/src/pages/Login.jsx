import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../store';
import Thali3D from '../components/Thali3D';
import { Sketch, Scrawl, CrayonButton, Sticker } from '../crayon/Sketch';
import { Field, Select, Pills } from '../components/ui';
import { Chilli, Jalebi, IceCream, Samosa, Sparkle, Chai } from '../crayon/Doodles';

const HOSTELS = ['Bakul', 'Parijaat', 'Obh', 'Kadamba', 'NBH'];

export default function Login() {
  const { signIn, toast } = useApp();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '', name: '', rollNo: '', hostel: 'Bakul' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e, override) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = override || (mode === 'login' ? { email: f.email, password: f.password } : f);
      await signIn(mode === 'login' || override ? '/auth/login' : '/auth/register', body);
      toast('welcome in 🎉');
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-floaters" aria-hidden="true">
        {[[Chilli, '8%', '12%', 70, -20], [Jalebi, '86%', '10%', 80, 15], [IceCream, '6%', '72%', 90, 10], [Samosa, '90%', '78%', 76, -10], [Sparkle, '48%', '6%', 34, 0], [Sparkle, '40%', '90%', 26, 0]].map(([D, x, y, s, r], i) => (
          <motion.div key={i} className="floater" style={{ left: x, top: y }}
            animate={{ y: [0, -14, 0], rotate: [r, r + 8, r] }} transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}>
            <D size={s} color={i === 5 ? 'var(--c-pink)' : undefined} />
          </motion.div>
        ))}
      </div>

      <section className="login-hero">
        <motion.p className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>iiit mess · est. whenever the dal got good</motion.p>
        <motion.h1 className="mega" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120 }}>
          what's <Scrawl color="orange" mode="mark" seed="cookin">cookin'</Scrawl>,<br />iiit?
        </motion.h1>
        <p className="lede">menus, attendance, coupon trading, mess gossip & complaints — all in one very colourful place.</p>
        <div className="login-thali"><Thali3D items={['Biryani', 'Samosa', 'Masala Dosa', 'Chai', 'Gulab Jamun', 'Momos']} size={Math.max(260, Math.min(380, window.innerWidth - 48))} /></div>
        <Sticker fill="pink" tilt={-6} className="drag-hint">↻ drag the thali!</Sticker>
      </section>

      <motion.section className="login-card-wrap" initial={{ rotate: 6, y: 60, opacity: 0 }} animate={{ rotate: 1.5, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.15 }}>
        <div className="tape" />
        <Sketch fill="paper" radius={18} className="login-card">
          <div className="login-head"><Chai size={54} boil /><h2>{mode === 'login' ? 'hey again 👋' : 'join the mess'}</h2></div>
          <Pills options={[{ value: 'login', label: 'log in' }, { value: 'register', label: 'sign up' }]} value={mode} onChange={setMode} colors={['yellow', 'sky']} />
          <form onSubmit={submit} className="stack">
            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.div key="reg" className="stack" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <Field label="name" value={f.name} onChange={set('name')} placeholder="what do ppl call u" />
                  <div className="row2">
                    <Field label="roll no" value={f.rollNo} onChange={set('rollNo')} placeholder="2024CS001" />
                    <Select label="hostel" value={f.hostel} onChange={set('hostel')}>{HOSTELS.map((h) => <option key={h}>{h}</option>)}</Select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="college email" type="email" value={f.email} onChange={set('email')} placeholder="you@iiit.ac.in" required />
            <Field label="password" type="password" value={f.password} onChange={set('password')} placeholder="••••••" required />
            <CrayonButton fill="orange" type="submit" disabled={busy}>{busy ? 'one sec…' : mode === 'login' ? "let's eat →" : 'create account →'}</CrayonButton>
          </form>
          <div className="demo">
            <span>just looking? try a demo:</span>
            <button onClick={() => submit(null, { email: 'aarav@iiit.ac.in', password: 'password123' })}>😎 student</button>
            <button onClick={() => submit(null, { email: 'admin@iiit.ac.in', password: 'password123' })}>👨‍🍳 mess admin</button>
          </div>
        </Sketch>
      </motion.section>
    </div>
  );
}
