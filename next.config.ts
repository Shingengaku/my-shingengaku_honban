import type { NextConfig } from "next";

// @ts-expect-error NextConfigの型にはまだeslintが含まれていないバージョンがある可能性があります
const nextConfig: NextConfig = {
  /* 設定オプションをここに記述 */
  experimental: {},
  eslint: {
    // 警告: プロジェクトにESLintエラーがあっても本番ビルドを成功させます。
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! 警告 !!
    // プロジェクトに型エラーがあっても本番ビルドを成功させます。
    // !! 警告 !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
