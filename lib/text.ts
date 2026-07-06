export const normalize = (value = ''): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

// Repara strings com encoding quebrado (UTF-8 lido como Latin-1) presentes
// em alguns JSONs de curiosidades.
export const repairText = (str = ''): string => {
  if (!str) return '';
  let out = str;
  const hasBrokenMarks =
    /[ÃÂÊÔÕÄËÏÖÜ]/.test(out) ||
    /�/.test(out);
  if (hasBrokenMarks) {
    try {
      const bytes = Uint8Array.from([...out].map((ch) => ch.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (decoded) out = decoded;
    } catch {}
    try {
      const decoded = decodeURIComponent(escape(out));
      if (decoded) out = decoded;
    } catch {}
  }
  out = out.replace(/�0/g, 'É');
  out = out.replace(/�/g, '').replace(/\s{2,}/g, ' ').trim();
  if (/^0\s/.test(out)) out = out.replace(/^0\s+/, 'É ');
  return out;
};

export const keyFor = (city: string, state: string): string =>
  `${normalize(city)}-${normalize(state)}`;

export const cleanCity = (city: string): string => city.replace(/\s+\d+$/, '').trim();

export const formatPop = (num: number | null | undefined): string =>
  Number(num || 0).toLocaleString('pt-BR');

export const BRAZIL_TOTAL_POP = 205_000_000;

export const formatChance = (pop: number | null | undefined): string =>
  (((Number(pop) || 0) / BRAZIL_TOTAL_POP) * 100).toFixed(6).replace(/\.?0+$/, '');

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// Distância de edição simples com limite, para busca aproximada de municípios
export const editDistanceCap = (a: string, b: string, cap = 2): number => {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > cap) return cap + 1;
  const dp = Array.from({ length: la + 1 }, () => new Array<number>(lb + 1).fill(0));
  for (let i = 0; i <= la; i += 1) dp[i][0] = i;
  for (let j = 0; j <= lb; j += 1) dp[0][j] = j;
  for (let i = 1; i <= la; i += 1) {
    let rowMin = cap + 1;
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      rowMin = Math.min(rowMin, dp[i][j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return dp[la][lb];
};
