import { useEffect, useRef } from 'react';
import { ShoppingBag, Utensils, Undo2, Truck, Droplets, Store, type LucideIcon } from 'lucide-react';

export interface Stage {
  id: string;
  name: string;
  icon: LucideIcon;
}

export const STAGE_ICONS: LucideIcon[] = [ShoppingBag, Utensils, Undo2, Truck, Droplets, Store];

const SIZE = 600;
const C = SIZE / 2;
const R = 196;
const NODE = 52;
const DOTS = 30;
const PERIOD = 9; // seconds for one full loop

const polar = (deg: number, r = R) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

type Dot = { a: number; mode: 'loop' | 'leak' | 'retire' | 'wait'; t: number; checkedReturn: boolean; checkedWash: boolean; lane: number };

/**
 * The six-stage container loop. Dots are containers.
 * Peach = in a student's hands, grey = dirty, teal = clean.
 * Some leave the loop at Return (never returned) and at Wash (damaged at inspection).
 */
export default function Loop(props: {
  stages: Stage[];
  active: number;
  onSelect: (i: number) => void;
  returnRate: number;
  damageRate: number;
}) {
  const { stages, active, onSelect, returnRate, damageRate } = props;
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const lostRef = useRef<SVGTextElement | null>(null);
  const counts = useRef({ lost: 0, retired: 0, loops: 0 });

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dots: Dot[] = Array.from({ length: DOTS }, (_, i) => ({
      a: (360 / DOTS) * i + Math.random() * 6,
      mode: 'loop',
      t: 0,
      checkedReturn: false,
      checkedWash: false,
      lane: (Math.random() - 0.5) * 16,
    }));
    let raf = 0;
    let last = performance.now();
    const colorFor = (a: number) => (a < 120 ? 'var(--peach)' : a < 240 ? '#8f8389' : 'var(--teal)');

    const draw = () => {
      dots.forEach((d, i) => {
        const el = dotRefs.current[i];
        if (!el) return;
        let x: number, y: number, op = 1, r = 6.5;
        if (d.mode === 'loop') {
          ({ x, y } = polar(d.a, R + d.lane));
        } else if (d.mode === 'leak') {
          const p = polar(120 + d.t * 6, R + d.lane + d.t * 120);
          x = p.x; y = p.y; op = Math.max(0, 1 - d.t); r = 6.5 - d.t * 2;
        } else if (d.mode === 'retire') {
          const p = polar(240 - d.t * 4, R + d.lane - d.t * 90);
          x = p.x; y = p.y; op = Math.max(0, 1 - d.t); r = 6.5 - d.t * 3;
        } else {
          ({ x, y } = polar(0, R)); op = 0;
        }
        el.setAttribute('cx', x.toFixed(1));
        el.setAttribute('cy', y.toFixed(1));
        el.setAttribute('r', Math.max(1, r).toFixed(1));
        el.setAttribute('opacity', op.toFixed(2));
        el.style.fill = d.mode === 'leak' ? 'var(--stop)' : d.mode === 'retire' ? 'var(--warn)' : colorFor(d.a);
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const d of dots) {
        if (d.mode === 'loop') {
          d.a += (360 / PERIOD) * dt;
          if (!d.checkedReturn && d.a >= 120) {
            d.checkedReturn = true;
            if (Math.random() > returnRate) { d.mode = 'leak'; d.t = 0; counts.current.lost++; }
          }
          if (d.mode === 'loop' && !d.checkedWash && d.a >= 240) {
            d.checkedWash = true;
            if (Math.random() < damageRate) { d.mode = 'retire'; d.t = 0; counts.current.retired++; }
          }
          if (d.a >= 360) { d.a -= 360; d.checkedReturn = false; d.checkedWash = false; counts.current.loops++; }
        } else if (d.mode === 'leak' || d.mode === 'retire') {
          d.t += dt / 1.3;
          if (d.t >= 1) { d.mode = 'wait'; d.t = 0; }
        } else {
          // a replacement container is bought and joins at Borrow
          d.t += dt;
          if (d.t > 1.2) { d.mode = 'loop'; d.a = 0; d.t = 0; d.checkedReturn = false; d.checkedWash = false; }
        }
      }
      draw();
      if (lostRef.current) lostRef.current.textContent = `${counts.current.lost + counts.current.retired} replaced so far`;
      raf = requestAnimationFrame(tick);
    };
    if (reduced) draw();
    else raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [returnRate, damageRate]);

  const s = returnRate * (1 - damageRate);
  const at20 = Math.pow(s, 20);

  return (
    <svg className="loop-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="The six-stage container loop">
      <defs>
        <radialGradient id="loopGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.55" />
          <stop offset="70%" stopColor="var(--lime)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
        </radialGradient>
        <marker id="arrowHead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink)" />
        </marker>
      </defs>
      <circle cx={C} cy={C} r={R + 70} fill="url(#loopGlow)" />
      {/* ring, coloured by container state */}
      {[0, 1, 2].map((seg) => {
        const a0 = seg * 120, a1 = a0 + 120;
        const p0 = polar(a0), p1 = polar(a1);
        const col = seg === 0 ? 'var(--peach)' : seg === 1 ? '#b9adb3' : 'var(--teal)';
        return <path key={seg} d={`M${p0.x} ${p0.y} A${R} ${R} 0 0 1 ${p1.x} ${p1.y}`} fill="none" stroke={col} strokeOpacity="0.35" strokeWidth="30" />;
      })}
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--ink)" strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="2 6" />

      {/* leak labels */}
      {(() => {
        const p = polar(128, R + 92);
        const q = polar(246, R + 88);
        return (
          <g fontSize="13" fontWeight="700" fill="var(--ink-2)">
            <text x={p.x} y={p.y} textAnchor="middle">
              <tspan fill="var(--stop)">●</tspan> Not returned
            </text>
            <text x={q.x} y={q.y} textAnchor="middle">
              <tspan fill="var(--warn)">●</tspan> Damaged
            </text>
          </g>
        );
      })()}

      {Array.from({ length: DOTS }, (_, i) => (
        <circle key={i} ref={(el) => { dotRefs.current[i] = el; }} r="6.5" cx={C} cy={C - R} fill="var(--teal)" stroke="var(--paper)" strokeWidth="1.5" />
      ))}

      {/* centre readout */}
      <g textAnchor="middle">
        <text x={C} y={C - 58} fontSize="14" fontWeight="700" fill="var(--ink-2)">Survives one loop</text>
        <text x={C} y={C - 4} fontSize="58" fill="var(--ink)" style={{ fontFamily: 'var(--display)' }}>{Math.round(s * 100)}%</text>
        <text x={C} y={C + 30} fontSize="14" fontWeight="700" fill="var(--ink-2)">Still in service at use 20</text>
        <text x={C} y={C + 70} fontSize="40" fill="var(--stop)" style={{ fontFamily: 'var(--display)' }}>{Math.round(at20 * 100)}%</text>
        <text ref={lostRef} x={C} y={C + 98} fontSize="12" fill="var(--ink-3)">0 replaced so far</text>
      </g>

      {stages.map((st, i) => {
        const { x, y } = polar(i * 60);
        const Icon = st.icon;
        const on = i === active;
        return (
          <g
            key={st.id}
            className="loop-stage"
            data-active={on}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`Stage ${i + 1}: ${st.name}`}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); }
            }}
          >
            <g className="node">
              <circle className="node-ring" cx={x} cy={y} r={NODE} fill={on ? 'var(--ink)' : 'var(--paper-3)'} stroke="var(--ink)" strokeWidth={on ? 0 : 2} />
              <Icon x={x - 12} y={y - 28} width={24} height={24} color={on ? 'var(--lime)' : 'var(--ink)'} strokeWidth={2} />
              <text x={x} y={y + 16} textAnchor="middle" fontSize={st.name.length > 8 ? 13.5 : 17} fill={on ? 'var(--paper)' : 'var(--ink)'} style={{ fontFamily: 'var(--display)', textTransform: 'uppercase' }}>
                {st.name}
              </text>
              <text x={x} y={y + 34} textAnchor="middle" fontSize="11" fontWeight="800" fill={on ? 'var(--lime)' : 'var(--ink-3)'}>
                {i + 1}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
