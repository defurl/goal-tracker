// Home: the room overview (handoff R01). The room, its hotspots and the menu
// live in the space layout; this page only names the view.

import { VisuallyHidden } from '@/components/ui/kit';

export default function RoomPage() {
  return (
    <h1 tabIndex={-1}>
      <VisuallyHidden>Your space</VisuallyHidden>
    </h1>
  );
}
