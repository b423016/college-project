// Crayon food doodles, all drawn on a 120×120 canvas.
// Fills go through the waxy #crayon filter; outlines through #crayon-line.
import { useId } from 'react';
import { scribbleFill } from './paths';

function Doodle({ size = 80, boil, fills, lines, extra, className = '', title }) {
  return (
    <svg className={`doodle ${className}`} width={size} height={size} viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g filter={boil ? 'url(#boil)' : 'url(#crayon)'}>{fills}</g>
      <g filter={boil ? 'url(#boil)' : 'url(#crayon-line)'} fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{lines}</g>
      {extra}
    </svg>
  );
}

// Zigzag shading clipped to a path id — the "coloured in" texture inside food.
// Ids are per-instance: a clipPath inside a display:none copy (e.g. the hidden
// sidebar on mobile) would otherwise break every other doodle referencing it.
function Shade({ id, d, color, gap = 5, angle = -35, opacity = 0.9 }) {
  const uid = id + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <>
      <clipPath id={uid}><path d={d} /></clipPath>
      <path d={scribbleFill(id, 0, 0, 120, 120, gap, angle)} clipPath={`url(#${uid})`} stroke={color} strokeWidth={gap * 1.1} fill="none" opacity={opacity} strokeLinecap="round" />
    </>
  );
}

export const Chai = (p) => {
  const body = 'M28 46 L92 46 L85 96 Q60 106 35 96 Z';
  return <Doodle {...p} title="chai"
    fills={<>
      <path d={body} fill="var(--c-brown)" opacity="0.55" />
      <Shade id="chai-b" d={body} color="var(--c-orange)" />
      <path d="M31 66 L89 66 L88 74 L32 74 Z" fill="var(--c-cream)" />
      <ellipse cx="60" cy="46" rx="32" ry="8" fill="var(--c-tea)" />
    </>}
    lines={<>
      <path d={body} />
      <ellipse cx="60" cy="46" rx="32" ry="8" />
      <path d="M90 56 Q106 58 103 72 Q99 84 86 81" />
      <path d="M48 34 Q41 24 49 16 Q56 9 50 1" stroke="var(--c-sky)" strokeWidth="3" />
      <path d="M68 34 Q61 25 69 17 Q75 11 70 4" stroke="var(--c-sky)" strokeWidth="3" />
    </>} />;
};

export const Samosa = (p) => {
  const tri = 'M60 16 Q70 30 103 92 Q60 104 17 92 Q50 30 60 16 Z';
  return <Doodle {...p} title="samosa"
    fills={<>
      <path d={tri} fill="var(--c-yellow)" />
      <Shade id="sam-b" d={tri} color="var(--c-orange)" gap={6} opacity={0.55} />
      <ellipse cx="100" cy="104" rx="15" ry="7" fill="var(--c-green)" />
    </>}
    lines={<>
      <path d={tri} />
      <path d="M60 16 Q56 60 60 100" />
      <path d="M38 70 Q44 72 48 68 M70 80 Q76 82 80 78 M62 52 Q66 54 70 50" stroke="var(--c-brown)" />
    </>} />;
};

export const Dosa = (p) => {
  const cone = 'M8 74 Q50 34 112 46 L110 70 Q58 92 8 74 Z';
  return <Doodle {...p} title="dosa"
    fills={<>
      <path d={cone} fill="var(--c-yellow)" />
      <Shade id="dosa-b" d={cone} color="var(--c-orange)" gap={7} angle={10} opacity={0.6} />
      <ellipse cx="34" cy="98" rx="20" ry="9" fill="var(--c-red)" opacity="0.85" />
      <ellipse cx="82" cy="100" rx="16" ry="8" fill="var(--c-cream)" />
    </>}
    lines={<>
      <path d={cone} />
      <path d="M110 46 Q100 58 110 70" />
      <path d="M30 66 Q50 60 70 58 M40 76 Q62 70 90 66" stroke="var(--c-brown)" />
      <ellipse cx="34" cy="98" rx="20" ry="9" /><ellipse cx="82" cy="100" rx="16" ry="8" />
    </>} />;
};

