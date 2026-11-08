import { describe, expect, it } from "vitest";
import { ALPHABET, GET, MAX_DATA, POST, newCode, validCode, validData } from "./move";

const post = (body: string) => POST(new Request("http://localhost/api/move", { method: "POST", body }));
const get = (code: string) => GET(new Request(`http://localhost/api/move?code=${code}`));

describe("codes", () => {
  it("are 8 characters from the Crockford alphabet", () => {
    for (let i = 0; i < 50; i++) expect(validCode(newCode())).toBe(true);
    expect(newCode(() => new Uint8Array([0, 31, 32, 255, 10, 18, 21, 27]))).toBe("0Z0ZAJNV");
    expect(ALPHABET).toHaveLength(32);
  });
  it("rejects anything else", () => {
    for (const c of ["", "K7M2QX9", "K7M2QX9DD", "k7m2qx9d", "K7M2QX9O", "K7M2-QX9", "ILOUILOU", null, 12345678]) expect(validCode(c)).toBe(false);
  });
});

describe("data", () => {
  it("must be non-empty base64 under the size limit", () => {
    expect(validData("H4sIAAAAAAAA/w==")).toBe(true);
    expect(validData("")).toBe(false);
    expect(validData("not base64!")).toBe(false);
    expect(validData("A".repeat(MAX_DATA + 1))).toBe(false);
    expect(validData(42)).toBe(false);
  });
});

describe("POST then GET (in memory)", () => {
  it("gives the data back for the code, more than once", async () => {
    const res = await post("SGVsbG8=");
    expect(res.status).toBe(200);
    const { code, expiresIn } = (await res.json()) as { code: string; expiresIn: number };
    expect(validCode(code)).toBe(true);
    expect(expiresIn).toBe(600);
    for (let i = 0; i < 2; i++) expect(await (await get(code)).json()).toEqual({ data: "SGVsbG8=" });
  });
  it("404 for an unknown or malformed code", async () => {
    expect((await get("00000000")).status).toBe(404);
    expect((await get("nope")).status).toBe(404);
  });
  it("refuses bad or oversized data", async () => {
    expect((await post("{not base64}")).status).toBe(400);
    expect((await post("A".repeat(MAX_DATA + 4))).status).toBe(413);
  });
});
