import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: '/main',
        destination: '/login',
        permanent: false,
      },
    ];
  },
  reactStrictMode: false,
};

export default nextConfig;
