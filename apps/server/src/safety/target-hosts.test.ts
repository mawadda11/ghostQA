import { describe, expect, it } from "vitest";

import {
  assertTargetUrlAllowed,
  parseAllowedTargetHosts,
  TargetUrlError,
} from "./target-hosts.js";

describe("parseAllowedTargetHosts", () => {
  it("allows only localhost and 127.0.0.1 by default", () => {
    expect([...parseAllowedTargetHosts(undefined)]).toEqual([
      "localhost",
      "127.0.0.1",
    ]);
  });

  it("normalizes configured hosts and ignores their ports", () => {
    expect(
      [...parseAllowedTargetHosts(" Staging.Example.com:8443,LOCALHOST. ")],
    ).toEqual(["staging.example.com", "localhost"]);
  });

  it.each([
    "*.example.com",
    "https://example.com",
    "example.com/path",
    "user@example.com",
  ])("rejects invalid allowlist entry %s", (entry) => {
    expect(() => parseAllowedTargetHosts(entry)).toThrowError(TargetUrlError);
  });
});

describe("assertTargetUrlAllowed", () => {
  const allowedHosts = parseAllowedTargetHosts(
    "localhost,127.0.0.1,staging.example.com",
  );

  it.each([
    "http://localhost:5173/checkout",
    "http://127.0.0.1:3000",
    "https://staging.example.com/orders?recent=true",
  ])("accepts an exact allowlisted HTTP(S) host: %s", (target) => {
    expect(assertTargetUrlAllowed(target, allowedHosts).href).toBe(
      new URL(target).href,
    );
  });

  it.each([
    "https://localhost.example.com",
    "https://sub.staging.example.com",
    "https://example.com",
  ])("rejects hosts that are not exact matches: %s", (target) => {
    expect(() => assertTargetUrlAllowed(target, allowedHosts)).toThrowError(
      expect.objectContaining({ code: "HOST_NOT_ALLOWED" }),
    );
  });

  it("rejects non-HTTP protocols", () => {
    expect(() =>
      assertTargetUrlAllowed("file:///etc/passwd", allowedHosts),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_PROTOCOL" }));
  });

  it("rejects embedded credentials", () => {
    expect(() =>
      assertTargetUrlAllowed("http://user:secret@localhost", allowedHosts),
    ).toThrowError(
      expect.objectContaining({ code: "CREDENTIALS_NOT_ALLOWED" }),
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => assertTargetUrlAllowed("not a URL", allowedHosts)).toThrowError(
      expect.objectContaining({ code: "INVALID_TARGET_URL" }),
    );
  });
});
