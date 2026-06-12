import fs from 'fs';
import path from 'path';

try {
  const filePath = path.join(process.cwd(), 'app', 'captacao', 'CaptacaoClient.tsx');
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    // If the file contains typical Mojibake characters, decode it
    if (content.includes('Ã£') || content.includes('Ã§') || content.includes('Ã¡') || content.includes('ðŸ')) {
      const fixedContent = Buffer.from(content, 'latin1').toString('utf8');
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log('✅ [Mojibake Fixer] CaptacaoClient.tsx spelling restored to Portuguese successfully!');
    }
  }
} catch (err) {
  console.error('❌ [Mojibake Fixer] Error fixing spelling:', err);
}

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
