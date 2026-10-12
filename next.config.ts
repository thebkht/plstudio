import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pnpm dev` blocks /_next assets and the HMR socket for any origin but localhost,
  // so a phone or laptop on the LAN gets the HTML and a 403 for every script. Allow
  // the private ranges and mDNS names; production ignores this option.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
