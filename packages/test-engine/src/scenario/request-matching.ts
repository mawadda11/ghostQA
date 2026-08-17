import type { NetworkRequestMatcher } from "@ghostqa/shared";

export const requestMatches = (
  method: string,
  rawUrl: string,
  matcher: NetworkRequestMatcher,
): boolean => {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return false;
  }

  return (
    method.toUpperCase() === matcher.method.toUpperCase() &&
    pathname === matcher.pathname
  );
};
