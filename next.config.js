/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  serverExternalPackages: ['pg'],
  async redirects() {
    return [
      { source: '/calls', destination: '/', permanent: false },
      { source: '/recordings', destination: '/', permanent: false },
      { source: '/reports', destination: '/', permanent: false },
    ];
  },
};
module.exports = nextConfig;
