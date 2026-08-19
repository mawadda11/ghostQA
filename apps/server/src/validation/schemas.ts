import { z } from "zod";

const nonEmptyText = z.string().trim().min(1).max(200);
const identifier = z.string().trim().min(1).max(128);
const timeoutMs = z.number().int().min(1).max(60_000).optional();

export const locatorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("ROLE"),
      role: z.enum([
        "button",
        "checkbox",
        "combobox",
        "dialog",
        "heading",
        "link",
        "listitem",
        "navigation",
        "radio",
        "searchbox",
        "status",
        "textbox",
      ]),
      name: nonEmptyText,
      exact: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("LABEL"),
      text: nonEmptyText,
      exact: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("TEXT"),
      text: nonEmptyText,
      exact: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ kind: z.literal("TEST_ID"), value: nonEmptyText })
    .strict(),
  z
    .object({ kind: z.literal("CSS"), selector: nonEmptyText })
    .strict(),
]);

const stepBase = {
  id: identifier,
  position: z.number().int().min(0),
  timeoutMs,
};

export const flowStepSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...stepBase,
      action: z.literal("NAVIGATE"),
      path: nonEmptyText,
    })
    .strict(),
  z
    .object({
      ...stepBase,
      action: z.literal("CLICK"),
      locator: locatorSchema,
    })
    .strict(),
  z
    .object({
      ...stepBase,
      action: z.literal("FILL"),
      locator: locatorSchema,
      value: z.string().max(10_000),
      sensitive: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      action: z.literal("SELECT_OPTION"),
      locator: locatorSchema,
      value: z.string().max(1_000),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      action: z.literal("PRESS"),
      locator: locatorSchema,
      key: nonEmptyText,
    })
    .strict(),
  z
    .object({
      ...stepBase,
      action: z.literal("WAIT_FOR_URL"),
      url: nonEmptyText,
    })
    .strict(),
  z
    .object({
      ...stepBase,
      action: z.literal("ASSERT_VISIBLE"),
      locator: locatorSchema,
    })
    .strict(),
]);

export const requestMatcherSchema = z
  .object({
    method: z.string().trim().regex(/^[A-Za-z]+$/).max(16),
    pathname: z.string().startsWith("/").max(2_000),
  })
  .strict();

export const criticalActionSchema = z
  .object({
    stepId: identifier,
    label: nonEmptyText,
    request: requestMatcherSchema.optional(),
  })
  .strict();

export const successAssertionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("URL_MATCHES"),
      value: nonEmptyText,
      timeoutMs,
    })
    .strict(),
  z
    .object({
      kind: z.literal("ELEMENT_VISIBLE"),
      locator: locatorSchema,
      timeoutMs,
    })
    .strict(),
  z
    .object({
      kind: z.literal("TEXT_VISIBLE"),
      text: nonEmptyText,
      locator: locatorSchema.optional(),
      exact: z.boolean().optional(),
      timeoutMs,
    })
    .strict(),
]);

export const flowAssertionSchema = z
  .object({
    id: identifier,
    afterStepId: identifier,
    assertion: successAssertionSchema,
  })
  .strict();

export const flowAssertionsSchema = z.array(flowAssertionSchema).max(100);

