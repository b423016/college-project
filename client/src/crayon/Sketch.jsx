import { useId, useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { roughRounded, lumpyRect, scribbleFill, blob, roughEllipse, underline, CRAYONS } from './paths';

const PAD = 10;
const color = (c) => CRAYONS[c] || c;

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // offset* = untransformed border box (includes padding, ignores rotation).
      // Rounded so tiny layout shifts don't regenerate the wobble.
      const w = Math.round(el.offsetWidth / 4) * 4, h = Math.round(el.offsetHeight / 4) * 4;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * A hand-drawn container. The DOM box stays rectangular for layout, but what you
 * see is a crayon outline + colouring drawn behind the content.
 *   fill:  crayon name or css color, or 'none'
 *   look:  'scribble' (zigzag colouring), 'wash' (solid waxy fill), 'outline'
 *   shape: 'rect' | 'blob'
 */
export const Sketch = forwardRef(function Sketch(
  { as = 'div', fill = 'paper', stroke = 'ink', look = 'wash', shape = 'rect', seed, wobble = 3.2, gap = 6,
    strokeWidth = 2.2, radius = 20, className = '', children, style, motionProps, ...rest },
  fwd,
) {
  const inner = useRef(null);
  const { w, h } = useSize(inner);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = seed ?? uid;

  const paths = useMemo(() => {
    if (!w || !h) return null;
    const x = PAD, y = PAD;
    if (shape === 'blob') {
      return {
        clip: blob(s + 'c', x + w / 2, y + h / 2, w / 2 + 2, h / 2 + 2, 0.06, 11),
        line: roughEllipse(s + 'l', x + w / 2, y + h / 2, w / 2, h / 2, wobble),
        fill: scribbleFill(s + 'f', x - 4, y - 4, w + 8, h + 8, gap),
      };
    }
    return {
      clip: lumpyRect(s + 'c', x - 1, y - 1, w + 2, h + 2, wobble * 0.9, radius),
      line: roughRounded(s + 'l', x, y, w, h, wobble, radius),
      fill: scribbleFill(s + 'f', x - 4, y - 4, w + 8, h + 8, gap),
    };
  }, [w, h, s, shape, wobble, gap, radius]);

  const Tag = motionProps ? motion[as] : as;
  const fillColor = fill === 'paper' ? 'var(--paper-card)' : color(fill);

  return (
    <Tag ref={fwd} className={`sketch ${className}`} style={style} {...motionProps} {...rest}>
      {paths && (
        <svg className="sketch-art" width={w + PAD * 2} height={h + PAD * 2} aria-hidden="true">
          <defs><clipPath id={`k${uid}`}><path d={paths.clip} /></clipPath></defs>
          {fill !== 'none' && (look === 'scribble'
            ? <g filter="url(#crayon)" clipPath={`url(#k${uid})`}>
                <path d={paths.clip} fill={fillColor} opacity="0.28" />
                <path d={paths.fill} fill="none" stroke={fillColor} strokeWidth={gap * 1.15} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            : <path d={paths.clip} fill={fillColor} filter="url(#wax)" />)}
          {stroke !== 'none' && (
            <path d={paths.line} fill="none" stroke={stroke === 'ink' ? 'var(--ink)' : color(stroke)} strokeWidth={strokeWidth}
              strokeLinecap="round" filter="url(#crayon-line)" />
          )}
        </svg>
      )}
      <div ref={inner} className="sketch-body">{children}</div>
    </Tag>
  );
});

// Text with a scribbled highlight / underline that draws itself in.
export function Scrawl({ children, color: c = 'yellow', mode = 'under', seed = 'u', className = '' }) {
  const ref = useRef(null);
  const { w } = useSize(ref);
  return (
    <span ref={ref} className={`scrawl scrawl-${mode} ${className}`}>
      {w > 0 && (
        <svg className="scrawl-art" width={w + 16} height={mode === 'under' ? 16 : '100%'} viewBox={mode === 'under' ? `-8 0 ${w + 16} 16` : undefined} aria-hidden="true">
          <motion.path d={underline(seed, w, 12)} fill="none" stroke={color(c)} strokeWidth={mode === 'under' ? 5 : 16}
            strokeLinecap="round" filter="url(#crayon)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }} />
        </svg>
      )}
      <span className="scrawl-text">{children}</span>
    </span>
  );
}

// Crayon button — wiggles on hover, squishes on press.
export function CrayonButton({ children, fill = 'orange', className = '', small, disabled, seed, ...rest }) {
  return (
    <motion.button
      className={`cbtn ${small ? 'cbtn-sm' : ''} ${className}`}
      whileHover={disabled ? undefined : { rotate: [0, -2, 2, -1, 0], scale: 1.04, transition: { duration: 0.4 } }}
      whileTap={disabled ? undefined : { scale: 0.93, rotate: -2 }}
      disabled={disabled}
      {...rest}
    >
      <Sketch fill={disabled ? 'var(--muted-fill)' : fill} look="scribble" gap={small ? 4 : 5} radius={22} wobble={small ? 1.6 : 2} seed={seed} className="cbtn-inner">
        {children}
      </Sketch>
    </motion.button>
  );
}

export function Sticker({ children, fill = 'yellow', tilt = -3, className = '', seed }) {
  return (
    <Sketch fill={fill} look="scribble" gap={4} radius={20} wobble={1.4} strokeWidth={1.6} seed={seed}
      className={`sticker ${className}`} style={{ transform: `rotate(${tilt}deg)` }}>
      {children}
    </Sketch>
  );
}

// Crayon star for ratings.
export function Star({ filled, size = 30, seed = 's' }) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 7 : 15;
    pts.push(`${(16 + Math.cos(a) * r).toFixed(1)},${(16 + Math.sin(a) * r).toFixed(1)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <polygon points={pts.join(' ')} fill={filled ? 'var(--c-yellow)' : 'transparent'} filter="url(#wax)" />
      <polygon points={pts.join(' ')} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" filter="url(#crayon-line)" />
    </svg>
  );
}
