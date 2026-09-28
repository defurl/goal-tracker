// The headphones bound to focus mode (build plan 3.8).
//
// A TOGGLE (design-system/08 §4): no camera move, no panel — activating them
// flips `focusMode`, the same boolean as the corner's audio control, and the
// ambient bed follows (app/(app)/AudioControl.tsx). An object and a control
// that agree (08 §7).
//
// Its own component so the `focusMode` subscription — discrete, never per-tick
// (spec/05 §1) — re-renders only the headphones. The toggle goes through the
// interaction wrapper's injected `onActivate`, the one write a scene object is
// allowed (spec/05 §6), and lands in the data layer.

import { toggleFocusMode } from '../../lib/data/focus';
import { useAppStore } from '../../lib/stores/app';
import { InteractiveObject } from '../InteractiveObject';
import { Headphones } from './Headphones';

interface FocusHeadphonesProps {
  position: [number, number, number];
}

export function FocusHeadphones({ position }: FocusHeadphonesProps) {
  const on = useAppStore((s) => s.focusMode);
  return (
    <InteractiveObject
      id="headphones"
      label={on ? 'focus mode · on' : 'focus mode · off'}
      labelPosition={[position[0], 0.16, position[2]]}
      onActivate={toggleFocusMode}
      pressed={on}
    >
      <Headphones position={position} />
    </InteractiveObject>
  );
}
