'use client';

// The space: the pre-rendered room behind, the persistent menu on top, and the
// route's cards in front (D-27 §1, handoff 01 §5 and 03 §2).
//
// The URL is the source of truth. When it changes, the room plays the move
// between the two views — zoom in from Home, zoom out to Home, crossfade
// between focus views — and the cards appear once the room has settled. A deep
// link lands already settled. The latest navigation wins: a newer one cancels
// an older one's timers. Under reduced motion every change is a swap.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';
import { Icon } from '@/components/ui/icons';
import { useDeviceState } from '@/lib/device/deviceState';
import { prefersReducedMotion, watchReducedMotion } from '@/lib/motion/reducedMotion';
import { useAppStore } from '@/lib/stores/app';

import { coverRect, onScreen, placePoint } from './geometry';
import { HOME_ROUTE, MENU, SUNNY, isFocus, planMove, viewForPath, type FocusKey, type ImageSet, type ViewKey } from './theme';

import styles from './space.module.css';

/** Room move and card reveal, inside the handoff's 450-800 ms and 120-200 ms. */
export const ROOM_MS = 700;
const PRELOAD_TIMEOUT_MS = 2500;

export const DEFAULT_SPACE_TITLE = 'Your Space';

type Phase = 'home' | 'preloading' | 'focusing' | 'focused' | 'exiting' | 'fallback';

function Picture({ image, className, eager }: { image: ImageSet; className?: string; eager?: boolean }) {
  return (
    <picture>
      <source srcSet={image.avif} type="image/avif" />
      <img
        src={image.webp}
        width={image.width}
        height={image.height}
        alt=""
        className={className}
        decoding="async"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </picture>
  );
}

/**
 * Loads a focus image before the move starts. False only when it failed to
 * load in both formats; a slow image does not hold the move up past the
 * timeout — it fades in when it arrives.
 */
function preload(image: ImageSet): Promise<boolean> {
  const attempt = (src: string) =>
    new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  const slow = new Promise<boolean>((r) => setTimeout(() => r(true), PRELOAD_TIMEOUT_MS));
  return Promise.race([attempt(image.avif).then((ok) => ok || attempt(image.webp)), slow]);
}

function SpaceTitle() {
  const [space, setSpace] = useDeviceState('space', { title: DEFAULT_SPACE_TITLE });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(space.title);

  if (editing) {
    return (
      <form
        className={styles.titleForm}
        onSubmit={(e) => {
          e.preventDefault();
          setSpace(() => ({ title: draft.trim() || DEFAULT_SPACE_TITLE }));
          setEditing(false);
        }}
      >
        <label htmlFor="space-title" className={styles.visuallyHidden}>
          Name your space
        </label>
        <input
          id="space-title"
          className={styles.titleInput}
          value={draft}
          maxLength={40}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditing(false);
            }
          }}
        />
        <button type="submit" className={styles.barButton}>
          Save
        </button>
      </form>
    );
  }
  return (
    <div className={styles.titleRow}>
      <p className={styles.spaceTitle}>{space.title}</p>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Rename your space"
        onClick={() => {
          setDraft(space.title);
          setEditing(true);
        }}
      >
        <Icon name="pen" size={18} />
      </button>
    </div>
  );
}

