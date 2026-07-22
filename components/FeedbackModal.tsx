'use client';

import { useState } from 'react';
import { sfxTick } from '@/lib/sound';

// Destino ofuscado: a UI nunca mostra para onde vai, e o endereço não fica
// em texto plano no bundle
const DEST = atob('YWRyaWFrMDA3QGdtYWlsLmNvbQ==');
const ENDPOINT = `https://formsubmit.co/ajax/${DEST}`;

type Tipo = 'sugestao' | 'bug';
type Status = 'idle' | 'sending' | 'sent' | 'error';

interface Props {
  nickname: string | null;
  onClose: () => void;
}

export default function FeedbackModal({ nickname, onClose }: Props) {
  const [tipo, setTipo] = useState<Tipo>('sugestao');
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const enviar = async () => {
    if (status === 'sending' || mensagem.trim().length < 5) return;
    sfxTick();
    setStatus('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `[DropLife] ${tipo === 'bug' ? '🐛 Bug report' : '💡 Sugestão'}`,
          _template: 'table',
          _captcha: 'false',
          tipo: tipo === 'bug' ? 'Bug' : 'Sugestão',
          mensagem: mensagem.trim(),
          jogador: nickname || 'convidado (não logado)',
          navegador: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && String(data.success) === 'true') {
        setStatus('sent');
        setMensagem('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="modal-panel feedback-panel">
      <div className="modal-header">
        <h2>Sugestões e bugs 💬</h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      {status === 'sent' ? (
        <div className="fb-done">
          <span className="fb-done__emoji">💚</span>
          <p className="fb-done__title">Recebido, obrigado!</p>
          <p className="fb-done__sub">
            Sua mensagem foi enviada direto para o criador do jogo. Toda ideia e todo bug reportado
            ajudam o DropLife a melhorar!
          </p>
          <button className="fb-send" type="button" onClick={() => setStatus('idle')}>
            Enviar outra
          </button>
        </div>
      ) : (
        <div className="fb-body">
          <p className="fb-intro">
            Achou um bug ou tem uma ideia para o jogo? Manda aqui — vai direto para o criador do
            DropLife. 😉
          </p>

          <div className="fb-types" role="radiogroup" aria-label="Tipo de mensagem">
            <button
              className={`fb-type${tipo === 'sugestao' ? ' fb-type--active' : ''}`}
              type="button"
              role="radio"
              aria-checked={tipo === 'sugestao'}
              onClick={() => {
                sfxTick();
                setTipo('sugestao');
              }}
            >
              💡 Sugestão
            </button>
            <button
              className={`fb-type${tipo === 'bug' ? ' fb-type--active' : ''}`}
              type="button"
              role="radio"
              aria-checked={tipo === 'bug'}
              onClick={() => {
                sfxTick();
                setTipo('bug');
              }}
            >
              🐛 Bug
            </button>
          </div>

          <textarea
            className="fb-textarea"
            value={mensagem}
            maxLength={2000}
            rows={5}
            placeholder={
              tipo === 'bug'
                ? 'Descreva o bug: o que aconteceu, onde e o que você esperava que acontecesse…'
                : 'Conta sua ideia de melhoria para o jogo…'
            }
            onChange={(e) => {
              setMensagem(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
          />

          {status === 'error' && (
            <p className="fb-error">Não foi possível enviar agora. Tenta de novo em instantes?</p>
          )}

          <button
            className="fb-send"
            type="button"
            disabled={status === 'sending' || mensagem.trim().length < 5}
            onClick={enviar}
          >
            {status === 'sending' ? 'Enviando…' : 'Enviar 📨'}
          </button>
        </div>
      )}
    </div>
  );
}
