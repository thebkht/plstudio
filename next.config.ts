import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pnpm dev` blocks /_next assets and the HMR socket for any origin but localhost,
  // so a phone or laptop on the LAN gets the HTML and a 403 for every script. Allow
  // the private ranges (RFC 1918) and mDNS names; production ignores this option.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`), "*.local"],
};

export default nextConfig;
