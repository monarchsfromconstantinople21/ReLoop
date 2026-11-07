import { useState } from 'react';
import { Brain, Backpack, HandPlatter, Network, Smartphone, Map as MapIcon, FlaskConical, ClipboardCheck } from 'lucide-react';
import Loop, { STAGE_ICONS } from '../components/Loop';
import { Info } from '../components/ui';
import type { ViewId } from '../App';

interface StageInfo {
  id: string;
  name: string;
  owner: string;
  does: string;
  breaks: string[];
  measure: string[];
  source: string;
}

/* Content for each stage is drawn from the slides (presenter noted in `source`). */
const STAGES: StageInfo[] = [
  {
    id: 'borrow',
    name: 'Borrow',
    owner: 'Food stalls',
    does: 'At a pilot stall the student taps their NTU pass. The vendor serves into a tagged container from that stall’s own pool (halal or non-halal).',
    breaks: [
      'Busy stalls run short at the lunch rush while quieter stalls hold unused stock.',
      'Vendors need different sizes, quantities and halal-designated pools.',
    ],
    measure: ['Seconds added per order', 'Lunch stock-outs per week'],
    source: 'Rishaan, Kyra',
  },
  {
    id: 'eat',
    name: 'Eat',
    owner: 'Students',
    does: 'The student eats wherever suits them: at the canteen, in the library, or on the way to class.',
    breaks: [
      'Commuters take food home, so containers leave campus.',
      'People forget. The burden of remembering moves from the box to the student.',
    ],
    measure: ['Share of containers taken off campus', 'Reminder open rate'],
    source: 'An Qi',
  },
  {
    id: 'return',
    name: 'Return',
    owner: 'Students',
    does: 'Return anywhere on the pilot route: food court, library or bus stop. Each point has separate halal and non-halal chutes that read the container tag.',
    breaks: [
      'Fewer return points means students will not walk out of their way, so returns drop.',
      'Late fees can backfire and push return rates down further.',
      'Food residue causes odours and pests if bins overflow.',
    ],
    measure: ['48-hour return rate', 'Returns in the grace period', 'Fees charged'],
    source: 'An Qi, Rishaan',
  },
  {
    id: 'collect',
    name: 'Collect',
    owner: 'Campus operations',
    does: 'Staff collect when a bin is full, not on a fixed round, and bring containers to one washing hub.',
    breaks: [
      'NTU’s campus is spread out, so more points means more trips, often for half-full bins.',
      'Peak-period servicing and clear monitoring responsibility are needed.',
    ],
    measure: ['Collection trips per day', 'Average bin fill at pickup'],
    source: 'Prisha, Rishaan',
  },
  {
    id: 'wash',
    name: 'Wash',
    owner: 'Campus operations',
    does: 'An on-campus hub, shared with dine-in crockery, washes each pool in its own batch at high temperature and checks for damage.',
    breaks: [
      'Oily food like economic rice and curry needs hot water and strong detergent.',
      'Singapore’s desalinated water and NEWater are energy-intensive.',
      'Separate halal and vegetarian fleets mean more wash runs and fewer uses per container.',
    ],
    measure: ['Litres and kWh per container', 'Share retired at inspection'],
    source: 'Prisha',
  },
  {
    id: 'redistribute',
    name: 'Redistribute',
    owner: 'Campus operations',
    does: 'Clean containers go back to stalls by pool, topped up from reserve stock using a lunch forecast.',
    breaks: [
      'Halal and non-halal stock must stay separate in storage and transport.',
      'Forecasting, redistribution and reserve stock add admin, transport and storage cost.',
    ],
    measure: ['Reserve stock held per pool', 'Containers replaced per month'],
    source: 'Kyra, Rishaan',
  },
];

