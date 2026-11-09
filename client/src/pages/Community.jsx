import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ago } from '../api';
import { useApp, useFetch } from '../store';
import { Sketch, CrayonButton, Sticker } from '../crayon/Sketch';
import { Title, Field, Pills, deal } from '../components/ui';
import { Momo } from '../crayon/Doodles';
import { CRAYONS, CRAYON_ORDER } from '../crayon/paths';

const TAGS = { general: 'sky', 'food-review': 'orange', meme: 'pink', 'lost-found': 'purple', poll: 'green' };

export default function Community() {
  const { user, toast, refresh } = useApp();
  const [tag, setTag] = useState('all');
  const [sort, setSort] = useState('new');
  const [posts, setPosts, reload] = useFetch(`/posts?tag=${tag}&sort=${sort}`);
  const swap = (p) => setPosts(posts.map((x) => (x.id === p.id ? p : x)));

  return (
    <div className="community">
      <Title kicker="the mess table, but online" color="blue" doodle={<Momo size={80} boil />}>community</Title>
      <Composer onPosted={() => { reload(); refresh(); }} toast={toast} />
      <div className="filter-row">
        <Pills options={['all', ...Object.keys(TAGS)]} value={tag} onChange={setTag} colors={['yellow', ...Object.values(TAGS)]} />
        <Pills options={[{ value: 'new', label: '🕐 new' }, { value: 'top', label: '🔥 top' }]} value={sort} onChange={setSort} colors={['sky', 'orange']} />
      </div>
      <motion.div className="feed" variants={deal.wrap} initial="hidden" animate="show" key={tag + sort}>
        <AnimatePresence>
          {posts?.map((p) => <Post key={p.id} p={p} me={user} onChange={swap} onDelete={() => setPosts(posts.filter((x) => x.id !== p.id))} />)}
        </AnimatePresence>
        {posts?.length === 0 && <p className="muted">quiet in here… be the first to post 👀</p>}
      </motion.div>
    </div>
  );
}

function Composer({ onPosted, toast }) {
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('general');
  const [poll, setPoll] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/posts', { method: 'POST', body: { content, tag, pollOptions: poll || undefined } });
      setContent(''); setPoll(null);
      toast('posted! +3 xp ✍️');
      onPosted();
    } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <Sketch fill="paper" className="composer">
      <form onSubmit={submit} className="stack">
        <Field textarea rows={2} placeholder="spill the dal… (what's happening at the mess?)" value={content} onChange={(e) => setContent(e.target.value)} maxLength={500} />
        <AnimatePresence>
          {poll && (
            <motion.div className="poll-edit" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {poll.map((o, i) => <Field key={i} placeholder={`option ${i + 1}`} value={o} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} />)}
              {poll.length < 5 && <button type="button" className="link" onClick={() => setPoll([...poll, ''])}>+ add option</button>}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="composer-row">
          {!poll && <Pills options={Object.keys(TAGS).filter((t) => t !== 'poll')} value={tag} onChange={setTag} colors={Object.values(TAGS)} />}
          <button type="button" className="link" onClick={() => setPoll(poll ? null : ['', ''])}>{poll ? '✕ remove poll' : '📊 make it a poll'}</button>
          <CrayonButton fill="blue" small type="submit" disabled={!content.trim()}>post</CrayonButton>
        </div>
      </form>
    </Sketch>
  );
}

function Post({ p, me, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const liked = p.upvotes.includes(me.id);
  const total = p.poll ? p.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0;
  const myVote = p.poll?.options.findIndex((o) => o.votes.includes(me.id));

  const upvote = async () => onChange(await api(`/posts/${p.id}/upvote`, { method: 'POST' }));
  const vote = async (i) => onChange(await api(`/posts/${p.id}/vote`, { method: 'POST', body: { option: i } }));
  const comment = async (e) => { e.preventDefault(); onChange(await api(`/posts/${p.id}/comments`, { method: 'POST', body: { text } })); setText(''); };
  const del = async () => { await api(`/posts/${p.id}`, { method: 'DELETE' }); onDelete(); };

  return (
    <motion.article layout variants={deal.item} exit={{ opacity: 0, x: -80, rotate: -8 }}>
      <Sketch fill="paper" className="post" seed={p.id}>
        <header className="post-head">
          <span className="avatar sm">{p.author.avatar}</span>
          <div><b>{p.author.name}</b><small className="muted"> · {p.author.hostel} · {ago(p.createdAt)}</small></div>
          <Sticker fill={TAGS[p.tag] || 'sky'} tilt={4} className="post-tag">#{p.tag}</Sticker>
        </header>
        <p className="post-body">{p.content}</p>

        {p.poll && (
          <div className="poll">
            {p.poll.options.map((o, i) => {
              const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
              return (
                <motion.button key={i} className={`poll-opt ${myVote === i ? 'mine' : ''}`} onClick={() => vote(i)} whileTap={{ scale: 0.97 }}>
                  <motion.svg className="poll-fill" viewBox="0 0 100 20" preserveAspectRatio="none" animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 70 }}>
                    <path d="M1 2 L99 3 L98 18 L2 17 Z" fill={CRAYONS[CRAYON_ORDER[i]]} filter="url(#crayon)" />
                  </motion.svg>
                  <span>{o.text}</span><b>{pct}%</b>
                </motion.button>
              );
            })}
            <small className="muted">{total} votes</small>
          </div>
        )}

        <footer className="post-foot">
          <motion.button className={`heart ${liked ? 'on' : ''}`} onClick={upvote} whileTap={{ scale: 1.6 }} aria-label="upvote">
            <svg viewBox="0 0 32 30" width="26" height="24">
              <path d="M16 28 C4 19 1 12 4 7 C7 2 13 3 16 9 C19 3 25 2 28 7 C31 12 28 19 16 28 Z" fill={liked ? 'var(--c-red)' : 'none'} stroke="var(--ink)" strokeWidth="2" filter="url(#crayon)" />
            </svg>
            <span>{p.upvotes.length}</span>
          </motion.button>
          <button className="link" onClick={() => setOpen(!open)}>💬 {p.comments.length} comments</button>
          {(p.userId === me.id || me.role === 'admin') && <button className="link danger" onClick={del}>delete</button>}
        </footer>

        <AnimatePresence>
          {open && (
            <motion.div className="comments" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              {p.comments.map((c) => (
                <div key={c.id} className="comment"><span className="avatar xs">{c.author.avatar}</span><p><b>{c.author.name}</b> {c.text} <small className="muted">{ago(c.createdAt)}</small></p></div>
              ))}
              <form onSubmit={comment} className="inline-form">
                <Field placeholder="add a comment…" value={text} onChange={(e) => setText(e.target.value)} />
                <CrayonButton small fill="yellow" type="submit" disabled={!text.trim()}>send</CrayonButton>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </Sketch>
    </motion.article>
  );
}
