import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countUsage, deviceId, setUsageOn, usageOn } from "./usage";

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

// Tests run in Node, which has no localStorage: a small in-memory one.
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", localStorageStub);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const sentBodies = () => fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));

describe("usage counts", () => {
  it("makes one random id and keeps it", () => {
    const id = deviceId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(deviceId()).toBe(id);
  });

  it("sends each event once a day; a study also covers the open", async () => {
    await countUsage("study");
    await countUsage("open");
    await countUsage("study");
    expect(sentBodies()).toEqual([{ id: deviceId(), event: "study" }]);
  });

  it("tries again later if sending failed", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    await countUsage("open");
    await countUsage("open");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when switched off, and forgets the id", async () => {
    const id = deviceId();
    setUsageOn(false);
    expect(usageOn()).toBe(false);
    await countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
    setUsageOn(true);
    expect(deviceId()).not.toBe(id);
  });
});