export const Roti = (p) => (
  <Doodle {...p} title="roti"
    fills={<>
      <circle cx="60" cy="62" r="42" fill="var(--c-tan)" />
      <Shade id="roti-b" d="M18 62 a42 42 0 1 0 84 0 a42 42 0 1 0 -84 0" color="var(--c-yellow)" gap={8} opacity={0.5} />
      {[[44, 48, 6], [72, 44, 4], [80, 72, 7], [50, 80, 5], [62, 62, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="var(--c-brown)" opacity="0.75" />)}
    </>}
    lines={<>
      <path d="M18 62 Q16 20 60 20 Q104 18 102 62 Q104 106 60 104 Q18 106 18 62" />
      <path d="M34 40 Q38 34 46 32" />
    </>} />
);

function spiral(cx, cy, turns, maxR) {
  let d = '';
  for (let i = 0; i <= turns * 24; i++) {
    const t = i / 24, a = t * Math.PI * 2, r = (t / turns) * maxR;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d;
}
export const Jalebi = (p) => (
  <Doodle {...p} title="jalebi"
    fills={<path d={spiral(60, 60, 3, 44)} stroke="var(--c-orange)" strokeWidth="11" fill="none" strokeLinecap="round" />}
    lines={<path d={spiral(60, 60, 3, 44)} stroke="var(--c-red)" strokeWidth="2.4" opacity="0.8" />} />
);

export const Ladoo = (p) => (
  <Doodle {...p} title="ladoo"
    fills={<>
      {[[40, 78], [80, 78], [60, 44]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="22" fill="var(--c-orange)" />)}
      {[[40, 78], [80, 78], [60, 44]].map(([x, y], i) => <circle key={'h' + i} cx={x - 7} cy={y - 7} r="6" fill="var(--c-yellow)" />)}
    </>}
    lines={<>
      {[[40, 78], [80, 78], [60, 44]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="22" />)}
      {[[34, 84], [46, 72], [74, 86], [86, 72], [56, 50], [66, 38]].map(([x, y], i) => <path key={'d' + i} d={`M${x} ${y} l2 1`} stroke="var(--c-brown)" strokeWidth="3" />)}
    </>} />
);

export const IceCream = (p) => {
  const cone = 'M38 58 L82 58 L60 114 Z';
  return <Doodle {...p} title="ice cream"
    fills={<>
      <path d={cone} fill="var(--c-tan)" />
      <circle cx="48" cy="48" r="18" fill="var(--c-pink)" />
      <circle cx="72" cy="46" r="18" fill="var(--c-sky)" />
      <circle cx="60" cy="30" r="16" fill="var(--c-yellow)" />
      <circle cx="64" cy="12" r="6" fill="var(--c-red)" />
    </>}
    lines={<>
      <path d={cone} />
      <path d="M44 72 L72 64 M48 84 L68 78 M52 96 L64 92 M46 62 L66 96 M60 60 L72 76" stroke="var(--c-brown)" strokeWidth="1.8" />
      <circle cx="48" cy="48" r="18" /><circle cx="72" cy="46" r="18" /><circle cx="60" cy="30" r="16" />
      <path d="M64 6 Q66 0 72 -2" />
    </>} />;
};

export const Biryani = (p) => {
  const mound = 'M18 66 Q24 30 60 28 Q96 30 102 66 Z';
  return <Doodle {...p} title="biryani"
    fills={<>
      <path d={mound} fill="var(--c-rice)" />
      <Shade id="bir-b" d={mound} color="var(--c-yellow)" gap={6} opacity={0.6} />
      <path d="M12 66 L108 66 Q100 104 60 106 Q20 104 12 66 Z" fill="var(--c-blue)" />
      {[[40, 50], [58, 40], [76, 52], [50, 58], [68, 60], [84, 62], [32, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="var(--c-orange)" />)}
      <path d="M74 32 Q90 18 98 30 Q88 40 74 32 Z" fill="var(--c-green)" />
    </>}
    lines={<>
      <path d="M12 66 L108 66 Q100 104 60 106 Q20 104 12 66 Z" />
      <path d={mound} />
      <path d="M74 32 Q86 28 98 30" />
    </>} />;
};

export const Curry = (p) => (
  <Doodle {...p} title="curry"
    fills={<>
      <path d="M14 56 L106 56 Q100 102 60 104 Q20 102 14 56 Z" fill="var(--c-cream)" />
      <ellipse cx="60" cy="56" rx="46" ry="12" fill="var(--c-orange)" />
      <ellipse cx="60" cy="56" rx="34" ry="7" fill="var(--c-red)" opacity="0.6" />
      {[[42, 52], [62, 54], [76, 50]].map(([x, y], i) => <rect key={i} x={x} y={y} width="10" height="8" rx="2" fill="var(--c-paneer)" />)}
      <path d="M50 46 Q56 38 64 44" stroke="var(--c-green)" strokeWidth="5" fill="none" />
    </>}
    lines={<>
      <path d="M14 56 Q20 102 60 104 Q100 102 106 56" />
      <ellipse cx="60" cy="56" rx="46" ry="12" />
      <path d="M44 38 Q38 28 46 20 M72 38 Q66 28 74 20" stroke="var(--c-sky)" strokeWidth="3" />
      <path d="M28 76 Q40 84 50 80" stroke="var(--c-brown)" strokeWidth="2" />
    </>} />
);

export const Momo = (p) => {
  const m = 'M18 84 Q14 54 60 34 Q106 54 102 84 Q60 98 18 84 Z';
  return <Doodle {...p} title="momo"
    fills={<>
      <path d={m} fill="var(--c-cream)" />
      <Shade id="momo-b" d={m} color="var(--c-tan)" gap={8} opacity={0.4} />
      <ellipse cx="98" cy="104" rx="14" ry="7" fill="var(--c-red)" />
    </>}
    lines={<>
      <path d={m} />
      <path d="M60 34 Q50 50 44 62 M60 34 Q60 52 60 64 M60 34 Q70 50 76 62 M60 34 Q40 46 32 58 M60 34 Q82 46 88 58" />
      <ellipse cx="98" cy="104" rx="14" ry="7" />
    </>} />;
};

export const Idli = (p) => (
  <Doodle {...p} title="idli"
    fills={<>
      <ellipse cx="44" cy="64" rx="30" ry="18" fill="var(--c-cream)" />
      <ellipse cx="76" cy="54" rx="30" ry="18" fill="var(--c-cream)" />
      <ellipse cx="66" cy="96" rx="26" ry="10" fill="var(--c-green)" opacity="0.75" />
    </>}
    lines={<>
      <ellipse cx="44" cy="64" rx="30" ry="18" /><ellipse cx="76" cy="54" rx="30" ry="18" />
      <path d="M24 70 Q44 80 64 70 M56 60 Q76 70 96 60" stroke="var(--c-tan)" />
      <ellipse cx="66" cy="96" rx="26" ry="10" />
    </>} />
);

export const Pizza = (p) => {
  const s = 'M16 26 Q60 10 104 26 L60 110 Z';
  return <Doodle {...p} title="pizza"
    fills={<>
      <path d={s} fill="var(--c-yellow)" />
      <path d="M16 26 Q60 10 104 26 L100 34 Q60 20 20 34 Z" fill="var(--c-brown)" />
      {[[44, 42], [70, 46], [58, 70], [52, 52]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 ? 4 : 8} fill={i === 3 ? 'var(--c-green)' : 'var(--c-red)'} />)}
    </>}
    lines={<><path d={s} /><path d="M20 34 Q60 20 100 34" /></>} />;
};

export const Chilli = (p) => (
  <Doodle {...p} title="chilli"
    fills={<>
      <path d="M30 40 Q20 90 90 104 Q50 80 46 40 Z" fill="var(--c-red)" />
      <path d="M30 40 Q38 28 46 40 Q42 30 50 22" stroke="var(--c-green)" strokeWidth="7" fill="none" strokeLinecap="round" />
    </>}
    lines={<><path d="M30 40 Q20 90 90 104 Q50 80 46 40" /><path d="M34 54 Q34 70 44 80" stroke="var(--c-cream)" /></>} />
);

export const Flame = (p) => (
  <Doodle {...p} title="streak"
    fills={<>
      <path d="M60 10 Q96 46 90 78 Q84 108 60 108 Q34 108 30 80 Q28 56 48 40 Q48 60 60 64 Q52 40 60 10 Z" fill="var(--c-orange)" />
      <path d="M60 58 Q78 74 74 90 Q70 102 60 102 Q48 102 46 90 Q46 78 60 58 Z" fill="var(--c-yellow)" />
    </>}
    lines={<path d="M60 10 Q96 46 90 78 Q84 108 60 108 Q34 108 30 80 Q28 56 48 40 Q48 60 60 64 Q52 40 60 10 Z" />} />
);

export const Sparkle = ({ color = 'var(--c-yellow)', ...p }) => (
  <Doodle {...p}
    fills={<path d="M60 8 Q66 54 112 60 Q66 66 60 112 Q54 66 8 60 Q54 54 60 8 Z" fill={color} />}
    lines={<path d="M60 8 Q66 54 112 60 Q66 66 60 112 Q54 66 8 60 Q54 54 60 8 Z" />} />
);

export const Plate = (p) => (
  <Doodle {...p}
    fills={<>
      <circle cx="60" cy="60" r="54" fill="var(--c-steel)" />
      <circle cx="60" cy="60" r="42" fill="var(--c-steel-2)" />
    </>}
    lines={<><circle cx="60" cy="60" r="54" /><circle cx="60" cy="60" r="42" strokeWidth="1.6" /></>} />
);

const RULES = [
  [/dosa|uttapam/i, Dosa], [/roti|naan|paratha|kulche|bhature|puri|bread|baati/i, Roti], [/chai|tea|coffee|lassi|milk|lemonade/i, Chai],
  [/samosa|pakoda|kachori|vada/i, Samosa], [/biryani|rice|pulao|fried rice|noodles/i, Biryani], [/jalebi/i, Jalebi],
  [/ice cream|kheer|brownie|rasmalai|halwa|churma/i, IceCream], [/ladoo|laddu|gulab|katli/i, Ladoo], [/momo/i, Momo],
  [/idli|sambar|upma|poha/i, Idli], [/pizza|pasta|garlic/i, Pizza], [/chilli|mirchi|manchurian|pani puri/i, Chilli],
];
export function doodleFor(text = '') {
  return RULES.find(([re]) => re.test(text))?.[1] || Curry;
}
export const MEAL_DOODLE = { breakfast: Chai, lunch: Biryani, snacks: Samosa, dinner: Curry };
