import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sketch, Scrawl } from '../crayon/Sketch';
import { CRAYONS, CRAYON_ORDER, underline } from '../crayon/paths';
import { Sparkle } from '../crayon/Doodles';

export function Title({ kicker, children, color = 'yellow', right, doodle }) {
  return (
    <div className="title-row">
      <div>
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="h1"><Scrawl color={color} seed={String(children)}>{children}</Scrawl></h1>
      </div>
      {doodle && <motion.div className="title-doodle" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2 }}>{doodle}</motion.div>}
      {right}
    </div>
  );
}

// Text input with a hand-drawn underline instead of a box.
export function Field({ label, textarea, className = '', ...props }) {
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      <Tag {...props} />
      <svg className="field-line" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true">
        <path d={underline(label || props.placeholder || 'f', 300, 10)} fill="none" stroke="var(--ink)" strokeWidth="2" filter="url(#crayon-line)" vectorEffect="non-scaling-stroke" />
      </svg>
    </label>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <Sketch fill="paper" radius={14} wobble={1.4} strokeWidth={1.6} className="select-wrap"><select {...props}>{children}</select></Sketch>
    </label>
  );
}

// Pills that get coloured in when picked.
export function Pills({ options, value, onChange, colors }) {
  return (
    <div className="pills" role="tablist">
      {options.map((o, i) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const on = v === value;
        return (
          <motion.button key={v} role="tab" aria-selected={on} className={`pill ${on ? 'on' : ''}`} onClick={() => onChange(v)} whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }}>
            <Sketch fill={on ? (colors?.[i] || CRAYON_ORDER[i % CRAYON_ORDER.length]) : 'none'} look="scribble" gap={4} radius={20} wobble={1.3} strokeWidth={on ? 2 : 1.4} seed={'p' + v}>
              {l}
            </Sketch>
          </motion.button>
        );
      })}
    </div>
  );
}

export function Empty({ children, doodle }) {
  return <div className="empty-state">{doodle}<p>{children}</p></div>;
}

// Burst of crayon sparkles for celebrations.
export function Confetti({ show }) {
  const bits = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    x: (Math.random() - 0.5) * 420, y: -Math.random() * 260 - 60, r: Math.random() * 360, s: 18 + Math.random() * 22,
    c: CRAYONS[CRAYON_ORDER[i % CRAYON_ORDER.length]],
  })), [show]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AnimatePresence>
      {show && (
        <div className="confetti" aria-hidden="true">
          {bits.map((b, i) => (
            <motion.div key={i} initial={{ x: 0, y: 0, scale: 0, rotate: 0 }} animate={{ x: b.x, y: [0, b.y, b.y + 200], scale: [0, 1, 0.6], rotate: b.r, opacity: [1, 1, 0] }}
              transition={{ duration: 1.6, ease: 'easeOut' }} exit={{ opacity: 0 }}>
              <Sparkle size={b.s} color={b.c} />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

// Stagger container + child variants for lists that should "deal" in like cards.
export const deal = {
  wrap: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  // No rotate here — items keep their own hand-placed tilt.
  item: { hidden: { opacity: 0, y: 24, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } } },
};

// Deterministic small tilt so a grid looks hand-placed rather than machine-aligned.
export const tilt = (i, amt = 1.2) => [-amt, amt * 0.6, -amt * 0.4, amt, -amt * 0.8][i % 5];
