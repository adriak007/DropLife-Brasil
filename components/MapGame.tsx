'use client';

import { useEffect, useRef, useState } from 'react';
import { MapController } from '@/lib/mapController';
import { formatPop } from '@/lib/text';
import type { ModalState } from '@/lib/types';

const LOGO_SRC = '/Img/LOGO 1.png';

const spawnRipple = (evt: React.PointerEvent<HTMLButtonElement>) => {
  const btn = evt.currentTarget;
  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${evt.clientX - rect.left - size / 2}px;top:${evt.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
};

function NavButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button className="nav-btn ui-btn" type="button" onPointerDown={spawnRipple}>
      <svg
        className="btn-icon"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="btn-label">{label}</span>
    </button>
  );
}

export default function MapGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTitleRef = useRef<HTMLDivElement>(null);
  const tooltipSubtitleRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    const tooltipTitle = tooltipTitleRef.current;
    const tooltipSubtitle = tooltipSubtitleRef.current;
    if (!container || !tooltip || !tooltipTitle || !tooltipSubtitle) return;

    const controller = new MapController({
      container,
      tooltip,
      tooltipTitle,
      tooltipSubtitle,
      setStatus,
      openMessageModal: (message, title = 'Aviso') =>
        setModal({ type: 'message', title, message }),
      openCityModal: (data) => setModal({ type: 'city', data }),
      onZoomChange: setZoomed,
    });
    controllerRef.current = controller;

    let cancelled = false;
    controller.init().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const modalTitle =
    modal?.type === 'message'
      ? modal.title
      : modal?.type === 'city' && modal.data.chance
        ? `Voce nasceu em ${modal.data.city}!`
        : 'Detalhes do municipio';

  const cityData = modal?.type === 'city' ? modal.data : null;
  const popText = cityData?.population
    ? `${formatPop(cityData.population)} habitantes`
    : 'Populacao indisponivel';

  return (
    <>
      {/* Loading screen */}
      <div className={`loading-screen${loading ? '' : ' hidden'}`}>
        <img className="loading-logo" src={LOGO_SRC} alt="DropLife" />
        <div className="loading-bar"></div>
        <span className="loading-text">Carregando Brasil&hellip;</span>
      </div>

      <div className="frame">
        <div className="game-logo">
          <img src={LOGO_SRC} alt="DropLife logo" />
        </div>

        <div className="controls bottom-bar" role="navigation" aria-label="Menu principal">
          <NavButton label="Populacao">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </NavButton>

          <NavButton label="Citydex">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </NavButton>

          <button
            id="birthBtn"
            type="button"
            onPointerDown={spawnRipple}
            onClick={() => controllerRef.current?.pickRandomCity()}
          >
            <span className="btn-label">Nascer</span>
          </button>

          <NavButton label="Estados">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </NavButton>

          <NavButton label="Conquistas">
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </NavButton>
        </div>

        <div className="map-wrap" ref={containerRef}></div>
      </div>

      {/* Barra de status (oculta via CSS, mantida para leitores de tela) */}
      <p className="status-bar" role="status" aria-live="polite">
        {status}
      </p>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="city-tooltip hidden"
        aria-live="polite"
        aria-hidden="true"
        onClick={(evt) => evt.stopPropagation()}
      >
        <div className="city-tooltip__header">
          <div className="city-tooltip__title" ref={tooltipTitleRef}></div>
          <div className="city-tooltip__actions">
            <button
              className="city-tooltip__btn city-tooltip__btn--info"
              type="button"
              aria-label="Detalhes do municipio"
              onClick={(evt) => {
                evt.stopPropagation();
                controllerRef.current?.openPinnedCityDetails();
              }}
            >
              i
            </button>
            <button
              className="city-tooltip__btn city-tooltip__btn--close"
              type="button"
              aria-label="Fechar"
              onClick={(evt) => {
                evt.stopPropagation();
                controllerRef.current?.clearPinnedTooltip();
              }}
            >
              &#x2715;
            </button>
          </div>
        </div>
        <div className="city-tooltip__subtitle" ref={tooltipSubtitleRef}></div>
      </div>

      <button
        className={`zoom-reset${zoomed ? ' zoom-reset--visible' : ''}`}
        type="button"
        onClick={() => controllerRef.current?.resetZoom()}
      >
        Voltar
      </button>

      {/* Modal */}
      <div
        className={`modal-backdrop${modal ? ' modal-backdrop--open' : ''}`}
        onClick={(evt) => {
          evt.stopPropagation();
          if (!(evt.target as Element).closest('.modal-panel')) setModal(null);
        }}
      >
        <div className="modal-panel">
          <div className="modal-header">
            <h2>{modalTitle}</h2>
            <button className="modal-close" type="button" onClick={() => setModal(null)}>
              Fechar
            </button>
          </div>
          <div className="modal-body">
            <p className={`modal-message${modal?.type === 'message' ? '' : ' hidden'}`}>
              {modal?.type === 'message' ? modal.message : ''}
            </p>
            <div className={`modal-city${cityData ? '' : ' hidden'}`}>
              <p className="modal-city__meta">
                {cityData ? `${cityData.state} • ${popText}` : ''}
              </p>
              <p className={`modal-city__chance${cityData?.chance ? '' : ' hidden'}`}>
                {cityData?.chance ? `Probabilidade de nascer aqui: ${cityData.chance}%` : ''}
              </p>
              <p className="modal-city__curiosity">
                {cityData ? cityData.curiosity || 'Curiosidade nao disponivel.' : ''}
              </p>
              <p className="modal-city__placeholder">Mais dados em breve&hellip;</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
