import { 
  getROIFromDetection,
  getFaceROI,
  getForeheadROI,
  getUpperBodyROI,
  getROIForMethod,
  getRepresentativeROI,
  getUnionROI,
  checkFaceInROI,
  checkROIInFace
} from "../../src/utils/faceOps";
import { MethodConfig, ROI } from "../../src/types/core";

describe("getROIFromDetection", () => {
  it("applies relative changes and computes ROI correctly", () => {
    const det = { x0: 50, y0: 50, x1: 150, y1: 150 };
    const relChange: [number, number, number, number] = [-0.2, -0.1, -0.2, -0.1];
    const result = getROIFromDetection(det, relChange);
    expect(result).toEqual({ x0: 70, y0: 60, x1: 130, y1: 140 });
  });

  it("clips ROI to dimensions when clipDims are provided", () => {
    const det = { x0: 50, y0: 50, x1: 150, y1: 150 };
    const relChange: [number, number, number, number] = [-0.2, -0.1, -0.2, -0.1];
    const clipDims = { width: 120, height: 100 };
    const result = getROIFromDetection(det, relChange, clipDims);
    expect(result).toEqual({ x0: 70, y0: 60, x1: 120, y1: 100 });
  });

  it("ensures even dimensions when forceEvenDims is true", () => {
    const det = { x0: 50, y0: 50, x1: 101, y1: 103 };
    const relChange: [number, number, number, number] = [0, 0, 0, 0];
    const result = getROIFromDetection(det, relChange, undefined, true);
    expect(result).toEqual({ x0: 50, y0: 50, x1: 100, y1: 102 });
  });
});

describe("getFaceROI", () => {
  it("works for an example", () => {
    const det = { x0: 100, y0: 100, x1: 180, y1: 220 };
    const clipDims = { width: 220, height: 300 };
    const result = getFaceROI(det, clipDims);
    expect(result).toEqual({ x0: 116, y0: 112, x1: 164, y1: 208 });
  });
});

describe("getForeheadROI", () => {
  it("works for an example", () => {
    const det = { x0: 100, y0: 100, x1: 180, y1: 220 };
    const clipDims = { width: 220, height: 300 };
    const result = getForeheadROI(det, clipDims);
    expect(result).toEqual({ x0: 128, y0: 118, x1: 152, y1: 130 });
  });
});

describe("getUpperBodyROI", () => {
  it("computes the upper body ROI correctly for non-cropped mode", () => {
    const det = { x0: 100, y0: 100, x1: 180, y1: 220 };
    const clipDims = { width: 220, height: 300 };
    const result = getUpperBodyROI(det, clipDims, false);
    expect(result).toEqual({ x0: 80, y0: 76, x1: 200, y1: 268 });
  });

  it("computes the upper body ROI correctly for cropped mode", () => {
    const det = { x0: 100, y0: 100, x1: 180, y1: 220 };
    const clipDims = { width: 220, height: 300 };
    const result = getUpperBodyROI(det, clipDims, true);
    expect(result).toEqual({ x0: 86, y0: 82, x1: 194, y1: 256 });
  });
});

describe("getROIForMethod", () => {
  it("returns face ROI when roiMethod is 'face'", () => {
    const det = { x0: 50, y0: 50, x1: 150, y1: 150 };
    const methodConfig: MethodConfig = { roiMethod: "face", method: 'vitallens', fpsTarget: 1, minWindowLength: 0, maxWindowLength: 10, requiresState: false };
    const clipDims = { width: 200, height: 200 };
    const result = getROIForMethod(det, methodConfig, clipDims);
    expect(result).toEqual(getFaceROI(det, clipDims));
  });

  it("returns upper body ROI when roiMethod is 'upper_body'", () => {
    const det = { x0: 50, y0: 50, x1: 150, y1: 150 };
    const methodConfig: MethodConfig = { roiMethod: "upper_body", method: 'vitallens', fpsTarget: 1, minWindowLength: 0, maxWindowLength: 10, requiresState: false };
    const clipDims = { width: 200, height: 200 };
    const result = getROIForMethod(det, methodConfig, clipDims);
    expect(result).toEqual(getUpperBodyROI(det, clipDims));
  });
});

describe("getRepresentativeROI", () => {
  it("returns the ROI closest to the mean ROI", () => {
    const rois = [
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 5, y0: 5, x1: 17, y1: 17 },
      { x0: 10, y0: 10, x1: 24, y1: 24 }
    ];
    const result = getRepresentativeROI(rois);
    expect(result).toEqual({ x0: 5, y0: 5, x1: 17, y1: 17 });
  });
});

describe("getUnionROI", () => {
  it("returns the union ROI that encompasses all input ROIs", () => {
    const rois = [
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 5, y0: 5, x1: 25, y1: 25 },
      { x0: 15, y0: 15, x1: 25, y1: 25 }
    ];
    const result = getUnionROI(rois);
    expect(result).toEqual({ x0: 0, y0: 0, x1: 24, y1: 24 });
  });
});

describe("checkFaceInROI", () => {
  it("returns true if the face is sufficiently inside the ROI", () => {
    const face = { x0: 10, y0: 10, x1: 19, y1: 19 };
    const roi = { x0: 0, y0: 0, x1: 30, y1: 30 };
    const result = checkFaceInROI(face, roi);
    expect(result).toBe(true);
  });

  it("returns false if the face is not sufficiently inside the ROI", () => {
    const face = { x0: 22, y0: 22, x1: 40, y1: 40 };
    const roi = { x0: 0, y0: 0, x1: 30, y1: 30 };
    const result = checkFaceInROI(face, roi);
    expect(result).toBe(false);
  });
});

describe("checkROIInFace", () => {
  it("returns true if the ROI is sufficiently inside the face", () => {
    const roi: ROI = { x0: 15, y0: 15, x1: 25, y1: 25 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(true);
  });

  it("returns false if the ROI is not sufficiently inside the face", () => {
    const roi: ROI = { x0: 5, y0: 5, x1: 15, y1: 15 };
    const face: ROI = { x0: 20, y0: 20, x1: 40, y1: 40 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(false);
  });

  it("returns true if the ROI is exactly the same as the face", () => {
    const roi: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(true);
  });

  it("returns false if the ROI is only partially inside the face", () => {
    const roi: ROI = { x0: 25, y0: 25, x1: 40, y1: 40 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(false);
  });

  it("returns true if the ROI is much smaller but fully inside the face", () => {
    const roi: ROI = { x0: 15, y0: 15, x1: 18, y1: 18 };
    const face: ROI = { x0: 10, y0: 10, x1: 30, y1: 30 };
    const result = checkROIInFace(roi, face);
    expect(result).toBe(true);
  });
});
