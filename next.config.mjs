/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Otimização de imagens (compressão automática)
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Compressão gzip/brotli das respostas HTTP
  compress: true,
  // Evita bundling server-only packages no client
  serverExternalPackages: [],
  experimental: {
    // Otimiza Server Actions (reduz roundtrips)
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Headers para Digital Asset Links (TWA/Android verificação)
  async headers() {
    return [
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
