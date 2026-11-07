import { useEffect, useMemo, useState } from 'react';
import { Info, Seg } from '../components/ui';

type Dir = 'min' | 'max'; // min: value must be at least the target; max: at most
type Status = 'pass' | 'near' | 'fail';
type ScenarioId = 'week4' | 'strong' | 'slip';

interface Metric {
  id: string;
  name: string;
  unit: string;
  dir: Dir;
  target: number;
  step: number;
  fix: string;
  info: string;
  weeks: Record<ScenarioId, number[]>;
}

interface Criterion {
  id: string;
  name: string;
  question: string;
  metrics: Metric[];
}

/* Criteria and questions from the "Scale only when the evidence says go" slide. Weekly values are simulated. */
const CRITERIA: Criterion[] = [
  {
    id: 'return',
    name: 'Return',
    question: 'Are containers coming back promptly, with manageable loss?',
    metrics: [
      { id: 'r48', name: 'Returned within 48 hours', unit: '%', dir: 'min', target: 85, step: 1, fix: 'Move or add return points on routes students already walk, and test the reminder timing.', info: 'Share of borrows returned before the NTU pass reminder.',
        weeks: { week4: [78, 83, 86, 88], strong: [84, 88, 91, 93], slip: [74, 70, 67, 63] } },
      { id: 'rall', name: 'Returned by end of grace', unit: '%', dir: 'min', target: 96, step: 0.5, fix: 'Review the grace period and the S$20 fee. Check whether the fee is backfiring.', info: 'Share returned within 4 days. Everything else counts as lost.',
        weeks: { week4: [93, 95, 96.2, 96.8], strong: [96, 97.4, 98.1, 98.6], slip: [91, 89, 87, 85] } },
    ],
  },
  {
    id: 'ops',
    name: 'Operations',
    question: 'Can stalls, collection and washing cope without disrupting lunch service?',
    metrics: [
      { id: 'secs', name: 'Seconds added per order', unit: 's', dir: 'max', target: 10, step: 1, fix: 'Pre-stack containers at the counter and keep the tap-to-borrow step to one tap.', info: 'Measured at the stall during the 12:00–13:30 rush.',
        weeks: { week4: [14, 11, 9, 8], strong: [11, 8, 7, 6], slip: [15, 14, 13, 13] } },
      { id: 'stock', name: 'Lunch stock-outs per week', unit: '', dir: 'max', target: 2, step: 1, fix: 'Raise reserve stock for the busy stall’s pool and adjust the lunch forecast.', info: 'Times a stall ran out of its pool’s containers before 14:00.',
        weeks: { week4: [5, 3, 2, 1], strong: [3, 1, 1, 0], slip: [6, 5, 5, 4] } },
      { id: 'fill', name: 'Bin fill at pickup', unit: '%', dir: 'min', target: 70, step: 1, fix: 'Collect only when bins are full, and merge or drop the quietest point.', info: 'Average fill when staff empty a bin. Low means trips for half-full bins.',
        weeks: { week4: [52, 61, 66, 68], strong: [64, 72, 76, 79], slip: [48, 51, 50, 49] } },
    ],
  },
  {
    id: 'impact',
    name: 'Impact + cost',
    question: 'Does measured re-use justify the water, energy, transport and financial cost?',
    metrics: [
      { id: 'life', name: 'Average life ÷ break-even uses', unit: '×', dir: 'min', target: 1, step: 0.05, fix: 'Raise the return rate, or choose a container with a lower break-even.', info: 'Above 1× means the average container pays back its footprint.',
        weeks: { week4: [0.6, 0.8, 0.95, 1.1], strong: [0.9, 1.3, 1.6, 1.9], slip: [0.5, 0.45, 0.4, 0.35] } },
      { id: 'water', name: 'Water per container', unit: 'L', dir: 'max', target: 0.8, step: 0.05, fix: 'Share wash runs with dine-in crockery and fill each batch before running it.', info: 'Measured at the wash hub, per container washed.',
        weeks: { week4: [0.9, 0.8, 0.7, 0.65], strong: [0.8, 0.7, 0.6, 0.55], slip: [1.1, 1.2, 1.2, 1.3] } },
      { id: 'cost', name: 'Cost per use vs a disposable', unit: '×', dir: 'max', target: 1.5, step: 0.1, fix: 'Cut collection trips and lost containers, then compare against the agreed budget.', info: 'Containers, staff time, transport, water and energy per use, divided by the cost of one disposable box.',
        weeks: { week4: [2.8, 2.1, 1.8, 1.6], strong: [2.2, 1.6, 1.3, 1.1], slip: [3.0, 3.1, 3.3, 3.5] } },
    ],
  },
];

