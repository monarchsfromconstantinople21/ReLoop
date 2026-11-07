import { useRef, useState, type ReactNode } from 'react';

export interface Series {
  name: string;
  color: string;
  points: { x: number; y: number }[];
  area?: boolean;
  label?: boolean; // direct label at the line's end
}

export interface Marker {
  x: number;
  label: string;
  color?: string;
  dash?: boolean;
  align?: 'start' | 'end';
  row?: number; // label row, 0 = top
}

/**
 * Small single-axis line chart with a crosshair tooltip.
 * One y-scale only; two measures of different scale go in two charts.
 */
export default function LineChart(props: {
  series: Series[];
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: number[];
  yTicks: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  xLabel?: string;
  markers?: Marker[];
  band?: { from: number; to: number; label: string };
  shade?: { from: number; seriesIndex: number; color: string };
  height?: number;
  tooltip?: (x: number) => ReactNode;
  snap?: (x: number) => number;
  ariaLabel: string;
  width?: number;
}) {
  const W = props.width ?? 760;
  const H = props.height ?? 300;
  const m = { t: 22, r: props.width && props.width < 600 ? 70 : 92, b: 40, l: 48 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const [x0, x1] = props.xDomain;
  const [y0, y1] = props.yDomain;
  const sx = (v: number) => m.l + ((v - x0) / (x1 - x0)) * iw;
  const sy = (v: number) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const xf = props.xFormat ?? String;
  const yf = props.yFormat ?? String;
  const ref = useRef<SVGSVGElement>(null);
  const [hx, setHx] = useState<number | null>(null);

  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('');

  const onMove = (e: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let v = x0 + ((px - m.l) / iw) * (x1 - x0);
    v = Math.min(x1, Math.max(x0, v));
    setHx(props.snap ? props.snap(v) : v);
  };

  const shadePts = props.shade ? props.series[props.shade.seriesIndex].points.filter((p) => p.x >= props.shade!.from) : [];

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref}
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={props.ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHx(null)}
        style={{ touchAction: 'pan-y' }}
      >
        {/* grid */}
        {props.yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={m.l - 8} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="var(--ink-2)" className="num">{yf(t)}</text>
          </g>
        ))}
        {props.xTicks.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={m.t + ih + 20} textAnchor="middle" fontSize="12" fill="var(--ink-2)" className="num">{xf(t)}</text>
        ))}
        {props.xLabel && (
          <text x={m.l + iw} y={H - 2} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--ink-2)">{props.xLabel}</text>
        )}
        <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke="var(--line-2)" strokeWidth="1" />

        {props.band && (
          <g>
            <rect x={sx(props.band.from)} y={m.t} width={Math.max(2, sx(props.band.to) - sx(props.band.from))} height={ih} fill="var(--lime)" opacity="0.45" />
            <text x={(sx(props.band.from) + sx(props.band.to)) / 2} y={m.t - 6} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="var(--ink)">{props.band.label}</text>
          </g>
        )}

        {props.shade && shadePts.length > 1 && (
          <path
            d={`${path(shadePts)}L${sx(shadePts[shadePts.length - 1].x)} ${sy(y0)}L${sx(shadePts[0].x)} ${sy(y0)}Z`}
            fill={props.shade.color}
            opacity="0.3"
          />
        )}

        {props.series.map((s) => (
          <g key={s.name}>
            {s.area && (
              <path d={`${path(s.points)}L${sx(s.points[s.points.length - 1].x)} ${sy(y0)}L${sx(s.points[0].x)} ${sy(y0)}Z`} fill={s.color} opacity="0.12" />
            )}
            <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {s.label && (() => {
              const last = s.points[s.points.length - 1];
              return (
                <>
                  <circle cx={sx(last.x)} cy={sy(last.y)} r="4.5" fill={s.color} stroke="var(--paper)" strokeWidth="2" />
                  <text x={sx(last.x) + 8} y={sy(last.y) + 4} fontSize="12" fontWeight="700" fill="var(--ink)">{s.name}</text>
                </>
              );
            })()}
          </g>
        ))}

        {props.markers?.map((mk) => (
          <g key={mk.label}>
            <line x1={sx(mk.x)} x2={sx(mk.x)} y1={m.t} y2={m.t + ih} stroke={mk.color ?? 'var(--ink)'} strokeWidth="1.5" strokeDasharray={mk.dash ? '4 4' : undefined} />
            <text x={sx(mk.x) + (mk.align === 'end' ? -6 : 6)} y={m.t + 12 + (mk.row ?? 0) * 18} textAnchor={mk.align === 'end' ? 'end' : 'start'} fontSize="12" fontWeight="800" fill="var(--ink)">{mk.label}</text>
          </g>
        ))}

        {hx !== null && (
          <g pointerEvents="none">
            <line x1={sx(hx)} x2={sx(hx)} y1={m.t} y2={m.t + ih} stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="1" />
            {props.series.map((s) => {
              const p = s.points.reduce((b, q) => (Math.abs(q.x - hx) < Math.abs(b.x - hx) ? q : b), s.points[0]);
              return <circle key={s.name} cx={sx(p.x)} cy={sy(p.y)} r="5" fill={s.color} stroke="var(--paper)" strokeWidth="2" />;
            })}
          </g>
        )}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" />
      </svg>
      {hx !== null && props.tooltip && (
        <div
          className="info"
          style={{ position: 'absolute', left: `${(sx(hx) / W) * 100}%`, top: 0, pointerEvents: 'none' }}
        >
          <span className="tip" style={{ bottom: 'auto', top: 0, transform: `translateX(${sx(hx) > W * 0.6 ? '-108%' : '8%'})` }}>{props.tooltip(hx)}</span>
        </div>
      )}
    </div>
  );
}
