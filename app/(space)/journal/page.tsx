import type { Metadata } from 'next';

import { ModulePending } from '@/features/room/ModulePending';

export const metadata: Metadata = { title: 'Journal' };

export default function Page() {
  return (
    <ModulePending
      title="Journal"
      intro="Write what matters. There is no perfect way to journal."
      existing={{ href: '/text#journal-heading', label: 'Open the journal' }}
    />
  );
}
