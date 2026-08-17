const DEFAULT_ALLOWED_TARGET_HOSTS = ["localhost", "127.0.0.1"] as const;

export type TargetUrlErrorCode =
  | "INVALID_ALLOWED_HOST"
  | "INVALID_TARGET_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "CREDENTIALS_NOT_ALLOWED"
  | "HOST_NOT_ALLOWED";

export class TargetUrlError extends Error {
  readonly code: TargetUrlErrorCode;

  constructor(code: TargetUrlErrorCode, message: string) {
    super(message);
    this.name = "TargetUrlError";
    this.code = code;
  }
}

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/, "");

const normalizeAllowedHost = (entry: string): string => {
  const candidate = entry.trim();

  if (candidate.length === 0 || candidate.includes("*") || candidate.includes("://")) {
    throw new TargetUrlError(
      "INVALID_ALLOWED_HOST",
      `Allowed target host "${entry}" must be a hostname without a scheme or wildcard.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(`http://${candidate}`);
  } catch {
    throw new TargetUrlError(
      "INVALID_ALLOWED_HOST",
      `Allowed target host "${entry}" is not a valid hostname.`,
    );
  }

  if (
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.pathname !== "/" ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new TargetUrlError(
      "INVALID_ALLOWED_HOST",
      `Allowed target host "${entry}" must not include credentials, a path, a query, or a fragment.`,
    );
  }

  return normalizeHostname(parsed.hostname);
};

export const parseAllowedTargetHosts = (
  rawValue: string | undefined,
): ReadonlySet<string> => {
  const entries =
    rawValue === undefined
      ? DEFAULT_ALLOWED_TARGET_HOSTS
      : rawValue.split(",");

  return new Set(entries.map(normalizeAllowedHost));
};

export const assertTargetUrlAllowed = (
  rawUrl: string,
  allowedHosts: ReadonlySet<string>,
): URL => {
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    throw new TargetUrlError(
      "INVALID_TARGET_URL",
      `Target URL "${rawUrl}" is not a valid absolute URL.`,
    );
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    throw new TargetUrlError(
      "UNSUPPORTED_PROTOCOL",
      "Target URLs must use HTTP or HTTPS.",
    );
  }

  if (targetUrl.username.length > 0 || targetUrl.password.length > 0) {
    throw new TargetUrlError(
      "CREDENTIALS_NOT_ALLOWED",
      "Target URLs must not contain embedded credentials.",
    );
  }

  const hostname = normalizeHostname(targetUrl.hostname);
  if (!allowedHosts.has(hostname)) {
    throw new TargetUrlError(
      "HOST_NOT_ALLOWED",
      `Target host "${hostname}" is not allowlisted.`,
    );
  }

  return targetUrl;
};
