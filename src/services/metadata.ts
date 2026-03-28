import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export interface CaptureMetadata {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  coordinateSource?: 'exif' | 'gps_hardware';
  timestamp?: string;
  deviceModel?: string;
  deviceManufacturer?: string;
  deviceId?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
}

/**
 * Extract metadata from EXIF data and, if GPS is missing, attempt a live
 * location fix from the device hardware.
 */
export async function extractMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exif: Record<string, any> | null,
): Promise<CaptureMetadata> {
  const meta: CaptureMetadata = {};

  // ── Device info ──────────────────────────────────────────────────────────────
  meta.deviceModel = Device.modelName ?? `${Platform.OS} device`;
  meta.deviceManufacturer =
    Device.manufacturer ?? (Platform.OS === 'ios' ? 'Apple' : undefined);
  meta.osName = Device.osName ?? Platform.OS;
  meta.osVersion = Device.osVersion ?? String(Platform.Version);
  meta.appVersion = Application.nativeApplicationVersion ?? undefined;

  // Device unique ID (IDFV on iOS, androidId on Android)
  try {
    if (Platform.OS === 'ios') {
      meta.deviceId = (await Application.getIosIdForVendorAsync()) ?? undefined;
    } else {
      meta.deviceId = Application.getAndroidId() ?? undefined;
    }
  } catch {
    // deviceId is optional — continue without it
  }

  // ── GPS / EXIF ────────────────────────────────────────────────────────────────
  // Try EXIF GPS first
  if (exif) {
    const lat = exif.GPSLatitude as number | undefined;
    const lng = exif.GPSLongitude as number | undefined;

    if (lat != null && lng != null) {
      meta.latitude = lat;
      meta.longitude = lng;
      meta.altitude = (exif.GPSAltitude as number) ?? undefined;
      meta.coordinateSource = 'exif';
    }

    // EXIF timestamp
    const dateStr = exif.DateTimeOriginal ?? exif.DateTime;
    if (typeof dateStr === 'string') {
      // EXIF format: "2024:01:15 10:30:00" → ISO
      const iso = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
      meta.timestamp = iso;
    }
  }

  // Fallback: get live GPS if EXIF didn't provide coordinates
  if (meta.latitude == null) {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        meta.latitude = loc.coords.latitude;
        meta.longitude = loc.coords.longitude;
        meta.altitude = loc.coords.altitude ?? undefined;
        meta.accuracy = loc.coords.accuracy ?? undefined;
        meta.coordinateSource = 'gps_hardware';
      }
    } catch {
      // Location unavailable — continue without coordinates
    }
  }

  if (!meta.timestamp) {
    meta.timestamp = new Date().toISOString();
  }

  return meta;
}
