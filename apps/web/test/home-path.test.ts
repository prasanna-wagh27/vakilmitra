import { describe, expect, it, vi } from "vitest";
import { homePathFor } from "../src/components/marketing/HomePage";

// The language store remembers the choice in localStorage, which Node lacks.
vi.hoisted(() => {
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
    removeItem: (k: string) => mem.delete(k),
  } as unknown as Storage;
});

describe("the home page address follows the language", () => {
  it("moves between the two home addresses", () => {
    expect(homePathFor("/", "en")).toBe("/en");
    expect(homePathFor("/en", "mr")).toBe("/");
    expect(homePathFor("/", "mr")).toBeNull();
    expect(homePathFor("/en", "en")).toBeNull();
  });

  it("lets links lead away from the home page", () => {
    // These were sent back to / while the home page was still on screen.
    for (const path of ["/new-laws", "/privacy", "/login", "/register", "/pricing"]) {
      expect(homePathFor(path, "mr")).toBeNull();
      expect(homePathFor(path, "en")).toBeNull();
    }
  });
});
