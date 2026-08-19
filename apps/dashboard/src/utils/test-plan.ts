import type {
  ElementStateExpectation,
  ScenarioDefinition,
  TestPlanRecommendations,
} from "@ghostqa/shared";

export interface ScenarioCardSelection {
  enabled: boolean;
  checkpointStepId: string;
  observationId: string;
  expectedState: ElementStateExpectation;
  delayMs: number;
  sessionMethod: string;
  sessionPathname: string;
}

export type TestPlanSelections = Readonly<Record<string, ScenarioCardSelection>>;

export const initialTestPlanSelections = (
  plan: TestPlanRecommendations,
): Record<string, ScenarioCardSelection> =>
  Object.fromEntries(
    plan.recommendations.map((recommendation) => [
      recommendation.scenarioKey,
      {
        enabled:
          recommendation.defaultSelected ??
          (recommendation.recommendation === "RECOMMENDED" &&
            recommendation.configuration === "READY"),
        checkpointStepId: recommendation.defaultCheckpointStepId ?? "",
        observationId: recommendation.defaultObservationId ?? "",
        expectedState:
          recommendation.family === "API_FAILURE" ||
          recommendation.family === "SESSION_EXPIRY"
            ? "HIDDEN"
            : "VISIBLE",
        delayMs: 2_000,
        sessionMethod: "",
        sessionPathname: "",
      },
    ]),
  );

export interface BuiltTestPlan {
  definitions: ScenarioDefinition[];
  errors: Readonly<Record<string, string>>;
}

export const buildScenarioDefinitions = (
  plan: TestPlanRecommendations,
  selections: TestPlanSelections,
): BuiltTestPlan => {
  const definitions: ScenarioDefinition[] = [];
  const errors: Record<string, string> = {};

  for (const recommendation of plan.recommendations) {
    const selection = selections[recommendation.scenarioKey];
    if (selection?.enabled !== true) continue;
    const observation = plan.observations.find(
      ({ id }) => id === selection.observationId,
    );
    const expectedState =
      observation === undefined
        ? undefined
        : { ...observation.observation, state: selection.expectedState };
    const fail = (message: string): void => {
      errors[recommendation.scenarioKey] = message;
    };

    switch (recommendation.family) {
      case "DOUBLE_ACTION":
        if (recommendation.request === undefined) {
          fail("An observed critical mutation request is required.");
        } else {
          definitions.push({
            id: recommendation.scenarioKey,
            name: recommendation.name,
            family: recommendation.family,
            config: {
              family: "DOUBLE_ACTION",
              request: recommendation.request,
            },
          });
        }
        break;
      case "API_FAILURE":
        if (
          recommendation.request === undefined ||
          selection.checkpointStepId.length === 0
        ) {
          fail("A preceding checkpoint and observed request are required.");
        } else {
          definitions.push({
            id: recommendation.scenarioKey,
            name: recommendation.name,
            family: recommendation.family,
            config: {
              family: "API_FAILURE",
              checkpointStepId: selection.checkpointStepId,
              request: recommendation.request,
              statusCode: 500,
              ...(expectedState === undefined
                ? {}
                : { brokenState: expectedState }),
            },
          });
        }
        break;
      case "SLOW_RESPONSE":
        if (
          recommendation.request === undefined ||
          selection.checkpointStepId.length === 0
        ) {
          fail("A preceding checkpoint and observed request are required.");
        } else {
          definitions.push({
            id: recommendation.scenarioKey,
            name: recommendation.name,
            family: recommendation.family,
            config: {
              family: "SLOW_RESPONSE",
              checkpointStepId: selection.checkpointStepId,
              request: recommendation.request,
              delayMs: selection.delayMs,
            },
          });
        }
        break;
      case "REFRESH_BACK_NAVIGATION":
        if (
          recommendation.mode === undefined ||
          selection.checkpointStepId.length === 0 ||
          expectedState === undefined
        ) {
          fail("Choose a checkpoint and expected state.");
        } else {
          definitions.push({
            id: recommendation.scenarioKey,
            name: recommendation.name,
            family: recommendation.family,
            config: {
              family: "REFRESH_BACK_NAVIGATION",
              mode: recommendation.mode,
              checkpointStepId: selection.checkpointStepId,
              expectedState,
              ...(recommendation.defaultExpectedUrl === undefined
                ? {}
                : { expectedUrl: recommendation.defaultExpectedUrl }),
            },
          });
        }
        break;
      case "SESSION_EXPIRY":
        if (
          selection.checkpointStepId.length === 0 ||
          expectedState === undefined ||
          !/^[A-Za-z]+$/.test(selection.sessionMethod) ||
          !selection.sessionPathname.startsWith("/")
        ) {
          fail("Enter an explicit session request, checkpoint, and expected state.");
        } else {
          definitions.push({
            id: recommendation.scenarioKey,
            name: recommendation.name,
            family: recommendation.family,
            config: {
              family: "SESSION_EXPIRY",
              checkpointStepId: selection.checkpointStepId,
              strategy: {
                kind: "INTERCEPT_REQUEST",
                request: {
                  method: selection.sessionMethod.toUpperCase(),
                  pathname: selection.sessionPathname,
                },
                statusCode: 401,
              },
              brokenState: expectedState,
            },
          });
        }
        break;
    }
  }
  return { definitions, errors };
};