export default function Overview({ go }: { go: (v: ViewId) => void }) {
  const [active, setActive] = useState(2);
  const st = STAGES[active];

  return (
    <>
      <section className="hero">
        <div>
          <p className="kicker">Why a campus-wide reusable container system may not work at NTU</p>
          <h1 className="display">
            It may not work at NTU… <span className="yet">yet</span>
          </h1>
          <p className="lede">
            ReLoop is how we would find out. A reusable takeaway container loop, run first at two stalls and three return points,
            measured honestly, and scaled only if the whole loop works for people and the planet.
          </p>
          <div className="hero-actions">
            <button className="btn" type="button" onClick={() => go('student')}>
              Try the student app
            </button>
            <button className="btn ghost" type="button" onClick={() => go('pilot')}>
              See the go / no-go test
            </button>
          </div>
        </div>
        <div className="loop-wrap">
          <Loop
            stages={STAGES.map((s, i) => ({ id: s.id, name: s.name, icon: STAGE_ICONS[i] }))}
            active={active}
            onSelect={setActive}
            returnRate={0.95}
            damageRate={0.01}
          />
        </div>
      </section>

      <section className="stage-panel" aria-live="polite">
        <div>
          <h3>
            Stage {active + 1} of 6 · {st.owner}
          </h3>
          <div className="stage-name">{st.name}</div>
          <div className="stage-steps" role="group" aria-label="Choose a stage">
            {STAGES.map((s, i) => (
              <button key={s.id} type="button" aria-label={s.name} aria-pressed={i === active} onClick={() => setActive(i)} />
            ))}
          </div>
        </div>
        <div>
          <h3>What happens</h3>
          <p>{st.does}</p>
        </div>
        <div>
          <h3>Where it breaks</h3>
          <ul>
            {st.breaks.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>
            What the pilot measures{' '}
            <Info>Each measure feeds the pilot scorecard. Slides: {st.source}.</Info>
          </h3>
          <ul>
            {st.measure.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </section>
      <p className="range-hint" style={{ marginTop: 10 }}>
        Dots are containers: peach while a student has one, grey when dirty, teal once clean. The loop assumes a 95% return rate and 1% damage at
        inspection. Change both in the break-even lab.
      </p>

      <section className="context">
        <div>
          <h2 className="display">What is the situation at NTU?</h2>
          <p className="context-note">Takeaway is the default at lunch. Every box is used once, burned, and buried offshore. The question is whether NTU can run a reuse loop that actually beats that.</p>
        </div>
        <div className="chain">
          <div className="chain-row">
            <span className="big num">16</span>
            <p>
              <strong>canteens on campus</strong>, serving up to 30,000 staff and students every day.
            </p>
          </div>
          <div className="chain-row">
            <span className="big">Single-use</span>
            <p>
              <strong>Massive amounts of takeaway packaging</strong> are generated, used once and incinerated.
            </p>
          </div>
          <div className="chain-row">
            <span className="big">Semakau</span>
            <p>
              <strong>The remaining ash</strong> goes to Semakau, Singapore’s offshore landfill.
            </p>
          </div>
        </div>
      </section>

      <section className="byoc">
        <div>
          <p className="kicker" style={{ color: 'var(--lime)' }}>
            What we did: EarthLink NTU, early 2026
          </p>
          <h2 className="display">Bring your own container</h2>
          <p style={{ marginTop: 12, maxWidth: '32rem' }}>
            A BYOC campaign offered 10 to 30-cent discounts at participating stalls. People used it, but not often.
          </p>
          <div className="byoc-figs">
            <div>
              <div className="big num">222</div>
              <span>uses</span>
            </div>
            <div>
              <div className="big num">43</div>
              <span>participants</span>
            </div>
            <div>
              <div className="big num">5.2</div>
              <span>uses per participant</span>
            </div>
          </div>
        </div>
        <div className="burden">
          <h3 style={{ color: 'var(--paper)', fontSize: '1.05rem' }}>What went wrong: the burden sits on the student</h3>
          {[
            { icon: Brain, t: 'Remembering', d: 'Bringing a box means planning lunch before leaving home.' },
            { icon: Backpack, t: 'Carrying', d: 'An empty, then a dirty, container in the bag all day.' },
            { icon: HandPlatter, t: 'Hand-washing', d: 'Oily food in a hall pantry sink, every time.' },
            { icon: Network, t: 'No shared infrastructure', d: 'Students and vendors get little support for the full reuse process.' },
          ].map(({ icon: I, t, d }) => (
            <div className="burden-item" key={t}>
              <I size={28} strokeWidth={1.8} />
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </div>
          ))}
          <p className="burden-arrow">A borrowing loop removes these burdens, and adds four new ones for NTU to carry.</p>
        </div>
      </section>

      <section className="tour">
        <h2 className="display">Walk through the prototype</h2>
        <div className="tour-grid">
          {[
            { id: 'student' as ViewId, icon: Smartphone, t: 'Student app', d: 'Borrow at a stall, get the 48-hour reminder, return to the right chute.', who: 'Safeguards · An Qi' },
            { id: 'ops' as ViewId, icon: MapIcon, t: 'Operations', d: 'Watch bins fill over a day, plan collections and top up stalls by pool.', who: 'Return stations, redistribution · Rishaan, Kyra' },
            { id: 'lab' as ViewId, icon: FlaskConical, t: 'Break-even lab', d: 'See how return rate decides whether a container ever beats a disposable.', who: 'Collect and wash · Prisha' },
            { id: 'pilot' as ViewId, icon: ClipboardCheck, t: 'Pilot scorecard', d: 'Tier 0, pilot, review. Then go, pivot or no-go against agreed targets.', who: 'Implementation · Sachin' },
          ].map(({ id, icon: I, t, d, who }) => (
            <button key={id} type="button" onClick={() => go(id)}>
              <span className="who">{who}</span>
              <h3>
                <I size={18} /> {t}
              </h3>
              <p>{d}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
