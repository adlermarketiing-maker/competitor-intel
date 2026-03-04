import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.facebook.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
    ],
  },
  // Exclude puppeteer from server bundle — it runs only in the worker process
  serverExternalPackages: ['puppeteer', 'puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', 'bullmq', 'ioredis'],
}

export default nextConfig
