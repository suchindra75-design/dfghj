import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Saves a file to the public Android Downloads folder and triggers the native share sheet.
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
  if (!Capacitor.isNative) {
    // Fallback: callers handle web download paths.
    return;
  }

  // Android public Downloads directory is accessed via the external storage root + 'Download'.
  const directory = Directory.External;
  const path = `Download/${filename}`;

  // Choose appropriate encoding. Text files use UTF-8; binary files use BASE64.
  const encoding = mimeType.startsWith('text/') ? Encoding.UTF8 : Encoding.BASE64;

  await Filesystem.writeFile({
    path,
    data: content,
    directory,
    encoding,
  });

  // Retrieve a file URI that can be shared.
  const uriResult = await Filesystem.getUri({
    path,
    directory,
  });

  await Share.share({
    title: filename,
    url: uriResult.uri,
    dialogTitle: 'Share exported file',
  });
}
