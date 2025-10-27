import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Map common serverless function paths to Next's Inngest endpoint
      { source: '/.redwood/functions/inngest', destination: '/api/inngest' },
      { source: '/.netlify/functions/inngest', destination: '/api/inngest' },
      { source: '/api/functions/inngest', destination: '/api/inngest' },
    ];
  },
};

export default nextConfig;
