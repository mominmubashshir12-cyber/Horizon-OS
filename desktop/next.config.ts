// Next.js configuration — uses static export for Tauri desktop compatibility
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
