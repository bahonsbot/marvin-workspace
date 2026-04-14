/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@fugood/whisper.node', '@fugood/node-whisper-linux-x64'],
};

module.exports = nextConfig;
