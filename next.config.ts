
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
      },
    ],
  },
  env: {
    API_FOOTBALL_KEY: 'de25630c819237c126015c743e8b70dc',
  },
};

export default nextConfig;
