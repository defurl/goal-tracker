// Root layout. D-03: the room is permanently nocturnal — there is no theme
// provider here and there never will be.

import type { Metadata, Viewport } from 'next';

// 02-typography.md / D-02. Fraunces italic at display sizes, Geist for body.
// Departure Mono is self-hosted — see public/fonts/README.md.
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';

import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Be Better Everyday',
  description:
    'The same 3 a.m. desk — but every object on it is evidence that you acted on something you saved.',
};

export const viewport: Viewport = {
  // Matches --bg-void. Kept in sync by hand: the browser UI cannot read a CSS
  // custom property, so this is the one place the value is repeated.
  themeColor: '#05070D',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* ~3% film grain over the whole viewport; removed under reduced motion. */}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
