import type {
  EngineExecutionReport,
  EngineExecutionRequest,
} from "@ghostqa/shared";

/**
 * The persistence-free boundary used by the GhostQA server.
 *
 * A Playwright-backed implementation will be added in a later phase. Keeping
 * this contract implementation-agnostic prevents target-specific behavior from
 * leaking into the reusable engine.
 */
export interface TestEngine {
  execute(request: EngineExecutionRequest): Promise<EngineExecutionReport>;
}

export type { EngineExecutionReport, EngineExecutionRequest };
