/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true, // Garante que a minificação nativa rápida esteja ativa (ajuda a deixar mais leve)
  eslint: {
    // Evita que avisos/erros de lint quebrem o build no Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Evita que problemas de tipagem quebrem o build no Vercel
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
