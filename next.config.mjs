/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    const headers = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
    ];
    return ["/r/:path*", "/api/room/:path*", "/api/rooms"].map((source) => ({ source, headers }));
  },

  // Packs are rendered at download time and embed the real skill markdown
  // read from skills/ (lib/pack.ts). Nothing imports those files, so tracing
  // cannot infer them: without this they are absent from the serverless
  // bundle and every download 500s in production while working locally.
  outputFileTracingIncludes: {
    "/api/room/[key]": ["./skills/**/*"],
    "/api/skills/[bundle]": ["./skills/**/*"],
  },
};

export default nextConfig;
