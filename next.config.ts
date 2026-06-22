import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-inline required by Next.js for inline script chunks; unsafe-eval removed (not needed in production)
              "script-src 'self' 'unsafe-inline'",
              // unsafe-inline required for Next.js style injection; Google Fonts allowed
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: self, data URIs, blob (Next Image), and Supabase storage
              "img-src 'self' data: blob: https://nquixbakqqjllhvvnydr.supabase.co",
              // Video/audio blobs for media
              "media-src 'self' data: blob:",
              // API calls: self + Supabase + WhatsApp (wa.me redirects open in new tab so no connect needed)
              "connect-src 'self' https://nquixbakqqjllhvvnydr.supabase.co",
              // Fonts: self + Google Fonts CDN
              "font-src 'self' data: https://fonts.gstatic.com",
              // Deny being embedded in iframes on external sites
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
