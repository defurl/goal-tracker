// Today (handoff R02): the close-up of the coffee table, with the day's cards.

import type { Metadata } from 'next';

import { TodayPage } from '@/features/today/TodayPage';

export const metadata: Metadata = { title: 'Today' };

export default function Page() {
  return <TodayPage />;
}
