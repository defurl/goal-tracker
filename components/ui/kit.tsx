'use client';

// The v2 board kit: one title-row pattern, one set of controls and states for
// every module (design-system/v2/03, UI/UX §4). Nothing here reads the store;
// boards pass data in.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from './icons';
import styles from './ui.module.css';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// ── card ──────────────────────────────────────────────────────────────────

export function Card({
  title,
  icon,
  action,
  className,
  children,
  as: Tag = 'section',
}: {
  title: string;
  icon?: IconName;
  /** At most one text action on the right ("See all", "Edit"). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  as?: 'section' | 'article' | 'div';
}) {
  const id = useId();
  return (
    <Tag className={cx(styles.card, className)} aria-labelledby={id}>
      <div className={styles.cardHead}>
        {icon && (
          <span className={styles.cardIcon}>
            <Icon name={icon} />
          </span>
        )}
        <h2 id={id} className={styles.cardTitle}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Tag>
  );
}

// ── buttons ───────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'small';
  icon?: IconName;
};

export function Button({ variant = 'secondary', size, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], size === 'small' && styles.small, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

/** Class names for a link styled as a button (next/link keeps its own element). */
export function buttonClass(variant: 'primary' | 'secondary' | 'tertiary' = 'secondary', small = false): string {
  return cx(styles.button, styles[variant], small && styles.small);
}

/**
 * Arm-then-fire for destructive actions (D-22 §5): the first press arms and
 * says what will happen, a second press within the window fires. No dialog.
 */
export const ARM_WINDOW_MS = 4000;

export function useArm(): { armed: boolean; press: (fire: () => void) => void } {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return {
    armed,
    press(fire) {
      if (timer.current) clearTimeout(timer.current);
      if (armed) {
        setArmed(false);
        fire();
        return;
      }
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), ARM_WINDOW_MS);
    },
  };
}

export function ArmButton({
  label,
  armedLabel,
  onFire,
  disabled,
  size,
}: {
  label: string;
  armedLabel: string;
  onFire: () => void;
  disabled?: boolean;
  size?: 'small';
}) {
  const { armed, press } = useArm();
  return (
    <Button
      size={size}
      className={armed ? styles.armed : undefined}
      disabled={disabled}
      aria-live="polite"
      onClick={() => press(onFire)}
    >
      {armed ? armedLabel : label}
    </Button>
  );
}

// ── fields ────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

/** An error stated in words with an icon, in ink. There is no red (v2/03). */
export function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.error} role="alert">
      <Icon name="info" size={18} />
      <span>{children}</span>
    </p>
  );
}

export const inputClass = styles.input;
export const textareaClass = styles.textarea;
export const selectClass = styles.select;

// ── chips and tabs ────────────────────────────────────────────────────────

export function Chips<T extends string>({
  legend,
  options,
  value,
  onChange,
  multiple = false,
  hideLegend = false,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
  hideLegend?: boolean;
}) {
  return (
    <fieldset className={styles.chips}>
      <legend className={hideLegend ? styles.visuallyHidden : styles.chipsLegend}>{legend}</legend>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={styles.chip}
            aria-pressed={on}
            onClick={() => {
              if (multiple) onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value]);
              else onChange(on ? [] : [o.value]);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className={styles.tag}>{children}</span>;
}

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          className={styles.tab}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── meters ────────────────────────────────────────────────────────────────

/** A progress ring. Progress, never a score of the person (functional spec G03). */
export function Ring({
  value,
  label,
  sub,
  tone = 'interactive',
  size = 64,
  children,
}: {
  /** 0–1. */
  value: number;
  label: string;
  sub?: string;
  tone?: 'interactive' | 'signal';
  size?: number;
  children?: ReactNode;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={styles.ring}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className={styles.ringTrack} />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform="rotate(-90 32 32)"
          className={cx(styles.ringValue, tone === 'signal' && styles.ringValueSignal)}
        />
        {children}
      </svg>
      <span className={styles.ringLabel}>{label}</span>
      {sub && <span className={styles.ringSub}>{sub}</span>}
    </div>
  );
}

export function Meter({
  label,
  value,
  max,
  tone = 'interactive',
}: {
  label: string;
  value: number | null;
  max: number;
  tone?: 'interactive' | 'signal';
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className={styles.meter}>
      <span>{label}</span>
      {/* Nothing recorded is not a reading of zero: no meter role, just words. */}
      <span
        className={styles.meterTrack}
        {...(value === null
          ? { 'aria-hidden': true }
          : { role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value })}
      >
        <span className={cx(styles.meterFill, tone === 'signal' && styles.meterFillSignal)} style={{ width: `${pct}%` }} />
      </span>
      <span>{value === null ? 'not recorded' : `${value}/${max}`}</span>
    </div>
  );
}

// ── states ────────────────────────────────────────────────────────────────

export function Muted({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className={styles.muted} id={id}>
      {children}
    </p>
  );
}

/** A kind invitation with the first action, never a row of zeros (X-1). */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.muted}>{children}</p>
      {action}
    </div>
  );
}

/** The card's shape while the store fills, never a spinner (X-2). */
export function Skeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLine} />
    </div>
  );
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';

const SAVE_COPY: Record<SaveState, string> = {
  idle: '',
  dirty: 'Not saved yet',
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Not saved. Your text is still here.',
};

export function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className={styles.status} role="status" aria-live="polite">
      {state === 'saved' && <Icon name="check" size={16} />}
      {SAVE_COPY[state]}
    </span>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.visuallyHidden}>{children}</span>;
}
