import { describe, expect, it, vi } from "vitest";

import { ApiClientError, createApiClient } from "./client.js";

const fetchReturning = (response: Response): typeof fetch =>
  vi.fn(async () => response) as unknown as typeof fetch;

describe("dashboard API client", () => {
  it("returns successful JSON responses", async () => {
    const fetcher = fetchReturning(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient("http://127.0.0.1:4000", fetcher);

    await expect(client.request("/health")).resolves.toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:4000/health"),
      expect.objectContaining({ headers: {} }),
    );
  });

  it("preserves safe backend validation messages", async () => {
    const client = createApiClient(
      "http://127.0.0.1:4000",
      fetchReturning(
        new Response(
          JSON.stringify({
            error: {
              code: "TARGET_NOT_ALLOWED",
              message: "Target hostname is not allowlisted.",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(client.request("/api/projects")).rejects.toMatchObject({
      code: "TARGET_NOT_ALLOWED",
      message: "Target hostname is not allowlisted.",
      status: 400,
    });
  });

  it("maps transport failures to a useful server-unavailable error", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("socket details that should not be shown");
    }) as unknown as typeof fetch;
    const client = createApiClient("http://127.0.0.1:4000", fetcher);

    const error = await client.request("/health").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
    expect((error as Error).message).toContain("GhostQA server unavailable");
    expect((error as Error).message).not.toContain("socket details");
  });

  it("rejects unreadable successful responses", async () => {
    const client = createApiClient(
      "http://127.0.0.1:4000",
      fetchReturning(new Response("not json", { status: 200 })),
    );
    await expect(client.request("/api/projects")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("constructs artifact access only from the API base and encoded ID", () => {
    const client = createApiClient("http://127.0.0.1:4000");
    expect(client.artifactUrl("artifact/id traversal")).toBe(
      "http://127.0.0.1:4000/api/artifacts/artifact%2Fid%20traversal",
    );
  });
});

