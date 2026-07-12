export interface Municipio {
  municipio: string;
  estado: string;
  populacao: number;
}

export interface CityData {
  city: string;
  state: string;
  population: number | null;
  key: string;
}

export interface CityModalData {
  city: string;
  state: string;
  population: number | null;
  curiosity: string;
  chance?: string;
  key?: string;
  daily?: string; // 'AAAA-MM-DD' quando veio do desafio diário
  isNewCapture?: boolean;
  // Resultado do palpite do Desafio Diário (só quando `daily` está presente)
  dailyCorrect?: boolean;
  dailyGuessCity?: string;
  dailyGuessState?: string;
}

export interface PickedCity {
  key: string;
  city: string;
  state: string;
  population: number;
  chance: string;
  curiosity: string;
}

export interface StateStats {
  uf: string;
  municipios: number;
  population: number;
}

export type ModalState =
  | { type: 'message'; title: string; message: string }
  | { type: 'city'; data: CityModalData }
  | null;

export type PanelKind =
  | 'citydex'
  | 'conquistas'
  | 'estados'
  | 'ranking'
  | 'configuracoes'
  | null;

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StateEntry {
  paths: SVGPathElement[];
  bbox: BBox | null;
}
