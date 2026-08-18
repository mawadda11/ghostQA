import type { ApiErrorResponse } from "@ghostqa/shared";

const defaultBaseUrl =
  import.meta.env["VITE_GHOSTQA_API_URL"] ?? "http://127.0.0.1:4000";

const normalizeBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_GHOSTQA_API_URL must use HTTP or HTTPS.");
  }
  return url.href.replace(/\/$/, "");
};

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = value.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiClient {
  readonly baseUrl: string;
  request<T>(pathname: string, init?: RequestInit): Promise<T>;
  artifactUrl(artifactId: string): string;
}

export const createApiClient = (
  baseUrl = defaultBaseUrl,
  fetcher: typeof fetch = fetch,
): ApiClient => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    baseUrl: normalizedBaseUrl,
    async request<T>(pathname: string, init?: RequestInit): Promise<T> {
      let response: Response;
      try {
        response = await fetcher(new URL(pathname, normalizedBaseUrl), {
          ...init,
          headers: {
            ...(init?.body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...init?.headers,
          },
        });
      } catch {
        throw new ApiClientError(
          "GhostQA server unavailable. Check that the API is running and the dashboard API URL is correct.",
          "NETWORK_ERROR",
        );
      }

      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = undefined;
        }
        if (isApiErrorResponse(body)) {
          throw new ApiClientError(
            body.error.message,
            body.error.code,
            response.status,
          );
        }
        throw new ApiClientError(
          `GhostQA API returned HTTP ${response.status}.`,
          "HTTP_ERROR",
          response.status,
        );
      }

      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch {
        throw new ApiClientError(
          "GhostQA API returned an unreadable response.",
          "INVALID_RESPONSE",
          response.status,
        );
      }
    },
    artifactUrl(artifactId: string): string {
      return new URL(
        `/api/artifacts/${encodeURIComponent(artifactId)}`,
        normalizedBaseUrl,
      ).href;
    },
  };
};

export const apiClient = createApiClient();

