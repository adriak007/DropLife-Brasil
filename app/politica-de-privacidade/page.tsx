import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade — DropLife Brasil',
};

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="legal-page">
      <div className="legal-page__card">
        <Link href="/" className="legal-page__back">
          ← Voltar ao jogo
        </Link>
        <h1>Política de Privacidade</h1>
        <p className="legal-page__updated">Última atualização: julho de 2026</p>

        <h2>1. O que é o DropLife Brasil</h2>
        <p>
          O DropLife Brasil é um jogo casual e gratuito em que você é sorteado para &quot;nascer&quot;
          em um dos municípios brasileiros, ponderado pela população de cada um. Esta página
          explica quais dados coletamos, para quê e com quem eles são compartilhados.
        </p>

        <h2>2. Dados salvos apenas no seu navegador</h2>
        <p>
          Sua coleção de cidades, conquistas e progresso do desafio diário ficam guardados no{' '}
          <code>localStorage</code> do seu navegador. Esses dados não saem do seu aparelho a menos
          que você crie uma conta (seção 3).
        </p>

        <h2>3. Conta e ranking global</h2>
        <p>
          Se você optar por criar uma conta para participar do ranking global, coletamos e-mail,
          apelido e as cidades em que você nasceu. Esses dados ficam armazenados com o Supabase,
          nosso provedor de banco de dados e autenticação. Você pode entrar por e-mail/senha ou
          por login do Google — nesse caso, o Google compartilha conosco seu nome e e-mail
          associados à conta escolhida. Você pode excluir sua conta e os dados associados a
          qualquer momento entrando em contato pelo e-mail no fim desta página.
        </p>

        <h2>4. Anúncios</h2>
        <p>
          Exibimos anúncios por meio do Google AdSense para manter o jogo gratuito. O Google e
          seus parceiros podem usar cookies e identificadores do aparelho para exibir anúncios
          com base nas suas visitas a este e a outros sites. Você pode ajustar ou desativar a
          personalização de anúncios do Google em{' '}
          <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
            adssettings.google.com
          </a>
          .
        </p>

        <h2>5. Cookies</h2>
        <p>
          Usamos cookies e armazenamento local apenas para manter você conectado, lembrar seu
          progresso e permitir a exibição de anúncios. Não vendemos seus dados a terceiros.
        </p>

        <h2>6. Seus direitos (LGPD)</h2>
        <p>
          Você pode solicitar a qualquer momento a confirmação, o acesso, a correção ou a
          exclusão dos seus dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei nº
          13.709/2018). Para isso, entre em contato pelo e-mail abaixo.
        </p>

        <h2>7. Contato</h2>
        <p>
          Dúvidas sobre esta política ou sobre seus dados: <strong>adriak007@gmail.com</strong>
        </p>
      </div>
    </main>
  );
}
