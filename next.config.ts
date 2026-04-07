import type { NextConfig } from "next";
import { execSync } from "child_process";

const buildTime = (() => {
  try {
    return execSync("git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M' KST").toString().trim().replace(/'/g, "")
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ') + " KST"
  }
})()

const nextConfig: NextConfig = {
  serverExternalPackages: ['ccxt'],
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
