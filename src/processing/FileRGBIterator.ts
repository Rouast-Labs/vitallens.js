import {
  MethodConfig,
  VideoInput,
  VitalLensOptions,
  VideoProbeResult,
  ROI,
} from '../types/core';
import { Frame } from './Frame';
import { FrameIteratorBase } from './FrameIterator.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { getROIForMethod, getUnionROI } from '../utils/faceOps';
import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';
import { FDET_DEFAULT_FS_FILE } from '../config/constants';

/**
 * Extracts a representative RGB value from a frame's pixel data over the given ROI.
 * In this implementation, we compute the average RGB values over the ROI.
 * @param frameData - Uint8Array containing pixel data for the cropped frame.
 * @param frameWidth - Width of the cropped frame.
 * @param frameHeight - Height of the cropped frame.
 * @param roi - ROI (with coordinates relative to the cropped frame).
 * @returns A tuple [R, G, B] representing the average color within the ROI.
 */
export function extractRGBForROI(
  frameData: Uint8Array,
  frameWidth: number,
  frameHeight: number,
  roi: { x0: number; y0: number; x1: number; y1: number }
): [number, number, number] {
  // Ensure the ROI is within the frame bounds.
  const xStart = Math.max(0, roi.x0);
  const yStart = Math.max(0, roi.y0);
  const xEnd = Math.min(frameWidth, roi.x1);
  const yEnd = Math.min(frameHeight, roi.y1);

  let sumR = 0,
    sumG = 0,
    sumB = 0,
    count = 0;

  // Loop through each pixel in the ROI.
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      // Calculate the index for the pixel's red channel.
      // Each row has `frameWidth * 3` bytes.
      const idx = (y * frameWidth + x) * 3;
      sumR += frameData[idx];
      sumG += frameData[idx + 1];
      sumB += frameData[idx + 2];
      count++;
    }
  }

  // If no pixels were processed, return black.
  if (count === 0) {
    return [0, 0, 0];
  }

  // Compute the average color.
  return [sumR / count, sumG / count, sumB / count];
}

/**
 * Frame iterator for video files (e.g., local file paths, File, or Blob inputs).
 * Yields 2D `Frame`s representing RGB signal from pre-processed segments of the video file
 */
export class FileRGBIterator extends FrameIteratorBase {
  private currentFrameIndex: number = 0;
  private probeInfo: VideoProbeResult | null = null;
  private fpsTarget: number = 0;
  private dsFactor: number = 0;
  private roi: ROI[] = [];
  private rgb: Float32Array | null = null;

  constructor(
    private videoInput: VideoInput,
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
    private faceDetectionWorker: IFaceDetectionWorker | null,
    private ffmpeg: IFFmpegWrapper
  ) {
    super();
  }

