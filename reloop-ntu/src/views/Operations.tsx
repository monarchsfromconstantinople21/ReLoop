import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, CheckCircle2, AlertTriangle, Truck, RotateCcw } from 'lucide-react';
import { RETURN_POINTS, WASH_HUB, PILOT_STALLS } from '../data/campus';
import { BIN_CAPACITY, WASH, cumulativeReturns, fleetSize, fmtHour, POOL_LABEL, type Pool } from '../lib/model';
import { Info, Range, Seg } from '../components/ui';

type Scenario = 'pilot' | 'campus';
type Mode = 'full' | 'fixed';

interface Pickup {
  at: number;
  point: string;
  count: number;
  fill: number;
}

const DAILY_RETURNS: Record<Scenario, number> = { pilot: 280, campus: 2400 };
const FIXED_ROUNDS = [10, 13, 16, 19];
const DT = 0.05;

/** Runs a whole day (08:00–20:00) of returns and collections for one scenario. */
function simulateDay(scenario: Scenario, mode: Mode) {
  const pts = RETURN_POINTS.filter((p) => scenario === 'campus' || p.pilot);
  const wsum = pts.reduce((a, p) => a + p.weight, 0);
  const level: Record<string, number> = Object.fromEntries(pts.map((p) => [p.id, 0]));
  const frames: { t: number; level: Record<string, number>; returned: number; overflow: number }[] = [];
  const pickups: Pickup[] = [];
  let returned = 0;
  let overflow = 0;
  let nextRound = 0;
  for (let t = 8; t <= 20 + 1e-9; t += DT) {
    const t2 = Math.min(20, t + DT);
    const share = cumulativeReturns(t2) - cumulativeReturns(t);
    for (const p of pts) {
      const arrive = (DAILY_RETURNS[scenario] * p.weight * share) / wsum;
      returned += arrive;
      level[p.id] += arrive;
      if (level[p.id] > BIN_CAPACITY) {
        overflow += level[p.id] - BIN_CAPACITY;
        level[p.id] = BIN_CAPACITY; // bin full: students have to find another point or keep the box
      }
      if (mode === 'full' && level[p.id] >= BIN_CAPACITY * 0.8) {
        pickups.push({ at: t2, point: p.id, count: level[p.id], fill: level[p.id] / BIN_CAPACITY });
        level[p.id] = 0;
      }
    }
    if (mode === 'fixed' && nextRound < FIXED_ROUNDS.length && t2 >= FIXED_ROUNDS[nextRound] - 1e-9) {
      for (const p of pts) {
        pickups.push({ at: t2, point: p.id, count: level[p.id], fill: level[p.id] / BIN_CAPACITY });
        level[p.id] = 0;
      }
      nextRound++;
    }
    if (mode === 'full' && t2 >= 20 - 1e-9) {
      // end-of-day sweep so nothing sits overnight (odour, pests)
      for (const p of pts) if (level[p.id] > 0.5) { pickups.push({ at: 20, point: p.id, count: level[p.id], fill: level[p.id] / BIN_CAPACITY }); level[p.id] = 0; }
    }
    frames.push({ t: t2, level: { ...level }, returned, overflow });
  }
  return { pts, frames, pickups };
}

const levelColor = (f: number) => (f >= 0.8 ? 'var(--stop)' : f >= 0.5 ? 'var(--warn)' : 'var(--teal)');

