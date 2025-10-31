/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  env: {
    API_FOOTBALL_KEY: '774c1bb02ceabecd14e199ab73bd9722',
  },
  async rewrites() {
    return [
      {
        source: '/api/football/:path*',
        destination: 'https://v3.football.api-sports.io/:path*',
      },
    ];
  },
};

export default nextConfig;
