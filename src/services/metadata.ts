import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface CaptureMetadata {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  coordinateSource?: 'exif' | 'gps_hardware';
  timestamp?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion: string;
}

const APP_VERSION = '0.1.0';

/**
 * Extract metadata from EXIF data and, if GPS is missing, attempt a live
 * location fix from the device hardware.
 */
export async function extractMetadata(
  exif: Record<string, any> | null,
): Promise<CaptureMetadata> {
  const meta: CaptureMetadata = {
    appVersion: APP_VERSION,
    deviceModel: `${Platform.OS} device`,
    osVersion: `${Platform.OS} ${Platform.Version}`,
  };

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
