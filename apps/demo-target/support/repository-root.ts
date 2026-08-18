import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRootFromModule = (): string => {
  const candidates = [
    fileURLToPath(new URL("../../../../", import.meta.url)),
    fileURLToPath(new URL("../../../", import.meta.url)),
  ];
  const root = candidates.find((candidate) =>
    existsSync(path.join(candidate, "package-lock.json")),
  );
  if (root === undefined) {
    throw new Error("Could not resolve the GhostQA repository root.");
  }
  return root;
};
