import type { Metadata } from 'next';

import { ModulePending } from '@/features/room/ModulePending';

export const metadata: Metadata = { title: 'Self Care' };

export default function Page() {
  return (
    <ModulePending
      title="What do you need right now?"
      intro="A different kind of break, chosen at your own pace."
      existing={{ href: '/text#focus-heading', label: 'Start a two-minute focus' }}
    />
  );
}
