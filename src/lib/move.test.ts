import { describe, expect, it } from "vitest";
import { formatCode, fromBase64, moveLink, normalizeCode, toBase64 } from "./move";

describe("normalizeCode", () => {
  it("accepts what people type", () => {
    expect(normalizeCode("K7M2QX9D")).toBe("K7M2QX9D");
    expect(normalizeCode(" k7m2-qx9d ")).toBe("K7M2QX9D");
    expect(normalizeCode("k7m2 qx9d")).toBe("K7M2QX9D");
  });
  it("reads O as 0 and I / L as 1", () => {
    expect(normalizeCode("OOOO-ILil")).toBe("00001111");
  });
  it("rejects wrong lengths and U", () => {
    expect(normalizeCode("K7M2QX9")).toBeNull();
    expect(normalizeCode("K7M2QX9DA")).toBeNull();
    expect(normalizeCode("UUUUUUUU")).toBeNull();
    expect(normalizeCode("")).toBeNull();
  });
});

describe("helpers", () => {
  it("formats and links", () => {
    expect(formatCode("K7M2QX9D")).toBe("K7M2-QX9D");
    expect(moveLink("K7M2QX9D", "https://mempo.vercel.app")).toBe("https://mempo.vercel.app/?move=K7M2QX9D");
  });
  it("base64 round-trips binary, also large", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 37) % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    expect(toBase64(new Uint8Array([72, 105]))).toBe("SGk=");
  });
});
