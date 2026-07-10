// Cartão de resultado do Desafio Diário (estilo Wordle): imagem gerada em
// canvas no navegador, sem servidor e sem revelar a cidade — quem vê o card
// fica curioso para jogar e descobrir a sua.
import type { RarityTier } from './rarity';
import { formatPop } from './text';

export interface DailyCardData {
  date: string; // 'AAAA-MM-DD'
  tier: RarityTier;
  chance: string;
  population: number;
}

const W = 1080;
const H = 1080;

// Medalha com fita (mesmo desenho dos ícones do jogo), escalada via ctx
const drawMedal = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  dark: string
) => {
  const s = size / 24; // desenho original em viewBox 24x24
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);

  // fitas
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(7, 1.4);
  ctx.lineTo(11.4, 1.4);
  ctx.lineTo(8.7, 9.2);
  ctx.lineTo(4.4, 8.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(17, 1.4);
  ctx.lineTo(12.6, 1.4);
  ctx.lineTo(15.3, 9.2);
  ctx.lineTo(19.6, 8.2);
  ctx.closePath();
  ctx.fill();

  // círculo
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(12, 14.8, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // estrela
  ctx.fillStyle = '#ffffff';
  const star: Array<[number, number]> = [
    [12, 11.3], [13.1, 13.5], [15.5, 13.85], [13.75, 15.55], [14.15, 17.95],
    [12, 16.8], [9.85, 17.95], [10.25, 15.55], [8.5, 13.85], [10.9, 13.5],
  ];
  ctx.beginPath();
  star.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const buildDailyCard = async (data: DailyCardData): Promise<Blob | null> => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const [y, m, d] = data.date.split('-');
    const font = (weight: number, px: number) =>
      `${weight} ${px}px 'Segoe UI', system-ui, -apple-system, sans-serif`;

    // fundo creme + brilhos suaves (mesma paleta do site)
    ctx.fillStyle = '#fff8e9';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 180, 60, W / 2, 180, 620);
    glow.addColorStop(0, 'rgba(88, 204, 2, 0.10)');
    glow.addColorStop(1, 'rgba(88, 204, 2, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // moldura
    ctx.strokeStyle = '#eddcab';
    ctx.lineWidth = 10;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    ctx.textAlign = 'center';

    // cabeçalho
    ctx.fillStyle = '#2e2a1f';
    ctx.font = font(800, 64);
    ctx.fillText('DROPLIFE BRASIL', W / 2, 150);
    ctx.fillStyle = '#948d76';
    ctx.font = font(700, 40);
    ctx.fillText(`Desafio Diário • ${d}/${m}/${y}`, W / 2, 215);

    // medalha central
    drawMedal(ctx, W / 2, 490, 420, data.tier.color, darkOf(data.tier.color));

    // tier
    ctx.fillStyle = data.tier.color;
    ctx.font = font(800, 88);
    ctx.fillText(data.tier.label.toUpperCase(), W / 2, 790);

    // stats (sem o nome da cidade: sem spoiler!)
    ctx.fillStyle = '#5c5643';
    ctx.font = font(700, 42);
    ctx.fillText(`Nasci numa cidade de ${formatPop(data.population)} habitantes`, W / 2, 865);
    ctx.fillText(`Chance: ${data.chance}%`, W / 2, 925);

    // rodapé
    ctx.fillStyle = '#3ca002';
    ctx.font = font(800, 46);
    ctx.fillText('Onde você vai nascer?  droplife.life', W / 2, 1010);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    );
  } catch {
    return null;
  }
};

// tom escuro da medalha por cor do tier (mesmos pares dos ícones)
const darkOf = (color: string): string =>
  ({
    '#f59e0b': '#b45309',
    '#a78bfa': '#7c5cd6',
    '#38bdf8': '#0d8fce',
    '#34d399': '#0fa571',
    '#94a3b8': '#64748b',
  })[color] || '#64748b';

// Compartilha o card: Web Share com arquivo (celular) > copiar imagem
// (desktop) > download. Retorna a mensagem de feedback para o toast.
export const shareDailyCard = async (data: DailyCardData, text: string): Promise<string> => {
  const blob = await buildDailyCard(data);
  if (!blob) return fallbackText(text);

  const file = new File([blob], 'droplife-desafio.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'Resultado compartilhado! 🎉';
    } catch {
      // usuário cancelou o share — cai para as outras opções
    }
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'Imagem copiada! Cole onde quiser. 🖼️';
  } catch {
    // clipboard de imagem indisponível — baixa o arquivo
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'droplife-desafio.png';
    a.click();
    URL.revokeObjectURL(url);
    return 'Imagem baixada! 📥';
  } catch {
    return fallbackText(text);
  }
};

const fallbackText = async (text: string): Promise<string> => {
  try {
    await navigator.clipboard.writeText(text);
    return 'Resultado copiado! Cole onde quiser. 📋';
  } catch {
    return 'Não foi possível compartilhar o resultado.';
  }
};
