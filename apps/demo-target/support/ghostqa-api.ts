export const ghostQaApiRequest = async <T>(
  serverUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(new URL(pathname, serverUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `GhostQA API ${init?.method ?? "GET"} ${pathname} failed with HTTP ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
};
