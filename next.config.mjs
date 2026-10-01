/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
