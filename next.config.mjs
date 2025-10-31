/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_FOOTBALL_KEY: "774c1bb02ceabecd14e199ab73bd9722",
  },
};

export default nextConfig;
