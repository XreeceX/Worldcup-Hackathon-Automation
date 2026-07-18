/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Solana web3 / Anchor expect browser Buffer; Next doesn't polyfill by default.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
