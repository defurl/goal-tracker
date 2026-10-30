import type { Metadata } from 'next';

import { ModulePending } from '@/features/room/ModulePending';

export const metadata: Metadata = { title: 'Growth Map' };

export default function Page() {
  return (
    <ModulePending
      title="Your growth journey"
      intro="Notice the changes you are making, one action at a time."
      existing={{ href: '/text#habits-heading', label: 'Open habits and goals' }}
    />
  );
}
