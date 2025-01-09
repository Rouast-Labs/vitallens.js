import { VitalLensBase } from './VitalLens.base';
import { VitalLensController } from './VitalLensController.browser';
import { VitalLensOptions } from '../types/core';
import { IVitalLensController } from '../types/IVitalLensController';

export class VitalLens extends VitalLensBase {
  protected createController(options: VitalLensOptions): IVitalLensController {
    return new VitalLensController(options);
  }
}
