export interface MethodConfig {
  method: 'vitallens' | 'pos' | 'chrom' | 'g';
  fpsTarget: number;
  roiMethod: 'face' | 'upper_body';
  inputSize?: number;
  minWindowLength: number;
  minWindowLengthState?: number;
  maxWindowLength: number;
  windowOverlap: number;
  requiresState: boolean;
}

export const METHODS_CONFIG: Record<string, MethodConfig> = {
  vitallens: {
    method: 'vitallens',
    roiMethod: 'upper_body',
    fpsTarget: 30,
    inputSize: 40,
    minWindowLength: 16,
    minWindowLengthState: 4,
    maxWindowLength: 900,
    windowOverlap: 0,
    requiresState: true
  },
  pos: {
    method: 'pos',
    roiMethod: 'face',
    fpsTarget: 30,
    minWindowLength: 48,
    maxWindowLength: 48,
    windowOverlap: 47,
    requiresState: false
  },
  chrom: {
    method: 'chrom',
    roiMethod: 'face',
    fpsTarget: 30,
    minWindowLength: 48,
    maxWindowLength: 48,
    windowOverlap: 47,
    requiresState: false
  },
  g: {
    method: 'g',
    roiMethod: 'face',
    fpsTarget: 30,
    minWindowLength: 64,
    maxWindowLength: 64,
    windowOverlap: 63,
    requiresState: false
  },
};
