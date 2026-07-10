import type { Metadata, Viewport } from 'next';
import './globals.css';

// Publisher ID do Google AdSense — necessario para o Google revisar e
// aprovar o site. O bloco de anuncio de verdade (data-ad-slot) so entra em
// components/AdInterstitial.tsx depois que a conta for aprovada.
const ADSENSE_CLIENT = 'ca-pub-3958503944876278';

const SITE_URL = 'https://droplife.life';
const SITE_NAME = 'DropLife Brasil';
const SITE_DESC =
  'Jogo gratuito de geografia: nasça em um dos 5.570 municípios brasileiros sorteados por população, colecione cidades no Citydex, desbloqueie conquistas e dispute o ranking global.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DropLife Brasil — Nasça em um município brasileiro',
    template: '%s | DropLife Brasil',
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  keywords: [
    'droplife',
    'droplife brasil',
    'jogo de geografia',
    'municípios do Brasil',
    'jogo do brasil',
    'mapa do brasil interativo',
    'citydex',
    'jogo de nascer em cidade',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'DropLife Brasil — Nasça em um município brasileiro',
    description: SITE_DESC,
    locale: 'pt_BR',
    images: [{ url: '/Img/LOGO 1.png', width: 1200, height: 630, alt: 'DropLife Brasil' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropLife Brasil — Nasça em um município brasileiro',
    description: SITE_DESC,
    images: ['/Img/LOGO 1.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'games',
};

// Dados estruturados (JSON-LD): ajudam o Google a entender que é um jogo
// de navegador gratuito em pt-BR e a exibir rich results.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESC,
  inLanguage: 'pt-BR',
  genre: ['Geografia', 'Casual', 'Colecionável'],
  gamePlatform: 'Web Browser',
  playMode: 'SinglePlayer',
  isAccessibleForFree: true,
  applicationCategory: 'Game',
  image: `${SITE_URL}/Img/LOGO%201.png`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
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
            Fica sempre ligada (verificacao do AdSense); o que esta
            desligado e so o modal intersticial (INTERSTITIAL_ENABLED
            em lib/ads.ts). */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {/* Google tag (gtag.js) — Google Analytics.
            O script remoto só é injetado após o load da página, fora do
            caminho crítico (TBT); os eventos ficam na fila do dataLayer e
            são processados quando ele chega — o pageview não se perde. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-3MDPXZVTKL');
window.addEventListener('load', function () {
  setTimeout(function () {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-3MDPXZVTKL';
    document.head.appendChild(s);
  }, 1500);
});`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
