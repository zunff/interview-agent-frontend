import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return [
      {
        source: '/api/interview/:path*',
        destination: 'http://localhost:8080/api/interview/:path*',
      },
    ];
  },
  // 标记这些包为服务端外部包，它们只能在客户端使用
  serverExternalPackages: ['ogg-opus-decoder', '@eshaz/web-worker', 'opus-decoder'],
  // 空的 turbopack 配置以消除警告
  turbopack: {},
};

export default nextConfig;
