/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost', 'anchor.app', 'api.anchor.app'],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    NEXT_PUBLIC_APP_NAME: 'Zoorzio',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  },
  async redirects() {
    // Old route names kept working after the Zoorzio IA rename.
    return [
      { source: '/dashboard', destination: '/workspace', permanent: false },
      { source: '/chat', destination: '/coffee', permanent: false },
      { source: '/memories', destination: '/explore', permanent: false },
      { source: '/search', destination: '/explore', permanent: false },
      { source: '/settings', destination: '/profile', permanent: false },
      { source: '/tasks', destination: '/boards', permanent: false },
    ];
  },
};

module.exports = nextConfig;