export default function Operations() {
  const [scenario, setScenario] = useState<Scenario>('pilot');
  const [mode, setMode] = useState<Mode>('full');
  const [hour, setHour] = useState(13.5);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const hourRef = useRef(13.5);

  const sim = useMemo(() => simulateDay(scenario, mode), [scenario, mode]);
  const frame = sim.frames.reduce((best, f) => (f.t <= hour + 1e-9 ? f : best), sim.frames[0]);
  const done = sim.pickups.filter((p) => p.at <= hour + 1e-9);
  const recent = done.filter((p) => hour - p.at < 0.35);
  const avgFill = done.length ? done.reduce((a, p) => a + p.fill, 0) / done.length : 0;
  const halfEmpty = done.filter((p) => p.fill < 0.5).length;
  const leftOvernight = hour >= 20 ? Object.values(frame.level).reduce((a, v) => a + v, 0) : 0;

  useEffect(() => {
    if (!playing) return;
    hourRef.current = hour;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      hourRef.current = Math.min(20, hourRef.current + dt * 0.9); // 0.9 simulated hours per second
      setHour(hourRef.current);
      if (hourRef.current >= 20) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const fleet = fleetSize(scenario === 'pilot' ? 300 : 2600, 2);

  /* ---------- stall top-up planner (pilot stalls) ---------- */
  const [demand, setDemand] = useState(1.2);
  const [shelf, setShelf] = useState<Record<string, number>>({ rice: 46, noodle: 22 });
  const [reserve, setReserve] = useState<Record<Pool, number>>({ halal: 74, general: 31, veg: 0 });
  const [plan, setPlan] = useState<null | { lines: { stall: string; pool: Pool; move: number; short: number }[] }>(null);
  const base: Record<string, number> = { rice: 110, noodle: 64 };
  const need = (id: string) => Math.round(base[id] * demand);

  const makePlan = () => {
    const r = { ...reserve };
    const lines = PILOT_STALLS.map((s) => {
      const gap = Math.max(0, need(s.id) - shelf[s.id]);
      const move = Math.min(gap, r[s.pool]);
      r[s.pool] -= move;
      return { stall: s.id, pool: s.pool, move, short: gap - move };
    });
    setPlan({ lines });
  };
  const applyPlan = () => {
    if (!plan) return;
    const sh = { ...shelf };
    const r = { ...reserve };
    for (const l of plan.lines) { sh[l.stall] += l.move; r[l.pool] -= l.move; }
    setShelf(sh); setReserve(r); setPlan(null);
  };
  const resetStock = () => { setShelf({ rice: 46, noodle: 22 }); setReserve({ halal: 74, general: 31, veg: 0 }); setPlan(null); };

  /* ---------- wash hub, derived from collections ---------- */
  const washWaves = useMemo(() => {
    const waves = [{ label: 'Until 14:00', from: 8, to: 14 }, { label: '14:00–17:00', from: 14, to: 17 }, { label: '17:00–20:00', from: 17, to: 20.01 }];
    return waves.map((w) => {
      const n = done.filter((p) => p.at > w.from && p.at <= w.to).reduce((a, p) => a + p.count, 0);
      const pools: { pool: Pool; n: number }[] = [{ pool: 'halal', n: Math.round(n * 0.6) }, { pool: 'general', n: Math.round(n * 0.4) }];
      return { ...w, pools: pools.map((p) => ({ ...p, runs: p.n > 0 ? Math.ceil(p.n / WASH.rack) : 0 })) };
    });
  }, [done]);
  const washed = washWaves.reduce((a, w) => a + w.pools.reduce((b, p) => b + p.n, 0), 0);
  const runs = washWaves.reduce((a, w) => a + w.pools.reduce((b, p) => b + p.runs, 0), 0);

  const hourly = useMemo(() => Array.from({ length: 12 }, (_, i) => cumulativeReturns(9 + i) - cumulativeReturns(8 + i)), []);

  return (
    <>
      <div className="view-head">
        <div>
          <p className="kicker">Operations console <span className="owner">· campus operations and stall vendors</span></p>
          <h1 className="display">Run the loop for one day</h1>
        </div>
        <p className="lede">
          Press play to watch return bins fill from breakfast to dinner. Switch to fixed rounds to see half-empty pickups, or to campus-wide to
          see why our slides say start small.
        </p>
      </div>

      <section className="console dark" aria-label="Operations console">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Seg label="Scenario" value={scenario} onChange={(v) => { setScenario(v); setPlaying(false); }} options={[{ value: 'pilot', label: 'Pilot: 3 points' }, { value: 'campus', label: 'Campus-wide: 12 points' }]} />
            <Seg label="Collection rule" value={mode} onChange={(v) => { setMode(v); }} options={[{ value: 'full', label: 'Collect when full' }, { value: 'fixed', label: 'Fixed rounds' }]} />
          </div>
          <span className="pill sim">Simulated day · {sim.pts.length} points · {DAILY_RETURNS[scenario].toLocaleString()} returns</span>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="lab">Containers in circulation <Info>Fleet for {scenario === 'pilot' ? '300' : '2,600'} borrows a day, two pools (halal, non-halal), each with its own 22% reserve.</Info></div>
            <div className="val num">{fleet.toLocaleString()}</div>
            <div className="delta">two separate pools</div>
          </div>
          <div className="kpi">
            <div className="lab">Returned so far</div>
            <div className="val num">{Math.round(frame.returned).toLocaleString()}</div>
            <div className="delta">by {fmtHour(hour)}</div>
          </div>
          <div className="kpi">
            <div className="lab">Collection trips</div>
            <div className="val num">{done.length}</div>
            <div className="delta">{halfEmpty} were under half full</div>
          </div>
          <div className="kpi">
            <div className="lab">Avg fill at pickup <Info>Higher is better: fewer trips for the same containers. The slides warn that more points means more trips for half-full bins.</Info></div>
            <div className="val num">{done.length ? `${Math.round(avgFill * 100)}%` : '–'}</div>
            <div className="delta">target 75%+</div>
          </div>
          <div className="kpi">
            <div className="lab">Turned away <Info>Containers arriving at a full bin. Those students keep the box, or walk to another point.</Info></div>
            <div className="val num" style={{ color: frame.overflow > 0.5 ? '#ffb4ad' : undefined }}>{Math.round(frame.overflow)}</div>
            <div className="delta">{hour >= 20 && leftOvernight > 0.5 ? `${Math.round(leftOvernight)} left overnight` : 'at full bins'}</div>
          </div>
        </div>

        <div className="console-grid">
          <div className="panel">
            <div className="panel-head">
              <h3>Return points, schematic campus</h3>
              <div className="map-legend">
                <span><i style={{ background: 'var(--teal)' }} /> under 50%</span>
                <span><i style={{ background: 'var(--warn)' }} /> 50–80%</span>
                <span><i style={{ background: 'var(--stop)' }} /> 80%+, collect</span>
              </div>
            </div>
            <div className="map-wrap">
              <svg className="map-svg" viewBox="0 0 900 520" role="img" aria-label={`Campus map at ${fmtHour(hour)}`} style={{ minWidth: 560 }}>
                <rect x="0" y="0" width="900" height="520" rx="12" fill="#163f31" />
                {/* stylised campus: loop road, spines, green */}
                <ellipse cx="460" cy="290" rx="380" ry="205" fill="none" stroke="#2c5a49" strokeWidth="16" />
                <ellipse cx="460" cy="290" rx="380" ry="205" fill="none" stroke="#3b6c59" strokeWidth="1.5" strokeDasharray="10 12" />
                <path d="M290 250 C 380 225, 540 200, 700 160" stroke="#2c5a49" strokeWidth="10" fill="none" />
                <path d="M500 220 L 500 375" stroke="#2c5a49" strokeWidth="10" fill="none" />
                <rect x="420" y="190" width="170" height="44" rx="8" fill="#2a5d4b" />
                <rect x="440" y="362" width="120" height="44" rx="8" fill="#2a5d4b" />
                <text x="426" y="216" fill="#9fbfae" fontSize="12" fontWeight="800" letterSpacing="0.5">NORTH SPINE</text>
                <text x="440" y="353" fill="#9fbfae" fontSize="13" fontWeight="800" letterSpacing="1">SOUTH SPINE</text>
                <circle cx="760" cy="420" r="40" fill="#1d4a3a" />
                <circle cx="130" cy="180" r="34" fill="#1d4a3a" />
                <text x="22" y="504" fill="#7fa595" fontSize="13">Schematic, not to scale</text>

                {/* collection lines to the hub */}
                {recent.map((p, i) => {
                  const pt = RETURN_POINTS.find((x) => x.id === p.point)!;
                  return <line key={`${p.point}-${i}`} x1={pt.x} y1={pt.y} x2={WASH_HUB.x} y2={WASH_HUB.y} stroke="var(--lime)" strokeWidth="2" strokeDasharray="5 5" opacity={1 - (hour - p.at) / 0.35} />;
                })}

                {/* wash hub */}
                <g>
                  <rect x={WASH_HUB.x - 16} y={WASH_HUB.y - 16} width="32" height="32" rx="7" fill="var(--lime)" />
                  <path d={`M${WASH_HUB.x} ${WASH_HUB.y - 9} C ${WASH_HUB.x + 7} ${WASH_HUB.y}, ${WASH_HUB.x + 7} ${WASH_HUB.y + 9}, ${WASH_HUB.x} ${WASH_HUB.y + 9} C ${WASH_HUB.x - 7} ${WASH_HUB.y + 9}, ${WASH_HUB.x - 7} ${WASH_HUB.y}, ${WASH_HUB.x} ${WASH_HUB.y - 9} Z`} fill="var(--forest)" />
                  <text x={WASH_HUB.x + 24} y={WASH_HUB.y + 5} fill="var(--lime)" fontSize="16" fontWeight="800">Wash hub</text>
                </g>

                {RETURN_POINTS.map((p) => {
                  const active = scenario === 'campus' || p.pilot;
                  const lv = active ? (frame.level[p.id] ?? 0) / BIN_CAPACITY : 0;
                  const r = p.pilot ? 24 : 16;
                  const circ = 2 * Math.PI * (r + 6);
                  const flash = recent.some((x) => x.point === p.id);
                  return (
                    <g key={p.id} opacity={active ? 1 : 0.32}>
                      {flash && <circle cx={p.x} cy={p.y} r={r + 16} fill="none" stroke="var(--lime)" strokeWidth="2" opacity="0.8" />}
                      <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke="#2f5f4d" strokeWidth="5" />
                      {active && (
                        <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={levelColor(lv)} strokeWidth="5" strokeLinecap="round"
                          strokeDasharray={circ} strokeDashoffset={circ * (1 - lv)} transform={`rotate(-90 ${p.x} ${p.y})`} />
                      )}
                      <circle cx={p.x} cy={p.y} r={r} fill={active ? '#f2f4d3' : '#2f5f4d'} />
                      {active && (
                        <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={p.pilot ? 15 : 12} fontWeight="800" fill="var(--forest)" className="num">
                          {Math.round(lv * 100)}
                        </text>
                      )}
                      <text x={p.x} y={p.y + r + 26} textAnchor="middle" fontSize={p.pilot ? 16 : 13} fontWeight={p.pilot ? 800 : 600} fill={p.pilot ? '#f2f4d3' : '#b6cfc2'}>
                        {p.short}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="time-row">
              <button className="play" type="button" aria-label={playing ? 'Pause the day' : 'Play the day'} onClick={() => { if (hour >= 20) setHour(8); setPlaying((p) => !p); }}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div>
                <label htmlFor="ops-hour" style={{ position: 'absolute', left: -9999 }}>Time of day</label>
                <input id="ops-hour" type="range" min={8} max={20} step={0.05} value={hour} onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} style={{ width: '100%', accentColor: 'var(--lime)' }} />
                <svg viewBox="0 0 240 26" preserveAspectRatio="none" style={{ width: '100%', height: 26, display: 'block' }} aria-hidden="true">
                  {hourly.map((v, i) => {
                    const h = (v / Math.max(...hourly)) * 22;
                    return <rect key={i} x={i * 20 + 2} y={24 - h} width={16} height={h} rx="2" fill={8 + i < hour ? 'var(--lime)' : '#2f5f4d'} />;
                  })}
                </svg>
                <div className="range-hint" style={{ display: 'flex', justifyContent: 'space-between' }}><span>08:00</span><span>lunch peak</span><span>dinner</span><span>20:00</span></div>
              </div>
              <span className="clock-read">{fmtHour(hour)}</span>
            </div>
            {mode === 'fixed' ? (
              <p className="callout">Fixed rounds at 10:00, 13:00, 16:00 and 19:00 visit every point, full or not. Anything returned after 19:00 sits overnight.</p>
            ) : (
              <p className="callout">Bins report their fill level. Staff go when a bin reaches 80%, with one sweep at 20:00 so nothing sits overnight.</p>
            )}
            <div className="stack" style={{ gap: 6 }}>
              <div className="panel-head">
                <h3>Collection log</h3>
                <span style={{ fontSize: '0.76rem', opacity: 0.8 }}>{done.length} {done.length === 1 ? 'trip' : 'trips'} · {Math.round(done.reduce((a, p) => a + p.count, 0))} containers to the hub</span>
              </div>
              {done.length === 0 ? (
                <p className="pickup-empty">No collections yet. Press play or drag the time slider past the lunch peak.</p>
              ) : (
                <div className="pickup-log" aria-label="Collections so far">
                  {[...done].reverse().map((p, i) => {
                    const pt = RETURN_POINTS.find((x) => x.id === p.point)!;
                    return (
                      <div key={i}>
                        <span>{fmtHour(p.at)}</span>
                        <span>{pt.short}</span>
                        <span className="r">{Math.round(p.count)} boxes</span>
                        <span className="r" style={{ color: p.fill < 0.5 ? 'var(--warn)' : 'var(--lime)', fontWeight: 700 }}>{Math.round(p.fill * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 22, alignContent: 'start', minWidth: 0 }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Lunch top-up, by pool</h3>
                <button className="btn small ghost" type="button" onClick={resetStock} style={{ color: 'var(--mist)', borderColor: 'rgba(214,230,207,.4)' }}>
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
              <Range id="lunch-demand" label="Lunch rush demand" value={demand} min={0.8} max={1.8} step={0.05} onChange={(v) => { setDemand(v); setPlan(null); }} format={(v) => `${Math.round(v * 100)}% of usual`}
                info="Popular stalls run short at the lunch rush while quieter stalls hold unused stock (Kyra's slide)." />
              <table className="ops-table">
                <thead>
                  <tr><th>Stall</th><th className="r">On shelf</th><th className="r">Lunch need</th><th style={{ width: '34%' }}>Cover</th></tr>
                </thead>
                <tbody>
                  {PILOT_STALLS.map((s) => {
                    const n = need(s.id);
                    const cover = Math.min(1, shelf[s.id] / n);
                    return (
                      <tr key={s.id}>
                        <td><b style={{ color: 'var(--paper)' }}>{s.name}</b><br /><span className={`pill ${s.pool}`} style={{ marginTop: 4 }}>{POOL_LABEL[s.pool]}</span></td>
                        <td className="r">{shelf[s.id]}</td>
                        <td className="r">{n}</td>
                        <td><div className="stock-bar"><i style={{ width: `${cover * 100}%`, background: cover >= 1 ? 'var(--lime)' : cover > 0.6 ? 'var(--warn)' : 'var(--stop)' }} /></div></td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td>Hub reserve (clean)</td>
                    <td className="r" colSpan={2}><span className="pill halal">{reserve.halal} halal</span> <span className="pill general">{reserve.general} non-halal</span></td>
                    <td />
                  </tr>
                </tbody>
              </table>
              {!plan ? (
                <button className="btn small" type="button" onClick={makePlan} style={{ background: 'var(--lime)', borderColor: 'var(--lime)', color: 'var(--forest)', justifySelf: 'start' }}>
                  <Truck size={14} /> Plan top-up
                </button>
              ) : (
                <div className="plan">
                  {plan.lines.map((l) => {
                    const s = PILOT_STALLS.find((x) => x.id === l.stall)!;
                    const other: Pool = l.pool === 'halal' ? 'general' : 'halal';
                    return (
                      <div key={l.stall} className="stack" style={{ gap: 4 }}>
                        <div className={`plan-line ${l.move > 0 || l.short === 0 ? 'ok' : ''}`}>
                          <CheckCircle2 size={16} />
                          <span>{l.move > 0 ? `Send ${l.move} ${POOL_LABEL[l.pool].toLowerCase()} containers to the ${s.name.toLowerCase()}.` : `${s.name} is covered.`}</span>
                        </div>
                        {l.short > 0 && (
                          <div className="plan-line bad">
                            <AlertTriangle size={16} />
                            <span>
                              Still {l.short} short. {reserve[other] > 0 ? `${reserve[other]} ${POOL_LABEL[other].toLowerCase()} containers sit spare, but pools cannot be mixed.` : 'No reserve left in this pool.'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn small" type="button" onClick={applyPlan} style={{ background: 'var(--lime)', borderColor: 'var(--lime)', color: 'var(--forest)' }}>Send top-up</button>
                    <button className="btn small ghost" type="button" onClick={() => setPlan(null)} style={{ color: 'var(--mist)', borderColor: 'rgba(214,230,207,.4)' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Wash hub today</h3>
                <span className="pill sim">{WASH.rack} per run · assumed</span>
              </div>
              <table className="ops-table">
                <thead><tr><th>Batch</th><th>Pool</th><th className="r">Containers</th><th className="r">Runs</th></tr></thead>
                <tbody>
                  {washWaves.flatMap((w) =>
                    w.pools.map((p, i) => (
                      <tr key={w.label + p.pool}>
                        <td>{i === 0 ? w.label : ''}</td>
                        <td><span className={`pill ${p.pool}`}>{POOL_LABEL[p.pool]}</span></td>
                        <td className="r">{p.n || '–'}</td>
                        <td className="r">{p.runs || '–'}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
              <div className="stat-line">
                <div><b className="num">{washed ? ((runs * WASH.litresPerRun) / washed).toFixed(2) : '–'}</b><span>litres per container</span></div>
                <div><b className="num">{washed ? ((runs * WASH.kwhPerRun * 1000) / washed).toFixed(0) : '–'}</b><span>Wh per container</span></div>
                <div><b className="num">0</b><span>mixed batches</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
