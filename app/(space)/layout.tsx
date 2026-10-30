// The space: the 2.5D room and its routes (D-27). Lives beside the night room
// at `/` until the switch-over; nothing here imports three.js.

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';

import type { Metadata } from 'next';

import { DeviceJournalLoader } from '@/features/today/DeviceJournalLoader';
import { SpaceShell } from '@/features/room/SpaceShell';

import { SessionHydrator } from '../(app)/SessionHydrator';

export const metadata: Metadata = {
  title: { default: 'Focus on yourself', template: '%s · Focus on yourself' },
  description: 'A calm space to journal, grow and look after yourself, one small step at a time.',
};

export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionHydrator />
      <DeviceJournalLoader />
      <SpaceShell>{children}</SpaceShell>
    </>
  );
}
