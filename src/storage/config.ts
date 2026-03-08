// TODO: Wire into sync engine when cloud sync is implemented
import { Paths } from 'expo-file-system';

export interface StorageConfig {
  provider: 'local' | 's3' | 'azure' | 'gcs';
  basePath: string;
  s3Bucket?: string;
  s3Region?: string;
  /** S3-compatible endpoint, e.g. Fast LTA, MinIO */
  s3Endpoint?: string;
}

export function getDefaultConfig(): StorageConfig {
  return {
    provider: 'local',
    basePath: `${Paths.document.uri}storage/`,
  };
}
