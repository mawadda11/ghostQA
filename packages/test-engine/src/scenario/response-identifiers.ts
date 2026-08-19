import { createHash } from "node:crypto";

import type { Response } from "playwright";

const MAX_JSON_BYTES = 16 * 1024;
const MAX_IDENTIFIER_LENGTH = 128;

type Scalar = number | string;

export interface ResponseIdentifierProof {
  field?: string;
  source?: "CONFIGURED" | "INFERRED";
  fingerprints: readonly string[];
  distinctCount: number;
}

const fingerprint = (value: Scalar): string =>
  createHash("sha256").update(String(value)).digest("hex").slice(0, 12);

const normalizedKey = (field: string): string =>
  field.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const identifierFieldName = (field: string): boolean =>
  /(^|_)(id|uuid|key|identifier|reference|ref)($|_)/.test(
    normalizedKey(field).replace(/-/g, "_"),
  );

const excludedFieldName = (field: string): boolean =>
  /(^|_)(time|timestamp|date|created|updated|status|state|success|message|error|count)($|_)/.test(
    normalizedKey(field).replace(/-/g, "_"),
  );

const timestampLike = (value: Scalar): boolean => {
  if (typeof value === "number") {
    return (
      (value >= 946_684_800 && value <= 4_102_444_800) ||
      (value >= 946_684_800_000 && value <= 4_102_444_800_000)
    );
  }
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
};

const generatedIdentifierLike = (value: Scalar): boolean => {
  const text = String(value);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return true;
  }
  if (/^[A-Za-z]{1,16}[-_][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*$/.test(text)) {
    return true;
  }
  return (
    text.length >= 12 &&
    /^[A-Za-z0-9_-]+$/.test(text) &&
    /[A-Za-z]/.test(text) &&
    /\d/.test(text)
  );
};

const scalar = (value: unknown): value is Scalar =>
  (typeof value === "string" || typeof value === "number") &&
  String(value).length > 0 &&
  String(value).length <= MAX_IDENTIFIER_LENGTH;

const objectPayload = (
  value: unknown,
): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const candidateScore = (field: string, values: readonly Scalar[]): number => {
  if (excludedFieldName(field) || values.some(timestampLike)) return 0;
  return (identifierFieldName(field) ? 4 : 0) +
    (values.every(generatedIdentifierLike) ? 3 : 0);
};

/**
 * Infers only a high-confidence, top-level identifier shared by every response.
 * Returned evidence is fingerprinted; response values never leave this module.
 */
export const inferResponseIdentifierProof = (
  payloads: readonly unknown[],
  options: {
    configuredField?: string;
    capturedInputValues?: readonly string[];
  } = {},
): ResponseIdentifierProof => {
  const objects = payloads.map(objectPayload);
  if (objects.length < 2 || objects.some((value) => value === undefined)) {
    return { fingerprints: [], distinctCount: 0 };
  }
  const records = objects as readonly Readonly<Record<string, unknown>>[];
  const fields =
    options.configuredField === undefined
      ? Object.keys(records[0] ?? {})
      : [options.configuredField];
  const inputValues = new Set(options.capturedInputValues ?? []);
  const candidates = fields.flatMap((field) => {
    const values = records.map((record) => record[field]);
    if (!values.every(scalar)) return [];
    const typedValues = values as readonly Scalar[];
    if (typedValues.some((value) => inputValues.has(String(value)))) return [];
    const score =
      options.configuredField === field
        ? excludedFieldName(field) || typedValues.some(timestampLike)
          ? 0
          : 10
        : candidateScore(field, typedValues);
    return score === 0
      ? []
      : [{
          field,
          values: typedValues,
          score,
          distinctCount: new Set(typedValues.map(String)).size,
        }];
  });
  const selected = candidates.sort(
    (left, right) =>
      right.score - left.score ||
      right.distinctCount - left.distinctCount ||
      left.field.localeCompare(right.field),
  )[0];
  if (selected === undefined) {
    return { fingerprints: [], distinctCount: 0 };
  }
  const fingerprints = selected.values.map(fingerprint);
  return {
    field: selected.field,
    source:
      options.configuredField === selected.field ? "CONFIGURED" : "INFERRED",
    fingerprints,
    distinctCount: new Set(fingerprints).size,
  };
};

export const readSmallJsonResponse = async (
  response: Pick<Response, "body" | "headers">,
): Promise<unknown | undefined> => {
  const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    return undefined;
  }
  try {
    const body = await response.body();
    if (body.byteLength > MAX_JSON_BYTES) return undefined;
    return JSON.parse(body.toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
};

export const inspectResponseIdentifiers = async (
  responses: readonly Pick<Response, "body" | "headers">[],
  options: {
    configuredField?: string;
    capturedInputValues?: readonly string[];
  } = {},
): Promise<ResponseIdentifierProof> =>
  inferResponseIdentifierProof(
    await Promise.all(responses.map(readSmallJsonResponse)),
    options,
  );
