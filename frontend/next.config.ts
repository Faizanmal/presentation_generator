import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

/**
 * Split deploy (Vercel): platform env + frontend/.env.local already in process.env.
 * Single VPS: fill any missing keys from the repo-root .env (does not override).
 */
function loadRootEnvFallback() {
  const rootEnv = resolve(__dirname, "..", ".env");
  if (!existsSync(rootEnv)) {
    return;
  }

  for (const raw of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootEnvFallback();

const nextConfig: NextConfig = {
  // Avoid double renders in development (StrictMode runs effects twice)
  reactStrictMode: false,

  // Tree-shake large packages — dramatically reduces compile time
  // lucide-react alone has 1000+ exports without this
  experimental: {
    externalDir: true,
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@radix-ui/react-accordion",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-separator",
      "@tanstack/react-query",
      "sonner",
      "date-fns",
      "recharts",
    ],
  },

  // Remove console.* calls in production builds (reduces bundle size)
  compiler:
    process.env.NODE_ENV === "production"
      ? { removeConsole: { exclude: ["error", "warn"] } }
      : {},

  // Skip type-checking during `next build` (run tsc separately)
  typescript: { ignoreBuildErrors: false },

  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600, // 1 hour
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "loremflickr.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Compress responses
  compress: true,
  poweredByHeader: false,

  // Headers for PWA + static asset caching
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Cache static assets for 1 year
        source: "/:path((?!api).*\\.(?:js|css|woff2?|png|jpg|jpeg|gif|ico|svg)$)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
