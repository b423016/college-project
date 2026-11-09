import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ago } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, CrayonButton, Sticker } from '../crayon/Sketch';
import { Title, Field, Pills, deal, tilt } from '../components/ui';
import { Chilli } from '../crayon/Doodles';

const TAGS = { event: 'pink', important: 'red', update: 'sky', menu: 'yellow' };
const REACTS = ['🔥', '😍', '👀', '💀', '😭', '👏'];

export default function Notices() {
  const { user, toast } = useApp();
  const [list, setList, reload] = useFetch('/announcements');
  const [filter, setFilter] = useState('all');
  const isAdmin = user.role === 'admin';

  const react = async (a, emoji) => {
    const r = await api(`/announcements/${a.id}/react`, { method: 'POST', body: { emoji } });
    setList(list.map((x) => (x.id === a.id ? r : x)));
  };
  const pin = async (a) => { await api(`/announcements/${a.id}`, { method: 'PATCH', body: { pinned: !a.pinned } }); reload(); };
  const del = async (a) => { await api(`/announcements/${a.id}`, { method: 'DELETE' }); toast('notice removed'); reload(); };

  const shown = (list || []).filter((a) => filter === 'all' || a.tag === filter);

  return (
    <div>
      <Title kicker="straight from the mess office" color="red" doodle={<Chilli size={80} boil />}>notice board</Title>
      {isAdmin && <Composer onPosted={reload} />}
      <Pills options={['all', ...Object.keys(TAGS)]} value={filter} onChange={setFilter} colors={['orange', ...Object.values(TAGS)]} />

      <motion.div className="board" variants={deal.wrap} initial="hidden" animate="show">
        <AnimatePresence>
          {shown.map((a, i) => (
            <motion.article key={a.id} layout variants={deal.item} exit={{ scale: 0.6, opacity: 0, rotate: 20 }} className="board-note" style={{ rotate: tilt(i, 1.8) }}
              whileHover={{ rotate: 0, scale: 1.02, zIndex: 5 }}>
              <div className={a.pinned ? 'pin' : 'tape'} />
              <Sketch fill={a.pinned ? 'var(--note-yellow)' : 'paper'} className="note-card" seed={a.id}>
                <div className="note-top">
                  <Sticker fill={TAGS[a.tag] || 'sky'} tilt={-3}>#{a.tag}</Sticker>
                  <span className="muted small">{ago(a.createdAt)}</span>
                </div>
                <h3 className="h3">{a.title}</h3>
                <p className="pre">{a.body}</p>
                <div className="reacts">
                  {REACTS.map((e) => {
                    const who = a.reactions[e] || [];
                    const mine = who.includes(user.id);
                    return (
                      <motion.button key={e} className={`react ${mine ? 'on' : ''}`} whileTap={{ scale: 1.5, rotate: 20 }} onClick={() => react(a, e)}>
                        {e}{who.length > 0 && <small>{who.length}</small>}
                      </motion.button>
                    );
                  })}
                </div>
                {isAdmin && (
                  <div className="admin-row">
                    <button className="link" onClick={() => pin(a)}>{a.pinned ? 'unpin' : '📌 pin'}</button>
                    <button className="link danger" onClick={() => del(a)}>delete</button>
                  </div>
                )}
              </Sketch>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Composer({ onPosted }) {
  const { toast } = useApp();
  const [f, setF] = useState({ title: '', body: '', tag: 'update', pinned: false });
  const post = async (e) => {
    e.preventDefault();
    try { await api('/announcements', { method: 'POST', body: f }); setF({ title: '', body: '', tag: 'update', pinned: false }); toast('notice posted 📢'); onPosted(); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <Sketch fill="paper" className="composer">
      <form onSubmit={post} className="stack">
        <h3 className="h3">post a notice</h3>
        <Field placeholder="headline" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Field textarea rows={3} placeholder="what do students need to know?" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <div className="composer-row">
          <Pills options={Object.keys(TAGS)} value={f.tag} onChange={(tag) => setF({ ...f, tag })} colors={Object.values(TAGS)} />
          <label className="check"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> pin it</label>
          <CrayonButton fill="red" small type="submit" disabled={!f.title || !f.body}>post →</CrayonButton>
        </div>
      </form>
    </Sketch>
  );
}
