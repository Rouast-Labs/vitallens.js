/**
 * Converts a data URI or base64-encoded string of a worker script into a Blob URL.
 * @param dataURI - A string containing either a full data URI or a base64-encoded worker script.
 * @returns A Blob URL string representing the worker script.
 */
export function createWorkerBlobURL(dataURI: string): string {
  let encoded = dataURI;
  if (dataURI.startsWith('data:')) {
    const parts = dataURI.split(',');
    if (parts.length < 2) {
      throw new Error('Unexpected worker data URI format.');
    }
    encoded = parts[1];
  }
  const workerScript = atob(encoded);
  const blob = new Blob([workerScript], {
    type: 'application/javascript; charset=utf-8',
  });
  return URL.createObjectURL(blob);
}
