
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_FOOTBALL_KEY: 'de25630c819237c126015c743e8b70dc',
  },
};

export default nextConfig;
