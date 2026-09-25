'use client';

// Registers public/sw.js, which caches the /text shell for offline use (B2.9,
// D-07). Registered from both surfaces, so a first visit to the room still
// leaves /text ready for the next offline moment. Production builds only: in
// development a cached shell would fight hot reloading.

import { useEffect } from 'react';

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
