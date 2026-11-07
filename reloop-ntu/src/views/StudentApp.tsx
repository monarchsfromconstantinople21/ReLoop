import { useEffect, useMemo, useRef, useState } from 'react';
import { Home, ScanLine, Undo2, User, Bell, CheckCircle2, XCircle, Wifi, BatteryFull, Signal, X, MapPin, Clock3, Leaf } from 'lucide-react';
import { CONTAINERS, PILOT_STALLS, RETURN_POINTS, STUDENT_LOCATIONS } from '../data/campus';
import { POOL_LABEL, RULES, type Pool } from '../lib/model';
import { Info } from '../components/ui';

type Screen = 'home' | 'borrow' | 'return' | 'me';

interface Loan {
  tag: string;
  pool: Pool;
  stall: string;
  container: string;
  uses: number; // how many times this physical container has been used
  borrowedAt: number; // absolute demo hour
}

interface LogLine {
  at: number;
  text: string;
}

/* Demo time: hour 0 = Mon 19 Oct 2026, 12:18 (lunch). */
const BASE = new Date(2026, 9, 19, 12, 18);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const stamp = (h: number) => {
  const d = new Date(BASE.getTime() + h * 3600_000);
  return `${DAYS[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const BREAK_EVEN = 20;
const DUE = RULES.reminderHours + RULES.graceHours; // 96 h

const newTag = (pool: Pool) => `RL-${pool === 'halal' ? 'H' : pool === 'veg' ? 'V' : 'N'}-${String(Math.floor(1000 + Math.random() * 8999)).padStart(5, '0')}`;

export default function StudentApp() {
  const [now, setNow] = useState(6); // demo clock, absolute hours
  const [loan, setLoan] = useState<Loan | null>({ tag: 'RL-H-04217', pool: 'halal', stall: 'Mixed rice stall', container: 'Rice box', uses: 14, borrowedAt: 0 });
  const [screen, setScreen] = useState<Screen>('home');
  const [stats, setStats] = useState({ borrowed: 9, onTime: 8, grace: 0, fees: 0 });
  const [log, setLog] = useState<LogLine[]>([
    { at: 0, text: 'Container RL-H-04217 (halal pool) linked to your NTU pass at the mixed rice stall.' },
    { at: 0.05, text: 'Return-by time set: reminder Wed 12:18, grace until Fri 12:18.' },
  ]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  const elapsed = loan ? now - loan.borrowedAt : 0;
  const addLog = (text: string, at = now) => setLog((l) => [{ at, text }, ...l].slice(0, 30));

  // System events fire as the demo clock crosses the safeguard thresholds.
  useEffect(() => {
    if (!loan) return;
    const key = (k: string) => `${loan.tag}:${k}`;
    if (elapsed >= RULES.reminderHours && !firedRef.current.has(key('remind'))) {
      firedRef.current.add(key('remind'));
      addLog(`Reminder pushed to NTU pass app for ${loan.tag}. Grace period started (2 days).`, loan.borrowedAt + RULES.reminderHours);
    }
    if (elapsed >= DUE && !firedRef.current.has(key('fee'))) {
      firedRef.current.add(key('fee'));
      addLog(`Not returned after grace period. S$${RULES.fee} replacement fee charged for ${loan.tag}.`, loan.borrowedAt + DUE);
      setStats((s) => ({ ...s, fees: s.fees + RULES.fee }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, loan]);

  const notif = useMemo(() => {
    if (!loan) return null;
    if (elapsed >= DUE) return { id: `${loan.tag}:fee`, title: `S$${RULES.fee} fee charged`, body: `${loan.container} ${loan.tag} was not returned by ${stamp(loan.borrowedAt + DUE)}. You can still return it to any point.`, tone: 'stop' };
    if (elapsed >= RULES.reminderHours) return { id: `${loan.tag}:remind`, title: 'Time to return your container', body: `Drop your ${loan.container.toLowerCase()} at any ReLoop point by ${stamp(loan.borrowedAt + DUE)} to avoid the S$${RULES.fee} fee. NS bus stop is 3 min away.`, tone: 'warn' };
    return null;
  }, [loan, elapsed]);
  const showNotif = notif && !dismissed.includes(notif.id);

  const status = !loan ? null : elapsed >= DUE ? 'fee' : elapsed >= RULES.reminderHours ? 'grace' : 'ok';

  /* ---------- borrow ---------- */
  const [stallId, setStallId] = useState(PILOT_STALLS[1].id);
  const [containerId, setContainerId] = useState('bowl');
  const [borrowStep, setBorrowStep] = useState<'choose' | 'scan' | 'done'>('choose');

  const doBorrow = () => {
    setBorrowStep('scan');
    window.setTimeout(() => {
      const stall = PILOT_STALLS.find((s) => s.id === stallId)!;
      const c = CONTAINERS.find((x) => x.id === containerId)!;
      const tag = newTag(stall.pool);
      const l: Loan = { tag, pool: stall.pool, stall: stall.name, container: c.name, uses: 3 + Math.floor(Math.random() * 15), borrowedAt: now };
      setLoan(l);
      setStats((s) => ({ ...s, borrowed: s.borrowed + 1 }));
      addLog(`Container ${tag} (${POOL_LABEL[stall.pool].toLowerCase()} pool) linked to your NTU pass at the ${stall.name.toLowerCase()}.`);
      setBorrowStep('done');
    }, 1300);
  };

  /* ---------- return ---------- */
  const [where, setWhere] = useState('lt');
  const [pointId, setPointId] = useState<string | null>(null);
  const [returnStep, setReturnStep] = useState<'choose' | 'chute' | 'scan' | 'ok' | 'bad'>('choose');
  const [chute, setChute] = useState<Pool>('halal');
  const [lastReturn, setLastReturn] = useState<{ tag: string; late: 'ok' | 'grace' | 'fee'; point: string } | null>(null);
  const pilotPoints = useMemo(
    () => RETURN_POINTS.filter((p) => p.pilot).sort((a, b) => (a.walk[where] ?? 99) - (b.walk[where] ?? 99)),
    [where],
  );
  const fill = (id: string, pool: Pool) => {
    // simulated chute fill, rising through the day
    const base = { nsfc: 0.62, lwn: 0.34, nsbus: 0.48 }[id] ?? 0.4;
    const hour = (12.3 + now) % 24;
    const dayShape = hour < 8 ? 0.1 : Math.min(1, (hour - 8) / 10);
    return Math.min(0.97, base * (pool === 'halal' ? 1 : 0.7) * (0.5 + dayShape));
  };

  const doReturn = (c: Pool) => {
    if (!loan || !pointId) return;
    setChute(c);
    setReturnStep('scan');
    window.setTimeout(() => {
      const point = RETURN_POINTS.find((p) => p.id === pointId)!;
      if (c !== loan.pool) {
        setReturnStep('bad');
        addLog(`Chute at ${point.short} rejected ${loan.tag}: ${POOL_LABEL[loan.pool].toLowerCase()} container offered to the ${POOL_LABEL[c].toLowerCase()} chute. Pools kept separate.`);
        return;
      }
      const late = elapsed >= DUE ? 'fee' : elapsed >= RULES.reminderHours ? 'grace' : 'ok';
      setStats((s) => ({ ...s, onTime: s.onTime + (late === 'ok' ? 1 : 0), grace: s.grace + (late === 'grace' ? 1 : 0) }));
      addLog(`${loan.tag} returned at ${point.short} (${POOL_LABEL[loan.pool].toLowerCase()} chute). Queued for the next collection to the wash hub.`);
      setLastReturn({ tag: loan.tag, late, point: point.name });
      setLoan(null);
      setReturnStep('ok');
    }, 1200);
  };

  const goScreen = (s: Screen) => {
    setScreen(s);
    if (s === 'borrow' && borrowStep !== 'scan') setBorrowStep('choose');
    if (s === 'return' && returnStep !== 'scan') {
      setReturnStep(loan ? (pointId ? 'chute' : 'choose') : returnStep === 'ok' ? 'ok' : 'choose');
    }
  };

  const ringPct = loan ? Math.min(1, elapsed / DUE) : 0;
  const ringColor = status === 'fee' ? 'var(--stop)' : status === 'grace' ? 'var(--warn)' : 'var(--teal)';
  const remaining = loan ? Math.max(0, DUE - elapsed) : 0;

  const setClock = (h: number) => setNow(Math.max(0, Math.round(h)));
  const clockRel = loan ? elapsed : 0;

  return (
    <div className="student">
      {/* left: what the student sees and why */}
      <div className="side-col">
        <div>
          <p className="kicker">
            Student app <span className="owner">· inside the NTU pass app</span>
          </p>
          <h2 className="display">Borrowing should take one tap</h2>
        </div>
        <p className="lede">
          The implementation slide asks for quick borrowing, convenient returns and rules students understand. The phone shows that flow. The
          rules below are the safeguards from our slides.
        </p>
        <div className="rules">
          <div className="rule">
            <span className="k num">48h</span>
            <p>
              <b>Return reminder</b> on the NTU pass app, 48 hours after borrowing.
            </p>
          </div>
          <div className="rule">
            <span className="k num">+2d</span>
            <p>
              <b>Grace period</b> of two more days. No penalty yet.
            </p>
          </div>
          <div className="rule">
            <span className="k num">$20</span>
            <p>
              <b>Small fee</b> if the container is still not returned. It covers a replacement and reserve stock.
            </p>
          </div>
        </div>
        <p className="range-hint" style={{ fontSize: '0.84rem' }}>
          Our concern slide warns that late fees can backfire and lower return rates. The pilot tracks returns made during the grace period
          separately, so we can see whether the fee helps or hurts.
        </p>
      </div>

      {/* centre: phone */}
      <div className="phone" aria-label="Student app prototype">
        <div className="screen">
          <div className="island" />
          <div className="status-bar num">
            <span>{stamp(now).split(' ')[1]}</span>
            <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <Signal size={13} /> <Wifi size={13} /> <BatteryFull size={16} />
            </span>
          </div>

          {showNotif && notif && (
            <div className="notif" role="status">
              <span className="ico" style={{ background: notif.tone === 'stop' ? 'var(--stop)' : 'var(--teal)' }}>
                <Bell size={16} color="#fff" />
              </span>
              <span>
                <b>NTU pass · ReLoop</b>
                <b>{notif.title}</b>
                {notif.body}
              </span>
              <button type="button" aria-label="Dismiss notification" onClick={() => setDismissed((d) => [...d, notif.id])}>
                <X size={14} />
              </button>
            </div>
          )}

          <div className="app-head">
            <div>
              <div className="t">{{ home: 'ReLoop', borrow: 'Borrow', return: 'Return', me: 'My loop' }[screen]}</div>
              <div className="s">{stamp(now)} · pilot: North Spine</div>
            </div>
            <span className="pill sim">Simulated</span>
          </div>

          <div className="app-body">
            {screen === 'home' && (
              <>
                {loan ? (
                  <>
                    <div className="card borrow-card">
                      <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="var(--paper-2)" strokeWidth="9" />
                        <circle
                          cx="48" cy="48" r="40" fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - ringPct)}`}
                          transform="rotate(-90 48 48)" style={{ transition: 'stroke-dashoffset .5s, stroke .3s' }}
                        />
                        <foreignObject x="10" y="26" width="76" height="46">
                          <div style={{ textAlign: 'center' }}>
                            <div className="ring-num num">{status === 'fee' ? 'Late' : `${Math.floor(remaining / 24)}d ${Math.round(remaining % 24)}h`}</div>
                            <div className="ring-sub">{status === 'fee' ? 'fee charged' : 'to return'}</div>
                          </div>
                        </foreignObject>
                      </svg>
                      <div className="stack" style={{ gap: 4 }}>
                        <span className="mini-label">Container out</span>
                        <b style={{ fontSize: '1rem' }}>{loan.container}</b>
                        <span className="num" style={{ fontSize: '0.78rem', color: 'var(--ink-2)' }}>{loan.tag} · {loan.stall}</span>
                        <span className={`pill ${loan.pool}`} style={{ justifySelf: 'start' }}>{POOL_LABEL[loan.pool]} pool</span>
                      </div>
                    </div>
                    <div className="card">
                      <div className="timeline">
                        <div className="tl done">
                          <span className="d" />
                          <span><b>Borrowed</b>{stamp(loan.borrowedAt)}</span>
                        </div>
                        <div className={`tl ${elapsed >= RULES.reminderHours ? 'done' : 'now'}`}>
                          <span className="d" />
                          <span><b>Reminder</b>{stamp(loan.borrowedAt + RULES.reminderHours)} · 48 h</span>
                        </div>
                        <div className={`tl ${elapsed >= DUE ? 'late' : elapsed >= RULES.reminderHours ? 'now' : ''}`}>
                          <span className="d" />
                          <span><b>Grace ends</b>{stamp(loan.borrowedAt + DUE)} · then S${RULES.fee} fee</span>
                        </div>
                      </div>
                    </div>
                    <button className="btn teal" type="button" onClick={() => goScreen('return')}>
                      <Undo2 size={16} /> Return container
                    </button>
                  </>
                ) : (
                  <div className="card tinted stack">
                    <b>No containers out</b>
                    <span style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>Ask for a ReLoop container at a pilot stall and tap your NTU pass.</span>
                    <button className="btn" type="button" onClick={() => goScreen('borrow')}>
                      <ScanLine size={16} /> Borrow a container
                    </button>
                  </div>
                )}
                <div className="card stack">
                  <span className="mini-label">Pilot stalls today</span>
                  {PILOT_STALLS.map((s) => (
                    <div className="row" key={s.id} style={{ fontSize: '0.84rem' }}>
                      <span><b>{s.name}</b><br /><span style={{ color: 'var(--ink-2)', fontSize: '0.76rem' }}>{s.menu.join(', ')}</span></span>
                      <span className={`pill ${s.pool}`}>{POOL_LABEL[s.pool]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {screen === 'borrow' && (
              <>
                {loan && borrowStep !== 'done' ? (
                  <div className="card tinted stack">
                    <b>You already have a container out</b>
                    <span style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>The pilot lends one container per student at a time. Return {loan.tag} first.</span>
                    <button className="btn teal" type="button" onClick={() => goScreen('return')}>Return container</button>
                  </div>
                ) : borrowStep === 'choose' ? (
                  <>
                    <span className="mini-label">1. Which stall?</span>
                    <div className="stack">
                      {PILOT_STALLS.map((s) => (
                        <button key={s.id} type="button" className="choice" aria-pressed={stallId === s.id} onClick={() => { setStallId(s.id); setContainerId(s.id === 'rice' ? 'box' : 'bowl'); }}>
                          <span className="t">{s.name}</span>
                          <span className={`pill ${s.pool}`}>{POOL_LABEL[s.pool]}</span>
                          <span className="s">{s.where}</span>
                        </button>
                      ))}
                    </div>
                    <span className="mini-label">2. Container</span>
                    <div className="stack">
                      {CONTAINERS.map((c) => (
                        <button key={c.id} type="button" className="choice" aria-pressed={containerId === c.id} onClick={() => setContainerId(c.id)}>
                          <span className="t">{c.name}</span>
                          <span className="num" style={{ fontSize: '0.78rem', fontWeight: 700 }}>{c.size}</span>
                          <span className="s">{c.note}</span>
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--ink-2)' }}>
                      Free to borrow. Return within 48 hours, or 4 days with grace. S${RULES.fee} if it never comes back.
                    </p>
                    <button className="btn" type="button" onClick={doBorrow}>
                      <ScanLine size={16} /> Tap NTU pass to borrow
                    </button>
                  </>
                ) : borrowStep === 'scan' ? (
                  <div className="scan-box">
                    <span className="frame" />
                    <span className="laser" />
                    <span style={{ position: 'relative', marginTop: '62%' }}>Reading container tag…</span>
                  </div>
                ) : (
                  loan && (
                    <>
                      <div className="result ok">
                        <span className="h"><CheckCircle2 size={20} color="var(--teal)" /> Borrowed</span>
                        <p>
                          {loan.container} <b className="num">{loan.tag}</b> is linked to your NTU pass. Enjoy your meal.
                        </p>
                        <span className={`pill ${loan.pool}`} style={{ justifySelf: 'start' }}>{POOL_LABEL[loan.pool]} pool</span>
                      </div>
                      <div className="card" style={{ fontSize: '0.8rem' }}>
                        Reminder <b>{stamp(loan.borrowedAt + RULES.reminderHours)}</b>. Return anywhere on the pilot route by <b>{stamp(loan.borrowedAt + DUE)}</b>.
                      </div>
                      <button className="btn ghost" type="button" onClick={() => goScreen('home')}>Done</button>
                    </>
                  )
                )}
              </>
            )}

            {screen === 'return' && (
              <>
                {!loan && returnStep !== 'ok' && (
                  <div className="card tinted stack">
                    <b>Nothing to return</b>
                    <span style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>You have no containers out right now.</span>
                    <button className="btn" type="button" onClick={() => goScreen('borrow')}>Borrow a container</button>
                  </div>
                )}
                {loan && returnStep === 'choose' && (
                  <>
                    <span className="mini-label">You are near</span>
                    <div className="seg" role="group" aria-label="Your location" style={{ flexWrap: 'wrap', borderRadius: 14 }}>
                      {STUDENT_LOCATIONS.map((l) => (
                        <button key={l.id} type="button" aria-pressed={where === l.id} onClick={() => setWhere(l.id)} style={{ fontSize: '0.74rem', padding: '5px 9px' }}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                    <span className="mini-label">Nearest return points</span>
                    {pilotPoints.map((p) => (
                      <button key={p.id} type="button" className="choice" onClick={() => { setPointId(p.id); setReturnStep('chute'); }}>
                        <span className="t">{p.short}</span>
                        <span className="num" style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
                          <MapPin size={12} /> {p.walk[where]} min
                        </span>
                        <span className="s" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {(['halal', 'general'] as Pool[]).map((pool) => (
                            <span key={pool}>
                              {POOL_LABEL[pool]} chute {Math.round(fill(p.id, pool) * 100)}%
                              <span className="chute-bar"><i style={{ width: `${fill(p.id, pool) * 100}%`, background: pool === 'halal' ? 'var(--teal)' : 'var(--peach)' }} /></span>
                            </span>
                          ))}
                        </span>
                      </button>
                    ))}
                    {where === 'hall' && (
                      <p style={{ fontSize: '0.74rem', color: 'var(--ink-2)' }}>
                        Heading home? The bus stop point sits on the Campus Loop route, so commuters can drop off before boarding.
                      </p>
                    )}
                  </>
                )}
                {loan && returnStep === 'chute' && pointId && (
                  <>
                    <div className="card stack">
                      <span className="mini-label">At {RETURN_POINTS.find((p) => p.id === pointId)?.short}</span>
                      <span style={{ fontSize: '0.84rem' }}>
                        Your container is in the <b>{POOL_LABEL[loan.pool].toLowerCase()}</b> pool. Hold it to the matching chute.
                      </span>
                    </div>
                    <button type="button" className="choice" onClick={() => doReturn('halal')} style={{ borderColor: 'var(--teal)' }}>
                      <span className="t">Halal chute</span>
                      <span className="pill halal">Green ring</span>
                      <span className="s">For containers from halal stalls only</span>
                    </button>
                    <button type="button" className="choice" onClick={() => doReturn('general')} style={{ borderColor: 'var(--peach)' }}>
                      <span className="t">Non-halal chute</span>
                      <span className="pill general">Orange ring</span>
                      <span className="s">All other pilot stalls</span>
                    </button>
                    <button className="btn ghost small" type="button" onClick={() => setReturnStep('choose')}>Choose another point</button>
                  </>
                )}
                {returnStep === 'scan' && (
                  <div className="scan-box">
                    <span className="frame" />
                    <span className="laser" />
                    <span style={{ position: 'relative', marginTop: '62%' }}>Checking tag at {POOL_LABEL[chute].toLowerCase()} chute…</span>
                  </div>
                )}
                {loan && returnStep === 'bad' && (
                  <>
                    <div className="result bad">
                      <span className="h"><XCircle size={20} color="var(--stop)" /> Chute stayed closed</span>
                      <p>
                        {loan.tag} belongs to the {POOL_LABEL[loan.pool].toLowerCase()} pool. The {POOL_LABEL[chute].toLowerCase()} chute only opens for its own
                        containers, so the two pools never mix. Colour coding alone is not enough.
                      </p>
                    </div>
                    <button className="btn teal" type="button" onClick={() => doReturn(loan.pool)}>
                      Use the {POOL_LABEL[loan.pool].toLowerCase()} chute
                    </button>
                  </>
                )}
                {returnStep === 'ok' && lastReturn && (
                  <>
                    <div className="result ok">
                      <span className="h"><CheckCircle2 size={20} color="var(--teal)" /> Returned</span>
                      <p>
                        {lastReturn.tag} is in the bin at {lastReturn.point}. It goes to the wash hub on the next collection.
                        {lastReturn.late === 'ok' && ' Returned on time.'}
                        {lastReturn.late === 'grace' && ' Returned in the grace period: no fee.'}
                        {lastReturn.late === 'fee' && ` The S$${RULES.fee} fee already charged stays, but the container is back in the loop.`}
                      </p>
                    </div>
                    <button className="btn" type="button" onClick={() => { setBorrowStep('choose'); setReturnStep('choose'); setPointId(null); goScreen('borrow'); }}>
                      Borrow again
                    </button>
                  </>
                )}
              </>
            )}

            {screen === 'me' && (
              <>
                <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['Borrowed', stats.borrowed],
                    ['Returned on time', stats.onTime],
                    ['Returned in grace', stats.grace],
                    ['Fees paid', `S$${stats.fees}`],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <div className="mini-label">{k}</div>
                      <div className="ring-num num" style={{ fontSize: '1.7rem' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {loan && (
                  <div className="card stack">
                    <span className="mini-label">The container you have</span>
                    <span style={{ fontSize: '0.84rem' }}>
                      {loan.tag} is on use <b className="num">{loan.uses}</b>. It starts beating a disposable around use {BREAK_EVEN}.
                      <Info>Break-even for a light PP box in our lab model. LCA studies cited in our slides range from about 4 to 200+ uses.</Info>
                    </span>
                    <div className="progress"><i style={{ width: `${Math.min(100, (loan.uses / BREAK_EVEN) * 100)}%` }} /></div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--ink-2)' }}>
                      {loan.uses >= BREAK_EVEN ? 'Past break-even. Every return now saves a disposable.' : `${BREAK_EVEN - loan.uses} more loops to pay back its footprint. Losing it now wastes it.`}
                    </span>
                  </div>
                )}
                <div className="card tinted stack" style={{ fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><Leaf size={15} /> Why returns matter</span>
                  A reusable container only beats a disposable after enough uses. A lost one ends up worse than the disposable it replaced.
                </div>
              </>
            )}
          </div>

          <nav className="tabbar" aria-label="App tabs">
            {([
              ['home', Home, 'Home'],
              ['borrow', ScanLine, 'Borrow'],
              ['return', Undo2, 'Return'],
              ['me', User, 'My loop'],
            ] as const).map(([id, I, label]) => (
              <button key={id} type="button" aria-current={screen === id ? 'page' : undefined} onClick={() => goScreen(id)}>
                <I size={20} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* right: demo controls + what the system did */}
      <div className="side-col right">
        <div className="clock">
          <div className="row">
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: '0.86rem' }}>
              <Clock3 size={16} /> Demo clock
            </span>
            <span className="pill" style={{ background: 'rgba(242,244,211,.14)', color: 'var(--paper)' }}>Presenter control</span>
          </div>
          <div>
            <div className="big num">{stamp(now)}</div>
            <div style={{ fontSize: '0.84rem', opacity: 0.85 }}>
              {loan ? `${Math.floor(clockRel / 24)} days ${Math.round(clockRel % 24)} h since borrowing` : 'No container out. Borrow one to start the timer.'}
            </div>
          </div>
          <label htmlFor="demo-clock" className="sr-only" style={{ position: 'absolute', left: -9999 }}>Hours since borrowing</label>
          <input
            id="demo-clock" type="range" min={0} max={120} step={1} value={Math.min(120, clockRel)} disabled={!loan}
            onChange={(e) => loan && setClock(loan.borrowedAt + Number(e.target.value))}
          />
          <div className="clock-track" aria-hidden="true">
            <span style={{ left: '0%', transform: 'none' }}>Borrow</span>
            <span style={{ left: `${(48 / 120) * 100}%` }}>48h reminder</span>
            <span style={{ left: `${(96 / 120) * 100}%` }}>Fee</span>
          </div>
          <div className="clock-btns">
            <button type="button" disabled={!loan} onClick={() => setClock(now + 12)}>+12 h</button>
            <button type="button" disabled={!loan} onClick={() => loan && setClock(loan.borrowedAt + 49)}>Jump to reminder</button>
            <button type="button" disabled={!loan} onClick={() => loan && setClock(loan.borrowedAt + 97)}>Jump past grace</button>
            <button type="button" onClick={() => {
              setNow(6); setLoan({ tag: 'RL-H-04217', pool: 'halal', stall: 'Mixed rice stall', container: 'Rice box', uses: 14, borrowedAt: 0 });
              setScreen('home'); setReturnStep('choose'); setBorrowStep('choose'); setPointId(null); setDismissed([]); firedRef.current = new Set();
              setStats({ borrowed: 9, onTime: 8, grace: 0, fees: 0 });
              setLog([{ at: 0, text: 'Demo reset. RL-H-04217 (halal pool) linked to your NTU pass at the mixed rice stall.' }]);
            }}>Reset demo</button>
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', gap: 8, alignItems: 'center' }}>
            What the system did <Info>In a real pilot these events come from the NTU pass app, the stall tablet and the chute readers. Here they are generated in your browser.</Info>
          </h3>
          <div className="event-log" aria-live="polite">
            {log.map((l, i) => (
              <div key={i}>
                <time>{stamp(l.at)}</time>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
