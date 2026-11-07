import { useMemo, useState } from 'react';
import LineChart from '../components/LineChart';
import { Info, Range, Seg } from '../components/ui';
import {
  MATERIALS, WASH, collectionTrips, avgFillAtPickup, expectedLifetimeUses, fleetSize, returnRateForPoints, shareSurviving, survivalPerLoop, washRunsPerDay,
} from '../lib/model';

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const OPERATING_DAYS = 22; // teaching days per month

export default function Lab() {
  const [materialId, setMaterialId] = useState('pp');
  const [breakEven, setBreakEven] = useState(20);
  const [unitCost, setUnitCost] = useState(1.8);
  const [returnRate, setReturnRate] = useState(0.95);
  const [damage, setDamage] = useState(0.01);
  const [borrows, setBorrows] = useState(300);
  const [pools, setPools] = useState(2);
  const [points, setPoints] = useState(3);

  const s = survivalPerLoop(returnRate, damage);
  const life = expectedLifetimeUses(returnRate, damage);
  const reach = shareSurviving(breakEven, returnRate, damage);
  const neededReturn = Math.min(1, (1 - 1 / breakEven) / (1 - damage));
  const lostPerMonth = borrows * (1 - s) * OPERATING_DAYS;
  const ratio = life / breakEven;
  const verdict = ratio >= 1 ? 'go' : ratio >= 0.6 ? 'warn' : 'stop';

  const survival = useMemo(() => {
    const xMax = Math.min(250, Math.max(40, Math.ceil(breakEven * 2.2)));
    const step = Math.max(1, Math.round(xMax / 120));
    const pts = [];
    for (let k = 0; k <= xMax; k += step) pts.push({ x: k, y: shareSurviving(k, returnRate, damage) * 100 });
    if (pts[pts.length - 1].x !== xMax) pts.push({ x: xMax, y: shareSurviving(xMax, returnRate, damage) * 100 });
    return { pts, xMax };
  }, [breakEven, returnRate, damage]);
  const xTicks = useMemo(() => {
    const n = 5;
    const raw = survival.xMax / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const stepT = [1, 2, 5, 10].map((k) => k * mag).find((k) => k >= raw) ?? raw;
    const out = [];
    for (let v = 0; v <= survival.xMax; v += stepT) out.push(v);
    return out;
  }, [survival.xMax]);

  const pointCurve = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: i + 1, y: returnRateForPoints(i + 1) * 100 })), []);
  const tripCurves = useMemo(
    () =>
      (['fixed', 'full'] as const).map((md) =>
        Array.from({ length: 16 }, (_, i) => ({ x: i + 1, y: collectionTrips(i + 1, borrows * returnRateForPoints(i + 1), md) })),
      ),
    [borrows],
  );
  const tripMax = Math.max(...tripCurves.flat().map((p) => p.y));
  const tripTop = Math.ceil(tripMax / 10) * 10 || 10;
  const rrAtPoints = returnRateForPoints(points);
  const dailyRet = borrows * rrAtPoints;

  const poolRows = [1, 2, 3].map((p) => {
    const runs = washRunsPerDay(borrows * returnRate, p);
    return { p, fleet: fleetSize(borrows, p), runs, water: (runs * WASH.litresPerRun) / (borrows * returnRate) };
  });

  const pickMaterial = (id: string) => {
    const mt = MATERIALS.find((x) => x.id === id)!;
    setMaterialId(id);
    setBreakEven(mt.breakEven);
    setUnitCost(mt.unitCost);
  };

  return (
    <>
      <div className="view-head">
        <div>
          <p className="kicker">Break-even lab <span className="owner">· why washing and collection break</span></p>
          <h1 className="display">Does a container ever pay back?</h1>
        </div>
        <p className="lede">
          A reusable container only beats a disposable after enough uses. LCA studies put that at about 4 to 200+ uses. Every lost container resets
          the count, so the return rate decides almost everything.
        </p>
      </div>

      <div className="lab">
        <aside className="controls" aria-label="Model inputs">
          <fieldset>
            <legend>Container</legend>
            <div className="preset-row" role="group" aria-label="Container material">
              {MATERIALS.map((mt) => (
                <button key={mt.id} type="button" aria-pressed={materialId === mt.id} onClick={() => pickMaterial(mt.id)}>
                  {mt.name}
                  <span>~{mt.breakEven} uses · S${mt.unitCost.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <Range id="be" label="Break-even uses" value={breakEven} min={4} max={200} onChange={(v) => { setBreakEven(v); setMaterialId(''); }}
              info="Uses needed before a reusable has a lower footprint than the disposables it replaces. Our slides cite 4 to 200+ from LCA studies; the pilot should measure it for NTU's washing set-up." />
          </fieldset>
          <fieldset>
            <legend>Behaviour and handling</legend>
            <Range id="rr" label="Return rate" value={returnRate} min={0.6} max={0.995} step={0.005} onChange={setReturnRate} format={(v) => pct(v, 1)}
              hint={`Needed to break even: ${neededReturn >= 1 ? 'over 100%, not reachable' : pct(neededReturn, 1)}`}
              info="Share of borrowed containers that come back at all, including the grace period." />
            <Range id="dmg" label="Retired at inspection" value={damage} min={0} max={0.05} step={0.0025} onChange={setDamage} format={(v) => pct(v, 1)}
              info="Containers cracked, stained or warped by high-temperature washing." />
          </fieldset>
          <fieldset>
            <legend>Scale</legend>
            <Range id="borrows" label="Borrows per day" value={borrows} min={100} max={3000} step={50} onChange={setBorrows} format={(v) => v.toLocaleString()}
              hint="Pilot with 1–2 stalls is around 300. NTU serves up to 30,000 people a day." />
            <div className="range">
              <div className="range-top">
                <span style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                  Separate pools <Info>Halal, non-halal and vegetarian containers kept apart in return, washing, storage and redistribution.</Info>
                </span>
              </div>
              <Seg label="Separate pools" value={pools} onChange={setPools} options={[{ value: 1, label: 'One' }, { value: 2, label: 'Halal + non-halal' }, { value: 3, label: '+ vegetarian' }]} />
            </div>
          </fieldset>
          <p className="assume">
            Illustrative model. Material presets, wash figures and the return-point curve are placeholders inside the ranges in our slides. The pilot
            replaces them with measured NTU data.
          </p>
        </aside>

        <div style={{ minWidth: 0 }}>
          <section className="verdict-band" aria-live="polite">
            <div className="verdict-main">
              <span className={`pill ${verdict}`} style={{ justifySelf: 'start' }}>
                {verdict === 'go' ? 'Beats disposables on average' : verdict === 'warn' ? 'Close, not there yet' : 'Worse than disposables on average'}
              </span>
              <p className="msg">
                A container is used about {Number.isFinite(life) ? Math.round(life) : 'hundreds of'} times before it is lost or retired. It needs {breakEven} to beat a
                disposable.
              </p>
            </div>
            <div>
              <div className="lab">Average life</div>
              <div className="big num">{Number.isFinite(life) ? Math.round(life) : '∞'}</div>
              <div className="sub">uses per container</div>
            </div>
            <div>
              <div className="lab">Reach break-even <Info>Share of containers still in service at use {breakEven}.</Info></div>
              <div className="big num">{pct(reach)}</div>
              <div className="sub">of containers</div>
            </div>
            <div>
              <div className="lab">Replaced per month</div>
              <div className="big num">{Math.round(lostPerMonth).toLocaleString()}</div>
              <div className="sub">S${Math.round(lostPerMonth * unitCost).toLocaleString()} in new stock</div>
            </div>
          </section>

          <div className="chart-block">
            <h3>How many containers are still in the loop after each use</h3>
            <p className="cap">
              Each loop, {pct(s, 1)} of containers survive ({pct(returnRate, 1)} returned × {pct(1 - damage, 1)} pass inspection). The shaded area is the
              share that lives long enough to pay back its footprint.
            </p>
            <LineChart
              ariaLabel={`Survival curve. ${pct(reach)} of containers reach use ${breakEven}.`}
              series={[{ name: 'In service', color: 'var(--ink)', points: survival.pts }]}
              shade={{ from: breakEven, seriesIndex: 0, color: 'var(--teal)' }}
              xDomain={[0, survival.xMax]}
              yDomain={[0, 100]}
              xTicks={xTicks}
              yTicks={[0, 25, 50, 75, 100]}
              yFormat={(v) => `${v}%`}
              xLabel="Uses"
              markers={[
                { x: breakEven, label: `Break-even: use ${breakEven}`, color: 'var(--teal)', align: life > breakEven || breakEven > survival.xMax * 0.75 ? 'end' : 'start' },
                ...(Number.isFinite(life) && life <= survival.xMax && Math.abs(life - breakEven) >= 1
                  ? [{ x: life, label: `Average life: ${Math.round(life)}`, dash: true, color: 'var(--stop)', align: life > breakEven ? ('start' as const) : ('end' as const), row: 1 }]
                  : []),
              ]}
              snap={(v) => Math.round(v)}
              tooltip={(x) => (
                <>
                  <b>Use {Math.round(x)}</b>
                  <br />
                  {pct(shareSurviving(Math.round(x), returnRate, damage), 1)} of containers still in service
                </>
              )}
            />
          </div>

          <div className="chart-block" style={{ marginTop: 40 }}>
            <div className="panel-head">
              <h3>Why collection breaks: the return-point trade-off</h3>
            </div>
            <p className="cap">
              More return points make returning easier, so more containers come back. On a spread-out campus they also mean more collection trips,
              often for half-full bins. Same x-axis, two separate charts.
            </p>
            <div style={{ maxWidth: 420 }}>
              <Range id="points" label="Return points" value={points} min={1} max={16} onChange={setPoints}
                hint={`Return rate ${pct(rrAtPoints, 1)}. Collecting when full: ${collectionTrips(points, dailyRet, 'full')} trips a day, bins ${pct(avgFillAtPickup(points, dailyRet, 'full'))} full at pickup. Fixed rounds: ${collectionTrips(points, dailyRet, 'fixed')} trips, ${pct(avgFillAtPickup(points, dailyRet, 'fixed'))} full.`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              <div style={{ minWidth: 0 }}>
                <p className="mini-label" style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--ink)' }}>Return rate</p>
                <LineChart
                  ariaLabel="Return rate rises with more return points, with diminishing gains"
                  height={260}
                  width={460}
                  series={[{ name: 'Return rate', color: 'var(--teal)', points: pointCurve, area: true }]}
                  xDomain={[1, 16]} yDomain={[50, 100]} xTicks={[1, 4, 8, 12, 16]} yTicks={[50, 75, 100]}
                  yFormat={(v) => `${v}%`} xLabel="Return points"
                  band={{ from: 2, to: 3, label: 'Pilot' }}
                  markers={[{ x: points, label: `${points}`, color: 'var(--ink)' }]}
                  snap={(v) => Math.round(v)}
                  tooltip={(x) => <><b>{Math.round(x)} points</b><br />{pct(returnRateForPoints(Math.round(x)), 1)} returned</>}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="mini-label" style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--ink)' }}>Collection trips per day</p>
                <LineChart
                  ariaLabel="Collection trips per day rise with more return points; fixed rounds rise fastest"
                  height={260}
                  width={460}
                  series={[
                    { name: 'Fixed', color: '#c9773f', points: tripCurves[0], label: true },
                    { name: 'When full', color: 'var(--teal)', points: tripCurves[1], label: true },
                  ]}
                  xDomain={[1, 16]} yDomain={[0, tripTop]} xTicks={[1, 4, 8, 12, 16]} yTicks={[0, tripTop / 2, tripTop]}
                  xLabel="Return points"
                  band={{ from: 2, to: 3, label: 'Pilot' }}
                  markers={[{ x: points, label: `${points}`, color: 'var(--ink)' }]}
                  snap={(v) => Math.round(v)}
                  tooltip={(x) => {
                    const n = Math.round(x);
                    const d = borrows * returnRateForPoints(n);
                    return <><b>{n} points</b><br />Fixed rounds: {collectionTrips(n, d, 'fixed')} trips<br />When full: {collectionTrips(n, d, 'full')} trips</>;
                  }}
                />
              </div>
            </div>
            <button className="btn small ghost" type="button" style={{ justifySelf: 'start' }} onClick={() => setReturnRate(Math.round(rrAtPoints * 200) / 200)}>
              Use {pct(rrAtPoints, 1)} as the return rate above
            </button>
          </div>

          <div className="chart-block" style={{ marginTop: 40 }}>
            <h3>Why washing breaks: the cost of separate pools</h3>
            <p className="cap">
              Oily canteen food needs hot water and strong detergent, and Singapore’s desalinated water and NEWater are energy-intensive. Each pool is
              washed in its own batch, so smaller pools mean part-empty runs.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table" style={{ color: 'var(--ink)', maxWidth: 640 }}>
                <thead>
                  <tr><th>Pools</th><th className="r">Containers needed</th><th className="r">Wash runs a day</th><th className="r">Litres per container</th></tr>
                </thead>
                <tbody>
                  {poolRows.map((r) => (
                    <tr key={r.p} style={{ background: r.p === pools ? 'var(--paper-2)' : undefined, fontWeight: r.p === pools ? 700 : 400 }}>
                      <td style={{ paddingLeft: 8, borderTopColor: 'var(--line)' }}>{r.p === 1 ? 'One shared pool' : r.p === 2 ? 'Halal + non-halal' : 'Halal + non-halal + vegetarian'}</td>
                      <td className="r" style={{ borderTopColor: 'var(--line)' }}>{r.fleet.toLocaleString()}</td>
                      <td className="r" style={{ borderTopColor: 'var(--line)' }}>{r.runs}</td>
                      <td className="r" style={{ borderTopColor: 'var(--line)' }}>{r.water.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="range-hint">
              Assumes a batch washer taking {WASH.rack} containers, {WASH.litresPerRun} L and {WASH.kwhPerRun} kWh per run, with {WASH.collectionsPerDay} collection waves a day.
              One shared pool is shown for comparison only: halal requirements rule it out.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
