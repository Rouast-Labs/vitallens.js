export interface MethodConfig {
  method: 'vitallens' | 'pos' | 'chrom' | 'g';
  fpsTarget: number; // Target inference frames per second
  roiMethod: 'face' | 'upper_body';
  inputSize?: number; // Optional: Spatial size for inference
  minWindowLength: number; // Minimum length of the inference window
  maxWindowLength: number; // Maximum length of the inference window
  windowOverlap: number; // Overlap of inference windows
  requiresState: boolean; // Whether the method requires recurrent state
}

export const METHODS_CONFIG: Record<string, MethodConfig> = {
  vitallens: {
    method: 'vitallens',
    roiMethod: 'upper_body',
    fpsTarget: 30,
    inputSize: 40,
    minWindowLength: 4,
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
    windowOverlap: 47,
    requiresState: false
  },
};
