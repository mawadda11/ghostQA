import { useCallback, useEffect, useState } from "react";

export interface NavigationState {
  path: string;
  navigate: (path: string) => void;
}

export const useNavigation = (): NavigationState => {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = (): void => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextPath: string): void => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }, []);

  return { path, navigate };
};
