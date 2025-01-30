import { MethodConfig, ROI } from "../types/core";

/**
 * Utility function to clip a value to specified dimensions.
 * @param value - The value to clip.
 * @param minDim - The minimum allowable value.
 * @param maxDim - The maximum allowable value.
 * @returns The clipped value.
 */
function clipValue(value: number, minDim: number, maxDim: number): number {
  return Math.min(Math.max(value, minDim), maxDim);
}

/**
 * Convert face detection into an ROI by applying relative changes.
 * @param det - The face detection {x0, y0, x1, y1}.
 * @param relChange - Relative change to apply as [left, top, right, bottom].
 * @param clipDims - Optional constraints {frameWidth, frameHeight}.
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The computed ROI in absolute vals [0, H/W] and format {x0, y0, x1, y1}.
 */
export function getROIFromDetection(
  det: ROI,
  relChange: [number, number, number, number],
  clipDims?: { width: number; height: number },
  forceEvenDims: boolean = false
): ROI {
  const { x0, y0, x1, y1 } = det;
  const [relChLeft, relChTop, relChRight, relChBottom] = relChange;
  const width = x1 - x0;
  const height = y1 - y0;

  const absChLeft = Math.round(relChLeft * width);
  const absChTop = Math.round(relChTop * height);
  const absChRight = Math.round(relChRight * width);
  const absChBottom = Math.round(relChBottom * height);

  let roiX0 = x0 - absChLeft;
  let roiY0 = y0 - absChTop;
  let roiX1 = x1 + absChRight;
  let roiY1 = y1 + absChBottom;

  if (clipDims) {
    roiX0 = clipValue(roiX0, 0, clipDims.width);
    roiY0 = clipValue(roiY0, 0, clipDims.height);
    roiX1 = clipValue(roiX1, 0, clipDims.width);
    roiY1 = clipValue(roiY1, 0, clipDims.height);
  }

  if (forceEvenDims) {
    roiX1 = (roiX1 - roiX0) % 2 != 0 ? roiX1 - 1 : roiX1;
    roiY1 = (roiY1 - roiY0) % 2 != 0 ? roiY1 - 1 : roiY1;
  }

  return { x0: roiX0, y0: roiY0, x1: roiX1, y1: roiY1 };
}

/**
 * Convert face detection into face ROI (reduces width to 60% and height to 80%).
 * @param det - The face detection {x, y, width, height}.
 * @param clipDims - Optional constraints {frameWidth, frameHeight}.
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The face ROI.
 */
export function getFaceROI(
  det: ROI,
  clipDims: { width: number; height: number },
  forceEvenDims: boolean = false
): ROI {
  return getROIFromDetection(det, [-0.2, -0.1, -0.2, -0.1], clipDims, forceEvenDims);
}

/**
 * Convert face detection into upper body ROI and clip to frame constraints.
 * @param det - The face detection {x0, y0, x1, y1}.
 * @param clipDims - Constraints {frameWidth, frameHeight}.
 * @param cropped - Whether to create a cropped variant of the ROI.
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The upper body ROI.
 */
export function getUpperBodyROI(
  det: ROI,
  clipDims: { width: number; height: number },
  cropped: boolean = true,
  forceEvenDims: boolean = false
): ROI {
  let relChange: [number, number, number, number];
  relChange = cropped ? [0.175, 0.15, 0.175, 0.3] : [0.25, 0.2, 0.25, 0.4];
  return getROIFromDetection(det, relChange, clipDims, forceEvenDims);
}

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
  switch (methodConfig.roiMethod) {
    case 'face':
      return getFaceROI(det, clipDims, forceEvenDims);
    case 'upper_body':
      if (!clipDims) {
        throw new Error("clipDims must be provided for 'upper_body' ROI method.");
      }
      return getUpperBodyROI(det, clipDims, true, forceEvenDims);
    default:
      throw new Error(`Unsupported roiMethod: ${methodConfig.roiMethod}`);
  }
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
  const closestROI = rois.reduce((closest, roi) => {
    const dist = Math.hypot(
      roi.x0 - meanROI.x0,
      roi.y0 - meanROI.y0,
      roi.x1 - meanROI.x1,
      roi.y1 - meanROI.y1
    );
    return dist < closest.distance ? { roi, distance: dist } : closest;
  }, { roi: rois[0], distance: Infinity }).roi;

  // Ensure width and height are even
  return {
    x0: closestROI.x0,
    y0: closestROI.y0,
    x1: (closestROI.x1 - closestROI.x0) % 2 != 0 ? closestROI.x1 - 1 : closestROI.x1,
    y1: (closestROI.y1 - closestROI.y0) % 2 != 0 ? closestROI.y1 - 1 : closestROI.y1,
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
  const xMin = Math.min(...rois.map(roi => roi.x0));
  const yMin = Math.min(...rois.map(roi => roi.y0));
  const xMax = Math.max(...rois.map(roi => roi.x1));
  const yMax = Math.max(...rois.map(roi => roi.y1));

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
    (faceRight - roi.x0 >= requiredWidth) && (roiRight - face.x0 >= requiredWidth);

  const isHeightInsideROI =
    (faceBottom - roi.y0 >= requiredHeight) && (roiBottom - face.y0 >= requiredHeight);

  return isWidthInsideROI && isHeightInsideROI;
}
