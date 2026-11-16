import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/** Minimal blob store: the only surface the app uses, so switching providers is a one-file change. */
export interface BlobStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Delete every object whose key starts with `prefix` (which must end with "/"). */
  deletePrefix(prefix: string): Promise<number>;
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error(`Unsafe storage key "${key}"`);
}
function assertPrefix(prefix: string) {
  assertSafeKey(prefix);
  if (!prefix.endsWith("/")) throw new Error("Prefix must end with /");
}

/** Local disk, for development and tests. */
export class FsBlobStore implements BlobStore {
  private root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  private path(key: string) {
    assertSafeKey(key);
    return join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data, { mode: 0o600 });
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
  async deletePrefix(prefix: string) {
    assertPrefix(prefix);
    await rm(join(this.root, prefix), { recursive: true, force: true });
    return 0;
  }
}

export interface S3Config {
  endpoint?: string; // e.g. https://<account>.r2.cloudflarestorage.com, or omit for AWS
  region: string; // e.g. ap-south-1 (Mumbai) or "auto" for R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/** Any S3-compatible store (Cloudflare R2, AWS S3 Mumbai, ...). */
export class S3BlobStore implements BlobStore {
  private client: S3Client;
  constructor(private cfg: S3Config) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, data: Buffer) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: "application/octet-stream" }),
    );
  }
  async get(key: string) {
    assertSafeKey(key);
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    if (!r.Body) throw new Error(`Empty object ${key}`);
    return Buffer.from(await r.Body.transformToByteArray());
  }
  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
  async deletePrefix(prefix: string) {
    assertPrefix(prefix);
    let deleted = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.cfg.bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (keys.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.cfg.bucket, Delete: { Objects: keys, Quiet: true } }));
        deleted += keys.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
}
