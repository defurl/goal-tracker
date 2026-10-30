import type { Metadata } from 'next';

import { ModulePending } from '@/features/room/ModulePending';

export const metadata: Metadata = { title: 'Skills' };

export default function Page() {
  return <ModulePending title="Learn something meaningful" intro="Less scrolling, more practising." existing={null} />;
}
