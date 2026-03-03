import { MethodConfig, ROI } from '../types/core';
import { getCore } from '../core/wasmProvider';

let core: any = null;
getCore().then(c => core = c);

/**
 * Determines the ROI based on the specified roiMethod.
 * @param det - The face detection {x0, y0, x1, y1}.
 * @param methodConfig - Configuration object specifying the ROI method and options.
 * @param clipDims - Constraints {frameWidth, frameHeight}.
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The computed ROI.
 */
export function getROIForMethod(
  det: ROI,
  methodConfig: MethodConfig,
  clipDims: { width: number; height: number },
  forceEvenDims: boolean = false
): ROI {
  if (!core) throw new Error("Wasm core not initialized");

  const rect = {
    x: det.x0,
    y: det.y0,
    width: det.x1 - det.x0,
    height: det.y1 - det.y0,
  };

  let roiMethod = 'Face';
  if (methodConfig.roiMethod === 'forehead') roiMethod = 'Forehead';
  else if (methodConfig.roiMethod === 'upper_body') roiMethod = 'UpperBody';
  else if (methodConfig.roiMethod === 'upper_body_cropped') roiMethod = 'UpperBodyCropped';

  const resultRect = core.calculateRoi(
    rect,
    roiMethod,
    'Default',
    clipDims.width,
    clipDims.height,
    forceEvenDims
  );

  return {
    x0: resultRect.x,
    y0: resultRect.y,
    x1: resultRect.x + resultRect.width,
    y1: resultRect.y + resultRect.height,
    confidence: det.confidence
  };
}

/**
 * Compute the representative ROI (closest to the mean ROI) with even width and height.
 * @param rois - Array of ROIs.
 * @returns The representative ROI closest to the mean ROI, with even width and height.
 */
export function getRepresentativeROI(rois: ROI[]): ROI {
  if (rois.length === 0) {
    throw new Error('The ROI array is empty.');
  }

  // Compute mean ROI
  const meanROI = rois.reduce(
    (acc, roi) => ({
      x0: acc.x0 + roi.x0 / rois.length,
      y0: acc.y0 + roi.y0 / rois.length,
      x1: acc.x1 + roi.x1 / rois.length,
      y1: acc.y1 + roi.y1 / rois.length,
    }),
    { x0: 0, y0: 0, x1: 0, y1: 0 }
  );

  // Find and return the ROI closest to the mean ROI
  const closestROI = rois.reduce(
    (closest, roi) => {
      const dist = Math.hypot(
        roi.x0 - meanROI.x0,
        roi.y0 - meanROI.y0,
        roi.x1 - meanROI.x1,
        roi.y1 - meanROI.y1
      );
      return dist < closest.distance ? { roi, distance: dist } : closest;
    },
    { roi: rois[0], distance: Infinity }
  ).roi;

  // Ensure width and height are even
  return {
    x0: closestROI.x0,
    y0: closestROI.y0,
    x1:
      (closestROI.x1 - closestROI.x0) % 2 != 0
        ? closestROI.x1 - 1
        : closestROI.x1,
    y1:
      (closestROI.y1 - closestROI.y0) % 2 != 0
        ? closestROI.y1 - 1
        : closestROI.y1,
  };
}

/**
 * Compute the union of an array of ROIs.
 * @param rois - Array of ROIs.
 * @returns The union ROI that encompasses all input ROIs.
 */
export function getUnionROI(rois: ROI[]): ROI {
  if (rois.length === 0) {
    throw new Error('The ROI array is empty.');
  }

  // Compute the smallest x and y (top-left corner) and the largest x and y (bottom-right corner)
  const xMin = Math.min(...rois.map((roi) => roi.x0));
  const yMin = Math.min(...rois.map((roi) => roi.y0));
  const xMax = Math.max(...rois.map((roi) => roi.x1));
  const yMax = Math.max(...rois.map((roi) => roi.y1));

  // Create the union ROI
  const unionROI = {
    x0: xMin,
    y0: yMin,
    x1: xMax,
    y1: yMax,
  };

  // Ensure width and height are even
  return {
    x0: unionROI.x0,
    y0: unionROI.y0,
    x1: (unionROI.x1 - unionROI.x0) % 2 != 0 ? unionROI.x1 - 1 : unionROI.x1,
    y1: (unionROI.y1 - unionROI.y0) % 2 != 0 ? unionROI.y1 - 1 : unionROI.y1,
  };
}

/**
 * Check whether a face is sufficiently inside the ROI.
 * @param face - The face represented as an ROI { x0, y0, x1, y1 }.
 * @param roi - The region of interest (ROI) represented as { x0, y0, x1, y1 }.
 * @param percentageRequiredInsideROI - Percentage of the face's width and height required to remain inside the ROI.
 * @returns True if the face is sufficiently inside the ROI.
 */
export function checkFaceInROI(
  face: ROI,
  roi: ROI,
  percentageRequiredInsideROI: [number, number] = [0.5, 0.5]
): boolean {
  const faceRight = face.x1;
  const faceBottom = face.y1;

  const roiRight = roi.x1;
  const roiBottom = roi.y1;

  const requiredWidth = percentageRequiredInsideROI[0] * (face.x1 - face.x0);
  const requiredHeight = percentageRequiredInsideROI[1] * (face.y1 - face.y0);

  const isWidthInsideROI =
    faceRight - roi.x0 >= requiredWidth && roiRight - face.x0 >= requiredWidth;

  const isHeightInsideROI =
    faceBottom - roi.y0 >= requiredHeight &&
    roiBottom - face.y0 >= requiredHeight;

  return isWidthInsideROI && isHeightInsideROI;
}

/**
 * Check whether an ROI is sufficiently inside a face.
 * @param roi - The region of interest (ROI) represented as { x0, y0, x1, y1 }.
 * @param face - The face represented as an ROI { x0, y0, x1, y1 }.
 * @param percentageRequiredInsideFace - Percentage of the ROI's width and height required to remain inside the face.
 * @returns True if the ROI is sufficiently inside the face.
 */
export function checkROIInFace(
  roi: ROI,
  face: ROI,
  percentageRequiredInsideFace: [number, number] = [0.5, 0.5]
): boolean {
  const roiRight = roi.x1;
  const roiBottom = roi.y1;

  const faceRight = face.x1;
  const faceBottom = face.y1;

  const requiredWidth = percentageRequiredInsideFace[0] * (roi.x1 - roi.x0);
  const requiredHeight = percentageRequiredInsideFace[1] * (roi.y1 - roi.y0);

  const isWidthInsideFace =
    roiRight - face.x0 >= requiredWidth && faceRight - roi.x0 >= requiredWidth;

  const isHeightInsideFace =
    roiBottom - face.y0 >= requiredHeight &&
    faceBottom - roi.y0 >= requiredHeight;

  return isWidthInsideFace && isHeightInsideFace;
}

/**
 * Check whether an ROI is valid.
 * @param roi - The region of interest (ROI) represented as { x0, y0, x1, y1 }.
 * @returns True if the ROI is valid, else False
 */
export function checkROIValid(roi: ROI): boolean {
  return (
    roi.x0 >= 0 && roi.y0 >= 0 && roi.x1 - roi.x0 > 0 && roi.y1 - roi.y0 > 0
  );
}
