
import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

// Determine if the environment is GitHub Pages
const isGithubActions = process.env.GITHUB_ACTIONS || false;
const repo = 'Nabd8'; // Your repository name

const assetPrefix = isGithubActions ? `/${repo}/` : '';
const basePath = isGithubActions ? `/${repo}` : '';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: assetPrefix,
  basePath: basePath,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
        pathname: '/**',
      },
    ],
  },
};

const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
};

// Apply PWA settings only in production
const config =
  process.env.NODE_ENV === 'production'
    ? withPWA(pwaConfig)(nextConfig)
    : nextConfig;

export default config;
