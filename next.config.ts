import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ["pg", "googleapis", "@google-cloud/local-auth", "pdfjs-dist"],
};

export default nextConfig;