function TopBar({ view }: { view: ViewKey }) {
  const { ready, signedIn } = useSurfaceState();
  const points = useAppStore((s) => s.points.total);
  const home = view === 'home';
  return (
    <header className={`${styles.bar} ${home ? styles.barHome : ''}`}>
      <div className={styles.barStart}>
        {!home && (
          <Link href={HOME_ROUTE} className={styles.barButton}>
            <Icon name="home" size={18} />
            Back to room
          </Link>
        )}
      </div>
      <div className={styles.barCentre}>
        {home && <SpaceTitle />}
        <nav aria-label="Modules" className={styles.menu}>
          <ul className={styles.menuList}>
            {MENU.map((m) => (
              <li key={m.route}>
                <Link href={m.route} className={styles.menuItem} aria-current={view === m.view ? 'page' : undefined}>
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className={styles.barEnd}>
        {ready && signedIn && points > 0 && (
          <span className={styles.points}>
            <Icon name="leaf" size={18} />
            {points}
            <span className={styles.visuallyHidden}>points earned</span>
          </span>
        )}
        {ready && !signedIn && (
          <Link href="/login" className={styles.barButton}>
            Sign in
          </Link>
        )}
        <Link href="/settings" className={styles.barButton} aria-label="Settings" aria-current={view === 'settings' ? 'page' : undefined}>
          <Icon name="gear" size={18} />
        </Link>
      </div>
    </header>
  );
}

export function SpaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const target = viewForPath(pathname ?? HOME_ROUTE);

  const [shown, setShown] = useState<{ view: ViewKey; phase: Phase }>(() => ({
    view: target,
    phase: target === 'home' ? 'home' : 'focused',
  }));
  const [leaving, setLeaving] = useState<FocusKey | null>(null);
  const [reduced, setReduced] = useState(false);
  const [size, setSize] = useState({ w: 1440, h: 810 });
  const stage = useRef<HTMLDivElement>(null);
  const txn = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    setReduced(prefersReducedMotion());
    return watchReducedMotion(setReduced);
  }, []);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The transition controller.
  useEffect(() => {
    const from = shownRef.current.view;
    const move = planMove(from, target, reduced);
    if (move === 'none') return;
    const id = ++txn.current;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const live = () => txn.current === id;
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(() => live() && fn(), ms));
    const settled: Phase = target === 'home' ? 'home' : 'focused';

    setLeaving(isFocus(from) ? from : null);

    if (move === 'zoom-out') {
      setShown({ view: target, phase: 'exiting' });
      later(() => setShown({ view: target, phase: 'home' }), ROOM_MS);
      return;
    }
    if (!isFocus(target)) {
      // Settings: the room itself, softened; no zoom target.
      setShown({ view: target, phase: move === 'swap' ? settled : 'focusing' });
      if (move !== 'swap') later(() => setShown({ view: target, phase: 'focused' }), ROOM_MS);
      return;
    }
    setShown({ view: target, phase: 'preloading' });
    void preload(SUNNY.focuses[target].image).then((ok) => {
      if (!live()) return;
      if (!ok) {
        setShown({ view: target, phase: 'fallback' });
        return;
      }
      if (move === 'swap') {
        setShown({ view: target, phase: settled });
        return;
      }
      setShown({ view: target, phase: 'focusing' });
      later(() => setShown({ view: target, phase: 'focused' }), ROOM_MS);
    });
  }, [target, reduced]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Focus moves to the route's heading once its cards appear (handoff 01 §6).
  useEffect(() => {
    if (shown.phase === 'focused' || shown.phase === 'fallback') {
      document.querySelector<HTMLElement>('#space-main h1')?.focus({ preventScroll: true });
    }
  }, [shown.phase, shown.view]);

  // Escape returns to the room, unless a field has it.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || shown.view === 'home') return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      router.push(HOME_ROUTE);
    },
    [router, shown.view],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const { view, phase } = shown;
  const rect = coverRect(size.w, size.h, SUNNY.overview.width, SUNNY.overview.height);
  const zoomView = isFocus(view) ? view : leaving;
  const focal = zoomView ? placePoint(rect, SUNNY.focuses[zoomView].focal.x, SUNNY.focuses[zoomView].focal.y) : null;
  const zoomed = isFocus(view) && (phase === 'focusing' || phase === 'focused');
  const soft = phase === 'focused' || phase === 'fallback' || (view === 'settings' && phase === 'focusing');
  const focusLayers = [...new Set([leaving, isFocus(view) ? view : null].filter((v): v is FocusKey => v !== null))];

  return (
    <div className={styles.space} data-phase={phase} data-view={view}>
      <div ref={stage} className={styles.stage} aria-hidden={view !== 'home' ? true : undefined}>
        <div
          className={`${styles.layer} ${styles.overview} ${view === 'settings' && soft ? styles.soft : ''}`}
          style={{
            transformOrigin: focal ? `${focal.x}px ${focal.y}px` : '50% 50%',
            transform: zoomed ? 'scale(1.6)' : 'none',
          }}
        >
          <Picture image={SUNNY.overview} className={styles.image} eager />
        </div>
        {focusLayers.map((key) => (
          <div
            key={key}
            className={`${styles.layer} ${styles.focus} ${key === view && phase !== 'preloading' && phase !== 'exiting' ? styles.visible : ''} ${key === view && soft ? styles.soft : ''}`}
          >
            <Picture image={SUNNY.focuses[key].image} className={styles.image} />
          </div>
        ))}
        <div className={`${styles.wash} ${soft ? styles.visible : ''}`} />

        <nav aria-label="Objects in the room" className={styles.hotspots} hidden={view !== 'home'}>
          {SUNNY.hotspots.map((h) => {
            const p = placePoint(rect, h.x, h.y);
            // A narrow crop can leave an object off screen; the menu still reaches it.
            if (!onScreen(p, size.w, size.h, 32)) return null;
            return (
              <Link
                key={h.id}
                href={h.route}
                className={styles.hotspot}
                style={{ left: p.x, top: p.y }}
                aria-label={`${h.label}: ${h.object}`}
                tabIndex={phase === 'home' ? 0 : -1}
              >
                <span className={styles.hotspotDot} aria-hidden="true" />
                {h.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <TopBar view={view} />

      <main id="space-main" className={`${styles.main} ${phase === 'focused' || phase === 'fallback' ? styles.mainShown : ''}`}>
        {children}
      </main>
    </div>
  );
}