const PHASES = [
  { n: '01', name: 'Prepare', goal: 'Design and prepare', items: ['Confirm vendors and facilities partners', 'Test food suitability and hygiene SOPs', 'Map the return-and-wash route'] },
  { n: '02', name: 'Pilot', goal: 'Run one contained loop', items: ['1–2 willing stalls, limited menu range', '2–3 strategically placed return points', 'Track returns, washing and staff time'] },
  { n: '03', name: 'Review', goal: 'Refine or stop', items: ['Survey students and vendors', 'Compare actual cost and resource use', 'Fix bottlenecks before expansion'] },
];
const DEFAULT_CHECKS = [true, true, true, true, true, false, false, false, false];
const STORE_KEY = 'reloop-checklist-v1';

const statusOf = (v: number, target: number, dir: Dir): Status => {
  const ok = dir === 'min' ? v >= target : v <= target;
  if (ok) return 'pass';
  const gap = Math.abs(v - target) / Math.max(Math.abs(target), 1e-6);
  return gap <= 0.1 ? 'near' : 'fail';
};
const worst = (s: Status[]): Status => (s.includes('fail') ? 'fail' : s.includes('near') ? 'near' : 'pass');
const pillFor: Record<Status, string> = { pass: 'go', near: 'warn', fail: 'stop' };
const wordFor: Record<Status, string> = { pass: 'On target', near: 'Close', fail: 'Off target' };
const fmt = (v: number, unit: string) => (unit === '×' ? `${v.toFixed(2)}×` : unit === 'L' ? `${v.toFixed(2)} L` : unit === 's' ? `${v}s` : unit === '%' ? `${v}%` : `${v}`);

function Spark({ values, target, dir }: { values: number[]; target: number; dir: Dir }) {
  const W = 120, H = 34, p = 4;
  const lo = Math.min(...values, target), hi = Math.max(...values, target);
  const sy = (v: number) => H - p - ((v - lo) / (hi - lo || 1)) * (H - 2 * p);
  const sx = (i: number) => p + (i / (values.length - 1)) * (W - 2 * p);
  const last = values[values.length - 1];
  const st = statusOf(last, target, dir);
  const col = st === 'pass' ? 'var(--go)' : st === 'near' ? 'var(--warn)' : 'var(--stop)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="trend" role="img" aria-label={`Weeks 1 to 4: ${values.join(', ')}`}>
      <line x1={p} x2={W - p} y1={sy(target)} y2={sy(target)} stroke="var(--ink-3)" strokeDasharray="3 3" />
      <path d={values.map((v, i) => `${i ? 'L' : 'M'}${sx(i)} ${sy(v)}`).join('')} fill="none" stroke="var(--ink)" strokeWidth="1.8" />
      <circle cx={sx(values.length - 1)} cy={sy(last)} r="3.8" fill={col} stroke="var(--paper)" strokeWidth="1.5" />
    </svg>
  );
}

