import { MethodConfig } from "../config/methodsConfig";
import { ROI } from "../types/core";

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
 * @param det - The face detection {x, y, width, height}.
 * @param relChange - Relative change to apply as [left, top, right, bottom].
 * @param clipDims - Optional constraints {frameWidth, frameHeight}.
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The computed ROI.
 */
function getROIFromDetection(
  det: ROI,
  relChange: [number, number, number, number],
  clipDims?: { width: number; height: number },
  forceEvenDims: boolean = false
): ROI {
  const { x, y, width, height } = det;
  const detRight = x + width;
  const detBottom = y + height;

  const [relLeft, relTop, relRight, relBottom] = relChange;

  const absLeft = Math.round(relLeft * width);
  const absTop = Math.round(relTop * height);
  const absRight = Math.round(relRight * width);
  const absBottom = Math.round(relBottom * height);

  let roiX = x - absLeft;
  let roiY = y - absTop;
  let roiWidth = width + absLeft + absRight;
  let roiHeight = height + absTop + absBottom;

  if (clipDims) {
    roiX = clipValue(roiX, 0, clipDims.width);
    roiY = clipValue(roiY, 0, clipDims.height);
    roiWidth = clipValue(roiX + roiWidth, 0, clipDims.width) - roiX;
    roiHeight = clipValue(roiY + roiHeight, 0, clipDims.height) - roiY;
  }

  if (forceEvenDims) {
    roiWidth = Math.floor(roiWidth / 2) * 2;
    roiHeight = Math.floor(roiHeight / 2) * 2;
  }

  return { x: roiX, y: roiY, width: roiWidth, height: roiHeight };
}

/**
 * Convert face detection into face ROI (reduces width to 60% and height to 80%).
 * @param det - The face detection {x, y, width, height}.
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The face ROI.
 */
export function getFaceROI(det: ROI, forceEvenDims: boolean = false): ROI {
  return getROIFromDetection(det, [-0.2, -0.1, -0.2, -0.1], undefined, forceEvenDims);
}

/**
 * Convert face detection into upper body ROI and clip to frame constraints.
 * @param det - The face detection {x, y, width, height}.
 * @param clipDims - Constraints {frameWidth, frameHeight}.
 * @param cropped - Whether to create a cropped variant of the ROI.
 * @param version - Version of the ROI definition (0, 1, 2, or 3).
 * @param forceEvenDims - Whether to force even dimensions for the ROI.
 * @returns The upper body ROI.
 */
export function getUpperBodyROI(
  det: ROI,
  clipDims: { width: number; height: number },
  cropped: boolean = false,
  forceEvenDims: boolean = false
): ROI {
  let relChange: [number, number, number, number];
  relChange = cropped ? [0.175, 0.15, 0.175, 0.3] : [0.25, 0.2, 0.25, 0.4];
  return getROIFromDetection(det, relChange, clipDims, forceEvenDims);
}

/**
 * Determines the ROI based on the specified roiMethod.
 * @param det - The face detection {x, y, width, height}.
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
      return getFaceROI(det, forceEvenDims);
    case 'upper_body':
      if (!clipDims) {
        throw new Error("clipDims must be provided for 'upper_body' ROI method.");
      }
      return getUpperBodyROI(det, clipDims, false, forceEvenDims);
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
      x: acc.x + roi.x / rois.length,
      y: acc.y + roi.y / rois.length,
      width: acc.width + roi.width / rois.length,
      height: acc.height + roi.height / rois.length,
    }),
    { x: 0, y: 0, width: 0, height: 0 }
  );

  // Find and return the ROI closest to the mean ROI
  const closestROI = rois.reduce((closest, roi) => {
    const dist = Math.hypot(
      roi.x - meanROI.x,
      roi.y - meanROI.y,
      roi.width - meanROI.width,
      roi.height - meanROI.height
    );
    return dist < closest.distance ? { roi, distance: dist } : closest;
  }, { roi: rois[0], distance: Infinity }).roi;

  // Ensure width and height are even
  return {
    x: closestROI.x,
    y: closestROI.y,
    width: Math.floor(closestROI.width / 2) * 2,
    height: Math.floor(closestROI.height / 2) * 2,
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
  const xMin = Math.min(...rois.map(roi => roi.x));
  const yMin = Math.min(...rois.map(roi => roi.y));
  const xMax = Math.max(...rois.map(roi => roi.x + roi.width));
  const yMax = Math.max(...rois.map(roi => roi.y + roi.height));

  // Create the union ROI
  const unionROI = {
    x: xMin,
    y: yMin,
    width: xMax - xMin,
    height: yMax - yMin,
  };

  // Ensure width and height are even
  return {
    x: unionROI.x,
    y: unionROI.y,
    width: Math.floor(unionROI.width / 2) * 2,
    height: Math.floor(unionROI.height / 2) * 2,
  };
}

/**
 * Check whether a face is sufficiently inside the ROI.
 * @param face - The face represented as an ROI { x, y, width, height }.
 * @param roi - The region of interest (ROI) represented as { x, y, width, height }.
 * @param percentageRequiredInsideROI - Percentage of the face's width and height required to remain inside the ROI.
 * @returns True if the face is sufficiently inside the ROI.
 */
export function checkFaceInROI(
  face: ROI,
  roi: ROI,
  percentageRequiredInsideROI: [number, number] = [0.5, 0.5]
): boolean {
  const faceRight = face.x + face.width;
  const faceBottom = face.y + face.height;

  const roiRight = roi.x + roi.width;
  const roiBottom = roi.y + roi.height;

  const requiredWidth = percentageRequiredInsideROI[0] * face.width;
  const requiredHeight = percentageRequiredInsideROI[1] * face.height;

  const isWidthInsideROI =
    (faceRight - roi.x >= requiredWidth) && (roiRight - face.x >= requiredWidth);

  const isHeightInsideROI =
    (faceBottom - roi.y >= requiredHeight) && (roiBottom - face.y >= requiredHeight);

  return isWidthInsideROI && isHeightInsideROI;
}
