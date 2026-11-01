import type { Metadata } from 'next';

import { ModuleRoute } from '@/features/room/PageHeader';
import { JournalScreen } from '@/features/journal/JournalPage';

export const metadata: Metadata = { title: 'Journal' };

export default function Page() {
  return (
    <ModuleRoute title="Journal" intro="Write what matters. There is no perfect way to journal.">
      <JournalScreen />
    </ModuleRoute>
  );
}
