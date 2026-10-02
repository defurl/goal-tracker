/**
 * Sent with every response: pages, route handlers, public/ and /_next/static.
 * tests/unit/edgeHeaders.test.ts holds this list to account.
 *
 * No Strict-Transport-Security, on purpose. Vercel sends `max-age=63072000;
 * includeSubDomains; preload` on *.vercel.app, a domain already on the
 * browsers' preload list, and answers plain HTTP with a 308. A header here
 * would replace that stronger value, and `next start` would send it over
 * http://localhost. A custom domain gets only `max-age=63072000` from Vercel;
 * add includeSubDomains for it, scoped with `has: [{ type: 'host', ... }]`,
 * once every subdomain is HTTPS-only, starting at max-age=300.
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
  // No other site may frame a page, so none can lay the account controls
  // under a decoy and steal the click (the arm-then-fire delete included).
  // frame-ancestors is the standard; X-Frame-Options covers older browsers.
  // This policy holds that one directive and constrains nothing else.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Device and payment features nothing here uses, refused outright, so an
  // injected script cannot ask for them either. Web Audio, which the ambient
  // sound uses, is not policy-controlled; autoplay is left at its default.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
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
