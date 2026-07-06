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
}

export type ModalState =
  | { type: 'message'; title: string; message: string }
  | { type: 'city'; data: CityModalData }
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
