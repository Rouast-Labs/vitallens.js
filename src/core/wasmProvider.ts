import init, * as VitalLensCore from 'vitallens-core';
import wasmUri from 'vitallens-core/vitallens_core_bg.wasm';

let initPromise: Promise<typeof VitalLensCore> | null = null;
let resolvedCore: typeof VitalLensCore | null = null;

export function getCore(): Promise<typeof VitalLensCore> {
  if (!initPromise) {
    initPromise = init(wasmUri).then(() => {
      resolvedCore = VitalLensCore;
      return VitalLensCore;
    });
  }
  return initPromise;
}

export function getCoreSync(): typeof VitalLensCore {
  if (!resolvedCore) {
    throw new Error(
      'VitalLensCore is not initialized. Call await getCore() first.'
    );
  }
  return resolvedCore;
}
