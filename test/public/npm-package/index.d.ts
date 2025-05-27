export interface AstroSwephOptions {
  basePath?: string;
}

export interface CalculationParams {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  lonG: number;
  lonM: number;
  lonS: number;
  lonEW: string;
  latG: number;
  latM: number;
  latS: number;
  latNS: string;
  houseSystem: string;
  calculateNodes?: boolean;
  nodeMethod?: number;
  asteroidData?: {
    mode: 'range' | 'specific';
    start?: number;
    end?: number;
    list?: string;
  } | null;
}

export interface CalculationResult {
  planets: Array<any>;
  houses: Array<any>;
  ascmc: Array<any>;
  nodes?: any;
  asteroids?: any;
  error?: boolean;
  error_msg?: string;
}

declare class AstroSweph {
  constructor(options?: AstroSwephOptions);
  initialize(): Promise<AstroSweph>;
  calculate(params: CalculationParams): CalculationResult;
}

export default AstroSweph;