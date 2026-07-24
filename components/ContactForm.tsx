'use client';

import { useState } from 'react';

// Mesmo destino usado no botão de feedback do jogo, apenas ofuscado no
// bundle para reduzir raspagem automatizada do endereço
const DEST = atob('YWRyaWFrMDA3QGdtYWlsLmNvbQ==');
const ENDPOINT = `https://formsubmit.co/ajax/${DEST}`;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactForm() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending' || mensagem.trim().length < 5) return;
    setStatus('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: '[DropLife] Contato pelo site',
          _template: 'table',
          _captcha: 'false',
          nome: nome.trim() || 'não informado',
          email_para_resposta: email.trim() || 'não informado',
          mensagem: mensagem.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && String(data.success) === 'true') {
        setStatus('sent');
        setNome('');
        setEmail('');
        setMensagem('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="contact-done">
        <span className="contact-done__emoji">💚</span>
        <p className="contact-done__title">Mensagem enviada!</p>
        <p className="contact-done__sub">
          Obrigado por entrar em contato. Costumo responder em poucos dias.
        </p>
        <button className="fb-send" type="button" onClick={() => setStatus('idle')}>
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={enviar}>
      <label className="contact-form__field">
        Seu nome (opcional)
        <input
          type="text"
          value={nome}
          maxLength={100}
          placeholder="Como podemos te chamar?"
          onChange={(e) => setNome(e.target.value)}
        />
      </label>

      <label className="contact-form__field">
        Seu e-mail (opcional, para respondermos)
        <input
          type="email"
          value={email}
          maxLength={150}
          placeholder="seuemail@exemplo.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="contact-form__field">
        Mensagem *
        <textarea
          className="fb-textarea"
          value={mensagem}
          maxLength={2000}
          rows={6}
          required
          placeholder="Conta pra gente sua dúvida, sugestão ou problema…"
          onChange={(e) => {
            setMensagem(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
        />
      </label>

      {status === 'error' && (
        <p className="fb-error">Não foi possível enviar agora. Tenta de novo em instantes?</p>
      )}

      <button className="fb-send" type="submit" disabled={status === 'sending' || mensagem.trim().length < 5}>
        {status === 'sending' ? 'Enviando…' : 'Enviar mensagem 📨'}
      </button>
    </form>
  );
}
