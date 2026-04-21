// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: [
      'onlyfeets-media.s3.amazonaws.com',
      'cdn.onlyfeets.com',
      'localhost',
      'd1234567890.cloudfront.net',
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
