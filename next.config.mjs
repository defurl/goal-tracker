/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // `pnpm lint` and CI own linting. Next's build-time pass would run a second,
    // differently-configured ESLint over the same files.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
