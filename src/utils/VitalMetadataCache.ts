import { getCoreSync } from '../core/wasmProvider';

export class VitalMetadataCache {
  private static cache: Record<string, any> = {};

  public static getMeta(id: string): any {
    if (this.cache[id]) return this.cache[id];
    try {
      const core = getCoreSync();
      // The exact property names will depend on your WASM bindgen (usually camelCase)
      const meta = core.getVitalInfo(id);
      if (meta) {
        this.cache[id] = meta;
        return meta;
      }
    } catch (e) {
      // Core might not be initialized yet, or vital ID not found
    }
    return null;
  }
}