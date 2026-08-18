import type { z } from "zod";

export class PersistenceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceDataError";
  }
}

export const serializeValidatedJson = (
  value: unknown,
  schema: z.ZodType,
  label: string,
): string => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new PersistenceDataError(
      `${label} is not valid structured JSON: ${parsed.error.issues[0]?.message ?? "unknown validation error"}`,
    );
  }
  return JSON.stringify(parsed.data);
};

export const parseValidatedJson = <T>(
  text: string,
  schema: z.ZodType,
  label: string,
): T => {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new PersistenceDataError(`${label} contains malformed JSON.`);
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new PersistenceDataError(
      `${label} failed validation: ${parsed.error.issues[0]?.message ?? "unknown validation error"}`,
    );
  }
  // The caller supplies T alongside the matching boundary schema. Returning is
  // safe only after that schema has parsed the unknown persisted value.
  return parsed.data as T;
};