  /**
   * Starts the iterator by initializing the FFmpeg wrapper, probing the video, and pre-computing the rgb values.
   * Pre-computing is done because the chunks returned in next() have large overlaps which would lead to redundant work.
   */
  async start(): Promise<void> {
    // Get the ROI
    if (this.faceDetectionWorker) {
      // Run face detection
      const { detections, probeInfo } =
        await this.faceDetectionWorker.detectFaces(
          this.videoInput,
          'video',
          this.options.fDetFs ?? FDET_DEFAULT_FS_FILE
        );
      // Derive roi from faces
      this.probeInfo = probeInfo;
      this.roi = detections.map((det) =>
        getROIForMethod(
          det,
          this.methodConfig,
          { height: probeInfo.height, width: probeInfo.width },
          true
        )
      );
      // Load ffmpeg after finishing face detection
      await this.ffmpeg.init();
      await this.ffmpeg.loadInput(this.videoInput);
    } else {
      // Load ffmpeg
      await this.ffmpeg.init();
      await this.ffmpeg.loadInput(this.videoInput);
      // Probe to get video information
      this.probeInfo = await this.ffmpeg.probeVideo(this.videoInput);
      if (!this.probeInfo) {
        throw new Error(
          'Failed to retrieve video probe information. Ensure the input is valid.'
        );
      }
      // Use global ROI
      this.roi = Array(this.probeInfo.totalFrames).fill(this.options.globalRoi);
    }

    const totalFrames = this.probeInfo!.totalFrames;
    // Derive fps target and downsampling factor
    this.fpsTarget = this.options.overrideFpsTarget
      ? this.options.overrideFpsTarget
      : this.methodConfig.fpsTarget;
    this.dsFactor = Math.max(
      Math.round(this.probeInfo!.fps / this.fpsTarget),
      1
    );
    // Determine how many chunks we need to process the entire video.
    // TODO: Only need to assume that the unionROI itself needs to fit?
    const videoSizeBytes =
      totalFrames * this.probeInfo!.height * this.probeInfo!.width * 3;
    const maxBytes = 1024 * 1024 * 1024 * 2; // 2GB
    const nChunks = Math.ceil(videoSizeBytes / maxBytes);
    // Equally split the total frames into chunks.
    const framesPerChunk = Math.ceil(totalFrames / nChunks);
    // Prepare a container to hold the RGB values for every frame (each frame: 3 values: R, G, B).
    const rgbResult = new Float32Array(totalFrames * 3);
    // Process each chunk.
    for (let chunk = 0; chunk < nChunks; chunk++) {
      const startIdx = chunk * framesPerChunk;
      const endIdx = Math.min((chunk + 1) * framesPerChunk, totalFrames);
      const chunkFrameCount = endIdx - startIdx;
      // Determine the union ROI for the frames in this chunk.
      const chunkROIs = this.roi.slice(startIdx, endIdx);
      const unionROI = getUnionROI(chunkROIs);
      // Read frames for this chunk from the video, cropped to the union ROI.
      const chunkVideoData = await this.ffmpeg.readVideo(
        this.videoInput,
        {
          trim: { startFrame: startIdx, endFrame: endIdx },
          crop: unionROI,
          pixelFormat: 'rgb24',
        },
        this.probeInfo!
      );
      // Compute dimensions for the cropped (union) region.
      const unionWidth = unionROI.x1 - unionROI.x0;
      const unionHeight = unionROI.y1 - unionROI.y0;
      const totalPixelsPerFrame = unionWidth * unionHeight * 3;
      const expectedLength = chunkFrameCount * totalPixelsPerFrame;
      if (chunkVideoData.length !== expectedLength) {
        throw new Error(
          `Buffer length mismatch in chunk ${chunk}: expected ${expectedLength}, got ${chunkVideoData.length}`
        );
      }
      // For each frame in the chunk, extract the RGB signal from the original ROI.
      // Here, we adjust the original ROI (which is in absolute coordinates) to be relative to the union ROI,
      // and then extract a representative RGB value (for example, the average color) from that area.
      for (let i = 0; i < chunkFrameCount; i++) {
        const frameOffset = i * totalPixelsPerFrame;
        const frameData = chunkVideoData.subarray(
          frameOffset,
          frameOffset + totalPixelsPerFrame
        );
        // Get the original ROI for this frame.
        const originalROI = this.roi[startIdx + i];
        // Adjust ROI coordinates relative to the union ROI.
        const adjustedROI: ROI = {
          x0: originalROI.x0 - unionROI.x0,
          y0: originalROI.y0 - unionROI.y0,
          x1: originalROI.x1 - unionROI.x0,
          y1: originalROI.y1 - unionROI.y0,
        };
        // Extract the RGB value for this frame based on the adjusted ROI.
        const rgbValue = extractRGBForROI(
          frameData,
          unionWidth,
          unionHeight,
          adjustedROI
        );
        // Store the extracted RGB values.
        const globalFrameIdx = startIdx + i;
        rgbResult[globalFrameIdx * 3 + 0] = rgbValue[0];
        rgbResult[globalFrameIdx * 3 + 1] = rgbValue[1];
        rgbResult[globalFrameIdx * 3 + 2] = rgbValue[2];
      }
    }
    // Store the computed RGB signal.
    this.rgb = rgbResult;
  }

  /**
   * Retrieves the next rgb frame from the video file.
   * @returns A promise resolving to the next frame or null if the iterator is closed or EOF is reached.
   */
  async next(): Promise<Frame | null> {
    if (!this.probeInfo) {
      throw new Error(
        'Probe information is not available. Ensure `start()` has been called before `next()`.'
      );
    }

    if (this.isClosed || this.currentFrameIndex >= this.probeInfo.totalFrames) {
      return null;
    }

    // Determine how many frames to serve in this call.
    const framesToRead = Math.min(
      this.methodConfig.maxWindowLength * this.dsFactor,
      this.probeInfo.totalFrames - this.currentFrameIndex
    );

    if (!this.rgb) {
      throw new Error(
        'RGB data not available. Ensure `start()` has processed the video.'
      );
    }

    // Slice the pre-computed rgb data for the requested frames.
    // Each frame has 3 RGB values.
    const startOffset = this.currentFrameIndex * 3;
    const endOffset = (this.currentFrameIndex + framesToRead) * 3;
    const rgbChunk = this.rgb.slice(startOffset, endOffset);

    // Generate timestamps for each frame in the batch.
    const frameTimestamps = Array.from(
      { length: framesToRead },
      (_, i) => (this.currentFrameIndex + i) / this.probeInfo!.fps
    );

    // Slice the corresponding ROIs from the original coordinates.
    const frameROIs = this.roi.slice(
      this.currentFrameIndex,
      this.currentFrameIndex + framesToRead
    );

    // Update the iterator index.
    this.currentFrameIndex += framesToRead;

    // TODO: Need to do anything if dsFactor > 1?

    // Create and return a Frame. Here we assume that each frame is represented as a vector of 3 values.
    return Frame.fromFloat32Array(
      rgbChunk,
      [framesToRead, 3],
      frameTimestamps,
      frameROIs
    );
  }

  /**
   * Stops the iterator and releases resources used by the FFmpeg wrapper.
   */
  stop(): void {
    super.stop();
    this.ffmpeg.cleanup();
  }
}
