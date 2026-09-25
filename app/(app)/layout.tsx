// The (app) group — the room and /text. Both read the same store (spec/05 §8),
// so both get it hydrated here, in the same phase (D-07).

import { AccountControl } from './AccountControl';
import { ServiceWorker } from './ServiceWorker';
import { SessionHydrator } from './SessionHydrator';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionHydrator />
      <ServiceWorker />
      {children}
      <AccountControl />
    </>
  );
}
