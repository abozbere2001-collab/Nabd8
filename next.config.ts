
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  env: {
    API_FOOTBALL_KEY: '75f36f22d689a0a61e777d92bbda1c08',
  },
};

export default nextConfig;
