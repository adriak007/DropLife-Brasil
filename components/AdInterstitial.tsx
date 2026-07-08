'use client';

import { useEffect, useState } from 'react';

const MIN_WAIT_SECONDS = 5;

interface Props {
  onContinue: () => void;
}

export default function AdInterstitial({ onContinue }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(MIN_WAIT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  // Dispara o carregamento do anuncio assim que o AdSense estiver configurado
  // (ver lib/ads.ts). Sem o script do Google no <head>, isso e um no-op.
  useEffect(() => {
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // AdSense ainda nao configurado - o placeholder abaixo segue visivel
    }
  }, []);

  return (
    <div className="modal-backdrop modal-backdrop--open">
      <div className="modal-panel ad-interstitial">
        <span className="ad-interstitial__label">Publicidade</span>
        <div className="ad-interstitial__slot">
          {/* Troque por <ins class="adsbygoogle" data-ad-client="..."
              data-ad-slot="..." ...></ins> quando o AdSense for aprovado. */}
          <span className="ad-interstitial__placeholder">Espaço publicitário</span>
        </div>
        <button
          className="share-btn ad-interstitial__btn"
          type="button"
          disabled={secondsLeft > 0}
          onClick={onContinue}
        >
          {secondsLeft > 0 ? `Continuar (${secondsLeft}s)` : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
