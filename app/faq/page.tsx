import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Perguntas Frequentes — DropLife Brasil',
  description:
    'Tire suas dúvidas sobre o DropLife Brasil: como funciona o sorteio de cidades, as raridades, o desafio diário, o ranking e a sua conta.',
};

export default function FaqPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__card">
        <Link href="/" className="legal-page__back">
          ← Voltar ao jogo
        </Link>
        <h1>Perguntas Frequentes</h1>
        <p className="legal-page__updated">Última atualização: julho de 2026</p>

        <h2>O que é o DropLife Brasil?</h2>
        <p>
          É um jogo casual e gratuito de geografia. A cada clique em &quot;Nascer&quot;, você é
          sorteado para nascer em um dos 5.570 municípios do Brasil. O sorteio é ponderado pela
          população de cada cidade: nascer em São Paulo é comum, nascer em um município pequeno
          como Serra da Saudade (MG), com pouco mais de 800 habitantes, é raríssimo.
        </p>

        <h2>Como funciona a raridade das cidades?</h2>
        <p>
          Cada município cai em uma de cinco raridades — Comum, Incomum, Raro, Épico ou Lendário —
          calculadas a partir da população. Cidades muito populosas concentram a maior parte das
          chances; cidades pequenas são as mais difíceis de sortear e por isso valem mais. A
          probabilidade aproximada é de ~60% Comum, ~23% Incomum, ~12% Raro, ~4,7% Épico e ~1%
          Lendário.
        </p>

        <h2>O que é o Citydex?</h2>
        <p>
          É a sua coleção pessoal: toda cidade em que você já nasceu fica registrada lá, com a
          curiosidade, a raridade e a imagem do município. A ideia é parecida com um álbum de
          figurinhas — o objetivo é ir preenchendo o mapa inteiro do Brasil.
        </p>

        <h2>O que é o Desafio Diário?</h2>
        <p>
          Todo dia o jogo sorteia uma cidade — a mesma para todos os jogadores. O nome e o estado
          dela aparecem em um banner, e você precisa clicar no mapa no local exato onde acha que
          ela fica. Acertando ou errando, o resultado sempre conta para o seu Citydex, e você pode
          compartilhar seu resultado com os amigos.
        </p>

        <h2>Preciso criar uma conta para jogar?</h2>
        <p>
          Não. Você pode jogar como convidado e seu progresso fica salvo no seu próprio navegador.
          Se quiser aparecer no ranking global e não perder o progresso ao trocar de aparelho,
          basta criar uma conta gratuita — e o progresso que você já tinha como convidado é
          aproveitado automaticamente.
        </p>

        <h2>Perdi meu progresso, o que aconteceu?</h2>
        <p>
          Se você jogou sem conta, o progresso fica salvo apenas naquele navegador/aparelho —
          limpar os dados do site ou trocar de navegador reinicia o Citydex. Criar uma conta evita
          esse problema, já que o progresso passa a ser guardado no servidor.
        </p>

        <h2>O jogo tem som?</h2>
        <p>
          Sim — música de fundo e efeitos sonoros ao nascer, ao completar conquistas e durante o
          sorteio. Você pode ligar, desligar ou ajustar o volume de cada um separadamente em{' '}
          <strong>Configurações</strong>.
        </p>

        <h2>Como faço para banir/reportar um jogador do ranking?</h2>
        <p>
          Se encontrar alguém usando métodos indevidos para subir no ranking, use o botão{' '}
          <strong>Feedback</strong> dentro do jogo para nos avisar, com o máximo de detalhes
          possível.
        </p>

        <h2>Encontrei um bug ou tenho uma sugestão, o que faço?</h2>
        <p>
          Manda pra gente! Use o botão <strong>Feedback</strong> dentro do jogo ou a nossa{' '}
          <Link href="/contato">página de contato</Link>.
        </p>

        <h2>O jogo tem anúncios?</h2>
        <p>
          O DropLife é e continuará sendo gratuito. Para isso, exibimos anúncios através do Google
          AdSense. Mais detalhes sobre como isso funciona estão na nossa{' '}
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </main>
  );
}
