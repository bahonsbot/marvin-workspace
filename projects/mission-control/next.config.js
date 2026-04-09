/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackBuildWorker: false,
    serverComponentsExternalPackages: ['@fugood/whisper.node', '@fugood/node-whisper-linux-x64'],
  },
};

module.exports = nextConfig;