export default function Scorecard() {
  const [scenario, setScenario] = useState<ScenarioId>('week4');
  const [targets, setTargets] = useState<Record<string, number>>(() =>
    Object.fromEntries(CRITERIA.flatMap((c) => c.metrics.map((m) => [m.id, m.target]))),
  );
  const [checks, setChecks] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === 9) return parsed;
    } catch { /* storage unavailable */ }
    return DEFAULT_CHECKS;
  });
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(checks)); } catch { /* storage unavailable */ }
  }, [checks]);

  const results = useMemo(
    () =>
      CRITERIA.map((c) => {
        const ms = c.metrics.map((m) => {
          const v = m.weeks[scenario][3];
          return { m, v, st: statusOf(v, targets[m.id], m.dir) };
        });
        return { c, ms, st: worst(ms.map((x) => x.st)) };
      }),
    [scenario, targets],
  );

  const byId = Object.fromEntries(results.map((r) => [r.c.id, r.st]));
  const anyFail = results.some((r) => r.st === 'fail');
  const anyNear = results.some((r) => r.st === 'near');
  const verdict: 'go' | 'pivot' | 'nogo' = byId.return === 'fail' && byId.impact === 'fail' ? 'nogo' : anyFail || anyNear ? 'pivot' : 'go';
  const fixes = results.flatMap((r) => r.ms.filter((x) => x.st !== 'pass').map((x) => x.m.fix));

  const phaseDone = PHASES.map((_, i) => checks.slice(i * 3, i * 3 + 3).filter(Boolean).length);
  const current = phaseDone.findIndex((d) => d < 3);

  return (
    <>
      <div className="view-head">
        <div>
          <p className="kicker">Pilot scorecard <span className="owner">· implementation</span></p>
          <h1 className="display">Scale only when the evidence says go</h1>
        </div>
        <p className="lede">Start small: prepare, then one contained pilot loop, then review. The scorecard compares four weeks of pilot data against targets agreed before launch.</p>
      </div>

      <section className="roadmap" aria-label="Pilot roadmap">
        {PHASES.map((ph, pi) => (
          <div key={ph.n} className={`phase ${pi === current ? 'current' : ''}`}>
            <div className="phase-top">
              <span className="n">{ph.n}</span>
              <span className={`pill ${phaseDone[pi] === 3 ? 'go' : pi === current ? 'warn' : 'sim'}`}>
                {phaseDone[pi] === 3 ? 'Done' : pi === current ? 'In progress' : 'Not started'}
              </span>
            </div>
            <h3>{ph.name}</h3>
            <p className="goal">{ph.goal}</p>
            <div className="progress"><i style={{ width: `${(phaseDone[pi] / 3) * 100}%` }} /></div>
            {ph.items.map((it, ii) => {
              const idx = pi * 3 + ii;
              const id = `chk-${idx}`;
              return (
                <label key={id} htmlFor={id} className={`check ${checks[idx] ? 'done' : ''}`}>
                  <input id={id} type="checkbox" checked={checks[idx]} onChange={() => setChecks((c) => c.map((v, j) => (j === idx ? !v : v)))} />
                  <span>{it}</span>
                </label>
              );
            })}
          </div>
        ))}
      </section>

      <div className="score-layout">
        <div className="criteria">
          <div className="panel-head">
            <h2 className="display" style={{ fontSize: 'var(--step-3)' }}>Four weeks of pilot data</h2>
            <Seg label="Pilot data set" value={scenario} onChange={setScenario}
              options={[{ value: 'week4', label: 'Week 4 result' }, { value: 'strong', label: 'If it goes well' }, { value: 'slip', label: 'If returns slip' }]} />
          </div>
          <p className="range-hint" style={{ marginTop: -16 }}>Simulated data. Targets are editable: change one to see how the decision moves.</p>
          {results.map(({ c, ms, st }, ci) => (
            <section key={c.id} className="criterion">
              <div className="crit-head">
                <h3>
                  <span className="display" style={{ fontSize: '1.5rem' }}>{ci + 1}. {c.name}</span>
                  <small>{c.question}</small>
                </h3>
                <span className={`pill ${pillFor[st]}`}>{wordFor[st]}</span>
              </div>
              <div className="metric metric-head" aria-hidden="true">
                <span>Measure</span><span>Weeks 1–4</span><span>Week 4</span><span>Target</span><span>Status</span>
              </div>
              {ms.map(({ m, v, st: mst }) => (
                <div key={m.id} className="metric">
                  <span className="name">{m.name} <Info>{m.info}</Info></span>
                  <Spark values={m.weeks[scenario]} target={targets[m.id]} dir={m.dir} />
                  <span className="val">{fmt(v, m.unit)}</span>
                  <span className="target">
                    <label htmlFor={`t-${m.id}`}>{m.dir === 'min' ? 'at least' : 'at most'}</label>
                    <input id={`t-${m.id}`} type="number" step={m.step} value={targets[m.id]}
                      onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setTargets((t) => ({ ...t, [m.id]: n })); }} />
                  </span>
                  <span className={`pill ${pillFor[mst]}`} style={{ justifySelf: 'end' }}>{wordFor[mst]}</span>
                </div>
              ))}
            </section>
          ))}
          <button className="btn small ghost" type="button" style={{ justifySelf: 'start' }}
            onClick={() => setTargets(Object.fromEntries(CRITERIA.flatMap((c) => c.metrics.map((m) => [m.id, m.target]))))}>
            Restore agreed targets
          </button>
        </div>

        <aside className={`verdict-card ${verdict}`} aria-live="polite">
          <div className="lights" aria-hidden="true">
            <i className={`g ${verdict === 'go' ? 'on' : ''}`} />
            <i className={`a ${verdict === 'pivot' ? 'on' : ''}`} />
            <i className={`r ${verdict === 'nogo' ? 'on' : ''}`} />
          </div>
          <div className="big">{verdict === 'go' ? 'Go' : verdict === 'pivot' ? 'Pivot' : 'No-go'}</div>
          <p style={{ fontWeight: 700 }}>
            {verdict === 'go' && 'Return, cost and impact targets are met. Extend gradually: one more stall or return point at a time.'}
            {verdict === 'pivot' && 'Some targets are missed. Improve return locations, rules or wash logistics, then retest.'}
            {verdict === 'nogo' && 'Returns and impact both miss their targets. Stop before scaling and record what failed.'}
          </p>
          {fixes.length > 0 && (
            <>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8 }}>What to fix before the next review</span>
              <ul>{fixes.map((f) => <li key={f}>{f}</li>)}</ul>
            </>
          )}
          <p className="final"><b>Final recommendation.</b> Pilot first. Measure honestly. Scale only if the full loop works for both people and the planet.</p>
        </aside>
      </div>
    </>
  );
}
