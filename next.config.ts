
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_FOOTBALL_KEY: '774c1bb02ceabecd14e199ab73bd9722',
  },
};

export default nextConfig;
