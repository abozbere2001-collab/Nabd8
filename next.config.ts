
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
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
