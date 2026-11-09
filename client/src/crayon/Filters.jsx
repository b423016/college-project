// Global SVG filters that give every shape its waxy crayon texture.
// Mounted once at the app root; shapes reference them with filter="url(#…)".
export default function CrayonFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* Wobbly edge + speckled holes where the wax skipped the paper grain. */}
        <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.05" result="mask" />
          <feComposite in="wobbly" in2="mask" operator="in" />
        </filter>

        {/* Outline strokes: thinner grain so lines stay readable. */}
        <filter id="crayon-line" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="2" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2 0 0 0 2" result="mask" />
          <feComposite in="wobbly" in2="mask" operator="in" />
        </filter>

        {/* Solid waxy fill with soft streaks, for card backgrounds. */}
        <filter id="wax" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.5" numOctaves="2" seed="5" result="streak" />
          <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.3 0 0 0 1.45" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>

        {/* "Boiling line" — the noise seed flips a few times a second like hand-drawn animation frames. */}
        <filter id="boil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="warp">
            <animate attributeName="seed" values="1;4;9;14" dur="0.6s" calcMode="discrete" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.05" result="mask" />
          <feComposite in="wobbly" in2="mask" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