export const normalizedFlowSchema = z
  .object({
    id: identifier,
    name: nonEmptyText,
    steps: z.array(flowStepSchema).min(1).max(200),
    criticalAction: criticalActionSchema.optional(),
    successAssertion: successAssertionSchema.optional(),
    assertions: flowAssertionsSchema.optional(),
  })
  .strict()
  .superRefine((flow, context) => {
    const stepIds = new Set<string>();
    flow.steps.forEach((step, index) => {
      if (stepIds.has(step.id)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "id"],
          message: `Step ID "${step.id}" must be unique.`,
        });
      }
      stepIds.add(step.id);
      if (step.position !== index) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "position"],
          message: `Expected normalized position ${index}.`,
        });
      }
    });

    if (flow.criticalAction !== undefined) {
      const criticalStep = flow.steps.find(
        (step) => step.id === flow.criticalAction?.stepId,
      );
      if (criticalStep?.action !== "CLICK") {
        context.addIssue({
          code: "custom",
          path: ["criticalAction", "stepId"],
          message: "Critical action must reference an existing CLICK step.",
        });
      }
    }

    if (
      flow.successAssertion === undefined &&
      (flow.assertions?.length ?? 0) === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["assertions"],
        message: "A flow requires a final assertion or at least one step-bound assertion.",
      });
    }

    const assertionIds = new Set<string>();
    flow.assertions?.forEach((assertion, index) => {
      if (assertionIds.has(assertion.id)) {
        context.addIssue({
          code: "custom",
          path: ["assertions", index, "id"],
          message: `Assertion ID "${assertion.id}" must be unique.`,
        });
      }
      assertionIds.add(assertion.id);
      if (!stepIds.has(assertion.afterStepId)) {
        context.addIssue({
          code: "custom",
          path: ["assertions", index, "afterStepId"],
          message: "Assertion must reference an existing flow step.",
        });
      }
    });
  });

export const elementObservationSchema = z
  .object({
    locator: locatorSchema,
    state: z.enum([
      "VISIBLE",
      "HIDDEN",
      "ENABLED",
      "DISABLED",
      "ATTRIBUTE_EQUALS",
    ]),
    attribute: z.string().trim().min(1).max(200).optional(),
    value: z.string().max(2_000).optional(),
    timeoutMs: z.number().int().min(1).max(30_000).optional(),
    stableForMs: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .superRefine((observation, context) => {
    if (
      observation.state === "ATTRIBUTE_EQUALS" &&
      (observation.attribute === undefined || observation.value === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "ATTRIBUTE_EQUALS requires attribute and value.",
      });
    }
  });

export const scenarioConfigSchema = z.discriminatedUnion("family", [
  z
    .object({
      family: z.literal("DOUBLE_ACTION"),
      request: requestMatcherSchema.optional(),
      identifierField: z
        .string()
        .regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)
        .optional(),
      responseTimeoutMs: z.number().int().min(1).max(30_000).optional(),
    })
    .strict(),
  z
    .object({
      family: z.literal("API_FAILURE"),
      checkpointStepId: identifier,
      request: requestMatcherSchema.optional(),
      statusCode: z.literal(500),
      brokenState: elementObservationSchema.optional(),
      recoveryState: elementObservationSchema.optional(),
      assertionTimeoutMs: z.number().int().min(1).max(30_000).optional(),
    })
    .strict(),
  z
    .object({
      family: z.literal("SLOW_RESPONSE"),
      checkpointStepId: identifier,
      request: requestMatcherSchema.optional(),
      delayMs: z.number().int().min(100).max(10_000),
      repeatabilityObservation: elementObservationSchema.optional(),
      preventionObservation: elementObservationSchema.optional(),
    })
    .strict(),
  z
    .object({
      family: z.literal("REFRESH_BACK_NAVIGATION"),
      mode: z.enum(["REFRESH", "BACK"]),
      checkpointStepId: identifier,
      expectedState: elementObservationSchema,
      expectedUrl: nonEmptyText.optional(),
    })
    .strict(),
  z
    .object({
      family: z.literal("SESSION_EXPIRY"),
      checkpointStepId: identifier,
      strategy: z.discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("INTERCEPT_REQUEST"),
            request: requestMatcherSchema.optional(),
            statusCode: z.literal(401),
          })
          .strict(),
        z
          .object({
            kind: z.literal("CLEAR_STORAGE"),
            cookieNames: z.array(nonEmptyText).max(50).optional(),
            localStorageKeys: z.array(nonEmptyText).max(50).optional(),
            sessionStorageKeys: z.array(nonEmptyText).max(50).optional(),
          })
          .strict()
          .refine(
            (strategy) =>
              (strategy.cookieNames?.length ?? 0) > 0 ||
              (strategy.localStorageKeys?.length ?? 0) > 0 ||
              (strategy.sessionStorageKeys?.length ?? 0) > 0,
            "At least one storage key or cookie is required.",
          ),
      ]),
      brokenState: elementObservationSchema,
      recoveryState: elementObservationSchema.optional(),
      assertionTimeoutMs: z.number().int().min(1).max(30_000).optional(),
    })
    .strict(),
]);

