// TODO: Wire into sync engine when cloud sync is implemented
import { File, Paths } from 'expo-file-system';

export interface StorageProvider {
  upload(key: string, data: Blob | ArrayBuffer, contentType: string): Promise<string>;
  download(key: string): Promise<ArrayBuffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  private rootUri: string;

  constructor(rootUri?: string) {
    // Paths.document is the app's persistent documents directory
    this.rootUri = rootUri ?? `${Paths.document.uri}storage/`;
  }

  private resolveFile(key: string): File {
    // Sanitize: strip leading slashes and prevent path traversal
    const safe = key.replace(/\.\.\//g, '').replace(/^\/+/, '');
    return new File(`${this.rootUri}${safe}`);
  }

  private ensureParentDir(file: File): void {
    const parent = file.parentDirectory;
    if (!parent.exists) {
      parent.create({ intermediates: true, idempotent: true });
    }
  }

  async upload(
    key: string,
    data: Blob | ArrayBuffer,
    _contentType: string,
  ): Promise<string> {
    const file = this.resolveFile(key);
    this.ensureParentDir(file);

    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      const ab = await data.arrayBuffer();
      bytes = new Uint8Array(ab);
    }

    file.write(bytes);
    return file.uri;
  }

  async download(key: string): Promise<ArrayBuffer> {
    const file = this.resolveFile(key);
    const bytes = await file.bytes();
    return bytes.buffer as ArrayBuffer;
  }

  async delete(key: string): Promise<void> {
    const file = this.resolveFile(key);
    if (file.exists) {
      file.delete();
    }
  }

  async exists(key: string): Promise<boolean> {
    return this.resolveFile(key).exists;
  }
}
