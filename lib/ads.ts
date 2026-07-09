// Controle do anuncio intersticial: a cada N cliques em "Nascer" (nao conta
// o desafio diario), mostra um anuncio de tela cheia antes do resultado.
//
// Como ligar o AdSense de verdade quando a conta for aprovada:
// 1. Adicione o script de verificacao do AdSense em app/layout.tsx (o Google
//    fornece um <script> com seu Publisher ID ao criar a conta).
// 2. Crie public/ads.txt com a linha que o AdSense pedir (algo como
//    "google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0").
// 3. Em components/AdInterstitial.tsx, troque o placeholder pelo bloco
//    <ins class="adsbygoogle" data-ad-client="..." data-ad-slot="..." ...>
//    real (o Google gera esse trecho no painel ao criar um bloco de anuncio).
//
// Nunca clique nos proprios anuncios, nem para testar — isso viola a
// politica do AdSense e pode banir a conta permanentemente.

// Chave do modal intersticial: false desliga so o modal de anuncio a cada N
// nascimentos (sem bloco de anuncio aprovado ele apareceria vazio). O script
// do AdSense em app/layout.tsx fica sempre ligado para a verificacao do
// Google. Quando os blocos forem aprovados, mude para true.
export const INTERSTITIAL_ENABLED = false;

const AD_COUNTER_KEY = 'droplife-ad-counter';
const AD_EVERY_N = 5;

// Incrementa o contador de nascimentos da sessao e diz se chegou a hora de
// mostrar o anuncio (e ja reseta o contador nesse caso).
export const bumpBirthCounterAndCheckAd = (): boolean => {
  if (!INTERSTITIAL_ENABLED) return false;
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(AD_COUNTER_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    if (count >= AD_EVERY_N) {
      sessionStorage.setItem(AD_COUNTER_KEY, '0');
      return true;
    }
    sessionStorage.setItem(AD_COUNTER_KEY, String(count));
    return false;
  } catch {
    return false; // sessionStorage bloqueado (modo privado etc.) - sem anuncio
  }
};
