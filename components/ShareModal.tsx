'use client';

import { useMemo, useState } from 'react';
import { sfxTick } from '@/lib/sound';

const SITE_URL = 'https://droplife.life';

interface Props {
  nickname: string | null;
  citydexCount: number;
  citydexTotal: number;
  achCount: number;
  achTotal: number;
  onClose: () => void;
}

export default function ShareModal({
  nickname,
  citydexCount,
  citydexTotal,
  achCount,
  achTotal,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);

  // Texto do convite: progresso real do jogador + chamada para jogar
  const shareText = useMemo(() => {
    const quem = nickname ? `Sou ${nickname} no DropLife Brasil!` : 'Estou jogando DropLife Brasil!';
    return [
      `🇧🇷 ${quem}`,
      `👶 Já nasci em ${citydexCount.toLocaleString('pt-BR')} das ${citydexTotal.toLocaleString('pt-BR')} cidades do Brasil`,
      `🏆 ${achCount}/${achTotal} conquistas desbloqueadas`,
      '',
      'Vem nascer você também e tenta me superar:',
    ].join('\n');
  }, [nickname, citydexCount, citydexTotal, achCount, achTotal]);

  const fullText = `${shareText}\n${SITE_URL}`;

  const openShare = (url: string) => {
    sfxTick();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyText = async () => {
    sfxTick();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard bloqueado (permissão/contexto): seleciona via prompt nativo
      window.prompt('Copie o texto abaixo:', fullText);
    }
  };

  const nativeShare = async () => {
    sfxTick();
    try {
      await navigator.share({ title: 'DropLife Brasil', text: shareText, url: SITE_URL });
    } catch {
      /* usuário cancelou o share sheet */
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="modal-panel share-panel">
      <div className="modal-header">
        <h2>Compartilhar 🚀</h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="share-body">
        <pre className="share-preview">{fullText}</pre>

        <div className="share-opts">
          <button
            className="share-opt share-opt--whatsapp"
            type="button"
            onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(fullText)}`)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.1 8.1 0 1 1 12 20.2Zm4.5-6c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.5 1.1 2.7c.1.2 1.9 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"
              />
            </svg>
            WhatsApp
          </button>
          <button
            className="share-opt share-opt--telegram"
            type="button"
            onClick={() =>
              openShare(
                `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(shareText)}`
              )
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.9 4.6 18.9 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.2c-.3.3-.5.5-.9.5l.3-4.7L18.4 6c.4-.3-.1-.5-.6-.2L7.3 12.4l-4.5-1.4c-1-.3-1-1 .2-1.4l17.6-6.8c.8-.3 1.5.2 1.3 1.8Z"
              />
            </svg>
            Telegram
          </button>
          <button
            className="share-opt share-opt--x"
            type="button"
            onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2 3h6.3l4.3 5.7L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"
              />
            </svg>
            X
          </button>
          <button className="share-opt share-opt--copy" type="button" onClick={copyText}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M16 1H4a2 2 0 0 0-2 2v13h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"
              />
            </svg>
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
          {canNativeShare && (
            <button className="share-opt share-opt--more" type="button" onClick={nativeShare}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18 16a3 3 0 0 0-2.4 1.2l-7-4a3 3 0 0 0 0-2.3l7-4A3 3 0 1 0 15 5a3 3 0 0 0 .1.7l-7 4a3 3 0 1 0 0 4.6l7 4A3 3 0 1 0 18 16Z"
                />
              </svg>
              Mais opções
            </button>
          )}
        </div>

        <p className="share-hint">
          💬 Para Discord e outros apps, use <strong>Copiar</strong> e cole na conversa.
        </p>
      </div>
    </div>
  );
}