export const scenarioDefinitionSchema = z
  .object({
    id: identifier,
    name: nonEmptyText,
    family: z.enum([
      "DOUBLE_ACTION",
      "API_FAILURE",
      "SLOW_RESPONSE",
      "REFRESH_BACK_NAVIGATION",
      "SESSION_EXPIRY",
    ]),
    config: scenarioConfigSchema,
  })
  .strict()
  .refine(
    (scenario) => scenario.family === scenario.config.family,
    "Scenario family must match configuration family.",
  );

export const createProjectSchema = z
  .object({
    name: nonEmptyText,
    description: z.string().trim().max(2_000).optional(),
    baseUrl: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No editable fields supplied.");

export const scenarioPlanSchema = z
  .object({ scenarios: z.array(scenarioDefinitionSchema).min(1).max(20) })
  .strict();

export const updateScenarioSchema = z
  .object({
    enabled: z.boolean().optional(),
    config: scenarioConfigSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No editable fields supplied.");

export const startRunSchema = z
  .object({
    scenarioIds: z.array(identifier).max(20).optional(),
  })
  .strict();

export const executionErrorSchema = z
  .object({
    source: z.enum(["FLOW_STEP", "ENGINE"]),
    name: nonEmptyText,
    message: z.string().max(20_000),
    stepId: identifier.optional(),
  })
  .strict();

export const consoleObservationSchema = z
  .object({
    source: z.enum(["CONSOLE", "PAGE_ERROR"]),
    level: z.enum(["debug", "info", "log", "warning", "error"]),
    text: z.string().max(100_000),
    timestamp: z.iso.datetime(),
  })
  .strict();

export const networkObservationSchema = z
  .object({
    method: nonEmptyText,
    url: z.string().max(20_000),
    status: z.number().int().min(100).max(599).optional(),
    failureText: z.string().max(20_000).optional(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().optional(),
    responseIdentifier: z.string().max(128).optional(),
  })
  .strict();

export const evidenceEntrySchema = z
  .object({
    type: z.enum([
      "HTTP_REQUEST",
      "HTTP_RESPONSE",
      "DUPLICATE_REQUEST",
      "CONSOLE_ERROR",
      "PAGE_ERROR",
      "ASSERTION",
      "ELEMENT_STATE",
      "NAVIGATION",
      "SCENARIO_INJECTION",
    ]),
    message: z.string().max(20_000),
    timestamp: z.iso.datetime(),
    metadata: z.record(z.string(), z.json()).optional(),
  })
  .strict();

export const executionEvidenceSchema = z
  .object({
    finalUrl: z.string().max(20_000).optional(),
    console: z.array(consoleObservationSchema),
    network: z.array(networkObservationSchema),
    entries: z.array(evidenceEntrySchema),
  })
  .strict();

export const executedStepSchema = z
  .object({
    stepId: identifier,
    position: z.number().int().min(0),
    action: nonEmptyText,
    status: z.enum(["PASSED", "FAILED"]),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    error: z.string().max(20_000).optional(),
  })
  .strict();

export const assertionResultSchema = z
  .object({
    assertion: successAssertionSchema,
    status: z.enum(["PASSED", "FAILED", "NOT_EVALUATED"]),
    detail: z.string().max(100_000),
  })
  .strict();

export const flowAssertionResultSchema = assertionResultSchema.extend({
  id: identifier,
  afterStepId: identifier.optional(),
});

export const resultObservationsSchema = z
  .object({
    executedSteps: z.array(executedStepSchema),
    assertion: assertionResultSchema,
    assertions: z.array(flowAssertionResultSchema).optional(),
  })
  .strict();
