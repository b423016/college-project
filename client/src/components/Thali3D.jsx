import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useAnimationFrame, useTransform } from 'framer-motion';
import { Plate, doodleFor } from '../crayon/Doodles';
import { CRAYON_ORDER, CRAYONS } from '../crayon/paths';

/**
 * A crayon thali on a lazy susan, built from CSS 3D transforms.
 * The plate lies flat in 3D space; each dish stands upright on it, orbits slowly,
 * bobs on its own rhythm, and you can drag to spin it. The whole scene tilts toward the cursor.
 */
export default function Thali3D({ items = [], size = 360 }) {
  const dishes = items.slice(0, 6);
  const stage = useRef(null);
  const nodes = useRef([]);
  const spin = useRef({ angle: 0, vel: 0.004, dragging: false, lastX: 0 });

  const mx = useMotionValue(0), my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 80, damping: 14 });
  const rotX = useSpring(useTransform(my, [-1, 1], [64, 48]), { stiffness: 80, damping: 14 });

  useAnimationFrame((t) => {
    const s = spin.current;
    if (!s.dragging) s.vel += (0.004 - s.vel) * 0.02; // ease back to idle spin
    s.angle += s.vel;
    const R = size * 0.32;
    nodes.current.forEach((el, i) => {
      if (!el) return;
      const a = s.angle + (i / dishes.length) * Math.PI * 2;
      const bob = Math.sin(t / 600 + i * 1.7) * 8;
      // Counter-tilt so the dish faces the camera even though the plate is laid back.
      el.style.transform = `translate3d(${Math.cos(a) * R}px, ${Math.sin(a) * R}px, 0) rotateX(${-rotX.get()}deg) translateZ(${24 + bob}px)`;
    });
  });

  const onMove = (e) => {
    const r = stage.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
    const s = spin.current;
    if (s.dragging) { s.vel = (e.clientX - s.lastX) * 0.004; s.lastX = e.clientX; }
  };

  return (
    <div
      ref={stage}
      className="thali-stage"
      style={{ width: size, height: size * 0.92 }}
      onPointerMove={onMove}
      onPointerLeave={() => { mx.set(0); my.set(0); spin.current.dragging = false; }}
      onPointerDown={(e) => { spin.current.dragging = true; spin.current.lastX = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); }}
      onPointerUp={() => { spin.current.dragging = false; }}
      title="drag to spin the thali"
    >
      <motion.div className="thali-world" style={{ rotateY: rotY }}>
        <motion.div className="thali-plate" style={{ rotateX: rotX, width: size, height: size }}>
          <div className="thali-plate-art"><Plate size={size} /></div>
          {dishes.map((name, i) => {
            const D = doodleFor(name);
            return (
              // Zero-size anchor = the dish's footprint on the plate; content hangs above it.
              <div key={name + i} ref={(el) => (nodes.current[i] = el)} className="thali-dish">
                <div className="thali-dish-in">
                  <D size={size * 0.26} boil={i === 0} />
                  <span className="thali-label" style={{ background: CRAYONS[CRAYON_ORDER[i % CRAYON_ORDER.length]], rotate: `${(i % 2 ? 4 : -5)}deg` }}>{name}</span>
                  <div className="thali-shadow" />
                </div>
              </div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}

