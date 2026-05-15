import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* 設定オプションをここに記述 */
  experimental: {},
  typescript: {
    // !! 警告 !!
    // プロジェクトに型エラーがあっても本番ビルドを成功させます。
    // !! 警告 !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // !! 警告 !!
    // ESLintエラーがあっても本番ビルドを成功させます。
    // !! 警告 !!
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
