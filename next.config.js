/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mysql2', 'nodemailer'],
  },
};

module.exports = nextConfig;
