import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsBlobStore, parseMasterKeys, SecureStorage } from "@vakilmitra/storage";
import { setServices } from "../src/services.js";

/** Default services for every test file: encrypted temp-folder storage and a no-op queue. */
setServices({
  storage: new SecureStorage(
    new FsBlobStore(mkdtempSync(join(tmpdir(), "vm-test-blobs-"))),
    parseMasterKeys(`k1:${randomBytes(32).toString("base64")}`),
  ),
  ocrQueue: { add: async () => undefined } as never,
});
