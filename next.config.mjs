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
};

export default nextConfig;
