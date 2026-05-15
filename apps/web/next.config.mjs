/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@mysten/sui", "@form-walrus/client"]
  }
};

export default nextConfig;
