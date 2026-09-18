// The one interaction wrapper. design-system/08-interaction-grammar.md §1.
//
// There is no menu: the objects ARE the navigation (D-04). That only works if
// every object behaves identically, which is why this is a single wrapper
// applied uniformly rather than per-object handlers. It contributes four
// behaviours and nothing else.
//
// Desktop    hover shows the label, click activates.
// Mobile     touch has no hover, so the first tap ARMS (label shows for 3 s)
//            and a second tap on the same object activates. Tapping a
//            different object disarms the first and arms the new one.
// Keyboard   a visually hidden 48x48 button at the label position puts the
//            object in the tab order and drives the same hover state.
// Label      suppressed whenever a panel is open, so nothing floats over the
//            open content.
//
// Hover feedback lives in the MATERIAL, not here: objects lift their emissive
// (see Monitor). Nothing moves or scales on hover.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';

import { useInteractionStore, type ObjectId } from '../lib/stores/interaction';
import { useSceneStore } from '../lib/stores/scene';
import styles from './HoverLabel.module.css';

interface InteractiveObjectProps {
  id: ObjectId;
  label?: string;
  labelPosition?: [number, number, number];
  onActivate?: () => void;
  children: ReactNode;
}

const ARM_WINDOW_MS = 3000;

export function InteractiveObject({
  id,
  label,
  labelPosition = [0, 0.6, 0],
  onActivate,
  children,
}: InteractiveObjectProps) {
  const [hovered, setHovered] = useState(false);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setHoveredStore = useInteractionStore((s) => s.setHovered);
  // The grammar suppresses labels when a PANEL is open, not merely when
  // something is focused: a glide-only object (the window) has no panel and
  // should not blank every other label for the duration of its glide.
  const panelOpen = useInteractionStore((s) => s.panel !== null);
  const isMobile = useSceneStore((s) => s.isMobile);

  const disarm = () => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    setArmed(false);
  };

  useEffect(() => () => disarm(), []);

  const enter = (e: ThreeEvent<PointerEvent>) => {
    if (isMobile) return;
    e.stopPropagation();
    setHovered(true);
    setHoveredStore(id);
    document.body.style.cursor = onActivate ? 'pointer' : 'auto';
  };

  const leave = (e: ThreeEvent<PointerEvent>) => {
    if (isMobile) return;
    e.stopPropagation();
    setHovered(false);
    setHoveredStore(null);
    document.body.style.cursor = 'auto';
  };

  // Always stop propagation: nested meshes inside one object would otherwise
  // fire the handler once each.
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!onActivate) return;
    if (!isMobile) {
      onActivate();
      return;
    }
    if (armed) {
      disarm();
      onActivate();
      return;
    }
    setArmed(true);
    setHoveredStore(id);
    armTimer.current = setTimeout(disarm, ARM_WINDOW_MS);
  };

  const focus = () => {
    if (isMobile) return;
    setHovered(true);
    setHoveredStore(id);
  };

  const blur = () => {
    if (isMobile) return;
    setHovered(false);
    setHoveredStore(null);
  };

  const keyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onActivate?.();
  };

  const showLabel = Boolean(label) && !panelOpen && (hovered || armed);

  return (
    <group onPointerOver={enter} onPointerOut={leave} onClick={click}>
      {children}

      {onActivate && !panelOpen && (
        <Html position={labelPosition} transform={false} prepend center style={{ pointerEvents: 'none' }}>
          <button
            type="button"
            className={styles.focusableButton}
            onFocus={focus}
            onBlur={blur}
            onKeyDown={keyDown}
            aria-label={label ?? id}
            style={{ pointerEvents: 'auto' }}
          />
        </Html>
      )}

      {showLabel && (
        <Html position={labelPosition} transform={false} prepend center pointerEvents="none">
          <span className={styles.label}>{label}</span>
        </Html>
      )}
    </group>
  );
}
