import init, * as VitalLensCore from 'vitallens-core';
import wasmUri from 'vitallens-core/vitallens_core_bg.wasm';

let initPromise: Promise<typeof VitalLensCore> | null = null;

export function getCore(): Promise<typeof VitalLensCore> {
  if (!initPromise) {
    initPromise = init(wasmUri).then(() => VitalLensCore);
  }
  return initPromise;
}
