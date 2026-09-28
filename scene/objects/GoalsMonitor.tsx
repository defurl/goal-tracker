// Monitor 2 bound to Feature 4 (build plan 3.3, spec/05 §3).
//
// Its own component so the screen texture's store subscription re-renders this
// monitor alone, not the whole room, when a goal changes. spec/05 §3 gives
// monitor 2 a texture and no intensity row, so its glow holds at 1.0.

import type { ObjectId } from '../../lib/stores/interaction';
import { useGoalsScreen } from '../screens/goalsScreen';
import { Monitor } from './Monitor';

interface GoalsMonitorProps {
  position: [number, number, number];
  hoverId: ObjectId;
}

export function GoalsMonitor({ position, hoverId }: GoalsMonitorProps) {
  const screen = useGoalsScreen();
  return <Monitor position={position} variant="terminal" hoverId={hoverId} emissiveMap={screen} />;
}
