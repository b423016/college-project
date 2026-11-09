import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useApp } from '../store';
import { Sketch, CrayonButton } from '../crayon/Sketch';
import { Title, Field, Select, deal } from '../components/ui';
import { Roti } from '../crayon/Doodles';

const AVATARS = ['😎', '🦋', '🔥', '🌸', '🐼', '✨', '🎧', '🍕', '👾', '🐸', '🦖', '🌈', '😈', '🤓', '🥷', '🍜'];
const HOSTELS = ['Bakul', 'Parijaat', 'Obh', 'Kadamba', 'NBH', 'Mess Office'];

export default function Profile() {
  const { user, setUser, extras, logout, toast, refresh } = useApp();
  const [f, setF] = useState({ name: user.name, bio: user.bio || '', hostel: user.hostel, avatar: user.avatar });
  const save = async (patch = f) => {
    try { const r = await api('/me', { method: 'PATCH', body: patch }); setUser(r.user); refresh(); toast('profile saved ✨'); } catch (e) { toast(e.message, 'err'); }
  };
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      toast('password changed, other devices logged out 🔒');
    } catch (err) { toast(err.message, 'err'); }
  };
  const earned = extras.badges.filter((b) => b.earned).length;

  return (
    <div>
      <Title kicker={`${user.rollNo} · ${user.email}`} color="purple" doodle={<Roti size={80} boil />}>your profile</Title>
      <div className="profile-grid">
        <Sketch fill="paper" className="profile-card">
          <motion.div className="big-avatar" key={f.avatar} initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
            <Sketch fill="yellow" look="scribble" shape="blob" gap={6}><span>{f.avatar}</span></Sketch>
          </motion.div>
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <motion.button key={a} className={a === f.avatar ? 'on' : ''} whileHover={{ scale: 1.3, rotate: 10 }} whileTap={{ scale: 0.8 }}
                onClick={() => { setF({ ...f, avatar: a }); save({ avatar: a }); }}>{a}</motion.button>
            ))}
          </div>
          <div className="stack">
            <Field label="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Field label="bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="e.g. will trade dinner for momos" maxLength={120} />
            <Select label="hostel" value={f.hostel} onChange={(e) => setF({ ...f, hostel: e.target.value })}>{HOSTELS.map((h) => <option key={h}>{h}</option>)}</Select>
            <div className="composer-row">
              <CrayonButton fill="purple" small onClick={() => save()}>save</CrayonButton>
              <button className="link danger" onClick={() => logout()}>log out</button>
              <button className="link danger" onClick={() => window.confirm('log out on all your devices?') && logout({ everywhere: true })}>log out everywhere</button>
            </div>
          </div>
          <form className="stack pw-form" onSubmit={changePassword}>
            <h3 className="h2">change password</h3>
            <Field label="current password" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            <Field label="new password" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} minLength={6} required />
            <div className="composer-row"><CrayonButton fill="sky" small type="submit">update password</CrayonButton></div>
          </form>
        </Sketch>

        <div>
          <h2 className="h2">badges <span className="muted small">{earned}/{extras.badges.length} unlocked</span></h2>
          <motion.div className="badges" variants={deal.wrap} initial="hidden" animate="show">
            {extras.badges.map((b, i) => (
              <motion.div key={b.name} variants={deal.item} className={`badge ${b.earned ? '' : 'locked'}`} whileHover={b.earned ? { rotate: [0, -10, 10, 0], scale: 1.08 } : {}}>
                <Sketch fill={b.earned ? ['orange', 'pink', 'sky', 'green', 'yellow', 'purple', 'red'][i % 7] : 'none'} look="scribble" shape="blob" gap={5} seed={b.name}>
                  <span className="badge-emoji">{b.emoji}</span>
                </Sketch>
                <b>{b.name}</b>
                <small className="muted">{b.desc}</small>
              </motion.div>
            ))}
          </motion.div>
          <div className="stat-row small-stats">
            <Sketch fill="green" look="scribble" gap={7} className="stat"><b className="big-num">{user.xp}</b><span>xp</span></Sketch>
            <Sketch fill="orange" look="scribble" gap={7} className="stat"><b className="big-num">{extras.streak}🔥</b><span>streak</span></Sketch>
            <Sketch fill="sky" look="scribble" gap={7} className="stat"><b className="big-num">₹{user.wallet}</b><span>wallet</span></Sketch>
          </div>
        </div>
      </div>
    </div>
  );
}
