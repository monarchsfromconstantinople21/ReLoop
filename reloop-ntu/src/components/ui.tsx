import { useId, useState, type ReactNode } from 'react';

/** Small "i" button that reveals an explanation on hover or focus. */
export function Info({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <span role="tooltip" id={id} className="tip">
          {children}
        </span>
      )}
    </span>
  );
}

export function Range(props: {
  id: string;
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: ReactNode;
  info?: ReactNode;
}) {
  const { id, label, value, min, max, step = 1, onChange, format = String, hint, info } = props;
  return (
    <div className="range">
      <div className="range-top">
        <label htmlFor={id}>
          {label}
          {info && <Info>{info}</Info>}
        </label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="range-hint">{hint}</div>}
    </div>
  );
}

export function Seg<T extends string | number>(props: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small logo: a loop that does not quite close, after the deck's "may not work... yet". */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="var(--lime)" />
      <path d="M28.5 13.2 A10.5 10.5 0 1 0 30.4 21.6" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M24.6 12.4 L29.4 12.6 L29.6 17.4" fill="none" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="3.2" fill="var(--teal)" />
    </svg>
  );
}
