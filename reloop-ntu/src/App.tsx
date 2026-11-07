import { useCallback, useEffect, useState } from 'react';
import { Mark } from './components/ui';
import Overview from './views/Overview';
import StudentApp from './views/StudentApp';
import Operations from './views/Operations';
import Lab from './views/Lab';
import Scorecard from './views/Scorecard';

export type ViewId = 'overview' | 'student' | 'ops' | 'lab' | 'pilot';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'The loop' },
  { id: 'student', label: 'Student app' },
  { id: 'ops', label: 'Operations' },
  { id: 'lab', label: 'Break-even lab' },
  { id: 'pilot', label: 'Pilot scorecard' },
];

const fromHash = (): ViewId => {
  const h = window.location.hash.replace('#', '');
  return (VIEWS.find((v) => v.id === h)?.id ?? 'overview') as ViewId;
};

export default function App() {
  const [view, setView] = useState<ViewId>(fromHash);

  const go = useCallback((id: ViewId) => {
    setView(id);
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch {
      /* hash updates can be blocked in sandboxed frames; navigation still works */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHash = () => setView(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Presenter shortcuts: 1–5 jump between views, arrow keys step through them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= VIEWS.length) go(VIEWS[n - 1].id);
      const idx = VIEWS.findIndex((v) => v.id === view);
      if (e.key === ']' ) go(VIEWS[(idx + 1) % VIEWS.length].id);
      if (e.key === '[') go(VIEWS[(idx - 1 + VIEWS.length) % VIEWS.length].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, view]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              go('overview');
            }}
          >
            <Mark className="brand-mark" />
            <span className="brand-name">ReLoop</span>
            <span className="brand-sub">NTU reusable container pilot</span>
          </a>
          <nav className="nav" aria-label="Sections">
            {VIEWS.map((v, i) => (
              <button key={v.id} type="button" aria-current={view === v.id ? 'page' : undefined} onClick={() => go(v.id)}>
                {v.label}
                <kbd aria-hidden="true">{i + 1}</kbd>
              </button>
            ))}
          </nav>
          <span className="sim-chip" title="This is a prototype. Data, notifications and payments are simulated in the browser.">
            <span className="dot" />
            Prototype<span className="long">&nbsp;· simulated data</span>
          </span>
        </div>
      </header>

      <main key={view} className="view view-enter">
        {view === 'overview' && <Overview go={go} />}
        {view === 'student' && <StudentApp />}
        {view === 'ops' && <Operations />}
        {view === 'lab' && <Lab />}
        {view === 'pilot' && <Scorecard />}
      </main>

      <footer className="footer">
        <span>
          CC0006 Project Showcase · Cluster B, Table 12 · Janelle Ang, Low An Qi, Rishaan Mukherjee, Sachin Chetri Nair, Kyra Sing, Prisha Sureka
        </span>
        <span>Prototype only.</span>
      </footer>
    </>
  );
}
