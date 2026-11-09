import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ago } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, CrayonButton, Sticker } from '../crayon/Sketch';
import { Title, Field, Pills, deal } from '../components/ui';
import { Chilli } from '../crayon/Doodles';

const CATS = { food: 'orange', hygiene: 'green', service: 'sky', other: 'purple' };
const STAMP = { open: ['open', 'var(--c-red)'], 'in-progress': ['on it', 'var(--c-orange)'], resolved: ['fixed ✓', 'var(--c-green)'] };

export default function SpeakUp() {
  const { user, toast } = useApp();
  const [list, setList, reload] = useFetch('/complaints');
  const [status, setStatus] = useState('all');
  const isAdmin = user.role === 'admin';
  const swap = (c) => setList(list.map((x) => (x.id === c.id ? c : x)));
  const shown = (list || []).filter((c) => status === 'all' || c.status === status);

  return (
    <div>
      <Title kicker="complaints & feedback — we're listening (fr)" color="purple" doodle={<Chilli size={80} boil />}>speak up</Title>
      {!isAdmin && <NewComplaint onDone={reload} toast={toast} />}
      <Pills options={['all', 'open', 'in-progress', 'resolved']} value={status} onChange={setStatus} colors={['yellow', 'red', 'orange', 'green']} />
      <motion.div className="complaints" variants={deal.wrap} initial="hidden" animate="show">
        <AnimatePresence>
          {shown.map((c) => <Complaint key={c.id} c={c} me={user} onChange={swap} />)}
        </AnimatePresence>
        {shown.length === 0 && <p className="muted">nothing here 🎉</p>}
      </motion.div>
    </div>
  );
}

function NewComplaint({ onDone, toast }) {
  const [f, setF] = useState({ category: 'food', title: '', description: '', anonymous: false });
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/complaints', { method: 'POST', body: f }); toast('heard you 👂 mess team will look into it'); setF({ ...f, title: '', description: '' }); onDone(); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <Sketch fill="paper" className="composer">
      <form onSubmit={submit} className="stack">
        <Pills options={Object.keys(CATS)} value={f.category} onChange={(category) => setF({ ...f, category })} colors={Object.values(CATS)} />
        <Field placeholder="what's wrong? (short)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} />
        <Field textarea rows={2} placeholder="details help the mess fix it faster" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="composer-row">
          <label className="check"><input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /> 🕵️ post anonymously</label>
          <CrayonButton fill="purple" small type="submit" disabled={!f.title.trim()}>submit</CrayonButton>
        </div>
      </form>
    </Sketch>
  );
}

function Complaint({ c, me, onChange }) {
  const [reply, setReply] = useState(c.response || '');
  const isAdmin = me.role === 'admin';
  const metoo = c.upvotes.includes(me.id);
  const [label, col] = STAMP[c.status];
  const upvote = async () => onChange(await api(`/complaints/${c.id}/upvote`, { method: 'POST' }));
  const update = async (body) => onChange(await api(`/complaints/${c.id}`, { method: 'PATCH', body }));

  return (
    <motion.article layout variants={deal.item} exit={{ opacity: 0, scale: 0.9 }}>
      <Sketch fill="paper" className="complaint" seed={c.id}>
        <motion.div className="stamp" style={{ color: col, borderColor: col }} key={c.status} initial={{ scale: 2.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 0.85, rotate: -12 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>{label}</motion.div>
        <div className="post-head">
          <span className="avatar sm">{c.author.avatar}</span>
          <div><b>{c.author.name}</b><small className="muted"> · {ago(c.createdAt)}</small></div>
          <Sticker fill={CATS[c.category]} tilt={3}>#{c.category}</Sticker>
        </div>
        <h3 className="h3">{c.title}</h3>
        {c.description && <p>{c.description}</p>}
        {c.response && !isAdmin && <div className="mess-reply"><b>👨‍🍳 mess team:</b> {c.response}</div>}
        <footer className="post-foot">
          <motion.button className={`metoo ${metoo ? 'on' : ''}`} onClick={upvote} whileTap={{ scale: 1.3 }}>
            <Sketch fill={metoo ? 'yellow' : 'none'} look="scribble" gap={4} radius={20} wobble={1.2} strokeWidth={1.5} seed={'m' + c.id}>✋ me too · {c.upvotes.length}</Sketch>
          </motion.button>
        </footer>
        {isAdmin && (
          <div className="admin-box">
            <Pills options={['open', 'in-progress', 'resolved']} value={c.status} onChange={(status) => update({ status })} colors={['red', 'orange', 'green']} />
            <div className="inline-form">
              <Field placeholder="reply to students…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <CrayonButton small fill="sky" onClick={() => update({ response: reply })}>reply</CrayonButton>
            </div>
          </div>
        )}
      </Sketch>
    </motion.article>
  );
}
