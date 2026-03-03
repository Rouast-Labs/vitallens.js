import {
  getROIForMethod,
  getRepresentativeROI,
  getUnionROI,
  checkFaceInROI,
  checkROIInFace,
} from '../../src/utils/faceOps';
import { MethodConfig, ROI } from '../../src/types/core';
import { getCore } from '../../src/core/wasmProvider';
import { describe, expect, beforeAll, vi, it } from 'vitest';

vi.mock('../../src/core/wasmProvider', () => {
  const mockCore = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    calculateRoi: vi.fn((rect, method, detector, w, h, forceEven) => {
      // Return a dummy rect that mimics what the Rust core would output
      return { x: 116, y: 112, width: 48, height: 96 };
    }),
  };
  return {
    getCore: vi.fn().mockResolvedValue(mockCore),
  };
});

describe('getROIForMethod', () => {
  beforeAll(async () => {
    await getCore();
  });

  it('calls Wasm core calculateRoi and formats the output correctly', async () => {
    const core = await getCore();
    const det = { x0: 100, y0: 100, x1: 180, y1: 220, confidence: 0.95 };
    const methodConfig: MethodConfig = {
      roiMethod: 'face',
      method: 'vitallens',
      fpsTarget: 1,
      minWindowLength: 0,
      maxWindowLength: 10,
      requiresState: false,
      bufferOffset: 1,
      supportedVitals: [],
    };
    const clipDims = { width: 220, height: 300 };

    const result = getROIForMethod(det, methodConfig, clipDims);

    expect(result).toEqual({
      x0: 116,
      y0: 112,
      x1: 164,
      y1: 208,
      confidence: 0.95,
    });

    expect(core.calculateRoi).toHaveBeenCalledWith(
      { x: 100, y: 100, width: 80, height: 120 },
      'Face',
      'Default',
      220,
      300,
      false
    );
  });
});

describe('getRepresentativeROI', () => {
  it('returns the ROI closest to the mean ROI', () => {
    const rois = [
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 5, y0: 5, x1: 17, y1: 17 },
      { x0: 10, y0: 10, x1: 24, y1: 24 },
    ];
    const result = getRepresentativeROI(rois);
    expect(result).toEqual({ x0: 5, y0: 5, x1: 17, y1: 17 });
  });
});

describe('getUnionROI', () => {
  it('returns the union ROI that encompasses all input ROIs', () => {
    const rois = [
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 5, y0: 5, x1: 25, y1: 25 },
      { x0: 15, y0: 15, x1: 25, y1: 25 },
    ];
    const result = getUnionROI(rois);
    expect(result).toEqual({ x0: 0, y0: 0, x1: 24, y1: 24 });
  });
});

describe('checkFaceInROI', () => {
  it('returns true if the face is sufficiently inside the ROI', () => {
    const face = { x0: 10, y0: 10, x1: 19, y1: 19 };
    const roi = { x0: 0, y0: 0, x1: 30, y1: 30 };
    const result = checkFaceInROI(face, roi);
    expect(result).toBe(true);
  });

  it('returns false if the face is not sufficiently inside the ROI', () => {
    const face = { x0: 22, y0: 22, x1: 40, y1: 40 };
    const roi = { x0: 0, y0: 0, x1: 30, y1: 30 };
    const result = checkFaceInROI(face, roi);
    expect(result).toBe(false);
  });
});

describe('checkROIInFace', () => {
  it('returns true if the ROI is sufficiently inside the face', () => {
    const roi: ROI = { x0: 15, y0: 15, x1: 25, y1: 25 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(true);
  });

  it('returns false if the ROI is not sufficiently inside the face', () => {
    const roi: ROI = { x0: 5, y0: 5, x1: 15, y1: 15 };
    const face: ROI = { x0: 20, y0: 20, x1: 40, y1: 40 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(false);
  });

  it('returns true if the ROI is exactly the same as the face', () => {
    const roi: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(true);
  });

  it('returns false if the ROI is only partially inside the face', () => {
    const roi: ROI = { x0: 25, y0: 25, x1: 40, y1: 40 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(false);
  });

  it('returns true if the ROI is much smaller but fully inside the face', () => {
    const roi: ROI = { x0: 15, y0: 15, x1: 18, y1: 18 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(true);
  });
});
