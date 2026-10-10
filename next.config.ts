import type { NextConfig } from "next";
import { existsSync } from 'node:fs';

const expoWeb = process.env.MODE_EXPO_WEB === '1';
if (expoWeb && !existsSync('public/expo/index.html')) throw new Error('MODE_EXPO_WEB=1 requires npm run build:client first.');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.17.43.186", "172.17.39.131"],
  async rewrites() {
    if (!expoWeb) return [];
    return {
      beforeFiles: [
        { source: '/_expo/:path*', destination: '/expo/_expo/:path*' },
        { source: '/assets/:path*', destination: '/expo/assets/:path*' },
        ...['/', '/login', '/pass', '/tasks', '/treasury'].map(source => ({ source, destination: '/expo/index.html' })),
      ],
      afterFiles: [],
      fallback: [{ source: '/:path((?!api(?:/|$)|_next(?:/|$)|_expo(?:/|$)|assets(?:/|$)|expo(?:/|$)|legacy(?:/|$)|t(?:/|$))[^.]*)', destination: '/expo/index.html' }],
    };
  },
};

export default nextConfig;
