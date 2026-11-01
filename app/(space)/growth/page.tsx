import type { Metadata } from 'next';

import { ModuleRoute } from '@/features/room/PageHeader';
import { GrowthScreen } from '@/features/growth/GrowthPage';

export const metadata: Metadata = { title: 'Growth Map' };

export default function Page() {
  return (
    <ModuleRoute title="Your growth journey" intro="Notice the changes you are making, one action at a time.">
      <GrowthScreen />
    </ModuleRoute>
  );
}
