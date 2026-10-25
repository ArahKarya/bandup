import type { NextConfig } from "next";

/**
 * CSP without nonces: Next's inline bootstrap scripts need 'unsafe-inline', but the policy
 * still blocks every third-party origin (scripts, frames, form posts, connections), which is
 * what limits damage if content ever smuggles HTML through. HSTS assumes HTTPS in production.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const PRODUCTION_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small; the Dockerfile sets BUILD_STANDALONE.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // Content files and assets are read at runtime by the asset route and sync script.
  outputFileTracingIncludes: { "/api/assets/[file]": ["./content/assets/**/*"] },
  experimental: {
    // Speaking uploads go through a route handler; server actions only carry text.
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Microphone is needed for Speaking practice on our own origin only.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          ...(process.env.NODE_ENV === "production" ? PRODUCTION_HEADERS : []),
        ],
      },
    ];
  },
};

export default nextConfig;
