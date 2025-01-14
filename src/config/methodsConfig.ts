export interface MethodConfig {
  fpsTarget: number; // Target inference frames per second
  inputSize?: number; // Optional: Spatial size for inference
  minWindowLength: number; // Minimum length of the inference window
  maxWindowLength: number; // Maximum length of the inference window
  requiresState: boolean; // Whether the method requires recurrent state
}

export const METHODS_CONFIG: Record<string, MethodConfig> = {
  vitallens: {
    fpsTarget: 30,
    inputSize: 40,
    minWindowLength: 4,
    maxWindowLength: 900,
    requiresState: true
  },
  pos: {
    fpsTarget: 30,
    minWindowLength: 48,
    maxWindowLength: 48,
    requiresState: false
  },
  chrom: {
    fpsTarget: 30,
    minWindowLength: 48,
    maxWindowLength: 48,
    requiresState: false
  },
  g: {
    fpsTarget: 30,
    minWindowLength: 64,
    maxWindowLength: 64,
    requiresState: false
  },
};
