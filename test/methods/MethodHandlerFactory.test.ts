import { MethodHandlerFactory } from '../../src/methods/MethodHandlerFactory';
import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { POSHandler } from '../../src/methods/POSHandler';
import { VitalLensOptions, MethodHandler } from '../../src/types/core';

describe('MethodHandlerFactory', () => {
  const mockOptions: VitalLensOptions = {
    method: 'vitallens',
    fps: 30,
    roi: { x: 50, y: 50, width: 200, height: 200 },
    apiEndpoint: 'wss://api.vitallens.com',
  };

  it('should return a VitalLensAPIHandler for the "vitallens" method', () => {
    const handler: MethodHandler = MethodHandlerFactory.createHandler('vitallens', mockOptions);
    expect(handler).toBeInstanceOf(VitalLensAPIHandler);
  });

  it('should return a POSHandler for the "pos" method', () => {
    const handler: MethodHandler = MethodHandlerFactory.createHandler('pos', { ...mockOptions, method: 'pos' });
    expect(handler).toBeInstanceOf(POSHandler);
  });

  it('should throw an error for an unsupported method', () => {
    expect(() => MethodHandlerFactory.createHandler('unsupported', mockOptions)).toThrow(
      'Unsupported method: unsupported'
    );
  });
});
