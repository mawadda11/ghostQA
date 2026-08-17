import type {
  ConsoleObservation,
  EvidenceEntry,
  EvidenceEntryType,
  JsonValue,
} from "@ghostqa/shared";

export const createEvidenceEntry = (
  type: EvidenceEntryType,
  message: string,
  metadata?: Readonly<Record<string, JsonValue>>,
): EvidenceEntry => ({
  type,
  message,
  timestamp: new Date().toISOString(),
  ...(metadata === undefined ? {} : { metadata }),
});

export const consoleEvidenceEntries = (
  observations: readonly ConsoleObservation[],
): EvidenceEntry[] =>
  observations.map((observation) =>
    createEvidenceEntry(
      observation.source === "PAGE_ERROR" ? "PAGE_ERROR" : "CONSOLE_ERROR",
      observation.text,
      { level: observation.level },
    ),
  );
