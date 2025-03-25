/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { MethodHandlerFactory } from '../../src/methods/MethodHandlerFactory';
import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { POSHandler } from '../../src/methods/POSHandler';
import { GHandler } from '../../src/methods/GHandler';
import { CHROMHandler } from '../../src/methods/CHROMHandler';
import { IRestClient } from '../../src/types/IRestClient';
import { VitalLensOptions } from '../../src/types/core';

describe('MethodHandlerFactory', () => {
  const mockRestClient: Partial<IRestClient> = {
    sendFrames: jest.fn(),
  };

  const mockOptionsAPI: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };

  const mockOptionsPOS: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'pos',
    requestMode: 'rest',
  };

  const mockOptionsG: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'g',
    requestMode: 'rest',
  };

  const mockOptionsCHROM: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'chrom',
    requestMode: 'rest',
  };

  it('should create a VitalLensAPIHandler when method is "vitallens" and RestClient is provided', () => {
    const handler = MethodHandlerFactory.createHandler(mockOptionsAPI, {
      restClient: mockRestClient as IRestClient,
    });
    expect(handler).toBeInstanceOf(VitalLensAPIHandler);
  });

  it('should throw an error if RestClient is not provided for VitalLensAPIHandler', () => {
    expect(() => {
      MethodHandlerFactory.createHandler(mockOptionsAPI);
    }).toThrow('RestClient is required for VitalLensAPIHandler');
  });

  it('should create a POSHandler when method is "pos"', () => {
    const handler = MethodHandlerFactory.createHandler(mockOptionsPOS);
    expect(handler).toBeInstanceOf(POSHandler);
  });

  it('should create a GHandler when method is "g"', () => {
    const handler = MethodHandlerFactory.createHandler(mockOptionsG);
    expect(handler).toBeInstanceOf(GHandler);
  });

  it('should create a CHROMHandler when method is "chrom"', () => {
    const handler = MethodHandlerFactory.createHandler(mockOptionsCHROM);
    expect(handler).toBeInstanceOf(CHROMHandler);
  });
});
