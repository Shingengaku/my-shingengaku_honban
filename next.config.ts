import type { NextConfig } from "next";
import pkg from "./package.json";

// 日本時間 (JST) で YYYY-MM-DD-hhmm 形式のビルドタイムスタンプを取得
const getJSTBuildTime = () => {
  const d = new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const YYYY = jst.getUTCFullYear();
  const MM = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}-${hh}${mm}`;
};

const nextConfig: NextConfig = {
  /* 設定オプションをここに記述 */
  experimental: {},
  typescript: {
    // !! 警告 !!
    // プロジェクトに型エラーがあっても本番ビルドを成功させます。
    // !! 警告 !!
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_TIME: getJSTBuildTime(),
  },
};

export default nextConfig;
