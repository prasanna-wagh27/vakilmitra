/**
 * Envelope encryption for client files.
 *
 * Every object gets its own random 256-bit data key. The file is encrypted with AES-256-GCM
 * under that key, with the object's storage key as associated data (so a blob cannot be swapped
 * for another). The data key is then wrapped with a master key, which lives only in the
 * server's secret store, never in the bucket. Several master keys can be configured for rotation:
 * the first encrypts, all of them decrypt.
 *
 * Blob layout (v1):
 *   "VMEN" | 0x01 | keyIdLen(1) | keyId | wrapIv(12) | wrappedKey(32) | wrapTag(16) | iv(12) | tag(16) | ciphertext
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("VMEN");
const VERSION = 1;
const IV = 12;
const TAG = 16;
const KEY = 32;

export interface MasterKey {
  id: string;
  key: Buffer;
}

/** Parse "id1:base64key,id0:base64key" (first = current). */
export function parseMasterKeys(spec: string): MasterKey[] {
  const keys = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf(":");
      if (i < 1) throw new Error("Master keys must look like id:base64key");
      const id = entry.slice(0, i);
      const key = Buffer.from(entry.slice(i + 1), "base64");
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new Error(`Invalid master key id "${id}"`);
      if (key.length !== KEY) throw new Error(`Master key "${id}" must be 32 bytes (base64)`);
      return { id, key };
    });
  if (keys.length === 0) throw new Error("At least one master key is required");
  return keys;
}

function gcmEncrypt(key: Buffer, plaintext: Buffer, aad?: Buffer) {
  const iv = randomBytes(IV);
  const c = createCipheriv("aes-256-gcm", key, iv);
  if (aad) c.setAAD(aad);
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return { iv, ct, tag: c.getAuthTag() };
}

function gcmDecrypt(key: Buffer, iv: Buffer, ct: Buffer, tag: Buffer, aad?: Buffer) {
  const d = createDecipheriv("aes-256-gcm", key, iv);
  if (aad) d.setAAD(aad);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export function encrypt(plaintext: Buffer, objectKey: string, masterKeys: MasterKey[]): Buffer {
  const master = masterKeys[0];
  const dataKey = randomBytes(KEY);
  const aad = Buffer.from(objectKey, "utf8");
  const wrapped = gcmEncrypt(master.key, dataKey, Buffer.from(master.id));
  const body = gcmEncrypt(dataKey, plaintext, aad);
  dataKey.fill(0);
  const id = Buffer.from(master.id, "ascii");
  return Buffer.concat([MAGIC, Buffer.from([VERSION, id.length]), id, wrapped.iv, wrapped.ct, wrapped.tag, body.iv, body.tag, body.ct]);
}

export function decrypt(blob: Buffer, objectKey: string, masterKeys: MasterKey[]): Buffer {
  if (blob.length < 6 || !blob.subarray(0, 4).equals(MAGIC)) throw new Error("Not an encrypted VakilMitra object");
  if (blob[4] !== VERSION) throw new Error(`Unsupported encryption version ${blob[4]}`);
  let o = 5;
  const idLen = blob[o++];
  const id = blob.subarray(o, o + idLen).toString("ascii");
  o += idLen;
  const master = masterKeys.find((k) => k.id === id);
  if (!master) throw new Error(`Master key "${id}" is not configured`);
  const take = (n: number) => {
    const b = blob.subarray(o, o + n);
    o += n;
    return b;
  };
  const wrapIv = take(IV);
  const wrappedKey = take(KEY);
  const wrapTag = take(TAG);
  const iv = take(IV);
  const tag = take(TAG);
  const ct = blob.subarray(o);
  const dataKey = gcmDecrypt(master.key, wrapIv, wrappedKey, wrapTag, Buffer.from(master.id));
  try {
    return gcmDecrypt(dataKey, iv, ct, tag, Buffer.from(objectKey, "utf8"));
  } finally {
    dataKey.fill(0);
  }
}
