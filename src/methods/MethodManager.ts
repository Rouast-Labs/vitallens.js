// Centralized manager for all estimation methods.

import { MethodBase } from "./MethodBase";
import { VitalLensAPI } from "./VitalLensAPI";
import { POS } from "./POS";
import { CHROM } from "./CHROM";
import { G } from "./G";

export class MethodManager {
  private methods: { [key: string]: MethodBase } = {};

  constructor(apiUrl: string) {
    this.methods = {
      vitalLensAPI: new VitalLensAPI(apiUrl),
      pos: new POS(),
      chrom: new CHROM(),
      g: new G(),
    };
  }

  getMethod(name: string): MethodBase {
    if (!this.methods[name]) {
      throw new Error(`Method not found: ${name}`);
    }
    return this.methods[name];
  }
}
