import { describe, expect, it } from "vitest";
import { deviceDetails, feedbackAddress, mailtoUrl, withDevice } from "./feedback";

describe("feedback", () => {
  it("puts the address together only at run time", () => {
    expect(feedbackAddress()).toBe("xiarui091@gmail.com");
  });

  it("makes a pre-filled email with spaces kept as spaces", () => {
    const url = mailtoUrl({ kind: "bug", message: " Audio stops ", about: "audio", details: "Version: abc" }, "me@example.com");
    expect(url.startsWith("mailto:me@example.com?subject=")).toBe(true);
    expect(url).not.toContain("+");
    const params = new URL(url).searchParams;
    expect(params.get("subject")).toBe("[Mempo] Bug: audio");
    expect(params.get("body")).toBe("Audio stops\n\n———\nVersion: abc");
  });

  it("adds the version and screen after the app's own details", () => {
    expect(deviceDetails("settings")).toContain("Screen: settings");
    const f = withDevice({ kind: "word", message: "", details: "**Word:** access" }, "word card");
    expect(f.details!.startsWith("**Word:** access\n\nVersion: ")).toBe(true);
  });
});
