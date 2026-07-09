import type { Metadata, Viewport } from 'next';
import { ADS_ENABLED } from '@/lib/ads';
import './globals.css';

// Publisher ID do Google AdSense — necessario para o Google revisar e
// aprovar o site. O bloco de anuncio de verdade (data-ad-slot) so entra em
// components/AdInterstitial.tsx depois que a conta for aprovada.
const ADSENSE_CLIENT = 'ca-pub-3958503944876278';

export const metadata: Metadata = {
  title: 'DropLife Brasil',
  description:
    'Nasça em um município brasileiro sorteado por população e descubra curiosidades sobre ele.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Desliga o pinca-para-zoom nativo do navegador: o "zoom" do jogo e o do
  // mapa (tocar num estado), nao o da pagina inteira.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Tag literal, exatamente como o AdSense forneceu — nao usamos
            next/script aqui porque a estrategia "afterInteractive" injeta
            o <script> via JS apos a hidratacao, entao ele nao aparece
            palavra-por-palavra no HTML estatico que o Google verifica.
            Gated por ADS_ENABLED (lib/ads.ts): com a chave desligada o
            script nem entra no HTML. */}
        {ADS_ENABLED && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
