/**
 * Sent with every response: pages, route handlers, public/ and /_next/static.
 * tests/unit/edgeHeaders.test.ts holds this list to account.
 */
const securityHeaders = [
  // A response is only ever what its Content-Type says: a JSON or text body is
  // never sniffed into script or HTML. Every route already sends the right
  // type, sw.js (application/javascript) included.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other origins (Supabase, Google's sign-in) learn the origin, never a path
  // or query. Today's browsers already default to this; stated, it holds for
  // older ones too.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No `X-Powered-By: Next.js` on rendered responses. Hygiene, not a control:
  // the /_next/ asset paths still name the framework to anyone who looks.
  poweredByHeader: false,
  eslint: {
    // `pnpm lint` and CI own linting. Next's build-time pass would run a second,
    // differently-configured ESLint over the same files.
    ignoreDuringBuilds: true,
  },
  images: {
    // Nothing uses next/image, so the optimizer is an endpoint with no caller:
    // /_next/image would resize any image in public/ for anyone who asks. Off,
    // `next start` answers it with a 404 and Vercel provisions no optimizer.
    // Several next@14 advisories live in that code path.
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
