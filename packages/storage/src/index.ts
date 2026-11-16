import { decrypt, encrypt, type MasterKey, parseMasterKeys } from "./crypto.js";
import { type BlobStore, FsBlobStore, S3BlobStore, type S3Config } from "./drivers.js";

export { decrypt, encrypt, type MasterKey, parseMasterKeys } from "./crypto.js";
export { assertSafeKey, type BlobStore, FsBlobStore, S3BlobStore, type S3Config } from "./drivers.js";

/** Object keys are grouped so a case, or a whole account, can be deleted by prefix. */
export const keys = {
  advocate: (advocateId: string) => `adv/${advocateId}/`,
  case: (advocateId: string, caseId: string) => `adv/${advocateId}/case/${caseId}/`,
  document: (advocateId: string, caseId: string, documentId: string) => `adv/${advocateId}/case/${caseId}/doc/${documentId}/`,
  page: (advocateId: string, caseId: string, documentId: string, pageId: string) =>
    `adv/${advocateId}/case/${caseId}/doc/${documentId}/${pageId}.jpg.enc`,
};

/** Every client file goes through here: encrypted before it leaves the server, decrypted on read. */
export class SecureStorage {
  constructor(
    private store: BlobStore,
    private masterKeys: MasterKey[],
  ) {}
  async put(key: string, data: Buffer) {
    await this.store.put(key, encrypt(data, key, this.masterKeys));
  }
  async get(key: string) {
    return decrypt(await this.store.get(key), key, this.masterKeys);
  }
  delete(key: string) {
    return this.store.delete(key);
  }
  deletePrefix(prefix: string) {
    return this.store.deletePrefix(prefix);
  }
}

export type StorageConfig = { driver: "fs"; dir: string; masterKeys: string } | ({ driver: "s3"; masterKeys: string } & S3Config);

export function createStorage(cfg: StorageConfig): SecureStorage {
  const store = cfg.driver === "fs" ? new FsBlobStore(cfg.dir) : new S3BlobStore(cfg);
  return new SecureStorage(store, parseMasterKeys(cfg.masterKeys));
}
export { storageConfigFromEnv } from "./env.js";
