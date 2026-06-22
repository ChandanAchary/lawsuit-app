// =============================================================================
// mimeFromFilename — infer a MIME type from a filename's extension.
//
// Why: on some Android devices, expo-document-picker returns
// `asset.mimeType` as undefined or `application/octet-stream`. When that
// value is persisted to the server's Document.mimeType column, the OCR
// dispatcher rejects the doc with "Unsupported mime type for extraction"
// even though it's a valid PDF / image / DOCX. Inferring from the file
// extension as a fallback avoids that whole class of failure.
//
// Mirrors the server's mime expectations in
// lawsuit-server/src/services/ocr.service.ts (PDF, image/*, DOCX).
// =============================================================================

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  txt: 'text/plain',
};

// Considered "useless" — we want to upgrade these via filename inference.
const GENERIC_MIMES = new Set([
  '',
  'application/octet-stream',
  'application/binary',
  'binary/octet-stream',
]);

export function mimeFromFilename(filename?: string | null): string | null {
  if (!filename) return null;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot < 0) return null;
  const ext = filename.slice(lastDot + 1).toLowerCase().trim();
  if (!ext) return null;
  return EXT_TO_MIME[ext] || null;
}

/**
 * Returns the best-guess mime for an uploaded asset:
 *   - If the picker gave us a useful mime, keep it.
 *   - Otherwise try the filename extension.
 *   - Otherwise fall back to application/octet-stream so callers always
 *     have something non-null to send to Cloudinary.
 */
export function resolveMime(pickerMime?: string | null, filename?: string | null): string {
  const m = String(pickerMime || '').toLowerCase().trim();
  if (m && !GENERIC_MIMES.has(m)) return m;
  return mimeFromFilename(filename) || 'application/octet-stream';
}

export default { mimeFromFilename, resolveMime };
