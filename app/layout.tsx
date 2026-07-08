import type { Metadata, Viewport } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
