// Monitor 1 bound to Feature 1 (build plan 3.1, spec/05 §3).
//
// Its own component so the screen texture's store subscription re-renders this
// monitor alone, not the whole room, when today's challenge changes.

import { useAppStore } from '../../lib/stores/app';
import type { ObjectId } from '../../lib/stores/interaction';
import { useChallengeScreen } from '../screens/challengeScreen';
import { Monitor } from './Monitor';

/** D-20: 1.1 keeps an ordinary day blooming; 1.4 is the band ceiling. */
const OPEN = 1.1;
const DONE = 1.4;

const intensityTarget = () => (useAppStore.getState().challenge?.complete ? DONE : OPEN);

interface ChallengeMonitorProps {
  position: [number, number, number];
  hoverId: ObjectId;
}

export function ChallengeMonitor({ position, hoverId }: ChallengeMonitorProps) {
  const screen = useChallengeScreen();
  return (
    <Monitor
      position={position}
      variant="primary"
      hoverId={hoverId}
      emissiveMap={screen}
      intensityTarget={intensityTarget}
    />
  );
}
