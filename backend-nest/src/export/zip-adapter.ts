import { strToU8, zipSync } from 'fflate';

/**
 * Minimal adapter that implements the subset of JSZip used by
 * ExportService (file, folder, generateAsync). Uses `fflate` to
 * produce an in‑memory ZIP Buffer.
 */
export class ZipAdapter {
  private files = new Map<string, Uint8Array>();

  file(name: string, data: string | Buffer | Uint8Array): this {
    let u8: Uint8Array;
    if (typeof data === 'string') u8 = strToU8(data);
    else if (Buffer.isBuffer(data)) u8 = new Uint8Array(data);
    else u8 = data;

    // normalize path (no leading slash)
    const key = name.startsWith('/') ? name.slice(1) : name;
    this.files.set(key, u8);
    return this;
  }

  folder(name: string) {
    const prefix = name.endsWith('/') ? name : `${name}/`;

    const proxy = {
      file: (fileName: string, data: string | Buffer | Uint8Array) => {
        this.file(prefix + fileName, data);
        return proxy;
      },
      folder: (subfolder: string) => {
        return this.folder(prefix + subfolder);
      },
    };

    return proxy as unknown as ZipAdapter;
  }

  generateAsync(_options?: {
    type?: string;
    compression?: string;
    compressionOptions?: { level?: number };
  }): Promise<Buffer> {
    const entries: Record<string, Uint8Array> = {};
    for (const [k, v] of this.files.entries()) entries[k] = v;

    // default compression level 6; JSZip used DEFLATE level 9 in callers
    const level = _options?.compressionOptions?.level ?? 6;
    const u8 = zipSync(entries, { level });
    return Promise.resolve(Buffer.from(u8));
  }
}
