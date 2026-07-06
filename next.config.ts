import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Exporta o site como arquivos estáticos (pasta out/), publicável em
  // GitHub Pages, Vercel ou qualquer hospedagem estática.
  output: 'export',
};

export default nextConfig;
