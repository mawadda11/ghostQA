import type {
  FlowAssertion,
  NormalizedFlow,
  SuccessAssertion,
} from "@ghostqa/shared";

export interface OrderedFlowAssertion {
  id: string;
  afterStepId?: string;
  assertion: SuccessAssertion;
}

export const orderedFlowAssertions = (
  flow: NormalizedFlow,
): readonly OrderedFlowAssertion[] => {
  const byStep = new Map(flow.steps.map((step) => [step.id, step.position]));
  const attached = [...(flow.assertions ?? [])].sort(
    (left, right) =>
      (byStep.get(left.afterStepId) ?? Number.MAX_SAFE_INTEGER) -
      (byStep.get(right.afterStepId) ?? Number.MAX_SAFE_INTEGER),
  );
  return [
    ...attached,
    ...(flow.successAssertion === undefined
      ? []
      : [
          {
            id: "final-success-assertion",
            assertion: flow.successAssertion,
          },
        ]),
  ];
};

export const assertionsAfterStep = (
  assertions: readonly FlowAssertion[] | undefined,
  stepId: string,
): readonly FlowAssertion[] =>
  (assertions ?? []).filter((assertion) => assertion.afterStepId === stepId);

export const primaryFlowAssertion = (flow: NormalizedFlow): SuccessAssertion => {
  const assertion =
    flow.successAssertion ?? flow.assertions?.[flow.assertions.length - 1]?.assertion;
  if (assertion === undefined) {
    throw new Error("The flow does not define an assertion.");
  }
  return assertion;
};
