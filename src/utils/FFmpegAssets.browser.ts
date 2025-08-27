/**
 * This module serves as the single source for FFmpeg asset URLs.
 * The placeholder strings below are replaced by the Rollup build process.
 *
 * - For the standard browser build, they become empty strings.
 * - For the self-contained build, they become base64 data URIs.
 *
 * This centralization prevents the large data URIs from being duplicated
 * across multiple files in the final bundle.
 */

export const FFMPEG_CORE_URL: string = '__FFMPEG_CORE_URL__';
export const FFMPEG_WASM_URL: string = '__FFMPEG_WASM_URL__';
