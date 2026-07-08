import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
