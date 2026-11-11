import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Saves a file to the app's cache directory and opens the native share sheet.
 *
 * Content is written as UTF-8 text unless `options.base64` is set, in which
 * case it must be base64 (an optional data-URI prefix is stripped). Text vs
 * binary is decided explicitly, never inferred from the MIME type — CSB files
 * are plain text even though they use application/octet-stream.
 *
 * Errors are thrown to the caller (which is responsible for showing them);
 * a user-cancelled share sheet is not treated as an error.
 */
export async function saveAndShareFile(
  content: string,
  filename: string,
  mimeType: string,
  options: { base64?: boolean } = {},
): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    // Web fallback handled by callers.
    return;
  }

  const directory = Directory.Cache;
  const path = filename;

  let data = content;
  if (options.base64 && content.startsWith('data:')) {
    const commaIndex = content.indexOf(',');
    if (commaIndex !== -1) data = content.substring(commaIndex + 1);
  }

  try {
    await Filesystem.writeFile({
      path,
      data,
      directory,
      encoding: options.base64 ? undefined : Encoding.UTF8,
    });
  } catch (e) {
    throw new Error(`Could not save ${filename} (${mimeType}): ${e instanceof Error ? e.message : String(e)}`);
  }

  let uri: string;
  try {
    uri = (await Filesystem.getUri({ path, directory })).uri;
  } catch (e) {
    throw new Error(`Could not locate saved file ${filename}: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await Share.share({ title: filename, url: uri, dialogTitle: 'Share exported file' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return; // user dismissed the share sheet
    throw new Error(`Could not share ${filename}: ${msg}`);
  }
}
