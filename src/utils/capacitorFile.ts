import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Saves a file to the app's internal data directory and triggers the native share sheet.
 * Supports text (CSV, CSB) and binary (PDF via base64) content.
 *
 * @param content   The file content as a string. For binary files (e.g., PDF) provide a base64 string without data URI prefix.
 * @param filename  Desired filename including extension.
 * @param mimeType  MIME type of the file (e.g., 'text/csv', 'application/pdf').
 */
export async function saveAndShareFile(
  content: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    // Web fallback handled by callers.
    return;
  }

  // Use the app's internal cache directory for temporary export files.
  const directory = Directory.Cache;
  const path = filename; // No subfolders needed.

  // Determine encoding: omit for binary (PDF) – Capacitor assumes base64 when no encoding is set.
  // Determine if content is textual or binary (PDF base64). For PDFs, strip optional data URI prefix.
  const isText = mimeType.startsWith('text/') || mimeType === 'application/csv' || mimeType === 'application/csb';
  let dataToWrite = content;
  if (!isText && typeof content === 'string' && content.startsWith('data:')) {
    // Remove data URI prefix (e.g., "data:application/pdf;base64,")
    const commaIndex = content.indexOf(',');
    if (commaIndex !== -1) {
      dataToWrite = content.substring(commaIndex + 1);
    }
  }
  const encoding = isText ? Encoding.UTF8 : undefined;

  console.log('[CapacitorFile] Writing file', { path, mimeType, encoding: encoding ?? 'default (base64)' });
  try {
    await Filesystem.writeFile({
      path,
      data: content,
      directory,
      encoding,
    });
    console.log('[CapacitorFile] writeFile success');
  } catch (e) {
    console.error('[CapacitorFile] writeFile error', e);
    window.alert(`Error saving file ${filename}: ${e}`);
    throw e;
  }

  // Retrieve shareable URI.
  let uriResult:
    | { uri: string }
    | undefined;
  try {
    uriResult = await Filesystem.getUri({ path, directory });
    console.log('[CapacitorFile] getUri result', uriResult);
  } catch (e) {
    console.error('[CapacitorFile] getUri error', e);
    window.alert(`Error accessing file URI for ${filename}: ${e}`);
    throw e;
  }

  try {
    console.log('[CapacitorFile] Sharing file', uriResult?.uri);
    await Share.share({
      title: filename,
      url: uriResult?.uri,
      dialogTitle: 'Share exported file',
    });
    console.log('[CapacitorFile] Share.success');
  } catch (e) {
    console.error('[CapacitorFile] Share error', e);
    window.alert(`Error sharing file ${filename}: ${e}`);
    throw e;
  }
}
