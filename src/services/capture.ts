import * as ImagePicker from 'expo-image-picker';

export type CaptureResult = {
  uri: string;
  width: number;
  height: number;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exif: Record<string, any> | null;
};

/**
 * Launch the device camera. Returns a single CaptureResult or null if cancelled.
 */
export async function captureFromCamera(): Promise<CaptureResult | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    mimeType: asset.mimeType ?? 'image/jpeg',
    exif: asset.exif ?? null,
  };
}

/**
 * Open the media library picker. Returns an array of CaptureResults (up to 10),
 * or an empty array if cancelled.
 */
export async function pickFromLibrary(): Promise<CaptureResult[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: true,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });

  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    mimeType: asset.mimeType ?? 'image/jpeg',
    exif: asset.exif ?? null,
  }));
}
