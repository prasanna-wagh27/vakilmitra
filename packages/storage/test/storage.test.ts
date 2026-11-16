import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, FsBlobStore, keys, parseMasterKeys, SecureStorage } from "../src/index.js";

const k = (id: string) => `${id}:${randomBytes(32).toString("base64")}`;

describe("envelope encryption", () => {
  const masters = parseMasterKeys(k("k1"));
  const text = Buffer.from("७/१२ उतारा — गट नं. ११२, माळेगाव");

  it("round-trips and never stores plaintext", () => {
    const blob = encrypt(text, "a/b.jpg.enc", masters);
    expect(blob.includes(text)).toBe(false);
    expect(decrypt(blob, "a/b.jpg.enc", masters).equals(text)).toBe(true);
  });

  it("uses a fresh data key and IV every time", () => {
    expect(encrypt(text, "a", masters).equals(encrypt(text, "a", masters))).toBe(false);
  });

  it("rejects a blob moved to another key (AAD binding)", () => {
    const blob = encrypt(text, "case/1/p1", masters);
    expect(() => decrypt(blob, "case/2/p1", masters)).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const blob = encrypt(text, "a", masters);
    blob[blob.length - 1] ^= 1;
    expect(() => decrypt(blob, "a", masters)).toThrow();
  });

  it("decrypts with an older key after rotation", () => {
    const old = parseMasterKeys(k("k0"));
    const blob = encrypt(text, "a", old);
    const rotated = [...parseMasterKeys(k("k1")), ...old];
    expect(decrypt(blob, "a", rotated).equals(text)).toBe(true);
    expect(() => decrypt(blob, "a", parseMasterKeys(k("k1")))).toThrow(/not configured/);
  });

  it("validates master key config", () => {
    expect(() => parseMasterKeys("")).toThrow();
    expect(() => parseMasterKeys("k1:c2hvcnQ=")).toThrow(/32 bytes/);
  });
});

describe("SecureStorage on disk", () => {
  it("stores ciphertext only and deletes by prefix", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vm-store-"));
    const s = new SecureStorage(new FsBlobStore(dir), parseMasterKeys(k("k1")));
    const data = randomBytes(5000);
    const p1 = keys.page("adv1", "case1", "doc1", "pg1");
    const p2 = keys.page("adv1", "case2", "doc2", "pg2");
    await s.put(p1, data);
    await s.put(p2, data);
    expect((await readFile(join(dir, p1))).includes(data.subarray(0, 64))).toBe(false);
    expect((await s.get(p1)).equals(data)).toBe(true);

    await s.deletePrefix(keys.case("adv1", "case1"));
    await expect(s.get(p1)).rejects.toThrow();
    expect((await s.get(p2)).equals(data)).toBe(true);

    await s.deletePrefix(keys.advocate("adv1"));
    expect(await readdir(join(dir, "adv"))).toEqual([]);
    await expect(s.get(p2)).rejects.toThrow();
  });

  it("refuses path traversal", async () => {
    const s = new SecureStorage(new FsBlobStore(await mkdtemp(join(tmpdir(), "vm-store-"))), parseMasterKeys(k("k1")));
    await expect(s.put("../etc/passwd", Buffer.from("x"))).rejects.toThrow(/Unsafe/);
    await expect(s.deletePrefix("adv/")).resolves.toBeDefined();
    await expect(s.deletePrefix("adv")).rejects.toThrow(/end with/);
  });
});
