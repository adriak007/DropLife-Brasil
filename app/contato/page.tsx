import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contato — DropLife Brasil',
  description:
    'Fale com o criador do DropLife Brasil: dúvidas, sugestões, bugs ou parcerias. Respondemos em poucos dias.',
};

export default function ContatoPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__card">
        <Link href="/" className="legal-page__back">
          ← Voltar ao jogo
        </Link>
        <h1>Contato</h1>
        <p>
          O DropLife Brasil é feito e mantido por uma única pessoa. Se você tiver dúvidas,
          sugestões de melhoria, encontrou um bug, ou quer falar sobre parcerias, é só preencher o
          formulário abaixo — sua mensagem chega direto para o criador do jogo.
        </p>
        <p>
          Se preferir, também dá pra usar o botão <strong>Feedback</strong> disponível dentro do
          próprio jogo, ou consultar antes as <Link href="/faq">Perguntas Frequentes</Link>, onde
          já respondemos as dúvidas mais comuns.
        </p>

        <ContactForm />
      </div>
    </main>
  );
}
