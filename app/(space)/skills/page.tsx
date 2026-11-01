import type { Metadata } from 'next';

import { ModuleRoute } from '@/features/room/PageHeader';
import { SkillsScreen } from '@/features/skills/SkillsPage';

export const metadata: Metadata = { title: 'Skills' };

export default function Page() {
  return (
    <ModuleRoute title="Learn something meaningful" intro="Less scrolling, more practising.">
      <SkillsScreen />
    </ModuleRoute>
  );
}
